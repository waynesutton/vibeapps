import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminRole } from "./users";
import { internal } from "./_generated/api";

/**
 * Test welcome email - sends welcome email to admin user for testing
 */
export const testWelcomeEmail = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Verify admin role
    await requireAdminRole(ctx);

    // Get current user identity and find user in database
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found in database");
    }

    try {
      // Send welcome email to the current admin user
      await ctx.scheduler.runAfter(
        0,
        internal.emails.welcome.sendWelcomeEmail,
        {
          userId: user._id,
        },
      );

      return {
        success: true,
        message:
          "Test welcome email scheduled successfully! Check your email in a few moments.",
      };
    } catch (error) {
      console.error("Failed to send test welcome email:", error);
      return {
        success: false,
        message: `Failed to send test welcome email: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
