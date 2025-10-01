import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdminRole } from "./users";

/**
 * Test mutation to send a user report notification email to all admins
 * This is for testing purposes only - call from the admin dashboard or Convex dashboard
 */
export const testUserReportEmail = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    adminCount: v.number(),
  }),
  handler: async (ctx) => {
    // Only allow admins to test
    await requireAdminRole(ctx);

    // Get the current authenticated user (will be the reporter)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Create or find a test user to report
    let testUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), "Test Reported User"))
      .first();

    if (!testUser) {
      // Create a test user if doesn't exist
      const testUserId = await ctx.db.insert("users", {
        name: "Test Reported User",
        clerkId: `test-reported-${Date.now()}`,
        email: "test-reported@example.com",
        username: "testreported",
      });
      testUser = await ctx.db.get(testUserId);
    }

    if (!testUser) {
      throw new Error("Could not create test user");
    }

    // Create a test user report
    const reportId = await ctx.db.insert("userReports", {
      reportedUserId: testUser._id,
      reporterUserId: currentUser._id,
      reason:
        "Test report: This is a test user report to verify email notifications are working correctly.",
      status: "pending",
    });

    // Get all admin and manager users
    const adminUsers = await ctx.db
      .query("users")
      .filter((q) =>
        q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("role"), "manager")),
      )
      .collect();

    const adminUserIds = adminUsers.map((u) => u._id);

    if (adminUserIds.length === 0) {
      throw new Error("No admin or manager users found to send test email to");
    }

    // Trigger the email sending via the internal mutation
    await ctx.scheduler.runAfter(
      0,
      internal.alerts.createUserReportNotifications,
      {
        reporterUserId: currentUser._id,
        reportedUserId: testUser._id,
        reportId: reportId,
        adminUserIds: adminUserIds,
      },
    );

    return {
      success: true,
      message: `Test user report email queued for ${adminUserIds.length} admin(s). Check your email inbox and Convex logs.`,
      adminCount: adminUserIds.length,
    };
  },
});

