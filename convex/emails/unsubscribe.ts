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

      // Check if token is expired or already consumed
      if (tokenRecord.expiresAt < Date.now() || tokenRecord.consumedAt) {
        return { success: false };
      }

      // Mark token as consumed
      await ctx.db.patch(tokenRecord._id, {
        consumedAt: Date.now(),
      });

      // Update user's email settings based on token purpose
      const existing = await ctx.db
        .query("emailSettings")
        .withIndex("by_user", (q) => q.eq("userId", tokenRecord.userId))
        .unique();

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
          marketingEmails: tokenRecord.purpose === "marketing" ? false : false,
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
