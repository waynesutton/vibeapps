# Implementing Followers and Following Feature

This document outlines the steps to add a "follow" and "follower" system to the application. This includes changes to the database schema, backend Convex functions, and frontend React components.

## 1. Database Schema Changes (`convex/schema.ts`)

We need a new table to store the relationships between users who follow each other.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ... existing tables (users, stories, comments, etc.)

  follows: defineTable({
    followerId: v.id("users"), // The ID of the user who is performing the follow action
    followingId: v.id("users"), // The ID of the user who is being followed
  })
    .index("by_followerId_followingId", ["followerId", "followingId"]) // Unique constraint and quick lookups for unfollow
    .index("by_followingId", ["followingId"]) // To get all followers of a user
    .index("by_followerId", ["followerId"]), // To get all users a user is following

  // ... other existing tables
});
```

**Explanation:**

- The `follows` table will store pairs of `followerId` and `followingId`.
- `by_followerId_followingId`: This index ensures a user cannot follow another user multiple times and allows for efficient unfollowing.
- `by_followingId`: This index helps quickly retrieve all users who are following a specific user (their followers).
- `by_followerId`: This index helps quickly retrieve all users a specific user is following.

## 2. Convex Backend Functions

We'll need new mutations to handle follow/unfollow actions and queries to retrieve follower/following data. These can be placed in a new file `convex/follows.ts` or added to `convex/users.ts`. For organization, `convex/follows.ts` is recommended.

### `convex/follows.ts` (New File)

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUserByCtx } from "./users"; // Assuming you have a helper to get authenticated user

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

    // Check if already following
    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_followerId_followingId", (q) =>
        q.eq("followerId", currentUser._id).eq("followingId", args.userIdToFollow)
      )
      .unique();

    if (existingFollow) {
      // Already following, perhaps do nothing or return a specific status
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
    const followers = await Promise.all(followerIds.map((id) => ctx.db.get(id)));
    return followers.filter(Boolean); // Filter out any nulls if users were deleted
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
    const following = await Promise.all(followingIds.map((id) => ctx.db.get(id)));
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
      return false; // Not authenticated, so not following
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
```

### Updates to `convex/users.ts`

The `getUserProfileByUsername` query needs to be updated to return follower/following counts and whether the current user is following the profile user.

```typescript
// convex/users.ts (Example modification)
// ... other imports
import { internal } from "./_generated/api"; // if getFollowStats and isFollowing are in follows.ts

// In your getUserProfileByUsername query handler:
export const getUserProfileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();

    if (!user) {
      return null;
    }

    // ... (fetch stories, votes, comments, ratings as before)

    // Fetch follow stats
    const followStats = await ctx.runQuery(internal.follows.getFollowStats, { userId: user._id }); // or api.follows.getFollowStats
    const isFollowedByCurrentUser = await ctx.runQuery(internal.follows.isFollowing, {
      profileUserId: user._id,
    }); // or api.follows.isFollowing

    return {
      user,
      stories, // your existing data
      votes, // your existing data
      comments, // your existing data
      ratings, // your existing data
      followersCount: followStats.followersCount,
      followingCount: followStats.followingCount,
      isFollowedByCurrentUser,
    };
  },
});
```

### Admin Queries (`convex/adminQueries.ts` or a new `convex/adminFollowsQueries.ts`)

```typescript
// convex/adminQueries.ts (or a new dedicated file)
import { internalQuery } from "./_generated/server"; // Use internalQuery if only for admin dashboard
import { v } from "convex/values";

export const getTopUsersByFollowers = internalQuery({
  args: { limit: v.optional(v.number()) }, // Default limit if needed
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    // This is a simplified version. A more performant way for very large datasets
    // might involve map-reduce or pre-aggregated counts if Convex supports it directly,
    // or periodically updated summary tables.
    // For now, fetching all and processing might be acceptable for moderate user counts.

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
        return user ? { ...user, followerCount: count } : null;
      })
    );
    return userDetails.filter(Boolean);
  },
});

export const getTopUsersByFollowing = internalQuery({
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
        return user ? { ...user, followingCount: count } : null;
      })
    );
    return userDetails.filter(Boolean);
  },
});

// You might also want a query for total follow relationships if desired for NumbersView
export const getTotalFollowRelationships = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allFollows = await ctx.db.query("follows").collect();
    return allFollows.length;
  },
});
```

**Note:** The `getTopUsersByFollowers` and `getTopUsersByFollowing` queries above fetch all follow relationships and process them in the function. For very large numbers of users/follows, this could become slow or hit limits. Consider denormalization (e.g., adding `followersCount` and `followingCount` directly to the `users` table and updating them with mutations/internal mutations) or more advanced aggregation if performance becomes an issue.

## 3. Frontend Implementation

### `src/pages/UserProfilePage.tsx`

1.  **Import new hooks and types:**

    ```tsx
    import { api } from "../../convex/_generated/api"; // Ensure new functions are available
    // Add types for follower/following user lists if needed
    ```

2.  **Mutations for Follow/Unfollow:**

    ```tsx
    const followUserMutation = useMutation(api.follows.followUser); // or api.users.followUser
    const unfollowUserMutation = useMutation(api.follows.unfollowUser); // or api.users.unfollowUser
    ```

3.  **Follow Button:**

    - Below the social links section (around line 525), add the button.
    - Its state (Follow/Unfollowing/Loading) will depend on `profileData.isFollowedByCurrentUser` and `isOwnProfile`.
    - The button should not be visible on one's own profile.

    ```tsx
    // Inside the main return, after social links div, before isOwnProfile && !isEditing button:
    {
      isOwnProfile === false &&
        authUser &&
        profileUser && ( // Only show if not own profile and logged in
          <div className="mt-3">
            <button
              onClick={async () => {
                if (!profileUser?._id) return;
                try {
                  if (profileData.isFollowedByCurrentUser) {
                    await unfollowUserMutation({ userIdToUnfollow: profileUser._id });
                    // Add toast/notification for unfollow
                  } else {
                    await followUserMutation({ userIdToFollow: profileUser._id });
                    // Add toast/notification for follow
                  }
                  // Data should refetch due to Convex reactivity.
                } catch (error) {
                  console.error("Follow/Unfollow failed:", error);
                  // Add error toast
                }
              }}
              className="px-6 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              style={{ fontFamily: "Inter, sans-serif" }}
              // disabled={isLoadingFollowAction} // Add loading state if desired
            >
              {/* {isLoadingFollowAction ? "Processing..." : profileData.isFollowedByCurrentUser ? "Unfollow" : "Follow"} */}
              {profileData.isFollowedByCurrentUser ? "Unfollow" : "Follow"}
            </button>
          </div>
        );
    }
    ```

4.  **Display Follower/Following Counts in Dashboard Section:**

    - Around line 620, in the "Dashboard" section, add new entries.
    - The data will come from `profileData.followersCount` and `profileData.followingCount`.

    ```tsx
    // Inside the Dashboard section's flex container (around line 620+):
    <div className="flex flex-col items-center">
      <a
        href="#tab-section-followers" // Link to the new tab
        onClick={() => setActiveTab("followers")}
        className="text-xl text-[#292929] hover:underline">
        {/* {profileData?.followersCount ?? 0} */}
        {profileData.followersCount}
      </a>
      <span className="text-sm text-gray-500">Followers</span>
    </div>
    <div className="flex flex-col items-center">
      <a
        href="#tab-section-following" // Link to the new tab
        onClick={() => setActiveTab("following")}
        className="text-xl text-[#292929] hover:underline">
        {/* {profileData?.followingCount ?? 0} */}
        {profileData.followingCount}
      </a>
      <span className="text-sm text-gray-500">Following</span>
    </div>
    ```

5.  **Add "Followers" and "Following" Tabs:**

    - Around line 740, in the tab buttons `div`, add new buttons.
    - You'll need to fetch the actual lists of followers and following users. This could be done via separate `useQuery` calls or by including them in the `getUserProfileByUsername` response (though this might make the initial load heavier). Separate queries are often cleaner.

    ```tsx
    // Add to state:
    // const [followersList, setFollowersList] = useState<Doc<"users">[] | null>(null);
    // const [followingList, setFollowingList] = useState<Doc<"users">[] | null>(null);

    // Fetch followers/following data when profileUser._id is available:
    const followersData = useQuery(
      api.follows.getFollowers, // or api.users.getFollowers
      profileUser?._id ? { userId: profileUser._id } : "skip"
    );
    const followingData = useQuery(
      api.follows.getFollowing, // or api.users.getFollowing
      profileUser?._id ? { userId: profileUser._id } : "skip"
    );
    ```

    ```tsx
    // Inside the tab buttons div (around line 765, after Bookmarks button):
    <button
      onClick={() => setActiveTab("followers")}
      className={`py-2 px-4 text-sm font-medium focus:outline-none ${
        activeTab === "followers"
          ? "border-b-2 border-[#292929] text-[#292929]"
          : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}>
      Followers ({profileData.followersCount ?? 0})
    </button>
    <button
      onClick={() => setActiveTab("following")}
      className={`py-2 px-4 text-sm font-medium focus:outline-none ${
        activeTab === "following"
          ? "border-b-2 border-[#292929] text-[#292929]"
          : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}>
      Following ({profileData.followingCount ?? 0})
    </button>
    ```

6.  **Render Content for New Tabs:**

    - Below the existing `activeTab === "bookmarks"` section (around line 965), add new sections for "followers" and "following".
    - These sections will map over `followersData` and `followingData` respectively, displaying user information (avatar, name, username) with a link to their profiles.

    ```tsx
    // After the bookmarks tab content section:
    {
      activeTab === "followers" && (
        <section
          id="tab-section-followers"
          className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
          {(!followersData || followersData.length === 0) && (
            <p className="text-gray-500 italic">No followers yet.</p>
          )}
          {followersData && followersData.length > 0 && (
            <ul className="space-y-4">
              {followersData.map(
                (follower) =>
                  follower && ( // Check if follower is not null
                    <li
                      key={follower._id}
                      className="p-4 bg-gray-50 border border-gray-200 rounded-md flex items-center transition-shadow">
                      <Link to={`/${follower.username}`} className="flex items-center flex-grow">
                        {/* ProfileImagePlaceholder or actual image */}
                        {follower.imageUrl ? (
                          <img
                            src={follower.imageUrl}
                            alt={follower.name ?? "User"}
                            className="w-10 h-10 rounded-full mr-3 object-cover"
                          />
                        ) : (
                          <ProfileImagePlaceholder name={follower.name} size="w-10 h-10" />
                        )}
                        <div>
                          <span className="text-md font-semibold text-[#292929] hover:underline">
                            {follower.name || "Anonymous User"}
                          </span>
                          <p className="text-sm text-gray-500">@{follower.username || "N/A"}</p>
                        </div>
                      </Link>
                      {/* Optionally, add a follow/unfollow button here too if the logged-in user is viewing this list */}
                    </li>
                  )
              )}
            </ul>
          )}
        </section>
      );
    }

    {
      activeTab === "following" && (
        <section
          id="tab-section-following"
          className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
          {(!followingData || followingData.length === 0) && (
            <p className="text-gray-500 italic">Not following anyone yet.</p>
          )}
          {followingData && followingData.length > 0 && (
            <ul className="space-y-4">
              {followingData.map(
                (followedUser) =>
                  followedUser && ( // Check if followedUser is not null
                    <li
                      key={followedUser._id}
                      className="p-4 bg-gray-50 border border-gray-200 rounded-md flex items-center transition-shadow">
                      <Link
                        to={`/${followedUser.username}`}
                        className="flex items-center flex-grow">
                        {followedUser.imageUrl ? (
                          <img
                            src={followedUser.imageUrl}
                            alt={followedUser.name ?? "User"}
                            className="w-10 h-10 rounded-full mr-3 object-cover"
                          />
                        ) : (
                          <ProfileImagePlaceholder name={followedUser.name} size="w-10 h-10" />
                        )}
                        <div>
                          <span className="text-md font-semibold text-[#292929] hover:underline">
                            {followedUser.name || "Anonymous User"}
                          </span>
                          <p className="text-sm text-gray-500">@{followedUser.username || "N/A"}</p>
                        </div>
                      </Link>
                      {/* Optionally, add a follow/unfollow button here */}
                    </li>
                  )
              )}
            </ul>
          )}
        </section>
      );
    }
    ```

### `src/components/admin/NumbersView.tsx`

1.  **Import new queries:**

    ```tsx
    // const totalFollowRelationships = useQuery(api.adminQueries.getTotalFollowRelationships, skip ? "skip" : {});
    const topFollowers = useQuery(
      api.adminQueries.getTopUsersByFollowers,
      skip ? "skip" : { limit: 100 }
    );
    const topFollowing = useQuery(
      api.adminQueries.getTopUsersByFollowing,
      skip ? "skip" : { limit: 100 }
    );
    ```

2.  **Add new `StatCard` for total relationships (optional):**

    ```tsx
    // <StatCard title="Total Follows" value={totalFollowRelationships} />
    ```

3.  **Add sections for Top 100 Followers and Top 100 Following:**

    - Below the `StatCard` grid, add two new sections.
    - Each section will have a title and a list/table rendering the `topFollowers` and `topFollowing` data.

    ```tsx
    // Below the closing div of the StatCard grid:
    <div className="mt-10">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Top 100 Most Followed Users</h2>
      {topFollowers === undefined && <p>Loading top followers...</p>}
      {topFollowers && topFollowers.length === 0 && <p>No follower data available.</p>}
      {topFollowers && topFollowers.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4">
          <ul className="divide-y divide-gray-200">
            {topFollowers.map((user, index) => (
              user && (
                <li key={user._id} className="py-3 flex justify-between items-center">
                  <span>{index + 1}. <Link to={`/${user.username}`} className="text-blue-600 hover:underline">{user.name || user.username}</Link></span>
                  <span className="text-gray-600">{user.followerCount} followers</span>
                </li>
              )
            ))}
          </ul>
        </div>
      )}
    </div>

    <div className="mt-10">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Top 100 Users Following Others Most</h2>
      {topFollowing === undefined && <p>Loading top following...</p>}
      {topFollowing && topFollowing.length === 0 && <p>No following data available.</p>}
      {topFollowing && topFollowing.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4">
          <ul className="divide-y divide-gray-200">
            {topFollowing.map((user, index) => (
              user && (
                <li key={user._id} className="py-3 flex justify-between items-center">
                  <span>{index + 1}. <Link to={`/${user.username}`} className="text-blue-600 hover:underline">{user.name || user.username}</Link></span>
                  <span className="text-gray-600">following {user.followingCount}</span>
                </li>
              )
            ))}
          </ul>
        </div>
      )}
    </div>
    ```

### `src/components/admin/AdminDashboard.tsx`

No changes should be strictly necessary here if the new "Top Followers/Following" views are integrated directly into `NumbersView.tsx` as per the user's request. If they were to be separate tabs, then `AdminTab` type and the `Tabs.List/Tabs.Trigger` array would need updates.

## 4. Summary

- **New Files:**
  - `convex/follows.ts` (recommended for backend logic)
- **Modified Files:**
  - `convex/schema.ts` (add `follows` table)
  - `convex/users.ts` (update `getUserProfileByUsername` to include follow stats and `isFollowing` status)
  - `convex/adminQueries.ts` (add queries for top followers/following)
  - `src/pages/UserProfilePage.tsx` (add follow button, dashboard stats, new tabs and content for followers/following lists)
  - `src/components/admin/NumbersView.tsx` (add sections for top 100 followers/following)

This plan provides a comprehensive approach to integrating the follow/follower functionality without altering existing UI features, instead adding new sections and capabilities as requested. Remember to run `npx convex dev` (or your Convex CLI command) to push schema changes and make new functions available.
