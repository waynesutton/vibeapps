import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./utils";

/**
 * Returns the current user's email preferences with sensible defaults.
 */
export const getEmailSettings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      unsubscribedAt: v.optional(v.number()),
      dailyEngagementEmails: v.boolean(),
      messageNotifications: v.boolean(),
      marketingEmails: v.boolean(),
      weeklyDigestEmails: v.boolean(),
      mentionNotifications: v.boolean(),
      timezone: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const { user } = await requireAuth(ctx);
    if (!user) return null;

    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      return {
        dailyEngagementEmails: existing.dailyEngagementEmails ?? true,
        messageNotifications: existing.messageNotifications ?? true,
        marketingEmails: existing.marketingEmails ?? false,
        weeklyDigestEmails: existing.weeklyDigestEmails ?? true,
        mentionNotifications: existing.mentionNotifications ?? true,
        timezone: existing.timezone ?? "America/Los_Angeles",
        unsubscribedAt: existing.unsubscribedAt,
      };
    }

    return {
      // Defaults when not yet configured
      dailyEngagementEmails: true,
      messageNotifications: true,
      marketingEmails: false,
      weeklyDigestEmails: true,
      mentionNotifications: true,
      timezone: "America/Los_Angeles",
    };
  },
});

/**
 * Update granular preferences or unsubscribe from all emails.
 */
export const updateEmailSettings = mutation({
  args: {
    dailyEngagementEmails: v.optional(v.boolean()),
    messageNotifications: v.optional(v.boolean()),
    marketingEmails: v.optional(v.boolean()),
    weeklyDigestEmails: v.optional(v.boolean()),
    mentionNotifications: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
    unsubscribeAll: v.optional(v.boolean()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) throw new Error("User not authenticated");

    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const updates: any = {};

    if (args.unsubscribeAll === true) {
      updates.unsubscribedAt = Date.now();
      updates.dailyEngagementEmails = false;
      updates.messageNotifications = false;
      updates.marketingEmails = false;
      updates.weeklyDigestEmails = false;
      updates.mentionNotifications = false;
    } else {
      if (args.dailyEngagementEmails !== undefined)
        updates.dailyEngagementEmails = args.dailyEngagementEmails;
      if (args.messageNotifications !== undefined)
        updates.messageNotifications = args.messageNotifications;
      if (args.marketingEmails !== undefined)
        updates.marketingEmails = args.marketingEmails;
      if (args.weeklyDigestEmails !== undefined)
        updates.weeklyDigestEmails = args.weeklyDigestEmails;
      if (args.mentionNotifications !== undefined)
        updates.mentionNotifications = args.mentionNotifications;
      if (args.timezone !== undefined) updates.timezone = args.timezone;

      // If any preference is explicitly enabled, clear unsubscribe timestamp
      const anyEnabled = [
        updates.dailyEngagementEmails,
        updates.messageNotifications,
        updates.weeklyDigestEmails,
        updates.mentionNotifications,
        // marketing emails can remain disabled by default
      ].some((v) => v === true);
      if (anyEnabled) {
        updates.unsubscribedAt = undefined;
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("emailSettings", {
        userId: user._id,
        dailyEngagementEmails:
          updates.dailyEngagementEmails ?? args.dailyEngagementEmails ?? true,
        messageNotifications:
          updates.messageNotifications ?? args.messageNotifications ?? true,
        marketingEmails:
          updates.marketingEmails ?? args.marketingEmails ?? false,
        weeklyDigestEmails:
          updates.weeklyDigestEmails ?? args.weeklyDigestEmails ?? true,
        mentionNotifications:
          updates.mentionNotifications ?? args.mentionNotifications ?? true,
        timezone: updates.timezone ?? args.timezone ?? "America/Los_Angeles",
        unsubscribedAt: updates.unsubscribedAt,
      });
    }

    return { success: true };
  },
});

/**
 * Convenience mutation: unsubscribe from all emails.
 */
export const unsubscribeAll = mutation({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx) => {
    const { user } = await requireAuth(ctx);
    if (!user) throw new Error("User not authenticated");

    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const payload = {
      unsubscribedAt: Date.now(),
      dailyEngagementEmails: false,
      messageNotifications: false,
      marketingEmails: false,
      weeklyDigestEmails: false,
      mentionNotifications: false,
    };

    if (existing) await ctx.db.patch(existing._id, payload);
    else
      await ctx.db.insert("emailSettings", {
        userId: user._id,
        timezone: "America/Los_Angeles",
        ...payload,
      });

    return { success: true };
  },
});
