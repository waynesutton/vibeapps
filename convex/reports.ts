import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc, TableNames } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api"; // Import internal API
import { requireAdminRole } from "./users"; // Import requireAdminRole
import { getAdminUserIds } from "./alerts"; // Import admin user helper
// import { Expression } from "convex/values"; // REMOVE THIS LINE
// import { Users } from "./schema"; // REMOVE THIS LINE
// import { DatabaseReader } from "convex/server"; // REMOVE THIS LINE
// import {身份验证} from "./helpers"; // Assuming you have an auth helper - REMOVE THIS

// Corrected Authentication Logic
async function getAuthenticatedUserAndRole(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    // If no identity, and admin pages are public for now, treat as non-admin user for other purposes
    // but allow admin queries to proceed if explicitly bypassed.
    return { user: null, userIsAdmin: false };
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  const userIsAdmin = user?.role === "admin";
  return { user, userIsAdmin };
}

/**
 * Create a new report for a story - Fixed: Optimized read order to minimize conflicts
 */
export const createReport = mutation({
  args: {
    storyId: v.id("stories"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUserAndRole(ctx);
    if (!user) {
      throw new Error("User must be logged in to report a story.");
    }

    // Check for existing pending report first (validation)
    const existingReport = await ctx.db
      .query("reports")
      .withIndex("by_storyId", (q) => q.eq("storyId", args.storyId))
      .filter((q) => q.eq(q.field("reporterUserId"), user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingReport) {
      throw new Error(
        "You have already reported this story, and it is pending review.",
      );
    }

    // Verify story exists (validation)
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found.");
    }

    // All validation complete - now perform writes
    const reportId = await ctx.db.insert("reports", {
      storyId: args.storyId,
      reporterUserId: user._id,
      reason: args.reason,
      status: "pending",
    });

    // Get all admin and manager user IDs
    const adminUserIds = await getAdminUserIds(ctx);

    // Create notifications for all admin and manager users (non-blocking)
    if (adminUserIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.alerts.createReportNotifications,
        {
          reporterUserId: user._id,
          storyId: args.storyId,
          reportId: reportId,
          adminUserIds: adminUserIds,
        },
      );
    } else {
      console.warn("No admin users found to notify about report");
    }

    return reportId;
  },
});

/**
 * List all reports for the admin dashboard.
 * Includes story and reporter details.
 */
export type ReportWithDetails = Doc<"reports"> & {
  story: Doc<"stories"> | null;
  reporter: Doc<"users"> | null;
};

export const listAllReportsAdmin = query({
  args: {
    filters: v.optional(
      v.object({
        status: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("resolved_hidden"),
            v.literal("resolved_deleted"),
            v.literal("dismissed"),
          ),
        ),
      }),
    ),
  },
  handler: async (ctx, args): Promise<ReportWithDetails[]> => {
    await requireAdminRole(ctx);

    let reports;
    if (args.filters?.status) {
      reports = await ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", args.filters!.status!))
        .order("desc")
        .collect();
    } else {
      reports = await ctx.db.query("reports").order("desc").collect();
    }

    const reportsWithDetails: ReportWithDetails[] = [];
    for (const report of reports) {
      const story = await ctx.db.get(report.storyId);
      const reporter = await ctx.db.get(report.reporterUserId);
      reportsWithDetails.push({
        ...report,
        story,
        reporter,
      });
    }
    return reportsWithDetails;
  },
});

/**
 * Update the status of a report by an admin - Fixed: Minimized read window
 */
export const updateReportStatusByAdmin = mutation({
  args: {
    reportId: v.id("reports"),
    newStatus: v.union(
      v.literal("pending"),
      v.literal("resolved_hidden"),
      v.literal("resolved_deleted"),
      v.literal("dismissed"),
    ),
    permanentlyDeleteStory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found.");
    }

    // Validate and prepare actions based on new status
    if (args.newStatus !== "pending") {
      const story = await ctx.db.get(report.storyId);
      if (!story) {
        console.warn(
          `Story ${report.storyId} not found for report ${args.reportId}. Updating report status only.`,
        );
        // If story is gone, still update report
        await ctx.db.patch(args.reportId, { status: args.newStatus });
        return;
      }

      // Perform story actions immediately after validation
      if (args.newStatus === "resolved_hidden") {
        await ctx.db.patch(report.storyId, { isHidden: true });
      } else if (args.newStatus === "resolved_deleted") {
        if (args.permanentlyDeleteStory === true) {
          await ctx.runMutation(internal.reports.deleteStoryAndAssociations, {
            storyId: report.storyId,
          });
        } else {
          await ctx.db.patch(report.storyId, {
            isHidden: true,
            status: "rejected",
          });
        }
      }
    }

    // Update report status
    await ctx.db.patch(args.reportId, { status: args.newStatus });
  },
});

export const deleteStoryAndAssociations = internalMutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const storyDb = await ctx.db.get(args.storyId);
    if (!storyDb) {
      console.warn(`Story ${args.storyId} not found for deletion.`);
      return false;
    }

    // Collect all related data in parallel
    const [commentsToDelete, allRatings, votesToDelete] = await Promise.all([
      ctx.db
        .query("comments")
        .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId))
        .collect(),
      ctx.db.query("storyRatings").collect(),
      ctx.db
        .query("votes")
        .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
        .collect(),
    ]);

    const ratingsToDelete = allRatings.filter(
      (rating) => rating.storyId === args.storyId,
    );

    // Delete all associated data in parallel for better performance
    await Promise.all([
      ...commentsToDelete.map((comment) => ctx.db.delete(comment._id)),
      ...ratingsToDelete.map((rating) => ctx.db.delete(rating._id)),
      ...votesToDelete.map((vote) => ctx.db.delete(vote._id)),
    ]);

    // Delete the story itself
    await ctx.db.delete(args.storyId);
    console.log(
      `Story ${args.storyId} and associated data permanently deleted by admin.`,
    );
    return true;
  },
});

/**
 * Create a new report for a user.
 */
export const createUserReport = mutation({
  args: {
    reportedUserId: v.id("users"),
    reason: v.string(),
  },
  returns: v.id("userReports"),
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUserAndRole(ctx);
    if (!user) {
      throw new Error("User must be logged in to report a user.");
    }

    // Prevent self-reporting
    if (user._id === args.reportedUserId) {
      throw new Error("You cannot report yourself.");
    }

    // Check if user has already reported this user with a pending report
    const existingReport = await ctx.db
      .query("userReports")
      .withIndex("by_reportedUserId", (q) =>
        q.eq("reportedUserId", args.reportedUserId),
      )
      .filter((q) => q.eq(q.field("reporterUserId"), user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingReport) {
      throw new Error(
        "You have already reported this user, and it is pending review.",
      );
    }

    const reportedUser = await ctx.db.get(args.reportedUserId);
    if (!reportedUser) {
      throw new Error("User not found.");
    }

    const reportId = await ctx.db.insert("userReports", {
      reportedUserId: args.reportedUserId,
      reporterUserId: user._id,
      reason: args.reason,
      status: "pending",
    });

    // Get all admin and manager user IDs
    const adminUserIds = await getAdminUserIds(ctx);

    // Create notifications for all admin and manager users (non-blocking)
    if (adminUserIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.alerts.createUserReportNotifications,
        {
          reporterUserId: user._id,
          reportedUserId: args.reportedUserId,
          reportId: reportId,
          adminUserIds: adminUserIds,
        },
      );
    } else {
      console.warn("No admin users found to notify about user report");
    }

    return reportId;
  },
});

/**
 * List all user reports for the admin dashboard.
 * Includes reported user and reporter details.
 */
export type UserReportWithDetails = Doc<"userReports"> & {
  reportedUser: Doc<"users"> | null;
  reporter: Doc<"users"> | null;
};

export const listAllUserReportsAdmin = query({
  args: {
    filters: v.optional(
      v.object({
        status: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("resolved_warned"),
            v.literal("resolved_banned"),
            v.literal("resolved_paused"),
            v.literal("dismissed"),
          ),
        ),
      }),
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("userReports"),
      _creationTime: v.number(),
      reportedUserId: v.id("users"),
      reporterUserId: v.id("users"),
      reason: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("resolved_warned"),
        v.literal("resolved_banned"),
        v.literal("resolved_paused"),
        v.literal("dismissed"),
      ),
      reportedUser: v.union(
        v.object({
          _id: v.id("users"),
          _creationTime: v.number(),
          name: v.string(),
          email: v.optional(v.string()),
          username: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          isBanned: v.optional(v.boolean()),
          isPaused: v.optional(v.boolean()),
          isVerified: v.optional(v.boolean()),
        }),
        v.null(),
      ),
      reporter: v.union(
        v.object({
          _id: v.id("users"),
          _creationTime: v.number(),
          name: v.string(),
          email: v.optional(v.string()),
          username: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    let reports;
    if (args.filters?.status) {
      reports = await ctx.db
        .query("userReports")
        .withIndex("by_status", (q) => q.eq("status", args.filters!.status!))
        .order("desc")
        .collect();
    } else {
      reports = await ctx.db.query("userReports").order("desc").collect();
    }

    const reportsWithDetails = [];
    for (const report of reports) {
      const reportedUser = await ctx.db.get(report.reportedUserId);
      const reporter = await ctx.db.get(report.reporterUserId);
      reportsWithDetails.push({
        ...report,
        reportedUser: reportedUser
          ? {
              _id: reportedUser._id,
              _creationTime: reportedUser._creationTime,
              name: reportedUser.name,
              email: reportedUser.email,
              username: reportedUser.username,
              imageUrl: reportedUser.imageUrl,
              isBanned: reportedUser.isBanned,
              isPaused: reportedUser.isPaused,
              isVerified: reportedUser.isVerified,
            }
          : null,
        reporter: reporter
          ? {
              _id: reporter._id,
              _creationTime: reporter._creationTime,
              name: reporter.name,
              email: reporter.email,
              username: reporter.username,
              imageUrl: reporter.imageUrl,
            }
          : null,
      });
    }
    return reportsWithDetails;
  },
});

/**
 * Update the status of a user report by an admin.
 */
export const updateUserReportStatusByAdmin = mutation({
  args: {
    reportId: v.id("userReports"),
    newStatus: v.union(
      v.literal("pending"),
      v.literal("resolved_warned"),
      v.literal("resolved_banned"),
      v.literal("resolved_paused"),
      v.literal("dismissed"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found.");
    }

    await ctx.db.patch(args.reportId, { status: args.newStatus });
    return null;
  },
});
