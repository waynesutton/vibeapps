import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireAdminRole, isUserAdmin, getAuthenticatedUserId } from "./users";
import { verifyPassword } from "./judgingGroups";

// Fixed "Best Use of Convex" rubric. Not admin-editable; shared with the
// analysis action so prompts and stored results always use the same keys.
export const AI_JUDGE_RUBRIC: Array<{ key: string; label: string; description: string }> = [
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
      "Use of advanced features: scheduler and crons, file storage, full-text or vector search, HTTP actions, components, and agents.",
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
  overallReasoning: v.optional(v.string()),
  convexFeaturesDetected: v.optional(v.array(v.string())),
  provider: v.optional(v.string()),
  model: v.optional(v.string()),
  error: v.optional(v.string()),
  sourcesUsed: v.optional(
    v.object({ github: v.boolean(), liveUrl: v.boolean() }),
  ),
  urlCheck: v.optional(urlCheckValidator),
  editedAt: v.optional(v.number()),
});

// Helper mirroring judgingGroups: exclude deleted/hidden/archived/rejected stories
function isStoryValidForJudging(story: Doc<"stories"> | null): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isHidden === true) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  return true;
}

// Enrich AI result rows with story metadata, dropping rows whose story is gone/invalid
async function enrichResults(ctx: QueryCtx, results: Array<Doc<"aiJudgeResults">>) {
  const enriched: Array<{
    _id: Id<"aiJudgeResults">;
    _creationTime: number;
    storyId: Id<"stories">;
    storyTitle: string;
    storySlug: string;
    storyUrl?: string;
    githubUrl?: string;
    status: "pending" | "running" | "completed" | "failed";
    criteriaScores?: Array<{ key: string; label: string; score: number; reasoning: string }>;
    totalScore?: number;
    averageScore?: number;
    overallReasoning?: string;
    convexFeaturesDetected?: Array<string>;
    provider?: string;
    model?: string;
    error?: string;
    sourcesUsed?: { github: boolean; liveUrl: boolean };
    urlCheck?: {
      checkedUrl?: string;
      isLive: boolean;
      statusCode?: number;
      note: string;
    };
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
      overallReasoning: result.overallReasoning,
      convexFeaturesDetected: result.convexFeaturesDetected,
      provider: result.provider,
      model: result.model,
      error: result.error,
      sourcesUsed: result.sourcesUsed,
      urlCheck: result.urlCheck,
      editedAt: result.editedAt,
    });
  }

  // Rank completed results first by total score desc, then pending/running/failed
  enriched.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
  return enriched;
}

// --- Admin: run and manage reviews ---

/**
 * Start (or re-run) the AI review for a judging group.
 * Upserts pending result rows for every valid submission, then schedules the
 * first analysis action. Analyses run sequentially via a scheduler chain.
 */
export const startReview = mutation({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({ queued: v.number() }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

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

    let queued = 0;
    for (const submission of submissions) {
      const story = await ctx.db.get(submission.storyId);
      if (!isStoryValidForJudging(story)) continue;

      const existing = existingByStory.get(submission.storyId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: "pending" as const,
          error: undefined,
        });
      } else {
        await ctx.db.insert("aiJudgeResults", {
          groupId: args.groupId,
          storyId: submission.storyId,
          status: "pending" as const,
        });
      }
      queued++;
    }

    if (queued === 0) {
      throw new Error("This judging group has no submissions to review");
    }

    // Kick off the sequential chain with the first pending row
    const firstPending = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect()
      .then((rows) => rows.find((r) => r.status === "pending"));

    if (firstPending) {
      await ctx.scheduler.runAfter(0, internal.aiJudgeAnalysis.analyzeSubmission, {
        resultId: firstPending._id,
      });
    }

    return { queued };
  },
});

/**
 * Retry the AI review for a single submission (e.g. after a failure).
 */
export const retrySubmission = mutation({
  args: { resultId: v.id("aiJudgeResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const result = await ctx.db.get(args.resultId);
    if (!result) {
      throw new Error("AI result not found");
    }
    if (result.status === "running") {
      throw new Error("This submission is currently being reviewed");
    }

    await ctx.db.patch(args.resultId, {
      status: "pending" as const,
      error: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.aiJudgeAnalysis.analyzeSubmission, {
      resultId: args.resultId,
    });
    return null;
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
    await requireAdminRole(ctx);
    const userId = await getAuthenticatedUserId(ctx);

    for (const cs of args.criteriaScores) {
      if (!Number.isFinite(cs.score) || cs.score < 1 || cs.score > 10) {
        throw new Error("Scores must be between 1 and 10");
      }
    }

    const totalScore = args.criteriaScores.reduce((sum, cs) => sum + cs.score, 0);
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
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const rows = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const results = await enrichResults(ctx, rows);
    const counts = { pending: 0, running: 0, completed: 0, failed: 0 };
    for (const r of results) {
      counts[r.status]++;
    }
    return { results, counts };
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
          overallReasoning: v.optional(v.string()),
          convexFeaturesDetected: v.optional(v.array(v.string())),
          urlCheck: v.optional(urlCheckValidator),
          sourcesUsed: v.optional(
            v.object({ github: v.boolean(), liveUrl: v.boolean() }),
          ),
          error: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

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
      overallReasoning?: string;
      convexFeaturesDetected?: Array<string>;
      urlCheck?: {
        checkedUrl?: string;
        isLive: boolean;
        statusCode?: number;
        note: string;
      };
      sourcesUsed?: { github: boolean; liveUrl: boolean };
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
        overallReasoning: row.overallReasoning,
        convexFeaturesDetected: row.convexFeaturesDetected,
        urlCheck: row.urlCheck,
        sourcesUsed: row.sourcesUsed,
        error: row.error,
      });
    }

    // Completed first by score, then the rest
    submissions.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));

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
      storyId: v.id("stories"),
      title: v.string(),
      description: v.string(),
      longDescription: v.optional(v.string()),
      url: v.optional(v.string()),
      githubUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      tags: v.array(v.string()),
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
      storyId: result.storyId,
      title: story.title,
      description: story.description,
      longDescription: story.longDescription,
      url: story.url,
      githubUrl: story.githubUrl,
      videoUrl: story.videoUrl,
      tags,
    };
  },
});

/**
 * Save an analysis outcome (success or failure) and schedule the next pending
 * submission in the group so the chain continues.
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
        provider: v.string(),
        model: v.string(),
        sourcesUsed: v.object({ github: v.boolean(), liveUrl: v.boolean() }),
        urlCheck: v.optional(urlCheckValidator),
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
          ? Math.round((totalScore / args.outcome.criteriaScores.length) * 100) / 100
          : 0;
      await ctx.db.patch(args.resultId, {
        status: "completed" as const,
        criteriaScores: args.outcome.criteriaScores,
        totalScore,
        averageScore,
        overallReasoning: args.outcome.overallReasoning,
        convexFeaturesDetected: args.outcome.convexFeaturesDetected,
        provider: args.outcome.provider,
        model: args.outcome.model,
        sourcesUsed: args.outcome.sourcesUsed,
        urlCheck: args.outcome.urlCheck,
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

    // Continue the sequential chain with the next pending row in this group
    const nextPending = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", result.groupId))
      .collect()
      .then((rows) => rows.find((r) => r.status === "pending"));

    if (nextPending) {
      await ctx.scheduler.runAfter(0, internal.aiJudgeAnalysis.analyzeSubmission, {
        resultId: nextPending._id,
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
    return verifyPassword(args.password, group.aiResultsPassword);
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
    return verifyPassword(args.password, group.aiResultsPassword);
  },
});

// Shared handler for public/validated AI results: completed results only, ranked
async function getCompletedResultsForGroup(ctx: QueryCtx, groupId: Id<"judgingGroups">) {
  const rows = await ctx.db
    .query("aiJudgeResults")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();
  const enriched = await enrichResults(ctx, rows.filter((r) => r.status === "completed"));
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
 * AI results after password validation (no public check, mirrors
 * getValidatedGroupScores in judgeScores.ts).
 */
export const getValidatedAiResults = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(v.null(), v.array(aiResultValidator)),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.aiJudgeEnabled) {
      return null;
    }
    return await getCompletedResultsForGroup(ctx, args.groupId);
  },
});
