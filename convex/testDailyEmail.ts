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
