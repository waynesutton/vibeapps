import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { requireJudgingGroupPermission } from "../adminAccess";
import { EMAIL_TYPE_DEFAULTS, emailTypeSettingKey } from "./emailTypes";
import {
  applyTemplateVars,
  firstNameOf,
  isValidEmailAddress,
  judgingGroupUrls,
  renderMarkdownLite,
  templateEmailShell,
} from "./render";

// Organizer emails to a judging group's judges or submission owners. Composed
// in the group workspace Emails section, gated by judging.emails plus the
// emailsEnabled master switch and the judging_group per-type toggle.

const recipientTypeValidator = v.union(
  v.literal("judges"),
  v.literal("submission_owners"),
);

async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

// Effective boolean from appSettings with a fallback default.
async function readBooleanSetting(
  ctx: QueryCtx | MutationCtx,
  key: string,
  fallback: boolean,
): Promise<boolean> {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.valueBoolean ?? fallback;
}

// Group judges with an email, deduplicated by lowercased address.
async function collectGroupJudgeRecipients(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<Array<{ judgeId: Id<"judges">; name: string; email: string }>> {
  const judges = await ctx.db
    .query("judges")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();

  const seen = new Set<string>();
  const recipients: Array<{
    judgeId: Id<"judges">;
    name: string;
    email: string;
  }> = [];
  for (const judge of judges) {
    const email = judge.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ judgeId: judge._id, name: judge.name, email });
  }
  return recipients;
}

// Submission owners in the group with an email (account email preferred),
// deduplicated by lowercased address. storyId is the first matching story so
// the picker can select/deselect without inventing addresses.
async function collectGroupSubmissionOwnerRecipients(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<
  Array<{
    storyId: Id<"stories">;
    name: string;
    email: string;
    storyTitle: string;
  }>
> {
  const submissions = await ctx.db
    .query("judgingGroupSubmissions")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();

  const seen = new Set<string>();
  const recipients: Array<{
    storyId: Id<"stories">;
    name: string;
    email: string;
    storyTitle: string;
  }> = [];

  for (const submission of submissions) {
    const story = await ctx.db.get(submission.storyId);
    if (!story || story.isHidden === true || story.status === "rejected") {
      continue;
    }

    let email: string | undefined = story.email;
    let name = story.submitterName || "there";
    if (story.userId) {
      const author = await ctx.db.get(story.userId);
      if (author) {
        email = author.email || email;
        name = author.name || author.username || name;
      }
    }
    if (!email) continue;

    const key = email.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({
      storyId: story._id,
      name,
      email: email.trim(),
      storyTitle: story.title,
    });
  }

  return recipients;
}

// Rolling daily cap so a delegated organizer can't blast judges repeatedly.
// Counts real (non-test) recipient emails logged in the last 24 hours plus
// recipients on still-pending scheduled sends. Test sends don't count.
export const GROUP_DAILY_RECIPIENT_CAP = 200;

async function countGroupUsage(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"judgingGroups">,
  now: number,
): Promise<number> {
  const since = now - 24 * 60 * 60 * 1000;
  const [logs, scheduled] = await Promise.all([
    ctx.db
      .query("emailLogs")
      .withIndex("by_type_date", (q) =>
        q.eq("emailType", "judging_group").gte("sentAt", since),
      )
      .collect(),
    ctx.db
      .query("groupScheduledEmails")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect(),
  ]);
  const sentCount = logs.filter(
    (log) => log.metadata?.groupId === groupId && log.metadata?.isTest !== true,
  ).length;
  const pendingCount = scheduled
    .filter((row) => row.status === "pending")
    .reduce((total, row) => total + row.recipients.length, 0);
  return sentCount + pendingCount;
}

/**
 * Send button state for the group Emails section: master switch, the
 * judging_group toggle, and how many judges can receive email.
 */
export const getGroupEmailStatus = query({
  args: {
    groupId: v.id("judgingGroups"),
    // Client-supplied "now" so this query stays deterministic (no Date.now()
    // in queries); used for the rolling 24h cap window.
    now: v.number(),
  },
  returns: v.object({
    emailsEnabled: v.boolean(),
    typeEnabled: v.boolean(),
    recipientCount: v.number(),
    dailyCap: v.number(),
    usedLast24h: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.emails");
    const [emailsEnabled, typeEnabled, recipients, usedLast24h] =
      await Promise.all([
        readBooleanSetting(ctx, "emailsEnabled", true),
        readBooleanSetting(
          ctx,
          emailTypeSettingKey("judging_group"),
          EMAIL_TYPE_DEFAULTS.judging_group,
        ),
        collectGroupJudgeRecipients(ctx, args.groupId),
        countGroupUsage(ctx, args.groupId, args.now),
      ]);
    return {
      emailsEnabled,
      typeEnabled,
      recipientCount: recipients.length,
      dailyCap: GROUP_DAILY_RECIPIENT_CAP,
      usedLast24h,
    };
  },
});

/**
 * Judges in the group who registered with an email address, for the
 * recipient picker (deduplicated by address).
 */
export const listGroupRecipients = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      judgeId: v.id("judges"),
      name: v.string(),
      email: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.emails");
    return await collectGroupJudgeRecipients(ctx, args.groupId);
  },
});

/**
 * Submission owners in the group with an email, for the recipient picker
 * (deduplicated by address; account email preferred over form email).
 */
export const listGroupSubmissionOwnerRecipients = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      storyId: v.id("stories"),
      name: v.string(),
      email: v.string(),
      storyTitle: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.emails");
    return await collectGroupSubmissionOwnerRecipients(ctx, args.groupId);
  },
});

/**
 * Recent sends for this group aggregated per send (grouped by the sendId
 * stamped on every log row): recipient totals plus delivered / opened /
 * bounced / failed counts fed by the Resend webhook.
 */
export const listGroupSends = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      sendId: v.string(),
      subject: v.optional(v.string()),
      isTest: v.optional(v.boolean()),
      sentAt: v.number(),
      total: v.number(),
      delivered: v.number(),
      opened: v.number(),
      bounced: v.number(),
      failed: v.number(),
      complained: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.emails");
    // Scan recent judging_group logs and keep this group's rows
    const logs = await ctx.db
      .query("emailLogs")
      .withIndex("by_type_date", (q) => q.eq("emailType", "judging_group"))
      .order("desc")
      .take(500);

    type SendStats = {
      sendId: string;
      subject?: string;
      isTest?: boolean;
      sentAt: number;
      total: number;
      delivered: number;
      opened: number;
      bounced: number;
      failed: number;
      complained: number;
    };
    const bySendId = new Map<string, SendStats>();
    for (const log of logs) {
      if (log.metadata?.groupId !== args.groupId) continue;
      // Rows from before sendId existed fall back to their own log id so
      // they still show up as single-recipient sends.
      const sendId =
        typeof log.metadata?.sendId === "string"
          ? log.metadata.sendId
          : log._id;
      let stats = bySendId.get(sendId);
      if (!stats) {
        stats = {
          sendId,
          subject:
            typeof log.metadata?.subject === "string"
              ? log.metadata.subject
              : undefined,
          isTest: log.metadata?.isTest === true ? true : undefined,
          sentAt: log.sentAt,
          total: 0,
          delivered: 0,
          opened: 0,
          bounced: 0,
          failed: 0,
          complained: 0,
        };
        bySendId.set(sendId, stats);
      }
      stats.total++;
      stats.sentAt = Math.max(stats.sentAt, log.sentAt);
      if (log.status === "delivered") stats.delivered++;
      if (log.status === "bounced") stats.bounced++;
      if (log.status === "failed") stats.failed++;
      if (log.status === "complained") stats.complained++;
      if (typeof log.metadata?.openedAt === "number") stats.opened++;
    }

    return Array.from(bySendId.values())
      .sort((a, b) => b.sentAt - a.sentAt)
      .slice(0, 20);
  },
});

// Shared pre-send checks: permission, toggles, group existence, reply-to.
async function prepareSend(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
  subject: string,
  body: string,
  replyTo?: string,
): Promise<{ group: Doc<"judgingGroups">; sender: Doc<"users"> }> {
  await requireJudgingGroupPermission(ctx, groupId, "judging.emails");

  if (subject.trim() === "") throw new Error("Subject is required");
  if (body.trim() === "") throw new Error("Email body is required");
  if (replyTo && !isValidEmailAddress(replyTo)) {
    throw new Error("Reply-to must be a valid email address");
  }

  const emailsEnabled = await readBooleanSetting(ctx, "emailsEnabled", true);
  if (!emailsEnabled) {
    throw new Error(
      "The global email system is turned off. An admin can enable it in Email Management.",
    );
  }
  const typeEnabled = await readBooleanSetting(
    ctx,
    emailTypeSettingKey("judging_group"),
    EMAIL_TYPE_DEFAULTS.judging_group,
  );
  if (!typeEnabled) {
    throw new Error(
      "Judging group emails are turned off. An admin can enable them in Email Management under Email Send Options.",
    );
  }

  const group = await ctx.db.get(groupId);
  if (!group) throw new Error("Judging group not found");

  const sender = await getCurrentUser(ctx);
  return { group, sender };
}

// Correlates all log rows from one send so stats can be aggregated per send.
function newSendId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Send (or schedule) a template email to selected judges or submission
 * owners in the group. Recipients are resolved and validated here, the
 * daily cap is enforced, then delivery runs in a scheduled action.
 */
export const sendGroupEmail = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    subject: v.string(),
    body: v.string(),
    signature: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    // Defaults to judges for older clients; submission_owners uses storyIds.
    recipientType: v.optional(recipientTypeValidator),
    judgeIds: v.optional(v.array(v.id("judges"))),
    storyIds: v.optional(v.array(v.id("stories"))),
    templateId: v.optional(v.id("emailTemplates")),
    // Optional future send time (ms since epoch). Undefined sends now.
    scheduledAtMs: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    totalRecipients: v.number(),
    scheduledFor: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const { group, sender } = await prepareSend(
      ctx,
      args.groupId,
      args.subject,
      args.body,
      args.replyTo,
    );

    const recipientType = args.recipientType ?? "judges";
    let recipients: Array<{ name: string; email: string }> = [];

    if (recipientType === "judges") {
      const judgeIds = args.judgeIds ?? [];
      if (judgeIds.length === 0) {
        throw new Error("Select at least one recipient");
      }
      const allRecipients = await collectGroupJudgeRecipients(
        ctx,
        args.groupId,
      );
      const selectedIds = new Set<string>(judgeIds);
      recipients = allRecipients
        .filter((r) => selectedIds.has(r.judgeId))
        .map((r) => ({ name: r.name, email: r.email }));
      if (recipients.length === 0) {
        throw new Error("None of the selected judges have an email address");
      }
    } else {
      const storyIds = args.storyIds ?? [];
      if (storyIds.length === 0) {
        throw new Error("Select at least one recipient");
      }
      const allRecipients = await collectGroupSubmissionOwnerRecipients(
        ctx,
        args.groupId,
      );
      const selectedIds = new Set<string>(storyIds);
      recipients = allRecipients
        .filter((r) => selectedIds.has(r.storyId))
        .map((r) => ({ name: r.name, email: r.email }));
      if (recipients.length === 0) {
        throw new Error(
          "None of the selected submission owners have an email address",
        );
      }
    }

    // Rolling 24h cap across sent logs and pending scheduled sends
    const now = Date.now();
    const used = await countGroupUsage(ctx, args.groupId, now);
    if (used + recipients.length > GROUP_DAILY_RECIPIENT_CAP) {
      const remaining = Math.max(0, GROUP_DAILY_RECIPIENT_CAP - used);
      throw new Error(
        `Daily limit reached: this group can email ${GROUP_DAILY_RECIPIENT_CAP} recipients per 24 hours and has ${remaining} remaining. Try again later or reduce the recipient list.`,
      );
    }

    const sendId = newSendId();
    const deliveryArgs = {
      groupId: args.groupId,
      groupName: group.name,
      groupSlug: group.slug,
      subject: args.subject.trim(),
      body: args.body,
      signature: args.signature,
      replyTo: args.replyTo?.trim() || undefined,
      sentBy: sender._id,
      templateId: args.templateId,
      recipients,
      isTest: false,
      sendId,
      recipientType,
    };

    // Scheduled path: persist the send, queue it with runAt, keep the
    // scheduled function id so the organizer can cancel before it fires.
    if (args.scheduledAtMs !== undefined) {
      if (args.scheduledAtMs < now + 60 * 1000) {
        throw new Error(
          "Scheduled time must be at least one minute in the future",
        );
      }
      if (args.scheduledAtMs > now + 30 * 24 * 60 * 60 * 1000) {
        throw new Error("Scheduled time must be within the next 30 days");
      }
      const scheduledEmailId = await ctx.db.insert("groupScheduledEmails", {
        groupId: args.groupId,
        subject: deliveryArgs.subject,
        body: args.body,
        signature: args.signature,
        replyTo: deliveryArgs.replyTo,
        templateId: args.templateId,
        sentBy: sender._id,
        recipients: deliveryArgs.recipients,
        scheduledFor: args.scheduledAtMs,
        status: "pending" as const,
      });
      const scheduledFunctionId = await ctx.scheduler.runAt(
        args.scheduledAtMs,
        internal.emails.judgingGroupEmails.deliverGroupEmails,
        { ...deliveryArgs, scheduledEmailId },
      );
      await ctx.db.patch(scheduledEmailId, { scheduledFunctionId });
      return {
        success: true,
        totalRecipients: recipients.length,
        scheduledFor: args.scheduledAtMs,
      };
    }

    await ctx.scheduler.runAfter(
      0,
      internal.emails.judgingGroupEmails.deliverGroupEmails,
      deliveryArgs,
    );

    return {
      success: true,
      totalRecipients: recipients.length,
      scheduledFor: undefined,
    };
  },
});

/**
 * Pending scheduled sends for this group, soonest first.
 */
export const listScheduledEmails = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      _id: v.id("groupScheduledEmails"),
      subject: v.string(),
      scheduledFor: v.number(),
      recipientCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.emails");
    const rows = await ctx.db
      .query("groupScheduledEmails")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    return rows
      .filter((row) => row.status === "pending")
      .sort((a, b) => a.scheduledFor - b.scheduledFor)
      .map((row) => ({
        _id: row._id,
        subject: row.subject,
        scheduledFor: row.scheduledFor,
        recipientCount: row.recipients.length,
      }));
  },
});

/**
 * Cancel a pending scheduled send before it fires. Idempotent: already
 * sent or cancelled rows return without error.
 */
export const cancelScheduledEmail = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    scheduledEmailId: v.id("groupScheduledEmails"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.emails");
    const row = await ctx.db.get(args.scheduledEmailId);
    if (!row || row.groupId !== args.groupId) {
      throw new Error("Scheduled email not found for this group");
    }
    if (row.status !== "pending") return null;
    if (row.scheduledFunctionId) {
      await ctx.scheduler.cancel(row.scheduledFunctionId);
    }
    await ctx.db.patch(args.scheduledEmailId, { status: "cancelled" as const });
    return null;
  },
});

// Delivery marks its scheduled row sent once the batch completes.
export const markScheduledEmailSent = internalMutation({
  args: { scheduledEmailId: v.id("groupScheduledEmails") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scheduledEmailId, { status: "sent" as const });
    return null;
  },
});

/**
 * Send the composed email to the sender's own address so they can check
 * rendering and variables before emailing judges.
 */
export const sendGroupTestEmail = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    subject: v.string(),
    body: v.string(),
    signature: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    templateId: v.optional(v.id("emailTemplates")),
  },
  returns: v.object({ success: v.boolean(), sentTo: v.string() }),
  handler: async (ctx, args) => {
    const { group, sender } = await prepareSend(
      ctx,
      args.groupId,
      args.subject,
      args.body,
      args.replyTo,
    );

    if (!sender.email) {
      throw new Error(
        "Your account has no email address, so a test send is not possible.",
      );
    }

    await ctx.scheduler.runAfter(
      0,
      internal.emails.judgingGroupEmails.deliverGroupEmails,
      {
        groupId: args.groupId,
        groupName: group.name,
        groupSlug: group.slug,
        subject: args.subject.trim(),
        body: args.body,
        signature: args.signature,
        replyTo: args.replyTo?.trim() || undefined,
        sentBy: sender._id,
        templateId: args.templateId,
        recipients: [{ name: sender.name ?? "there", email: sender.email }],
        isTest: true,
        sendId: newSendId(),
      },
    );

    return { success: true, sentTo: sender.email };
  },
});

/**
 * Delivery: substitute per-recipient variables, render markdown-lite to
 * HTML, wrap in the branded shell, and send through the core email action
 * (which enforces the master switch and per-type toggle and logs the send).
 */
export const deliverGroupEmails = internalAction({
  args: {
    groupId: v.id("judgingGroups"),
    groupName: v.string(),
    groupSlug: v.string(),
    subject: v.string(),
    body: v.string(),
    signature: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    sentBy: v.id("users"),
    templateId: v.optional(v.id("emailTemplates")),
    recipients: v.array(v.object({ name: v.string(), email: v.string() })),
    isTest: v.boolean(),
    sendId: v.string(),
    recipientType: v.optional(recipientTypeValidator),
    // Present when this delivery came from a scheduled send
    scheduledEmailId: v.optional(v.id("groupScheduledEmails")),
  },
  returns: v.object({
    successCount: v.number(),
    failureCount: v.number(),
  }),
  handler: async (ctx, args) => {
    let successCount = 0;
    let failureCount = 0;

    // Group links are the same for every recipient in this send
    const groupUrls = judgingGroupUrls(args.groupSlug);
    const recipientType = args.recipientType ?? "judges";

    const batchSize = 10;
    for (let i = 0; i < args.recipients.length; i += batchSize) {
      const batch = args.recipients.slice(i, i + batchSize);
      for (const recipient of batch) {
        try {
          const vars = {
            firstname: firstNameOf(recipient.name),
            name: recipient.name,
            email: recipient.email,
            groupname: args.groupName,
            ...groupUrls,
          };
          const subject = applyTemplateVars(args.subject, vars);
          const bodyHtml = renderMarkdownLite(
            applyTemplateVars(args.body, vars),
          );
          const signatureHtml = args.signature
            ? renderMarkdownLite(applyTemplateVars(args.signature, vars))
            : undefined;

          const result = await ctx.runAction(internal.emails.resend.sendEmail, {
            to: recipient.email,
            subject,
            html: templateEmailShell(bodyHtml, signatureHtml),
            emailType: "judging_group" as const,
            replyTo: args.replyTo,
            metadata: {
              groupId: args.groupId,
              sentBy: args.sentBy,
              templateId: args.templateId,
              subject,
              isTest: args.isTest,
              sendId: args.sendId,
              recipientType,
            },
          });

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          console.error(
            `Failed to send judging group email to ${recipient.email}:`,
            error,
          );
          failureCount++;
        }
      }
      // Pause between batches to respect Resend rate limits
      if (i + batchSize < args.recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Move the scheduled row out of pending so lists and the cap stay right
    if (args.scheduledEmailId) {
      await ctx.runMutation(
        internal.emails.judgingGroupEmails.markScheduledEmailSent,
        { scheduledEmailId: args.scheduledEmailId },
      );
    }

    return { successCount, failureCount };
  },
});
