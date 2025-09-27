import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
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
        v.literal("bookmark"),
        v.literal("report"),
        v.literal("verified"),
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
        v.literal("bookmark"),
        v.literal("report"),
        v.literal("verified"),
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
      v.literal("bookmark"),
      v.literal("report"),
      v.literal("verified"),
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

// Function to get admin user IDs from the current context
// This can be called from mutations where we have access to auth context
export async function getAdminUserIds(
  ctx: QueryCtx | MutationCtx,
): Promise<Array<Id<"users">>> {
  const allAdminIds: Array<Id<"users">> = [];

  // Check for users with admin role in database (backward compatibility)
  const dbAdminUsers = await ctx.db
    .query("users")
    .filter((q) =>
      q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("role"), "manager")),
    )
    .collect();

  const dbAdminIds = dbAdminUsers.map((user) => user._id);
  allAdminIds.push(...dbAdminIds);

  // For now, we'll rely on the database role field since we can't easily query all users' Clerk roles
  // In the future with adminroles.prd, we'll need a different approach
  // TODO: When implementing adminroles.prd, we'll need to store admin user IDs in a separate table
  // or use a different method to identify all admin users

  console.log(
    `Found ${allAdminIds.length} admin/manager users for notifications:`,
    allAdminIds,
  );
  return allAdminIds;
}

// Internal function to create report notifications for all admin/manager users
export const createReportNotifications = internalMutation({
  args: {
    reporterUserId: v.id("users"),
    storyId: v.id("stories"),
    reportId: v.id("reports"),
    adminUserIds: v.array(v.id("users")), // Pass admin user IDs from calling context
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create notification for each admin/manager user
    for (const adminUserId of args.adminUserIds) {
      await ctx.db.insert("alerts", {
        recipientUserId: adminUserId,
        actorUserId: args.reporterUserId,
        type: "report",
        storyId: args.storyId,
        isRead: false,
      });
    }

    return null;
  },
});
