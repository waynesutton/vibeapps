import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";
import type { StoryWithDetails } from "./stories"; // Import StoryWithDetails type
import { storyWithDetailsValidator } from "./validators"; // Updated import path

/**
 * Ensures a user record exists in the Convex database for the authenticated user.
 * If the user doesn't exist, it creates a new user record.
 *
 * This mutation should be called from the frontend after a successful
 * sign-in or sign-up with Clerk.
 */
export const ensureUser = mutation({
  args: {}, // No args needed, gets info from Clerk identity
  returns: v.id("users"), // Returns the Convex user ID
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called ensureUser without authentication");
    }

    // Check if user already exists by their Clerk ID (identity.subject)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    // Safely access publicMetadata and roles
    const publicMetadata = identity.publicMetadata as { roles?: string[] } | undefined;
    const clerkRoles = publicMetadata?.roles ?? [];

    // Ensure clerkEmail is string or undefined for schema compatibility
    let clerkEmail: string | undefined = undefined;
    if (typeof identity.emailAddress === "string") {
      clerkEmail = identity.emailAddress;
    }

    if (existingUser) {
      // Optional: Update user data if needed (e.g., name change from Clerk)
      let nameToStore = existingUser.name;
      if (identity.givenName && identity.familyName) {
        nameToStore = `${identity.givenName} ${identity.familyName}`;
      } else if (identity.name) {
        nameToStore = identity.name;
      } else if (identity.nickname) {
        nameToStore = identity.nickname;
      }

      let changed = false;
      const updates: Partial<Doc<"users">> = {};
      if (nameToStore !== existingUser.name) {
        updates.name = nameToStore;
        changed = true;
      }
      if (clerkEmail !== existingUser.email) {
        updates.email = clerkEmail;
        changed = true;
      }
      if (JSON.stringify(clerkRoles) !== JSON.stringify(existingUser.roles)) {
        updates.roles = clerkRoles;
        changed = true;
      }
      if (changed) {
        await ctx.db.patch(existingUser._id, updates);
      }
      return existingUser._id;
    }

    // Create new user if they don't exist
    let nameToStoreOnInsert = "Anonymous";
    if (identity.givenName && identity.familyName) {
      nameToStoreOnInsert = `${identity.givenName} ${identity.familyName}`;
    } else if (identity.name) {
      nameToStoreOnInsert = identity.name;
    } else if (identity.nickname) {
      nameToStoreOnInsert = identity.nickname;
    }

    const userId = await ctx.db.insert("users", {
      name: nameToStoreOnInsert, // ensure correct name var is used
      clerkId: identity.subject,
      roles: clerkRoles,
      email: clerkEmail, // Use the validated clerkEmail for insert
    });

    return userId;
  },
});

/**
 * Retrieves the Convex user ID of the currently authenticated user.
 * Throws an error if the user is not authenticated or not found in the database.
 * (Assumes ensureUser has been called previously to sync the user).
 */
export async function getAuthenticatedUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("User not authenticated.");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    // This should ideally not happen if ensureUser is called on login
    throw new Error("Authenticated user not found in Convex database. User sync issue?");
  }
  return user._id;
}

/**
 * Retrieves the full user document of the currently authenticated user.
 * Returns null if the user is not authenticated or not found.
 */
export async function getAuthenticatedUserDoc(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

// Query to get user roles (example from clerksetup.md)
// This might be useful for frontend checks if not directly using Clerk's useUser().has()
export const getUserRoles = query({
  args: {},
  returns: v.union(v.null(), v.object({ roles: v.array(v.string()) })),
  handler: async (ctx) => {
    const user = await getAuthenticatedUserDoc(ctx);
    return user ? { roles: user.roles ?? [] } : null;
  },
});

/**
 * Ensures the currently authenticated user has the 'admin' role.
 * Throws an error if not authenticated, user not found, or not an admin.
 * This should be called at the beginning of admin-only mutations/actions.
 */
export async function requireAdminRole(ctx: QueryCtx | MutationCtx): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required for admin action.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("Authenticated user not found in database. Admin check failed.");
  }

  // Safely access publicMetadata and roles from Clerk token as fallback
  const publicMetadata = identity.publicMetadata as { roles?: string[] } | undefined;
  const clerkTokenRoles = publicMetadata?.roles ?? [];

  if (!(user.roles && user.roles.includes("admin")) && !clerkTokenRoles.includes("admin")) {
    throw new Error("Admin privileges required for this action.");
  }
  // If roles in DB don't match Clerk token and Clerk token has admin, consider patching DB.
  // This logic can be refined based on source of truth for roles.
  if (!user.roles?.includes("admin") && clerkTokenRoles.includes("admin") && user._id) {
    if (JSON.stringify(user.roles) !== JSON.stringify(clerkTokenRoles)) {
      // console.log(`Updating roles for user ${user._id} from Clerk token.`);
      // await ctx.db.patch(user._id, { roles: clerkTokenRoles }); // Disabled for now to avoid mutation in query context if called from query
    }
  }
}

// --- Queries for User Profile Page ---

/**
 * Lists stories submitted by a specific user.
 */
export const listUserStories = query({
  args: { userId: v.id("users") },
  returns: v.array(storyWithDetailsValidator),
  handler: async (ctx, args): Promise<StoryWithDetails[]> => {
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const detailedStories: StoryWithDetails[] = [];
    for (const story of stories) {
      if (story.slug) {
        const detail: StoryWithDetails | null = await ctx.runQuery(api.stories.getBySlug, {
          slug: story.slug,
        });
        if (detail) {
          detailedStories.push(detail);
        }
      }
    }
    return detailedStories;
  },
});

/**
 * Lists votes cast by a specific user, optionally joining with story details.
 */
export const listUserVotes = query({
  args: { userId: v.id("users") },
  // Returns vote record and potentially story title/slug for context
  returns: v.array(
    v.object({
      _id: v.id("votes"),
      _creationTime: v.number(),
      userId: v.id("users"),
      storyId: v.id("stories"),
      storyTitle: v.optional(v.string()),
      storySlug: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_user_story", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Enhance with story details
    const votesWithStoryDetails = await Promise.all(
      votes.map(async (vote) => {
        const story = await ctx.db.get(vote.storyId);
        return {
          ...vote,
          storyTitle: story?.title,
          storySlug: story?.slug,
        };
      })
    );
    return votesWithStoryDetails;
  },
});

/**
 * Lists comments made by a specific user, optionally joining with story details.
 */
export const listUserComments = query({
  args: { userId: v.id("users") },
  // Returns comment and potentially story title/slug for context
  returns: v.array(
    v.object({
      _id: v.id("comments"),
      _creationTime: v.number(),
      content: v.string(),
      userId: v.id("users"),
      storyId: v.id("stories"),
      parentId: v.optional(v.id("comments")),
      status: v.string(), // Assuming status is always present
      storyTitle: v.optional(v.string()),
      storySlug: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      //.filter((q) => q.eq(q.field("status"), "approved")) // Optionally filter by status
      .order("desc")
      .collect();

    const commentsWithStoryDetails = await Promise.all(
      comments.map(async (comment) => {
        const story = await ctx.db.get(comment.storyId);
        return {
          ...comment,
          storyTitle: story?.title,
          storySlug: story?.slug,
        };
      })
    );
    return commentsWithStoryDetails;
  },
});
