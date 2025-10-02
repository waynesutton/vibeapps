import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users";
import { internal } from "./_generated/api";

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

        // Create default submission status (Pending)
        await ctx.db.insert("submissionStatuses", {
          groupId: args.groupId,
          storyId,
          status: "pending",
          lastUpdatedAt: Date.now(),
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
          // Skip if story doesn't exist (deleted/archived)
          if (!story) {
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
          // Skip if story doesn't exist (deleted/archived)
          if (!story) {
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
    }),
  ),
  handler: async (ctx, args) => {
    // Verify the judge exists and belongs to the group
    const judge = await ctx.db.get(args.judgeId);
    if (!judge || judge.groupId !== args.groupId) {
      return null;
    }

    // Get submission status
    const status = await ctx.db
      .query("submissionStatuses")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();

    if (!status) {
      return null;
    }

    // Determine if this judge can judge this submission
    // Rules: Can judge if status is "pending" or "skip", but not if "completed"
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
