import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Toggle user's inbox on or off
 */
export const toggleInboxEnabled = mutation({
  args: {},
  returns: v.object({
    inboxEnabled: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const newValue = !(user.inboxEnabled ?? true); // Default to enabled

    await ctx.db.patch(user._id, {
      inboxEnabled: newValue,
    });

    return { inboxEnabled: newValue };
  },
});

/**
 * Get user's inbox enabled status
 */
export const getInboxEnabled = query({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return false;
    }
    return user.inboxEnabled ?? true; // Default to enabled
  },
});

/**
 * Check if user has hit rate limit
 * Returns true if user can send, false if rate limited
 */
export const checkRateLimit = internalQuery({
  args: {
    senderId: v.id("users"),
    recipientId: v.id("users"),
  },
  returns: v.object({
    canSend: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    // Get rate limit settings from appSettings (default: 10/hour per recipient, 100/day global)
    const hourlyLimit = 10;
    const dailyLimit = 100;

    // Check hourly per-recipient limit
    const hourlyLimits = await ctx.db
      .query("dmRateLimits")
      .withIndex("by_user_recipient_window", (q) =>
        q.eq("userId", args.senderId).eq("recipientId", args.recipientId),
      )
      .filter((q) => q.gte(q.field("windowStart"), hourAgo))
      .collect();

    const hourlyCount = hourlyLimits.reduce(
      (sum, limit) => sum + limit.messageCount,
      0,
    );

    if (hourlyCount >= hourlyLimit) {
      return {
        canSend: false,
        reason: `Rate limit: Maximum ${hourlyLimit} messages per hour to this user`,
      };
    }

    // Check daily global limit
    const dailyLimits = await ctx.db
      .query("dmRateLimits")
      .withIndex("by_user_type_window", (q) =>
        q.eq("userId", args.senderId).eq("limitType", "daily_global"),
      )
      .filter((q) => q.gte(q.field("windowStart"), dayAgo))
      .collect();

    const dailyCount = dailyLimits.reduce(
      (sum, limit) => sum + limit.messageCount,
      0,
    );

    if (dailyCount >= dailyLimit) {
      return {
        canSend: false,
        reason: `Rate limit: Maximum ${dailyLimit} messages per day`,
      };
    }

    return { canSend: true };
  },
});

/**
 * Record a message send for rate limiting
 */
export const recordMessageSend = internalMutation({
  args: {
    senderId: v.id("users"),
    recipientId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const hourStart = Math.floor(now / (60 * 60 * 1000)) * (60 * 60 * 1000);
    const dayStart =
      Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);

    // Record hourly per-recipient limit
    const hourlyLimit = await ctx.db
      .query("dmRateLimits")
      .withIndex("by_user_recipient_window", (q) =>
        q.eq("userId", args.senderId).eq("recipientId", args.recipientId),
      )
      .filter((q) => q.eq(q.field("windowStart"), hourStart))
      .first();

    if (hourlyLimit) {
      await ctx.db.patch(hourlyLimit._id, {
        messageCount: hourlyLimit.messageCount + 1,
      });
    } else {
      await ctx.db.insert("dmRateLimits", {
        userId: args.senderId,
        recipientId: args.recipientId,
        windowStart: hourStart,
        messageCount: 1,
        limitType: "hourly_per_recipient",
      });
    }

    // Record daily global limit
    const dailyLimit = await ctx.db
      .query("dmRateLimits")
      .withIndex("by_user_type_window", (q) =>
        q.eq("userId", args.senderId).eq("limitType", "daily_global"),
      )
      .filter((q) => q.eq(q.field("windowStart"), dayStart))
      .first();

    if (dailyLimit) {
      await ctx.db.patch(dailyLimit._id, {
        messageCount: dailyLimit.messageCount + 1,
      });
    } else {
      await ctx.db.insert("dmRateLimits", {
        userId: args.senderId,
        windowStart: dayStart,
        messageCount: 1,
        limitType: "daily_global",
      });
    }

    return null;
  },
});

/**
 * Create or get existing conversation between two users
 */
export const upsertConversation = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  returns: v.id("dmConversations"),
  handler: async (ctx, args) => {
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

    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) {
      throw new Error("Other user not found");
    }

    // Check if other user's inbox is enabled
    if (otherUser.inboxEnabled === false) {
      throw new Error("This user's inbox is disabled");
    }

    // Normalize user IDs (smaller ID first)
    const [userAId, userBId] =
      currentUser._id < args.otherUserId
        ? [currentUser._id, args.otherUserId]
        : [args.otherUserId, currentUser._id];

    // Try to find existing conversation
    const existing = await ctx.db
      .query("dmConversations")
      .withIndex("by_userA_userB", (q) =>
        q.eq("userAId", userAId).eq("userBId", userBId),
      )
      .unique();

    if (existing) {
      // Check if the CURRENT user has deleted this conversation
      const currentUserDeletion = await ctx.db
        .query("dmDeletedConversations")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", existing._id).eq("userId", currentUser._id),
        )
        .first();

      // If current user deleted it, remove their deletion record so they can see it again
      if (currentUserDeletion) {
        await ctx.db.delete(currentUserDeletion._id);
      }

      // Check if the OTHER user (recipient) has deleted this conversation
      const recipientDeletion = await ctx.db
        .query("dmDeletedConversations")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", existing._id).eq("userId", args.otherUserId),
        )
        .first();

      // If recipient deleted it, remove their deletion record so conversation appears fresh for them
      if (recipientDeletion) {
        await ctx.db.delete(recipientDeletion._id);
      }

      return existing._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("dmConversations", {
      userAId,
      userBId,
      lastActivityTime: Date.now(),
    });

    return conversationId;
  },
});

/**
 * Send a message in a conversation
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("dmConversations"),
    content: v.string(),
    parentMessageId: v.optional(v.id("dmMessages")),
  },
  returns: v.id("dmMessages"),
  handler: async (ctx, args) => {
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

    // Validate content length
    if (args.content.length > 2000) {
      throw new Error("Message too long (max 2000 characters)");
    }

    if (args.content.trim().length === 0) {
      throw new Error("Message cannot be empty");
    }

    // Get conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify user is part of conversation
    if (
      conversation.userAId !== currentUser._id &&
      conversation.userBId !== currentUser._id
    ) {
      throw new Error("Not authorized to send in this conversation");
    }

    // Get recipient ID
    const recipientId =
      conversation.userAId === currentUser._id
        ? conversation.userBId
        : conversation.userAId;

    // Check if recipient has inbox enabled
    const recipient = await ctx.db.get(recipientId);
    if (!recipient) {
      throw new Error("Recipient not found");
    }

    const recipientInboxEnabled = recipient.inboxEnabled ?? true;
    if (!recipientInboxEnabled) {
      throw new Error(
        "This user has disabled their inbox and cannot receive messages",
      );
    }

    // Check if sender is blocked by recipient
    const isBlocked = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", recipientId).eq("blockedUserId", currentUser._id),
      )
      .first();

    if (isBlocked) {
      throw new Error("You have been blocked by this user");
    }

    // Check rate limits
    const rateLimitCheck = await ctx.runQuery(internal.dm.checkRateLimit, {
      senderId: currentUser._id,
      recipientId,
    });

    if (!rateLimitCheck.canSend) {
      throw new Error(rateLimitCheck.reason || "Rate limit exceeded");
    }

    // Insert message
    const messageId = await ctx.db.insert("dmMessages", {
      conversationId: args.conversationId,
      senderId: currentUser._id,
      content: args.content,
      parentMessageId: args.parentMessageId,
    });

    // Update conversation last activity
    await ctx.db.patch(args.conversationId, {
      lastMessageId: messageId,
      lastActivityTime: Date.now(),
    });

    // Check if recipient has deleted this conversation - if so, remove their deletion record
    // so the conversation reappears in their inbox when they receive a new message
    const recipientDeletion = await ctx.db
      .query("dmDeletedConversations")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", recipientId),
      )
      .first();

    if (recipientDeletion) {
      await ctx.db.delete(recipientDeletion._id);
    }

    // Record rate limit
    await ctx.runMutation(internal.dm.recordMessageSend, {
      senderId: currentUser._id,
      recipientId,
    });

    // Create alert for recipient
    await ctx.db.insert("alerts", {
      recipientUserId: recipientId,
      actorUserId: currentUser._id,
      type: "message",
      isRead: false,
    });

    return messageId;
  },
});

/**
 * Delete a message (soft delete - only removes from sender's view)
 */
export const deleteMessage = mutation({
  args: { messageId: v.id("dmMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Only sender can delete their own message
    if (message.senderId !== currentUser._id) {
      throw new Error("You can only delete your own messages");
    }

    // Add user to deletedBy array
    const deletedBy = message.deletedBy ?? [];
    if (!deletedBy.includes(currentUser._id)) {
      await ctx.db.patch(args.messageId, {
        deletedBy: [...deletedBy, currentUser._id],
      });
    }

    return null;
  },
});

/**
 * Delete a conversation (soft delete - removes from user's view and hides all messages)
 */
export const deleteConversation = mutation({
  args: { conversationId: v.id("dmConversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify user is part of conversation
    if (
      conversation.userAId !== currentUser._id &&
      conversation.userBId !== currentUser._id
    ) {
      throw new Error("Not authorized to delete this conversation");
    }

    // Check if already deleted
    const existing = await ctx.db
      .query("dmDeletedConversations")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", currentUser._id),
      )
      .first();

    if (existing) {
      return null; // Already deleted
    }

    // Mark all messages in this conversation as deleted for this user
    const messages = await ctx.db
      .query("dmMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    for (const message of messages) {
      const deletedBy = message.deletedBy || [];
      if (!deletedBy.includes(currentUser._id)) {
        await ctx.db.patch(message._id, {
          deletedBy: [...deletedBy, currentUser._id],
        });
      }
    }

    // Create deletion record
    await ctx.db.insert("dmDeletedConversations", {
      conversationId: args.conversationId,
      userId: currentUser._id,
    });

    return null;
  },
});

/**
 * Clear entire inbox (delete all conversations and hide all messages for user)
 */
export const clearInbox = mutation({
  args: {},
  returns: v.object({ deletedCount: v.number() }),
  handler: async (ctx) => {
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

    // Get all conversations for user
    const conversationsA = await ctx.db
      .query("dmConversations")
      .withIndex("by_userA_activity", (q) => q.eq("userAId", currentUser._id))
      .collect();

    const conversationsB = await ctx.db
      .query("dmConversations")
      .withIndex("by_userB_activity", (q) => q.eq("userBId", currentUser._id))
      .collect();

    const allConversations = [...conversationsA, ...conversationsB];
    let deletedCount = 0;

    for (const conversation of allConversations) {
      // Check if not already deleted
      const existing = await ctx.db
        .query("dmDeletedConversations")
        .withIndex("by_conversation_user", (q) =>
          q
            .eq("conversationId", conversation._id)
            .eq("userId", currentUser._id),
        )
        .first();

      if (!existing) {
        // Mark all messages in this conversation as deleted for this user
        const messages = await ctx.db
          .query("dmMessages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .collect();

        for (const message of messages) {
          const deletedBy = message.deletedBy || [];
          if (!deletedBy.includes(currentUser._id)) {
            await ctx.db.patch(message._id, {
              deletedBy: [...deletedBy, currentUser._id],
            });
          }
        }

        // Mark conversation as deleted
        await ctx.db.insert("dmDeletedConversations", {
          conversationId: conversation._id,
          userId: currentUser._id,
        });
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

/**
 * List conversations for current user (excludes deleted conversations)
 */
export const listConversations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("dmConversations"),
      _creationTime: v.number(),
      lastActivityTime: v.number(),
      otherUser: v.object({
        _id: v.id("users"),
        name: v.string(),
        username: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        inboxEnabled: v.boolean(),
      }),
      lastMessage: v.optional(
        v.object({
          content: v.string(),
          senderId: v.id("users"),
          _creationTime: v.number(),
        }),
      ),
      unreadCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return [];
    }

    // Get all conversations for user
    const conversationsA = await ctx.db
      .query("dmConversations")
      .withIndex("by_userA_activity", (q) => q.eq("userAId", currentUser._id))
      .order("desc")
      .collect();

    const conversationsB = await ctx.db
      .query("dmConversations")
      .withIndex("by_userB_activity", (q) => q.eq("userBId", currentUser._id))
      .order("desc")
      .collect();

    const allConversations = [...conversationsA, ...conversationsB];

    // Filter out deleted conversations
    const deletedConversations = await ctx.db
      .query("dmDeletedConversations")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const deletedIds = new Set(
      deletedConversations.map((d) => d.conversationId),
    );
    const activeConversations = allConversations.filter(
      (c) => !deletedIds.has(c._id),
    );

    // Sort by last activity
    activeConversations.sort((a, b) => b.lastActivityTime - a.lastActivityTime);

    // Get read status
    const reads = await ctx.db
      .query("dmReads")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const readMap = new Map(
      reads.map((r) => [r.conversationId, r.lastReadTime]),
    );

    // Build conversation list with details
    const result = [];
    for (const conversation of activeConversations) {
      const otherUserId =
        conversation.userAId === currentUser._id
          ? conversation.userBId
          : conversation.userAId;

      const otherUser = await ctx.db.get(otherUserId);
      if (!otherUser) continue;

      // Get last message
      let lastMessage;
      if (conversation.lastMessageId) {
        const msg = await ctx.db.get(conversation.lastMessageId);
        if (msg && !(msg.deletedBy || []).includes(currentUser._id)) {
          lastMessage = {
            content: msg.content,
            senderId: msg.senderId,
            _creationTime: msg._creationTime,
          };
        }
      }

      // Calculate unread count
      const lastReadTime = readMap.get(conversation._id) || 0;
      const messages = await ctx.db
        .query("dmMessages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .filter((q) => q.gte(q.field("_creationTime"), lastReadTime))
        .filter((q) => q.neq(q.field("senderId"), currentUser._id))
        .collect();

      const unreadCount = messages.filter(
        (m) => !(m.deletedBy || []).includes(currentUser._id),
      ).length;

      result.push({
        _id: conversation._id,
        _creationTime: conversation._creationTime,
        lastActivityTime: conversation.lastActivityTime,
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name,
          username: otherUser.username,
          imageUrl: otherUser.imageUrl,
          inboxEnabled: otherUser.inboxEnabled ?? true, // Default to enabled
        },
        lastMessage,
        unreadCount,
      });
    }

    return result;
  },
});

/**
 * Get a single conversation's details (for when it's not in the list yet)
 */
export const getConversation = query({
  args: { conversationId: v.id("dmConversations") },
  returns: v.union(
    v.object({
      _id: v.id("dmConversations"),
      otherUser: v.object({
        _id: v.id("users"),
        name: v.string(),
        username: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        inboxEnabled: v.boolean(),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    // Verify user is part of conversation
    if (
      conversation.userAId !== currentUser._id &&
      conversation.userBId !== currentUser._id
    ) {
      return null;
    }

    // Check if conversation is deleted by current user
    const deleted = await ctx.db
      .query("dmDeletedConversations")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", currentUser._id),
      )
      .first();

    if (deleted) {
      return null; // Don't show deleted conversations
    }

    const otherUserId =
      conversation.userAId === currentUser._id
        ? conversation.userBId
        : conversation.userAId;

    const otherUser = await ctx.db.get(otherUserId);
    if (!otherUser) {
      return null;
    }

    return {
      _id: conversation._id,
      otherUser: {
        _id: otherUser._id,
        name: otherUser.name,
        username: otherUser.username,
        imageUrl: otherUser.imageUrl,
        inboxEnabled: otherUser.inboxEnabled ?? true,
      },
    };
  },
});

/**
 * List messages in a conversation (excludes messages deleted by current user)
 */
export const listMessages = query({
  args: {
    conversationId: v.id("dmConversations"),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      }),
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("dmMessages"),
      _creationTime: v.number(),
      senderId: v.id("users"),
      content: v.string(),
      parentMessageId: v.optional(v.id("dmMessages")),
      sender: v.object({
        _id: v.id("users"),
        name: v.string(),
        username: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return [];
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return [];
    }

    // Verify user is part of conversation
    if (
      conversation.userAId !== currentUser._id &&
      conversation.userBId !== currentUser._id
    ) {
      return [];
    }

    // Get messages
    const messages = await ctx.db
      .query("dmMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(50); // Load 50 at a time

    // Filter out messages deleted by current user
    const visibleMessages = messages.filter(
      (m) => !(m.deletedBy || []).includes(currentUser._id),
    );

    // Get sender details
    const result = [];
    for (const message of visibleMessages) {
      const sender = await ctx.db.get(message.senderId);
      if (!sender) continue;

      result.push({
        _id: message._id,
        _creationTime: message._creationTime,
        senderId: message.senderId,
        content: message.content,
        parentMessageId: message.parentMessageId,
        sender: {
          _id: sender._id,
          name: sender.name,
          username: sender.username,
          imageUrl: sender.imageUrl,
        },
      });
    }

    return result.reverse(); // Return in chronological order
  },
});

/**
 * Mark conversation as read
 */
export const markConversationRead = mutation({
  args: { conversationId: v.id("dmConversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Silently return if not authenticated (happens during page load)
      return null;
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      // Silently return if user not found (happens during initial sync)
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify user is part of conversation
    if (
      conversation.userAId !== currentUser._id &&
      conversation.userBId !== currentUser._id
    ) {
      throw new Error("Not authorized");
    }

    // Update or create read status
    const existing = await ctx.db
      .query("dmReads")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", currentUser._id),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastReadTime: Date.now(),
      });
    } else {
      await ctx.db.insert("dmReads", {
        conversationId: args.conversationId,
        userId: currentUser._id,
        lastReadTime: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Check if user has any unread messages (for showing the black dot indicator)
 */
export const hasUnreadMessages = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return false;
    }

    // Get all conversations for user
    const conversationsA = await ctx.db
      .query("dmConversations")
      .withIndex("by_userA_activity", (q) => q.eq("userAId", currentUser._id))
      .collect();

    const conversationsB = await ctx.db
      .query("dmConversations")
      .withIndex("by_userB_activity", (q) => q.eq("userBId", currentUser._id))
      .collect();

    const allConversations = [...conversationsA, ...conversationsB];

    // Filter out deleted conversations
    const deletedConversations = await ctx.db
      .query("dmDeletedConversations")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const deletedIds = new Set(
      deletedConversations.map((d) => d.conversationId),
    );
    const activeConversations = allConversations.filter(
      (c) => !deletedIds.has(c._id),
    );

    // Get read status
    const reads = await ctx.db
      .query("dmReads")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const readMap = new Map(
      reads.map((r) => [r.conversationId, r.lastReadTime]),
    );

    // Check if any conversation has unread messages
    for (const conversation of activeConversations) {
      const lastReadTime = readMap.get(conversation._id) || 0;
      const messages = await ctx.db
        .query("dmMessages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .filter((q) => q.gte(q.field("_creationTime"), lastReadTime))
        .filter((q) => q.neq(q.field("senderId"), currentUser._id))
        .take(1);

      const unreadMessages = messages.filter(
        (m) => !(m.deletedBy || []).includes(currentUser._id),
      );

      if (unreadMessages.length > 0) {
        return true;
      }
    }

    return false;
  },
});

/**
 * Mark all conversations as read (called when visiting inbox page)
 */
export const markAllConversationsRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Silently return if not authenticated
      return null;
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      // Silently return if user not found
      return null;
    }

    // Get all conversations for user
    const conversationsA = await ctx.db
      .query("dmConversations")
      .withIndex("by_userA_activity", (q) => q.eq("userAId", currentUser._id))
      .collect();

    const conversationsB = await ctx.db
      .query("dmConversations")
      .withIndex("by_userB_activity", (q) => q.eq("userBId", currentUser._id))
      .collect();

    const allConversations = [...conversationsA, ...conversationsB];

    // Filter out deleted conversations
    const deletedConversations = await ctx.db
      .query("dmDeletedConversations")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const deletedIds = new Set(
      deletedConversations.map((d) => d.conversationId),
    );
    const activeConversations = allConversations.filter(
      (c) => !deletedIds.has(c._id),
    );

    // Mark all active conversations as read
    const now = Date.now();
    for (const conversation of activeConversations) {
      const existing = await ctx.db
        .query("dmReads")
        .withIndex("by_conversation_user", (q) =>
          q
            .eq("conversationId", conversation._id)
            .eq("userId", currentUser._id),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          lastReadTime: now,
        });
      } else {
        await ctx.db.insert("dmReads", {
          conversationId: conversation._id,
          userId: currentUser._id,
          lastReadTime: now,
        });
      }
    }

    return null;
  },
});

/**
 * Report a message or user
 */
export const reportMessageOrUser = mutation({
  args: {
    reportedUserId: v.id("users"),
    conversationId: v.id("dmConversations"),
    messageId: v.optional(v.id("dmMessages")),
    reason: v.string(),
  },
  returns: v.id("dmReports"),
  handler: async (ctx, args) => {
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

    // Validate reason
    if (args.reason.trim().length === 0) {
      throw new Error("Reason cannot be empty");
    }

    // Prevent self-reporting
    if (currentUser._id === args.reportedUserId) {
      throw new Error("You cannot report yourself");
    }

    // Create DM report
    const dmReportId = await ctx.db.insert("dmReports", {
      reporterId: currentUser._id,
      reportedUserId: args.reportedUserId,
      messageId: args.messageId,
      conversationId: args.conversationId,
      reason: args.reason,
      status: "pending",
    });

    // Also create user report for admin dashboard
    const userReportId = await ctx.db.insert("userReports", {
      reportedUserId: args.reportedUserId,
      reporterUserId: currentUser._id,
      reason: args.reason,
      status: "pending",
    });

    // Get admin user IDs for notifications
    const adminUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
    const adminUserIds = adminUsers.map((u) => u._id);

    // Send email notifications to admins
    if (adminUserIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.emails.reports.sendUserReportNotificationEmails,
        {
          reporterUserId: currentUser._id,
          reportedUserId: args.reportedUserId,
          reportId: userReportId,
          adminUserIds: adminUserIds,
        },
      );
    }

    return dmReportId;
  },
});

/**
 * Block a user from sending messages
 */
export const blockUser = mutation({
  args: {
    blockedUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    // Prevent self-blocking
    if (currentUser._id === args.blockedUserId) {
      throw new Error("You cannot block yourself");
    }

    // Check if already blocked
    const existing = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_blocked", (q) =>
        q
          .eq("blockerId", currentUser._id)
          .eq("blockedUserId", args.blockedUserId),
      )
      .first();

    if (existing) {
      throw new Error("User is already blocked");
    }

    // Create block record
    await ctx.db.insert("blockedUsers", {
      blockerId: currentUser._id,
      blockedUserId: args.blockedUserId,
    });

    return null;
  },
});

/**
 * Unblock a user
 */
export const unblockUser = mutation({
  args: {
    blockedUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    // Find block record
    const blockRecord = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_blocked", (q) =>
        q
          .eq("blockerId", currentUser._id)
          .eq("blockedUserId", args.blockedUserId),
      )
      .first();

    if (!blockRecord) {
      throw new Error("User is not blocked");
    }

    // Delete block record
    await ctx.db.delete(blockRecord._id);

    return null;
  },
});

/**
 * Check if current user has blocked another user
 */
export const isUserBlocked = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return false;
    }

    const blockRecord = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", currentUser._id).eq("blockedUserId", args.userId),
      )
      .first();

    return !!blockRecord;
  },
});
