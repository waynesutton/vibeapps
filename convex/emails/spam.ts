import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { standardEmailFooter } from "./render";

/**
 * Everything the spam notification email needs about one story.
 */
export const getSpamEmailContext = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.union(
    v.null(),
    v.object({
      storyTitle: v.string(),
      storySlug: v.string(),
      recipientEmail: v.optional(v.string()),
      recipientName: v.string(),
      userId: v.optional(v.id("users")),
      username: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;

    // Prefer the account email; fall back to the email typed on the form
    let recipientEmail: string | undefined = story.email;
    let recipientName = story.submitterName || "there";
    let username: string | undefined;
    if (story.userId) {
      const author = await ctx.db.get(story.userId);
      if (author) {
        recipientEmail = author.email || recipientEmail;
        recipientName = author.name || author.username || recipientName;
        username = author.username;
      }
    }

    return {
      storyTitle: story.title,
      storySlug: story.slug,
      recipientEmail,
      recipientName,
      userId: story.userId,
      username,
    };
  },
});

/**
 * Email the submitter when an admin marks their submission as spam.
 * Includes the reason and a reply-to back to the admins (ADMIN_EMAIL env
 * var) so the submitter can respond if they think it is a mistake.
 */
export const sendSpamNotificationEmail = internalAction({
  args: {
    storyId: v.id("stories"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.emails.spam.getSpamEmailContext,
      { storyId: args.storyId },
    );
    if (!context) {
      console.warn("Spam email skipped: story not found");
      return null;
    }
    if (!context.recipientEmail) {
      console.warn(
        `Spam email skipped: no email for story ${args.storyId} (anonymous submission without email)`,
      );
      return null;
    }

    // Unsubscribe token only exists for account holders; it also enables
    // the List-Unsubscribe header in sendEmail
    let unsubscribeToken: string | undefined;
    if (context.userId) {
      unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        { userId: context.userId, purpose: "all" },
      );
    }

    const subject = `Your submission "${context.storyTitle}" was flagged`;
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px;">
            </div>

            <h1 style="color: #292929; margin-bottom: 10px;">Your submission was flagged</h1>
            <p style="color: #666; margin-bottom: 20px;">Hi ${context.recipientName},</p>
            <p style="color: #666; margin-bottom: 20px;">
              Your submission <strong>${context.storyTitle}</strong> was reviewed and marked as spam,
              so it is no longer visible on VibeApps.
            </p>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #856404; font-size: 16px;">Why it was flagged</h2>
              <p style="margin-bottom: 0; color: #292929;">${args.reason}</p>
            </div>

            <p style="color: #666; margin-bottom: 20px;">
              If you think this is a mistake, use the Request review button on your
              <a href="https://vibeapps.dev/notifications" style="color: #292929;">notifications page</a>,
              reply to this email, or <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #292929;">file an issue on GitHub</a>.
            </p>

            <p style="color: #999; font-size: 13px; margin-top: 40px;">
              VibeApps - The place to share and discover new apps built with AI.
            </p>
            ${standardEmailFooter({ userId: context.userId, username: context.username, unsubscribeToken })}
          </div>
        </body>
      </html>
    `;

    // Reply-to points at the admin inbox when configured
    const replyTo = process.env.ADMIN_EMAIL;

    await ctx.runAction(internal.emails.resend.sendEmail, {
      to: context.recipientEmail,
      subject,
      html,
      emailType: "spam_notification" as const,
      userId: context.userId,
      unsubscribeToken,
      replyTo,
      metadata: {
        storyId: args.storyId,
        reason: args.reason,
      },
    });

    console.log(
      `Spam notification email sent to ${context.recipientEmail} for story ${args.storyId}`,
    );
    return null;
  },
});

/**
 * Everything the admin review-request email needs about the disputed story.
 */
export const getSpamReviewRequestContext = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.union(
    v.null(),
    v.object({
      storyTitle: v.string(),
      storySlug: v.string(),
      spamReason: v.optional(v.string()),
      autoMarked: v.boolean(),
      submitterName: v.string(),
      submitterUsername: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;

    let submitterName = story.submitterName || "Unknown submitter";
    let submitterUsername: string | undefined;
    if (story.userId) {
      const author = await ctx.db.get(story.userId);
      if (author) {
        submitterName = author.name || author.username || submitterName;
        submitterUsername = author.username;
      }
    }

    return {
      storyTitle: story.title,
      storySlug: story.slug,
      spamReason: story.spamReason,
      autoMarked: story.spamMarkedByAgent === true,
      submitterName,
      submitterUsername,
    };
  },
});

/**
 * Email admins/managers when a submitter disputes a spam mark. Mirrors the
 * report notification flow: per-admin unsubscribe token, unified footer,
 * and a skip for admins who unsubscribed from all emails. Gated by the
 * spam_review_request per-type toggle plus the global master switch.
 */
export const sendSpamReviewRequestEmails = internalAction({
  args: {
    storyId: v.id("stories"),
    requesterUserId: v.id("users"),
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.emails.spam.getSpamReviewRequestContext,
      { storyId: args.storyId },
    );
    if (!context) {
      console.warn("Spam review request email skipped: story not found");
      return null;
    }

    const storyUrl = `https://vibeapps.dev/s/${context.storySlug}`;
    const dashboardUrl = "https://vibeapps.dev/admin?tab=spam";

    for (const adminUserId of args.adminUserIds) {
      const admin = await ctx.runQuery(internal.emails.reports.getUserDetails, {
        userId: adminUserId,
      });
      if (!admin || !admin.email) {
        console.warn(`Admin user ${adminUserId} not found or has no email`);
        continue;
      }

      // Respect the admin's own unsubscribe (master switch on their account)
      const emailSettings = await ctx.runQuery(
        internal.emails.helpers.getUserEmailSettings,
        { userId: adminUserId },
      );
      if (emailSettings?.unsubscribedAt) {
        continue;
      }

      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        { userId: adminUserId, purpose: "all" },
      );

      const subject = `Spam review requested: "${context.storyTitle}"`;
      const html = `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px;">
              </div>

              <h1 style="color: #292929; margin-bottom: 10px;">Spam review requested</h1>
              <p style="color: #666; margin-bottom: 20px;">Hi ${admin.name || "Admin"},</p>
              <p style="color: #666; margin-bottom: 20px;">
                ${context.submitterName}${context.submitterUsername ? ` (@${context.submitterUsername})` : ""}
                is disputing the spam mark on their submission and asked for a human review.
              </p>

              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h2 style="margin-top: 0; color: #856404; font-size: 16px;">${context.storyTitle}</h2>
                <p style="margin: 5px 0; color: #292929;"><strong>Spam reason:</strong> ${context.spamReason || "Not recorded"}</p>
                <p style="margin: 5px 0; color: #292929;"><strong>Marked by:</strong> ${context.autoMarked ? "Automatic spam agent" : "An admin"}</p>
                <p style="margin: 5px 0;"><a href="${storyUrl}" style="color: #292929;">View the submission</a></p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="display: inline-block; background: #292929; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">Review in the spam dashboard</a>
              </div>

              <p style="color: #666; font-size: 12px; text-align: center;">
                You received this email because you are an administrator at VibeApps.
              </p>
              ${standardEmailFooter({ userId: adminUserId, username: admin.username, unsubscribeToken })}
            </div>
          </body>
        </html>
      `;

      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: admin.email,
        subject,
        html,
        emailType: "spam_review_request" as const,
        userId: adminUserId,
        unsubscribeToken,
        metadata: {
          storyId: args.storyId,
          requesterUserId: args.requesterUserId,
        },
      });

      console.log(`Spam review request email sent to admin ${admin.email}`);
    }

    return null;
  },
});
