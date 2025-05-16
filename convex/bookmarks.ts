import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { requireAuth } from "./utils"; // Helper to check authentication

// --- MUTATIONS ---

/**
 * Adds or removes a bookmark for a story by the current user.
 * Acts as a toggle: if bookmarked, it unbookmarks; if not bookmarked, it bookmarks.
 */
export const addOrRemoveBookmark = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) {
      throw new Error("User not authenticated.");
    }

    // Check if the bookmark already exists
    const existingBookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_story", (q) => q.eq("userId", user._id).eq("storyId", args.storyId))
      .unique();

    if (existingBookmark) {
      // Bookmark exists, so remove it
      await ctx.db.delete(existingBookmark._id);
      return { success: true, action: "removed" };
    } else {
      // Bookmark does not exist, so add it
      await ctx.db.insert("bookmarks", {
        userId: user._id,
        storyId: args.storyId,
      });
      return { success: true, action: "added" };
    }
  },
});

// --- QUERIES ---

/**
 * Checks if the current authenticated user has bookmarked a specific story.
 */
export const isStoryBookmarked = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) {
      return false; // Not authenticated, so can't be bookmarked by them
    }

    const bookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_story", (q) => q.eq("userId", user._id).eq("storyId", args.storyId))
      .unique();

    return !!bookmark;
  },
});

/**
 * Gets the count of bookmarks for the current authenticated user.
 */
export const countUserBookmarks = query({
  args: {},
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) {
      return 0;
    }

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return bookmarks.length;
  },
});

/**
 * Gets all bookmarks for the current authenticated user, including story details.
 */
export const getUserBookmarksWithStoryDetails = query({
  args: {},
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) {
      return [];
    }

    const userBookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc") // Show most recent bookmarks first
      .collect();

    const bookmarksWithDetails = await Promise.all(
      userBookmarks.map(async (bookmark) => {
        const story = await ctx.db.get(bookmark.storyId);
        if (!story) return null; // Story might have been deleted

        let authorName = null;
        let authorUsername = null;
        if (story.userId) {
          const author = await ctx.db.get(story.userId);
          authorName = author?.name;
          authorUsername = author?.username;
        }

        let storyScreenshotUrl = null;
        if (story.screenshotId) {
          storyScreenshotUrl = await ctx.storage.getUrl(story.screenshotId);
        }

        return {
          ...bookmark,
          storyTitle: story?.title,
          storySlug: story?.slug,
          storyDescription: story?.description,
          storyAuthorName: authorName, // Use fetched author name
          storyAuthorUsername: authorUsername, // Use fetched author username
          storyScreenshotUrl: storyScreenshotUrl, // Use fetched screenshot URL
        };
      })
    );
    // Filter out any nulls that resulted from a story not being found
    return bookmarksWithDetails.filter((b) => b !== null && b.storyTitle) as Array<
      Doc<"bookmarks"> & { storyTitle: string; storySlug: string /* other fields */ }
    >;
  },
});

// Helper function for authentication (assuming it's in ./utils.ts)
// If not, you might need to define it or adjust the import.
// Example of what requireAuth might look like in ./utils.ts:
/*
import { QueryCtx, MutationCtx } from "./_generated/server";

export const requireAuth = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    // throw new Error("User not authenticated."); // Or handle as appropriate for queries
    return { user: null, identity: null }; 
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  
  if (!user) {
    // throw new Error("User not found in DB."); // Or handle
     return { user: null, identity };
  }
  return { user, identity };
};
*/
