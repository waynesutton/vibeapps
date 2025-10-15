import {
  mutation,
  query,
  QueryCtx,
  MutationCtx,
  internalMutation,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { api, internal } from "./_generated/api"; // Ensured internal is imported if needed by other funcs
import {
  storyWithDetailsValidator,
  StoryWithDetailsPublic,
  userInProfileValidator,
  voteWithStoryDetailsValidator,
  commentDetailsForProfileValidator,
  ratingWithStoryDetailsValidator,
} from "./validators"; // Updated import path
import { paginationOptsValidator } from "convex/server"; // Added import

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

    // Role is no longer synced from Clerk to Convex user document here
    // const publicMetadata = identity.publicMetadata as { role?: string } | undefined;
    // const clerkRole = publicMetadata?.role;

    // Debug: Log the entire identity object to see available fields (remove this after debugging)
    // console.log("DEBUG: Full identity object:", JSON.stringify(identity, null, 2));
    // console.log("DEBUG: Available identity keys:", Object.keys(identity));

    let clerkEmail: string | undefined = undefined;

    // Try multiple possible email field names (identity.email is the correct one based on debug logs)
    if (typeof identity.email === "string") {
      clerkEmail = identity.email;
      // console.log("DEBUG: Got email from identity.email:", clerkEmail);
    } else if (typeof identity.emailAddress === "string") {
      clerkEmail = identity.emailAddress;
      // console.log("DEBUG: Got email from identity.emailAddress:", clerkEmail);
    } else if (
      typeof (identity as any).primaryEmailAddress?.emailAddress === "string"
    ) {
      clerkEmail = (identity as any).primaryEmailAddress.emailAddress;
      // console.log("DEBUG: Got email from identity.primaryEmailAddress.emailAddress:", clerkEmail);
    } else {
      console.log("DEBUG: No email found in identity object");
      console.log("DEBUG: Available identity fields:", Object.keys(identity));
    }

    let candidateUsername: string | null = null;
    if (
      typeof identity.username === "string" &&
      identity.username.trim() !== ""
    ) {
      candidateUsername = identity.username.trim();
    }

    let clerkImageUrl: string | undefined = undefined;
    if (typeof identity.imageUrl === "string") {
      clerkImageUrl = identity.imageUrl || undefined; // Ensure empty string becomes undefined if desired, or just identity.imageUrl
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
      if (clerkImageUrl && clerkImageUrl !== existingUser.imageUrl) {
        updates.imageUrl = clerkImageUrl;
        changed = true;
      }
      // Removed role update: Convex user document will no longer store the role from Clerk
      // if (clerkRole !== existingUser.role) {
      //   updates.role = clerkRole;
      //   changed = true;
      // }

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
            `Clerk username '${candidateUsername}' is already taken. User ${existingUser._id} will need to set username manually.`,
          );
        }
      } else if (
        candidateUsername &&
        candidateUsername !== existingUser.username &&
        existingUser.username !== null
      ) {
        console.warn(
          `User ${existingUser._id} username ('${existingUser.username}') differs from Clerk username ('${candidateUsername}'). Not updating automatically.`,
        );
      }
      // No change to username if existingUser.username is not null and candidateUsername is null
      // or if candidateUsername is same as existingUser.username

      // Always check and update email if it's missing or different
      if (clerkEmail && clerkEmail !== existingUser.email) {
        updates.email = clerkEmail;
        changed = true;
        console.log(
          `Updating email for existing user ${existingUser.name}: ${clerkEmail}`,
        );
      }

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
          `Clerk username '${candidateUsername}' is already taken for new user. New user will need to set username manually.`,
        );
      }
    }

    const userId = await ctx.db.insert("users", {
      name: nameToStoreOnInsert,
      clerkId: identity.subject,
      // role: clerkRole, // Role is no longer stored on the Convex user document
      email: clerkEmail,
      username: usernameForDbInsert,
      imageUrl: clerkImageUrl,
    });

    // Schedule welcome email for new user
    if (clerkEmail) {
      await ctx.scheduler.runAfter(
        5000, // 5 second delay to ensure user setup is complete
        internal.emails.welcome.sendWelcomeEmail,
        { userId },
      );
    }

    return userId;
  },
});

/**
 * Retrieves the Convex user ID of the currently authenticated user.
 * Throws an error if the user is not authenticated or not found in the database.
 * (Assumes ensureUser has been called previously to sync the user).
 */
export async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
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
    throw new Error(
      "Authenticated user not found in Convex database. User sync issue?",
    );
  }
  return user._id;
}

/**
 * Retrieves the full user document of the currently authenticated user.
 * Returns null if the user is not authenticated or not found.
 */
export async function getAuthenticatedUserDoc(
  ctx: QueryCtx | MutationCtx,
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

/**
 * Helper function to check if the authenticated user is banned.
 * Throws an error if the user is banned.
 * Should be called at the beginning of mutations that create content.
 */
export async function ensureUserNotBanned(ctx: MutationCtx): Promise<void> {
  const user = await getAuthenticatedUserDoc(ctx);
  if (user && user.isBanned === true) {
    throw new Error("User is banned and cannot perform this action.");
  }
  // If user is null (not authenticated), other auth checks should handle it.
  // If isBanned is false or undefined, the user is not banned.
}

// After getAuthenticatedUserDoc and before getUserRole or at the end of user-related queries

const userDocValidator = v.object({
  // Re-using/defining for clarity, ensure it matches Doc<"users">
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  clerkId: v.string(),
  // role: v.optional(v.string()), // Role is no longer on the user document in Convex DB
  email: v.optional(v.string()),
  username: v.optional(v.string()),
});

/**
 * Query to get the currently authenticated user's full document from Convex.
 */
export const getMyUserDocument = query({
  args: {},
  // returns: v.union(v.null(), userDocValidator), // Assuming userDocValidator is defined elsewhere or use v.any() / specific object if not
  returns: v.union(
    v.null(),
    v.object({
      /* define user fields here */ _id: v.id("users"),
      _creationTime: v.number(),
      clerkId: v.string(),
      email: v.optional(v.string()),
      name: v.string(),
      username: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      role: v.optional(v.string()),
      bio: v.optional(v.string()),
      website: v.optional(v.string()),
      twitter: v.optional(v.string()),
      bluesky: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      isVerified: v.optional(v.boolean()),
      inboxEnabled: v.optional(v.boolean()),
      // add other fields from your users table if any
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject)) // Ensured correct index name
      .unique();
    return user;
  },
});

// Query to get user role - THIS QUERY IS NO LONGER VALID AS ROLE IS NOT ON CONVEX USER DOC
// Frontend should get role directly from Clerk's useUser().user.publicMetadata.role
// export const getUserRole = query({
//   args: {},
//   returns: v.union(v.null(), v.object({ role: v.optional(v.string()) })),
//   handler: async (ctx) => {
//     const user = await getAuthenticatedUserDoc(ctx);
//     return user ? { role: user.role } : null; // user.role no longer exists
//   },
// });

/**
 * Helper function to check if the current user is an admin.
 * Returns true if user is admin, false otherwise.
 * Does not throw errors - use for conditional access checks.
 */
export async function isUserAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    // Access role directly from the identity object
    const clerkTokenRole = (identity as any).role;
    return clerkTokenRole === "admin";
  } catch (error) {
    return false;
  }
}

/**
 * Query to check if the current user is an admin (for frontend use).
 */
export const checkIsUserAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    return await isUserAdmin(ctx);
  },
});

/**
 * Ensures the currently authenticated user has the 'admin' role.
 * Throws an error if not authenticated, user not found, or not an admin.
 * This should be called at the beginning of admin-only mutations/actions.
 */
export async function requireAdminRole(
  ctx: QueryCtx | MutationCtx,
): Promise<void> {
  console.log("[requireAdminRole] Function called.");
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    console.error(
      "[requireAdminRole] No identity found. User not authenticated.",
    );
    throw new Error("Authentication required for admin action.");
  }

  console.log(
    "[requireAdminRole] Identity subject (Clerk User ID):",
    identity.subject,
  );
  // Log the entire identity object to see all available fields including the top-level role
  console.log(
    "[requireAdminRole] Full identity object (includes top-level claims):",
    JSON.stringify(identity, null, 2),
  );

  // Access role directly from the identity object
  // The JWT template "role": "{{user.public_metadata.role}}" maps it to the top level
  const clerkTokenRole = (identity as any).role;

  console.log(
    "[requireAdminRole] Role directly from identity object:",
    clerkTokenRole,
  );

  // The old way of checking publicMetadata is no longer applicable with this JWT template
  // const rawPublicMetadata = identity.publicMetadata;
  // if (rawPublicMetadata && typeof rawPublicMetadata === 'object') {
  //   console.log("[requireAdminRole] rawPublicMetadata (should be empty or not contain role):", JSON.stringify(rawPublicMetadata, null, 2));
  //   // clerkTokenRole was previously attempted to be read from here
  // } else {
  //   console.log("[requireAdminRole] rawPublicMetadata is null, undefined, or not an object.");
  // }

  console.log(
    "[requireAdminRole] Final determined clerkTokenRole before check:",
    JSON.stringify(clerkTokenRole),
  );

  if (clerkTokenRole === "admin") {
    console.log(
      "[requireAdminRole] 'admin' role FOUND in Clerk token (top-level). Access GRANTED.",
    );
    return;
  }

  console.error(
    "[requireAdminRole] 'admin' role NOT FOUND in Clerk token (top-level). Access DENIED. Current role value in token:",
    clerkTokenRole,
  );
  throw new Error(
    "Admin privileges required. Role 'admin' not found in Clerk token.",
  );
}

// --- Queries for User Profile Page ---

/**
 * Lists stories submitted by a specific user.
 */
export const listUserStories = query({
  args: { userId: v.id("users") },
  returns: v.array(storyWithDetailsValidator), // Use the validator for Convex
  handler: async (ctx, args): Promise<StoryWithDetailsPublic[]> => {
    // Return the TypeScript type
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

    // Step 3: Call the internal batch query to get full details, including author info
    const detailedStories: StoryWithDetailsPublic[] = await ctx.runQuery(
      internal.stories._getStoryDetailsBatch,
      {
        storyIds,
      },
    );

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
    }),
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
      }),
    );
    return votesWithStoryDetails;
  },
});

// TypeScript type for the object returned by listUserComments handler
type CommentDetailsForProfile = Doc<"comments"> & {
  storyTitle?: string;
  storySlug?: string;
  authorName?: string;
  authorUsername?: string;
  isHidden: boolean; // Make isHidden non-optional
  // votes: number; // This is already part of Doc<"comments"> schema
};

// Type for the entire profile data structure (non-null part)
// This defines the actual shape the handler must return when successful.
// It uses the specific types for nested structures like StoryWithDetails, CommentDetailsForProfile etc.
type UserProfileDataResolved = {
  user: Doc<"users">;
  stories: StoryWithDetailsPublic[]; // Changed from StoryWithDetails[] to StoryWithDetailsPublic[]
  votes: Array<{
    _id: Id<"votes">;
    _creationTime: number;
    userId: Id<"users">;
    storyId: Id<"stories">;
    storyTitle?: string;
    storySlug?: string;
  }>; // This should align with voteWithStoryDetailsValidator after mapping
  comments: CommentDetailsForProfile[]; // This should align with commentDetailsForProfileValidator
  ratings: Array<{
    _id: Id<"storyRatings">;
    _creationTime: number;
    userId: Id<"users">;
    storyId: Id<"stories">;
    value: number;
    storyTitle?: string;
    storySlug?: string;
  }>; // This should align with ratingWithStoryDetailsValidator after mapping
  followersCount: number;
  followingCount: number;
  isFollowedByCurrentUser: boolean;
};

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
          isHidden: comment.isHidden === undefined ? false : comment.isHidden, // Ensure isHidden is a boolean
        } as CommentDetailsForProfile; // Assert to the specific type
      }),
    );
    return commentsWithDetails;
  },
});

// Basic getUserByCtx for follows.ts, similar to getAuthenticatedUserDoc
export async function getUserByCtx(
  ctx: QueryCtx | MutationCtx,
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

export const getUserProfileByUsername = query({
  args: { username: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      user: userInProfileValidator,
      stories: v.array(storyWithDetailsValidator),
      votes: v.array(voteWithStoryDetailsValidator),
      comments: v.array(commentDetailsForProfileValidator),
      ratings: v.array(ratingWithStoryDetailsValidator),
      followersCount: v.number(),
      followingCount: v.number(),
      isFollowedByCurrentUser: v.boolean(),
    }),
  ),
  handler: async (ctx, args): Promise<UserProfileDataResolved | null> => {
    const userDoc: Doc<"users"> | null = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();

    if (!userDoc) {
      return null;
    }

    // Explicitly shape the user object to match userInProfileValidator
    const userForProfile = {
      _id: userDoc._id,
      _creationTime: userDoc._creationTime,
      name: userDoc.name,
      clerkId: userDoc.clerkId,
      email: userDoc.email, // Will be undefined if not set, validator handles optional
      username: userDoc.username,
      imageUrl: userDoc.imageUrl,
      bio: userDoc.bio,
      website: userDoc.website,
      twitter: userDoc.twitter,
      bluesky: userDoc.bluesky,
      linkedin: userDoc.linkedin,
      isVerified: userDoc.isVerified ?? false, // Include isVerified field
    };

    const storiesFromDb = await ctx.db
      .query("stories")
      .withIndex("by_userId_isApproved", (q) =>
        q.eq("userId", userDoc._id).eq("isApproved", true),
      )
      .order("desc")
      .take(100);

    const storyDetailsPromises = storiesFromDb.map(
      async (storyDoc: Doc<"stories">) => {
        const author: Doc<"users"> | null = storyDoc.userId
          ? await ctx.db.get(storyDoc.userId)
          : null;
        const votesData = await ctx.db
          .query("votes")
          .withIndex("by_story", (q) => q.eq("storyId", storyDoc._id))
          .collect();
        const commentsData = await ctx.db
          .query("comments")
          .withIndex("by_storyId", (q) => q.eq("storyId", storyDoc._id))
          .filter((q) => q.eq(q.field("isHidden"), false))
          .collect();
        const ratingsData = await ctx.db
          .query("storyRatings")
          .withIndex("by_storyId", (q) => q.eq("storyId", storyDoc._id))
          .collect();

        const averageRating =
          ratingsData.length > 0
            ? parseFloat(
                (
                  ratingsData.reduce((sum, r) => sum + r.value, 0) /
                  ratingsData.length
                ).toFixed(1),
              )
            : 0;
        const commentsCount = commentsData.length;
        const votesCount = votesData.length;

        const screenshotUrl = storyDoc.screenshotId
          ? await ctx.storage.getUrl(storyDoc.screenshotId)
          : null;

        // Resolve additional image URLs
        const additionalImageUrls = storyDoc.additionalImageIds
          ? await Promise.all(
              storyDoc.additionalImageIds.map(async (imageId) => {
                const url = await ctx.storage.getUrl(imageId);
                return url || "";
              }),
            ).then((urls) => urls.filter((url) => url !== ""))
          : [];

        const tagsDocsIntermediate = storyDoc.tagIds
          ? await Promise.all(storyDoc.tagIds.map((id) => ctx.db.get(id)))
          : [];

        const validTags = tagsDocsIntermediate.reduce(
          (acc, tag) => {
            if (tag && typeof tag.slug === "string") {
              // Explicitly construct the tag object to match tagDocValidator's expectation
              acc.push({
                _id: tag._id,
                _creationTime: tag._creationTime,
                name: tag.name,
                slug: tag.slug, // Now definitely a string
                showInHeader: tag.showInHeader,
                isHidden: tag.isHidden,
                backgroundColor: tag.backgroundColor,
                textColor: tag.textColor,
                // Add any other fields expected by tagDocValidator, ensuring types match
              });
            }
            return acc;
          },
          [] as {
            _id: Id<"tags">;
            _creationTime: number;
            name: string;
            slug: string;
            showInHeader: boolean;
            isHidden?: boolean;
            backgroundColor?: string;
            textColor?: string;
          }[],
        );

        // Constructing the object for StoryWithDetailsPublic
        return {
          ...storyDoc, // Base story fields
          authorName: author?.name,
          authorUsername: author?.username,
          authorImageUrl: author?.imageUrl,
          authorIsVerified: author?.isVerified ?? false, // Add verified status for author
          tags: validTags, // Use the explicitly constructed validTags
          screenshotUrl: screenshotUrl,
          additionalImageUrls: additionalImageUrls,
          voteScore: storyDoc.votes, // Assuming storyDoc.votes is the voteScore
          averageRating: averageRating,
          commentsCount: commentsCount,
          votesCount: votesCount,
          // _score is optional, so can be omitted if not applicable here
        };
      },
    );

    const storiesWithDetails: StoryWithDetailsPublic[] =
      await Promise.all(storyDetailsPromises);

    const userVotes = await ctx.db
      .query("votes")
      .withIndex("by_userId", (q) => q.eq("userId", userDoc._id))
      .order("desc")
      .collect();

    const votesWithStoryDetails = await Promise.all(
      userVotes.map(async (vote) => {
        const story = await ctx.db.get(vote.storyId);
        return {
          ...vote,
          storyTitle: story?.title,
          storySlug: story?.slug,
        };
      }),
    );

    const userComments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", userDoc._id))
      .order("desc")
      .collect();

    const commentsWithDetailsPromises = userComments.map(async (comment) => {
      const story = await ctx.db.get(comment.storyId);
      const author: Doc<"users"> | null = await ctx.db.get(comment.userId);
      return {
        ...comment,
        storyTitle: story?.title,
        storySlug: story?.slug,
        authorName: author?.name,
        authorUsername: author?.username,
        isHidden: comment.isHidden ?? false,
      };
    });
    const commentsWithDetails: CommentDetailsForProfile[] = await Promise.all(
      commentsWithDetailsPromises,
    );

    const userRatings = await ctx.db
      .query("storyRatings")
      .withIndex("by_userId", (q) => q.eq("userId", userDoc._id))
      .order("desc")
      .collect();

    const ratingsWithStoryDetails = await Promise.all(
      userRatings.map(async (rating) => {
        const story = await ctx.db.get(rating.storyId);
        return {
          ...rating,
          storyTitle: story?.title,
          storySlug: story?.slug,
        };
      }),
    );

    const followStats: { followersCount: number; followingCount: number } =
      await ctx.runQuery(api.follows.getFollowStats, { userId: userDoc._id });
    const isFollowedByCurrentUser: boolean = await ctx.runQuery(
      api.follows.isFollowing,
      {
        profileUserId: userDoc._id,
      },
    );

    return {
      user: userForProfile, // Use the shaped user object
      stories: storiesWithDetails,
      votes: votesWithStoryDetails,
      comments: commentsWithDetails,
      ratings: ratingsWithStoryDetails,
      followersCount: followStats.followersCount,
      followingCount: followStats.followingCount,
      isFollowedByCurrentUser,
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
    }),
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
      }),
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
      throw new Error(
        "Authenticated user not found in DB. Cannot set username.",
      );
    }

    // Basic validation for username (e.g., length, allowed characters)
    const trimmedUsername = args.newUsername.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      throw new Error("Username must be between 3 and 20 characters.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      throw new Error(
        "Username can only contain letters, numbers, and underscores.",
      );
    }

    // Check for uniqueness
    const conflictingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", trimmedUsername))
      .filter((q) => q.neq(q.field("_id"), userId)) // Exclude current user from conflict check
      .first();

    if (conflictingUser) {
      throw new Error(
        `Username "${trimmedUsername}" is already taken. Please choose another.`,
      );
    }

    // Update the user's username
    await ctx.db.patch(userId, { username: trimmedUsername });

    return { success: true, username: trimmedUsername };
  },
});

export const syncUserFromClerkWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    publicMetadata: v.optional(v.any()), // Or a more specific v.object if you know the structure
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    let nameToStore = "Anonymous";
    if (args.firstName && args.lastName) {
      nameToStore = `${args.firstName} ${args.lastName}`;
    } else if (args.firstName) {
      nameToStore = args.firstName;
    } else if (args.lastName) {
      nameToStore = args.lastName; // Or consider just one name if only one is present
    }
    // No explicit fallback to nickname from webhook data, as it's not directly available in the root of user object

    const userRole = args.publicMetadata?.role as string | undefined;

    if (existingUser) {
      // User exists, update them
      const updates: Partial<Doc<"users">> = {};
      let changed = false;

      if (nameToStore !== existingUser.name) {
        updates.name = nameToStore;
        changed = true;
      }
      if (args.email && args.email !== existingUser.email) {
        updates.email = args.email;
        changed = true;
      }
      // Handle imageUrl: if it's null from webhook, store as undefined
      const webhookImageUrl =
        args.imageUrl === null ? undefined : args.imageUrl;
      if (
        webhookImageUrl !== undefined &&
        webhookImageUrl !== existingUser.imageUrl
      ) {
        updates.imageUrl = webhookImageUrl;
        changed = true;
      }

      // Sync the role if your users table has a 'role' field
      // Note: This requires 'role: v.optional(v.string())' in your convex/schema.ts for the 'users' table
      if (userRole !== (existingUser as any).role) {
        // Cast to any if role isn't strictly on Doc<"users">
        updates.role = userRole; // Store the role from publicMetadata
        changed = true;
      }

      if (changed) {
        await ctx.db.patch(existingUser._id, updates);
        console.log(`Webhook: Patched user ${args.clerkId}`);
      } else {
        console.log(`Webhook: No changes for user ${args.clerkId}`);
      }
      return existingUser._id;
    } else {
      // New user, insert them
      console.log(`Webhook: Creating new user ${args.clerkId}`);
      const newUserId = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        name: nameToStore,
        email: args.email, // This might be undefined if not found
        imageUrl: args.imageUrl === null ? undefined : args.imageUrl,
        username: undefined, // Username is not typically in basic webhook data, handle separately if needed
        role: userRole, // Store the role from publicMetadata
        // Initialize other fields your 'users' table requires
      });

      // Schedule welcome email for new user created via webhook
      if (args.email) {
        await ctx.scheduler.runAfter(
          10000, // 10 second delay for webhook-created users
          internal.emails.welcome.sendWelcomeEmail,
          { userId: newUserId },
        );
      }

      return newUserId;
    }
  },
});

// Action to generate a short-lived upload URL for profile images
export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    // No specific permissions needed here, as it just generates a URL.
    // The actual upload will be to this URL, and then a mutation will link it.
    return await ctx.storage.generateUploadUrl();
  },
});

// Mutation to update the user\'s profile image using a storageId
export const setUserProfileImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated to set profile image.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User record not found.");
    }

    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) {
      // This could happen if the storageId is invalid or the file doesn\'t exist.
      console.error(`Failed to get URL for storageId: ${args.storageId}`);
      throw new Error(
        "Could not retrieve image URL from storage. The file might not have been uploaded correctly.",
      );
    }

    await ctx.db.patch(user._id, { imageUrl: imageUrl });
    return { success: true, imageUrl };
  },
});

// Mutation to update the username
export const updateUsername = mutation({
  args: { newUsername: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated to update username.");
    }

    const trimmedUsername = args.newUsername.trim();

    // Basic username validation (adjust as needed)
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      throw new Error("Username must be between 3 and 20 characters.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      throw new Error(
        "Username can only contain letters, numbers, and underscores.",
      );
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new Error("Current user record not found.");
    }

    // If username is the same as current, no need to update or check uniqueness
    if (currentUser.username === trimmedUsername) {
      return {
        success: true,
        username: trimmedUsername,
        message: "Username is unchanged.",
      };
    }

    // Check if the new username is already taken by another user
    const existingUserWithNewUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", trimmedUsername))
      .unique();

    if (
      existingUserWithNewUsername &&
      existingUserWithNewUsername._id.toString() !== currentUser._id.toString()
    ) {
      throw new Error(
        "This username is already taken. Please choose another one.",
      );
    }

    await ctx.db.patch(currentUser._id, { username: trimmedUsername });

    // IMPORTANT: If Clerk username needs to be kept in sync,
    // you might need to call Clerk\'s API here or client-side after this mutation succeeds.
    // For example (conceptual, requires Clerk Admin SDK setup if run server-side):
    // import { ConvexClerk } from "@clerk/clerk-sdk-node";
    // const clerk = ConvexClerk({jwtKey: process.env.CLERK_JWT_KEY});
    // await clerk.users.updateUser(identity.subject, { username: trimmedUsername });
    // This is complex and depends on your Clerk setup.
    // For now, we focus on updating the Convex user document.

    return {
      success: true,
      username: trimmedUsername,
      message: "Username updated successfully.",
    };
  },
});

export const updateProfileDetails = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    website: v.optional(v.string()),
    twitter: v.optional(v.string()),
    bluesky: v.optional(v.string()),
    linkedin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity)
      throw new Error("User not authenticated to update profile details.");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User record not found.");

    const updates: Partial<Doc<"users">> = {};

    if (args.name !== undefined) {
      updates.name = args.name.trim();
    }
    if (args.bio !== undefined) {
      if (args.bio && args.bio.length > 200) {
        throw new Error("Bio must be 200 characters or less.");
      }
      updates.bio = args.bio;
    }
    if (args.website !== undefined) updates.website = args.website;
    if (args.twitter !== undefined) updates.twitter = args.twitter;
    if (args.bluesky !== undefined) updates.bluesky = args.bluesky;
    if (args.linkedin !== undefined) updates.linkedin = args.linkedin;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(user._id, updates);
    }
    return { success: true };
  },
});

// --- Admin User Management Functions ---

/**
 * Get user data for profile hover card
 */
export const getUserForHoverCard = query({
  args: { username: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      username: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      bio: v.optional(v.string()),
      website: v.optional(v.string()),
      twitter: v.optional(v.string()),
      bluesky: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      isVerified: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      username: user.username,
      imageUrl: user.imageUrl,
      bio: user.bio,
      website: user.website,
      twitter: user.twitter,
      bluesky: user.bluesky,
      linkedin: user.linkedin,
      isVerified: user.isVerified ?? false,
    };
  },
});

/**
 * [Admin] Lists all users for moderation purposes.
 * Includes pagination and optional search by name, email, or username.
 */
export const listAllUsersAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
    filterBanned: v.optional(v.boolean()),
    filterPaused: v.optional(v.boolean()),
    filterVerified: v.optional(v.boolean()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        name: v.string(),
        email: v.optional(v.string()),
        username: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        isBanned: v.boolean(),
        isPaused: v.boolean(),
        isVerified: v.boolean(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    let query = ctx.db.query("users").order("desc"); // Default order

    // Search functionality: when searchQuery is provided, search all users
    if (args.searchQuery && args.searchQuery.trim()) {
      const searchTerm = args.searchQuery.toLowerCase().trim();

      // Get all users and filter client-side for search
      // Note: Convex doesn't support full-text search on regular fields,
      // so we need to collect all users and filter them
      const allUsers = await ctx.db.query("users").collect();

      const filteredUsers = allUsers.filter((user) => {
        return (
          user.name?.toLowerCase().includes(searchTerm) ||
          user.email?.toLowerCase().includes(searchTerm) ||
          user.username?.toLowerCase().includes(searchTerm)
        );
      });

      // Apply status filters on search results
      let finalFilteredUsers = filteredUsers;

      if (args.filterBanned !== undefined) {
        finalFilteredUsers = finalFilteredUsers.filter(
          (user) => (user.isBanned ?? false) === args.filterBanned,
        );
      }

      if (args.filterPaused !== undefined) {
        finalFilteredUsers = finalFilteredUsers.filter(
          (user) => (user.isPaused ?? false) === args.filterPaused,
        );
      }

      // Sort by creation time (desc) to match the default order
      finalFilteredUsers.sort((a, b) => b._creationTime - a._creationTime);

      // Manual pagination for search results
      const { numItems, cursor } = args.paginationOpts;
      const startIndex = cursor ? parseInt(cursor) : 0;
      const endIndex = startIndex + numItems;
      const paginatedResults = finalFilteredUsers.slice(startIndex, endIndex);
      const hasMore = endIndex < finalFilteredUsers.length;

      const page = paginatedResults.map((user) => ({
        _id: user._id,
        _creationTime: user._creationTime,
        name: user.name,
        email: user.email,
        username: user.username,
        imageUrl: user.imageUrl,
        isBanned: user.isBanned ?? false,
        isPaused: user.isPaused ?? false,
        isVerified: user.isVerified ?? false,
      }));

      return {
        page,
        isDone: !hasMore,
        continueCursor: hasMore ? endIndex.toString() : "",
      };
    }

    // Default behavior: show recent users with pagination when no search
    // Backend filtering for ban status
    if (args.filterBanned !== undefined) {
      query = query.filter((q) => q.eq(q.field("isBanned"), args.filterBanned));
    }

    // Backend filtering for paused status
    if (args.filterPaused !== undefined) {
      query = query.filter((q) => q.eq(q.field("isPaused"), args.filterPaused));
    }

    const result = await query.paginate(args.paginationOpts);

    // We want to return a richer object than just Doc<"users">, explicitly define it.
    const page = result.page.map((user) => ({
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      email: user.email,
      username: user.username,
      imageUrl: user.imageUrl,
      isBanned: user.isBanned ?? false,
      isPaused: user.isPaused ?? false,
      isVerified: user.isVerified ?? false,
    }));

    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * [Admin] Bans a user, preventing them from performing actions like posting, voting, etc.
 */
export const banUserByAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const userToBan = await ctx.db.get(args.userId);
    if (!userToBan) {
      throw new Error("User not found.");
    }
    // When banning, also unpause the user as ban is a stronger restriction.
    await ctx.db.patch(args.userId, { isBanned: true, isPaused: false });
    console.log(`Admin: User ${args.userId} has been banned.`);
    return { success: true, userId: args.userId, newBanStatus: true };
  },
});

/**
 * [Admin] Unbans a user.
 */
export const unbanUserByAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const userToUnban = await ctx.db.get(args.userId);
    if (!userToUnban) {
      throw new Error("User not found.");
    }
    await ctx.db.patch(args.userId, { isBanned: false });
    console.log(`Admin: User ${args.userId} has been unbanned.`);
    return { success: true, userId: args.userId, newBanStatus: false };
  },
});

/**
 * [Admin] Pauses a user.
 * Paused users can log in and edit their profile but cannot comment, vote, rate, bookmark, or submit.
 */
export const pauseUserByAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const userToPause = await ctx.db.get(args.userId);
    if (!userToPause) {
      throw new Error("User not found.");
    }
    // When pausing, ensure user is not also banned. If they are banned, ban takes precedence.
    // However, the request implies these are additive states, or pause is softer.
    // For now, setting isPaused to true. If user is also banned, banned rules apply.
    // If we want pause to unban, that logic would be: { isPaused: true, isBanned: false }
    // Let's assume they are independent, but if an action should override another,
    // it's typically "ban" overriding "pause".
    // If a user is banned, and we pause them, they are now isBanned:true, isPaused:true.
    // If user is active, and we pause them, they are isBanned:false, isPaused:true.
    // This seems fine. The UI will need to correctly represent the state.
    await ctx.db.patch(args.userId, { isPaused: true });
    console.log(`Admin: User ${args.userId} has been paused.`);
    return { success: true, userId: args.userId, newPauseStatus: true };
  },
});

/**
 * [Admin] Unpauses a user.
 */
export const unpauseUserByAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const userToUnpause = await ctx.db.get(args.userId);
    if (!userToUnpause) {
      throw new Error("User not found.");
    }
    await ctx.db.patch(args.userId, { isPaused: false });
    console.log(`Admin: User ${args.userId} has been unpaused.`);
    return { success: true, userId: args.userId, newPauseStatus: false };
  },
});

/**
 * [Admin] Deletes a user and all their associated content.
 * Note: This is a destructive action.
 * Consider if a soft delete (marking as deleted) is more appropriate.
 * For now, it deletes the user document.
 * Cascading deletes (stories, comments, etc.) are not implemented here yet.
 */
export const deleteUserByAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const userToDelete = await ctx.db.get(args.userId);
    if (!userToDelete) {
      throw new Error("User not found.");
    }

    // Before deleting the user, consider handling their content:
    // 1. Delete all stories by this user
    // 2. Delete all comments by this user
    // 3. Delete all votes by this user
    // 4. Delete all ratings by this user
    // 5. Delete all bookmarks by this user
    // This requires iterating through tables and deleting related documents.
    // Example for stories (similar logic for others):
    // const stories = await ctx.db.query("stories").withIndex("by_user", q => q.eq("userId", args.userId)).collect();
    // for (const story of stories) {
    //   await ctx.db.delete(story._id);
    //   // Potentially delete associated comments, votes, ratings for that story if not handled by story deletion logic itself
    // }
    // For now, just deleting the user document for simplicity as per request.
    // A more robust solution would involve a transactional approach or background jobs for cascading deletes.

    await ctx.db.delete(args.userId);
    console.log(`Admin: User ${args.userId} has been deleted.`);

    // Invalidate Clerk session if possible/needed. This might require Clerk Admin API.
    // Example: await clerk.users.deleteUser(userToDelete.clerkId);
    // This part is complex and depends on Clerk SDK setup, so it's commented out.

    return { success: true, userId: args.userId };
  },
});

/**
 * [Admin] Verifies a user, marking them as verified with a blue checkmark.
 */
export const verifyUserByAdmin = mutation({
  args: { userId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    userId: v.id("users"),
    newVerifiedStatus: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const userToVerify = await ctx.db.get(args.userId);
    if (!userToVerify) {
      throw new Error("User not found.");
    }
    await ctx.db.patch(args.userId, { isVerified: true });

    // Create verification notification for the user
    await ctx.runMutation(internal.alerts.createAlert, {
      recipientUserId: args.userId,
      type: "verified",
    });

    console.log(`Admin: User ${args.userId} has been verified.`);
    return { success: true, userId: args.userId, newVerifiedStatus: true };
  },
});

/**
 * [Admin] Unverifies a user, removing their verified status.
 */
export const unverifyUserByAdmin = mutation({
  args: { userId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    userId: v.id("users"),
    newVerifiedStatus: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const userToUnverify = await ctx.db.get(args.userId);
    if (!userToUnverify) {
      throw new Error("User not found.");
    }
    await ctx.db.patch(args.userId, { isVerified: false });
    console.log(`Admin: User ${args.userId} has been unverified.`);
    return { success: true, userId: args.userId, newVerifiedStatus: false };
  },
});

/**
 * [TEMPORARY] Set current user as admin in database for backward compatibility
 * This is a temporary function to help with testing admin notifications
 * In production, roles should be managed through Clerk
 */
export const setCurrentUserAsAdminTemp = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found in database");
    }

    await ctx.db.patch(user._id, { role: "admin" });

    return {
      success: true,
      message: `User ${user.name} (${user._id}) has been set as admin in database for testing`,
    };
  },
});

/**
 * [TEMPORARY] List all users to find correct email
 */
export const listAllUsersForDebug = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.optional(v.string()),
      username: v.optional(v.string()),
      role: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
    }));
  },
});

/**
 * [TEMPORARY] Set specific user as admin by username for testing
 */
export const setUserAsAdminByUsername = mutation({
  args: {
    username: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Find user by username
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();

    if (!user) {
      throw new Error(
        `User with username ${args.username} not found in database`,
      );
    }

    await ctx.db.patch(user._id, { role: "admin" });

    return {
      success: true,
      message: `User ${user.name} (@${user.username}) has been set as admin in database for testing`,
    };
  },
});

/**
 * [TEMPORARY] Set specific user as admin by email for testing
 * This helps when you can't authenticate to run the other function
 */
export const setUserAsAdminByEmail = mutation({
  args: {
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Find user by email
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.email === args.email);

    if (!user) {
      throw new Error(`User with email ${args.email} not found in database`);
    }

    await ctx.db.patch(user._id, { role: "admin" });

    return {
      success: true,
      message: `User ${user.name} (${user.email}) has been set as admin in database for testing`,
    };
  },
});

/**
 * [TEMPORARY] Fix missing email addresses for existing users
 * This function will try to update the current user's email and provide debug info
 */
export const fixMissingEmails = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    updatedUsers: v.number(),
    debugInfo: v.object({
      currentUserHasEmail: v.boolean(),
      totalUsersWithoutEmail: v.number(),
      identityEmailFound: v.boolean(),
      identityEmail: v.optional(v.string()),
    }),
  }),
  handler: async (ctx) => {
    // Only allow authenticated users to run this
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new Error("Current user not found");
    }

    // Get all users without email addresses
    const usersWithoutEmail = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), undefined))
      .collect();

    console.log(
      `Found ${usersWithoutEmail.length} users without email addresses`,
    );

    let updatedCount = 0;
    const clerkEmail = await extractEmailFromIdentity(identity);

    console.log(`Current user email in DB: ${currentUser.email}`);
    console.log(`Email extracted from identity: ${clerkEmail}`);

    // Try to update current user's email if missing or different
    if (clerkEmail && clerkEmail !== currentUser.email) {
      await ctx.db.patch(currentUser._id, { email: clerkEmail });
      updatedCount++;
      console.log(
        `Updated email for current user ${currentUser.name}: ${clerkEmail}`,
      );
    }

    return {
      success: true,
      message: `Updated ${updatedCount} users. Found ${usersWithoutEmail.length} users without emails. Check console for debug info.`,
      updatedUsers: updatedCount,
      debugInfo: {
        currentUserHasEmail: !!currentUser.email,
        totalUsersWithoutEmail: usersWithoutEmail.length,
        identityEmailFound: !!clerkEmail,
        identityEmail: clerkEmail,
      },
    };
  },
});

// Helper function to extract email from identity
async function extractEmailFromIdentity(
  identity: any,
): Promise<string | undefined> {
  // Try multiple possible email field names (identity.email is the correct one based on debug logs)
  if (typeof identity.email === "string") {
    return identity.email;
  } else if (typeof identity.emailAddress === "string") {
    return identity.emailAddress;
  } else if (typeof identity.primaryEmailAddress?.emailAddress === "string") {
    return identity.primaryEmailAddress.emailAddress;
  }
  return undefined;
}

/**
 * [TEMPORARY] Force refresh current user data from Clerk
 * This calls ensureUser to trigger the email sync process
 */
export const forceRefreshCurrentUser = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    userEmail: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required");
      }

      // Get current user
      const currentUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();

      if (!currentUser) {
        throw new Error("Current user not found");
      }

      // Extract email from identity
      const clerkEmail = await extractEmailFromIdentity(identity);
      console.log(
        `Force refresh - Current user email in DB: ${currentUser.email}`,
      );
      console.log(
        `Force refresh - Email extracted from identity: ${clerkEmail}`,
      );

      // Update email if found and different
      if (clerkEmail && clerkEmail !== currentUser.email) {
        await ctx.db.patch(currentUser._id, { email: clerkEmail });
        console.log(
          `Force refresh - Updated email for user ${currentUser.name}: ${clerkEmail}`,
        );

        return {
          success: true,
          message: `User email updated successfully: ${clerkEmail}`,
          userEmail: clerkEmail,
        };
      } else if (currentUser.email) {
        return {
          success: true,
          message: `User already has email: ${currentUser.email}`,
          userEmail: currentUser.email,
        };
      } else {
        return {
          success: false,
          message: `No email found in Clerk identity. Check console logs for debug info.`,
          userEmail: undefined,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to refresh user: ${error instanceof Error ? error.message : "Unknown error"}`,
        userEmail: undefined,
      };
    }
  },
});

/**
 * Returns the user's number (1-based) by order of account creation.
 * Example: the first user is 1, the second is 2, etc.
 */
export const getUserNumber = query({
  args: { userId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    // Count users with _creationTime less than this user's
    const earlierUsers = await ctx.db
      .query("users")
      .filter((q) => q.lt(q.field("_creationTime"), user._creationTime))
      .collect();
    return earlierUsers.length + 1;
  },
});

/**
 * Get user by ID for notifications and other features
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      username: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user || user.isBanned) {
      return null;
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      username: user.username,
      imageUrl: user.imageUrl,
    };
  },
});

/**
 * Search users by username or name for @mention autocomplete
 * Returns up to 10 matches for performance
 */
export const searchUsersForMentions = query({
  args: { query: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      username: v.string(),
      name: v.string(),
      profileImageUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    if (!args.query || args.query.length < 1) {
      return [];
    }

    const query = args.query.toLowerCase();

    // First try exact username match for fast lookup
    const exactMatch = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", query))
      .filter((q) => q.neq(q.field("isBanned"), true))
      .unique();

    if (exactMatch && exactMatch.username) {
      return [
        {
          _id: exactMatch._id,
          username: exactMatch.username,
          name: exactMatch.name,
          profileImageUrl: exactMatch.imageUrl,
        },
      ];
    }

    // Then do prefix search across all users
    const users = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("isBanned"), true))
      .collect();

    const matches = users
      .filter(
        (user) =>
          user.username &&
          (user.username.toLowerCase().startsWith(query) ||
            user.name.toLowerCase().includes(query)),
      )
      .slice(0, 10) // Limit to 10 results for performance
      .map((user) => ({
        _id: user._id,
        username: user.username!,
        name: user.name,
        profileImageUrl: user.imageUrl,
      }));

    return matches;
  },
});

/**
 * Get the most recent users who have been active on the platform for the Recent Vibers sidebar
 * Includes users who have recently joined, commented, rated, voted, or submitted stories
 */
export const getRecentVibers = query({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      username: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      isVerified: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    // Get recent activity from multiple sources
    const recentActivityLimit = Math.min(args.limit * 3, 100); // Get more to ensure diversity

    // 1. Recent user joins
    const recentJoins = await ctx.db
      .query("users")
      .order("desc")
      .filter((q) => q.neq(q.field("isBanned"), true))
      .filter((q) => q.neq(q.field("username"), undefined))
      .take(recentActivityLimit);

    // 2. Recent comments
    const recentComments = await ctx.db
      .query("comments")
      .order("desc")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .filter((q) => q.neq(q.field("isHidden"), true))
      .take(recentActivityLimit);

    // 3. Recent ratings
    const recentRatings = await ctx.db
      .query("storyRatings")
      .order("desc")
      .take(recentActivityLimit);

    // 4. Recent votes
    const recentVotes = await ctx.db
      .query("votes")
      .order("desc")
      .take(recentActivityLimit);

    // 5. Recent story submissions
    const recentSubmissions = await ctx.db
      .query("stories")
      .order("desc")
      .filter((q) => q.neq(q.field("userId"), undefined))
      .take(recentActivityLimit);

    // Create a map to track unique users with their most recent activity
    const userActivityMap = new Map<
      Id<"users">,
      { userId: Id<"users">; timestamp: number; activityType: string }
    >();

    // Process each activity type
    const activities = [
      ...recentJoins.map((user) => ({
        userId: user._id,
        timestamp: user._creationTime,
        activityType: "join",
      })),
      ...recentComments.map((comment) => ({
        userId: comment.userId,
        timestamp: comment._creationTime,
        activityType: "comment",
      })),
      ...recentRatings.map((rating) => ({
        userId: rating.userId,
        timestamp: rating._creationTime,
        activityType: "rating",
      })),
      ...recentVotes.map((vote) => ({
        userId: vote.userId,
        timestamp: vote._creationTime,
        activityType: "vote",
      })),
      ...recentSubmissions
        .filter((story) => story.userId)
        .map((story) => ({
          userId: story.userId!,
          timestamp: story._creationTime,
          activityType: "submission",
        })),
    ];

    // Keep only the most recent activity per user
    for (const activity of activities) {
      const existing = userActivityMap.get(activity.userId);
      if (!existing || activity.timestamp > existing.timestamp) {
        userActivityMap.set(activity.userId, activity);
      }
    }

    // Sort by most recent activity timestamp
    const sortedActivities = Array.from(userActivityMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, args.limit);

    // Fetch user details for the most active users
    const recentActiveUsers = [];
    for (const activity of sortedActivities) {
      const user = await ctx.db.get(activity.userId);
      if (user && !user.isBanned && user.username) {
        recentActiveUsers.push({
          _id: user._id,
          _creationTime: user._creationTime,
          name: user.name,
          username: user.username,
          imageUrl: user.imageUrl,
          isVerified: user.isVerified,
        });
      }
    }

    return recentActiveUsers;
  },
});

/**
 * Define allowed emoji themes
 */
const ALLOWED_EMOJI_THEMES = [
  "default",
  "red",
  "blue",
  "green",
  "purple",
  "orange",
] as const;

export const emojiThemeValidator = v.union(
  v.literal("default"),
  v.literal("red"),
  v.literal("blue"),
  v.literal("green"),
  v.literal("purple"),
  v.literal("orange"),
);

/**
 * Update user's emoji theme preference
 */
export const updateEmojiTheme = mutation({
  args: {
    theme: emojiThemeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    await ctx.db.patch(user._id, {
      emojiTheme: args.theme,
    });

    return null;
  },
});

/**
 * Get current user's emoji theme preference
 */
export const getMyEmojiTheme = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    return user.emojiTheme || "default";
  },
});
