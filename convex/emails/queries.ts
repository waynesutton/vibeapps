import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { vOnEmailEventArgs } from "@convex-dev/resend";
import { logActivity } from "../activityLog";
import { emailTypeValidator } from "./emailTypes";

/**
 * Check if user already received a specific email type today
 */
export const hasReceivedEmailToday = internalQuery({
  args: {
    userId: v.id("users"),
    emailType: v.union(
      v.literal("daily_admin"),
      v.literal("daily_engagement"),
      v.literal("welcome"),
      v.literal("message_notification"),
      v.literal("weekly_digest"),
      v.literal("mention_notification"),
      v.literal("admin_broadcast"),
      v.literal("admin_report_notification"),
      v.literal("admin_user_report_notification"),
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

    const existingLog = await ctx.db
      .query("emailLogs")
      .withIndex("by_user_type_date", (q) =>
        q.eq("userId", args.userId).eq("emailType", args.emailType),
      )
      .filter(
        (q) =>
          q.gte(q.field("sentAt"), startOfDay) &&
          q.lte(q.field("sentAt"), endOfDay),
      )
      .first();

    return !!existingLog;
  },
});

/**
 * Get user's email from Clerk or cached in Convex
 */
export const getUserEmail = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Return cached email if available, otherwise we'll need to fetch from Clerk
    return user.email || null;
  },
});

/**
 * Get user with email for email sending
 */
export const getUserWithEmail = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.string(),
      username: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.email) return null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
    };
  },
});

/**
 * Insert email log entry (V8 mutation)
 */
export const insertEmailLog = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    emailType: emailTypeValidator,
    recipientEmail: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
    ),
    resendMessageId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLogs", {
      userId: args.userId,
      emailType: args.emailType,
      recipientEmail: args.recipientEmail,
      sentAt: Date.now(),
      status: args.status,
      resendMessageId: args.resendMessageId,
      metadata: args.metadata,
    });
    // Activity log: one row per send attempt (System actor, runs from actions)
    await logActivity(ctx, {
      category: "email",
      action: args.status === "failed" ? "email.failed" : "email.sent",
      message: `${args.emailType.replace(/_/g, " ")} email ${args.status} to ${args.recipientEmail}`,
      actorName: "System",
      targetType: "email",
      targetLabel: args.recipientEmail,
      metadata: { emailType: args.emailType },
    });
    return null;
  },
});

/**
 * Update email log status from webhook events (V8 mutation)
 */
export const updateEmailLogStatus = internalMutation({
  args: {
    resendMessageId: v.string(),
    status: v.union(
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
    ),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const emailLog = await ctx.db
      .query("emailLogs")
      .withIndex("by_resend_id", (q) =>
        q.eq("resendMessageId", args.resendMessageId),
      )
      .unique();

    if (emailLog) {
      await ctx.db.patch(emailLog._id, {
        status: args.status,
        metadata: { ...emailLog.metadata, webhook: args.metadata },
      });
    }
    return null;
  },
});

/**
 * Resend component onEmailEvent callback. Invoked by the component after it
 * verifies the webhook signature in http.ts (/resend-webhook). The id arg is
 * the component email id returned by resend.sendEmail, which is what we store
 * as resendMessageId in emailLogs, so lookups match reliably.
 */
export const handleEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    // Opens don't change status (delivered stays delivered); record the first
    // open timestamp in metadata so per-send stats can count opens.
    if ((args.event.type as string) === "email.opened") {
      const openedLog = await ctx.db
        .query("emailLogs")
        .withIndex("by_resend_id", (q) => q.eq("resendMessageId", args.id))
        .unique();
      if (openedLog && openedLog.metadata?.openedAt === undefined) {
        await ctx.db.patch(openedLog._id, {
          metadata: { ...openedLog.metadata, openedAt: Date.now() },
        });
      }
      return null;
    }

    // Only these events map to emailLogs statuses; ignore clicked/etc.
    const statusMap = {
      "email.delivered": "delivered",
      "email.bounced": "bounced",
      "email.complained": "complained",
    } as const;
    const status = statusMap[args.event.type as keyof typeof statusMap];
    if (!status) return null;

    const emailLog = await ctx.db
      .query("emailLogs")
      .withIndex("by_resend_id", (q) => q.eq("resendMessageId", args.id))
      .unique();

    if (emailLog) {
      await ctx.db.patch(emailLog._id, {
        status,
        metadata: { ...emailLog.metadata, webhook: args.event.data },
      });
    }
    return null;
  },
});
