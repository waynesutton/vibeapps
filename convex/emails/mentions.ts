import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Send mention notification emails to mentioned users
 * @deprecated - Mentions are now included in daily digest emails instead of immediate notifications
 */
export const sendMentionNotifications = internalAction({
  args: {
    context: v.union(v.literal("comment"), v.literal("judge_note")),
    storyId: v.id("stories"),
    authorId: v.id("users"),
    rawText: v.string(),
    permalink: v.string(),
    resolvedTargets: v.array(
      v.object({ handle: v.string(), userId: v.id("users") }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get story details for email context
    const story = await ctx.runQuery(internal.emails.mentions.getStoryDetails, {
      storyId: args.storyId,
    });
    if (!story) {
      console.error("Story not found for mention notification");
      return null;
    }

    // Get author details
    const author = await ctx.runQuery(internal.emails.mentions.getUserDetails, {
      userId: args.authorId,
    });
    if (!author) {
      console.error("Author not found for mention notification");
      return null;
    }

    // Process each mentioned user
    for (const target of args.resolvedTargets) {
      try {
        // Skip self-mentions
        if (target.userId === args.authorId) continue;

        // Get target user details with email
        const targetUser = await ctx.runQuery(
          internal.emails.queries.getUserWithEmail,
          { userId: target.userId },
        );
        if (!targetUser) continue;

        // Check if user has mention notifications enabled
        const emailSettings = await ctx.runQuery(
          internal.emails.mentions.getUserEmailSettings,
          { userId: target.userId },
        );
        if (emailSettings?.mentionNotifications === false) continue;

        // Check daily email rate limit (max 10 mention emails per day per user)
        const today = new Date().toISOString().split("T")[0];
        const dailyEmailCount = await ctx.runQuery(
          internal.emails.mentions.getMentionEmailCount,
          { userId: target.userId, date: today },
        );
        if (dailyEmailCount >= 10) {
          console.log(
            `Mention email rate limit reached for user ${target.userId}`,
          );
          continue;
        }

        // Generate mention email
        const emailTemplate = await ctx.runQuery(
          internal.emails.templates.generateMentionEmail,
          {
            userId: target.userId,
            userName: targetUser.name || "VibeApps User",
            userUsername: targetUser.username,
            mentionAuthor: author.name || "Someone",
            storyTitle: story.title,
            contentExcerpt: args.rawText.slice(0, 200),
            permalink: args.permalink,
            context: args.context,
          },
        );

        // Send mention notification email
        await ctx.runAction(internal.emails.resend.sendEmail, {
          to: targetUser.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          emailType: "mention_notification",
          userId: target.userId,
          metadata: {
            mentionAuthor: author.name,
            storyId: args.storyId,
            context: args.context,
          },
        });
      } catch (error) {
        console.error(
          `Failed to send mention email to user ${target.userId}:`,
          error,
        );
        // Continue with other users
      }
    }

    return null;
  },
});

/**
 * Get story details for mention emails
 */
export const getStoryDetails = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;
    return {
      title: story.title,
      slug: story.slug,
    };
  },
});

/**
 * Get user details for mention emails
 */
export const getUserDetails = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      name: v.optional(v.string()),
      username: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      name: user.name,
      username: user.username,
    };
  },
});

/**
 * Get user email settings for mention notifications
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
 * Get mention email count for rate limiting
 */
export const getMentionEmailCount = internalQuery({
  args: { userId: v.id("users"), date: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const today = new Date(args.date);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

    const emails = await ctx.db
      .query("emailLogs")
      .withIndex("by_user_type_date", (q) =>
        q.eq("userId", args.userId).eq("emailType", "mention_notification"),
      )
      .filter(
        (q) =>
          q.gte(q.field("sentAt"), startOfDay) &&
          q.lte(q.field("sentAt"), endOfDay),
      )
      .collect();

    return emails.length;
  },
});
