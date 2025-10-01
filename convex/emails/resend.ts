"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { resend, withSubjectPrefix } from "../sendEmails";

/**
 * Core email sending action with logging and global kill switch
 */
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
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
    userId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Critical admin notifications always send regardless of global toggle
      const criticalEmailTypes = [
        "admin_report_notification",
        "admin_user_report_notification",
        "dm_report_notification",
      ];
      const isCriticalEmail = criticalEmailTypes.includes(args.emailType);

      // Check global kill switch (but bypass for critical admin emails)
      if (!isCriticalEmail) {
        const emailsEnabled = await ctx.runQuery(
          internal.settings.getBooleanInternal,
          {
            key: "emailsEnabled",
          },
        );

        if (emailsEnabled === false) {
          console.log("Emails globally disabled, skipping send");
          return { success: false, error: "Emails globally disabled" };
        }
      } else {
        console.log(
          `Sending critical admin email (${args.emailType}) - bypassing global toggle`,
        );
      }

      // Send via Resend with enforced subject prefix and from address
      const emailData: any = {
        to: args.to,
        from: "VibeApps Updates <alerts@updates.vibeapps.dev>",
        subject: withSubjectPrefix(args.subject),
        html: args.html,
      };

      // Add List-Unsubscribe headers per Resend requirements (array format)
      if (args.unsubscribeToken) {
        emailData.headers = [
          {
            name: "List-Unsubscribe",
            value: `<https://vibeapps.dev/api/unsubscribe?token=${args.unsubscribeToken}>`,
          },
          {
            name: "List-Unsubscribe-Post",
            value: "List-Unsubscribe=One-Click",
          },
        ];
      }

      const result = await resend.sendEmail(ctx, emailData);

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
