import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Manual test function to debug daily user email flow
 * Call this from the Convex dashboard to test
 */
export const testDailyUserEmailFlow = internalAction({
  args: {},
  returns: v.object({
    status: v.string(),
    engagementSummariesCount: v.number(),
    mentionedUsersCount: v.number(),
    usersToEmailCount: v.number(),
    emailsSent: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const errors: string[] = [];
    let emailsSent = 0;

    console.log("[TEST] Starting daily user email flow test for date:", today);

    // Get all users who had engagement today
    const engagementSummaries = await ctx.runQuery(
      internal.emails.helpers.getEngagementSummariesByDate,
      { date: today },
    );
    console.log(
      "[TEST] Engagement summaries found:",
      engagementSummaries.length,
    );

    // Get all users who were mentioned today (for users without engagement)
    const allMentionedUsers = await ctx.runQuery(
      internal.emails.daily.getUsersWithMentionsToday,
      { date: today },
    );
    console.log("[TEST] Users with mentions found:", allMentionedUsers.length);

    // Combine users with engagement and users with mentions
    const usersToEmail = new Set();

    // Add users with engagement
    for (const summary of engagementSummaries) {
      usersToEmail.add(summary.userId);
      console.log("[TEST] Added user with engagement:", summary.userId);
    }

    // Add users with mentions
    for (const userId of allMentionedUsers) {
      usersToEmail.add(userId);
      console.log("[TEST] Added user with mentions:", userId);
    }

    console.log(
      "[TEST] Total unique users to potentially email:",
      usersToEmail.size,
    );

    for (const userId of usersToEmail) {
      try {
        const user = await ctx.runQuery(
          internal.emails.queries.getUserWithEmail,
          { userId: userId as any },
        );
        if (!user) {
          errors.push(`User ${userId} not found or has no email`);
          console.log("[TEST] User not found or no email:", userId);
          continue;
        }

        console.log("[TEST] Processing user:", user.email);

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
          errors.push(`User ${user.email} has disabled engagement emails`);
          console.log(
            "[TEST] User has disabled engagement emails:",
            user.email,
          );
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
          errors.push(`Already sent email to ${user.email} today`);
          console.log("[TEST] Already sent email today:", user.email);
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
        console.log("[TEST] Mentions for user:", mentions.length);

        // Get replies to this user's comments
        const replies = await ctx.runQuery(
          internal.emails.helpers.getDailyReplies,
          { userId: userId as any, date: today },
        );
        console.log("[TEST] Replies for user:", replies.length);

        // Skip if no engagement, no mentions, no replies
        if (!userEngagement && mentions.length === 0 && replies.length === 0) {
          errors.push(`User ${user.email} has no engagement/mentions/replies`);
          console.log(
            "[TEST] No engagement/mentions/replies for user:",
            user.email,
          );
          continue;
        }

        console.log("[TEST] User qualifies for email:", user.email);
        console.log("[TEST] Engagement:", userEngagement?.totalEngagement || 0);
        console.log("[TEST] Mentions:", mentions.length);
        console.log("[TEST] Replies:", replies.length);

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

        console.log("[TEST] Generated email template, sending to:", user.email);

        // Send email
        const result = await ctx.runAction(internal.emails.resend.sendEmail, {
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

        if (result.success) {
          emailsSent++;
          console.log("[TEST] Email sent successfully to:", user.email);
        } else {
          errors.push(`Failed to send email to ${user.email}: ${result.error}`);
          console.log("[TEST] Failed to send email:", result.error);
        }
      } catch (error) {
        errors.push(`Error processing user ${userId}: ${error}`);
        console.log("[TEST] Error processing user:", error);
      }
    }

    console.log("[TEST] Test complete. Emails sent:", emailsSent);

    return {
      status: "complete",
      engagementSummariesCount: engagementSummaries.length,
      mentionedUsersCount: allMentionedUsers.length,
      usersToEmailCount: usersToEmail.size,
      emailsSent,
      errors,
    };
  },
});
