import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc, TableNames } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api"; // Import internal API
import { requireAdminRole } from "./users"; // Import requireAdminRole
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
 * Create a new report for a story.
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

    const existingReport = await ctx.db
      .query("reports")
      .withIndex("by_storyId", (q) => q.eq("storyId", args.storyId))
      .filter((q) => q.eq(q.field("reporterUserId"), user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingReport) {
      throw new Error("You have already reported this story, and it is pending review.");
    }

    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found.");
    }

    return await ctx.db.insert("reports", {
      storyId: args.storyId,
      reporterUserId: user._id,
      reason: args.reason,
      status: "pending",
    });
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
            v.literal("dismissed")
          )
        ),
      })
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
 * Update the status of a report by an admin.
 */
export const updateReportStatusByAdmin = mutation({
  args: {
    reportId: v.id("reports"),
    newStatus: v.union(
      v.literal("pending"),
      v.literal("resolved_hidden"),
      v.literal("resolved_deleted"),
      v.literal("dismissed")
    ),
    permanentlyDeleteStory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found.");
    }

    // If new status is pending, it usually means we are re-opening a report for a story that was previously acted upon.
    // We don't need to modify the story itself in this case, just the report status.
    if (args.newStatus !== "pending") {
      const story = await ctx.db.get(report.storyId);
      if (!story) {
        console.warn(
          `Story ${report.storyId} not found for report ${args.reportId}. Updating report status only.`
        );
        // If story is gone, and we are not setting to pending, still update report
        return await ctx.db.patch(args.reportId, { status: args.newStatus });
      }

      if (args.newStatus === "resolved_hidden") {
        await ctx.db.patch(report.storyId, { isHidden: true });
      } else if (args.newStatus === "resolved_deleted") {
        if (args.permanentlyDeleteStory === true) {
          await ctx.runMutation(internal.reports.deleteStoryAndAssociations, {
            storyId: report.storyId,
          });
        } else {
          await ctx.db.patch(report.storyId, { isHidden: true, status: "rejected" });
        }
      }
      // No specific story action if newStatus is "dismissed" and not "pending"
    }

    return await ctx.db.patch(args.reportId, { status: args.newStatus });
  },
});

export const deleteStoryAndAssociations = internalMutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const storyDb = await ctx.db.get(args.storyId); // Renamed to avoid conflict with story variable in outer scope if this were nested
    if (!storyDb) {
      console.warn(`Story ${args.storyId} not found for deletion.`);
      return false;
    }

    const commentsToDelete = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const comment of commentsToDelete) {
      await ctx.db.delete(comment._id);
    }

    const allRatings = await ctx.db.query("storyRatings").collect();
    const ratingsToDelete = allRatings.filter((rating) => rating.storyId === args.storyId);
    for (const rating of ratingsToDelete) {
      await ctx.db.delete(rating._id);
    }

    const votesToDelete = await ctx.db
      .query("votes")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const vote of votesToDelete) {
      await ctx.db.delete(vote._id);
    }

    await ctx.db.delete(args.storyId);
    console.log(`Story ${args.storyId} and associated data permanently deleted by admin.`);
    return true;
  },
});
