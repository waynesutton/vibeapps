import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdminRole } from "./users";

/**
 * Test function to manually trigger daily admin email
 * Only accessible to admins
 */
export const testDailyAdminEmail = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    try {
      // Schedule the daily admin email immediately
      await ctx.scheduler.runAfter(
        0,
        internal.emails.daily.sendDailyAdminEmail,
        {},
      );

      return {
        success: true,
        message:
          "Daily admin email scheduled successfully! Check your email in a few moments.",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to schedule daily admin email: ${error}`,
      };
    }
  },
});

/**
 * Test function to manually trigger daily user engagement emails
 * Only accessible to admins
 */
export const testDailyUserEmails = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    try {
      // First process engagement for today
      const today = new Date().toISOString().split("T")[0];
      await ctx.scheduler.runAfter(
        0,
        internal.emails.daily.processUserEngagement,
        { date: today },
      );

      // Then send user emails (with a small delay)
      await ctx.scheduler.runAfter(
        5000,
        internal.emails.daily.sendDailyUserEmails,
        {},
      );

      return {
        success: true,
        message:
          "Daily user engagement emails scheduled! Processing will start in a few moments.",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to schedule daily user emails: ${error}`,
      };
    }
  },
});

/**
 * Test function to manually trigger weekly digest
 * Only accessible to admins
 */
export const testWeeklyDigest = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    try {
      await ctx.scheduler.runAfter(
        0,
        internal.emails.weekly.sendWeeklyDigest,
        {},
      );

      return {
        success: true,
        message: "Weekly digest email scheduled successfully!",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to schedule weekly digest: ${error}`,
      };
    }
  },
});

/**
 * Debug function to check daily user email flow status
 * Only accessible to admins
 * STEP 1: Run this first to see the current state
 */
export const debugDailyUserEmails = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    data: v.any(),
  }),
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    try {
      const today = new Date().toISOString().split("T")[0];

      // Get engagement summaries
      const engagementSummaries = await ctx.db
        .query("dailyEngagementSummary")
        .withIndex("by_date", (q) => q.eq("date", today))
        .collect();

      // Get mentions
      const mentions = await ctx.db
        .query("mentions")
        .filter((q) => q.eq(q.field("date"), today))
        .collect();

      // Get email logs for today
      const todayStart = new Date(today + "T00:00:00Z").getTime();
      const todayEnd = new Date(today + "T23:59:59Z").getTime();

      const emailLogs = await ctx.db
        .query("emailLogs")
        .withIndex("by_type_date", (q) => q.eq("emailType", "daily_engagement"))
        .filter(
          (q) =>
            q.gte(q.field("sentAt"), todayStart) &&
            q.lte(q.field("sentAt"), todayEnd),
        )
        .collect();

      // Get all users with emails
      const allUsers = await ctx.db.query("users").collect();
      const usersWithEmail = allUsers.filter((u) => u.email);

      // Get email settings to check who has disabled emails
      const allEmailSettings = await ctx.db.query("emailSettings").collect();
      const disabledUsers = allEmailSettings.filter(
        (s) => s.unsubscribedAt || s.dailyEngagementEmails === false,
      );

      return {
        success: true,
        message: "Debug data retrieved successfully",
        data: {
          date: today,
          engagementSummariesCount: engagementSummaries.length,
          mentionsCount: mentions.length,
          emailsSentToday: emailLogs.length,
          totalUsersWithEmail: usersWithEmail.length,
          usersWithDisabledEmails: disabledUsers.length,
          engagementSummaries: engagementSummaries.map((s) => ({
            userId: s.userId,
            totalEngagement: s.totalEngagement,
            storyCount: s.storyEngagements.length,
          })),
          emailLogs: emailLogs.map((log) => ({
            recipientEmail: log.recipientEmail,
            status: log.status,
            sentAt: new Date(log.sentAt).toISOString(),
          })),
          interpretation: {
            hasEngagementData: engagementSummaries.length > 0,
            hasMentions: mentions.length > 0,
            emailsAlreadySent: emailLogs.length > 0,
            reason:
              engagementSummaries.length === 0 && mentions.length === 0
                ? "NO ENGAGEMENT DATA - Users need to receive votes/comments/mentions before emails can be sent"
                : emailLogs.length > 0
                  ? "EMAILS ALREADY SENT TODAY - Check the emailLogs list above"
                  : "READY TO SEND - You can run testDailyUserEmails to trigger the emails",
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve debug data: ${error}`,
        data: null,
      };
    }
  },
});
