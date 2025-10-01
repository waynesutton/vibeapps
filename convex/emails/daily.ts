import {
  internalAction,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Get all story authors for engagement processing
 */
export const getStoryAuthors = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("stories"),
      userId: v.optional(v.id("users")),
      title: v.string(),
      slug: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const stories = await ctx.db
      .query("stories")
      .filter((q) => q.neq(q.field("userId"), undefined))
      .collect();

    // Transform to only return the fields we need
    return stories.map((story) => ({
      _id: story._id,
      userId: story.userId,
      title: story.title,
      slug: story.slug,
    }));
  },
});

/**
 * Calculate daily metrics for admin email
 */
export const calculateDailyMetrics = internalQuery({
  args: { date: v.string() },
  returns: v.object({
    date: v.string(),
    newSubmissions: v.number(),
    newUsers: v.number(),
    totalUsers: v.number(),
    dailyVotes: v.number(),
    dailyComments: v.number(),
    dailyRatings: v.number(),
    dailyBookmarks: v.number(),
    dailyFollows: v.number(),
    activeUsers: v.number(),
    pendingReports: v.number(),
    resolvedReports: v.number(),
  }),
  handler: async (ctx, args) => {
    const today = new Date(args.date);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

    // Calculate metrics using existing admin queries patterns
    const newSubmissions = await ctx.db
      .query("stories")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const newUsers = await ctx.db
      .query("users")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const totalUsers = await ctx.db.query("users").collect();

    const dailyVotes = await ctx.db
      .query("votes")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyComments = await ctx.db
      .query("comments")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyRatings = await ctx.db
      .query("storyRatings")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyBookmarks = await ctx.db
      .query("bookmarks")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyFollows = await ctx.db
      .query("follows")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const pendingReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const resolvedReports = await ctx.db
      .query("reports")
      .filter(
        (q) =>
          q.or(
            q.eq(q.field("status"), "resolved_hidden"),
            q.eq(q.field("status"), "resolved_deleted"),
          ) &&
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    return {
      date: args.date,
      newSubmissions: newSubmissions.length,
      newUsers: newUsers.length,
      totalUsers: totalUsers.length,
      dailyVotes: dailyVotes.length,
      dailyComments: dailyComments.length,
      dailyRatings: dailyRatings.length,
      dailyBookmarks: dailyBookmarks.length,
      dailyFollows: dailyFollows.length,
      activeUsers: 0, // TODO: Implement user activity tracking
      pendingReports: pendingReports.length,
      resolvedReports: resolvedReports.length,
    };
  },
});

/**
 * Store daily metrics snapshot
 */
export const storeDailyMetrics = internalMutation({
  args: {
    date: v.string(),
    metrics: v.object({
      date: v.string(),
      newSubmissions: v.number(),
      newUsers: v.number(),
      totalUsers: v.number(),
      dailyVotes: v.number(),
      dailyComments: v.number(),
      dailyRatings: v.number(),
      dailyBookmarks: v.number(),
      dailyFollows: v.number(),
      activeUsers: v.number(),
      pendingReports: v.number(),
      resolvedReports: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if metrics already exist for this date
    const existing = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args.metrics);
    } else {
      await ctx.db.insert("dailyMetrics", args.metrics);
    }
    return null;
  },
});

/**
 * Process daily engagement for users
 */
export const processUserEngagement = internalAction({
  args: { date: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`Processing user engagement for date: ${args.date}`);

    // Use internal query to get story authors
    const storyAuthors = await ctx.runQuery(
      internal.emails.daily.getStoryAuthors,
      {},
    );
    console.log(`Found ${storyAuthors.length} stories with authors`);

    // Process engagement for each user via internal mutation
    await ctx.runMutation(internal.emails.daily.processEngagementForAllUsers, {
      date: args.date,
      storyAuthors,
    });

    console.log(`Engagement processing complete for ${args.date}`);
    return null;
  },
});

/**
 * Process engagement for all users (internal mutation)
 */
export const processEngagementForAllUsers = internalMutation({
  args: {
    date: v.string(),
    storyAuthors: v.array(
      v.object({
        _id: v.id("stories"),
        userId: v.optional(v.id("users")),
        title: v.string(),
        slug: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const today = new Date(args.date);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

    const uniqueAuthorIds = [
      ...new Set(args.storyAuthors.map((s) => s.userId)),
    ];
    console.log(
      `Processing engagement for ${uniqueAuthorIds.length} unique authors`,
    );

    let usersWithEngagement = 0;

    for (const userId of uniqueAuthorIds) {
      if (!userId) continue;

      const userStories = args.storyAuthors.filter((s) => s.userId === userId);
      let totalEngagement = 0;
      const storyEngagements = [];

      for (const story of userStories) {
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_story", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const ratings = await ctx.db
          .query("storyRatings")
          .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const comments = await ctx.db
          .query("comments")
          .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const bookmarks = await ctx.db
          .query("bookmarks")
          .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const storyEngagement =
          votes.length + ratings.length + comments.length + bookmarks.length;
        totalEngagement += storyEngagement;

        if (storyEngagement > 0) {
          storyEngagements.push({
            storyId: story._id,
            storySlug: story.slug,
            storyTitle: story.title,
            votes: votes.length,
            ratings: ratings.length,
            comments: comments.length,
            bookmarks: bookmarks.length,
          });
        }
      }

      if (totalEngagement > 0) {
        await ctx.db.insert("dailyEngagementSummary", {
          userId,
          date: args.date,
          votesReceived: storyEngagements.reduce((sum, s) => sum + s.votes, 0),
          ratingsReceived: storyEngagements.reduce(
            (sum, s) => sum + s.ratings,
            0,
          ),
          commentsReceived: storyEngagements.reduce(
            (sum, s) => sum + s.comments,
            0,
          ),
          bookmarksReceived: storyEngagements.reduce(
            (sum, s) => sum + s.bookmarks,
            0,
          ),
          totalEngagement,
          storyEngagements,
        });
        usersWithEngagement++;
      }
    }

    console.log(
      `Created ${usersWithEngagement} engagement summaries for ${args.date}`,
    );
    return null;
  },
});

/**
 * Store user engagement summary
 */
export const storeUserEngagement = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    votesReceived: v.number(),
    ratingsReceived: v.number(),
    commentsReceived: v.number(),
    bookmarksReceived: v.number(),
    totalEngagement: v.number(),
    storyEngagements: v.array(
      v.object({
        storyId: v.id("stories"),
        storyTitle: v.string(),
        votes: v.number(),
        ratings: v.number(),
        comments: v.number(),
        bookmarks: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if engagement summary already exists for this user and date
    const existing = await ctx.db
      .query("dailyEngagementSummary")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .unique();

    const data = {
      userId: args.userId,
      date: args.date,
      votesReceived: args.votesReceived,
      ratingsReceived: args.ratingsReceived,
      commentsReceived: args.commentsReceived,
      bookmarksReceived: args.bookmarksReceived,
      totalEngagement: args.totalEngagement,
      storyEngagements: args.storyEngagements,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("dailyEngagementSummary", data);
    }
    return null;
  },
});

/**
 * Send daily admin email
 */
export const sendDailyAdminEmail = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    // Calculate today's metrics
    const metrics = await ctx.runQuery(
      internal.emails.daily.calculateDailyMetrics,
      {
        date: today,
      },
    );

    // Store metrics for historical tracking
    await ctx.runMutation(internal.emails.daily.storeDailyMetrics, {
      date: today,
      metrics,
    });

    // Get previous day's metrics for comparison
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const previousMetrics = await ctx.runQuery(
      internal.emails.helpers.getDailyMetricsByDate,
      { date: yesterday },
    );

    // Get admin users (users with admin role)
    const adminUsers = await ctx.runQuery(
      internal.emails.helpers.getAdminUsers,
      {},
    );

    // Send email to each admin
    for (const admin of adminUsers) {
      if (!admin.email) continue;

      // Generate unsubscribe token for this admin
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: admin._id,
          purpose: "all",
        },
      );

      // Generate personalized email template for this admin
      const personalizedEmailTemplate = await ctx.runQuery(
        internal.emails.templates.generateDailyAdminEmail,
        {
          userId: admin._id,
          userName: admin.name,
          userUsername: admin.username,
          metrics,
          previousMetrics,
          unsubscribeToken,
        },
      );

      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: admin.email,
        subject: personalizedEmailTemplate.subject,
        html: personalizedEmailTemplate.html,
        emailType: "daily_admin",
        userId: admin._id,
        unsubscribeToken,
        metadata: { date: today },
      });
    }

    return null;
  },
});

/**
 * Send daily user engagement emails
 */
export const sendDailyUserEmails = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    console.log(`Daily user emails: Starting for date ${today}`);

    // Get all users who had engagement today
    const engagementSummaries = await ctx.runQuery(
      internal.emails.helpers.getEngagementSummariesByDate,
      { date: today },
    );
    console.log(
      `Daily user emails: Found ${engagementSummaries.length} engagement summaries`,
    );

    // Get all users who were mentioned today (for users without engagement)
    const allMentionedUsers = await ctx.runQuery(
      internal.emails.daily.getUsersWithMentionsToday,
      { date: today },
    );
    console.log(
      `Daily user emails: Found ${allMentionedUsers.length} users with mentions`,
    );

    // Combine users with engagement and users with mentions
    const usersToEmail = new Set();

    // Add users with engagement
    for (const summary of engagementSummaries) {
      usersToEmail.add(summary.userId);
    }

    // Add users with mentions
    for (const userId of allMentionedUsers) {
      usersToEmail.add(userId);
    }

    console.log(
      `Daily user emails: ${usersToEmail.size} unique users to process`,
    );

    let emailsSent = 0;
    let emailsSkipped = 0;

    for (const userId of usersToEmail) {
      const user = await ctx.runQuery(
        internal.emails.queries.getUserWithEmail,
        { userId: userId as any },
      );
      if (!user) {
        console.log(`Skipped user ${userId}: No user or no email address`);
        emailsSkipped++;
        continue;
      }

      // Check email preferences
      const emailSettings = await ctx.runQuery(
        internal.emails.helpers.getUserEmailSettings,
        { userId: userId as any },
      );

      // Skip if user has unsubscribed or disabled engagement emails
      if (
        emailSettings?.unsubscribedAt ||
        emailSettings?.dailyEngagementEmails === false
      ) {
        console.log(
          `Skipped user ${user.name || userId}: Unsubscribed or disabled engagement emails`,
        );
        emailsSkipped++;
        continue;
      }

      // Check if already sent today
      const alreadySent = await ctx.runQuery(
        internal.emails.queries.hasReceivedEmailToday,
        {
          userId: userId as any,
          emailType: "daily_engagement",
        },
      );

      if (alreadySent) {
        console.log(`Skipped user ${user.name || userId}: Already sent today`);
        emailsSkipped++;
        continue;
      }

      // Get engagement summary for this user
      const userEngagement = engagementSummaries.find(
        (s: any) => s.userId === userId,
      );

      // Get mentions for this user
      const mentions = await ctx.runQuery(
        internal.emails.helpers.getDailyMentions,
        { userId: userId as any, date: today },
      );

      // Get replies to this user's comments
      const replies = await ctx.runQuery(
        internal.emails.helpers.getDailyReplies,
        { userId: userId as any, date: today },
      );

      console.log(
        `User ${user.name || userId} data: engagement=${!!userEngagement}, mentions=${mentions.length}, replies=${replies.length}`,
      );

      // Skip if no engagement, no mentions, no replies
      if (!userEngagement && mentions.length === 0 && replies.length === 0) {
        console.log(
          `Skipped user ${user.name || userId}: No engagement, mentions, or replies`,
        );
        emailsSkipped++;
        continue;
      }

      console.log(
        `Sending email to ${user.name || userId}: ${userEngagement ? "engagement" : ""}${mentions.length > 0 ? " mentions" : ""}${replies.length > 0 ? " replies" : ""}`,
      );

      // Generate unsubscribe token for this user
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: userId as any,
          purpose: "daily_engagement",
        },
      );

      // Build pin/admin message sections for this user from alerts today
      const startOfDay = new Date(today + "T00:00:00Z").getTime();
      const endOfDay = new Date(today + "T23:59:59Z").getTime();

      const todaysAlerts = await ctx.runQuery(internal.alerts.getUserAlerts, {
        userId: user._id,
        startTime: startOfDay,
        endTime: endOfDay,
      });

      const pinnedStoryIds = todaysAlerts
        .filter((a: any) => a.type === "pinned" && a.storyId)
        .map((a: any) => a.storyId as any);
      const adminMsgStoryIds = todaysAlerts
        .filter((a: any) => a.type === "admin_message" && a.storyId)
        .map((a: any) => a.storyId as any);

      const pinnedStories: Array<{ storyTitle: string }> = [];
      for (const sid of pinnedStoryIds) {
        const s = await ctx.runQuery(internal.stories.getStoryById, {
          storyId: sid,
        });
        if (s) pinnedStories.push({ storyTitle: s.title });
      }
      const adminMessages: Array<{ storyTitle: string }> = [];
      for (const sid of adminMsgStoryIds) {
        const s = await ctx.runQuery(internal.stories.getStoryById, {
          storyId: sid,
        });
        if (s) adminMessages.push({ storyTitle: s.title });
      }

      // Generate engagement email with mentions and admin actions
      const emailTemplate = await ctx.runQuery(
        internal.emails.templates.generateEngagementEmail,
        {
          userId: userId as any,
          userName: user.name || "there",
          userUsername: user.username,
          engagementSummary: userEngagement
            ? {
                totalEngagement: userEngagement.totalEngagement,
                storyEngagements: userEngagement.storyEngagements,
              }
            : {
                totalEngagement: 0,
                storyEngagements: [],
              },
          mentions: mentions.length > 0 ? mentions : undefined,
          replies: replies.length > 0 ? replies : undefined,
          pinnedStories: pinnedStories.length > 0 ? pinnedStories : undefined,
          adminMessages: adminMessages.length > 0 ? adminMessages : undefined,
          unsubscribeToken,
        },
      );

      // Send email
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        emailType: "daily_engagement",
        userId: user._id,
        unsubscribeToken,
        metadata: {
          date: today,
          totalEngagement: userEngagement?.totalEngagement || 0,
          mentionsCount: mentions.length,
          repliesCount: replies.length,
        },
      });

      emailsSent++;
    }

    console.log(
      `Daily user emails complete: ${emailsSent} emails sent, ${emailsSkipped} skipped`,
    );
    return null;
  },
});

/**
 * Get all users who were mentioned today
 */
export const getUsersWithMentionsToday = internalQuery({
  args: { date: v.string() },
  returns: v.array(v.id("users")),
  handler: async (ctx, args) => {
    const mentions = await ctx.db
      .query("mentions")
      .filter((q) => q.eq(q.field("date"), args.date))
      .collect();

    // Get unique user IDs
    const userIds = [...new Set(mentions.map((m) => m.targetUserId))];
    return userIds;
  },
});
