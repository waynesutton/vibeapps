import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Send immediate email notifications to admins/managers about new reports
 */
export const sendReportNotificationEmails = internalAction({
  args: {
    reporterUserId: v.id("users"),
    storyId: v.id("stories"),
    reportId: v.id("reports"),
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get report details
    const report = await ctx.runQuery(
      internal.emails.reports.getReportDetails,
      {
        reportId: args.reportId,
      },
    );
    if (!report) {
      console.error("Report not found for notification email");
      return null;
    }

    // Get story details
    const story = await ctx.runQuery(internal.stories.getStoryById, {
      storyId: args.storyId,
    });
    if (!story) {
      console.error("Story not found for report notification email");
      return null;
    }

    // Get reporter details
    const reporter = await ctx.runQuery(
      internal.emails.reports.getUserDetails,
      {
        userId: args.reporterUserId,
      },
    );
    if (!reporter) {
      console.error("Reporter not found for notification email");
      return null;
    }

    // Send email to each admin/manager
    for (const adminUserId of args.adminUserIds) {
      const admin = await ctx.runQuery(internal.emails.reports.getUserDetails, {
        userId: adminUserId,
      });

      if (!admin || !admin.email) {
        console.warn(`Admin user ${adminUserId} not found or has no email`);
        continue;
      }

      // Check email settings - send admin emails regardless of user preferences
      // since this is a critical moderation notification

      const subject = `[VibeApps] New Report Submitted - ${story.title}`;
      const htmlContent = await ctx.runQuery(
        internal.emails.templates.generateReportNotificationEmail,
        {
          adminName: admin.name || "Admin",
          reporterName: reporter.name || "Anonymous User",
          storyTitle: story.title,
          storyUrl: story.url,
          reportReason: report.reason,
          dashboardUrl: `https://vibeapps.dev/admin/reports`,
        },
      );

      try {
        await ctx.runAction(internal.sendEmails.sendEmail, {
          to: admin.email,
          subject,
          html: htmlContent,
        });
        console.log(`Report notification email sent to admin ${admin.email}`);
      } catch (error) {
        console.error(
          `Failed to send report notification email to ${admin.email}:`,
          error,
        );
      }
    }

    return null;
  },
});

/**
 * Get report details for email notifications
 */
export const getReportDetails = internalQuery({
  args: { reportId: v.id("reports") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("reports"),
      reason: v.string(),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    return {
      _id: report._id,
      reason: report.reason,
      status: report.status,
    };
  },
});

/**
 * Get user details for email notifications
 */
export const getUserDetails = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
    };
  },
});
