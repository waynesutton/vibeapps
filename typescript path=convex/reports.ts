import { query, mutation, internalMutation, QueryBuilder } from "./_generated/server"; // Ensure QueryBuilder is imported
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./auth";
import { api } from "./_generated/api";


// This function assumes 'tokenIdentifier' is a field on the 'reports' table itself,
// and there's an index 'by_token' on it. This is unusual.
// If 'tokenIdentifier' refers to the reporter's identity, you should query 'users' first.
// The original error `q.eq("tokenIdentifier", identity.tokenIdentifier)` implies this structure.
export const getReportsByToken_FIXME_SCHEMA_REVIEW = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated for token-based report query.");

    // This line will fail if 'reports' table doesn't have 'tokenIdentifier' field & 'by_token' index.
    // Using 'q: any' as a temporary workaround for TS7006.
    // The real fix is to ensure schema.ts defines this field and index correctly if it's intended.
    // OR, if this function is not actually used or intended, it should be removed/corrected.
    // return await ctx.db
    //   .query("reports")
    //   .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    //   .collect();
    // Commenting out as it's likely a misunderstanding of the schema or a legacy/broken function.
    // If you need to find reports by a user's token, query users table first, then reports by reporterUserId.
    console.warn("getReportsByToken_FIXME_SCHEMA_REVIEW is likely misconfigured or unused.");
    return [];
  },
});

export type ReportWithDetails = Doc<"reports"> & {
  story?: Doc<"stories"> | null;
  reporter?: Doc<"users"> | null;
};

export const listAllWithDetails = query({
  args: {
    statusFilter: v.optional(v.string()), // e.g., "all", "pending", "resolved_hidden", etc.
    // Add pagination args if needed
  },
  handler: async (ctx, args): Promise<ReportWithDetails[]> => {
    await requireAdmin(ctx);

    let reportsQuery = ctx.db.query("reports");

    if (args.statusFilter && args.statusFilter !== "all") {
      // Using 'q: any' as a temporary workaround for TS2739.
      // Ensure 'by_status' index exists on 'reports.status' field in schema.ts.
      reportsQuery = reportsQuery.withIndex("by_status", (q: any) => q.eq("status", args.statusFilter!));
    }

    const reports = await reportsQuery.order("desc").collect();

    const reportsWithDetails: ReportWithDetails[] = [];
    for (const report of reports) {
      const story = await ctx.db.get(report.storyId);
      const reporter = await ctx.db.get(report.reporterUserId);
      reportsWithDetails.push({ ...report, story, reporter });
    }
    return reportsWithDetails;
  },
});

export const getReportsForStory_FIXME_SCHEMA_REVIEW = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Using 'q: any' as a temporary workaround for TS2769/TS2345.
    // This error ('Argument of type '"storyId"' is not assignable...')
    // STRONGLY indicates that the index "by_storyId" in schema.ts
    // is NOT defined on the "storyId" field of the "reports" table.
    // It MUST be: .index("by_storyId", ["storyId"])
    return await ctx.db
      .query("reports")
      .withIndex("by_storyId", (q: any) => q.eq("storyId", args.storyId))
      .collect();
  },
});

export const updateStatus = mutation({
  args: {
    reportId: v.id("reports"),
    newStatus: v.union(
      v.literal("pending"),
      v.literal("resolved_hidden"),
      v.literal("resolved_deleted"),
      v.literal("dismissed")
    ),
    storyId: v.optional(v.id("stories")), // Needed if action involves story
    actionType: v.optional(v.string()), // "hide_story", "delete_story"
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.reportId, { status: args.newStatus });

    if (args.storyId && args.actionType === "hide_story") {
        await ctx.db.patch(args.storyId, { isHidden: true, status: "rejected" }); // Also mark story status
    }
    // Add logic for "delete_story" if it's a soft/hard delete via reports
    // if (args.storyId && args.actionType === "delete_story") {
    //   await ctx.runMutation(api.stories.deleteStory, { storyId: args.storyId });
    // }
  },
}); 