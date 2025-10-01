import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdminRole } from "./users";

/**
 * Clear today's email logs for testing
 * Only accessible to admins
 */
export const clearTodaysEmailLogs = mutation({
  args: {
    emailType: v.optional(
      v.union(
        v.literal("daily_admin"),
        v.literal("daily_engagement"),
        v.literal("welcome"),
        v.literal("message_notification"),
        v.literal("weekly_digest"),
        v.literal("mention_notification"),
        v.literal("admin_broadcast"),
        v.literal("admin_report_notification"),
      ),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

    let logsToDelete;

    if (args.emailType !== undefined) {
      // Delete specific email type - use explicit type assertion since we've checked for undefined
      const emailType = args.emailType;
      logsToDelete = await ctx.db
        .query("emailLogs")
        .withIndex("by_type_date", (q) => q.eq("emailType", emailType))
        .filter(
          (q) =>
            q.gte(q.field("sentAt"), startOfDay) &&
            q.lte(q.field("sentAt"), endOfDay),
        )
        .collect();
    } else {
      // Delete all email logs from today
      logsToDelete = await ctx.db
        .query("emailLogs")
        .filter(
          (q) =>
            q.gte(q.field("sentAt"), startOfDay) &&
            q.lte(q.field("sentAt"), endOfDay),
        )
        .collect();
    }

    for (const log of logsToDelete) {
      await ctx.db.delete(log._id);
    }

    return {
      success: true,
      message: `Deleted ${logsToDelete.length} email log(s) from today${args.emailType ? ` (type: ${args.emailType})` : ""}`,
      deletedCount: logsToDelete.length,
    };
  },
});

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

      // Then send user emails (with a longer delay to ensure processing completes)
      await ctx.scheduler.runAfter(
        30000, // 30 seconds should be enough for processing
        internal.emails.daily.sendDailyUserEmails,
        {},
      );

      return {
        success: true,
        message:
          "Daily user engagement emails scheduled! Processing engagement data now, emails will be sent in ~30 seconds. Check Convex logs for progress.",
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
        message:
          "Weekly digest email scheduled successfully! Check Convex logs for progress and email count.",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to schedule weekly digest: ${error}`,
      };
    }
  },
});
