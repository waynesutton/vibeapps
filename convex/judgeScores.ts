import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users";

// --- Public Functions (for judges) ---

/**
 * Submit or update a score for a specific criteria and submission
 */
export const submitScore = mutation({
  args: {
    sessionId: v.string(),
    storyId: v.id("stories"),
    criteriaId: v.id("judgingCriteria"),
    score: v.number(),
    comments: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Validate score range
    if (args.score < 1 || args.score > 5 || !Number.isInteger(args.score)) {
      throw new Error("Score must be an integer between 1 and 5");
    }

    // Get judge by session
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      throw new Error("Invalid judge session");
    }

    // Verify the group is active
    const group = await ctx.db.get(judge.groupId);
    if (!group || !group.isActive) {
      throw new Error("Judging group is not active");
    }

    // Check judging period
    const now = Date.now();
    if (group.startDate && now < group.startDate) {
      throw new Error("Judging has not started yet");
    }

    if (group.endDate && now > group.endDate) {
      throw new Error("Judging period has ended");
    }

    // Verify the criteria belongs to this group
    const criteria = await ctx.db.get(args.criteriaId);
    if (!criteria || criteria.groupId !== judge.groupId) {
      throw new Error("Invalid criteria for this judging group");
    }

    // Verify the submission belongs to this group
    const submission = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", judge.groupId).eq("storyId", args.storyId),
      )
      .unique();

    if (!submission) {
      throw new Error("Story is not part of this judging group");
    }

    // Check if score already exists
    const existingScore = await ctx.db
      .query("judgeScores")
      .withIndex("by_judge_story_criteria", (q) =>
        q
          .eq("judgeId", judge._id)
          .eq("storyId", args.storyId)
          .eq("criteriaId", args.criteriaId),
      )
      .unique();

    if (existingScore) {
      // Update existing score
      await ctx.db.patch(existingScore._id, {
        score: args.score,
        comments: args.comments?.trim() || undefined,
      });
    } else {
      // Create new score
      await ctx.db.insert("judgeScores", {
        judgeId: judge._id,
        groupId: judge.groupId,
        storyId: args.storyId,
        criteriaId: args.criteriaId,
        score: args.score,
        comments: args.comments?.trim() || undefined,
      });
    }

    // Update judge's last active time
    await ctx.db.patch(judge._id, {
      lastActiveAt: now,
    });

    return null;
  },
});

/**
 * Get judge's scores for a specific submission
 */
export const getJudgeSubmissionScores = query({
  args: {
    sessionId: v.string(),
    storyId: v.id("stories"),
  },
  returns: v.array(
    v.object({
      _id: v.id("judgeScores"),
      criteriaId: v.id("judgingCriteria"),
      score: v.number(),
      comments: v.optional(v.string()),
      criteria: v.object({
        _id: v.id("judgingCriteria"),
        question: v.string(),
        description: v.optional(v.string()),
        order: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    // Get judge by session
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      throw new Error("Invalid judge session");
    }

    // Get scores for this submission by this judge
    const scores = await ctx.db
      .query("judgeScores")
      .filter((q) =>
        q.and(
          q.eq(q.field("judgeId"), judge._id),
          q.eq(q.field("storyId"), args.storyId),
        ),
      )
      .collect();

    // Enrich with criteria details
    const enrichedScores = await Promise.all(
      scores.map(async (score) => {
        const criteria = await ctx.db.get(score.criteriaId);
        if (!criteria) {
          throw new Error(`Criteria ${score.criteriaId} not found`);
        }

        return {
          _id: score._id,
          criteriaId: score.criteriaId,
          score: score.score,
          comments: score.comments,
          criteria: {
            _id: criteria._id,
            question: criteria.question,
            description: criteria.description,
            order: criteria.order,
          },
        };
      }),
    );

    // Sort by criteria order
    return enrichedScores.sort((a, b) => a.criteria.order - b.criteria.order);
  },
});

// --- Admin Functions ---

/**
 * Get all scores for a judging group with analytics
 */
export const getGroupScores = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({
    totalScores: v.number(),
    averageScore: v.optional(v.number()),
    judgeCount: v.number(),
    submissionCount: v.number(),
    criteriaCount: v.number(),
    completionPercentage: v.number(),
    submissionRankings: v.array(
      v.object({
        storyId: v.id("stories"),
        storyTitle: v.string(),
        storySlug: v.string(),
        totalScore: v.number(),
        averageScore: v.number(),
        scoreCount: v.number(),
        completionPercentage: v.number(),
        maxPossibleScore: v.number(),
      }),
    ),
    criteriaBreakdown: v.array(
      v.object({
        criteriaId: v.id("judgingCriteria"),
        question: v.string(),
        averageScore: v.number(),
        scoreCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get all scores for this group
    const scores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Get group metadata
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();

    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const totalScores = scores.length;
    const averageScore =
      totalScores > 0
        ? scores.reduce((sum, score) => sum + score.score, 0) / totalScores
        : undefined;

    const judgeCount = judges.length;
    const submissionCount = submissions.length;
    const criteriaCount = criteria.length;
    const expectedScores = judgeCount * submissionCount * criteriaCount;
    const completionPercentage =
      expectedScores > 0 ? (totalScores / expectedScores) * 100 : 0;

    // Calculate submission rankings
    const submissionRankings = await Promise.all(
      submissions.map(async (submission) => {
        const story = await ctx.db.get(submission.storyId);
        if (!story) {
          throw new Error(`Story ${submission.storyId} not found`);
        }

        const submissionScores = scores.filter(
          (s) => s.storyId === submission.storyId,
        );
        const totalScore = submissionScores.reduce(
          (sum, score) => sum + score.score,
          0,
        );
        const averageScore =
          submissionScores.length > 0
            ? totalScore / submissionScores.length
            : 0;
        const maxPossibleScore = judgeCount * criteriaCount * 5; // 5 is max score
        const submissionCompletionPercentage =
          judgeCount * criteriaCount > 0
            ? (submissionScores.length / (judgeCount * criteriaCount)) * 100
            : 0;

        return {
          storyId: submission.storyId,
          storyTitle: story.title,
          storySlug: story.slug,
          totalScore,
          averageScore,
          scoreCount: submissionScores.length,
          completionPercentage: submissionCompletionPercentage,
          maxPossibleScore,
        };
      }),
    );

    // Sort by total score descending
    submissionRankings.sort((a, b) => b.totalScore - a.totalScore);

    // Calculate criteria breakdown
    const criteriaBreakdown = criteria.map((criterion) => {
      const criteriaScores = scores.filter(
        (s) => s.criteriaId === criterion._id,
      );
      const averageScore =
        criteriaScores.length > 0
          ? criteriaScores.reduce((sum, score) => sum + score.score, 0) /
            criteriaScores.length
          : 0;

      return {
        criteriaId: criterion._id,
        question: criterion.question,
        averageScore,
        scoreCount: criteriaScores.length,
      };
    });

    return {
      totalScores,
      averageScore,
      judgeCount,
      submissionCount,
      criteriaCount,
      completionPercentage,
      submissionRankings,
      criteriaBreakdown,
    };
  },
});

/**
 * Get judge details with their scores and comments for a group
 */
export const getGroupJudgeDetails = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      judgeId: v.id("judges"),
      judgeName: v.string(),
      judgeEmail: v.optional(v.string()),
      scores: v.array(
        v.object({
          storyId: v.id("stories"),
          storyTitle: v.string(),
          criteriaId: v.id("judgingCriteria"),
          criteriaQuestion: v.string(),
          score: v.number(),
          comments: v.optional(v.string()),
        }),
      ),
      totalScores: v.number(),
      averageScore: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get all judges for this group
    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Get all scores for this group
    const allScores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Get all stories and criteria for reference
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const stories = await Promise.all(
      submissions.map(async (sub) => {
        const story = await ctx.db.get(sub.storyId);
        return story;
      }),
    );

    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Build judge details with their scores
    const judgeDetails = await Promise.all(
      judges.map(async (judge) => {
        // Get scores for this judge
        const judgeScores = allScores.filter((s) => s.judgeId === judge._id);

        // Enrich scores with story and criteria details
        const enrichedScores = await Promise.all(
          judgeScores.map(async (score) => {
            const story = stories.find((s) => s?._id === score.storyId);
            const criterion = criteria.find((c) => c._id === score.criteriaId);

            if (!story || !criterion) {
              return null;
            }

            return {
              storyId: score.storyId,
              storyTitle: story.title,
              criteriaId: score.criteriaId,
              criteriaQuestion: criterion.question,
              score: score.score,
              comments: score.comments,
            };
          }),
        );

        // Filter out null values
        const validScores = enrichedScores.filter((s) => s !== null);

        const totalScores = validScores.length;
        const averageScore =
          totalScores > 0
            ? validScores.reduce((sum, s) => sum + s.score, 0) / totalScores
            : undefined;

        return {
          judgeId: judge._id,
          judgeName: judge.name,
          judgeEmail: judge.email,
          scores: validScores,
          totalScores,
          averageScore,
        };
      }),
    );

    return judgeDetails;
  },
});

/**
 * Get detailed scores for a specific submission
 */
export const getSubmissionScores = query({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
  },
  returns: v.object({
    story: v.object({
      _id: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      url: v.string(),
    }),
    totalScore: v.number(),
    averageScore: v.number(),
    scoreCount: v.number(),
    maxPossibleScore: v.number(),
    scoresByJudge: v.array(
      v.object({
        judgeId: v.id("judges"),
        judgeName: v.string(),
        scores: v.array(
          v.object({
            criteriaId: v.id("judgingCriteria"),
            question: v.string(),
            score: v.number(),
            comments: v.optional(v.string()),
          }),
        ),
        judgeTotal: v.number(),
        judgeAverage: v.number(),
      }),
    ),
    scoresByCriteria: v.array(
      v.object({
        criteriaId: v.id("judgingCriteria"),
        question: v.string(),
        scores: v.array(
          v.object({
            judgeId: v.id("judges"),
            judgeName: v.string(),
            score: v.number(),
            comments: v.optional(v.string()),
          }),
        ),
        criteriaAverage: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get story details
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    // Get all scores for this submission
    const scores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .collect();

    // Get criteria and judges for context
    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();

    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
    const averageScore = scores.length > 0 ? totalScore / scores.length : 0;
    const maxPossibleScore = judges.length * criteria.length * 5;

    // Group scores by judge
    const scoresByJudge = await Promise.all(
      judges.map(async (judge) => {
        const judgeScores = scores.filter((s) => s.judgeId === judge._id);

        const judgeScoreDetails = await Promise.all(
          judgeScores.map(async (score) => {
            const criterion = await ctx.db.get(score.criteriaId);
            if (!criterion) {
              throw new Error(`Criteria ${score.criteriaId} not found`);
            }

            return {
              criteriaId: score.criteriaId,
              question: criterion.question,
              score: score.score,
              comments: score.comments,
            };
          }),
        );

        const judgeTotal = judgeScores.reduce(
          (sum, score) => sum + score.score,
          0,
        );
        const judgeAverage =
          judgeScores.length > 0 ? judgeTotal / judgeScores.length : 0;

        return {
          judgeId: judge._id,
          judgeName: judge.name,
          scores: judgeScoreDetails.sort((a, b) => {
            const criteriaA = criteria.find((c) => c._id === a.criteriaId);
            const criteriaB = criteria.find((c) => c._id === b.criteriaId);
            return (criteriaA?.order || 0) - (criteriaB?.order || 0);
          }),
          judgeTotal,
          judgeAverage,
        };
      }),
    );

    // Group scores by criteria
    const scoresByCriteria = await Promise.all(
      criteria.map(async (criterion) => {
        const criteriaScores = scores.filter(
          (s) => s.criteriaId === criterion._id,
        );

        const criteriaScoreDetails = await Promise.all(
          criteriaScores.map(async (score) => {
            const judge = await ctx.db.get(score.judgeId);
            if (!judge) {
              throw new Error(`Judge ${score.judgeId} not found`);
            }

            return {
              judgeId: score.judgeId,
              judgeName: judge.name,
              score: score.score,
              comments: score.comments,
            };
          }),
        );

        const criteriaAverage =
          criteriaScores.length > 0
            ? criteriaScores.reduce((sum, score) => sum + score.score, 0) /
              criteriaScores.length
            : 0;

        return {
          criteriaId: criterion._id,
          question: criterion.question,
          scores: criteriaScoreDetails,
          criteriaAverage,
        };
      }),
    );

    return {
      story: {
        _id: story._id,
        title: story.title,
        slug: story.slug,
        description: story.description,
        url: story.url,
      },
      totalScore,
      averageScore,
      scoreCount: scores.length,
      maxPossibleScore,
      scoresByJudge,
      scoresByCriteria,
    };
  },
});

// --- Public Functions (for public results pages) ---

/**
 * Get group scores for public results viewing (no admin required)
 */
export const getPublicGroupScores = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.null(),
    v.object({
      totalScores: v.number(),
      averageScore: v.optional(v.number()),
      judgeCount: v.number(),
      submissionCount: v.number(),
      criteriaCount: v.number(),
      completionPercentage: v.number(),
      rankings: v.array(
        v.object({
          storyId: v.id("stories"),
          storyTitle: v.string(),
          storyUrl: v.optional(v.string()),
          totalScore: v.number(),
          averageScore: v.number(),
          scoreCount: v.number(),
        }),
      ),
      criteriaBreakdown: v.array(
        v.object({
          criteriaId: v.id("judgingCriteria"),
          criteriaName: v.string(),
          averageScore: v.number(),
          scoreCount: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    // Check if group exists and results are public
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.resultsIsPublic) {
      return null;
    }

    // Get all scores for this group
    const scores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Get group metadata
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();

    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const totalScores = scores.length;
    const averageScore =
      totalScores > 0
        ? scores.reduce((sum, score) => sum + score.score, 0) / totalScores
        : undefined;

    const judgeCount = judges.length;
    const submissionCount = submissions.length;
    const criteriaCount = criteria.length;
    const expectedScores = judgeCount * submissionCount * criteriaCount;
    const completionPercentage =
      expectedScores > 0 ? (totalScores / expectedScores) * 100 : 0;

    // Calculate story rankings
    const storyScoreMap = new Map<
      string,
      { totalScore: number; count: number }
    >();
    scores.forEach((score) => {
      const key = score.storyId;
      const existing = storyScoreMap.get(key) || { totalScore: 0, count: 0 };
      storyScoreMap.set(key, {
        totalScore: existing.totalScore + score.score,
        count: existing.count + 1,
      });
    });

    const rankings = await Promise.all(
      Array.from(storyScoreMap.entries()).map(async ([storyId, data]) => {
        const story = await ctx.db.get(storyId as Id<"stories">);
        return {
          storyId: storyId as Id<"stories">,
          storyTitle: story?.title || "Unknown Story",
          storyUrl: story?.url,
          totalScore: data.totalScore,
          averageScore: data.count > 0 ? data.totalScore / data.count : 0,
          scoreCount: data.count,
        };
      }),
    );

    rankings.sort((a, b) => b.averageScore - a.averageScore);

    // Calculate criteria breakdown
    const criteriaScoreMap = new Map<
      string,
      { totalScore: number; count: number }
    >();
    scores.forEach((score) => {
      const key = score.criteriaId;
      const existing = criteriaScoreMap.get(key) || { totalScore: 0, count: 0 };
      criteriaScoreMap.set(key, {
        totalScore: existing.totalScore + score.score,
        count: existing.count + 1,
      });
    });

    const criteriaBreakdown = await Promise.all(
      Array.from(criteriaScoreMap.entries()).map(async ([criteriaId, data]) => {
        const criterion = await ctx.db.get(criteriaId as Id<"judgingCriteria">);
        return {
          criteriaId: criteriaId as Id<"judgingCriteria">,
          criteriaName: criterion?.question || "Unknown Criteria",
          averageScore: data.count > 0 ? data.totalScore / data.count : 0,
          scoreCount: data.count,
        };
      }),
    );

    return {
      totalScores,
      averageScore,
      judgeCount,
      submissionCount,
      criteriaCount,
      completionPercentage,
      rankings,
      criteriaBreakdown,
    };
  },
});

/**
 * Get judge details for public results viewing (no admin required)
 */
export const getPublicGroupJudgeDetails = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        judgeName: v.string(),
        judgeEmail: v.optional(v.string()),
        lastActive: v.optional(v.number()),
        scores: v.array(
          v.object({
            storyId: v.id("stories"),
            storyTitle: v.string(),
            criteriaId: v.id("judgingCriteria"),
            criteriaName: v.string(),
            score: v.number(),
            comments: v.optional(v.string()),
            submittedAt: v.number(),
          }),
        ),
        totalScore: v.number(),
        averageScore: v.number(),
        scoreCount: v.number(),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    // Check if group exists and results are public
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.resultsIsPublic) {
      return null;
    }

    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const result = await Promise.all(
      judges.map(async (judge) => {
        // Get all scores for this group and filter by judgeId
        const allGroupScores = await ctx.db
          .query("judgeScores")
          .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
          .collect();

        const scores = allGroupScores.filter(
          (score) => score.judgeId === judge._id,
        );

        const enrichedScores = await Promise.all(
          scores.map(async (score) => {
            const story = await ctx.db.get(score.storyId);
            const criteria = await ctx.db.get(score.criteriaId);
            return {
              storyId: score.storyId,
              storyTitle: story?.title || "Unknown Story",
              criteriaId: score.criteriaId,
              criteriaName: criteria?.question || "Unknown Criteria",
              score: score.score,
              comments: score.comments,
              submittedAt: score._creationTime,
            };
          }),
        );

        const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
        const averageScore = scores.length > 0 ? totalScore / scores.length : 0;

        return {
          judgeName: judge.name,
          judgeEmail: judge.email,
          lastActive: judge.lastActiveAt,
          scores: enrichedScores,
          totalScore,
          averageScore,
          scoreCount: scores.length,
        };
      }),
    );

    return result.sort((a, b) => b.totalScore - a.totalScore);
  },
});

/**
 * Export scores data for download (admin only)
 */
export const exportScores = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({
    groupName: v.string(),
    exportTimestamp: v.number(),
    data: v.array(
      v.object({
        storyId: v.string(),
        storyTitle: v.string(),
        storySlug: v.string(),
        storyUrl: v.string(),
        judgeId: v.string(),
        judgeName: v.string(),
        criteriaId: v.string(),
        criteriaQuestion: v.string(),
        score: v.number(),
        comments: v.optional(v.string()),
        scoreTimestamp: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get group details
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    // Get all scores for this group
    const scores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Enrich each score with full details
    const exportData = await Promise.all(
      scores.map(async (score) => {
        const [story, judge, criteria] = await Promise.all([
          ctx.db.get(score.storyId),
          ctx.db.get(score.judgeId),
          ctx.db.get(score.criteriaId),
        ]);

        if (!story || !judge || !criteria) {
          throw new Error("Missing related data for score export");
        }

        return {
          storyId: story._id,
          storyTitle: story.title,
          storySlug: story.slug,
          storyUrl: story.url,
          judgeId: judge._id,
          judgeName: judge.name,
          criteriaId: criteria._id,
          criteriaQuestion: criteria.question,
          score: score.score,
          comments: score.comments,
          scoreTimestamp: score._creationTime,
        };
      }),
    );

    return {
      groupName: group.name,
      exportTimestamp: Date.now(),
      data: exportData,
    };
  },
});
