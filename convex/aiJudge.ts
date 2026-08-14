import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal, components } from "./_generated/api";
import { Workpool } from "@convex-dev/workpool";
import { isUserAdmin, getAuthenticatedUserId } from "./users";
import { requireJudgingGroupPermission } from "./adminAccess";
import { verifyPassword } from "./judgingGroups";
import { parseHackathonLogHeader } from "./hackathonLog"; // hackathon.md header parsing (admin views)
import { logActivity } from "./activityLog";

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
export const FRONTEND_CHECKER_KEY = "frontend-checker";
export const AI_FRONTEND_PLATFORMS: Array<{ key: string; label: string }> = [
  { key: "codex-sites", label: "Codex Sites" },
  { key: "convex-hosting", label: "Convex static hosting" },
  { key: "vercel", label: "Vercel" },
  { key: "netlify", label: "Netlify" },
  { key: "other", label: "Other" },
];

// Effective rubric for a group: the built-in six plus any admin-defined
// custom criteria, minus any criteria the admin switched off. Used by the
// analysis action, weight validation, and the prompt editor so every
// consumer sees the same keys. If somehow every key is disabled, the full
// list is used so an analysis can never run with an empty rubric.
export function getRubricForGroup(group: {
  aiCustomCriteria?: Array<RubricCriterion>;
  aiDisabledCriteria?: Array<string>;
}): Array<RubricCriterion> {
  const all = [...AI_JUDGE_RUBRIC, ...(group.aiCustomCriteria ?? [])];
  const disabled = new Set(group.aiDisabledCriteria ?? []);
  if (disabled.size === 0) return all;
  const enabled = all.filter((c) => !disabled.has(c.key));
  return enabled.length > 0 ? enabled : all;
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
- The PROJECT LOG FILES and PUBLISHED HACKATHON MANIFEST sections (when present) are self-reported by the team: hackathon logs, changelogs, task lists, and the published manifest. Use them as context for what was built and when, but the VERIFIED CONVEX FACTS always win over self-reported claims. If the manifest claims components or features the facts do not show, note the gap in your reasoning.
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

// Weighted score derived from stored criteriaScores plus the group's current
// aiRubricWeights. Never stored: weight edits and admin score edits both stay
// consistent because every read recomputes.
export function computeWeightedScore(
  criteriaScores: Array<{ key: string; score: number }> | undefined,
  weights: Array<{ key: string; weight: number }> | undefined,
  // Detected hosting platform for this result plus the group's per-platform
  // weights. The platform weight multiplies the frontend-checker criterion
  // weight only (default 1 keeps behavior unchanged).
  frontend?: {
    platform?: string;
    platformWeights?: Array<{ key: string; weight: number }>;
  },
): number | undefined {
  if (!criteriaScores || criteriaScores.length === 0) return undefined;
  const weightByKey = new Map((weights ?? []).map((w) => [w.key, w.weight]));
  const platformWeight = frontend?.platform
    ? ((frontend.platformWeights ?? []).find((w) => w.key === frontend.platform)
        ?.weight ?? 1)
    : 1;
  const total = criteriaScores.reduce((sum, cs) => {
    const base = weightByKey.get(cs.key) ?? 1;
    const multiplier =
      cs.key === FRONTEND_CHECKER_KEY ? base * platformWeight : base;
    return sum + cs.score * multiplier;
  }, 0);
  return Math.round(total * 100) / 100;
}

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
    }),
  ),
  urlCheck: v.optional(urlCheckValidator),
  frontendHosting: v.optional(frontendHostingValidator),
  // hackathon.md header cross-check notes; populated for admin views only
  logDiscrepancies: v.optional(v.array(v.string())),
  // Event free text from the repo or pasted hackathon.md header; admin only
  hackathonLogEvent: v.optional(v.string()),
  editedAt: v.optional(v.number()),
});

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
  results: Array<Doc<"aiJudgeResults">>,
  weights: Array<{ key: string; weight: number }> | undefined,
  frontendWeights?: Array<{ key: string; weight: number }>,
  // When true (admin views only), include hackathon.md cross-check notes and
  // the header event text. Public callers leave this undefined.
  options?: { includeLogMeta?: boolean },
) {
  const enriched: Array<{
    _id: Id<"aiJudgeResults">;
    _creationTime: number;
    storyId: Id<"stories">;
    storyTitle: string;
    storySlug: string;
    storyUrl?: string;
    githubUrl?: string;
    status: "pending" | "running" | "completed" | "failed";
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
    editedAt?: number;
  }> = [];

  for (const result of results) {
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
      editedAt: result.editedAt,
    });
  }

  // Rank on weightedScore (equals totalScore when all weights are 1) with
  // deterministic tiebreaks: components used, then depth score, then earliest
  // submission first
  const depthScore = (r: (typeof enriched)[number]) =>
    r.criteriaScores?.find((cs) => cs.key === "depth")?.score ?? 0;
  enriched.sort((a, b) => {
    const scoreDiff =
      (b.weightedScore ?? b.totalScore ?? -1) -
      (a.weightedScore ?? a.totalScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    const componentDiff =
      (b.componentsUsed?.length ?? 0) - (a.componentsUsed?.length ?? 0);
    if (componentDiff !== 0) return componentDiff;
    const depthDiff = depthScore(b) - depthScore(a);
    if (depthDiff !== 0) return depthDiff;
    return a._creationTime - b._creationTime;
  });
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
      throw new Error("Judging group not found");
    }
    if (!group.aiJudgeEnabled) {
      throw new Error("AI judge is not enabled for this group");
    }

    // Block concurrent runs: any running row means a review is in progress
    const existingResults = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    if (existingResults.some((r) => r.status === "running")) {
      throw new Error("An AI review is already in progress for this group");
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
      throw new Error("This judging group has no submissions to review");
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
      throw new Error("AI result not found");
    }
    await requireJudgingGroupPermission(ctx, result.groupId, "judging.ai");
    if (result.status === "running") {
      throw new Error("This submission is currently being reviewed");
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

    // Validate against the full rubric (built-in + custom, ignoring the
    // disabled filter) so weights for currently-disabled keys stay valid
    const allKeys = new Set([
      ...AI_JUDGE_RUBRIC.map((c) => c.key),
      ...(group.aiCustomCriteria ?? []).map((c) => c.key),
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
    // effective rubric
    const validKeys = new Set([
      ...AI_JUDGE_RUBRIC.map((c) => c.key),
      ...(criteria ?? []).map((c) => c.key),
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
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    if (!group) return null;

    const builtInKeys = new Set(AI_JUDGE_RUBRIC.map((c) => c.key));
    return {
      defaultPrompt: DEFAULT_AI_JUDGE_PROMPT_BODY,
      customPrompt: group.aiJudgeSystemPrompt,
      rubric: getRubricForGroup(group).map((c) => ({
        ...c,
        builtIn: builtInKeys.has(c.key),
      })),
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
    counts: v.object({
      pending: v.number(),
      running: v.number(),
      completed: v.number(),
      failed: v.number(),
    }),
    weights: v.optional(
      v.array(v.object({ key: v.string(), weight: v.number() })),
    ),
  }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const group = await ctx.db.get(args.groupId);
    const rows = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const results = await enrichResults(
      ctx,
      rows,
      group?.aiRubricWeights,
      group?.aiFrontendWeights,
      { includeLogMeta: true }, // Admin view: show log cross-check notes
    );
    const counts = { pending: 0, running: 0, completed: 0, failed: 0 };
    for (const r of results) {
      counts[r.status]++;
    }
    return { results, counts, weights: group?.aiRubricWeights };
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
          sourcesUsed: v.optional(
            v.object({
              github: v.boolean(),
              liveUrl: v.boolean(),
              videoTranscript: v.optional(v.boolean()),
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
      sourcesUsed?: {
        github: boolean;
        liveUrl: boolean;
        videoTranscript?: boolean;
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
      // Event window for builtDuringEvent (avoids a second query in the action)
      eventStartDate: v.optional(v.number()),
      eventEndDate: v.optional(v.number()),
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
      storyId: v.id("stories"),
      title: v.string(),
      description: v.string(),
      longDescription: v.optional(v.string()),
      url: v.optional(v.string()),
      githubUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
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

    return {
      groupId: result.groupId,
      groupName: group.name,
      eventStartDate: group.startDate,
      eventEndDate: group.endDate,
      aiJudgeSystemPrompt: group.aiJudgeSystemPrompt,
      aiCustomCriteria: group.aiCustomCriteria,
      aiDisabledCriteria: group.aiDisabledCriteria,
      storyId: result.storyId,
      title: story.title,
      description: story.description,
      longDescription: story.longDescription,
      url: story.url,
      githubUrl: story.githubUrl,
      videoUrl: story.videoUrl,
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
        sourcesUsed: v.object({
          github: v.boolean(),
          liveUrl: v.boolean(),
          videoTranscript: v.optional(v.boolean()),
        }),
        urlCheck: v.optional(urlCheckValidator),
        frontendHosting: v.optional(frontendHostingValidator),
        // hackathon.md header claims vs detected facts (recorded, never scored)
        logDiscrepancies: v.optional(v.array(v.string())),
        // Event free text from the hackathon.md header (repo copy wins)
        hackathonLogEvent: v.optional(v.string()),
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
        provider: undefined,
        model: undefined,
        sourcesUsed: args.outcome.sourcesUsed,
        urlCheck: args.outcome.urlCheck,
        frontendHosting: args.outcome.frontendHosting,
        logDiscrepancies: args.outcome.logDiscrepancies,
        hackathonLogEvent: args.outcome.hackathonLogEvent,
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
    rows.filter((r) => r.status === "completed"),
    group?.aiRubricWeights,
    group?.aiFrontendWeights,
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
