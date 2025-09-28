import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get story slug by ID for email links
 */
export const getStorySlug = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    return story?.slug || null;
  },
});

/**
 * Get user username by ID for email links
 */
export const getUserUsername = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.username || null;
  },
});

/**
 * Generate unsubscribe token for user
 */
export const generateUnsubscribeToken = internalMutation({
  args: {
    userId: v.id("users"),
    purpose: v.union(
      v.literal("all"),
      v.literal("daily_engagement"),
      v.literal("weekly_digest"),
      v.literal("marketing"),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Generate a simple token (in production, this should be cryptographically signed)
    const token = `${args.userId}_${args.purpose}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store token in database
    await ctx.db.insert("emailUnsubscribeTokens", {
      userId: args.userId,
      token,
      purpose: args.purpose,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return token;
  },
});
