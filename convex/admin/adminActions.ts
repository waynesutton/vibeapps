import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireAdminRole } from "../users";

/**
 * Force logout all users by revoking their Clerk sessions
 * This requires Clerk Admin API access
 */
export const forceLogoutAllUsers = mutation({
  args: {
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    usersProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Only allow admins to force logout users
    await requireAdminRole(ctx);

    // Get all users from database
    const users = await ctx.db.query("users").collect();

    // Schedule the actual logout action (which needs Node.js runtime for Clerk API)
    await ctx.scheduler.runAfter(
      0,
      internal.admin.forceLogout.revokeAllSessions,
      {
        userClerkIds: users.map((u) => u.clerkId),
        reason: args.reason || "Admin forced re-authentication for email sync",
      },
    );

    return {
      success: true,
      message: `Scheduled logout for ${users.length} users. This may take a few minutes to complete.`,
      usersProcessed: users.length,
    };
  },
});
