import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get daily metrics by date
 */
export const getDailyMetricsByDate = internalQuery({
  args: { date: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dailyMetrics")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .unique();
  },
});

/**
 * Get admin users
 */
export const getAdminUsers = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
  },
});

/**
 * Get engagement summaries by date
 */
export const getEngagementSummariesByDate = internalQuery({
  args: { date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dailyEngagementSummary")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

/**
 * Get daily mentions for a user
 */
export const getDailyMentions = internalQuery({
  args: { userId: v.id("users"), date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_target_and_date", (q) =>
        q.eq("targetUserId", args.userId).eq("date", args.date),
      )
      .collect();

    // Get additional details for each mention
    const mentionsWithDetails = [];
    for (const mention of mentions) {
      // Get author details
      const author = await ctx.db.get(mention.actorUserId);
      // Get story details
      const story = await ctx.db.get(mention.storyId);

      if (author && story) {
        mentionsWithDetails.push({
          authorName: author.name || "Someone",
          storyTitle: story.title,
          contentExcerpt: mention.contentExcerpt,
          context: mention.context,
        });
      }
    }

    return mentionsWithDetails;
  },
});

/**
 * Get user email settings
 */
export const getUserEmailSettings = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});
