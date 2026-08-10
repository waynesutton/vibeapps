import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAuthenticatedUserId } from "./users";
import { requireJudgingGroupPermission } from "./adminAccess";

// --- Agent judging keys ---
//
// External AI agents authenticate to the judging HTTP API with a bearer key
// (x-judge-key header). Keys are generated once, hashed with SHA-256, and
// only the hex digest is stored (agentJudgeKeys.keyHash). This is NOT the
// base64 hashPassword helper from judgingGroups.ts: that one is reversible
// encoding, fine for a shared results-page password, wrong for a credential.

// SHA-256 hex digest (available in actions and http actions)
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper for the create-key action: verify group-scoped AI permission and
// return the caller's user id
export const getAdminUserId = internalQuery({
  args: { groupId: v.id("judgingGroups") },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    return await getAuthenticatedUserId(ctx);
  },
});

/**
 * Create an agent judge key for a group (admin only). Returns the raw key
 * exactly once; only its SHA-256 hash is stored. Also creates the agent
 * judge identity that scores will be written as.
 */
export const createAgentKey = action({
  args: {
    groupId: v.id("judgingGroups"),
    name: v.string(),
    agentMetadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        harness: v.optional(v.string()),
        operator: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    rawKey: v.string(),
    keyId: v.id("agentJudgeKeys"),
    judgeId: v.id("judges"),
  }),
  handler: async (ctx, args) => {
    const createdBy: Id<"users"> = await ctx.runQuery(
      internal.agentJudges.getAdminUserId,
      { groupId: args.groupId },
    );

    const trimmedName = args.name.trim();
    if (trimmedName.length < 2) {
      throw new Error("Key name must be at least 2 characters long");
    }

    // vjk = vibeapps judge key. Two UUIDs of entropy, hex only.
    const rawKey = `vjk_${crypto.randomUUID().replace(/-/g, "")}${crypto
      .randomUUID()
      .replace(/-/g, "")}`;
    const keyHash = await sha256Hex(rawKey);

    const stored: { keyId: Id<"agentJudgeKeys">; judgeId: Id<"judges"> } =
      await ctx.runMutation(internal.agentJudges.storeAgentKey, {
        groupId: args.groupId,
        name: trimmedName,
        keyHash,
        createdBy,
        agentMetadata: args.agentMetadata,
      });

    return { rawKey, keyId: stored.keyId, judgeId: stored.judgeId };
  },
});

/**
 * Store a new agent key + judge identity. Internal: called only by
 * createAgentKey after admin verification and hashing.
 */
export const storeAgentKey = internalMutation({
  args: {
    groupId: v.id("judgingGroups"),
    name: v.string(),
    keyHash: v.string(),
    createdBy: v.id("users"),
    agentMetadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        harness: v.optional(v.string()),
        operator: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    keyId: v.id("agentJudgeKeys"),
    judgeId: v.id("judges"),
  }),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }
    if (group.agentKeysEnabled === false) {
      throw new Error(
        "Agent API keys are disabled for this judging group. Enable them in the group's AI settings first.",
      );
    }

    const now = Date.now();
    const judgeId = await ctx.db.insert("judges", {
      name: args.name,
      groupId: args.groupId,
      // Agent judges never log in with a session; derive a unique marker
      sessionId: `agent_${args.keyHash.slice(0, 32)}`,
      lastActiveAt: now,
      type: "agent" as const,
      agentMetadata: args.agentMetadata,
    });

    const keyId = await ctx.db.insert("agentJudgeKeys", {
      groupId: args.groupId,
      name: args.name,
      keyHash: args.keyHash,
      judgeId,
      createdBy: args.createdBy,
      callCount: 0,
    });

    return { keyId, judgeId };
  },
});

/**
 * Revoke an agent key (admin only). Revoked keys get 403 on every call.
 * The judge identity and its scores are kept for the audit trail.
 */
export const revokeAgentKey = mutation({
  args: { keyId: v.id("agentJudgeKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) throw new Error("Agent key not found");
    await requireJudgingGroupPermission(ctx, key.groupId, "judging.ai");
    if (key.revokedAt) return null; // Idempotent
    await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
    return null;
  },
});

/**
 * List agent keys for a group (admin only). Raw keys are never retrievable.
 */
export const listAgentKeys = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      _id: v.id("agentJudgeKeys"),
      _creationTime: v.number(),
      name: v.string(),
      judgeId: v.id("judges"),
      revokedAt: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
      callCount: v.number(),
      scoreCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");

    const keys = await ctx.db
      .query("agentJudgeKeys")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const result = [];
    for (const key of keys) {
      const scores = await ctx.db
        .query("judgeScores")
        .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
        .filter((q) => q.eq(q.field("judgeId"), key.judgeId))
        .collect();
      result.push({
        _id: key._id,
        _creationTime: key._creationTime,
        name: key.name,
        judgeId: key.judgeId,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt,
        callCount: key.callCount,
        scoreCount: scores.length,
      });
    }
    return result;
  },
});

/**
 * Toggle whether agent scores are advisory for a group (admin only).
 * Advisory (default) = shown with a badge, excluded from final rankings.
 */
export const updateAgentScoresAdvisory = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    advisory: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    await ctx.db.patch(args.groupId, { agentScoresAdvisory: args.advisory });
    return null;
  },
});

/**
 * Toggle the agent HTTP API for a group (admin only). When disabled, every
 * existing key gets 403 on all agent endpoints and new keys cannot be
 * created. Keys are not revoked: re-enabling restores them.
 */
export const updateAgentKeysEnabled = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    await ctx.db.patch(args.groupId, { agentKeysEnabled: args.enabled });
    return null;
  },
});

// --- Internal helpers used by the judging HTTP API (convex/http.ts) ---

/**
 * Resolve a key hash to its agent context. Returns null for unknown or
 * revoked keys, and for groups whose agent API is disabled; the HTTP layer
 * maps that to 403.
 */
export const getAgentContext = internalQuery({
  args: { keyHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      keyId: v.id("agentJudgeKeys"),
      judgeId: v.id("judges"),
      judgeName: v.string(),
      groupId: v.id("judgingGroups"),
      groupSlug: v.string(),
      groupName: v.string(),
      groupIsActive: v.boolean(),
      judgesPerSubmission: v.number(),
      scoreScale: v.number(),
      agentScoresAdvisory: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("agentJudgeKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (!key || key.revokedAt !== undefined) return null;

    const judge = await ctx.db.get(key.judgeId);
    const group = await ctx.db.get(key.groupId);
    if (!judge || !group) return null;
    // Per-group kill switch for the agent HTTP API
    if (group.agentKeysEnabled === false) return null;

    return {
      keyId: key._id,
      judgeId: key.judgeId,
      judgeName: judge.name,
      groupId: key.groupId,
      groupSlug: group.slug,
      groupName: group.name,
      groupIsActive: group.isActive,
      judgesPerSubmission: group.judgesPerSubmission ?? 1,
      scoreScale: group.scoreScale ?? 10,
      agentScoresAdvisory: group.agentScoresAdvisory ?? true,
    };
  },
});

/**
 * Record key usage. Called on score writes only (not reads) so a busy agent
 * does not hammer one hot document.
 */
export const markAgentKeyUsed = internalMutation({
  args: { keyId: v.id("agentJudgeKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return null;
    await ctx.db.patch(args.keyId, {
      lastUsedAt: Date.now(),
      callCount: key.callCount + 1,
    });
    return null;
  },
});

// Exclude deleted/hidden/archived/rejected stories, same as human judging
function isStoryValidForJudging(story: Doc<"stories"> | null): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isHidden === true) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  return true;
}

/**
 * Criteria for a group, shaped for the agent API.
 */
export const getCriteriaForAgent = internalQuery({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      criteriaId: v.id("judgingCriteria"),
      question: v.string(),
      description: v.optional(v.string()),
      order: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .order("asc")
      .collect();
    return criteria.map((c) => ({
      criteriaId: c._id,
      question: c.question,
      description: c.description,
      order: c.order,
    }));
  },
});

/**
 * The agent's submission queue: valid submissions in the group that this
 * agent has not completed, excluding submissions already locked by enough
 * other judges (judgesPerSubmission).
 */
export const getAgentQueue = internalQuery({
  args: {
    groupId: v.id("judgingGroups"),
    judgeId: v.id("judges"),
  },
  returns: v.array(
    v.object({
      storyId: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      url: v.optional(v.string()),
      githubUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      scoredCriteriaCount: v.number(),
      completedByThisAgent: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return [];
    const judgesPerSubmission = group.judgesPerSubmission ?? 1;

    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const completions = await ctx.db
      .query("submissionJudgeCompletions")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const myScores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("judgeId"), args.judgeId))
      .collect();

    const queue = [];
    for (const submission of submissions) {
      const story = await ctx.db.get(submission.storyId);
      if (!isStoryValidForJudging(story)) continue;

      const storyCompletions = completions.filter(
        (c) => c.storyId === submission.storyId,
      );
      const completedByThisAgent = storyCompletions.some(
        (c) => c.judgeId === args.judgeId,
      );
      // Locked: enough other judges already completed this submission
      const isLocked =
        !completedByThisAgent && storyCompletions.length >= judgesPerSubmission;
      if (completedByThisAgent || isLocked) continue;

      queue.push({
        storyId: submission.storyId,
        title: story.title,
        slug: story.slug,
        description: story.description,
        url: story.url,
        githubUrl: story.githubUrl,
        videoUrl: story.videoUrl,
        scoredCriteriaCount: myScores.filter(
          (s) => s.storyId === submission.storyId,
        ).length,
        completedByThisAgent,
      });
    }
    return queue;
  },
});

/**
 * Full detail for one submission in the group (agent API).
 */
export const getSubmissionDetailForAgent = internalQuery({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
  },
  returns: v.union(
    v.null(),
    v.object({
      storyId: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      longDescription: v.optional(v.string()),
      url: v.optional(v.string()),
      githubUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      teamName: v.optional(v.string()),
      submitterName: v.optional(v.string()),
      tags: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();
    if (!submission) return null;

    const story = await ctx.db.get(args.storyId);
    if (!isStoryValidForJudging(story)) return null;

    const tags: Array<string> = [];
    for (const tagId of story.tagIds || []) {
      const tag = await ctx.db.get(tagId);
      if (tag) tags.push(tag.name);
    }

    return {
      storyId: story._id,
      title: story.title,
      slug: story.slug,
      description: story.description,
      longDescription: story.longDescription,
      url: story.url,
      githubUrl: story.githubUrl,
      videoUrl: story.videoUrl,
      teamName: story.teamName,
      submitterName: story.submitterName,
      tags,
    };
  },
});

/**
 * Write a batch of agent scores for one submission. Idempotent: reposting
 * the same criteria updates the existing rows via the by_judge_story_criteria
 * unique index, never duplicates. When `complete` is set, a completion row is
 * written (also idempotent).
 */
export const submitAgentScores = internalMutation({
  args: {
    judgeId: v.id("judges"),
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
    scores: v.array(
      v.object({
        criteriaId: v.id("judgingCriteria"),
        score: v.number(),
        comments: v.optional(v.string()),
      }),
    ),
    complete: v.optional(v.boolean()),
  },
  returns: v.object({
    written: v.number(),
    completed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Validate everything before any write
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.isActive) {
      throw new Error("Judging group is not active");
    }

    const submission = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();
    if (!submission) {
      throw new Error("Story is not part of this judging group");
    }
    const story = await ctx.db.get(args.storyId);
    if (!isStoryValidForJudging(story)) {
      throw new Error("Story is not available for judging");
    }

    // Group score scale (5 or 10) bounds every submitted score
    const scoreScale = group.scoreScale ?? 10;
    for (const entry of args.scores) {
      if (
        entry.score < 1 ||
        entry.score > scoreScale ||
        !Number.isInteger(entry.score)
      ) {
        throw new Error(
          `Every score must be an integer between 1 and ${scoreScale}`,
        );
      }
      const criteria = await ctx.db.get(entry.criteriaId);
      if (!criteria || criteria.groupId !== args.groupId) {
        throw new Error("Invalid criteria for this judging group");
      }
    }

    // Upsert one judgeScores row per criterion (idempotent)
    let written = 0;
    for (const entry of args.scores) {
      const existing = await ctx.db
        .query("judgeScores")
        .withIndex("by_judge_story_criteria", (q) =>
          q
            .eq("judgeId", args.judgeId)
            .eq("storyId", args.storyId)
            .eq("criteriaId", entry.criteriaId),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          score: entry.score,
          comments: entry.comments?.trim() || undefined,
        });
      } else {
        await ctx.db.insert("judgeScores", {
          judgeId: args.judgeId,
          groupId: args.groupId,
          storyId: args.storyId,
          criteriaId: entry.criteriaId,
          score: entry.score,
          comments: entry.comments?.trim() || undefined,
        });
      }
      written++;
    }

    // Optional completion marker (idempotent)
    let completed = false;
    if (args.complete) {
      const existingCompletion = await ctx.db
        .query("submissionJudgeCompletions")
        .withIndex("by_group_story_judge", (q) =>
          q
            .eq("groupId", args.groupId)
            .eq("storyId", args.storyId)
            .eq("judgeId", args.judgeId),
        )
        .unique();
      if (!existingCompletion) {
        await ctx.db.insert("submissionJudgeCompletions", {
          groupId: args.groupId,
          storyId: args.storyId,
          judgeId: args.judgeId,
          completedAt: Date.now(),
        });
      }
      completed = true;
    }

    return { written, completed };
  },
});
