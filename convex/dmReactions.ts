import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Define allowed emoji reactions
const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏"] as const;

// Validator for allowed emojis
export const emojiValidator = v.union(
  v.literal("👍"),
  v.literal("❤️"),
  v.literal("😂"),
  v.literal("😮"),
  v.literal("😢"),
  v.literal("👏"),
);

/**
 * Add or update a reaction to a message
 * Each user can only have one reaction per message
 */
export const addOrUpdateReaction = mutation({
  args: {
    messageId: v.id("dmMessages"),
    emoji: emojiValidator,
  },
  returns: v.id("dmReactions"),
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

    // Get the message to verify it exists and user has access
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Get conversation to verify user is part of it
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify user is part of conversation
    if (
      conversation.userAId !== currentUser._id &&
      conversation.userBId !== currentUser._id
    ) {
      throw new Error("Not authorized to react to this message");
    }

    // Check if user already has a reaction on this message
    const existingReaction = await ctx.db
      .query("dmReactions")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", currentUser._id).eq("messageId", args.messageId),
      )
      .first();

    if (existingReaction) {
      // Update existing reaction
      await ctx.db.patch(existingReaction._id, {
        emoji: args.emoji,
      });
      return existingReaction._id;
    } else {
      // Create new reaction
      const reactionId = await ctx.db.insert("dmReactions", {
        messageId: args.messageId,
        userId: currentUser._id,
        emoji: args.emoji,
      });
      return reactionId;
    }
  },
});

/**
 * Remove a reaction from a message
 */
export const removeReaction = mutation({
  args: {
    messageId: v.id("dmMessages"),
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

    // Find user's reaction on this message
    const reaction = await ctx.db
      .query("dmReactions")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", currentUser._id).eq("messageId", args.messageId),
      )
      .first();

    if (reaction) {
      await ctx.db.delete(reaction._id);
    }

    return null;
  },
});

/**
 * Get all reactions for a message
 * Groups reactions by emoji with user details
 */
export const getMessageReactions = query({
  args: {
    messageId: v.id("dmMessages"),
  },
  returns: v.array(
    v.object({
      emoji: v.string(),
      count: v.number(),
      users: v.array(
        v.object({
          userId: v.id("users"),
          name: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    // Get all reactions for this message
    const reactions = await ctx.db
      .query("dmReactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Group reactions by emoji
    const groupedReactions = new Map<
      string,
      Array<{ userId: Id<"users">; name: string }>
    >();

    for (const reaction of reactions) {
      const user = await ctx.db.get(reaction.userId);
      if (!user) continue;

      const existing = groupedReactions.get(reaction.emoji) || [];
      existing.push({
        userId: reaction.userId,
        name: user.name,
      });
      groupedReactions.set(reaction.emoji, existing);
    }

    // Convert to array format
    const result = Array.from(groupedReactions.entries()).map(
      ([emoji, users]) => ({
        emoji,
        count: users.length,
        users,
      }),
    );

    return result;
  },
});
