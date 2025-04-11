import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// We might not need this specific type if we don't enhance comments further yet
// export type CommentWithDetails = Doc<"comments"> & {
//   // Add any details needed in the future, like author info if users table exists
// };

// Query to list APPROVED comments for a specific story
export const listApprovedByStory = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args): Promise<Doc<"comments">[]> => {
    // Only fetch approved comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId).eq("status", "approved"))
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

// Mutation to add a new comment or reply
export const add = mutation({
  args: {
    storyId: v.id("stories"),
    content: v.string(),
    author: v.string(), // TODO: Replace with authenticated user
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
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
      author: args.author,
      parentId: args.parentId,
      votes: 0,
      status: "pending", // Set initial status to pending
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
