import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users";

/**
 * Helper function to check if a submission should have its status reset to pending
 * when scores are deleted or hidden
 */
async function checkAndResetSubmissionStatus(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
  storyId: Id<"stories">,
) {
  // Get the current submission status
  const submissionStatus = await ctx.db
    .query("submissionStatuses")
    .withIndex("by_groupId_storyId", (q) =>
      q.eq("groupId", groupId).eq("storyId", storyId),
    )
    .unique();

  // Only reset if currently completed
  if (!submissionStatus || submissionStatus.status !== "completed") {
    return;
  }

  // Get all criteria for this group
  const criteria = await ctx.db
    .query("judgingCriteria")
    .withIndex("by_groupId_order", (q) => q.eq("groupId", groupId))
    .collect();

  // Get all visible scores for this submission
  const visibleScores = await ctx.db
    .query("judgeScores")
    .withIndex("by_groupId_storyId", (q) =>
      q.eq("groupId", groupId).eq("storyId", storyId),
    )
    .filter((q) => q.neq(q.field("isHidden"), true))
    .collect();

  // Check if the assigned judge still has all criteria scored
  if (submissionStatus.assignedJudgeId) {
    const assignedJudgeScores = visibleScores.filter(
      (score) => score.judgeId === submissionStatus.assignedJudgeId,
    );

    // If the assigned judge doesn't have all criteria scored, reset to pending
    if (assignedJudgeScores.length < criteria.length) {
      await ctx.db.patch(submissionStatus._id, {
        status: "pending" as const,
        assignedJudgeId: undefined,
        lastUpdatedAt: Date.now(),
      });
    }
  }
}

/**
 * Get all judges for a specific judging group with their scores and user profile info
 */
export const getGroupJudgeTracking = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({
    group: v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
    }),
    judges: v.array(
      v.object({
        _id: v.id("judges"),
        name: v.string(),
        email: v.optional(v.string()),
        sessionId: v.string(),
        lastActiveAt: v.number(),
        userId: v.optional(v.id("users")),
        userProfile: v.union(
          v.null(),
          v.object({
            _id: v.id("users"),
            name: v.string(),
            username: v.optional(v.string()),
            imageUrl: v.optional(v.string()),
            email: v.optional(v.string()),
          }),
        ),
        scoresCount: v.number(),
        submissionsJudged: v.number(),
        averageScore: v.optional(v.number()),
        lastScoreAt: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get the group
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    // Get all judges for this group
    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Get all scores for this group to calculate judge statistics
    const allScores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Build judge tracking data
    const judgeTrackingData = await Promise.all(
      judges.map(async (judge) => {
        // Get user profile if linked
        let userProfile = null;
        if (judge.userId) {
          const user = await ctx.db.get(judge.userId);
          if (user) {
            userProfile = {
              _id: user._id,
              name: user.name,
              username: user.username,
              imageUrl: user.imageUrl,
              email: user.email,
            };
          }
        }

        // Calculate judge statistics
        const judgeScores = allScores.filter(
          (score) => score.judgeId === judge._id,
        );
        const scoresCount = judgeScores.length;
        const submissionsJudged = new Set(
          judgeScores.map((score) => score.storyId),
        ).size;
        const averageScore =
          scoresCount > 0
            ? judgeScores.reduce((sum, score) => sum + score.score, 0) /
              scoresCount
            : undefined;
        const lastScoreAt =
          judgeScores.length > 0
            ? Math.max(...judgeScores.map((score) => score._creationTime))
            : undefined;

        return {
          _id: judge._id,
          name: judge.name,
          email: judge.email,
          sessionId: judge.sessionId,
          lastActiveAt: judge.lastActiveAt,
          userId: judge.userId,
          userProfile,
          scoresCount,
          submissionsJudged,
          averageScore,
          lastScoreAt,
        };
      }),
    );

    return {
      group: {
        _id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        isActive: group.isActive,
      },
      judges: judgeTrackingData,
    };
  },
});

/**
 * Get detailed scores for a specific judge
 */
export const getJudgeDetailedScores = query({
  args: { judgeId: v.id("judges") },
  returns: v.array(
    v.object({
      _id: v.id("judgeScores"),
      _creationTime: v.number(),
      score: v.number(),
      comments: v.optional(v.string()),
      isHidden: v.optional(v.boolean()),
      story: v.object({
        _id: v.id("stories"),
        title: v.string(),
        slug: v.string(),
      }),
      criteria: v.object({
        _id: v.id("judgingCriteria"),
        question: v.string(),
        description: v.optional(v.string()),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get all scores by this judge
    const scores = await ctx.db
      .query("judgeScores")
      .filter((q) => q.eq(q.field("judgeId"), args.judgeId))
      .collect();

    // Get story and criteria details for each score
    const detailedScores = await Promise.all(
      scores.map(async (score) => {
        const story = await ctx.db.get(score.storyId);
        const criteria = await ctx.db.get(score.criteriaId);

        if (!story || !criteria) {
          throw new Error("Score references missing story or criteria");
        }

        return {
          _id: score._id,
          _creationTime: score._creationTime,
          score: score.score,
          comments: score.comments,
          isHidden: score.isHidden,
          story: {
            _id: story._id,
            title: story.title,
            slug: story.slug,
          },
          criteria: {
            _id: criteria._id,
            question: criteria.question,
            description: criteria.description,
          },
        };
      }),
    );

    return detailedScores.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/**
 * Update a judge's score (admin override)
 */
export const updateJudgeScore = mutation({
  args: {
    scoreId: v.id("judgeScores"),
    score: v.number(),
    comments: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Validate score range
    if (args.score < 1 || args.score > 10 || !Number.isInteger(args.score)) {
      throw new Error("Score must be an integer between 1 and 10");
    }

    const existingScore = await ctx.db.get(args.scoreId);
    if (!existingScore) {
      throw new Error("Score not found");
    }

    await ctx.db.patch(args.scoreId, {
      score: args.score,
      comments: args.comments,
    });

    return null;
  },
});

/**
 * Hide/unhide a judge's score
 */
export const toggleScoreVisibility = mutation({
  args: {
    scoreId: v.id("judgeScores"),
    isHidden: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const existingScore = await ctx.db.get(args.scoreId);
    if (!existingScore) {
      throw new Error("Score not found");
    }

    await ctx.db.patch(args.scoreId, {
      isHidden: args.isHidden,
    });

    // If hiding a score, check if submission status should be reset
    if (args.isHidden) {
      await checkAndResetSubmissionStatus(
        ctx,
        existingScore.groupId,
        existingScore.storyId,
      );
    }

    return null;
  },
});

/**
 * Delete a judge's score
 */
export const deleteJudgeScore = mutation({
  args: { scoreId: v.id("judgeScores") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const existingScore = await ctx.db.get(args.scoreId);
    if (!existingScore) {
      throw new Error("Score not found");
    }

    // Store score info before deletion for status check
    const groupId = existingScore.groupId;
    const storyId = existingScore.storyId;

    await ctx.db.delete(args.scoreId);

    // Check if submission status should be reset after score deletion
    await checkAndResetSubmissionStatus(ctx, groupId, storyId);

    return null;
  },
});

/**
 * Delete a judge and all their scores
 */
export const deleteJudge = mutation({
  args: { judgeId: v.id("judges") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const judge = await ctx.db.get(args.judgeId);
    if (!judge) {
      throw new Error("Judge not found");
    }

    // Delete all scores by this judge
    const judgeScores = await ctx.db
      .query("judgeScores")
      .filter((q) => q.eq(q.field("judgeId"), args.judgeId))
      .collect();

    // Collect unique submissions that will be affected
    const affectedSubmissions = new Set<string>();
    for (const score of judgeScores) {
      affectedSubmissions.add(`${score.groupId}-${score.storyId}`);
      await ctx.db.delete(score._id);
    }

    // Delete submission statuses where this judge was assigned
    const submissionStatuses = await ctx.db
      .query("submissionStatuses")
      .withIndex("by_assignedJudgeId", (q) =>
        q.eq("assignedJudgeId", args.judgeId),
      )
      .collect();

    for (const status of submissionStatuses) {
      await ctx.db.patch(status._id, {
        assignedJudgeId: undefined,
        status: "pending" as const,
      });
    }

    // Delete submission notes by this judge
    const submissionNotes = await ctx.db
      .query("submissionNotes")
      .withIndex("by_judgeId", (q) => q.eq("judgeId", args.judgeId))
      .collect();

    for (const note of submissionNotes) {
      await ctx.db.delete(note._id);
    }

    // Check submission statuses for all affected submissions
    for (const submissionKey of affectedSubmissions) {
      const [groupId, storyId] = submissionKey.split("-") as [
        Id<"judgingGroups">,
        Id<"stories">,
      ];
      await checkAndResetSubmissionStatus(ctx, groupId, storyId);
    }

    // Finally delete the judge
    await ctx.db.delete(args.judgeId);
    return null;
  },
});

/**
 * Link a judge to a user profile
 */
export const linkJudgeToUser = mutation({
  args: {
    judgeId: v.id("judges"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const judge = await ctx.db.get(args.judgeId);
    if (!judge) {
      throw new Error("Judge not found");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.judgeId, {
      userId: args.userId,
    });

    return null;
  },
});

/**
 * Unlink a judge from a user profile
 */
export const unlinkJudgeFromUser = mutation({
  args: { judgeId: v.id("judges") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const judge = await ctx.db.get(args.judgeId);
    if (!judge) {
      throw new Error("Judge not found");
    }

    await ctx.db.patch(args.judgeId, {
      userId: undefined,
    });

    return null;
  },
});
