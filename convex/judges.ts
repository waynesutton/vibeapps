import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users";

// Helper to generate secure session IDs using V8-compatible approach
function generateSessionId(): string {
  // Generate a random 64-character hex string using Math.random and timestamp
  const timestamp = Date.now().toString(16);
  const random1 = Math.random().toString(16).substring(2);
  const random2 = Math.random().toString(16).substring(2);
  const random3 = Math.random().toString(16).substring(2);
  return (timestamp + random1 + random2 + random3).substring(0, 64);
}

// --- Admin Functions ---

/**
 * Get all judges for a specific group (admin view)
 */
export const listByGroup = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      _id: v.id("judges"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.optional(v.string()),
      groupId: v.id("judgingGroups"),
      sessionId: v.string(),
      lastActiveAt: v.number(),
      scoreCount: v.number(),
      completionPercentage: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .collect();

    // Get criteria count for completion percentage calculation
    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();
    const criteriaCount = criteria.length;

    // Get submissions count
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const submissionCount = submissions.length;

    const totalExpectedScores = criteriaCount * submissionCount;

    // Enrich with scoring data
    const enrichedJudges = await Promise.all(
      judges.map(async (judge) => {
        const scores = await ctx.db
          .query("judgeScores")
          .filter((q) => q.eq(q.field("judgeId"), judge._id))
          .collect();

        const scoreCount = scores.length;
        const completionPercentage =
          totalExpectedScores > 0
            ? (scoreCount / totalExpectedScores) * 100
            : 0;

        return {
          ...judge,
          scoreCount,
          completionPercentage,
        };
      }),
    );

    return enrichedJudges;
  },
});

/**
 * Remove a judge from a group (admin only)
 */
export const removeJudge = mutation({
  args: { judgeId: v.id("judges") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Delete all scores by this judge first
    const scores = await ctx.db
      .query("judgeScores")
      .filter((q) => q.eq(q.field("judgeId"), args.judgeId))
      .collect();

    for (const score of scores) {
      await ctx.db.delete(score._id);
    }

    // Delete the judge
    await ctx.db.delete(args.judgeId);

    return null;
  },
});

// --- Public Functions ---

/**
 * Register a judge for a group
 */
export const registerJudge = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    name: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.object({
    judgeId: v.id("judges"),
    sessionId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Verify the group exists and is accessible
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    if (!group.isActive) {
      throw new Error("Judging for this group is not currently active");
    }

    // Check if judging period is valid
    const now = Date.now();
    if (group.startDate && now < group.startDate) {
      throw new Error("Judging has not started yet");
    }

    if (group.endDate && now > group.endDate) {
      throw new Error("Judging period has ended");
    }

    // Validate name
    const trimmedName = args.name.trim();
    if (trimmedName.length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }

    // Check if judge with same name already exists in this group
    const existingJudge = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("name"), trimmedName))
      .first();

    if (existingJudge) {
      // Return existing judge's session
      return {
        judgeId: existingJudge._id,
        sessionId: existingJudge.sessionId,
      };
    }

    // Create new judge
    const sessionId = generateSessionId();
    const judgeId = await ctx.db.insert("judges", {
      name: trimmedName,
      email: args.email?.trim(),
      groupId: args.groupId,
      sessionId,
      lastActiveAt: now,
    });

    return {
      judgeId,
      sessionId,
    };
  },
});

/**
 * Get judge details by session ID
 */
export const getJudgeSession = query({
  args: { sessionId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judges"),
      name: v.string(),
      email: v.optional(v.string()),
      groupId: v.id("judgingGroups"),
      lastActiveAt: v.number(),
      group: v.object({
        _id: v.id("judgingGroups"),
        name: v.string(),
        slug: v.string(),
        description: v.optional(v.string()),
        isActive: v.boolean(),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      return null;
    }

    // Get group details
    const group = await ctx.db.get(judge.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    return {
      _id: judge._id,
      name: judge.name,
      email: judge.email,
      groupId: judge.groupId,
      lastActiveAt: judge.lastActiveAt,
      group: {
        _id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        isActive: group.isActive,
        startDate: group.startDate,
        endDate: group.endDate,
      },
    };
  },
});

/**
 * Update judge's last active timestamp
 */
export const updateActivity = mutation({
  args: { sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      throw new Error("Judge session not found");
    }

    await ctx.db.patch(judge._id, {
      lastActiveAt: Date.now(),
    });

    return null;
  },
});

/**
 * Get judge's progress in scoring
 */
export const getJudgeProgress = query({
  args: { sessionId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      totalSubmissions: v.number(),
      totalCriteria: v.number(),
      expectedScores: v.number(),
      completedScores: v.number(),
      completionPercentage: v.number(),
      submissionProgress: v.array(
        v.object({
          storyId: v.id("stories"),
          storyTitle: v.string(),
          criteriaScored: v.number(),
          totalCriteria: v.number(),
          isComplete: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      return null;
    }

    // Get group submissions
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", judge.groupId))
      .collect();

    // Get group criteria
    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", judge.groupId))
      .collect();

    // Get judge's scores
    const scores = await ctx.db
      .query("judgeScores")
      .filter((q) => q.eq(q.field("judgeId"), judge._id))
      .collect();

    const totalSubmissions = submissions.length;
    const totalCriteria = criteria.length;
    const expectedScores = totalSubmissions * totalCriteria;
    const completedScores = scores.length;
    const completionPercentage =
      expectedScores > 0 ? (completedScores / expectedScores) * 100 : 0;

    // Calculate progress per submission
    const submissionProgress = await Promise.all(
      submissions.map(async (submission) => {
        const story = await ctx.db.get(submission.storyId);
        if (!story) {
          throw new Error(`Story ${submission.storyId} not found`);
        }

        const storyScores = scores.filter(
          (s) => s.storyId === submission.storyId,
        );
        const criteriaScored = storyScores.length;
        const isComplete = criteriaScored === totalCriteria;

        return {
          storyId: submission.storyId,
          storyTitle: story.title,
          criteriaScored,
          totalCriteria,
          isComplete,
        };
      }),
    );

    return {
      totalSubmissions,
      totalCriteria,
      expectedScores,
      completedScores,
      completionPercentage,
      submissionProgress,
    };
  },
});

/**
 * Validate a judge session
 */
export const validateSession = query({
  args: { sessionId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      return false;
    }

    // Check if group is still active
    const group = await ctx.db.get(judge.groupId);
    if (!group || !group.isActive) {
      return false;
    }

    // Check if judging period is valid
    const now = Date.now();
    if (group.startDate && now < group.startDate) {
      return false;
    }

    if (group.endDate && now > group.endDate) {
      return false;
    }

    return true;
  },
});

/**
 * Check if a judge session is still valid
 */
export const isSessionValid = query({
  args: { sessionId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      return false;
    }

    // Check if session is too old (24 hours)
    const now = Date.now();
    const sessionAge = now - judge.lastActiveAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (sessionAge > maxAge) {
      return false;
    }

    // Check if group is still active
    const group = await ctx.db.get(judge.groupId);
    if (!group || !group.isActive) {
      return false;
    }

    // Check if judging period is valid
    if (group.startDate && now < group.startDate) {
      return false;
    }

    if (group.endDate && now > group.endDate) {
      return false;
    }

    return true;
  },
});
