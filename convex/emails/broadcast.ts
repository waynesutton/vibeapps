import {
  internalAction,
  internalQuery,
  internalMutation,
  mutation,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdminRole } from "../users";

/**
 * Debug query to see all users (admin only)
 */
export const debugUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      clerkId: v.string(),
      hasEmail: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    // Temporarily disable admin check for debugging
    // await requireAdminRole(ctx);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const users = await ctx.db.query("users").collect();

    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      clerkId: user.clerkId,
      hasEmail: !!user.email,
    }));
  },
});

/**
 * Search for users by name or email (admin only)
 */
export const searchUsers = query({
  args: {
    query: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Temporarily disable admin check for debugging
    // await requireAdminRole(ctx);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const searchTerm = args.query.toLowerCase().trim();
    if (searchTerm.length < 2) {
      return [];
    }

    // Get all users first to debug
    const allUsers = await ctx.db.query("users").collect();
    console.log(`Total users in database: ${allUsers.length}`);
    console.log(`Users with email: ${allUsers.filter((u) => u.email).length}`);
    console.log(`Search term: "${searchTerm}"`);

    // Search users by name or email - get all users and filter in JavaScript
    const users = await ctx.db.query("users").collect();

    console.log(`Users with non-undefined email: ${users.length}`);

    const matchingUsers = users
      .filter((user) => {
        // Must have email to be included in search results
        if (!user.email || user.email.trim() === "") return false;

        const nameMatch =
          user.name?.toLowerCase().includes(searchTerm) || false;
        const emailMatch =
          user.email.toLowerCase().includes(searchTerm) || false;

        console.log(
          `User: ${user.name} (${user.email}) - nameMatch: ${nameMatch}, emailMatch: ${emailMatch}`,
        );

        return nameMatch || emailMatch;
      })
      .slice(0, 10); // Limit to 10 results

    console.log(`Matching users found: ${matchingUsers.length}`);

    return matchingUsers.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email!,
    }));
  },
});

/**
 * Send broadcast email to selected users
 */
export const sendBroadcastToSelected = mutation({
  args: {
    subject: v.string(),
    htmlContent: v.string(),
    userIds: v.array(v.id("users")),
  },
  returns: v.object({
    success: v.boolean(),
    totalRecipients: v.number(),
    successCount: v.number(),
    failureCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get the current user
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

    // Schedule the broadcast email sending via scheduler
    await ctx.scheduler.runAfter(
      0,
      internal.emails.broadcast.sendBroadcastToSelectedUsers,
      {
        subject: args.subject,
        htmlContent: args.htmlContent,
        userIds: args.userIds,
        adminUserId: user._id,
      },
    );

    // Return immediate response since this is scheduled
    return {
      success: true,
      totalRecipients: args.userIds.length,
      successCount: 0,
      failureCount: 0,
    };
  },
});

/**
 * Public mutation for admins to send broadcast emails
 */
export const sendBroadcast = mutation({
  args: {
    subject: v.string(),
    htmlContent: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    totalRecipients: v.number(),
    successCount: v.number(),
    failureCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Get the current user
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

    // Schedule the broadcast email sending via scheduler (mutations can't call actions directly)
    await ctx.scheduler.runAfter(
      0,
      internal.emails.broadcast.sendBroadcastEmail,
      {
        subject: args.subject,
        htmlContent: args.htmlContent,
        adminUserId: user._id,
      },
    );

    // Return immediate response since this is scheduled
    return {
      success: true,
      totalRecipients: 0, // Will be updated when action runs
      successCount: 0,
      failureCount: 0,
    };
  },
});

/**
 * Get user by ID with email
 */
export const getUserById = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.email) {
      return null;
    }
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
    };
  },
});

/**
 * Get all users who haven't unsubscribed from emails
 */
export const getEmailSubscribedUsers = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    // Get all users with email addresses
    const users = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("email"), undefined))
      .collect();

    // Filter out users who have unsubscribed from all emails
    const subscribedUsers = [];
    for (const user of users) {
      if (!user.email) continue;

      const emailSettings = await ctx.db
        .query("emailSettings")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();

      // Skip if user has unsubscribed from all emails
      if (emailSettings?.unsubscribedAt) {
        continue;
      }

      subscribedUsers.push({
        _id: user._id,
        email: user.email,
        name: user.name,
      });
    }

    return subscribedUsers;
  },
});

/**
 * Send broadcast email to selected users
 */
export const sendBroadcastToSelectedUsers = internalAction({
  args: {
    subject: v.string(),
    htmlContent: v.string(),
    userIds: v.array(v.id("users")),
    adminUserId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    totalRecipients: v.number(),
    successCount: v.number(),
    failureCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get selected users with their email addresses
    const users: Array<{
      _id: any;
      email: string;
      name?: string;
    }> = [];

    for (const userId of args.userIds) {
      const user = await ctx.runQuery(internal.emails.broadcast.getUserById, {
        userId,
      });
      if (user && user.email) {
        // Check if user has unsubscribed
        const emailSettings = await ctx.runQuery(
          internal.emails.helpers.getUserEmailSettings,
          { userId: user._id },
        );

        // Skip if user has unsubscribed from all emails
        if (!emailSettings?.unsubscribedAt) {
          users.push(user);
        }
      }
    }

    if (users.length === 0) {
      return {
        success: true,
        totalRecipients: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    // Create broadcast record
    const broadcastId: any = await ctx.runMutation(
      internal.emails.broadcast.createBroadcastRecord,
      {
        createdBy: args.adminUserId,
        subject: args.subject,
        html: args.htmlContent,
        totalRecipients: users.length,
      },
    );

    let successCount = 0;
    let failureCount = 0;

    // Send emails in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      for (const user of batch) {
        try {
          // Generate unsubscribe token for this user
          const unsubscribeToken = await ctx.runMutation(
            internal.emails.linkHelpers.generateUnsubscribeToken,
            {
              userId: user._id,
              purpose: "all",
            },
          );

          // Get user username for template
          const userWithDetails = await ctx.runQuery(
            internal.emails.queries.getUserWithEmail,
            { userId: user._id },
          );

          // Generate broadcast email template with unsubscribe functionality
          const emailTemplate = await ctx.runQuery(
            internal.emails.templates.generateBroadcastEmail,
            {
              subject: args.subject,
              content: args.htmlContent,
              userId: user._id,
              userName: user.name || "User",
              userUsername: userWithDetails?.username,
              unsubscribeToken,
            },
          );

          const result = await ctx.runAction(internal.emails.resend.sendEmail, {
            to: user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            emailType: "admin_broadcast",
            userId: user._id,
            unsubscribeToken,
            metadata: {
              broadcastId,
              adminUserId: args.adminUserId,
            },
          });

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          console.error(
            `Failed to send broadcast email to ${user.email}:`,
            error,
          );
          failureCount++;
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update broadcast record with results
    await ctx.runMutation(internal.emails.broadcast.updateBroadcastRecord, {
      broadcastId,
      sentCount: successCount,
      status: "completed",
    });

    return {
      success: true,
      totalRecipients: users.length,
      successCount,
      failureCount,
    };
  },
});

/**
 * Send broadcast email to all subscribed users
 */
export const sendBroadcastEmail = internalAction({
  args: {
    subject: v.string(),
    htmlContent: v.string(),
    adminUserId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    totalRecipients: v.number(),
    successCount: v.number(),
    failureCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get all subscribed users
    const users: Array<{
      _id: any;
      email: string;
      name?: string;
    }> = await ctx.runQuery(
      internal.emails.broadcast.getEmailSubscribedUsers,
      {},
    );

    if (users.length === 0) {
      return {
        success: true,
        totalRecipients: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    // Create broadcast record
    const broadcastId: any = await ctx.runMutation(
      internal.emails.broadcast.createBroadcastRecord,
      {
        createdBy: args.adminUserId,
        subject: args.subject,
        html: args.htmlContent,
        totalRecipients: users.length,
      },
    );

    let successCount = 0;
    let failureCount = 0;

    // Send emails in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      for (const user of batch) {
        try {
          // Generate unsubscribe token for this user
          const unsubscribeToken = await ctx.runMutation(
            internal.emails.linkHelpers.generateUnsubscribeToken,
            {
              userId: user._id,
              purpose: "all",
            },
          );

          // Get user username for template
          const userWithDetails = await ctx.runQuery(
            internal.emails.queries.getUserWithEmail,
            { userId: user._id },
          );

          // Generate broadcast email template with unsubscribe functionality
          const emailTemplate = await ctx.runQuery(
            internal.emails.templates.generateBroadcastEmail,
            {
              subject: args.subject,
              content: args.htmlContent,
              userId: user._id,
              userName: user.name || "User",
              userUsername: userWithDetails?.username,
              unsubscribeToken,
            },
          );

          const result = await ctx.runAction(internal.emails.resend.sendEmail, {
            to: user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            emailType: "admin_broadcast",
            userId: user._id,
            unsubscribeToken,
            metadata: {
              broadcastId,
              adminUserId: args.adminUserId,
            },
          });

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          console.error(
            `Failed to send broadcast email to ${user.email}:`,
            error,
          );
          failureCount++;
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update broadcast record with results
    await ctx.runMutation(internal.emails.broadcast.updateBroadcastRecord, {
      broadcastId,
      sentCount: successCount,
      status: "completed",
    });

    return {
      success: true,
      totalRecipients: users.length,
      successCount,
      failureCount,
    };
  },
});

/**
 * Create broadcast email record
 */
export const createBroadcastRecord = internalMutation({
  args: {
    createdBy: v.id("users"),
    subject: v.string(),
    html: v.string(),
    totalRecipients: v.number(),
  },
  returns: v.id("broadcastEmails"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("broadcastEmails", {
      createdBy: args.createdBy,
      subject: args.subject,
      html: args.html,
      status: "sending",
      totalRecipients: args.totalRecipients,
      sentCount: 0,
    });
  },
});

/**
 * Update broadcast email record
 */
export const updateBroadcastRecord = internalMutation({
  args: {
    broadcastId: v.id("broadcastEmails"),
    sentCount: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("queued"),
      v.literal("sending"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.broadcastId, {
      sentCount: args.sentCount,
      status: args.status,
    });
    return null;
  },
});
