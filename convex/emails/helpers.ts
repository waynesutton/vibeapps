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
 * Get judge notes created today on the author's submissions
 */
export const getDailyJudgeNotesForAuthor = internalQuery({
  args: { userId: v.id("users"), date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Resolve author's stories
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (stories.length === 0) return [];

    const storyIdSet = new Set(stories.map((s) => s._id));

    // Day bounds
    const date = new Date(args.date);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(date.setHours(23, 59, 59, 999)).getTime();

    // Find submission notes on these stories created today
    // Note: submissionNotes doesn't have a by_storyId index, so we filter in memory after collect
    const allNotesToday = await ctx.db
      .query("submissionNotes")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const notesForAuthorStories = allNotesToday.filter((n) =>
      storyIdSet.has(n.storyId),
    );

    if (notesForAuthorStories.length === 0) return [];

    const results: Array<{
      judgeName: string;
      storyTitle: string;
      contentExcerpt: string;
    }> = [];
    for (const note of notesForAuthorStories) {
      const judge = await ctx.db.get(note.judgeId);
      const story = await ctx.db.get(note.storyId);
      if (!story) continue;
      results.push({
        judgeName: judge?.name || "Judge",
        storyTitle: story.title,
        contentExcerpt: String(note.content || "").slice(0, 200),
      });
    }

    return results;
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

/**
 * Get DM messages received by a user in a time range with sender info
 */
export const getDMsReceivedByUser = internalQuery({
  args: {
    userId: v.id("users"),
    startTime: v.number(),
    endTime: v.number(),
  },
  returns: v.array(
    v.object({
      senderId: v.id("users"),
      senderName: v.string(),
      messageCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Get all DM messages in the time range
    const messages = await ctx.db
      .query("dmMessages")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), args.startTime) &&
          q.lte(q.field("_creationTime"), args.endTime),
      )
      .collect();

    // Filter for messages where this user is a recipient (not the sender)
    const receivedMessages = [];
    for (const message of messages) {
      // Skip messages sent by this user
      if (message.senderId === args.userId) continue;

      // Check if this user is in the conversation
      const conversation = await ctx.db.get(message.conversationId);
      if (!conversation) continue;

      // Check if this user is a participant (userAId or userBId)
      const participants = [conversation.userAId, conversation.userBId];
      if (participants.includes(args.userId)) {
        receivedMessages.push(message);
      }
    }

    // Group by sender and count messages
    const senderCounts = new Map<any, number>();
    for (const message of receivedMessages) {
      const senderId = message.senderId;
      senderCounts.set(senderId, (senderCounts.get(senderId) || 0) + 1);
    }

    // Get sender names and build result
    const result: Array<{
      senderId: any;
      senderName: string;
      messageCount: number;
    }> = [];

    for (const [senderId, count] of senderCounts.entries()) {
      const sender = await ctx.db.get(senderId);
      if (sender && "name" in sender) {
        result.push({
          senderId: sender._id,
          senderName: sender.name || "Someone",
          messageCount: count,
        });
      }
    }

    return result;
  },
});
