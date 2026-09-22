import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal, components } from "./_generated/api";
import { Workpool } from "@convex-dev/workpool";
import { isUserAdmin, getAuthenticatedUserId } from "./users";
import { requireJudgingGroupPermission } from "./adminAccess";
import { verifyPassword } from "./judgingGroups";
import { parseHackathonLogHeader } from "./hackathonLog"; // hackathon.md header parsing (admin views)
import { logActivity } from "./activityLog";
import {
  FRONTEND_CHECKER_KEY,
  computeWeightedScore,
  compareAiResults,
  rankCompletedAiResults,
} from "./lib/aiRank";
import { isInJudgeQueue, showsBelowCut } from "./lib/judgeQueue";
import {
  computeSubmissionTiming,
  submissionTimingValidator,
  type SubmissionTiming,
} from "./lib/submissionTiming";

// Analyses run through a workpool with limited parallelism: faster than the
// old one-at-a-time scheduler chain while staying inside GitHub rate limits.
const aiJudgePool = new Workpool(components.workpool, { maxParallelism: 4 });

// Built-in "Best Use of Convex" rubric. Shared with the analysis action so
// prompts and stored results always use the same keys. Groups can append
// their own criteria via aiCustomCriteria (see getRubricForGroup).
export const AI_JUDGE_RUBRIC: Array<{
  key: string;
  label: string;
  description: string;
}> = [
  {
    key: "schema",
    label: "Schema and data modeling",
    description:
      "Quality of Convex schema design: tables, validators, indexes, and document-relational modeling.",
  },
  {
    key: "functions",
    label: "Queries, mutations, and actions",
    description:
      "Correct use of Convex functions: new function syntax, args/returns validators, indexed queries instead of filters, and proper query/mutation/action separation.",
  },
  {
    key: "realtime",
    label: "Real-time reactivity",
    description:
      "Use of Convex reactivity: useQuery subscriptions, live-updating UI, and consistency across views.",
  },
  {
    key: "advanced",
    label: "Advanced Convex features",
    description:
      "Use of advanced features: scheduler and crons, file storage, full-text or vector search, HTTP actions, components, and agents. Convex components installed via convex.config.ts (e.g. @convex-dev/agent, resend, rate limiter, workpool, aggregate) are a strong signal: score noticeably higher when components are used well.",
  },
  {
    key: "depth",
    label: "Overall depth and correctness",
    description:
      "How central and correct the Convex integration is to the app overall, versus superficial usage.",
  },
  {
    key: "liveness",
    label: "Live app status",
    description:
      "Whether the submitted live app URL is up and working. A dead or 404 URL scores 1-2; a reachable, functional app scores based on how well it appears to work.",
  },
];

export type RubricCriterion = {
  key: string;
  label: string;
  description: string;
};

// Frontend checker: preset custom criterion key plus the fixed hosting
// platform list for per-platform sub-weights. The detected platform's weight
// multiplies the frontend-checker criterion weight in the weighted ranking.
// The key and the weighted score math live in lib/aiRank.ts so ranking is
// identical everywhere; re-exported here for existing importers.
export { FRONTEND_CHECKER_KEY, computeWeightedScore } from "./lib/aiRank";
// Social proof: preset custom criterion key. Scored from the SOCIAL PROOF
// snapshot section (X and Bluesky metrics, LinkedIn liveness), never from
// numbers the model guesses. Mirrored in groupSection.tsx.
export const SOCIAL_PROOF_KEY = "social-proof";
export const AI_FRONTEND_PLATFORMS: Array<{ key: string; label: string }> = [
  { key: "codex-sites", label: "Codex Sites" },
  { key: "convex-hosting", label: "Convex static hosting" },
  { key: "vercel", label: "Vercel" },
  { key: "netlify", label: "Netlify" },
  { key: "other", label: "Other" },
];

// Human judging criteria mirrored into the AI rubric use this key prefix
// plus the judgingCriteria document id, so the key stays stable when the
// question text is edited and never clashes with built-in or custom keys.
export const HUMAN_CRITERION_PREFIX = "human-";

// Minimal shape of a judgingCriteria row needed to build a rubric entry
export type HumanCriterionSource = {
  _id: Id<"judgingCriteria">;
  question: string;
  description?: string;
};

export function humanCriterionKey(criteriaId: Id<"judgingCriteria">): string {
  return `${HUMAN_CRITERION_PREFIX}${criteriaId}`;
}

// Convert the group's human criteria into AI rubric entries. The question
// becomes the label; the description (or the question when absent) tells the
// model what to evaluate, plus a note about the human scale so intent lines
// up even though the AI always scores 1-10.
export function humanCriteriaToRubric(
  criteria: Array<HumanCriterionSource>,
  scoreScale: number,
): Array<RubricCriterion> {
  return criteria.map((c) => {
    const detail = c.description?.trim() || c.question.trim();
    return {
      key: humanCriterionKey(c._id),
      label: c.question.trim(),
      description: `${detail} (Human judging criterion for this event: human judges score it 1-${scoreScale}; you score the same intent 1-10 using the live app, screenshot, video transcript, and repository as evidence.)`,
    };
  });
}

// Effective rubric for a group: the built-in six plus any admin-defined
// custom criteria, plus the group's human criteria when mirroring is on,
// minus any criteria the admin switched off. Used by the analysis action,
// weight validation, and the prompt editor so every consumer sees the same
// keys. If somehow every key is disabled, the full list is used so an
// analysis can never run with an empty rubric.
export function getRubricForGroup(
  group: {
    aiCustomCriteria?: Array<RubricCriterion>;
    aiDisabledCriteria?: Array<string>;
    aiIncludeHumanCriteria?: boolean;
    scoreScale?: number;
  },
  humanCriteria?: Array<HumanCriterionSource>,
): Array<RubricCriterion> {
  const mirrored =
    group.aiIncludeHumanCriteria && humanCriteria
      ? humanCriteriaToRubric(humanCriteria, group.scoreScale ?? 10)
      : [];
  const all = [
    ...AI_JUDGE_RUBRIC,
    ...(group.aiCustomCriteria ?? []),
    ...mirrored,
  ];
  const disabled = new Set(group.aiDisabledCriteria ?? []);
  if (disabled.size === 0) return all;
  const enabled = all.filter((c) => !disabled.has(c.key));
  return enabled.length > 0 ? enabled : all;
}

// Human criteria rows for a group in display order (shared by the admin
// queries and the analysis data loader)
async function getHumanCriteriaForGroup(
  ctx: QueryCtx,
  groupId: Id<"judgingGroups">,
): Promise<Array<HumanCriterionSource>> {
  const rows = await ctx.db
    .query("judgingCriteria")
    .withIndex("by_groupId_order", (q) => q.eq("groupId", groupId))
    .order("asc")
    .collect();
  return rows.map((r) => ({
    _id: r._id,
    question: r.question,
    description: r.description,
  }));
}

// Default AI judge system prompt body. {{rubric}} expands to the numbered
// criteria list at analysis time. The JSON response contract is ALWAYS
// appended by the analysis action and is never part of the editable body,
// so custom prompts cannot break response parsing.
export const DEFAULT_AI_JUDGE_PROMPT_BODY = `You are an expert judge evaluating hackathon submissions for "Best Use of Convex".

Convex is the open source reactive database where queries are TypeScript code running in the database. Key Convex concepts: schema definitions with validators and indexes in convex/schema.ts, query/mutation/action functions in the convex/ directory, real-time subscriptions via useQuery in React, the scheduler and cron jobs, file storage, full-text and vector search, HTTP actions, and Convex components (installed via convex.config.ts).

Score the submission on each rubric criterion from 1 to 10:
{{rubric}}

Scoring guidelines:
- 1-3: Little to no meaningful Convex usage for this criterion
- 4-6: Basic usage, meets expectations
- 7-8: Strong usage, exceeds expectations
- 9-10: Exceptional, deep and idiomatic Convex usage

Rules:
- The VERIFIED CONVEX FACTS section contains counts measured directly from the repository by a deterministic scanner. These facts are authoritative. Never contradict them: never claim a feature exists when the facts say it is absent, never claim a feature is missing when the facts say it is present, and never state different counts. Your job is to judge the QUALITY and idiomatic depth of what the facts show, not to decide whether it exists.
- Base scores primarily on the GitHub repository code when available. The live site scrape and description are secondary signals.
- If the repository was not accessible, say so in your reasoning and score conservatively from the remaining evidence.
- For the "liveness" criterion, use the LIVE URL CHECK facts provided: if the URL is dead, 404, or missing, score it 1-2 and state the observed status in your reasoning; if it is live, score it 5-10 based on how functional the scraped content suggests the app is. This criterion only reflects the live app URL, never social or video links.
- If the live URL is dead, 404, or missing, also flag that fact explicitly in overallReasoning. Do NOT lower the other five Convex criteria because of it; the ranking should stay mostly about Convex usage.
- Convex components: only components listed as USED IN CODE (referenced via components.<name> in source) count toward the "advanced" score. Components that are installed in package.json or convex.config.ts but never referenced in code earn NOTHING; do not raise any score for them. A submission that uses one or more components well should generally score 7 or higher on "advanced", and thoughtful multi-component usage can justify 9-10. Name each used component in your "advanced" reasoning.
- The GIT HISTORY section (when present) is context about the build timeline. It is informational; do not add or remove points for commit counts or timeline shape on their own.
- The AUTH PROVIDER and AI MODEL EVIDENCE sections (when present) are measured from source the same way VERIFIED CONVEX FACTS are. Never contradict them. Name the detected auth library and Convex AI Gateway use (or its absence) in reasoning when those sections exist. Do not invent an auth provider or gateway use the facts do not show.
- The PROJECT LOG FILES and PUBLISHED HACKATHON MANIFEST sections (when present) are self-reported by the team: hackathon logs, changelogs, task lists, and the published manifest. Use them as context for what was built and when, but the VERIFIED CONVEX FACTS always win over self-reported claims. If the manifest claims components or features the facts do not show, note the gap in your reasoning. A missing hackathon.md is not a penalty; judge from repo and live-app evidence.
- Be specific in reasoning: name actual files, functions, tables, or features you observed.`;

// Limits for admin-editable AI settings
const MAX_PROMPT_LENGTH = 20000;
const MAX_CUSTOM_CRITERIA = 10;

// Shared validator for a criteria score row
const criteriaScoreValidator = v.object({
  key: v.string(),
  label: v.string(),
  score: v.number(),
  reasoning: v.string(),
});

// Shared validator for the deterministic live app URL check
const urlCheckValidator = v.object({
  checkedUrl: v.optional(v.string()),
  isLive: v.boolean(),
  statusCode: v.optional(v.number()),
  note: v.string(),
});

// Shared validator for the deterministic frontend hosting detection
export const frontendHostingValidator = v.object({
  platform: v.string(),
  evidence: v.string(),
});

// Shared validator for one sponsor integration (mirrors schema.ts and the
// SponsorEvidence type in aiJudgeAnalysis.ts). Recorded only, never scored.
export const sponsorEvidenceValidator = v.object({
  sponsor: v.string(),
  via: v.array(
    v.union(
      v.literal("component"),
      v.literal("sdk"),
      v.literal("api_key"),
      v.literal("http"),
      v.literal("gateway"),
    ),
  ),
  evidence: v.string(),
});

// Shared validator for deterministic repo facts (mirrors schema.ts)
export const repoFactsValidator = v.object({
  convexFileCount: v.number(),
  hasSchema: v.boolean(),
  hasHttpRouter: v.boolean(),
  hasCrons: v.boolean(),
  hasConvexConfig: v.boolean(),
  tableCount: v.number(),
  indexCount: v.number(),
  searchIndexCount: v.number(),
  vectorIndexCount: v.number(),
  queryCount: v.number(),
  mutationCount: v.number(),
  actionCount: v.number(),
  httpActionCount: v.number(),
  usesScheduler: v.boolean(),
  usesStorage: v.boolean(),
  usesVectorSearch: v.boolean(),
  usesAuth: v.boolean(),
  usesPagination: v.boolean(),
  returnsValidatorCount: v.number(),
});

// Shared validator for git history facts (mirrors schema.ts)
export const gitFactsValidator = v.object({
  firstCommitAt: v.optional(v.number()),
  lastCommitAt: v.optional(v.number()),
  commitCount: v.number(),
  commitCountCapped: v.boolean(),
  activeDayCount: v.number(),
  contributorCount: v.number(),
  builtDuringEvent: v.union(
    v.literal("in_window"),
    v.literal("started_before"),
    v.literal("no_window_set"),
  ),
  repoCreatedAt: v.optional(v.number()),
  isFork: v.boolean(),
  parentRepo: v.optional(v.string()),
});

// Shared validator for harness attribution signals (mirrors schema.ts).
// Metadata only: never used in scoring.
export const harnessSignalValidator = v.object({
  tool: v.string(),
  source: v.union(v.literal("commit_trailer"), v.literal("config_file")),
  evidence: v.string(),
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
});

const repoAccessValidator = v.union(
  v.literal("public"),
  v.literal("private_or_missing"),
);

// Advisory Jev pass over the rubric (mirrors schema.ts aiJudgeResults)
const secondOpinionValidator = v.object({
  model: v.string(),
  truncated: v.boolean(),
  scores: v.array(
    v.object({
      key: v.string(),
      score: v.number(),
      confidence: v.optional(v.number()),
    }),
  ),
});

// Shared validator for a fully-shaped AI result returned to clients
const aiResultValidator = v.object({
  _id: v.id("aiJudgeResults"),
  _creationTime: v.number(),
  storyId: v.id("stories"),
  storyTitle: v.string(),
  storySlug: v.string(),
  storyUrl: v.optional(v.string()),
  githubUrl: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  // Submitted vs the group's event end; derived on read, never stored
  submissionTiming: submissionTimingValidator,
  criteriaScores: v.optional(v.array(criteriaScoreValidator)),
  totalScore: v.optional(v.number()),
  averageScore: v.optional(v.number()),
  weightedScore: v.optional(v.number()), // Derived from group weights, never stored
  overallReasoning: v.optional(v.string()),
  convexFeaturesDetected: v.optional(v.array(v.string())),
  componentsDetected: v.optional(v.array(v.string())), // Installed
  componentsUsed: v.optional(v.array(v.string())), // Referenced in code
  judgeProvider: v.optional(v.string()),
  judgeModel: v.optional(v.string()),
  // Advisory Jev pass; shown beside criteriaScores, never ranked
  secondOpinion: v.optional(secondOpinionValidator),
  repoFacts: v.optional(repoFactsValidator),
  gitFacts: v.optional(gitFactsValidator),
  harnessSignals: v.optional(v.array(harnessSignalValidator)),
  repoAccess: v.optional(repoAccessValidator),
  // Self-reported by the submitter, unverified; kept separate from detected signals
  selfReportedHarness: v.optional(v.string()),
  selfReportedModel: v.optional(v.string()),
  error: v.optional(v.string()),
  sourcesUsed: v.optional(
    v.object({
      github: v.boolean(),
      liveUrl: v.boolean(),
      videoTranscript: v.optional(v.boolean()),
      screenshot: v.optional(v.boolean()),
      socialProof: v.optional(v.boolean()),
    }),
  ),
  urlCheck: v.optional(urlCheckValidator),
  frontendHosting: v.optional(frontendHostingValidator),
  // hackathon.md header cross-check notes; populated for admin views only
  logDiscrepancies: v.optional(v.array(v.string())),
  // Event free text from the repo or pasted hackathon.md header; admin only
  hackathonLogEvent: v.optional(v.string()),
  authProvider: v.optional(v.string()),
  usesAiGateway: v.optional(v.boolean()),
  aiModelIdsDetected: v.optional(v.array(v.string())),
  modelProvidersDetected: v.optional(v.array(v.string())),
  sponsorStack: v.optional(v.array(sponsorEvidenceValidator)),
  editedAt: v.optional(v.number()),
});

const groupSummaryInputValidator = v.object({
  title: v.string(),
  averageScore: v.optional(v.number()),
  overallReasoning: v.optional(v.string()),
  convexFeaturesDetected: v.optional(v.array(v.string())),
  componentsUsed: v.optional(v.array(v.string())),
  repoFacts: v.optional(repoFactsValidator),
  gitFacts: v.optional(gitFactsValidator),
  urlCheck: v.optional(urlCheckValidator),
});

// Stable, compact fingerprint of the evidence that can affect a group summary.
function getGroupSummaryFingerprint(
  rows: Array<Doc<"aiJudgeResults">>,
): string {
  const payload = JSON.stringify(
    [...rows]
      .sort((a, b) => a._id.localeCompare(b._id))
      .map((row) => ({
        id: row._id,
        status: row.status,
        criteriaScores: row.criteriaScores,
        averageScore: row.averageScore,
        overallReasoning: row.overallReasoning,
        convexFeaturesDetected: row.convexFeaturesDetected,
        componentsUsed: row.componentsUsed,
        repoFacts: row.repoFacts,
        gitFacts: row.gitFacts,
        urlCheck: row.urlCheck,
        error: row.error,
        editedAt: row.editedAt,
      })),
  );
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1:${rows.length}:${(hash >>> 0).toString(36)}`;
}

// Helper mirroring judgingGroups: exclude deleted/hidden/archived/rejected stories
function isStoryValidForJudging(
  story: Doc<"stories"> | null,
): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isHidden === true) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  return true;
}

// Enrich AI result rows with story metadata, dropping rows whose story is gone/invalid.
// weightedScore is derived here from the group's current rubric weights.
async function enrichResults(
  ctx: QueryCtx,
  groupId: Id<"judgingGroups">,
  results: Array<Doc<"aiJudgeResults">>,
  weights: Array<{ key: string; weight: number }> | undefined,
  frontendWeights?: Array<{ key: string; weight: number }>,
  options?: {
    // When true (admin views only), include hackathon.md cross-check notes and
    // the header event text. Public callers leave this undefined.
    includeLogMeta?: boolean;
    // Story ids currently in the group. Pass when the caller already loaded
    // memberships; otherwise they are read here.
    memberStoryIds?: Set<Id<"stories">>;
    // Group event end; drives the late submission label on every row
    deadlineAt?: number;
  },
) {
  // Only rank stories that are still members of the group. AI rows can
  // outlive a membership (older removals), and counting them would push real
  // submissions down a rank and disagree with the judge badges.
  const memberStoryIds =
    options?.memberStoryIds ??
    new Set(
      (
        await ctx.db
          .query("judgingGroupSubmissions")
          .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
          .collect()
      ).map((m) => m.storyId),
    );

  const enriched: Array<{
    _id: Id<"aiJudgeResults">;
    _creationTime: number;
    storyId: Id<"stories">;
    storyTitle: string;
    storySlug: string;
    storyUrl?: string;
    githubUrl?: string;
    status: "pending" | "running" | "completed" | "failed";
    submissionTiming: SubmissionTiming;
    criteriaScores?: Array<{
      key: string;
      label: string;
      score: number;
      reasoning: string;
    }>;
    totalScore?: number;
    averageScore?: number;
    weightedScore?: number;
    overallReasoning?: string;
    convexFeaturesDetected?: Array<string>;
    componentsDetected?: Array<string>;
    componentsUsed?: Array<string>;
    judgeProvider?: string;
    judgeModel?: string;
    secondOpinion?: Doc<"aiJudgeResults">["secondOpinion"];
    repoFacts?: Doc<"aiJudgeResults">["repoFacts"];
    gitFacts?: Doc<"aiJudgeResults">["gitFacts"];
    harnessSignals?: Doc<"aiJudgeResults">["harnessSignals"];
    repoAccess?: "public" | "private_or_missing";
    selfReportedHarness?: string;
    selfReportedModel?: string;
    error?: string;
    sourcesUsed?: {
      github: boolean;
      liveUrl: boolean;
      videoTranscript?: boolean;
      screenshot?: boolean;
      socialProof?: boolean;
    };
    urlCheck?: {
      checkedUrl?: string;
      isLive: boolean;
      statusCode?: number;
      note: string;
    };
    frontendHosting?: { platform: string; evidence: string };
    logDiscrepancies?: Array<string>;
    hackathonLogEvent?: string;
    authProvider?: string;
    usesAiGateway?: boolean;
    aiModelIdsDetected?: Array<string>;
    modelProvidersDetected?: Array<string>;
    sponsorStack?: Doc<"aiJudgeResults">["sponsorStack"];
    editedAt?: number;
  }> = [];

  for (const result of results) {
    if (!memberStoryIds.has(result.storyId)) continue;
    const story = await ctx.db.get(result.storyId);
    if (!isStoryValidForJudging(story)) continue;
    enriched.push({
      _id: result._id,
      _creationTime: result._creationTime,
      storyId: result.storyId,
      storyTitle: story.title,
      storySlug: story.slug,
      storyUrl: story.url,
      githubUrl: story.githubUrl,
      status: result.status,
      submissionTiming: computeSubmissionTiming(
        story._creationTime,
        options?.deadlineAt,
      ),
      criteriaScores: result.criteriaScores,
      totalScore: result.totalScore,
      averageScore: result.averageScore,
      weightedScore: computeWeightedScore(result.criteriaScores, weights, {
        platform: result.frontendHosting?.platform,
        platformWeights: frontendWeights,
      }),
      overallReasoning: result.overallReasoning,
      convexFeaturesDetected: result.convexFeaturesDetected,
      componentsDetected: result.componentsDetected,
      componentsUsed: result.componentsUsed,
      // Fall back to the deprecated fields for rows the backfill has not reached
      judgeProvider: result.judgeProvider ?? result.provider,
      judgeModel: result.judgeModel ?? result.model,
      secondOpinion: result.secondOpinion,
      repoFacts: result.repoFacts,
      gitFacts: result.gitFacts,
      harnessSignals: result.harnessSignals,
      repoAccess: result.repoAccess,
      selfReportedHarness: story.selfReportedHarness,
      selfReportedModel: story.selfReportedModel,
      error: result.error,
      sourcesUsed: result.sourcesUsed,
      urlCheck: result.urlCheck,
      frontendHosting: result.frontendHosting,
      logDiscrepancies: options?.includeLogMeta
        ? result.logDiscrepancies
        : undefined,
      // Prefer the event stored at analysis time (parsed from the repo's
      // hackathon.md); fall back to parsing a pasted log for older rows.
      hackathonLogEvent: options?.includeLogMeta
        ? (result.hackathonLogEvent ??
          (story.hackathonLog
            ? parseHackathonLogHeader(story.hackathonLog).event
            : undefined))
        : undefined,
      authProvider: result.authProvider,
      usesAiGateway: result.usesAiGateway,
      aiModelIdsDetected: result.aiModelIdsDetected,
      modelProvidersDetected: result.modelProvidersDetected,
      sponsorStack: result.sponsorStack,
      editedAt: result.editedAt,
    });
  }

  // Rank on weightedScore with the shared comparator (lib/aiRank.ts) so the
  // admin view, public page, shortlist, and judge badges all agree
  enriched.sort(compareAiResults);
  return enriched;
}

// --- Admin: run and manage reviews ---

/**
 * Start (or re-run) the AI review for a judging group.
 * Upserts pending result rows for every valid submission, then enqueues every
 * analysis into the AI judge workpool (maxParallelism 4).
 */
export const startReview = mutation({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({ queued: v.number() }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new ConvexError("Judging group not found");
    }
    if (!group.aiJudgeEnabled) {
      throw new ConvexError(
        "The AI judge is turned off for this group. Enable it in the AI judge section, then run the review.",
      );
    }

    // Block concurrent runs: any running row means a review is in progress
    const existingResults = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    if (existingResults.some((r) => r.status === "running")) {
      throw new ConvexError(
        "An AI review is already in progress for this group",
      );
    }

    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const existingByStory = new Map(existingResults.map((r) => [r.storyId, r]));

    const pendingIds: Array<Id<"aiJudgeResults">> = [];
    for (const submission of submissions) {
      const story = await ctx.db.get(submission.storyId);
      if (!isStoryValidForJudging(story)) continue;

      const existing = existingByStory.get(submission.storyId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: "pending" as const,
          error: undefined,
        });
        pendingIds.push(existing._id);
      } else {
        const newId = await ctx.db.insert("aiJudgeResults", {
          groupId: args.groupId,
          storyId: submission.storyId,
          status: "pending" as const,
        });
        pendingIds.push(newId);
      }
    }

    if (pendingIds.length === 0) {
      throw new ConvexError("This judging group has no submissions to review");
    }

    // Enqueue every analysis; the workpool runs at most 4 in parallel
    for (const resultId of pendingIds) {
      await aiJudgePool.enqueueAction(
        ctx,
        internal.aiJudgeAnalysis.analyzeSubmission,
        { resultId },
      );
    }

    // Group activity log entry for the audit trail
    await logActivity(ctx, {
      category: "judging",
      action: "judging.aiRunStarted",
      message: `Started an AI review run in ${group.name} (${pendingIds.length} submission${pendingIds.length === 1 ? "" : "s"} queued)`,
      targetType: "judgingGroup",
      targetId: args.groupId,
      targetLabel: group.name,
      groupId: args.groupId,
      metadata: { queued: pendingIds.length },
    });

    return { queued: pendingIds.length };
  },
});

/**
 * Retry the AI review for a single submission (e.g. after a failure).
 */
export const retrySubmission = mutation({
  args: { resultId: v.id("aiJudgeResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) {
      throw new ConvexError("AI result not found");
    }
    await requireJudgingGroupPermission(ctx, result.groupId, "judging.ai");
    if (result.status === "running") {
      throw new ConvexError("This submission is currently being reviewed");
    }

    await ctx.db.patch(args.resultId, {
      status: "pending" as const,
      error: undefined,
    });
    await aiJudgePool.enqueueAction(
      ctx,
      internal.aiJudgeAnalysis.analyzeSubmission,
      {
        resultId: args.resultId,
      },
    );

    // Group activity log entry for the audit trail
    const retryStory = await ctx.db.get(result.storyId);
    await logActivity(ctx, {
      category: "judging",
      action: "judging.aiRetryQueued",
      message: `Queued an AI review retry for "${retryStory?.title ?? "a submission"}"`,
      targetType: "story",
      targetId: result.storyId,
      targetLabel: retryStory?.title,
      groupId: result.groupId,
      metadata: { storySlug: retryStory?.slug },
    });
    return null;
  },
});

/**
 * Admin: set per-criterion weights for this group's AI rubric. Weighted
 * scores are derived at read time, so changing weights re-ranks immediately
 * without re-running any review.
 */
export const updateAiRubricWeights = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    weights: v.optional(
      v.array(v.object({ key: v.string(), weight: v.number() })),
    ),
    // Rubric keys switched off for this group. Omitted = leave unchanged;
    // empty array = enable everything.
    disabledKeys: v.optional(v.array(v.string())),
    // Per-platform weights for the frontend-checker criterion. Omitted =
    // leave unchanged; empty array = reset every platform to 1.
    frontendWeights: v.optional(
      v.array(v.object({ key: v.string(), weight: v.number() })),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    // Validate against the full rubric (built-in + custom + mirrored human
    // criteria, ignoring the disabled filter) so weights for
    // currently-disabled keys stay valid
    const humanCriteria = group.aiIncludeHumanCriteria
      ? await getHumanCriteriaForGroup(ctx, args.groupId)
      : [];
    const allKeys = new Set([
      ...AI_JUDGE_RUBRIC.map((c) => c.key),
      ...(group.aiCustomCriteria ?? []).map((c) => c.key),
      ...humanCriteria.map((c) => humanCriterionKey(c._id)),
    ]);

    if (args.weights !== undefined) {
      const seen = new Set<string>();
      for (const entry of args.weights) {
        if (!allKeys.has(entry.key)) {
          throw new Error(`Unknown rubric key "${entry.key}"`);
        }
        if (seen.has(entry.key)) {
          throw new Error(`Duplicate rubric key "${entry.key}"`);
        }
        seen.add(entry.key);
        if (
          !Number.isFinite(entry.weight) ||
          entry.weight < 0 ||
          entry.weight > 10
        ) {
          throw new Error("Weights must be numbers between 0 and 10");
        }
      }
    }

    const patch: {
      aiRubricWeights: typeof args.weights;
      aiDisabledCriteria?: Array<string> | undefined;
      aiFrontendWeights?: typeof args.frontendWeights;
    } = { aiRubricWeights: args.weights };

    if (args.frontendWeights !== undefined) {
      const platformKeys = new Set(AI_FRONTEND_PLATFORMS.map((p) => p.key));
      const seenPlatforms = new Set<string>();
      for (const entry of args.frontendWeights) {
        if (!platformKeys.has(entry.key)) {
          throw new Error(`Unknown frontend platform key "${entry.key}"`);
        }
        if (seenPlatforms.has(entry.key)) {
          throw new Error(`Duplicate frontend platform key "${entry.key}"`);
        }
        seenPlatforms.add(entry.key);
        if (
          !Number.isFinite(entry.weight) ||
          entry.weight < 0 ||
          entry.weight > 10
        ) {
          throw new Error("Platform weights must be numbers between 0 and 10");
        }
      }
      // All-default (or empty) platform weights clear the stored field
      const allDefault = args.frontendWeights.every((w) => w.weight === 1);
      patch.aiFrontendWeights =
        args.frontendWeights.length === 0 || allDefault
          ? undefined
          : args.frontendWeights;
    }

    if (args.disabledKeys !== undefined) {
      const disabled = new Set<string>();
      for (const key of args.disabledKeys) {
        if (!allKeys.has(key)) {
          throw new Error(`Unknown rubric key "${key}"`);
        }
        disabled.add(key);
      }
      if (disabled.size >= allKeys.size) {
        throw new Error("At least one rubric criterion must stay enabled");
      }
      patch.aiDisabledCriteria = disabled.size > 0 ? [...disabled] : undefined;
    }

    await ctx.db.patch(args.groupId, patch);
    return null;
  },
});

/**
 * Admin: set the group's custom AI rubric criteria (appended to the built-in
 * six). Keys are lowercase slugs, unique, and must not clash with built-in
 * keys. Stale rubric weights for removed criteria are pruned. Existing
 * results keep their stored scores; a re-run picks up the new rubric.
 */
export const updateAiCustomCriteria = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    criteria: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          description: v.string(),
        }),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    const criteria =
      args.criteria && args.criteria.length > 0 ? args.criteria : undefined;

    if (criteria) {
      if (criteria.length > MAX_CUSTOM_CRITERIA) {
        throw new Error(
          `At most ${MAX_CUSTOM_CRITERIA} custom criteria are allowed`,
        );
      }
      const builtInKeys = new Set(AI_JUDGE_RUBRIC.map((c) => c.key));
      const seen = new Set<string>();
      for (const criterion of criteria) {
        if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(criterion.key)) {
          throw new Error(
            `Criterion key "${criterion.key}" must be a lowercase slug (letters, numbers, dashes, 2-40 chars)`,
          );
        }
        if (builtInKeys.has(criterion.key)) {
          throw new Error(
            `Criterion key "${criterion.key}" clashes with a built-in rubric key`,
          );
        }
        // The human- prefix is reserved for mirrored human judging criteria
        if (criterion.key.startsWith(HUMAN_CRITERION_PREFIX)) {
          throw new Error(
            `Criterion key "${criterion.key}" uses the reserved "${HUMAN_CRITERION_PREFIX}" prefix`,
          );
        }
        if (seen.has(criterion.key)) {
          throw new Error(`Duplicate criterion key "${criterion.key}"`);
        }
        seen.add(criterion.key);
        if (criterion.label.trim().length < 2 || criterion.label.length > 100) {
          throw new Error("Criterion labels must be 2-100 characters");
        }
        if (
          criterion.description.trim().length < 10 ||
          criterion.description.length > 1000
        ) {
          throw new Error("Criterion descriptions must be 10-1000 characters");
        }
      }
    }

    // Prune weights and disabled flags whose key is no longer part of the
    // effective rubric. Mirrored human keys are kept so editing custom
    // criteria never touches human criteria weights.
    const validKeys = new Set([
      ...AI_JUDGE_RUBRIC.map((c) => c.key),
      ...(criteria ?? []).map((c) => c.key),
      ...(group.aiIncludeHumanCriteria
        ? (await getHumanCriteriaForGroup(ctx, args.groupId)).map((c) =>
            humanCriterionKey(c._id),
          )
        : []),
    ]);
    const prunedWeights = (group.aiRubricWeights ?? []).filter((w) =>
      validKeys.has(w.key),
    );
    const prunedDisabled = (group.aiDisabledCriteria ?? []).filter((key) =>
      validKeys.has(key),
    );

    // Removing the frontend-checker criterion also clears its platform weights
    const keepFrontendWeights = validKeys.has(FRONTEND_CHECKER_KEY);

    await ctx.db.patch(args.groupId, {
      aiCustomCriteria: criteria,
      aiRubricWeights: prunedWeights.length > 0 ? prunedWeights : undefined,
      aiDisabledCriteria:
        prunedDisabled.length > 0 ? prunedDisabled : undefined,
      ...(keepFrontendWeights ? {} : { aiFrontendWeights: undefined }),
    });
    return null;
  },
});

/**
 * Admin: toggle mirroring of the group's human judging criteria into the AI
 * rubric. Mirrored criteria are read live at analysis time, so later edits
 * to the human criteria flow through on the next run. Turning it off leaves
 * any stored human-<id> weights in place so flipping it back restores them.
 */
export const updateAiIncludeHumanCriteria = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    await ctx.db.patch(args.groupId, {
      aiIncludeHumanCriteria: args.enabled ? true : undefined,
    });
    return null;
  },
});

/**
 * Admin: show or hide the AI review card for human judges. When on, each
 * submission in the judging interface gets a collapsed card with the AI's
 * per criterion scores and reasoning. Advisory only; the AI judge itself
 * must also be enabled for the card to render.
 */
export const updateAiReviewVisibleToJudges = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    await ctx.db.patch(args.groupId, {
      aiReviewVisibleToJudges: args.enabled ? true : undefined,
    });
    return null;
  },
});

/**
 * Judge session view of one completed AI review. Gated by a valid judge
 * session for the group plus the group's aiReviewVisibleToJudges toggle.
 * Returns only what a judge should weigh: scores, reasoning, model, live
 * check. Harness signals, git facts, discrepancies, and second opinions
 * stay admin only. Null when hidden, missing, or not completed.
 */
export const getAiReviewForJudge = query({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
    sessionId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      criteriaScores: v.array(criteriaScoreValidator),
      averageScore: v.optional(v.number()),
      weightedScore: v.optional(v.number()),
      overallReasoning: v.optional(v.string()),
      judgeModel: v.optional(v.string()),
      isLive: v.optional(v.boolean()),
      editedAt: v.optional(v.number()),
      // Position among completed AI results for this group (1 = best)
      rank: v.optional(v.number()),
      rankTotal: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (!judge || judge.groupId !== args.groupId) {
      throw new ConvexError("Judge session not found");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group || group.aiJudgeEnabled !== true) {
      return null;
    }

    // Visible when the organizer shows AI reviews to judges, or when this
    // row is below the cut and below-cut rows are shown (the AI review is
    // the explanation for why it was cut)
    if (group.aiReviewVisibleToJudges !== true) {
      if (!showsBelowCut(group)) return null;
      const membership = await ctx.db
        .query("judgingGroupSubmissions")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", args.groupId).eq("storyId", args.storyId),
        )
        .unique();
      if (!membership || isInJudgeQueue(group, membership)) return null;
    }

    const rows = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const result = rows.find((row) => row.storyId === args.storyId);
    if (!result || result.status !== "completed" || !result.criteriaScores) {
      return null;
    }

    // Rank over current group members whose story is still valid for
    // judging: the same population getGroupSubmissions ranks, so the badge in
    // the judge list and this card always agree. Stale AI rows for stories
    // removed from the group are ignored.
    const memberIds = new Set(
      (
        await ctx.db
          .query("judgingGroupSubmissions")
          .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
          .collect()
      ).map((m) => m.storyId),
    );
    const validRows: Array<Doc<"aiJudgeResults">> = [];
    for (const row of rows) {
      if (row.status !== "completed" || !memberIds.has(row.storyId)) continue;
      if (isStoryValidForJudging(await ctx.db.get(row.storyId))) {
        validRows.push(row);
      }
    }
    const rankEntry = rankCompletedAiResults(validRows, group).get(
      args.storyId,
    );

    return {
      criteriaScores: result.criteriaScores,
      averageScore: result.averageScore,
      weightedScore: computeWeightedScore(
        result.criteriaScores,
        group.aiRubricWeights,
        {
          platform: result.frontendHosting?.platform,
          platformWeights: group.aiFrontendWeights,
        },
      ),
      overallReasoning: result.overallReasoning,
      judgeModel: result.judgeModel ?? result.model,
      isLive: result.urlCheck?.isLive,
      editedAt: result.editedAt,
      rank: rankEntry?.rank,
      rankTotal: rankEntry?.total,
    };
  },
});

/**
 * Admin: toggle the Jev second opinion for a group. When on, each AI review
 * also asks the gateway's decisions model to score the same rubric from text
 * only context. The result is advisory: shown beside the judge model's
 * scores in AI Results, never part of totals or rankings.
 */
export const updateAiSecondOpinionEnabled = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    await ctx.db.patch(args.groupId, {
      aiSecondOpinionEnabled: args.enabled ? true : undefined,
    });
    return null;
  },
});

/**
 * Admin: set or reset the group's AI judge system prompt body. Null or an
 * empty string resets to the built-in default. The JSON response contract
 * is always appended at analysis time and is not editable here.
 */
export const updateAiSystemPrompt = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    prompt: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const trimmed = args.prompt?.trim() ?? "";
    if (trimmed.length > MAX_PROMPT_LENGTH) {
      throw new Error(
        `System prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`,
      );
    }

    // Saving the unchanged default (or clearing) resets to the built-in prompt
    const custom =
      trimmed.length === 0 || trimmed === DEFAULT_AI_JUDGE_PROMPT_BODY.trim()
        ? undefined
        : trimmed;

    await ctx.db.patch(args.groupId, { aiJudgeSystemPrompt: custom });
    return null;
  },
});

/**
 * Admin: prompt editor data. Returns the built-in default body, the group's
 * custom body (if any), and the effective rubric the {{rubric}} placeholder
 * expands to.
 */
export const getAiPromptConfig = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.null(),
    v.object({
      defaultPrompt: v.string(),
      customPrompt: v.optional(v.string()),
      rubric: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          description: v.string(),
          builtIn: v.boolean(),
          // Where the criterion comes from: built-in rubric, admin custom
          // criteria, or a mirrored human judging criterion
          source: v.union(
            v.literal("builtin"),
            v.literal("custom"),
            v.literal("human"),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    if (!group) return null;

    const builtInKeys = new Set(AI_JUDGE_RUBRIC.map((c) => c.key));
    const humanCriteria = group.aiIncludeHumanCriteria
      ? await getHumanCriteriaForGroup(ctx, args.groupId)
      : [];
    return {
      defaultPrompt: DEFAULT_AI_JUDGE_PROMPT_BODY,
      customPrompt: group.aiJudgeSystemPrompt,
      rubric: getRubricForGroup(group, humanCriteria).map((c) => {
        const builtIn = builtInKeys.has(c.key);
        const source = builtIn
          ? ("builtin" as const)
          : c.key.startsWith(HUMAN_CRITERION_PREFIX)
            ? ("human" as const)
            : ("custom" as const);
        return { ...c, builtIn, source };
      }),
    };
  },
});

/**
 * Admin edit of AI scores and reasoning. Recomputes totals and stamps the editor.
 */
export const updateResultScore = mutation({
  args: {
    resultId: v.id("aiJudgeResults"),
    criteriaScores: v.array(criteriaScoreValidator),
    overallReasoning: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingResult = await ctx.db.get(args.resultId);
    if (!existingResult) {
      throw new Error("AI result not found");
    }
    await requireJudgingGroupPermission(
      ctx,
      existingResult.groupId,
      "judging.ai",
    );
    const userId = await getAuthenticatedUserId(ctx);

    for (const cs of args.criteriaScores) {
      if (!Number.isFinite(cs.score) || cs.score < 1 || cs.score > 10) {
        throw new Error("Scores must be between 1 and 10");
      }
    }

    const totalScore = args.criteriaScores.reduce(
      (sum, cs) => sum + cs.score,
      0,
    );
    const averageScore =
      args.criteriaScores.length > 0
        ? Math.round((totalScore / args.criteriaScores.length) * 100) / 100
        : 0;

    const patch: Record<string, unknown> = {
      criteriaScores: args.criteriaScores,
      totalScore,
      averageScore,
      editedBy: userId,
      editedAt: Date.now(),
    };
    if (args.overallReasoning !== undefined) {
      patch.overallReasoning = args.overallReasoning;
    }

    await ctx.db.patch(args.resultId, patch);
    return null;
  },
});

/**
 * Admin view: all AI results for a group (every status), enriched with story info.
 */
export const getGroupAiResults = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({
    results: v.array(aiResultValidator),
    aiJudgeEnabled: v.boolean(),
    counts: v.object({
      pending: v.number(),
      running: v.number(),
      completed: v.number(),
      failed: v.number(),
    }),
    weights: v.optional(
      v.array(v.object({ key: v.string(), weight: v.number() })),
    ),
    groupSummary: v.optional(
      v.object({
        markdown: v.string(),
        generatedAt: v.number(),
        provider: v.string(),
        model: v.string(),
        fingerprint: v.string(),
        isStale: v.boolean(),
      }),
    ),
    // Shortlist state so the admin results view can badge rows and offer
    // Shortlist top N without a second subscription
    judgeQueueMode: v.union(v.literal("all"), v.literal("shortlist")),
    // True when judges also see below-cut rows read only (shortlist mode)
    showBelowCutToJudges: v.boolean(),
    shortlistCount: v.number(),
    shortlistedStoryIds: v.array(v.id("stories")),
  }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    const rows = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const memberships = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const shortlistedStoryIds = memberships
      .filter((m) => m.shortlisted === true)
      .map((m) => m.storyId);

    const results = await enrichResults(
      ctx,
      args.groupId,
      rows,
      group?.aiRubricWeights,
      group?.aiFrontendWeights,
      {
        includeLogMeta: true, // Admin view: show log cross-check notes
        memberStoryIds: new Set(memberships.map((m) => m.storyId)),
        deadlineAt: group?.endDate,
      },
    );
    const counts = { pending: 0, running: 0, completed: 0, failed: 0 };
    for (const r of results) {
      counts[r.status]++;
    }
    const currentFingerprint = getGroupSummaryFingerprint(rows);
    const groupSummary =
      group?.aiGroupSummary &&
      group.aiGroupSummaryGeneratedAt !== undefined &&
      group.aiGroupSummaryProvider &&
      group.aiGroupSummaryModel &&
      group.aiGroupSummaryFingerprint
        ? {
            markdown: group.aiGroupSummary,
            generatedAt: group.aiGroupSummaryGeneratedAt,
            provider: group.aiGroupSummaryProvider,
            model: group.aiGroupSummaryModel,
            fingerprint: group.aiGroupSummaryFingerprint,
            isStale:
              group.aiGroupSummaryFingerprint !== currentFingerprint,
          }
        : undefined;
    return {
      results,
      aiJudgeEnabled: group?.aiJudgeEnabled ?? false,
      counts,
      weights: group?.aiRubricWeights,
      groupSummary,
      judgeQueueMode: group?.judgeQueueMode ?? "all",
      showBelowCutToJudges: showsBelowCut(group),
      shortlistCount: shortlistedStoryIds.length,
      shortlistedStoryIds,
    };
  },
});

/**
 * Admin-only data for the hackathon report: group info plus every valid
 * submission with team info and its AI result. Kept separate from
 * enrichResults so team member emails never flow through public queries.
 */
export const getGroupAiReportData = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.null(),
    v.object({
      groupName: v.string(),
      groupSlug: v.string(),
      groupDescription: v.optional(v.string()),
      submissions: v.array(
        v.object({
          storyId: v.id("stories"),
          title: v.string(),
          slug: v.string(),
          url: v.optional(v.string()),
          githubUrl: v.optional(v.string()),
          teamName: v.optional(v.string()),
          teamMemberCount: v.optional(v.number()),
          teamMembers: v.optional(
            v.array(v.object({ name: v.string(), email: v.string() })),
          ),
          submitterName: v.optional(v.string()),
          status: v.union(
            v.literal("pending"),
            v.literal("running"),
            v.literal("completed"),
            v.literal("failed"),
          ),
          submissionTiming: submissionTimingValidator,
          criteriaScores: v.optional(v.array(criteriaScoreValidator)),
          totalScore: v.optional(v.number()),
          averageScore: v.optional(v.number()),
          weightedScore: v.optional(v.number()),
          overallReasoning: v.optional(v.string()),
          convexFeaturesDetected: v.optional(v.array(v.string())),
          componentsDetected: v.optional(v.array(v.string())),
          componentsUsed: v.optional(v.array(v.string())),
          repoFacts: v.optional(repoFactsValidator),
          gitFacts: v.optional(gitFactsValidator),
          harnessSignals: v.optional(v.array(harnessSignalValidator)),
          repoAccess: v.optional(repoAccessValidator),
          selfReportedHarness: v.optional(v.string()),
          selfReportedModel: v.optional(v.string()),
          urlCheck: v.optional(urlCheckValidator),
          frontendHosting: v.optional(frontendHostingValidator),
          authProvider: v.optional(v.string()),
          usesAiGateway: v.optional(v.boolean()),
          aiModelIdsDetected: v.optional(v.array(v.string())),
          modelProvidersDetected: v.optional(v.array(v.string())),
          sponsorStack: v.optional(v.array(sponsorEvidenceValidator)),
          sourcesUsed: v.optional(
            v.object({
              github: v.boolean(),
              liveUrl: v.boolean(),
              videoTranscript: v.optional(v.boolean()),
              screenshot: v.optional(v.boolean()),
              socialProof: v.optional(v.boolean()),
            }),
          ),
          error: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiJudgeEnabled) return null;

    const rows = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const submissions: Array<{
      storyId: Id<"stories">;
      title: string;
      slug: string;
      url?: string;
      githubUrl?: string;
      teamName?: string;
      teamMemberCount?: number;
      teamMembers?: Array<{ name: string; email: string }>;
      submitterName?: string;
      status: "pending" | "running" | "completed" | "failed";
      submissionTiming: SubmissionTiming;
      criteriaScores?: Array<{
        key: string;
        label: string;
        score: number;
        reasoning: string;
      }>;
      totalScore?: number;
      averageScore?: number;
      weightedScore?: number;
      overallReasoning?: string;
      convexFeaturesDetected?: Array<string>;
      componentsDetected?: Array<string>;
      componentsUsed?: Array<string>;
      repoFacts?: Doc<"aiJudgeResults">["repoFacts"];
      gitFacts?: Doc<"aiJudgeResults">["gitFacts"];
      harnessSignals?: Doc<"aiJudgeResults">["harnessSignals"];
      repoAccess?: "public" | "private_or_missing";
      selfReportedHarness?: string;
      selfReportedModel?: string;
      urlCheck?: {
        checkedUrl?: string;
        isLive: boolean;
        statusCode?: number;
        note: string;
      };
      frontendHosting?: { platform: string; evidence: string };
      authProvider?: string;
      usesAiGateway?: boolean;
      aiModelIdsDetected?: Array<string>;
      modelProvidersDetected?: Array<string>;
      sponsorStack?: Doc<"aiJudgeResults">["sponsorStack"];
      sourcesUsed?: {
        github: boolean;
        liveUrl: boolean;
        videoTranscript?: boolean;
        screenshot?: boolean;
        socialProof?: boolean;
      };
      error?: string;
    }> = [];

    for (const row of rows) {
      const story = await ctx.db.get(row.storyId);
      if (!isStoryValidForJudging(story)) continue;
      submissions.push({
        storyId: row.storyId,
        title: story.title,
        slug: story.slug,
        url: story.url,
        githubUrl: story.githubUrl,
        teamName: story.teamName,
        teamMemberCount: story.teamMemberCount,
        teamMembers: story.teamMembers,
        submitterName: story.submitterName,
        status: row.status,
        submissionTiming: computeSubmissionTiming(
          story._creationTime,
          group.endDate,
        ),
        criteriaScores: row.criteriaScores,
        totalScore: row.totalScore,
        averageScore: row.averageScore,
        weightedScore: computeWeightedScore(
          row.criteriaScores,
          group.aiRubricWeights,
          {
            platform: row.frontendHosting?.platform,
            platformWeights: group.aiFrontendWeights,
          },
        ),
        overallReasoning: row.overallReasoning,
        convexFeaturesDetected: row.convexFeaturesDetected,
        componentsDetected: row.componentsDetected,
        componentsUsed: row.componentsUsed,
        repoFacts: row.repoFacts,
        gitFacts: row.gitFacts,
        harnessSignals: row.harnessSignals,
        repoAccess: row.repoAccess,
        selfReportedHarness: story.selfReportedHarness,
        selfReportedModel: story.selfReportedModel,
        urlCheck: row.urlCheck,
        frontendHosting: row.frontendHosting,
        authProvider: row.authProvider,
        usesAiGateway: row.usesAiGateway,
        aiModelIdsDetected: row.aiModelIdsDetected,
        modelProvidersDetected: row.modelProvidersDetected,
        sponsorStack: row.sponsorStack,
        sourcesUsed: row.sourcesUsed,
        error: row.error,
      });
    }

    // Completed first by weighted score (falls back to total), then the rest
    submissions.sort(
      (a, b) =>
        (b.weightedScore ?? b.totalScore ?? -1) -
        (a.weightedScore ?? a.totalScore ?? -1),
    );

    return {
      groupName: group.name,
      groupSlug: group.slug,
      groupDescription: group.description,
      submissions,
    };
  },
});

// --- Internal: used by the analysis action chain ---

/**
 * Privacy-safe saved result evidence for an on-demand group summary.
 * The caller's identity is forwarded from the public action.
 */
export const getGroupSummaryInput = internalQuery({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.null(),
    v.object({
      groupName: v.string(),
      fingerprint: v.string(),
      hasInFlightReviews: v.boolean(),
      submissions: v.array(groupSummaryInputValidator),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiJudgeEnabled) return null;

    const rows = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const stories = await Promise.all(
      rows.map(async (row) => await ctx.db.get(row.storyId)),
    );
    const submissions: Array<{
      title: string;
      averageScore?: number;
      overallReasoning?: string;
      convexFeaturesDetected?: Array<string>;
      componentsUsed?: Array<string>;
      repoFacts?: Doc<"aiJudgeResults">["repoFacts"];
      gitFacts?: Doc<"aiJudgeResults">["gitFacts"];
      urlCheck?: Doc<"aiJudgeResults">["urlCheck"];
    }> = [];

    for (const [index, row] of rows.entries()) {
      const story = stories[index];
      if (row.status !== "completed" || !isStoryValidForJudging(story)) {
        continue;
      }
      submissions.push({
        title: story.title,
        averageScore: row.averageScore,
        overallReasoning: row.overallReasoning,
        convexFeaturesDetected: row.convexFeaturesDetected,
        componentsUsed: row.componentsUsed,
        repoFacts: row.repoFacts,
        gitFacts: row.gitFacts,
        urlCheck: row.urlCheck,
      });
    }

    return {
      groupName: group.name,
      fingerprint: getGroupSummaryFingerprint(rows),
      hasInFlightReviews: rows.some(
        (row) => row.status === "pending" || row.status === "running",
      ),
      submissions,
    };
  },
});

export const saveGroupSummary = internalMutation({
  args: {
    groupId: v.id("judgingGroups"),
    markdown: v.string(),
    generatedAt: v.number(),
    fingerprint: v.string(),
    provider: v.string(),
    model: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, {
      aiGroupSummary: args.markdown,
      aiGroupSummaryGeneratedAt: args.generatedAt,
      aiGroupSummaryFingerprint: args.fingerprint,
      aiGroupSummaryProvider: args.provider,
      aiGroupSummaryModel: args.model,
    });
    return null;
  },
});

/**
 * Mark a result row as running before analysis begins.
 */
export const markRunning = internalMutation({
  args: { resultId: v.id("aiJudgeResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.resultId, { status: "running" as const });
    return null;
  },
});

/**
 * Gather everything the analysis action needs for one submission.
 */
export const getSubmissionForAnalysis = internalQuery({
  args: { resultId: v.id("aiJudgeResults") },
  returns: v.union(
    v.null(),
    v.object({
      groupId: v.id("judgingGroups"),
      groupName: v.string(),
      // Event window: start feeds builtDuringEvent, end is the submission
      // deadline for the SUBMISSION TIMING prompt section
      eventStartDate: v.optional(v.number()),
      eventEndDate: v.optional(v.number()),
      // Story _creationTime: when the team submitted the app
      submittedAt: v.number(),
      // Custom prompt body, extra criteria, and disabled keys for this
      // group's AI judge
      aiJudgeSystemPrompt: v.optional(v.string()),
      aiCustomCriteria: v.optional(
        v.array(
          v.object({
            key: v.string(),
            label: v.string(),
            description: v.string(),
          }),
        ),
      ),
      aiDisabledCriteria: v.optional(v.array(v.string())),
      // Human criteria mirroring: flag, the human scale, and the live rows
      // (empty when mirroring is off) so the action needs no second query
      aiIncludeHumanCriteria: v.optional(v.boolean()),
      // Jev second opinion toggle, read here so the action needs no extra query
      aiSecondOpinionEnabled: v.optional(v.boolean()),
      scoreScale: v.number(),
      humanCriteria: v.array(
        v.object({
          _id: v.id("judgingCriteria"),
          question: v.string(),
          description: v.optional(v.string()),
        }),
      ),
      storyId: v.id("stories"),
      title: v.string(),
      description: v.string(),
      longDescription: v.optional(v.string()),
      url: v.optional(v.string()),
      githubUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      // Social launch links, snapshotted for the SOCIAL PROOF prompt section
      linkedinUrl: v.optional(v.string()),
      twitterUrl: v.optional(v.string()),
      tags: v.array(v.string()),
      // Pasted hackathon.md (already capped + redacted at submission time)
      hackathonLog: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) return null;

    const group = await ctx.db.get(result.groupId);
    const story = await ctx.db.get(result.storyId);
    if (!group || !isStoryValidForJudging(story)) return null;

    const tags: Array<string> = [];
    for (const tagId of story.tagIds || []) {
      const tag = await ctx.db.get(tagId);
      if (tag) tags.push(tag.name);
    }

    const humanCriteria = group.aiIncludeHumanCriteria
      ? await getHumanCriteriaForGroup(ctx, result.groupId)
      : [];

    return {
      groupId: result.groupId,
      groupName: group.name,
      eventStartDate: group.startDate,
      eventEndDate: group.endDate,
      submittedAt: story._creationTime,
      aiJudgeSystemPrompt: group.aiJudgeSystemPrompt,
      aiCustomCriteria: group.aiCustomCriteria,
      aiDisabledCriteria: group.aiDisabledCriteria,
      aiIncludeHumanCriteria: group.aiIncludeHumanCriteria,
      aiSecondOpinionEnabled: group.aiSecondOpinionEnabled,
      scoreScale: group.scoreScale ?? 10,
      humanCriteria,
      storyId: result.storyId,
      title: story.title,
      description: story.description,
      longDescription: story.longDescription,
      url: story.url,
      githubUrl: story.githubUrl,
      videoUrl: story.videoUrl,
      linkedinUrl: story.linkedinUrl,
      twitterUrl: story.twitterUrl,
      tags,
      hackathonLog: story.hackathonLog,
    };
  },
});

/**
 * Save an analysis outcome (success or failure). Analyses run through the
 * workpool, so no chain scheduling happens here.
 */
export const saveResult = internalMutation({
  args: {
    resultId: v.id("aiJudgeResults"),
    outcome: v.union(
      v.object({
        kind: v.literal("success"),
        criteriaScores: v.array(criteriaScoreValidator),
        overallReasoning: v.string(),
        convexFeaturesDetected: v.array(v.string()),
        componentsDetected: v.optional(v.array(v.string())),
        componentsUsed: v.optional(v.array(v.string())),
        repoFacts: v.optional(repoFactsValidator),
        gitFacts: v.optional(gitFactsValidator),
        harnessSignals: v.optional(v.array(harnessSignalValidator)),
        repoAccess: v.optional(repoAccessValidator),
        judgeProvider: v.string(),
        judgeModel: v.string(),
        // Present only when the group's Jev second opinion is on and the
        // call succeeded; absent clears any stale value on rerun
        secondOpinion: v.optional(secondOpinionValidator),
        sourcesUsed: v.object({
          github: v.boolean(),
          liveUrl: v.boolean(),
          videoTranscript: v.optional(v.boolean()),
          screenshot: v.optional(v.boolean()),
          socialProof: v.optional(v.boolean()),
        }),
        urlCheck: v.optional(urlCheckValidator),
        frontendHosting: v.optional(frontendHostingValidator),
        // hackathon.md header claims vs detected facts (recorded, never scored)
        logDiscrepancies: v.optional(v.array(v.string())),
        // Event free text from the hackathon.md header (repo copy wins)
        hackathonLogEvent: v.optional(v.string()),
        authProvider: v.optional(v.string()),
        usesAiGateway: v.optional(v.boolean()),
        aiModelIdsDetected: v.optional(v.array(v.string())),
        modelProvidersDetected: v.optional(v.array(v.string())),
        sponsorStack: v.optional(v.array(sponsorEvidenceValidator)),
      }),
      v.object({
        kind: v.literal("error"),
        errorMessage: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) return null;

    if (args.outcome.kind === "success") {
      const totalScore = args.outcome.criteriaScores.reduce(
        (sum, cs) => sum + cs.score,
        0,
      );
      const averageScore =
        args.outcome.criteriaScores.length > 0
          ? Math.round(
              (totalScore / args.outcome.criteriaScores.length) * 100,
            ) / 100
          : 0;
      await ctx.db.patch(args.resultId, {
        status: "completed" as const,
        criteriaScores: args.outcome.criteriaScores,
        totalScore,
        averageScore,
        overallReasoning: args.outcome.overallReasoning,
        convexFeaturesDetected: args.outcome.convexFeaturesDetected,
        componentsDetected: args.outcome.componentsDetected,
        componentsUsed: args.outcome.componentsUsed,
        repoFacts: args.outcome.repoFacts,
        gitFacts: args.outcome.gitFacts,
        harnessSignals: args.outcome.harnessSignals,
        repoAccess: args.outcome.repoAccess,
        // New field names only; deprecated provider/model are no longer written
        judgeProvider: args.outcome.judgeProvider,
        judgeModel: args.outcome.judgeModel,
        secondOpinion: args.outcome.secondOpinion,
        provider: undefined,
        model: undefined,
        sourcesUsed: args.outcome.sourcesUsed,
        urlCheck: args.outcome.urlCheck,
        frontendHosting: args.outcome.frontendHosting,
        logDiscrepancies: args.outcome.logDiscrepancies,
        hackathonLogEvent: args.outcome.hackathonLogEvent,
        authProvider: args.outcome.authProvider,
        usesAiGateway: args.outcome.usesAiGateway,
        aiModelIdsDetected: args.outcome.aiModelIdsDetected,
        modelProvidersDetected: args.outcome.modelProvidersDetected,
        sponsorStack: args.outcome.sponsorStack,
        error: undefined,
        editedBy: undefined,
        editedAt: undefined,
      });
    } else {
      await ctx.db.patch(args.resultId, {
        status: "failed" as const,
        error: args.outcome.errorMessage,
      });
    }

    // Group activity log entry per finished review (actor is the AI judge)
    const reviewedStory = await ctx.db.get(result.storyId);
    if (args.outcome.kind === "success") {
      const avg =
        args.outcome.criteriaScores.length > 0
          ? Math.round(
              (args.outcome.criteriaScores.reduce(
                (sum, cs) => sum + cs.score,
                0,
              ) /
                args.outcome.criteriaScores.length) *
                100,
            ) / 100
          : 0;
      await logActivity(ctx, {
        category: "judging",
        action: "judging.aiReviewCompleted",
        message: `AI review completed for "${reviewedStory?.title ?? "a submission"}" (avg ${avg})`,
        actorName: "AI Judge",
        targetType: "story",
        targetId: result.storyId,
        targetLabel: reviewedStory?.title,
        groupId: result.groupId,
        metadata: { storySlug: reviewedStory?.slug, averageScore: avg },
      });
    } else {
      await logActivity(ctx, {
        category: "judging",
        action: "judging.aiReviewFailed",
        message: `AI review failed for "${reviewedStory?.title ?? "a submission"}": ${args.outcome.errorMessage.slice(0, 140)}`,
        actorName: "AI Judge",
        targetType: "story",
        targetId: result.storyId,
        targetLabel: reviewedStory?.title,
        groupId: result.groupId,
        metadata: { storySlug: reviewedStory?.slug },
      });
    }

    return null;
  },
});

// --- Public: AI results page ---

/**
 * Public metadata for the AI results page gate (mirrors getPublicResultsInfo).
 */
export const getPublicAiResultsInfo = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      aiJudgeEnabled: v.boolean(),
      isAiResultsPublic: v.boolean(),
      hasAiResultsPassword: v.boolean(),
      isAdmin: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!group) return null;

    const isAdmin = await isUserAdmin(ctx);

    return {
      _id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      aiJudgeEnabled: group.aiJudgeEnabled ?? false,
      isAiResultsPublic: group.aiResultsIsPublic ?? false,
      hasAiResultsPassword: !!group.aiResultsPassword,
      isAdmin,
    };
  },
});

/**
 * Validate the AI results page password (public endpoint).
 */
export const validateAiResultsPassword = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiResultsPassword) {
      return false;
    }
    return await verifyPassword(args.password, group.aiResultsPassword);
  },
});

/**
 * Verify the AI results password (query variant for session revalidation).
 */
export const verifyAiResultsPassword = query({
  args: {
    groupId: v.id("judgingGroups"),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiResultsPassword) {
      return false;
    }
    return await verifyPassword(args.password, group.aiResultsPassword);
  },
});

// Shared handler for public/validated AI results: completed results only, ranked
async function getCompletedResultsForGroup(
  ctx: QueryCtx,
  groupId: Id<"judgingGroups">,
) {
  const group = await ctx.db.get(groupId);
  const rows = await ctx.db
    .query("aiJudgeResults")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();
  const enriched = await enrichResults(
    ctx,
    groupId,
    rows.filter((r) => r.status === "completed"),
    group?.aiRubricWeights,
    group?.aiFrontendWeights,
    { deadlineAt: group?.endDate },
  );
  return enriched;
}

/**
 * Public AI results (only when the group's AI results page is public).
 */
export const getPublicAiResults = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(v.null(), v.array(aiResultValidator)),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiJudgeEnabled) {
      return null;
    }
    if (!group.aiResultsIsPublic) {
      // Admins can bypass the public check
      const isAdmin = await isUserAdmin(ctx);
      if (!isAdmin) return null;
    }
    return await getCompletedResultsForGroup(ctx, args.groupId);
  },
});

/**
 * Internal: completed AI results for the agent judging HTTP API
 * (auth handled by the HTTP layer: judge key or results password).
 */
export const getCompletedResultsInternal = internalQuery({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(v.null(), v.array(aiResultValidator)),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiJudgeEnabled) return null;
    return await getCompletedResultsForGroup(ctx, args.groupId);
  },
});

/**
 * Internal: resolve a slug plus optional results password to a groupId for
 * the HTTP API. Grants access when AI results are public or the password
 * matches. Returns null when the group is unknown or access is denied.
 */
export const resolveResultsAccess = internalQuery({
  args: { slug: v.string(), password: v.optional(v.string()) },
  returns: v.union(v.null(), v.id("judgingGroups")),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!group || !group.aiJudgeEnabled) return null;
    if (group.aiResultsIsPublic) return group._id;
    if (
      args.password &&
      group.aiResultsPassword &&
      (await verifyPassword(args.password, group.aiResultsPassword))
    ) {
      return group._id;
    }
    return null;
  },
});

/**
 * AI results after password validation (no public check, mirrors
 * getValidatedGroupScores in judgeScores.ts).
 */
export const getValidatedAiResults = query({
  args: { groupId: v.id("judgingGroups"), password: v.string() },
  returns: v.union(v.null(), v.array(aiResultValidator)),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiJudgeEnabled) {
      return null;
    }
    const admin = await isUserAdmin(ctx);
    const passwordOk =
      !!group.aiResultsPassword &&
      (await verifyPassword(args.password, group.aiResultsPassword));
    if (!admin && !passwordOk) {
      return null;
    }
    return await getCompletedResultsForGroup(ctx, args.groupId);
  },
});
