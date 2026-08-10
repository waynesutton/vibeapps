"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { resend, withSubjectPrefix } from "../sendEmails";
import {
  EMAIL_TYPE_DEFAULTS,
  emailTypeSettingKey,
  emailTypeValidator,
} from "./emailTypes";

/**
 * Core email sending action with logging, global kill switch, and per-type
 * toggles from the admin Email dashboard
 */
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    emailType: emailTypeValidator,
    userId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
    unsubscribeToken: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Global kill switch applies to ALL email types. When an admin disables
      // emails in the dashboard, nothing is sent (including admin reports).
      const emailsEnabled = await ctx.runQuery(
        internal.settings.getBooleanInternal,
        {
          key: "emailsEnabled",
        },
      );

      if (emailsEnabled === false) {
        console.log(
          `Emails globally disabled, skipping send (${args.emailType})`,
        );
        return { success: false, error: "Emails globally disabled" };
      }

      // Per-type toggle from the Email dashboard. No stored row falls back
      // to the type's default. Skips are not logged as send attempts.
      const typeEnabled = await ctx.runQuery(
        internal.settings.getBooleanInternal,
        { key: emailTypeSettingKey(args.emailType) },
      );
      if ((typeEnabled ?? EMAIL_TYPE_DEFAULTS[args.emailType]) === false) {
        console.log(
          `Email type ${args.emailType} disabled, skipping send to ${args.to}`,
        );
        return { success: false, error: "Email type disabled" };
      }

      // Add List-Unsubscribe headers per Resend requirements (array format)
      const headers = args.unsubscribeToken
        ? [
            {
              name: "List-Unsubscribe",
              value: `<https://vibeapps.dev/api/unsubscribe?token=${args.unsubscribeToken}>`,
            },
            {
              name: "List-Unsubscribe-Post",
              value: "List-Unsubscribe=One-Click",
            },
          ]
        : undefined;

      // Send via Resend with enforced subject prefix and from address.
      // replyTo is an array per the component's SendEmailOptions type.
      const result = await resend.sendEmail(ctx, {
        to: args.to,
        from: "VibeApps Updates <alerts@updates.vibeapps.dev>",
        subject: withSubjectPrefix(args.subject),
        html: args.html,
        replyTo: args.replyTo ? [args.replyTo] : undefined,
        headers,
      });

      // Log the send attempt (V8 mutation)
      await ctx.runMutation(internal.emails.queries.insertEmailLog, {
        userId: args.userId,
        emailType: args.emailType,
        recipientEmail: args.to,
        status: "sent",
        resendMessageId: String(result),
        metadata: args.metadata,
      });

      return {
        success: true,
        messageId: String(result),
      };
    } catch (error) {
      console.error("Failed to send email:", error);

      // Log the failure (V8 mutation)
      await ctx.runMutation(internal.emails.queries.insertEmailLog, {
        userId: args.userId,
        emailType: args.emailType,
        recipientEmail: args.to,
        status: "failed",
        metadata: { ...args.metadata, error: String(error) },
      });

      return {
        success: false,
        error: String(error),
      };
    }
  },
});

// Node file now contains only actions
