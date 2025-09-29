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
 * Get daily replies to a user's comments
 */
export const getDailyReplies = internalQuery({
  args: { userId: v.id("users"), date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const date = new Date(args.date);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(date.setHours(23, 59, 59, 999)).getTime();

    // Find comments authored by the user
    const myComments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const myCommentIds = new Set(myComments.map((c) => c._id));

    if (myCommentIds.size === 0) return [];

    // Find replies to those comments created today
    const replies = await ctx.db
      .query("comments")
      .filter(
        (q) =>
          q.neq(q.field("parentId"), undefined) &&
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const todaysRepliesToMe = replies.filter(
      (r) => r.parentId && myCommentIds.has(r.parentId),
    );

    const withDetails = [] as Array<{
      replierName: string;
      storyTitle: string;
      contentExcerpt: string;
    }>;

    for (const reply of todaysRepliesToMe) {
      const replier = await ctx.db.get(reply.userId);
      const story = await ctx.db.get(reply.storyId);
      if (replier && story) {
        withDetails.push({
          replierName: replier.name || "Someone",
          storyTitle: story.title,
          contentExcerpt: reply.content.slice(0, 200),
        });
      }
    }

    return withDetails;
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
