import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Send immediate email notifications to admins/managers about new story reports
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

      // Generate unsubscribe token for this admin
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: adminUserId,
          purpose: "all",
        },
      );

      // Generate story report email template
      const emailTemplate = await ctx.runQuery(
        internal.emails.templates.generateReportNotificationEmail,
        {
          adminUserId: adminUserId,
          adminName: admin.name || "Admin",
          adminUsername: admin.username,
          reporterName: reporter.name || "Anonymous User",
          reporterUsername: reporter.username,
          storyTitle: story.title,
          storyUrl: `https://vibeapps.dev/s/${story.slug || args.storyId}`,
          storySlug: story.slug,
          reportReason: report.reason,
          reportTimestamp: report._creationTime,
          dashboardUrl: `https://vibeapps.dev/admin?tab=reports`,
          unsubscribeToken,
        },
      );

      // Send via core Resend system
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: admin.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        emailType: "admin_report_notification",
        userId: adminUserId,
        unsubscribeToken,
        metadata: {
          reportId: args.reportId,
          storyId: args.storyId,
          reporterUserId: args.reporterUserId,
          reportReason: report.reason,
        },
      });

      console.log(
        `Story report notification email sent to admin ${admin.email}`,
      );
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
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    return {
      _id: report._id,
      reason: report.reason,
      status: report.status,
      _creationTime: report._creationTime,
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
      username: v.optional(v.string()),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      _creationTime: user._creationTime,
    };
  },
});

/**
 * Get user report details for email notifications
 */
export const getUserReportDetails = internalQuery({
  args: { reportId: v.id("userReports") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("userReports"),
      reason: v.string(),
      status: v.string(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    return {
      _id: report._id,
      reason: report.reason,
      status: report.status,
      _creationTime: report._creationTime,
    };
  },
});

/**
 * Get user stats for email context
 */
export const getUserStats = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    submissionCount: v.number(),
    commentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get submission count
    const submissions = await ctx.db
      .query("stories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get comment count
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      submissionCount: submissions.length,
      commentCount: comments.length,
    };
  },
});

/**
 * Send immediate email notifications to admins/managers about user reports
 */
export const sendUserReportNotificationEmails = internalAction({
  args: {
    reporterUserId: v.id("users"),
    reportedUserId: v.id("users"),
    reportId: v.id("userReports"),
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get report details
    const report = await ctx.runQuery(
      internal.emails.reports.getUserReportDetails,
      {
        reportId: args.reportId,
      },
    );
    if (!report) {
      console.error("User report not found for notification email");
      return null;
    }

    // Get reported user details
    const reportedUser = await ctx.runQuery(
      internal.emails.reports.getUserDetails,
      {
        userId: args.reportedUserId,
      },
    );
    if (!reportedUser) {
      console.error("Reported user not found for notification email");
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

    // Get reported user's stats for context
    const userStats = await ctx.runQuery(internal.emails.reports.getUserStats, {
      userId: args.reportedUserId,
    });

    // Send email to each admin/manager
    for (const adminUserId of args.adminUserIds) {
      const admin = await ctx.runQuery(internal.emails.reports.getUserDetails, {
        userId: adminUserId,
      });

      if (!admin || !admin.email) {
        console.warn(`Admin user ${adminUserId} not found or has no email`);
        continue;
      }

      // Generate unsubscribe token for this admin
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: adminUserId,
          purpose: "all",
        },
      );

      // Generate admin user report email template
      const emailTemplate = await ctx.runQuery(
        internal.emails.templates.generateAdminUserReportEmail,
        {
          adminUserId: adminUserId,
          adminName: admin.name || "Admin",
          adminUsername: admin.username,
          reporterName: reporter.name || "Anonymous User",
          reporterUsername: reporter.username,
          reporterEmail: reporter.email,
          reportedUserName: reportedUser.name || "Unknown User",
          reportedUsername: reportedUser.username,
          reportReason: report.reason,
          reportTimestamp: report._creationTime,
          userJoinDate: reportedUser._creationTime,
          submissionCount: userStats.submissionCount,
          commentCount: userStats.commentCount,
          dashboardUrl: `https://vibeapps.dev/admin?tab=users&subtab=user-reports`,
          profileUrl: `https://vibeapps.dev/${reportedUser.username || reportedUser._id}`,
          unsubscribeToken,
        },
      );

      // Send via core Resend system
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: admin.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        emailType: "admin_user_report_notification",
        userId: adminUserId,
        unsubscribeToken,
        metadata: {
          reportId: args.reportId,
          reportedUserId: args.reportedUserId,
          reporterUserId: args.reporterUserId,
          reportReason: report.reason,
        },
      });

      console.log(
        `User report notification email sent to admin ${admin.email}`,
      );
    }

    return null;
  },
});
