import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.emails.queries.getUserWithEmail, {
      userId: args.userId,
    });
    if (!user) {
      console.log("User not found or no email, skipping welcome email");
      return null;
    }

    // Check if welcome email already sent via internal query
    const alreadySent = await ctx.runQuery(
      internal.emails.queries.hasReceivedEmailToday,
      {
        userId: args.userId,
        emailType: "welcome",
      },
    );

    if (alreadySent) {
      console.log("Welcome email already sent to user", args.userId);
      return null;
    }

    // Generate unsubscribe token for this user
    const unsubscribeToken = await ctx.runMutation(
      internal.emails.linkHelpers.generateUnsubscribeToken,
      {
        userId: args.userId,
        purpose: "all",
      },
    );

    // Generate welcome email template
    const emailTemplate = await ctx.runQuery(
      internal.emails.templates.generateWelcomeEmail,
      {
        userId: args.userId,
        userName: user.name || "New User",
        userEmail: user.email,
        userUsername: user.username,
        unsubscribeToken,
      },
    );

    // Send welcome email
    await ctx.runAction(internal.emails.resend.sendEmail, {
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      emailType: "welcome",
      userId: args.userId,
      unsubscribeToken,
      metadata: {
        signupDate: new Date().toISOString(),
      },
    });

    return null;
  },
});
