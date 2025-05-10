import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { api, internal } from "./_generated/api"; // Ensured internal is imported if needed by other funcs
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

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const publicMetadata = identity.publicMetadata as { roles?: string[] } | undefined;
    const clerkRoles = publicMetadata?.roles ?? [];

    let clerkEmail: string | undefined = undefined;
    if (typeof identity.emailAddress === "string") {
      clerkEmail = identity.emailAddress;
    }

    let candidateUsername: string | null = null;
    if (typeof identity.username === "string" && identity.username.trim() !== "") {
      candidateUsername = identity.username.trim();
    }

    if (existingUser) {
      let nameToStore = existingUser.name;
      if (identity.givenName && identity.familyName) {
        nameToStore = `${identity.givenName} ${identity.familyName}`;
      } else if (identity.name) {
        nameToStore = identity.name;
      } else if (identity.nickname) {
        nameToStore = identity.nickname;
      }

      const updates: Partial<Doc<"users">> = {};
      let changed = false;

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

      // Handle username update for existing user
      if (existingUser.username === null && candidateUsername !== null) {
        const conflictingUser = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", candidateUsername!))
          .filter((q) => q.neq(q.field("_id"), existingUser._id))
          .first();
        if (!conflictingUser) {
          updates.username = candidateUsername;
          changed = true;
        } else {
          console.warn(
            `Clerk username '${candidateUsername}' is already taken. User ${existingUser._id} will need to set username manually.`
          );
        }
      } else if (
        candidateUsername &&
        candidateUsername !== existingUser.username &&
        existingUser.username !== null
      ) {
        console.warn(
          `User ${existingUser._id} username ('${existingUser.username}') differs from Clerk username ('${candidateUsername}'). Not updating automatically.`
        );
      }
      // No change to username if existingUser.username is not null and candidateUsername is null
      // or if candidateUsername is same as existingUser.username

      if (changed) {
        await ctx.db.patch(existingUser._id, updates);
      }
      return existingUser._id;
    }

    // New user insertion
    let nameToStoreOnInsert = "Anonymous";
    if (identity.givenName && identity.familyName) {
      nameToStoreOnInsert = `${identity.givenName} ${identity.familyName}`;
    } else if (identity.name) {
      nameToStoreOnInsert = identity.name;
    } else if (identity.nickname) {
      nameToStoreOnInsert = identity.nickname;
    }

    let usernameForDbInsert: string | undefined = undefined;
    if (candidateUsername !== null) {
      const conflictingUser = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", candidateUsername!))
        .first();
      if (!conflictingUser) {
        usernameForDbInsert = candidateUsername;
      } else {
        console.warn(
          `Clerk username '${candidateUsername}' is already taken for new user. New user will need to set username manually.`
        );
      }
    }

    const userId = await ctx.db.insert("users", {
      name: nameToStoreOnInsert,
      clerkId: identity.subject,
      roles: clerkRoles,
      email: clerkEmail,
      username: usernameForDbInsert,
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

// After getAuthenticatedUserDoc and before getUserRoles or at the end of user-related queries

const userDocValidator = v.object({
  // Re-using/defining for clarity, ensure it matches Doc<"users">
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  clerkId: v.string(),
  roles: v.optional(v.array(v.string())),
  email: v.optional(v.string()),
  username: v.optional(v.string()),
});

/**
 * Query to get the currently authenticated user's full document from Convex.
 */
export const getMyUserDocument = query({
  args: {},
  returns: v.union(v.null(), userDocValidator),
  handler: async (ctx) => {
    return await getAuthenticatedUserDoc(ctx);
  },
});

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
    // Step 1: Fetch basic story documents for the user
    const basicStories = await ctx.db
      .query("stories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    if (basicStories.length === 0) {
      return [];
    }

    // Step 2: Get all story IDs
    const storyIds = basicStories.map((story) => story._id);

    // Step 3: Call the internal batch query to get full details
    const detailedStories = await ctx.runQuery(internal.stories._getStoryDetailsBatch, {
      storyIds,
    });

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

// Define the expected shape for the user object within the profile data
const userInProfileValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  clerkId: v.string(),
  roles: v.optional(v.array(v.string())),
  email: v.optional(v.string()),
  username: v.optional(v.string()),
});

// Define the expected shape for a single vote item with story details
const voteWithStoryDetailsValidator = v.object({
  _id: v.id("votes"),
  _creationTime: v.number(),
  userId: v.id("users"),
  storyId: v.id("stories"),
  storyTitle: v.optional(v.string()),
  storySlug: v.optional(v.string()),
});

// Validator for comments returned by listUserComments AND used in getUserProfileByUsername
const commentDetailsForProfileValidator = v.object({
  _id: v.id("comments"),
  _creationTime: v.number(),
  content: v.string(),
  userId: v.id("users"), // User who wrote the comment
  storyId: v.id("stories"),
  parentId: v.optional(v.id("comments")),
  status: v.string(),
  votes: v.number(), // Votes on the comment itself
  storyTitle: v.optional(v.string()), // Title of the story commented on
  storySlug: v.optional(v.string()), // Slug of the story commented on
  authorName: v.optional(v.string()), // Name of the comment author
  authorUsername: v.optional(v.string()), // Username of the comment author
});

// Define the expected shape for a single rating item with story details
const ratingWithStoryDetailsValidator = v.object({
  _id: v.id("storyRatings"),
  _creationTime: v.number(),
  userId: v.id("users"),
  storyId: v.id("stories"),
  value: v.number(),
  storyTitle: v.optional(v.string()),
  storySlug: v.optional(v.string()),
});

// TypeScript type for the object returned by listUserComments handler
type CommentDetailsForProfile = Doc<"comments"> & {
  storyTitle?: string;
  storySlug?: string;
  authorName?: string;
  authorUsername?: string;
  // votes: number; // This is already part of Doc<"comments"> schema
};

// Type for the entire profile data structure
type UserProfileData = {
  user: Doc<"users">;
  stories: StoryWithDetails[];
  votes: {
    _id: Id<"votes">;
    _creationTime: number;
    userId: Id<"users">;
    storyId: Id<"stories">;
    storyTitle?: string;
    storySlug?: string;
  }[];
  comments: CommentDetailsForProfile[]; // Use the specific type here
  ratings: {
    _id: Id<"storyRatings">;
    _creationTime: number;
    userId: Id<"users">;
    storyId: Id<"stories">;
    value: number;
    storyTitle?: string;
    storySlug?: string;
  }[];
} | null;

// Query to list comments by a user, with author and story details for profile display
export const listUserComments = query({
  args: { userId: v.id("users") },
  returns: v.array(commentDetailsForProfileValidator), // Use the specific validator
  handler: async (ctx, args): Promise<CommentDetailsForProfile[]> => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const commentsWithDetails = await Promise.all(
      comments.map(async (comment) => {
        const story = await ctx.db.get(comment.storyId);
        // The author of the comment is the user whose profile we are fetching (args.userId)
        // So, we fetch *this* user's details if needed for authorName/Username consistency,
        // though `comment.userId` should already be `args.userId`.
        const author = await ctx.db.get(comment.userId);
        return {
          ...comment,
          storyTitle: story?.title,
          storySlug: story?.slug,
          authorName: author?.name, // Name of the comment's author
          authorUsername: author?.username, // Username of the comment's author
        } as CommentDetailsForProfile; // Assert to the specific type
      })
    );
    return commentsWithDetails;
  },
});

export const getUserProfileByUsername = query({
  args: { username: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      user: userInProfileValidator,
      stories: v.array(storyWithDetailsValidator),
      votes: v.array(voteWithStoryDetailsValidator),
      comments: v.array(commentDetailsForProfileValidator), // Use the specific validator
      ratings: v.array(ratingWithStoryDetailsValidator),
    })
  ),
  handler: async (ctx, args): Promise<UserProfileData> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();

    if (!user) {
      return null;
    }

    const stories: StoryWithDetails[] = await ctx.runQuery(api.users.listUserStories, {
      userId: user._id,
    });
    const votes = await ctx.runQuery(api.users.listUserVotes, { userId: user._id });
    const comments: CommentDetailsForProfile[] = await ctx.runQuery(api.users.listUserComments, {
      userId: user._id,
    });
    const ratings = await ctx.runQuery(api.users.listUserStoryRatings, { userId: user._id });

    return {
      user,
      stories,
      votes,
      comments,
      ratings,
    };
  },
});

// Query to list story ratings by a user (needed for getUserProfileByUsername)
export const listUserStoryRatings = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("storyRatings"),
      _creationTime: v.number(),
      userId: v.id("users"),
      storyId: v.id("stories"),
      value: v.number(),
      storyTitle: v.optional(v.string()),
      storySlug: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const ratings = await ctx.db
      .query("storyRatings")
      .withIndex("by_user_story", (q) => q.eq("userId", args.userId)) // Assumes storyRatings has by_user_story index
      .order("desc")
      .collect();

    const ratingsWithDetails = await Promise.all(
      ratings.map(async (rating) => {
        const story = await ctx.db.get(rating.storyId);
        return {
          ...rating,
          storyTitle: story?.title,
          storySlug: story?.slug,
        };
      })
    );
    return ratingsWithDetails;
  },
});

export const setUsername = mutation({
  args: { newUsername: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx); // Ensures user is authenticated
    const existingUserDoc = await getAuthenticatedUserDoc(ctx);

    if (!existingUserDoc) {
      throw new Error("Authenticated user not found in DB. Cannot set username.");
    }

    // Basic validation for username (e.g., length, allowed characters)
    const trimmedUsername = args.newUsername.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      throw new Error("Username must be between 3 and 20 characters.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      throw new Error("Username can only contain letters, numbers, and underscores.");
    }

    // Check for uniqueness
    const conflictingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", trimmedUsername))
      .filter((q) => q.neq(q.field("_id"), userId)) // Exclude current user from conflict check
      .first();

    if (conflictingUser) {
      throw new Error(`Username "${trimmedUsername}" is already taken. Please choose another.`);
    }

    // Update the user's username
    await ctx.db.patch(userId, { username: trimmedUsername });

    return { success: true, username: trimmedUsername };
  },
});
