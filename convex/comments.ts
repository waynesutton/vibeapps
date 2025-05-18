import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedUserId, requireAdminRole, ensureUserNotBanned } from "./users"; // Import the centralized helper and requireAdminRole

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
    args
  ): Promise<Array<Doc<"comments"> & { authorName?: string; authorUsername?: string }>> => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId).eq("status", "approved"))
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
      })
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
      .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId).eq("status", "pending"))
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
        v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
      ),
      isHidden: v.optional(v.boolean()),
    }),
    searchTerm: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ page: Doc<"comments">[]; isDone: boolean; continueCursor: string }> => {
    await requireAdminRole(ctx);
    let queryBuilder;
    if (args.searchTerm && args.searchTerm.trim() !== "") {
      // Use full text search
      queryBuilder = ctx.db.query("comments").withSearchIndex("search_content", (q) => {
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
      const paginatedComments = await queryBuilder.paginate(args.paginationOpts);
      return paginatedComments;
    } else {
      // Fallback to previous logic
      if (args.filters.storyId && args.filters.isHidden !== undefined && args.filters.status) {
        queryBuilder = ctx.db
          .query("comments")
          .withIndex("by_hidden_status", (q) =>
            q
              .eq("storyId", args.filters.storyId!)
              .eq("isHidden", args.filters.isHidden!)
              .eq("status", args.filters.status!)
          );
      } else if (args.filters.storyId && args.filters.status) {
        queryBuilder = ctx.db
          .query("comments")
          .withIndex("by_storyId_status", (q) =>
            q.eq("storyId", args.filters.storyId!).eq("status", args.filters.status!)
          );
      } else if (args.filters.isHidden !== undefined && args.filters.status) {
        queryBuilder = ctx.db
          .query("comments")
          .filter((q) =>
            q.and(
              q.eq(q.field("isHidden"), args.filters.isHidden),
              q.eq(q.field("status"), args.filters.status)
            )
          );
      } else if (args.filters.storyId) {
        queryBuilder = ctx.db
          .query("comments")
          .withIndex("by_storyId_status", (q) => q.eq("storyId", args.filters.storyId!));
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
      const paginatedComments = await orderedQuery.paginate(args.paginationOpts);
      return paginatedComments;
    }
  },
});

// Mutation to add a new comment or reply
export const add = mutation({
  args: {
    storyId: v.id("stories"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    await ensureUserNotBanned(ctx);
    const userId = await getAuthenticatedUserId(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    // TODO: Check if story is approved? Allow comments only on approved stories?
    // if (story.status !== 'approved') {
    //     throw new Error("Cannot comment on a story that is not approved.");
    // }

    if (args.parentId) {
      const parentComment = await ctx.db.get(args.parentId);
      if (!parentComment || parentComment.storyId !== args.storyId) {
        throw new Error("Parent comment not found or doesn't belong to this story");
      }
      // TODO: Check if parent comment is approved?
      // if (parentComment.status !== 'approved') {
      //     throw new Error("Cannot reply to a comment that is not approved.");
      // }
    }

    await ctx.db.insert("comments", {
      storyId: args.storyId,
      content: args.content,
      userId: userId, // Use authenticated user's ID
      parentId: args.parentId,
      votes: 0,
      status: "approved", // Changed from "pending"
    });

    // TODO: Only increment commentCount when a comment is APPROVED?
    // This depends on whether commentCount should reflect pending or approved comments.
    // For simplicity now, we increment immediately. Revisit if needed.
    await ctx.db.patch(args.storyId, {
      commentCount: (story.commentCount || 0) + 1, // Use || 0 for safety
    });
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

// Mutation to permanently delete a comment
export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    // We will add a new mutation for users to delete their OWN comments
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      console.warn(`Comment ${args.commentId} not found for deletion.`);
      return;
    }
    // TODO: Decrement story.commentCount, handle replies, etc.
    await ctx.db.delete(args.commentId);
  },
});

// Mutation for a user to delete their own comment
export const deleteOwnComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const comment = await ctx.db.get(args.commentId);

    if (!comment) {
      throw new Error("Comment not found.");
    }

    if (comment.userId !== userId) {
      throw new Error("User not authorized to delete this comment. Only the owner can delete.");
    }

    const story = await ctx.db.get(comment.storyId);
    if (story) {
      // Decrement comment count on the story if the comment was approved
      // (Assuming commentCount reflects approved comments)
      if (comment.status === "approved") {
        // You might need to define what status means for comment count
        await ctx.db.patch(story._id, { commentCount: Math.max(0, (story.commentCount || 0) - 1) });
      }
    }

    // TODO: Handle deletion of replies to this comment.
    // This could be complex. For now, replies will be orphaned or you might prevent deletion if replies exist.
    // Example: Check for replies
    const replies = await ctx.db
      .query("comments")
      .filter((q) => q.eq(q.field("parentId"), args.commentId))
      .collect();
    if (replies.length > 0) {
      // Option 1: Prevent deletion
      // throw new Error("Cannot delete this comment as it has replies. Please delete replies first.");
      // Option 2: Delete replies (recursive or iterative - can be complex)
      // console.warn(`Comment ${args.commentId} has ${replies.length} replies that will also be deleted.`);
      // for (const reply of replies) {
      //   await ctx.runMutation(api.comments.deleteOwnComment, { commentId: reply._id }); // Risky if not handled well
      // }
      // For now, we allow deletion and replies will be orphaned.
    }

    await ctx.db.delete(args.commentId);
    return { success: true };
  },
});
