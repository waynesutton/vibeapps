import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTotalSubmissions = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const documents = await ctx.db.query("formSubmissions").collect();
    return documents.length;
  },
});

export const getTotalUsers = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const documents = await ctx.db.query("users").collect();
    return documents.length;
  },
});

export const getTotalVotes = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Assuming each document in 'votes' table represents a single vote
    const documents = await ctx.db.query("votes").collect();
    return documents.length;
  },
});

export const getTotalComments = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const documents = await ctx.db.query("comments").collect();
    return documents.length;
  },
});

export const getTotalReports = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const documents = await ctx.db.query("reports").collect();
    return documents.length;
  },
});

export const getTotalSolvedReports = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
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
    const documents = await ctx.db.query("bookmarks").collect();
    return documents.length;
  },
});

export const getTotalRatings = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const documents = await ctx.db.query("storyRatings").collect();
    return documents.length;
  },
});
