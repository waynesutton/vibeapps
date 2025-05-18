import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUserByCtx } from "./users"; // Assuming this helper exists and is correctly implemented

// --- MUTATIONS ---

export const followUser = mutation({
  args: { userIdToFollow: v.id("users") },
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
        q.eq("followerId", currentUser._id).eq("followingId", args.userIdToFollow)
      )
      .unique();

    if (existingFollow) {
      return { success: true, message: "Already following" };
    }

    await ctx.db.insert("follows", {
      followerId: currentUser._id,
      followingId: args.userIdToFollow,
    });
    return { success: true, message: "User followed" };
  },
});

export const unfollowUser = mutation({
  args: { userIdToUnfollow: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await getUserByCtx(ctx);
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const followRecord = await ctx.db
      .query("follows")
      .withIndex("by_followerId_followingId", (q) =>
        q.eq("followerId", currentUser._id).eq("followingId", args.userIdToUnfollow)
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
      })
    );
    return followers.filter(Boolean); // Filter out any nulls if users were deleted or issues
  },
});

export const getFollowing = query({
  args: { userId: v.id("users") },
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
      })
    );
    return following.filter(Boolean);
  },
});

export const getFollowStats = query({
  args: { userId: v.id("users") },
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
        q.eq("followerId", currentUser._id).eq("followingId", args.profileUserId)
      )
      .unique();
    return !!existingFollow;
  },
});
