import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users";

// --- Admin Functions ---

/**
 * Add submissions to a judging group
 */
export const addSubmissions = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    storyIds: v.array(v.id("stories")),
  },
  returns: v.object({
    added: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found in database");
    }

    // Verify the group exists
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const storyId of args.storyIds) {
      try {
        // Check if story exists
        const story = await ctx.db.get(storyId);
        if (!story) {
          errors.push(`Story ${storyId} not found`);
          continue;
        }

        // Check if already in group
        const existing = await ctx.db
          .query("judgingGroupSubmissions")
          .withIndex("by_groupId_storyId", (q) =>
            q.eq("groupId", args.groupId).eq("storyId", storyId),
          )
          .unique();

        if (existing) {
          skipped++;
          continue;
        }

        // Add to group
        await ctx.db.insert("judgingGroupSubmissions", {
          groupId: args.groupId,
          storyId,
          addedBy: user._id,
          addedAt: Date.now(),
        });

        added++;
      } catch (error) {
        errors.push(
          `Error adding story ${storyId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return { added, skipped, errors };
  },
});

/**
 * Remove a submission from a judging group
 */
export const removeSubmission = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Find and delete the group submission
    const submission = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();

    if (!submission) {
      throw new Error("Submission not found in judging group");
    }

    // Delete all associated scores first
    const scores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .collect();

    for (const score of scores) {
      await ctx.db.delete(score._id);
    }

    // Delete the submission
    await ctx.db.delete(submission._id);

    return null;
  },
});

/**
 * Get submissions in a group with scoring details
 */
export const listByGroup = query({
  args: {
    groupId: v.id("judgingGroups"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("judgingGroupSubmissions"),
      _creationTime: v.number(),
      groupId: v.id("judgingGroups"),
      storyId: v.id("stories"),
      addedBy: v.id("users"),
      addedAt: v.number(),
      // Story details
      story: v.object({
        _id: v.id("stories"),
        title: v.string(),
        slug: v.string(),
        description: v.string(),
        url: v.string(),
        submitterName: v.optional(v.string()),
        screenshotId: v.optional(v.id("_storage")),
        votes: v.number(),
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
      }),
      // Scoring summary
      scoringSummary: v.object({
        totalScores: v.number(),
        averageScore: v.optional(v.number()),
        judgeCount: v.number(),
        maxPossibleScore: v.number(),
        completionPercentage: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const limit = args.limit || 50;

    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .take(limit);

    // Get criteria count for this group
    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();
    const criteriaCount = criteria.length;

    // Get total number of judges for this group
    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const judgeCount = judges.length;

    const enrichedSubmissions = await Promise.all(
      submissions.map(async (submission) => {
        // Get story details
        const story = await ctx.db.get(submission.storyId);
        if (!story) {
          throw new Error(`Story ${submission.storyId} not found`);
        }

        // Get scores for this submission
        const scores = await ctx.db
          .query("judgeScores")
          .withIndex("by_groupId_storyId", (q) =>
            q.eq("groupId", args.groupId).eq("storyId", submission.storyId),
          )
          .collect();

        // Calculate scoring summary
        const totalScores = scores.reduce((sum, score) => sum + score.score, 0);
        const averageScore =
          scores.length > 0 ? totalScores / scores.length : undefined;
        const uniqueJudges = new Set(scores.map((s) => s.judgeId)).size;
        const maxPossibleScore = criteriaCount * 5 * judgeCount; // 5 is max score per criteria
        const expectedScoreCount = criteriaCount * judgeCount;
        const completionPercentage =
          expectedScoreCount > 0
            ? (scores.length / expectedScoreCount) * 100
            : 0;

        return {
          ...submission,
          story: {
            _id: story._id,
            title: story.title,
            slug: story.slug,
            description: story.description,
            url: story.url,
            submitterName: story.submitterName,
            screenshotId: story.screenshotId,
            votes: story.votes,
            status: story.status,
          },
          scoringSummary: {
            totalScores,
            averageScore,
            judgeCount: uniqueJudges,
            maxPossibleScore,
            completionPercentage,
          },
        };
      }),
    );

    return enrichedSubmissions;
  },
});

/**
 * Get available submissions that can be added to a group
 */
export const getAvailableSubmissions = query({
  args: {
    groupId: v.id("judgingGroups"),
    searchTerm: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      url: v.string(),
      submitterName: v.optional(v.string()),
      votes: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const limit = args.limit || 20;

    // Get submissions already in the group
    const existingSubmissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const existingStoryIds = new Set(existingSubmissions.map((s) => s.storyId));

    // Get available stories
    let allStories;
    if (args.searchTerm) {
      allStories = await ctx.db
        .query("stories")
        .withSearchIndex("search_all", (q) =>
          q.search("title", args.searchTerm!),
        )
        .take(limit * 2);
    } else {
      allStories = await ctx.db
        .query("stories")
        .order("desc")
        .take(limit * 2);
    }

    // Filter out already added submissions and limit results
    const availableStories = allStories
      .filter((story) => !existingStoryIds.has(story._id))
      .slice(0, limit);

    return availableStories.map((story) => ({
      _id: story._id,
      title: story.title,
      slug: story.slug,
      description: story.description,
      url: story.url,
      submitterName: story.submitterName,
      votes: story.votes,
      status: story.status,
      _creationTime: story._creationTime,
    }));
  },
});

/**
 * Get judging groups that a story belongs to (for admin use)
 */
export const getStoryJudgingGroups = query({
  args: { storyId: v.id("stories") },
  returns: v.array(
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      isActive: v.boolean(),
      isPublic: v.boolean(),
      addedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get all group submissions for this story
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_storyId", (q) => q.eq("storyId", args.storyId))
      .collect();

    // Get group details for each submission
    const groups = await Promise.all(
      submissions.map(async (submission) => {
        const group = await ctx.db.get(submission.groupId);
        if (!group) {
          throw new Error(`Group ${submission.groupId} not found`);
        }

        return {
          _id: group._id,
          name: group.name,
          slug: group.slug,
          isActive: group.isActive,
          isPublic: group.isPublic,
          addedAt: submission.addedAt,
        };
      }),
    );

    // Sort by most recently added
    return groups.sort((a, b) => b.addedAt - a.addedAt);
  },
});

// --- Public Functions (for judges) ---

/**
 * Get submissions for a judging group (public access for judges)
 */
export const getGroupSubmissions = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      _id: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      url: v.string(),
      screenshotId: v.optional(v.id("_storage")),
      screenshotUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      longDescription: v.optional(v.string()),
      votes: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // No admin check - this is public for judges

    // Verify the group exists and is accessible
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.isActive) {
      throw new Error("Judging group not found or inactive");
    }

    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const stories = await Promise.all(
      submissions.map(async (submission) => {
        const story = await ctx.db.get(submission.storyId);
        if (!story) {
          throw new Error(`Story ${submission.storyId} not found`);
        }

        // Resolve screenshot URL if screenshot exists
        const screenshotUrl = story.screenshotId
          ? (await ctx.storage.getUrl(story.screenshotId)) || undefined
          : undefined;

        return {
          _id: story._id,
          title: story.title,
          slug: story.slug,
          description: story.description,
          url: story.url,
          screenshotId: story.screenshotId,
          screenshotUrl: screenshotUrl,
          videoUrl: story.videoUrl,
          longDescription: story.longDescription,
          votes: story.votes,
        };
      }),
    );

    return stories;
  },
});
