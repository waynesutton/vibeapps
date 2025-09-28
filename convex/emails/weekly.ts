import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Compute weekly leaderboard by vibes (votes)
 */
export const computeWeeklyMostVibes = internalQuery({
  args: {
    weekStartMs: v.number(),
    weekEndMs: v.number(),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      storyId: v.any(),
      title: v.string(),
      slug: v.string(),
      vibes: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Get votes from the week
    const votes = await ctx.db
      .query("votes")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), args.weekStartMs) &&
          q.lte(q.field("_creationTime"), args.weekEndMs),
      )
      .collect();

    // Count votes by story
    const countByStory: Record<string, number> = {};
    for (const vote of votes) {
      const key = String(vote.storyId);
      countByStory[key] = (countByStory[key] ?? 0) + 1;
    }

    // Sort by vote count and get top entries
    const entries = Object.entries(countByStory)
      .map(([storyId, vibes]) => ({ storyId, vibes }))
      .sort((a, b) => b.vibes - a.vibes)
      .slice(0, args.limit);

    // Fetch story details
    const results = [];
    for (const entry of entries) {
      const story = await ctx.db.get(entry.storyId as any);
      if (story && "title" in story && "slug" in story) {
        results.push({
          storyId: story._id,
          title: story.title as string,
          slug: story.slug as string,
          vibes: entry.vibes,
        });
      }
    }

    return results;
  },
});

/**
 * Send weekly digest to all subscribed users
 */
export const sendWeeklyDigest = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days back to last Monday

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday - 7); // Last week's Monday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Last week's Sunday
    weekEnd.setHours(23, 59, 59, 999);

    // Get top apps from last week
    const topApps = await ctx.runQuery(
      internal.emails.weekly.computeWeeklyMostVibes,
      {
        weekStartMs: weekStart.getTime(),
        weekEndMs: weekEnd.getTime(),
        limit: 10,
      },
    );

    if (topApps.length === 0) {
      console.log("No apps with vibes this week, skipping weekly digest");
      return null;
    }

    // Get all users who haven't unsubscribed from weekly digest
    const users = await ctx.runQuery(internal.emails.weekly.getAllUsers, {});

    for (const user of users) {
      if (!user.email) continue;

      // Check user's email preferences via internal query
      const emailSettings = await ctx.runQuery(
        internal.emails.weekly.getUserEmailSettings,
        { userId: user._id },
      );

      // Skip if user has unsubscribed or disabled weekly digest
      if (
        emailSettings?.unsubscribedAt ||
        emailSettings?.weeklyDigestEmails === false
      ) {
        continue;
      }

      // Check if already sent this week via internal query
      const weekStartDate = weekStart.toISOString().split("T")[0];
      const alreadySent = await ctx.runQuery(
        internal.emails.weekly.checkWeeklyEmailSent,
        { userId: user._id, weekStartMs: weekStart.getTime() },
      );

      if (alreadySent) continue;

      // Generate unsubscribe token for this user
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: user._id,
          purpose: "weekly_digest",
        },
      );

      // Generate weekly digest email
      const emailTemplate = await ctx.runQuery(
        internal.emails.templates.generateWeeklyDigest,
        {
          userId: user._id,
          userName: user.name || "VibeApps User",
          userUsername: user.username,
          topApps: topApps.map((app: any) => ({
            storyId: app.storyId as any, // Type assertion to handle mixed ID types
            storySlug: app.slug,
            title: app.title,
            vibes: app.vibes,
          })),
          unsubscribeToken,
        },
      );

      // Send email
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        emailType: "weekly_digest",
        userId: user._id,
        unsubscribeToken,
        metadata: {
          weekStart: weekStartDate,
          topAppsCount: topApps.length,
        },
      });
    }

    return null;
  },
});

/**
 * Get all users for weekly digest
 */
export const getAllUsers = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
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
 * Check if weekly email was already sent
 */
export const checkWeeklyEmailSent = internalQuery({
  args: {
    userId: v.id("users"),
    weekStartMs: v.number(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailLogs")
      .withIndex("by_user_type_date", (q) =>
        q.eq("userId", args.userId).eq("emailType", "weekly_digest"),
      )
      .filter((q) => q.gte(q.field("sentAt"), args.weekStartMs))
      .first();
  },
});
