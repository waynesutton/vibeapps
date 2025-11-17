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

// Helper function to check if a story should be included in judging
// Returns true if story is valid for judging (not deleted, hidden, archived, or rejected)
// Type guard to ensure TypeScript knows story is not null when this returns true
function isStoryValidForJudging(story: Doc<"stories"> | null): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isHidden === true) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  return true;
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
          .filter((q) => q.neq(q.field("isHidden"), true))
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
 * Optimized to reduce write conflicts by minimizing database queries
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
    // Validate name first (before any DB queries)
    const trimmedName = args.name.trim();
    if (trimmedName.length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }

    const now = Date.now();

    // Verify the group exists and is accessible (single query)
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    if (!group.isActive) {
      throw new Error("Judging for this group is not currently active");
    }

    // Check if user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    let userId: Id<"users"> | undefined = undefined;
    let user: Doc<"users"> | null = null;

    if (identity) {
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();

      if (user) {
        userId = user._id;
      }
    }

    // Single query to get all judges for this group with filters
    // This is more efficient than multiple separate queries
    const allGroupJudges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Check for existing judge by userId first (most reliable)
    if (userId) {
      const existingUserJudge = allGroupJudges.find((j) => j.userId === userId);

      if (existingUserJudge) {
        // Update their info and return existing session (only update if changed)
        const needsUpdate =
          existingUserJudge.name !== trimmedName ||
          existingUserJudge.email !== args.email?.trim() ||
          now - existingUserJudge.lastActiveAt > 60000; // Only update if > 1 minute old

        if (needsUpdate) {
          await ctx.db.patch(existingUserJudge._id, {
            name: trimmedName,
            email: args.email?.trim(),
            lastActiveAt: now,
          });
        }

        return {
          judgeId: existingUserJudge._id,
          sessionId: existingUserJudge.sessionId,
        };
      }
    }

    // Check if judge with same name already exists in this group
    const existingJudge = allGroupJudges.find((j) => j.name === trimmedName);

    if (existingJudge) {
      // If user is authenticated and judge doesn't have userId, link them
      if (userId && !existingJudge.userId) {
        await ctx.db.patch(existingJudge._id, {
          userId: userId,
          email: args.email?.trim() || existingJudge.email,
          lastActiveAt: now,
        });
      } else if (now - existingJudge.lastActiveAt > 60000) {
        // Only update lastActiveAt if > 1 minute old to reduce conflicts
        await ctx.db.patch(existingJudge._id, {
          lastActiveAt: now,
        });
      }

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
      userId: userId,
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
      },
    };
  },
});

/**
 * Update judge's last active timestamp (throttled to reduce write conflicts)
 * Note: Throttling should be done on the client side to minimize database reads
 */
export const updateActivity = mutation({
  args: {
    sessionId: v.string(),
    lastActiveAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      // Silently fail instead of throwing to avoid errors when session expires
      return null;
    }

    // Only update if the provided timestamp is newer than the current one
    // This prevents conflicts from out-of-order updates
    if (args.lastActiveAt > judge.lastActiveAt) {
      await ctx.db.patch(judge._id, {
        lastActiveAt: args.lastActiveAt,
      });
    }

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
          canEdit: v.boolean(), // NEW: Indicates if judge can edit this submission
          completedBy: v.optional(v.string()), // NEW: Name of judge who completed it
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

    // Get group submissions (ALL submissions, not filtered)
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", judge.groupId))
      .collect();

    // Get submission statuses to determine edit permissions
    const submissionStatuses = await ctx.db
      .query("submissionStatuses")
      .withIndex("by_groupId", (q) => q.eq("groupId", judge.groupId))
      .collect();

    // Get group criteria
    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", judge.groupId))
      .collect();

    // Get judge's scores (excluding hidden scores)
    const scores = await ctx.db
      .query("judgeScores")
      .filter((q) => q.eq(q.field("judgeId"), judge._id))
      .filter((q) => q.neq(q.field("isHidden"), true))
      .collect();

    const totalCriteria = criteria.length;
    const completedScores = scores.length;

    // Calculate progress per submission (ALL submissions)
    const submissionProgress = (
      await Promise.all(
        submissions.map(async (submission) => {
          const story = await ctx.db.get(submission.storyId);
          // Skip if story is deleted, hidden, archived, or rejected
          if (!isStoryValidForJudging(story)) {
            return null;
          }

          const storyScores = scores.filter(
            (s) => s.storyId === submission.storyId,
          );
          const criteriaScored = storyScores.length;

          // Get submission status to check if it's marked as completed
          const submissionStatus = submissionStatuses.find(
            (s) => s.storyId === submission.storyId,
          );

          // A submission is complete if:
          // 1. It has a status of "completed" AND was completed by this judge
          const isComplete =
            submissionStatus?.status === "completed" &&
            submissionStatus?.assignedJudgeId === judge._id;

          // Determine if judge can edit this submission
          let canEdit = true;
          let completedBy: string | undefined = undefined;

          if (submissionStatus) {
            if (submissionStatus.status === "completed") {
              // Can only edit if they're the assigned judge
              canEdit = submissionStatus.assignedJudgeId === judge._id;

              // Get the name of the judge who completed it
              if (submissionStatus.assignedJudgeId) {
                const assignedJudge = await ctx.db.get(
                  submissionStatus.assignedJudgeId,
                );
                if (assignedJudge) {
                  completedBy = assignedJudge.name;
                }
              }
            }
            // "pending" and "skip" are always editable by all judges
          }

          return {
            storyId: submission.storyId,
            storyTitle: story.title,
            criteriaScored,
            totalCriteria,
            isComplete,
            canEdit,
            completedBy,
          };
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    // Count only submissions with valid stories
    const totalSubmissions = submissionProgress.length;
    const expectedScores = totalSubmissions * totalCriteria;

    // Calculate completion percentage based on completed SUBMISSIONS by THIS JUDGE only
    const completedSubmissionsCount = submissionProgress.filter(
      (s) => s.isComplete,
    ).length;
    const completionPercentage =
      totalSubmissions > 0
        ? (completedSubmissionsCount / totalSubmissions) * 100
        : 0;

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

    return true;
  },
});
