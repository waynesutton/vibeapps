import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const getTopUsersByFollowers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const allFollows = await ctx.db.query("follows").collect();
    const followerCounts: Map<Id<"users">, number> = new Map();

    for (const follow of allFollows) {
      followerCounts.set(follow.followingId, (followerCounts.get(follow.followingId) || 0) + 1);
    }

    const sortedUsers = Array.from(followerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const userDetails = await Promise.all(
      sortedUsers.map(async ([userId, count]) => {
        const user = await ctx.db.get(userId);
        return user ? { ...user, username: user.username || "N/A", followerCount: count } : null;
      })
    );
    return userDetails.filter(Boolean);
  },
});

export const getTopUsersByFollowing = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const allFollows = await ctx.db.query("follows").collect();
    const followingCounts: Map<Id<"users">, number> = new Map();

    for (const follow of allFollows) {
      followingCounts.set(follow.followerId, (followingCounts.get(follow.followerId) || 0) + 1);
    }

    const sortedUsers = Array.from(followingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const userDetails = await Promise.all(
      sortedUsers.map(async ([userId, count]) => {
        const user = await ctx.db.get(userId);
        return user ? { ...user, username: user.username || "N/A", followingCount: count } : null;
      })
    );
    return userDetails.filter(Boolean);
  },
});

export const getTotalFollowRelationships = query({
  args: {},
  handler: async (ctx) => {
    const allFollows = await ctx.db.query("follows").collect();
    return allFollows.length;
  },
});
