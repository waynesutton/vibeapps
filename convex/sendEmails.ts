import { components, internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminRole } from "./users";

export const resend: Resend = new Resend(components.resend, {
  testMode: false, // Disable test mode to send to real email addresses
});

// Public mutation for admins to send test emails
export const sendTestEmail = mutation({
  args: {
    to: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    try {
      const result = await resend.sendEmail(ctx, {
        from: "VibeApps Updates <alerts@updates.vibeapps.dev>",
        to: args.to,
        subject: "VibeApps Updates: Test email from admin",
        html: `
          <h2>Test Email Success!</h2>
          <p>This test email was sent from the VibeApps admin dashboard.</p>
          <p><strong>Sent to:</strong> ${args.to}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p>If you received this, your email system is working perfectly! 🎉</p>
        `,
      });

      return {
        success: true,
        message: `Test email sent successfully to ${args.to}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test email: ${error}`,
      };
    }
  },
});

// Internal mutation for testing; enforces subject prefix and from address.
export const sendTestEmailInternal = internalMutation({
  args: {
    to: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const result = await resend.sendEmail(ctx, {
        from: "VibeApps Updates <alerts@updates.vibeapps.dev>",
        to: args.to || "wayne@convex.dev", // Default to your email
        subject: "VibeApps Updates: Test email from admin",
        html: `
          <h2>Test Email Success!</h2>
          <p>This test email was sent from the VibeApps admin dashboard.</p>
          <p><strong>Sent to:</strong> ${args.to || "wayne@convex.dev"}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p>If you received this, your email system is working perfectly! 🎉</p>
        `,
      });

      return {
        success: true,
        message: `Test email sent successfully to ${args.to || "wayne@convex.dev"}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test email: ${error}`,
      };
    }
  },
});

// Helper to wrap subjects to always have the required prefix
export function withSubjectPrefix(subject: string): string {
  const prefix = "VibeApps Updates: ";
  return subject.startsWith(prefix) ? subject : `${prefix}${subject}`;
}
