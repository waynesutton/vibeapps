import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./utils";

// Get the 5 most recent alerts for dropdown
export const listRecentForDropdown = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("alerts"),
      _creationTime: v.number(),
      recipientUserId: v.id("users"),
      type: v.union(
        v.literal("vote"),
        v.literal("comment"),
        v.literal("rating"),
        v.literal("follow"),
        v.literal("judged"),
      ),
      isRead: v.boolean(),
      readAt: v.optional(v.number()),
      actorUserId: v.optional(v.id("users")),
      storyId: v.optional(v.id("stories")),
      commentId: v.optional(v.id("comments")),
      ratingValue: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return [];

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_recipient", (q) => q.eq("recipientUserId", me._id))
      .order("desc")
      .take(5);

    return alerts;
  },
});

// Get the 20 most recent alerts for notifications page
export const listForPage = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("alerts"),
      _creationTime: v.number(),
      recipientUserId: v.id("users"),
      type: v.union(
        v.literal("vote"),
        v.literal("comment"),
        v.literal("rating"),
        v.literal("follow"),
        v.literal("judged"),
      ),
      isRead: v.boolean(),
      readAt: v.optional(v.number()),
      actorUserId: v.optional(v.id("users")),
      storyId: v.optional(v.id("stories")),
      commentId: v.optional(v.id("comments")),
      ratingValue: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return [];

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_recipient", (q) => q.eq("recipientUserId", me._id))
      .order("desc")
      .take(20);

    return alerts;
  },
});

// Check if user has any unread alerts (for showing the black dot)
export const hasUnread = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return false;

    const count = await ctx.db
      .query("alerts")
      .withIndex("by_recipient_and_isRead", (q) =>
        q.eq("recipientUserId", me._id).eq("isRead", false),
      )
      .take(1);

    return count.length > 0;
  },
});

// Mark all alerts as read for the current user (called when clicking "View all")
export const markAllAsRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return null;

    const toUpdate = await ctx.db
      .query("alerts")
      .withIndex("by_recipient_and_isRead", (q) =>
        q.eq("recipientUserId", me._id).eq("isRead", false),
      )
      .collect();

    for (const alert of toUpdate) {
      await ctx.db.patch(alert._id, {
        isRead: true,
        readAt: Date.now(),
      });
    }

    return null;
  },
});

// Internal function to create alerts (called by other mutations)
export const createAlert = internalMutation({
  args: {
    recipientUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    type: v.union(
      v.literal("vote"),
      v.literal("comment"),
      v.literal("rating"),
      v.literal("follow"),
      v.literal("judged"),
    ),
    storyId: v.optional(v.id("stories")),
    commentId: v.optional(v.id("comments")),
    ratingValue: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Skip self-alerts
    if (args.actorUserId && args.actorUserId === args.recipientUserId) {
      return null;
    }

    await ctx.db.insert("alerts", {
      recipientUserId: args.recipientUserId,
      actorUserId: args.actorUserId,
      type: args.type,
      storyId: args.storyId,
      commentId: args.commentId,
      ratingValue: args.ratingValue,
      isRead: false,
    });

    return null;
  },
});
