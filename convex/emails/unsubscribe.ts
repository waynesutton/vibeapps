import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Handle unsubscribe token from email links
 */
export const handleUnsubscribeToken = internalMutation({
  args: { token: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    try {
      // Find the token in the database
      const tokenRecord = await ctx.db
        .query("emailUnsubscribeTokens")
        .withIndex("by_token", (q) => q.eq("token", args.token))
        .unique();

      if (!tokenRecord) {
        return { success: false };
      }

      const existing = await ctx.db
        .query("emailSettings")
        .withIndex("by_user", (q) => q.eq("userId", tokenRecord.userId))
        .unique();

      // Idempotent success: a consumed token whose owner already turned off
      // the emails it covers (e.g. Gmail's one-click POST fired before the
      // user's GET, or a repeat click) shows the confirmation page instead
      // of "expired". Unknown or truly expired tokens still fail below.
      if (tokenRecord.consumedAt) {
        const alreadyApplied =
          tokenRecord.purpose === "all"
            ? existing?.unsubscribedAt !== undefined
            : tokenRecord.purpose === "daily_engagement"
              ? existing?.dailyEngagementEmails === false
              : tokenRecord.purpose === "weekly_digest"
                ? existing?.weeklyDigestEmails === false
                : existing?.marketingEmails === false;
        return { success: alreadyApplied };
      }

      // Check if token is expired (never consumed)
      if (tokenRecord.expiresAt < Date.now()) {
        return { success: false };
      }

      // Mark token as consumed
      await ctx.db.patch(tokenRecord._id, {
        consumedAt: Date.now(),
      });

      const updates: any = {};

      if (tokenRecord.purpose === "all") {
        // Unsubscribe from all emails
        updates.unsubscribedAt = Date.now();
        updates.dailyEngagementEmails = false;
        updates.messageNotifications = false;
        updates.marketingEmails = false;
        updates.weeklyDigestEmails = false;
        updates.mentionNotifications = false;
      } else if (tokenRecord.purpose === "daily_engagement") {
        updates.dailyEngagementEmails = false;
      } else if (tokenRecord.purpose === "weekly_digest") {
        updates.weeklyDigestEmails = false;
      } else if (tokenRecord.purpose === "marketing") {
        updates.marketingEmails = false;
      }

      if (existing) {
        await ctx.db.patch(existing._id, updates);
      } else {
        // Create new email settings record
        await ctx.db.insert("emailSettings", {
          userId: tokenRecord.userId,
          timezone: "America/Los_Angeles",
          dailyEngagementEmails:
            tokenRecord.purpose === "daily_engagement" ? false : true,
          messageNotifications: true,
          marketingEmails: false, // Marketing defaults to opt-in

          weeklyDigestEmails:
            tokenRecord.purpose === "weekly_digest" ? false : true,
          mentionNotifications: true,
          ...updates,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error handling unsubscribe token:", error);
      return { success: false };
    }
  },
});
