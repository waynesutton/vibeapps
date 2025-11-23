import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminRole } from "./users";

export const getTotalSubmissions = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const documents = await ctx.db.query("stories").collect();
    return documents.length;
  },
});

export const getTotalUsers = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const documents = await ctx.db.query("users").collect();
    return documents.length;
  },
});

export const getTotalVotes = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    // Assuming each document in 'votes' table represents a single vote
    const documents = await ctx.db.query("votes").collect();
    return documents.length;
  },
});

export const getTotalComments = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const documents = await ctx.db.query("comments").collect();
    return documents.length;
  },
});

export const getTotalReports = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const documents = await ctx.db.query("reports").collect();
    return documents.length;
  },
});

export const getTotalSolvedReports = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    // Assumes 'reports' table has a 'status' field and an index 'by_status'.
    // Changed to check for multiple resolved statuses based on schema
    const resolvedStatuses = ["resolved_hidden", "resolved_deleted"];
    let solvedCount = 0;
    for (const status of resolvedStatuses) {
      const reportsInStatus = await ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", status as any)) // Cast status as any to satisfy literal type, or use a loop with specific literal checks
        .collect();
      solvedCount += reportsInStatus.length;
    }
    return solvedCount;
  },
});

export const getTotalBookmarks = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const documents = await ctx.db.query("bookmarks").collect();
    return documents.length;
  },
});

export const getTotalRatings = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const documents = await ctx.db.query("storyRatings").collect();
    return documents.length;
  },
});

// Get user growth data over time for chart
export const getUserGrowthData = query({
  args: {},
  returns: v.array(
    v.object({
      date: v.string(),
      count: v.number(),
      cumulative: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    
    // Get all users sorted by creation time
    const users = await ctx.db
      .query("users")
      .order("asc")
      .collect();

    if (users.length === 0) {
      return [];
    }

    // Group users by date
    const usersByDate = new Map<string, number>();
    
    for (const user of users) {
      const date = new Date(user._creationTime);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      usersByDate.set(dateKey, (usersByDate.get(dateKey) || 0) + 1);
    }

    // Convert to sorted array with cumulative counts
    const sortedDates = Array.from(usersByDate.keys()).sort();
    let cumulative = 0;
    
    const growthData = sortedDates.map(date => {
      const count = usersByDate.get(date) || 0;
      cumulative += count;
      
      return {
        date,
        count,
        cumulative,
      };
    });

    return growthData;
  },
});
