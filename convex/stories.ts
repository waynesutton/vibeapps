import { query, mutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id, DataModel } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { GenericDatabaseReader, StorageReader } from "convex/server";
import { getAuthenticatedUserId, requireAdminRole } from "./users"; // Import the centralized helper and requireAdminRole
import { storyWithDetailsValidator, StoryWithDetailsPublic } from "./validators"; // Import StoryWithDetailsPublic

// Validator for Doc<"tags">
// REMOVED - Moved to convex/validators.ts
// const tagDocValidator = v.object({ ... });

// Validator for StoryWithDetails type
// REMOVED - Moved to convex/validators.ts
// export const storyWithDetailsValidator = v.object({ ... });

// Extend the Doc type for Story to include calculated fields and tags
export type StoryWithDetails = Doc<"stories"> & {
  voteScore: number; // Optional: if we want to calculate a score based on votes and time
  screenshotUrl: string | null;
  tags: Doc<"tags">[]; // Include full tag documents
  commentCount: number; // Ensure commentCount is part of the type
  authorName?: string;
  authorUsername?: string;
  authorImageUrl?: string;
};

// Helper to fetch tags and comment counts for stories
const fetchTagsAndCountsForStories = async (
  ctx: { db: GenericDatabaseReader<DataModel>; storage: StorageReader },
  stories: Doc<"stories">[]
): Promise<StoryWithDetails[]> => {
  const allTagIds = stories.flatMap((story) => story.tagIds || []);
  const uniqueTagIds = [...new Set(allTagIds)];

  const tags = await Promise.all(uniqueTagIds.map((tagId) => ctx.db.get(tagId)));
  const tagsMap = new Map(tags.filter(Boolean).map((tag) => [tag!._id, tag!]));

  // Efficiently fetch all unique author details
  const uniqueUserIds = [...new Set(stories.map((story) => story.userId).filter(Boolean))];
  const users = await Promise.all(uniqueUserIds.map((userId) => ctx.db.get(userId as Id<"users">)));
  const usersMap = new Map(users.filter(Boolean).map((user) => [user!._id, user!]));

  return Promise.all(
    stories.map(async (story) => {
      const screenshotUrl = story.screenshotId
        ? await ctx.storage.getUrl(story.screenshotId)
        : null;
      const voteScore = story.votes;
      const storyTags = (story.tagIds || [])
        .map((id) => tagsMap.get(id))
        .filter(Boolean) as Doc<"tags">[];

      // Fetch approved, non-hidden comments and get the count
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_storyId_status", (q) => q.eq("storyId", story._id).eq("status", "approved"))
        .filter((q) => q.neq(q.field("isHidden"), true))
        .collect();
      const commentCount = comments.length;

      const author = story.userId ? usersMap.get(story.userId) : undefined;

      return {
        ...story,
        voteScore,
        screenshotUrl,
        tags: storyTags,
        commentCount,
        authorName: author?.name,
        authorUsername: author?.username,
        authorImageUrl: author?.imageUrl,
      };
    })
  );
};

// Define SortPeriod type including vote-based options
export type SortPeriod =
  | "today"
  | "week"
  | "month"
  | "year"
  | "all"
  | "votes_today"
  | "votes_week"
  | "votes_month"
  | "votes_year";

// Updated listApproved query to sort by pinned status first and handle new vote sorts
export const listApproved = query({
  args: {
    paginationOpts: paginationOptsValidator,
    tagId: v.optional(v.id("tags")),
    sortPeriod: v.optional(
      v.union(
        v.literal("today"),
        v.literal("week"),
        v.literal("month"),
        v.literal("year"),
        v.literal("all"),
        v.literal("votes_today"),
        v.literal("votes_week"),
        v.literal("votes_month"),
        v.literal("votes_year")
      )
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ page: StoryWithDetails[]; isDone: boolean; continueCursor: string }> => {
    const now = Date.now();
    let startTime = 0;

    switch (args.sortPeriod) {
      case "today":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case "year":
        startTime = now - 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = 0;
    }

    let paginatedResult;
    let initialFilteredStories: Doc<"stories">[];

    if (args.sortPeriod?.startsWith("votes_")) {
      // If sorting by votes, use the index, order, filter, then paginate
      paginatedResult = await ctx.db
        .query("stories")
        .withIndex("by_votes")
        .order("desc")
        .filter((q) =>
          q.and(
            q.eq(q.field("status"), "approved"),
            q.neq(q.field("isHidden"), true),
            q.gte(q.field("_creationTime"), startTime) // Apply time filter *after* index selection
          )
        )
        .paginate(args.paginationOpts);

      initialFilteredStories = paginatedResult.page;
      const storiesWithDetails = await fetchTagsAndCountsForStories(ctx, initialFilteredStories);

      // Filter by tagId *after* pagination if needed (less efficient but necessary)
      let finalPage = storiesWithDetails;
      if (args.tagId) {
        console.warn("Filtering by tagId after pagination isn't efficient...");
        finalPage = storiesWithDetails.filter((story) =>
          (story.tagIds || []).includes(args.tagId!)
        );
      }

      return {
        page: finalPage,
        isDone: paginatedResult.isDone,
        continueCursor: paginatedResult.continueCursor,
      };
    } else {
      // For time-based sorting (or 'all'), filter first, collect all matching, then sort manually for pinning, then paginate manually
      const baseQuery = ctx.db
        .query("stories")
        .filter((q) =>
          q.and(
            q.eq(q.field("status"), "approved"),
            q.neq(q.field("isHidden"), true),
            q.gte(q.field("_creationTime"), startTime)
          )
        );
      initialFilteredStories = await baseQuery.collect();

      // Manual sorting: Pinned first, then by creation time descending
      initialFilteredStories.sort((a, b) => {
        const pinA = a.isPinned ?? false;
        const pinB = b.isPinned ?? false;
        if (pinA !== pinB) {
          return pinA ? -1 : 1;
        }
        return b._creationTime - a._creationTime;
      });

      // Apply pagination manually after sorting
      const startIndex = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor, 10) : 0;
      const endIndex = startIndex + args.paginationOpts.numItems;
      const pageStories = initialFilteredStories.slice(startIndex, endIndex);
      const isDone = endIndex >= initialFilteredStories.length;
      const continueCursor = isDone ? null : endIndex.toString();

      let storiesWithDetails = await fetchTagsAndCountsForStories(ctx, pageStories);

      // Post-filter by tagId if provided
      if (args.tagId) {
        storiesWithDetails = storiesWithDetails.filter((story) =>
          (story.tagIds || []).includes(args.tagId!)
        );
      }

      return {
        page: storiesWithDetails,
        isDone,
        continueCursor: continueCursor ?? "",
      };
    }
  },
});

// Query to list stories pending moderation
export const listPending = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (
    ctx,
    args
  ): Promise<{ page: StoryWithDetails[]; isDone: boolean; continueCursor: string }> => {
    const query = ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc");

    const paginatedStories = await query.paginate(args.paginationOpts);
    const storiesWithDetails = await fetchTagsAndCountsForStories(ctx, paginatedStories.page);

    return {
      ...paginatedStories,
      page: storiesWithDetails,
    };
  },
});

// Updated getBySlug to fetch tags and counts and add explicit returns validator
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(storyWithDetailsValidator, v.null()), // Explicit returns validator
  handler: async (ctx, args): Promise<StoryWithDetails | null> => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.and(q.eq(q.field("status"), "approved"), q.neq(q.field("isHidden"), true)))
      .unique();

    if (!story) {
      return null;
    }

    const storiesWithDetails = await fetchTagsAndCountsForStories(ctx, [story]);
    return storiesWithDetails[0];
  },
});

// Helper function to generate a URL-friendly slug
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const submit = mutation({
  args: {
    title: v.string(),
    tagline: v.string(),
    url: v.string(),
    tagIds: v.array(v.id("tags")),
    newTagNames: v.array(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
    chefAppUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const userRecord = await ctx.db.get(userId);

    if (!userRecord) {
      throw new Error("Authenticated user record not found. Sync issue?");
    }

    // Rate Limiting Check (now based on userId)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentSubmissions = await ctx.db
      .query("submissionLogs")
      // Assuming submissionLogs has userId and submissionTime fields.
      // We might need to adjust the index or query if using email for anonymous and userId for logged in.
      // For now, this assumes submissionLogs will primarily use userId for authenticated users.
      .withIndex(
        "by_user_time",
        (
          q // IMPORTANT: This index needs to be added to submissionLogs in schema.ts
        ) => q.eq("userId", userId).gt("submissionTime", twentyFourHoursAgo)
      )
      .collect();

    if (recentSubmissions.length >= 10) {
      throw new Error("Submission limit reached. You can submit up to 10 projects per day.");
    }

    const slug = generateSlug(args.title);

    const existing = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      throw new Error(`Slug "${slug}" already exists for story: ${existing.title}`);
    }

    let allTagIds: Id<"tags">[] = [...args.tagIds];

    if (args.newTagNames && args.newTagNames.length > 0) {
      const newCreatedTagIds = await ctx.runMutation(internal.tags.ensureTags, {
        tagNames: args.newTagNames,
      });
      allTagIds = [...new Set([...allTagIds, ...newCreatedTagIds])];
    }

    for (const tagId of allTagIds) {
      const tag = await ctx.db.get(tagId);
      if (!tag) {
        console.warn(`Tag with ID ${tagId} not found during final check.`);
        allTagIds = allTagIds.filter((id) => id !== tagId);
      }
    }

    if (allTagIds.length === 0) {
      throw new Error("At least one valid tag is required to submit a story.");
    }

    const storyId = await ctx.db.insert("stories", {
      title: args.title,
      slug: slug,
      url: args.url,
      description: args.tagline,
      tagIds: allTagIds,
      userId: userId,
      votes: 1,
      commentCount: 0,
      screenshotId: args.screenshotId,
      ratingSum: 0,
      ratingCount: 0,
      linkedinUrl: args.linkedinUrl,
      twitterUrl: args.twitterUrl,
      githubUrl: args.githubUrl,
      chefShowUrl: args.chefShowUrl,
      chefAppUrl: args.chefAppUrl,
      status: "approved",
      isHidden: false,
      isPinned: false,
      customMessage: undefined,
      isApproved: true,
    });

    // Log the submission
    await ctx.db.insert("submissionLogs", {
      submitterEmail: userRecord.email || "unknown@example.com",
      userId: userId,
      submissionTime: Date.now(),
    });

    return { storyId, slug };
  },
});

// Mutation to generate upload URL for screenshots
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// Renamed vote to voteStory
export const voteStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx); // Ensure user is authenticated

    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    // Check if the user has already voted for this story
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_user_story", (q) => q.eq("userId", userId).eq("storyId", args.storyId))
      .first();

    if (existingVote) {
      // User has already voted, perhaps allow unvoting or just do nothing / throw error
      // For now, let's remove the vote (unvote action)
      await ctx.db.delete(existingVote._id);
      await ctx.db.patch(args.storyId, { votes: story.votes - 1 });
      return { success: true, action: "unvoted", newVoteCount: story.votes - 1 };
      // throw new Error("User has already voted for this story.");
    }

    // User hasn't voted, so add a vote
    await ctx.db.insert("votes", {
      userId: userId,
      storyId: args.storyId,
    });

    // Increment the vote count on the story
    await ctx.db.patch(args.storyId, { votes: story.votes + 1 });
    return { success: true, action: "voted", newVoteCount: story.votes + 1 };
  },
});

// rate mutation updated for authenticated users and to prevent re-rating
export const rate = mutation({
  args: {
    storyId: v.id("stories"),
    rating: v.number(), // Expecting 1-5
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5.");
    }

    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found.");
    }

    // Check if the user has already rated this story
    const existingRating = await ctx.db
      .query("storyRatings")
      .withIndex("by_user_story", (q) => q.eq("userId", userId).eq("storyId", args.storyId))
      .first();

    if (existingRating) {
      // Option 1: Prevent re-rating (current implementation)
      throw new Error("You have already rated this story.");

      // Option 2: Allow changing rating (more complex, requires adjusting sum/count carefully)
      // const oldRatingValue = existingRating.value;
      // await ctx.db.patch(existingRating._id, { value: args.rating });
      // await ctx.db.patch(args.storyId, {
      //   ratingSum: story.ratingSum - oldRatingValue + args.rating,
      //   // ratingCount remains the same if only allowing update
      // });
      // return { success: true, message: "Rating updated." };
    }

    // Add new rating to storyRatings table
    await ctx.db.insert("storyRatings", {
      userId: userId,
      storyId: args.storyId,
      value: args.rating,
    });

    // Update ratingSum and ratingCount on the story
    await ctx.db.patch(args.storyId, {
      ratingSum: story.ratingSum + args.rating,
      ratingCount: story.ratingCount + 1,
    });

    return { success: true };
  },
});

// Query to get the authenticated user's rating for a specific story
export const getUserRatingForStory = query({
  args: { storyId: v.id("stories") },
  returns: v.union(v.null(), v.number()), // Returns rating value (1-5) or null
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null; // Not logged in, so no rating
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return null; // User not found in Convex DB (shouldn't happen if ensureUser works)
    }

    const existingRating = await ctx.db
      .query("storyRatings")
      .withIndex("by_user_story", (q) => q.eq("userId", user._id).eq("storyId", args.storyId))
      .first();

    return existingRating ? existingRating.value : null;
  },
});

// Mutation for updating story status (moderation)
export const updateStatus = mutation({
  args: {
    storyId: v.id("stories"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, { status: args.status });
  },
});

// --- Admin/Moderation Mutations ---

export const hideStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, { isHidden: true });
  },
});

export const showStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, { isHidden: false });
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      console.warn(`Story ${args.storyId} not found for deletion.`);
      return;
    }
    if (story.screenshotId) {
      try {
        await ctx.storage.delete(story.screenshotId);
      } catch (error) {
        console.error(`Failed to delete screenshot ${story.screenshotId}:`, error);
      }
    }
    // Consider deleting associated comments here as well
    await ctx.db.delete(args.storyId);
  },
});

// NEW: Mutation to update custom message
export const updateStoryCustomMessage = mutation({
  args: {
    storyId: v.id("stories"),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, {
      customMessage: args.customMessage || undefined,
    });
  },
});

// NEW: Mutation to toggle pin status
export const toggleStoryPinStatus = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, {
      isPinned: !story.isPinned,
    });
  },
});

// Mutation to allow a user to delete their own story
export const deleteOwnStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const story = await ctx.db.get(args.storyId);

    if (!story) {
      throw new Error("Story not found.");
    }

    if (story.userId !== userId) {
      // Optionally, check if user is an admin, then allow deletion
      // This would require an additional check like:
      // const identity = await ctx.auth.getUserIdentity();
      // const userDoc = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).unique();
      // if (!userDoc?.roles?.includes("admin")) {
      //   throw new Error("User not authorized to delete this story.");
      // }
      // For now, strict ownership for this mutation:
      throw new Error("User not authorized to delete this story. Only the owner can delete.");
    }

    // If story has a screenshot, delete it from storage
    if (story.screenshotId) {
      try {
        await ctx.storage.delete(story.screenshotId);
      } catch (error) {
        console.error(
          `Failed to delete screenshot ${story.screenshotId} for story ${args.storyId}:`,
          error
        );
        // Decide if this error should prevent story deletion or just be logged
      }
    }

    // TODO: Consider how to handle associated comments and votes.
    // Option 1: Delete them here (can be complex, especially with replies).
    // Option 2: Leave them orphaned (might be simpler, but could lead to dangling data).
    // Option 3: Mark them as associated with a "deleted user" or anonymize.
    // For now, just deleting the story.

    // Example: Delete associated votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Example: Delete associated comments (simple, non-recursive for replies)
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    await ctx.db.delete(args.storyId);
    return { success: true };
  },
});

// Updated query to list ALL stories for admin, sorting manually for pinning
export const listAllStoriesAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filters: v.object({
      status: v.optional(
        v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
      ),
      isHidden: v.optional(v.boolean()),
    }),
    searchTerm: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ page: StoryWithDetails[]; isDone: boolean; continueCursor: string }> => {
    let initialStories: Doc<"stories">[];

    if (args.searchTerm && args.searchTerm.trim() !== "") {
      const searchTerm = args.searchTerm.trim();
      let query = ctx.db.query("stories").withSearchIndex("search_all", (q) => {
        let builder = q.search("title", searchTerm);
        if (args.filters.status) {
          builder = builder.eq("status", args.filters.status);
        }
        if (args.filters.isHidden !== undefined) {
          builder = builder.eq("isHidden", args.filters.isHidden);
        }
        return builder;
      });
      initialStories = await query.collect();
      // Post-filter if necessary
      if (args.filters.status && !initialStories.every((s) => s.status === args.filters.status)) {
        initialStories = initialStories.filter((s) => s.status === args.filters.status);
      }
      if (
        args.filters.isHidden !== undefined &&
        !initialStories.every((s) => s.isHidden === args.filters.isHidden)
      ) {
        initialStories = initialStories.filter((s) => s.isHidden === args.filters.isHidden);
      }
    } else {
      let query = ctx.db.query("stories");
      // Rely on filter for combined criteria
      initialStories = await query
        .filter((q) => {
          const conditions = [];
          if (args.filters.status) {
            conditions.push(q.eq(q.field("status"), args.filters.status));
          }
          if (args.filters.isHidden !== undefined) {
            conditions.push(q.eq(q.field("isHidden"), args.filters.isHidden));
          }
          return conditions.length > 0 ? q.and(...conditions) : true;
        })
        .collect();
    }

    // Manual Sorting: Pinned first, then by creation time descending
    initialStories.sort((a, b) => {
      const pinA = a.isPinned ?? false;
      const pinB = b.isPinned ?? false;
      if (pinA !== pinB) {
        return pinA ? -1 : 1;
      }
      return b._creationTime - a._creationTime;
    });

    // Apply pagination manually after sorting
    const startIndex = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor, 10) : 0;
    if (isNaN(startIndex) || startIndex < 0) {
      throw new Error("Invalid pagination cursor");
    }
    const endIndex = startIndex + args.paginationOpts.numItems;
    const pageStories = initialStories.slice(startIndex, endIndex);

    const isDone = endIndex >= initialStories.length;
    const continueCursor = isDone ? null : endIndex.toString();

    // Fetch additional details for the paginated subset
    const storiesWithDetails = await fetchTagsAndCountsForStories(ctx, pageStories);

    return {
      page: storiesWithDetails,
      isDone,
      continueCursor: continueCursor ?? "",
    };
  },
});

// Internal query to fetch full details for a batch of story IDs
// This will include author information and tags.
export const _getStoryDetailsBatch = internalQuery({
  args: { storyIds: v.array(v.id("stories")) },
  // The handler will return StoryWithDetailsPublic[], so the validator should match this structure.
  // The storyWithDetailsValidator is used to validate the shape of each object.
  returns: v.array(storyWithDetailsValidator),
  handler: async (ctx, args): Promise<StoryWithDetailsPublic[]> => {
    const results: StoryWithDetailsPublic[] = [];
    for (const storyId of args.storyIds) {
      const story = await ctx.db.get(storyId);
      if (!story) continue;

      const author = await ctx.db.get(story.userId);
      const tags = await Promise.all(story.tagIds.map((tagId) => ctx.db.get(tagId)));
      const screenshotUrl = story.screenshotId
        ? await ctx.storage.getUrl(story.screenshotId)
        : null;

      // Construct the story object according to StoryWithDetailsPublic type
      results.push({
        ...story, // Spread all fields from Doc<"stories">
        // Explicitly list all fields required by StoryWithDetailsPublic that come from Doc<"stories">
        _id: story._id,
        _creationTime: story._creationTime,
        title: story.title,
        slug: story.slug,
        url: story.url,
        description: story.description,
        tagIds: story.tagIds,
        userId: story.userId,
        votes: story.votes,
        commentCount: story.commentCount,
        screenshotId: story.screenshotId,
        ratingSum: story.ratingSum,
        ratingCount: story.ratingCount,
        linkedinUrl: story.linkedinUrl,
        twitterUrl: story.twitterUrl,
        githubUrl: story.githubUrl,
        chefShowUrl: story.chefShowUrl,
        chefAppUrl: story.chefAppUrl,
        status: story.status,
        isHidden: story.isHidden,
        isPinned: story.isPinned,
        customMessage: story.customMessage,
        isApproved: story.isApproved,
        // Joined data
        authorName: author?.name,
        authorUsername: author?.username,
        authorImageUrl: author?.imageUrl,
        tags: tags.filter(Boolean) as Doc<"tags">[],
        screenshotUrl: screenshotUrl,
        voteScore: story.votes, // Example: voteScore is just votes for now
      });
    }
    return results;
  },
});

// Example of a public query to list stories (e.g., for the homepage)
export const listApprovedStoriesWithDetails = query({
  args: { paginationOpts: v.optional(v.any()) },
  returns: v.array(storyWithDetailsValidator), // Validator for return shape
  handler: async (ctx, args): Promise<StoryWithDetailsPublic[]> => {
    const approvedStories = await ctx.db
      .query("stories")
      .filter((q) => q.and(q.eq(q.field("status"), "approved"), q.eq(q.field("isHidden"), false)))
      .order("desc")
      .collect();

    if (approvedStories.length === 0) {
      return [];
    }

    const storyIds = approvedStories.map((s) => s._id);

    const detailedStories: StoryWithDetailsPublic[] = await ctx.runQuery(
      internal.stories._getStoryDetailsBatch,
      { storyIds }
    );

    return detailedStories;
  },
});
