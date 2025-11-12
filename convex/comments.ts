import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import {
  getAuthenticatedUserId,
  requireAdminRole,
  ensureUserNotBanned,
} from "./users"; // Import the centralized helper and requireAdminRole
import { internal } from "./_generated/api";

// We might not need this specific type if we don't enhance comments further yet
// export type CommentWithDetails = Doc<"comments"> & {
//   // Add any details needed in the future, like author info if users table exists
// };

// Helper function to get the Convex user ID of the authenticated user
// REMOVED - Now imported from convex/users.ts
// async function getAuthenticatedUserId(ctx: MutationCtx | QueryCtx): Promise<Id<"users">> {
//  ... implementation ...
// }

// Define a validator for the comment structure including author details
const commentWithAuthorValidator = v.object({
  // fields from Doc<"comments">
  _id: v.id("comments"),
  _creationTime: v.number(),
  content: v.string(),
  userId: v.id("users"),
  storyId: v.id("stories"),
  parentId: v.optional(v.id("comments")),
  votes: v.number(),
  status: v.string(), // Assuming status is a string based on previous usage
  isHidden: v.optional(v.boolean()),
  // Added author details
  authorName: v.optional(v.string()),
  authorUsername: v.optional(v.string()),
});

// Query to list APPROVED comments for a specific story, now with author details
export const listApprovedByStory = query({
  args: { storyId: v.id("stories") },
  returns: v.array(commentWithAuthorValidator), // Use the new validator
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<Doc<"comments"> & { authorName?: string; authorUsername?: string }>
  > => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) =>
        q.eq("storyId", args.storyId).eq("status", "approved"),
      )
      .filter((q) => q.neq(q.field("isHidden"), true))
      .order("asc")
      .collect();

    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        const author = comment.userId ? await ctx.db.get(comment.userId) : null;
        return {
          ...comment,
          authorName: author?.name,
          authorUsername: author?.username,
        };
      }),
    );
    return commentsWithAuthors;
  },
});

// Query to list PENDING comments for a specific story (for admin)
export const listPendingByStory = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args): Promise<Doc<"comments">[]> => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) =>
        q.eq("storyId", args.storyId).eq("status", "pending"),
      )
      .order("asc")
      .collect();
    return comments;
  },
});

// Query to list ALL comments for admin, with filtering
export const listAllCommentsAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filters: v.object({
      storyId: v.optional(v.id("stories")), // Optional filter by story
      status: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
      ),
      isHidden: v.optional(v.boolean()),
      startDate: v.optional(v.number()), // Timestamp for date range start
      endDate: v.optional(v.number()), // Timestamp for date range end
    }),
    searchTerm: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    page: Array<
      Doc<"comments"> & { authorName?: string; authorUsername?: string }
    >;
    isDone: boolean;
    continueCursor: string;
  }> => {
    await requireAdminRole(ctx);
    let queryBuilder;
    if (args.searchTerm && args.searchTerm.trim() !== "") {
      // Use full text search
      queryBuilder = ctx.db
        .query("comments")
        .withSearchIndex("search_content", (q) => {
          let builder = q.search("content", args.searchTerm!);
          if (args.filters.status) {
            builder = builder.eq("status", args.filters.status);
          }
          if (args.filters.isHidden !== undefined) {
            builder = builder.eq("isHidden", args.filters.isHidden);
          }
          return builder;
        });
      // Do NOT call .order() on search index queries
      // Execute pagination directly
      const paginatedComments = await queryBuilder.paginate(
        args.paginationOpts,
      );

      // Apply date range filtering if specified
      let filteredComments = paginatedComments.page;
      if (
        args.filters.startDate !== undefined ||
        args.filters.endDate !== undefined
      ) {
        filteredComments = filteredComments.filter((comment) => {
          if (
            args.filters.startDate !== undefined &&
            comment._creationTime < args.filters.startDate
          ) {
            return false;
          }
          if (
            args.filters.endDate !== undefined &&
            comment._creationTime > args.filters.endDate
          ) {
            return false;
          }
          return true;
        });
      }

      // Enrich with author information
      const commentsWithAuthors = await Promise.all(
        filteredComments.map(async (comment) => {
          const author = comment.userId
            ? await ctx.db.get(comment.userId)
            : null;
          return {
            ...comment,
            authorName: author?.name,
            authorUsername: author?.username,
          };
        }),
      );

      return {
        page: commentsWithAuthors,
        isDone: paginatedComments.isDone,
        continueCursor: paginatedComments.continueCursor,
      };
    } else {
      // Fallback to previous logic
      if (
        args.filters.storyId &&
        args.filters.isHidden !== undefined &&
        args.filters.status
      ) {
        queryBuilder = ctx.db
          .query("comments")
          .withIndex("by_hidden_status", (q) =>
            q
              .eq("storyId", args.filters.storyId!)
              .eq("isHidden", args.filters.isHidden!)
              .eq("status", args.filters.status!),
          );
      } else if (args.filters.storyId && args.filters.status) {
        queryBuilder = ctx.db
          .query("comments")
          .withIndex("by_storyId_status", (q) =>
            q
              .eq("storyId", args.filters.storyId!)
              .eq("status", args.filters.status!),
          );
      } else if (args.filters.isHidden !== undefined && args.filters.status) {
        queryBuilder = ctx.db
          .query("comments")
          .filter((q) =>
            q.and(
              q.eq(q.field("isHidden"), args.filters.isHidden),
              q.eq(q.field("status"), args.filters.status),
            ),
          );
      } else if (args.filters.storyId) {
        queryBuilder = ctx.db
          .query("comments")
          .withIndex("by_storyId_status", (q) =>
            q.eq("storyId", args.filters.storyId!),
          );
      } else if (args.filters.status) {
        queryBuilder = ctx.db
          .query("comments")
          .filter((q) => q.eq(q.field("status"), args.filters.status));
      } else if (args.filters.isHidden !== undefined) {
        queryBuilder = ctx.db
          .query("comments")
          .filter((q) => q.eq(q.field("isHidden"), args.filters.isHidden));
      } else {
        queryBuilder = ctx.db.query("comments");
      }
      // Apply default ordering for non-search queries
      const orderedQuery = queryBuilder.order("desc"); // Default order: newest first
      // Execute pagination
      const paginatedComments = await orderedQuery.paginate(
        args.paginationOpts,
      );

      // Apply date range filtering if specified
      let filteredComments = paginatedComments.page;
      if (
        args.filters.startDate !== undefined ||
        args.filters.endDate !== undefined
      ) {
        filteredComments = filteredComments.filter((comment) => {
          if (
            args.filters.startDate !== undefined &&
            comment._creationTime < args.filters.startDate
          ) {
            return false;
          }
          if (
            args.filters.endDate !== undefined &&
            comment._creationTime > args.filters.endDate
          ) {
            return false;
          }
          return true;
        });
      }

      // Enrich with author information
      const commentsWithAuthors = await Promise.all(
        filteredComments.map(async (comment) => {
          const author = comment.userId
            ? await ctx.db.get(comment.userId)
            : null;
          return {
            ...comment,
            authorName: author?.name,
            authorUsername: author?.username,
          };
        }),
      );

      return {
        page: commentsWithAuthors,
        isDone: paginatedComments.isDone,
        continueCursor: paginatedComments.continueCursor,
      };
    }
  },
});

// Mutation to add a new comment or reply - Fixed: Minimized read window before writes
export const add = mutation({
  args: {
    storyId: v.id("stories"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    await ensureUserNotBanned(ctx);
    const userId = await getAuthenticatedUserId(ctx);
    
    // Validate story exists and get parent comment if needed (read operations first)
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    let parentComment = null;
    if (args.parentId) {
      parentComment = await ctx.db.get(args.parentId);
      if (!parentComment || parentComment.storyId !== args.storyId) {
        throw new Error(
          "Parent comment not found or doesn't belong to this story",
        );
      }
    }

    // All validation complete - now perform writes
    const commentId = await ctx.db.insert("comments", {
      storyId: args.storyId,
      content: args.content,
      userId: userId,
      parentId: args.parentId,
      votes: 0,
      status: "approved",
    });

    // Increment comment count using previously read value
    await ctx.db.patch(args.storyId, {
      commentCount: (story.commentCount || 0) + 1,
    });

    // Create alert for story owner (non-blocking)
    if (story.userId) {
      await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
        recipientUserId: story.userId,
        actorUserId: userId,
        type: "comment",
        storyId: args.storyId,
        commentId: commentId,
      });
    }

    // If this is a reply, alert the original comment author (non-blocking)
    if (parentComment && parentComment.userId && parentComment.userId !== userId) {
      await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
        recipientUserId: parentComment.userId,
        actorUserId: userId,
        type: "reply",
        storyId: args.storyId,
        commentId: commentId,
      });
    }

    // Process mentions in comment content (non-blocking)
    try {
      const handles = await ctx.runQuery(internal.mentions.extractHandles, {
        text: args.content,
      });

      if (handles.length > 0) {
        const resolvedTargets = await ctx.runQuery(
          internal.mentions.resolveHandlesToUsers,
          { handles },
        );

        if (resolvedTargets.length > 0) {
          const contentExcerpt = args.content.slice(0, 240);
          const date = new Date().toISOString().split("T")[0];

          await ctx.runMutation(internal.mentions.recordMentions, {
            actorUserId: userId,
            resolvedTargets,
            context: "comment",
            sourceId: commentId,
            storyId: args.storyId,
            groupId: undefined,
            contentExcerpt,
            date,
          });

          // Create alerts for mentioned users (non-blocking)
          for (const target of resolvedTargets) {
            if (target.userId !== userId) {
              await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
                recipientUserId: target.userId,
                actorUserId: userId,
                type: "mention",
                storyId: args.storyId,
                commentId: commentId,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing mentions in comment:", error);
    }
  },
});

// New mutation for updating comment status (moderation)
export const updateStatus = mutation({
  args: {
    commentId: v.id("comments"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // TODO: Adjust story.commentCount if changing status affects the count?
    // If count should only be approved comments, decrement if rejecting, increment if approving.
    // const story = await ctx.db.get(comment.storyId);
    // if (story) {
    //     let change = 0;
    //     if (args.status === 'approved' && comment.status !== 'approved') change = 1;
    //     else if (args.status === 'rejected' && comment.status === 'approved') change = -1;
    //     if (change !== 0) {
    //         await ctx.db.patch(story._id, { commentCount: (story.commentCount || 0) + change });
    //     }
    // }

    await ctx.db.patch(args.commentId, { status: args.status });
  },
});

// --- New Moderation Mutations ---

// Mutation to hide a comment
export const hideComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }
    await ctx.db.patch(args.commentId, { isHidden: true });
  },
});

// Mutation to show a hidden comment
export const showComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }
    await ctx.db.patch(args.commentId, { isHidden: false });
  },
});

// Mutation to permanently delete a comment - Fixed: Minimized read window
export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      console.warn(`Comment ${args.commentId} not found for deletion.`);
      return;
    }
    // Delete immediately after reading
    await ctx.db.delete(args.commentId);
    // TODO: Consider decrementing story.commentCount if needed
  },
});

// Mutation for a user to delete their own comment - Fixed: Reduced read operations
export const deleteOwnComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const comment = await ctx.db.get(args.commentId);

    if (!comment) {
      throw new Error("Comment not found.");
    }

    if (comment.userId !== userId) {
      throw new Error(
        "User not authorized to delete this comment. Only the owner can delete.",
      );
    }

    // Check for replies before deletion
    const replies = await ctx.db
      .query("comments")
      .filter((q) => q.eq(q.field("parentId"), args.commentId))
      .collect();
    
    if (replies.length > 0) {
      // For now, allow deletion and replies will be orphaned
      // Alternative: throw new Error("Cannot delete comment with replies");
    }

    // Get story for comment count update
    const story = await ctx.db.get(comment.storyId);
    
    // Perform deletes
    await ctx.db.delete(args.commentId);
    
    // Update story comment count if story exists and comment was approved
    if (story && comment.status === "approved") {
      await ctx.db.patch(story._id, {
        commentCount: Math.max(0, (story.commentCount || 0) - 1),
      });
    }

    return { success: true };
  },
});
