import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUserByCtx } from "./users"; // Assuming this helper exists and is correctly implemented
import { internal } from "./_generated/api";

// --- MUTATIONS ---

export const followUser = mutation({
  args: { userIdToFollow: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getUserByCtx(ctx);
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    if (currentUser._id === args.userIdToFollow) {
      throw new Error("Cannot follow yourself");
    }

    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_followerId_followingId", (q) =>
        q
          .eq("followerId", currentUser._id)
          .eq("followingId", args.userIdToFollow),
      )
      .unique();

    if (existingFollow) {
      return { success: true, message: "Already following" };
    }

    await ctx.db.insert("follows", {
      followerId: currentUser._id,
      followingId: args.userIdToFollow,
    });

    // Create alert for the followed user (non-blocking)
    await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
      recipientUserId: args.userIdToFollow,
      actorUserId: currentUser._id,
      type: "follow",
    });

    return { success: true, message: "User followed" };
  },
});

export const unfollowUser = mutation({
  args: { userIdToUnfollow: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getUserByCtx(ctx);
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const followRecord = await ctx.db
      .query("follows")
      .withIndex("by_followerId_followingId", (q) =>
        q
          .eq("followerId", currentUser._id)
          .eq("followingId", args.userIdToUnfollow),
      )
      .unique();

    if (followRecord) {
      await ctx.db.delete(followRecord._id);
      return { success: true, message: "User unfollowed" };
    }
    return { success: false, message: "Not following this user" };
  },
});

// --- QUERIES ---

export const getFollowers = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      clerkId: v.string(),
      email: v.optional(v.string()),
      username: v.string(), // Guaranteed to be string (defaults to "N/A")
      imageUrl: v.optional(v.string()),
      bio: v.optional(v.string()),
      website: v.optional(v.string()),
      twitter: v.optional(v.string()),
      bluesky: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      isBanned: v.optional(v.boolean()),
      isPaused: v.optional(v.boolean()),
      isVerified: v.optional(v.boolean()),
      inboxEnabled: v.optional(v.boolean()),
      emojiTheme: v.optional(v.string()),
      role: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_followingId", (q) => q.eq("followingId", args.userId))
      .collect();

    const followerIds = follows.map((f) => f.followerId);
    // Fetch actual user documents for followers
    const followers = await Promise.all(
      followerIds.map(async (id: Id<"users">) => {
        const user = await ctx.db.get(id);
        // Attach username if it exists, handle potential null user
        return user ? { ...user, username: user.username || "N/A" } : null;
      }),
    );
    // Filter out nulls with proper type narrowing
    return followers.filter(
      (u): u is NonNullable<typeof u> => u !== null,
    );
  },
});

export const getFollowing = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      clerkId: v.string(),
      email: v.optional(v.string()),
      username: v.string(), // Guaranteed to be string (defaults to "N/A")
      imageUrl: v.optional(v.string()),
      bio: v.optional(v.string()),
      website: v.optional(v.string()),
      twitter: v.optional(v.string()),
      bluesky: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      isBanned: v.optional(v.boolean()),
      isPaused: v.optional(v.boolean()),
      isVerified: v.optional(v.boolean()),
      inboxEnabled: v.optional(v.boolean()),
      emojiTheme: v.optional(v.string()),
      role: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_followerId", (q) => q.eq("followerId", args.userId))
      .collect();

    const followingIds = follows.map((f) => f.followingId);
    // Fetch actual user documents for those being followed
    const following = await Promise.all(
      followingIds.map(async (id: Id<"users">) => {
        const user = await ctx.db.get(id);
        // Attach username if it exists, handle potential null user
        return user ? { ...user, username: user.username || "N/A" } : null;
      }),
    );
    // Filter out nulls with proper type narrowing
    return following.filter(
      (u): u is NonNullable<typeof u> => u !== null,
    );
  },
});

export const getFollowStats = query({
  args: { userId: v.id("users") },
  returns: v.object({
    followersCount: v.number(),
    followingCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followingId", (q) => q.eq("followingId", args.userId))
      .collect();

    const following = await ctx.db
      .query("follows")
      .withIndex("by_followerId", (q) => q.eq("followerId", args.userId))
      .collect();

    return {
      followersCount: followers.length,
      followingCount: following.length,
    };
  },
});

export const isFollowing = query({
  args: { profileUserId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const currentUser = await getUserByCtx(ctx);
    if (!currentUser) {
      return false;
    }
    if (currentUser._id === args.profileUserId) {
      return false; // Cannot follow self
    }

    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_followerId_followingId", (q) =>
        q
          .eq("followerId", currentUser._id)
          .eq("followingId", args.profileUserId),
      )
      .unique();
    return !!existingFollow;
  },
});
