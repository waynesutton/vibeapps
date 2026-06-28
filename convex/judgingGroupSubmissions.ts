import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole, getAuthenticatedUserId } from "./users";
import { internal } from "./_generated/api";

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

// --- Shared inclusion helpers (reused by submission form, tag sync, admin add) ---

/**
 * Idempotently include a story in a judging group.
 * Inserts the join row and a pending submission status only when missing so the
 * submission shows up to be judged and is counted, working with all judging
 * features (scoring, multi-judge completions, status tracking).
 * Returns true if it was newly added, false if it already existed.
 */
export async function ensureStoryInGroup(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
  storyId: Id<"stories">,
  addedBy: Id<"users">,
): Promise<boolean> {
  const existing = await ctx.db
    .query("judgingGroupSubmissions")
    .withIndex("by_groupId_storyId", (q) =>
      q.eq("groupId", groupId).eq("storyId", storyId),
    )
    .unique();

  if (existing) {
    return false;
  }

  await ctx.db.insert("judgingGroupSubmissions", {
    groupId,
    storyId,
    addedBy,
    addedAt: Date.now(),
  });

  // Create the default pending status only if missing (defensive against drift)
  const existingStatus = await ctx.db
    .query("submissionStatuses")
    .withIndex("by_groupId_storyId", (q) =>
      q.eq("groupId", groupId).eq("storyId", storyId),
    )
    .unique();

  if (!existingStatus) {
    await ctx.db.insert("submissionStatuses", {
      groupId,
      storyId,
      status: "pending",
      lastUpdatedAt: Date.now(),
    });
  }

  return true;
}

/**
 * When a story's tags change, auto-include it in any judging group whose
 * required submission tag is now present on the story. This mirrors the custom
 * submission page behavior: a submission only needs the required tag to be
 * judged and counted, regardless of how it was created or edited.
 * Returns the number of groups the story was newly added to.
 */
export async function syncStoryToTaggedGroups(
  ctx: MutationCtx,
  storyId: Id<"stories">,
  addedBy: Id<"users">,
): Promise<number> {
  const story = await ctx.db.get(storyId);
  if (!isStoryValidForJudging(story)) {
    return 0;
  }

  const tagIds = story.tagIds || [];
  if (tagIds.length === 0) {
    return 0;
  }

  // Groups are few; scanning is cheap. Match on the configured required tag.
  const groups = await ctx.db.query("judgingGroups").collect();
  let added = 0;

  for (const group of groups) {
    const requiredTagId = group.submissionFormRequiredTagId;
    if (!requiredTagId) continue;
    if (!tagIds.includes(requiredTagId)) continue;

    const didAdd = await ensureStoryInGroup(ctx, group._id, storyId, addedBy);
    if (didAdd) added++;
  }

  return added;
}

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

        // Add to group + create default pending status via shared helper
        await ensureStoryInGroup(ctx, args.groupId, storyId, user._id);

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
 * Backfill submissions by required tag.
 * Scans all stories and includes every valid story that carries the group's
 * configured required tag, even if it was not submitted through the custom
 * submission form. Idempotent and safe to run repeatedly (e.g. after deploy).
 */
export const syncRequiredTagSubmissions = mutation({
  args: {
    groupId: v.id("judgingGroups"),
  },
  returns: v.object({
    added: v.number(),
    alreadyPresent: v.number(),
    requiredTagSet: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const addedBy = await getAuthenticatedUserId(ctx);

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    const requiredTagId = group.submissionFormRequiredTagId;
    if (!requiredTagId) {
      return { added: 0, alreadyPresent: 0, requiredTagSet: false };
    }

    const stories = await ctx.db.query("stories").collect();
    let added = 0;
    let alreadyPresent = 0;

    for (const story of stories) {
      if (!isStoryValidForJudging(story)) continue;
      if (!(story.tagIds || []).includes(requiredTagId)) continue;

      const didAdd = await ensureStoryInGroup(
        ctx,
        args.groupId,
        story._id,
        addedBy,
      );
      if (didAdd) {
        added++;
      } else {
        alreadyPresent++;
      }
    }

    return { added, alreadyPresent, requiredTagSet: true };
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

    // Delete submission status
    const submissionStatus = await ctx.db
      .query("submissionStatuses")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();

    if (submissionStatus) {
      await ctx.db.delete(submissionStatus._id);
    }

    // Delete all associated notes
    const notes = await ctx.db
      .query("submissionNotes")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .collect();

    for (const note of notes) {
      await ctx.db.delete(note._id);
    }

    // Delete multi-judge completion records
    const completions = await ctx.db
      .query("submissionJudgeCompletions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .collect();

    for (const completion of completions) {
      await ctx.db.delete(completion._id);
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

    const enrichedSubmissions = (
      await Promise.all(
        submissions.map(async (submission) => {
          // Get story details
          const story = await ctx.db.get(submission.storyId);
          // Skip if story is deleted, hidden, archived, or rejected
          if (!isStoryValidForJudging(story)) {
            return null;
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
        const maxPossibleScore = criteriaCount * 10 * judgeCount; // 10 is max score per criteria

        // Check if this submission is marked as completed
        const submissionStatus = await ctx.db
          .query("submissionStatuses")
          .withIndex("by_groupId_storyId", (q) =>
            q.eq("groupId", args.groupId).eq("storyId", submission.storyId),
          )
          .unique();

        const completionPercentage =
          submissionStatus?.status === "completed" ? 100 : 0;

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
      )
    ).filter((submission): submission is NonNullable<typeof submission> => submission !== null);

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
      _creationTime: v.number(),
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      url: v.string(),
      screenshotId: v.optional(v.id("_storage")),
      screenshotUrl: v.optional(v.string()),
      additionalImageUrls: v.array(v.string()),
      videoUrl: v.optional(v.string()),
      longDescription: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      twitterUrl: v.optional(v.string()),
      githubUrl: v.optional(v.string()),
      chefShowUrl: v.optional(v.string()),
      chefAppUrl: v.optional(v.string()),
      votes: v.number(),
      // Tags
      tagIds: v.optional(v.array(v.id("tags"))),
      tags: v.optional(
        v.array(
          v.object({
            _id: v.id("tags"),
            _creationTime: v.number(),
            name: v.string(),
            slug: v.string(),
            showInHeader: v.boolean(),
            isHidden: v.optional(v.boolean()),
            backgroundColor: v.optional(v.string()),
            textColor: v.optional(v.string()),
            borderColor: v.optional(v.string()),
            emoji: v.optional(v.string()),
            iconUrl: v.optional(v.string()),
          }),
        ),
      ),
      // Hackathon team info
      teamName: v.optional(v.string()),
      teamMemberCount: v.optional(v.number()),
      teamMembers: v.optional(
        v.array(
          v.object({
            name: v.string(),
            email: v.string(),
          }),
        ),
      ),
      // Changelog tracking for user edits
      changeLog: v.optional(
        v.array(
          v.object({
            timestamp: v.number(),
            textChanges: v.optional(
              v.array(
                v.object({
                  field: v.string(),
                  oldValue: v.string(),
                  newValue: v.string(),
                }),
              ),
            ),
            linkChanges: v.optional(
              v.array(
                v.object({
                  field: v.string(),
                  oldValue: v.optional(v.string()),
                  newValue: v.optional(v.string()),
                }),
              ),
            ),
            tagChanges: v.optional(
              v.object({
                added: v.array(v.string()),
                removed: v.array(v.string()),
              }),
            ),
            videoChanged: v.optional(v.boolean()),
            imagesChanged: v.optional(v.boolean()),
          }),
        ),
      ),
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

    const stories = (
      await Promise.all(
        submissions.map(async (submission) => {
          const story = await ctx.db.get(submission.storyId);
          // Skip if story is deleted, hidden, archived, or rejected
          if (!isStoryValidForJudging(story)) {
            return null;
          }

          // Resolve screenshot URL if screenshot exists
          const screenshotUrl = story.screenshotId
            ? (await ctx.storage.getUrl(story.screenshotId)) || undefined
            : undefined;

          // Resolve additional image URLs
          const additionalImageUrls = story.additionalImageIds
            ? await Promise.all(
                story.additionalImageIds.map(async (imageId) => {
                  const url = await ctx.storage.getUrl(imageId);
                  return url || "";
                }),
              ).then((urls) => urls.filter((url) => url !== ""))
            : [];

          // Resolve tags
          const resolvedTags = story.tagIds
            ? await Promise.all(
                story.tagIds.map(async (tagId) => {
                  const tag = await ctx.db.get(tagId);
                  if (!tag) return null;
                  return {
                    _id: tag._id,
                    _creationTime: tag._creationTime,
                    name: tag.name,
                    slug: tag.slug || "",
                    showInHeader: tag.showInHeader,
                    isHidden: tag.isHidden,
                    backgroundColor: tag.backgroundColor,
                    textColor: tag.textColor,
                    borderColor: tag.borderColor,
                    emoji: tag.emoji,
                    iconUrl: tag.iconUrl,
                  };
                }),
              ).then((tags) => tags.filter((tag) => tag !== null))
            : [];

          return {
            _id: story._id,
            _creationTime: story._creationTime,
            title: story.title,
            slug: story.slug,
            description: story.description,
            url: story.url,
            screenshotId: story.screenshotId,
            screenshotUrl: screenshotUrl,
            additionalImageUrls: additionalImageUrls,
            videoUrl: story.videoUrl,
            longDescription: story.longDescription,
            linkedinUrl: story.linkedinUrl,
            twitterUrl: story.twitterUrl,
            githubUrl: story.githubUrl,
            chefShowUrl: story.chefShowUrl,
            chefAppUrl: story.chefAppUrl,
            votes: story.votes,
            // Tags
            tagIds: story.tagIds,
            tags: resolvedTags.length > 0 ? resolvedTags : undefined,
            // Hackathon team info
            teamName: story.teamName,
            teamMemberCount: story.teamMemberCount,
            teamMembers: story.teamMembers,
            // Changelog tracking
            changeLog: story.changeLog,
          };
        }),
      )
    ).filter((story): story is NonNullable<typeof story> => story !== null);

    return stories;
  },
});

// --- Submission Status Management ---

/**
 * Update submission status (for judges)
 */
export const updateSubmissionStatus = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("skip"),
    ),
    judgeId: v.id("judges"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verify the judge exists and belongs to the group
    const judge = await ctx.db.get(args.judgeId);
    if (!judge || judge.groupId !== args.groupId) {
      throw new Error("Judge not found or not in this group");
    }

    // Find existing status
    const existingStatus = await ctx.db
      .query("submissionStatuses")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();

    if (!existingStatus) {
      throw new Error("Submission status not found");
    }

    // Update the status
    await ctx.db.patch(existingStatus._id, {
      status: args.status,
      assignedJudgeId: args.status === "completed" ? args.judgeId : undefined,
      lastUpdatedBy: args.judgeId,
      lastUpdatedAt: Date.now(),
    });

    // Create alert for story owner when marked as completed (non-blocking)
    if (args.status === "completed") {
      const story = await ctx.db.get(args.storyId);
      if (story && story.userId) {
        await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
          recipientUserId: story.userId,
          actorUserId: undefined, // No judge identity per PRD
          type: "judged",
          storyId: args.storyId,
        });
      }
    }

    return null;
  },
});

/**
 * Get submission statuses for a judging group (with judge information)
 */
export const getSubmissionStatuses = query({
  args: {
    groupId: v.id("judgingGroups"),
  },
  returns: v.array(
    v.object({
      _id: v.id("submissionStatuses"),
      storyId: v.id("stories"),
      storyTitle: v.string(),
      storySlug: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("skip"),
      ),
      assignedJudgeName: v.optional(v.string()),
      lastUpdatedByName: v.optional(v.string()),
      lastUpdatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Get all submission statuses for the group
    const statuses = await ctx.db
      .query("submissionStatuses")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Enrich with story and judge information
    const enrichedStatuses = (
      await Promise.all(
        statuses.map(async (status) => {
          const story = await ctx.db.get(status.storyId);
          // Skip if story is deleted, hidden, archived, or rejected
          if (!isStoryValidForJudging(story)) {
            return null;
          }

          let assignedJudgeName: string | undefined;
          if (status.assignedJudgeId) {
            const assignedJudge = await ctx.db.get(status.assignedJudgeId);
            assignedJudgeName = assignedJudge?.name;
          }

          let lastUpdatedByName: string | undefined;
          if (status.lastUpdatedBy) {
            const lastUpdatedJudge = await ctx.db.get(status.lastUpdatedBy);
            lastUpdatedByName = lastUpdatedJudge?.name;
          }

          return {
            _id: status._id,
            storyId: status.storyId,
            storyTitle: story.title,
            storySlug: story.slug,
            status: status.status,
            assignedJudgeName,
            lastUpdatedByName,
            lastUpdatedAt: status.lastUpdatedAt,
          };
        }),
      )
    ).filter((status): status is NonNullable<typeof status> => status !== null);

    return enrichedStatuses;
  },
});

/**
 * Get submission status for a specific submission and judge
 */
export const getSubmissionStatusForJudge = query({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
    judgeId: v.id("judges"),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("skip"),
      ),
      canJudge: v.boolean(),
      assignedJudgeName: v.optional(v.string()),
      completionCount: v.optional(v.number()),
      judgesPerSubmission: v.optional(v.number()),
      thisJudgeCompleted: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const judge = await ctx.db.get(args.judgeId);
    if (!judge || judge.groupId !== args.groupId) {
      return null;
    }

    const group = await ctx.db.get(args.groupId);
    const judgesPerSubmission = group?.judgesPerSubmission ?? 1;
    const isMultiJudge = judgesPerSubmission > 1;

    const status = await ctx.db
      .query("submissionStatuses")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();

    if (!status) {
      return null;
    }

    if (isMultiJudge) {
      // Multi-judge: check completions table
      const completions = await ctx.db
        .query("submissionJudgeCompletions")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", args.groupId).eq("storyId", args.storyId),
        )
        .collect();

      const completionCount = completions.length;
      const thisJudgeCompleted = completions.some(
        (c) => c.judgeId === args.judgeId,
      );
      const isLocked = completionCount >= judgesPerSubmission;

      // canJudge: true if not locked AND this judge hasn't completed yet
      const canJudge = !isLocked && !thisJudgeCompleted && status.status !== "skip";

      return {
        status: isLocked ? ("completed" as const) : status.status,
        canJudge,
        assignedJudgeName: undefined,
        completionCount,
        judgesPerSubmission,
        thisJudgeCompleted,
      };
    }

    // Single-judge: original logic
    const canJudge = status.status === "pending" || status.status === "skip";

    let assignedJudgeName: string | undefined;
    if (status.assignedJudgeId) {
      const assignedJudge = await ctx.db.get(status.assignedJudgeId);
      assignedJudgeName = assignedJudge?.name;
    }

    return {
      status: status.status,
      canJudge,
      assignedJudgeName,
      completionCount: undefined,
      judgesPerSubmission: undefined,
      thisJudgeCompleted: undefined,
    };
  },
});

/**
 * Mark a submission as completed by this judge in multi-judge mode.
 * Each judge writes their own row to avoid OCC write conflicts.
 * When threshold (judgesPerSubmission) is reached, flips the shared status to "completed".
 */
export const markJudgeCompleted = mutation({
  args: {
    sessionId: v.string(),
    storyId: v.id("stories"),
  },
  returns: v.object({
    alreadyCompleted: v.boolean(),
    isLocked: v.boolean(),
    completionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Resolve judge from session
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!judge) {
      throw new Error("Judge session not found");
    }

    const group = await ctx.db.get(judge.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    const judgesPerSubmission = group.judgesPerSubmission ?? 1;

    // Verify this submission is in the group
    const groupSubmission = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", judge.groupId).eq("storyId", args.storyId),
      )
      .unique();

    if (!groupSubmission) {
      throw new Error("Submission not found in this judging group");
    }

    // Idempotent: check if this judge already completed
    const existing = await ctx.db
      .query("submissionJudgeCompletions")
      .withIndex("by_group_story_judge", (q) =>
        q
          .eq("groupId", judge.groupId)
          .eq("storyId", args.storyId)
          .eq("judgeId", judge._id),
      )
      .unique();

    if (existing) {
      // Already completed by this judge; count current completions
      const allCompletions = await ctx.db
        .query("submissionJudgeCompletions")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", judge.groupId).eq("storyId", args.storyId),
        )
        .collect();

      return {
        alreadyCompleted: true,
        isLocked: allCompletions.length >= judgesPerSubmission,
        completionCount: allCompletions.length,
      };
    }

    // Insert this judge's completion row
    await ctx.db.insert("submissionJudgeCompletions", {
      groupId: judge.groupId,
      storyId: args.storyId,
      judgeId: judge._id,
      completedAt: Date.now(),
    });

    // Count total completions after inserting
    const allCompletions = await ctx.db
      .query("submissionJudgeCompletions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", judge.groupId).eq("storyId", args.storyId),
      )
      .collect();

    const completionCount = allCompletions.length;
    const isLocked = completionCount >= judgesPerSubmission;

    // If threshold reached, flip the shared status row to "completed" (single-shot)
    if (isLocked) {
      const existingStatus = await ctx.db
        .query("submissionStatuses")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", judge.groupId).eq("storyId", args.storyId),
        )
        .unique();

      if (existingStatus && existingStatus.status !== "completed") {
        await ctx.db.patch(existingStatus._id, {
          status: "completed",
          lastUpdatedBy: judge._id,
          lastUpdatedAt: Date.now(),
        });

        // Fire alert for story owner
        const story = await ctx.db.get(args.storyId);
        if (story && story.userId) {
          await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
            recipientUserId: story.userId,
            actorUserId: undefined,
            type: "judged",
            storyId: args.storyId,
          });
        }
      }
    }

    return {
      alreadyCompleted: false,
      isLocked,
      completionCount,
    };
  },
});

// --- Submission Notes Management ---

/**
 * Add a note to a submission
 */
export const addSubmissionNote = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
    judgeId: v.id("judges"),
    content: v.string(),
    replyToId: v.optional(v.id("submissionNotes")),
  },
  returns: v.id("submissionNotes"),
  handler: async (ctx, args) => {
    // Verify the judge exists and belongs to the group
    const judge = await ctx.db.get(args.judgeId);
    if (!judge || judge.groupId !== args.groupId) {
      throw new Error("Judge not found or not in this group");
    }

    // If replying to a note, verify it exists
    if (args.replyToId) {
      const parentNote = await ctx.db.get(args.replyToId);
      if (
        !parentNote ||
        parentNote.groupId !== args.groupId ||
        parentNote.storyId !== args.storyId
      ) {
        throw new Error("Parent note not found or invalid");
      }
    }

    // Create the note
    const noteId = await ctx.db.insert("submissionNotes", {
      groupId: args.groupId,
      storyId: args.storyId,
      judgeId: args.judgeId,
      content: args.content.trim(),
      replyToId: args.replyToId,
    });

    // Process mentions in judge note content (non-blocking)
    // Only process mentions if the judge has a linked user account
    if (judge.userId) {
      try {
        // Extract @username handles from content
        const handles = await ctx.runQuery(internal.mentions.extractHandles, {
          text: args.content,
        });

        if (handles.length > 0) {
          // Resolve handles to user documents
          const resolvedTargets = await ctx.runQuery(
            internal.mentions.resolveHandlesToUsers,
            {
              handles,
            },
          );

          if (resolvedTargets.length > 0) {
            // Record mentions with quota enforcement
            const contentExcerpt = args.content.trim().slice(0, 240);
            const date = new Date().toISOString().split("T")[0];

            await ctx.runMutation(internal.mentions.recordMentions, {
              actorUserId: judge.userId,
              resolvedTargets,
              context: "judge_note",
              sourceId: noteId,
              storyId: args.storyId,
              groupId: args.groupId,
              contentExcerpt,
              date,
            });

            // Create alerts for mentioned users (non-blocking)
            for (const target of resolvedTargets) {
              if (target.userId !== judge.userId) {
                await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
                  recipientUserId: target.userId,
                  actorUserId: judge.userId,
                  type: "mention",
                  storyId: args.storyId,
                });
              }
            }

            // Mentions will be included in daily digest emails instead of immediate notifications
          }
        }
      } catch (error) {
        // Log mention processing errors but don't fail the note creation
        console.error("Error processing mentions in judge note:", error);
      }
    }

    return noteId;
  },
});

/**
 * Get threaded notes for a submission
 */
export const getSubmissionNotes = query({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
  },
  returns: v.array(
    v.object({
      _id: v.id("submissionNotes"),
      _creationTime: v.number(),
      content: v.string(),
      judgeName: v.string(),
      replyToId: v.optional(v.id("submissionNotes")),
      replies: v.array(
        v.object({
          _id: v.id("submissionNotes"),
          _creationTime: v.number(),
          content: v.string(),
          judgeName: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    // Get all notes for this submission
    const allNotes = await ctx.db
      .query("submissionNotes")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .order("asc")
      .collect();

    // Enrich with judge names
    const enrichedNotes = await Promise.all(
      allNotes.map(async (note) => {
        const judge = await ctx.db.get(note.judgeId);
        return {
          ...note,
          judgeName: judge?.name || "Unknown Judge",
        };
      }),
    );

    // Organize into threaded structure
    const topLevelNotes = enrichedNotes.filter((note) => !note.replyToId);
    const replyMap = new Map<string, typeof enrichedNotes>();

    // Group replies by parent note ID
    enrichedNotes
      .filter((note) => note.replyToId)
      .forEach((reply) => {
        const parentId = reply.replyToId!;
        if (!replyMap.has(parentId)) {
          replyMap.set(parentId, []);
        }
        replyMap.get(parentId)!.push(reply);
      });

    // Structure the response with replies nested under parent notes
    const threadedNotes = topLevelNotes.map((note) => ({
      _id: note._id,
      _creationTime: note._creationTime,
      content: note.content,
      judgeName: note.judgeName,
      replyToId: note.replyToId,
      replies: (replyMap.get(note._id) || []).map((reply) => ({
        _id: reply._id,
        _creationTime: reply._creationTime,
        content: reply.content,
        judgeName: reply.judgeName,
      })),
    }));

    return threadedNotes;
  },
});

/**
 * Get submission statuses for a specific story across all judging groups it belongs to
 */
export const getStorySubmissionStatuses = query({
  args: {
    storyId: v.id("stories"),
  },
  returns: v.array(
    v.object({
      groupId: v.id("judgingGroups"),
      groupName: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("skip"),
      ),
      assignedJudgeName: v.optional(v.string()),
      lastUpdatedByName: v.optional(v.string()),
      lastUpdatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // First, find all judging groups this story belongs to
    const storySubmissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_storyId", (q) => q.eq("storyId", args.storyId))
      .collect();

    if (storySubmissions.length === 0) {
      return [];
    }

    // Get statuses for each group
    const statusPromises = storySubmissions.map(async (submission) => {
      // Get the group details
      const group = await ctx.db.get(submission.groupId);
      if (!group) {
        return null;
      }

      // Get the submission status
      const status = await ctx.db
        .query("submissionStatuses")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", submission.groupId).eq("storyId", args.storyId),
        )
        .unique();

      if (!status) {
        return null;
      }

      // Get judge names if available
      let assignedJudgeName: string | undefined;
      if (status.assignedJudgeId) {
        const assignedJudge = await ctx.db.get(status.assignedJudgeId);
        assignedJudgeName = assignedJudge?.name;
      }

      let lastUpdatedByName: string | undefined;
      if (status.lastUpdatedBy) {
        const lastUpdatedJudge = await ctx.db.get(status.lastUpdatedBy);
        lastUpdatedByName = lastUpdatedJudge?.name;
      }

      return {
        groupId: submission.groupId,
        groupName: group.name,
        status: status.status,
        assignedJudgeName,
        lastUpdatedByName,
        lastUpdatedAt: status.lastUpdatedAt,
      };
    });

    const results = await Promise.all(statusPromises);
    return results.filter((result) => result !== null);
  },
});
