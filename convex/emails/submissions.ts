import {
  internalAction,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { requireJudgingGroupPermission } from "../adminAccess";
import { EMAIL_TYPE_DEFAULTS, emailTypeSettingKey } from "./emailTypes";
import { standardEmailFooter, type EmailFooterOpts } from "./render";

// Submission emails: submitter confirmation on submit, per-group organizer
// alert, and the results-live blast. All sends route through
// emails/resend.sendEmail, which enforces the global master switch and the
// per-type toggles from the admin Email dashboard, so triggers stay simple.

// Branded shell with the shared footer. footerOpts carries the recipient's
// user context so Manage email preferences and Unsubscribe link correctly;
// one-click unsubscribe rides on the List-Unsubscribe header added by
// sendEmail when an unsubscribeToken is passed.
function emailShell(body: string, footerOpts: EmailFooterOpts = {}): string {
  return `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px;">
            </div>
            ${body}
            <p style="color: #999; font-size: 13px; margin-top: 40px;">
              VibeApps - The place to share and discover new apps built with AI.
            </p>
            ${standardEmailFooter(footerOpts)}
          </div>
        </body>
      </html>
    `;
}

/**
 * Everything the confirmation and admin-alert emails need about one story.
 */
export const getSubmissionEmailContext = internalQuery({
  args: {
    storyId: v.id("stories"),
    groupId: v.optional(v.id("judgingGroups")),
  },
  returns: v.union(
    v.null(),
    v.object({
      storyTitle: v.string(),
      storySlug: v.string(),
      recipientEmail: v.optional(v.string()),
      recipientName: v.string(),
      userId: v.optional(v.id("users")),
      username: v.optional(v.string()),
      groupName: v.optional(v.string()),
      groupSlug: v.optional(v.string()),
      notificationEmails: v.array(v.string()),
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

    const group = args.groupId ? await ctx.db.get(args.groupId) : null;

    return {
      storyTitle: story.title,
      storySlug: story.slug,
      recipientEmail,
      recipientName,
      userId: story.userId,
      username,
      groupName: group?.name,
      groupSlug: group?.slug,
      notificationEmails: group?.notificationEmails ?? [],
    };
  },
});

/**
 * Confirmation email to the submitter right after stories.submit. Gated
 * centrally by the master switch and the submission_confirmation toggle.
 */
export const sendSubmissionConfirmationEmail = internalAction({
  args: {
    storyId: v.id("stories"),
    groupId: v.optional(v.id("judgingGroups")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.emails.submissions.getSubmissionEmailContext,
      { storyId: args.storyId, groupId: args.groupId },
    );
    if (!context || !context.recipientEmail) {
      console.log(
        `Submission confirmation skipped for ${args.storyId}: no recipient email`,
      );
      return null;
    }

    // Unsubscribe token only exists for account holders
    let unsubscribeToken: string | undefined;
    if (context.userId) {
      unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        { userId: context.userId, purpose: "all" },
      );
    }

    const eventLine = context.groupName
      ? `to <strong>${context.groupName}</strong>`
      : "to VibeApps";
    const storyUrl = `https://vibeapps.dev/s/${context.storySlug}`;

    const html = emailShell(`
            <h1 style="color: #292929; margin-bottom: 10px;">Submission received</h1>
            <p style="color: #666; margin-bottom: 20px;">Hi ${context.recipientName},</p>
            <p style="color: #666; margin-bottom: 20px;">
              Your submission <strong>${context.storyTitle}</strong> ${eventLine} was received
              and is pending review.
            </p>
            <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #292929; font-size: 16px;">What happens next</h2>
              <p style="margin-bottom: 0; color: #666;">
                ${
                  context.groupName
                    ? "Judges will review your project during the event. Keep your live app and repo available so reviews go smoothly."
                    : "Your submission is live on VibeApps and may be reviewed by moderators."
                }
              </p>
            </div>
            <p style="color: #666; margin-bottom: 20px;">
              You can view your submission here:
              <a href="${storyUrl}" style="color: #292929;">${storyUrl}</a>
            </p>`, {
      userId: context.userId,
      username: context.username,
      unsubscribeToken,
    });

    await ctx.runAction(internal.emails.resend.sendEmail, {
      to: context.recipientEmail,
      subject: `Submission received: ${context.storyTitle}`,
      html,
      emailType: "submission_confirmation" as const,
      userId: context.userId,
      unsubscribeToken,
      metadata: { storyId: args.storyId, groupId: args.groupId },
    });
    return null;
  },
});

/**
 * Alert the group's organizers (judgingGroups.notificationEmails) when a
 * submission lands in their group. Empty recipient list means no send.
 */
export const sendNewSubmissionAdminAlert = internalAction({
  args: {
    storyId: v.id("stories"),
    groupId: v.id("judgingGroups"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.emails.submissions.getSubmissionEmailContext,
      { storyId: args.storyId, groupId: args.groupId },
    );
    if (!context || context.notificationEmails.length === 0) {
      return null;
    }

    const adminUrl = `https://vibeapps.dev/admin/judging/${context.groupSlug}?section=submissions`;
    const html = emailShell(`
            <h1 style="color: #292929; margin-bottom: 10px;">New submission in ${context.groupName}</h1>
            <p style="color: #666; margin-bottom: 20px;">
              <strong>${context.storyTitle}</strong> by ${context.recipientName} was just
              submitted to <strong>${context.groupName}</strong>.
            </p>
            <p style="color: #666; margin-bottom: 20px;">
              Review it in the judging group workspace:
              <a href="${adminUrl}" style="color: #292929;">${adminUrl}</a>
            </p>`);

    for (const recipient of context.notificationEmails) {
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: recipient,
        subject: `New submission in ${context.groupName}: ${context.storyTitle}`,
        html,
        emailType: "submission_admin_alert" as const,
        metadata: { storyId: args.storyId, groupId: args.groupId },
      });
    }
    return null;
  },
});

// --- Results-live blast ---

// De-duplicated submitter recipients for one group: every valid story in the
// group that has an email (account email preferred), keyed by lowercased
// address so nobody gets the results link twice.
export const getResultsLiveRecipients = internalQuery({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      email: v.string(),
      name: v.string(),
      userId: v.optional(v.id("users")),
      username: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const seen = new Set<string>();
    const recipients: Array<{
      email: string;
      name: string;
      userId?: Id<"users">;
      username?: string;
    }> = [];

    for (const submission of submissions) {
      const story = await ctx.db.get(submission.storyId);
      if (!story || story.isHidden === true || story.status === "rejected") {
        continue;
      }

      let email: string | undefined = story.email;
      let name = story.submitterName || "there";
      let username: string | undefined;
      const userId = story.userId;
      if (story.userId) {
        const author = await ctx.db.get(story.userId);
        if (author) {
          email = author.email || email;
          name = author.name || author.username || name;
          username = author.username;
        }
      }
      if (!email) continue;

      const key = email.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ email: email.trim(), name, userId, username });
    }

    return recipients;
  },
});

/**
 * Send the public results link to every de-duplicated submitter in a group.
 * Runs only from queueResultsLiveEmails after admin + visibility checks.
 */
export const sendResultsLiveEmails = internalAction({
  args: { groupId: v.id("judgingGroups"), groupName: v.string(), groupSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(
      internal.emails.submissions.getResultsLiveRecipients,
      { groupId: args.groupId },
    );
    if (recipients.length === 0) {
      console.log(`Results-live email: no recipients for ${args.groupId}`);
      return null;
    }

    const resultsUrl = `https://vibeapps.dev/judging/${args.groupSlug}/results`;

    for (const recipient of recipients) {
      let unsubscribeToken: string | undefined;
      if (recipient.userId) {
        unsubscribeToken = await ctx.runMutation(
          internal.emails.linkHelpers.generateUnsubscribeToken,
          { userId: recipient.userId, purpose: "all" },
        );
      }

      const html = emailShell(`
            <h1 style="color: #292929; margin-bottom: 10px;">Results are live</h1>
            <p style="color: #666; margin-bottom: 20px;">Hi ${recipient.name},</p>
            <p style="color: #666; margin-bottom: 20px;">
              The judging results for <strong>${args.groupName}</strong> are now public.
              Thanks for submitting your project.
            </p>
            <p style="color: #666; margin-bottom: 20px;">
              See how everyone did:
              <a href="${resultsUrl}" style="color: #292929;">${resultsUrl}</a>
            </p>`, {
        userId: recipient.userId,
        username: recipient.username,
        unsubscribeToken,
      });

      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: recipient.email,
        subject: `Results are live for ${args.groupName}`,
        html,
        emailType: "results_live" as const,
        userId: recipient.userId,
        unsubscribeToken,
        metadata: { groupId: args.groupId },
      });
    }

    console.log(
      `Results-live emails queued for ${recipients.length} recipients in ${args.groupId}`,
    );
    return null;
  },
});

/**
 * Button state for the "Email all submitters" action in the group Access
 * section: master switch, results_live toggle, and recipient count.
 */
export const getResultsLiveEmailStatus = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({
    emailsEnabled: v.boolean(),
    typeEnabled: v.boolean(),
    resultsArePublic: v.boolean(),
    recipientCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");

    const group = await ctx.db.get(args.groupId);

    const globalRow = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "emailsEnabled"))
      .unique();
    const typeRow = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) =>
        q.eq("key", emailTypeSettingKey("results_live")),
      )
      .unique();

    // Count unique recipient emails the same way the send does
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const seen = new Set<string>();
    for (const submission of submissions) {
      const story = await ctx.db.get(submission.storyId);
      if (!story || story.isHidden === true || story.status === "rejected") {
        continue;
      }
      let email: string | undefined = story.email;
      if (story.userId) {
        const author = await ctx.db.get(story.userId);
        if (author?.email) email = author.email;
      }
      if (email) seen.add(email.trim().toLowerCase());
    }

    return {
      emailsEnabled: globalRow?.valueBoolean ?? true,
      typeEnabled: typeRow?.valueBoolean ?? EMAIL_TYPE_DEFAULTS.results_live,
      resultsArePublic: group?.resultsIsPublic === true,
      recipientCount: seen.size,
    };
  },
});

/**
 * Explicit admin action: queue the results-live blast for a group. Requires
 * public results; the per-type and master toggles are enforced in sendEmail.
 */
export const queueResultsLiveEmails = mutation({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({ queued: v.boolean() }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Judging group not found");
    if (group.resultsIsPublic !== true) {
      throw new Error(
        "Results must be public before emailing submitters. Save the results visibility first.",
      );
    }

    await ctx.scheduler.runAfter(
      0,
      internal.emails.submissions.sendResultsLiveEmails,
      { groupId: group._id, groupName: group.name, groupSlug: group.slug },
    );
    return { queued: true };
  },
});
