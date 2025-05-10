import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id, QueryCtx, MutationCtx } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

// We might not need this specific type if we don't enhance comments further yet
// export type CommentWithDetails = Doc<"comments"> & {
//   // Add any details needed in the future, like author info if users table exists
// };

// Helper function to get the Convex user ID of the authenticated user
// TODO: Move this to a shared auth utils file or convex/users.ts
async function getAuthenticatedUserId(ctx: MutationCtx | QueryCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("User not authenticated.");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new Error("User record not found for authenticated user. Please ensure user is synced.");
  }
  return user._id;
}

// Query to list APPROVED comments for a specific story
export const listApprovedByStory = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args): Promise<Doc<"comments">[]> => {
    // Only fetch approved and not hidden comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId).eq("status", "approved"))
      .filter((q) => q.neq(q.field("isHidden"), true))
      .order("asc") // Fetch comments in chronological order
      .collect();

    // TODO: Enhance with author details if/when user authentication is added
    return comments;
  },
});

// Query to list PENDING comments for a specific story (for admin)
export const listPendingByStory = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args): Promise<Doc<"comments">[]> => {
    // TODO: Add authentication check - only admins should access pending comments
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
    // Add searchTerm if comments should be searchable (requires search index on comments table)
    // searchTerm: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ page: Doc<"comments">[]; isDone: boolean; continueCursor: string }> => {
    // TODO: Add authentication check - only admins should access

    let queryBuilder; // Use a new variable for the query builder chain

    // Start building the query based on filters
    if (args.filters.storyId && args.filters.isHidden !== undefined && args.filters.status) {
      // Most specific index first
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
      // Using filter as fallback (consider adding specific index if needed)
      queryBuilder = ctx.db
        .query("comments")
        .filter((q) =>
          q.and(
            q.eq(q.field("isHidden"), args.filters.isHidden),
            q.eq(q.field("status"), args.filters.status)
          )
        );
      // TODO: Add index on [isHidden, status] if this becomes slow
    } else if (args.filters.storyId) {
      // Using existing compound index
      queryBuilder = ctx.db
        .query("comments")
        .withIndex("by_storyId_status", (q) => q.eq("storyId", args.filters.storyId!));
    } else if (args.filters.status) {
      // Needs index on just status - none exists, use filter
      queryBuilder = ctx.db
        .query("comments")
        .filter((q) => q.eq(q.field("status"), args.filters.status));
      // TODO: Add index on [status] if needed
    } else if (args.filters.isHidden !== undefined) {
      // Needs index on just isHidden - none exists, use filter
      queryBuilder = ctx.db
        .query("comments")
        .filter((q) => q.eq(q.field("isHidden"), args.filters.isHidden));
      // TODO: Add index on [isHidden] if needed
    } else {
      // If no filters, start with the base query
      queryBuilder = ctx.db.query("comments");
    }

    // Apply default ordering
    const orderedQuery = queryBuilder.order("desc"); // Default order: newest first

    // Execute pagination
    const paginatedComments = await orderedQuery.paginate(args.paginationOpts);

    // TODO: Enhance with author details if needed

    return paginatedComments;
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
    const userId = await getAuthenticatedUserId(ctx); // Get authenticated user ID

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
    // TODO: Add authentication check - only admins should update status
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
    // TODO: Add admin authentication check
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
    // TODO: Add admin authentication check
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
    // TODO: Add admin authentication check
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      console.warn(`Comment ${args.commentId} not found for deletion.`);
      return; // Or throw error
    }

    // TODO: Consider decrementing story.commentCount if the deleted comment was approved.
    // const story = await ctx.db.get(comment.storyId);
    // if (story && comment.status === 'approved') {
    //   await ctx.db.patch(story._id, { commentCount: Math.max(0, (story.commentCount || 0) - 1) });
    // }

    // TODO: Handle deletion of replies if this comment had children?
    // This could be complex and might require a recursive approach or marking children.

    await ctx.db.delete(args.commentId);
  },
});
