import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

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
    }),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;

    // Prefer the account email; fall back to the email typed on the form
    let recipientEmail: string | undefined = story.email;
    let recipientName = story.submitterName || "there";
    if (story.userId) {
      const author = await ctx.db.get(story.userId);
      if (author) {
        recipientEmail = author.email || recipientEmail;
        recipientName = author.name || author.username || recipientName;
      }
    }

    return {
      storyTitle: story.title,
      storySlug: story.slug,
      recipientEmail,
      recipientName,
      userId: story.userId,
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
              If you think this is a mistake, reply to this email and an admin will take another look,
              or <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #292929;">file an issue on GitHub</a>.
            </p>

            <p style="color: #999; font-size: 13px; margin-top: 40px;">
              VibeApps - The place to share and discover new apps built with AI.
            </p>
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
