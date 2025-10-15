import {
  query,
  mutation,
  internalQuery,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { v, type Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id, DataModel } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { GenericDatabaseReader, StorageReader } from "convex/server";
import {
  getAuthenticatedUserId,
  requireAdminRole,
  ensureUserNotBanned,
} from "./users"; // Import the centralized helper and requireAdminRole
import {
  storyWithDetailsValidator,
  StoryWithDetailsPublic,
} from "./validators"; // Import StoryWithDetailsPublic

// Validator for Doc<"tags">
// REMOVED - Moved to convex/validators.ts
// const tagDocValidator = v.object({ ... });

// Validator for StoryWithDetails type
// REMOVED - Moved to convex/validators.ts
// export const storyWithDetailsValidator = v.object({ ... });

// Extend the Doc type for Story to include calculated fields and tags
export type StoryWithDetails = Doc<"stories"> & {
  voteScore: number;
  screenshotUrl: string | null;
  additionalImageUrls: string[];
  tags: Array<{
    _id: Id<"tags">;
    _creationTime: number;
    name: string;
    slug: string; // Ensure slug is string here, matching StoryWithDetailsPublic & tagDocValidator
    showInHeader: boolean;
    isHidden?: boolean;
    backgroundColor?: string;
    textColor?: string;
    // Add any other fields from tagDocValidator if they were part of the local type before and are needed
  }>;
  commentsCount: number;
  authorName?: string;
  authorUsername?: string;
  authorImageUrl?: string;
  authorEmail?: string;
  authorIsVerified?: boolean;
  averageRating: number;
  votesCount: number;
};

// Helper to fetch tags and related counts for stories
const fetchTagsAndCountsForStories = async (
  ctx: { db: GenericDatabaseReader<DataModel>; storage: StorageReader },
  stories: Doc<"stories">[],
): Promise<StoryWithDetails[]> => {
  const allTagIds = stories.flatMap((story) => story.tagIds || []);
  const uniqueTagIds = [...new Set(allTagIds)];

  const tagsMapResults = await Promise.all(
    uniqueTagIds.map((tagId) => ctx.db.get(tagId)),
  );
  const tagsMap = new Map(
    tagsMapResults.filter(Boolean).map((tag) => [tag!._id, tag!]),
  );

  const uniqueUserIds = [
    ...new Set(stories.map((story) => story.userId).filter(Boolean)),
  ];
  const users = await Promise.all(
    uniqueUserIds.map((userId) => ctx.db.get(userId as Id<"users">)),
  );
  const usersMap = new Map(
    users.filter(Boolean).map((user) => [user!._id, user!]),
  );

  return Promise.all(
    stories.map(async (story) => {
      const screenshotUrl = story.screenshotId
        ? await ctx.storage.getUrl(story.screenshotId)
        : null;

      // Resolve additional image URLs
      const additionalImageUrls = story.additionalImageIds
        ? await Promise.all(
            story.additionalImageIds.map(async (imageId) => {
              const url = await ctx.storage.getUrl(imageId);
              return url || "";
            }),
          ).then((urls) => urls.filter((url) => url !== ""))
        : [];

      const storyTagsIntermediate = (story.tagIds || []).map((id) =>
        tagsMap.get(id),
      );

      // Replace .filter().map() with a loop for explicit construction
      const processedStoryTags: Array<{
        _id: Id<"tags">;
        _creationTime: number;
        name: string;
        slug: string; // Explicitly string
        showInHeader: boolean;
        isHidden?: boolean;
        backgroundColor?: string;
        textColor?: string;
      }> = [];

      for (const tag of storyTagsIntermediate) {
        if (tag && typeof tag.slug === "string") {
          processedStoryTags.push({
            _id: tag._id,
            _creationTime: tag._creationTime,
            name: tag.name,
            slug: tag.slug, // slug is string here
            showInHeader: tag.showInHeader,
            isHidden: tag.isHidden,
            backgroundColor: tag.backgroundColor,
            textColor: tag.textColor,
          });
        }
      }

      // Fetch comments for count
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_storyId_status", (q) =>
          q.eq("storyId", story._id).eq("status", "approved"),
        )
        .filter((q) => q.neq(q.field("isHidden"), true))
        .collect();
      const calculatedCommentsCount = comments.length;

      // Fetch votes for count
      const storyVotes = await ctx.db
        .query("votes")
        .withIndex("by_story", (q) => q.eq("storyId", story._id))
        .collect();
      const votesCount = storyVotes.length; // Actual number of vote documents

      // Fetch ratings for average
      const storyRatings = await ctx.db
        .query("storyRatings")
        .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
        .collect();
      const averageRating =
        storyRatings.length > 0
          ? parseFloat(
              (
                storyRatings.reduce((sum, r) => sum + r.value, 0) /
                storyRatings.length
              ).toFixed(1),
            )
          : 0;

      const voteScore = story.votes; // Assuming story.votes is the intended voteScore; if votesCount is preferred, change here.

      const author = story.userId ? usersMap.get(story.userId) : undefined;

      return {
        ...story,
        voteScore,
        screenshotUrl,
        additionalImageUrls,
        tags: processedStoryTags, // Use the new explicitly constructed array
        commentsCount: calculatedCommentsCount,
        authorName: author?.name,
        authorUsername: author?.username,
        authorImageUrl: author?.imageUrl,
        authorEmail: author?.email,
        averageRating,
        votesCount,
      };
    }),
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
  | "votes_year"
  | "votes_all";

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
        v.literal("votes_year"),
        v.literal("votes_all"),
      ),
    ),
    searchTerm: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    page: StoryWithDetails[];
    isDone: boolean;
    continueCursor: string;
  }> => {
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

    if (args.searchTerm && args.searchTerm.trim() !== "") {
      // Use full text search
      let query = ctx.db.query("stories").withSearchIndex("search_all", (q) => {
        let builder = q.search("title", args.searchTerm!);
        builder = builder.eq("status", "approved").eq("isHidden", false);
        return builder;
      });
      const stories = await query.collect();
      const storiesWithDetails = await fetchTagsAndCountsForStories(
        ctx,
        stories,
      );
      return {
        page: storiesWithDetails,
        isDone: true,
        continueCursor: "",
      };
    }

    let paginatedResult;
    let initialFilteredStories: Doc<"stories">[];

    if (args.sortPeriod?.startsWith("votes_")) {
      // For vote-based sorting with tagId, we need to collect all matching stories first
      if (args.tagId) {
        // Collect all stories matching the criteria
        const allStories = await ctx.db
          .query("stories")
          .withIndex("by_votes")
          .order("desc")
          .filter((q) =>
            q.and(
              q.eq(q.field("status"), "approved"),
              q.neq(q.field("isHidden"), true),
              q.gte(q.field("_creationTime"), startTime),
            ),
          )
          .collect();

        // Filter by tagId before pagination
        const tagFilteredStories = allStories.filter((story) =>
          (story.tagIds || []).includes(args.tagId!),
        );

        // Apply manual pagination
        const startIndex = args.paginationOpts.cursor
          ? parseInt(args.paginationOpts.cursor, 10)
          : 0;
        const endIndex = startIndex + args.paginationOpts.numItems;
        const pageStories = tagFilteredStories.slice(startIndex, endIndex);
        const isDone = endIndex >= tagFilteredStories.length;
        const continueCursor = isDone ? null : endIndex.toString();

        const storiesWithDetails = await fetchTagsAndCountsForStories(
          ctx,
          pageStories,
        );

        return {
          page: storiesWithDetails,
          isDone,
          continueCursor: continueCursor ?? "",
        };
      } else {
        // No tagId filter, use efficient pagination
        paginatedResult = await ctx.db
          .query("stories")
          .withIndex("by_votes")
          .order("desc")
          .filter((q) =>
            q.and(
              q.eq(q.field("status"), "approved"),
              q.neq(q.field("isHidden"), true),
              q.gte(q.field("_creationTime"), startTime),
            ),
          )
          .paginate(args.paginationOpts);

        const storiesWithDetails = await fetchTagsAndCountsForStories(
          ctx,
          paginatedResult.page,
        );

        return {
          page: storiesWithDetails,
          isDone: paginatedResult.isDone,
          continueCursor: paginatedResult.continueCursor,
        };
      }
    } else {
      // For time-based sorting (or 'all'), filter first, collect all matching, then sort manually for pinning, then paginate manually
      const baseQuery = ctx.db
        .query("stories")
        .filter((q) =>
          q.and(
            q.eq(q.field("status"), "approved"),
            q.neq(q.field("isHidden"), true),
            q.gte(q.field("_creationTime"), startTime),
          ),
        );
      initialFilteredStories = await baseQuery.collect();

      // Pre-filter by tagId if provided (BEFORE sorting and pagination)
      if (args.tagId) {
        initialFilteredStories = initialFilteredStories.filter((story) =>
          (story.tagIds || []).includes(args.tagId!),
        );
      }

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
      const startIndex = args.paginationOpts.cursor
        ? parseInt(args.paginationOpts.cursor, 10)
        : 0;
      const endIndex = startIndex + args.paginationOpts.numItems;
      const pageStories = initialFilteredStories.slice(startIndex, endIndex);
      const isDone = endIndex >= initialFilteredStories.length;
      const continueCursor = isDone ? null : endIndex.toString();

      let storiesWithDetails = await fetchTagsAndCountsForStories(
        ctx,
        pageStories,
      );

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
    args,
  ): Promise<{
    page: StoryWithDetails[];
    isDone: boolean;
    continueCursor: string;
  }> => {
    const query = ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc");

    const paginatedStories = await query.paginate(args.paginationOpts);
    const storiesWithDetails = await fetchTagsAndCountsForStories(
      ctx,
      paginatedStories.page,
    );

    return {
      ...paginatedStories,
      page: storiesWithDetails,
    };
  },
});

// Updated getBySlug to fetch tags and counts and add explicit returns validator
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(storyWithDetailsValidator, v.null()), // Explicit returns validator, uses StoryWithDetailsPublic implicitly
  handler: async (ctx, args): Promise<StoryWithDetailsPublic | null> => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.neq(q.field("isHidden"), true),
        ),
      )
      .unique();

    if (!story) {
      return null;
    }

    const storiesWithDetails = await fetchTagsAndCountsForStories(ctx, [story]);
    const storyWithDetails = storiesWithDetails[0];

    // Map StoryWithDetails to StoryWithDetailsPublic
    return {
      _id: storyWithDetails._id,
      _creationTime: storyWithDetails._creationTime,
      title: storyWithDetails.title,
      slug: storyWithDetails.slug,
      url: storyWithDetails.url,
      description: storyWithDetails.description,
      longDescription: storyWithDetails.longDescription,
      submitterName: storyWithDetails.submitterName,
      tagIds: storyWithDetails.tagIds,
      userId: storyWithDetails.userId,
      votes: storyWithDetails.votes,
      commentCount: storyWithDetails.commentCount,
      screenshotId: storyWithDetails.screenshotId,
      ratingSum: storyWithDetails.ratingSum,
      ratingCount: storyWithDetails.ratingCount,
      videoUrl: storyWithDetails.videoUrl,
      linkedinUrl: storyWithDetails.linkedinUrl,
      twitterUrl: storyWithDetails.twitterUrl,
      githubUrl: storyWithDetails.githubUrl,
      chefShowUrl: storyWithDetails.chefShowUrl,
      chefAppUrl: storyWithDetails.chefAppUrl,
      status: storyWithDetails.status,
      isHidden: storyWithDetails.isHidden,
      isPinned: storyWithDetails.isPinned,
      customMessage: storyWithDetails.customMessage,
      isApproved: storyWithDetails.isApproved,
      email: storyWithDetails.email,
      // Hackathon team info
      teamName: storyWithDetails.teamName,
      teamMemberCount: storyWithDetails.teamMemberCount,
      teamMembers: storyWithDetails.teamMembers,
      // Changelog for edit tracking
      changeLog: storyWithDetails.changeLog,
      // Mapped fields
      authorName: storyWithDetails.authorName,
      authorUsername: storyWithDetails.authorUsername,
      authorImageUrl: storyWithDetails.authorImageUrl,
      authorEmail: storyWithDetails.authorEmail,
      tags: storyWithDetails.tags,
      screenshotUrl: storyWithDetails.screenshotUrl,
      additionalImageUrls: storyWithDetails.additionalImageUrls,
      // Surface storage ids to allow precise owner edits of gallery
      additionalImageIds: storyWithDetails.additionalImageIds,
      voteScore: storyWithDetails.voteScore,
      averageRating: storyWithDetails.averageRating,
      commentsCount: storyWithDetails.commentsCount,
      votesCount: storyWithDetails.votesCount,
    };
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

// Helper function to generate a unique slug by checking for duplicates
async function generateUniqueSlug(ctx: any, title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();

    if (!existing) {
      return slug;
    }

    // If slug exists, try with incremental number
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export const submit = mutation({
  args: {
    title: v.string(),
    tagline: v.string(),
    longDescription: v.optional(v.string()),
    submitterName: v.optional(v.string()),
    url: v.string(),
    videoUrl: v.optional(v.string()),
    tagIds: v.array(v.id("tags")),
    newTagNames: v.array(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    additionalImageIds: v.optional(v.array(v.id("_storage"))),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
    chefAppUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    // Hackathon team info
    teamName: v.optional(v.string()),
    teamMemberCount: v.optional(v.number()),
    teamMembers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          email: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await ensureUserNotBanned(ctx); // Check if user is banned
    const userId = await getAuthenticatedUserId(ctx);
    const userRecord = await ctx.db.get(userId);

    // Validate additional images limit
    if (args.additionalImageIds && args.additionalImageIds.length > 4) {
      throw new Error("Maximum of 4 additional images allowed");
    }

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
          q, // IMPORTANT: This index needs to be added to submissionLogs in schema.ts
        ) => q.eq("userId", userId).gt("submissionTime", twentyFourHoursAgo),
      )
      .collect();

    if (recentSubmissions.length >= 20) {
      throw new Error(
        "Submission limit reached. You can submit up to 10 projects per day.",
      );
    }

    const slug = await generateUniqueSlug(ctx, args.title);

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
      longDescription: args.longDescription,
      submitterName: args.submitterName,
      tagIds: allTagIds,
      userId: userId,
      votes: 1,
      commentCount: 0,
      screenshotId: args.screenshotId,
      additionalImageIds: args.additionalImageIds,
      ratingSum: 0,
      ratingCount: 0,
      videoUrl: args.videoUrl,
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
      email: args.email,
      // Hackathon team info
      teamName: args.teamName,
      teamMemberCount: args.teamMemberCount,
      teamMembers: args.teamMembers,
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

// Anonymous submission mutation for /resend route
export const submitAnonymous = mutation({
  args: {
    title: v.string(),
    tagline: v.string(),
    longDescription: v.optional(v.string()),
    submitterName: v.string(), // Required for anonymous submissions
    url: v.string(),
    videoUrl: v.optional(v.string()),
    tagIds: v.array(v.id("tags")),
    newTagNames: v.array(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    additionalImageIds: v.optional(v.array(v.id("_storage"))),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
    chefAppUrl: v.optional(v.string()),
    email: v.string(), // Required for anonymous submissions
  },
  handler: async (ctx, args) => {
    // No authentication required for anonymous submissions

    // Validate additional images limit
    if (args.additionalImageIds && args.additionalImageIds.length > 4) {
      throw new Error("Maximum of 4 additional images allowed");
    }

    // Basic rate limiting by email - allow up to 10 submissions per day per email
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentSubmissions = await ctx.db
      .query("submissionLogs")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", undefined).gt("submissionTime", twentyFourHoursAgo),
      )
      .filter((q) => q.eq(q.field("submitterEmail"), args.email))
      .collect();

    if (recentSubmissions.length >= 10) {
      throw new Error(
        "Submission limit reached. You can submit up to 10 projects per day.",
      );
    }

    const slug = generateSlug(args.title);

    const existing = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      throw new Error(
        `Slug "${slug}" already exists for story: ${existing.title}`,
      );
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
      longDescription: args.longDescription,
      submitterName: args.submitterName,
      tagIds: allTagIds,
      userId: undefined, // No user ID for anonymous submissions
      votes: 1,
      commentCount: 0,
      screenshotId: args.screenshotId,
      additionalImageIds: args.additionalImageIds,
      ratingSum: 0,
      ratingCount: 0,
      videoUrl: args.videoUrl,
      linkedinUrl: args.linkedinUrl,
      twitterUrl: args.twitterUrl,
      githubUrl: args.githubUrl,
      chefShowUrl: args.chefShowUrl,
      chefAppUrl: args.chefAppUrl,
      status: "approved", // Anonymous submissions are auto-approved
      isHidden: false,
      isPinned: false,
      customMessage: undefined,
      isApproved: true,
      email: args.email,
    });

    // Log the anonymous submission
    await ctx.db.insert("submissionLogs", {
      submitterEmail: args.email,
      userId: undefined, // No user ID for anonymous submissions
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
    await ensureUserNotBanned(ctx); // Check if user is banned
    const userId = await getAuthenticatedUserId(ctx); // Ensure user is authenticated

    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    // Check if the user has already voted for this story
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_user_story", (q) =>
        q.eq("userId", userId).eq("storyId", args.storyId),
      )
      .first();

    if (existingVote) {
      // User has already voted, perhaps allow unvoting or just do nothing / throw error
      // For now, let's remove the vote (unvote action)
      await ctx.db.delete(existingVote._id);
      await ctx.db.patch(args.storyId, { votes: story.votes - 1 });
      return {
        success: true,
        action: "unvoted",
        newVoteCount: story.votes - 1,
      };
      // throw new Error("User has already voted for this story.");
    }

    // User hasn't voted, so add a vote
    await ctx.db.insert("votes", {
      userId: userId,
      storyId: args.storyId,
    });

    // Increment the vote count on the story
    await ctx.db.patch(args.storyId, { votes: story.votes + 1 });

    // Create alert for story owner (non-blocking)
    if (story.userId) {
      await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
        recipientUserId: story.userId,
        actorUserId: userId,
        type: "vote",
        storyId: args.storyId,
      });
    }

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
    await ensureUserNotBanned(ctx); // Check if user is banned
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
      .withIndex("by_user_story", (q) =>
        q.eq("userId", userId).eq("storyId", args.storyId),
      )
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

    // Create alert for story owner (non-blocking)
    if (story.userId) {
      await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
        recipientUserId: story.userId,
        actorUserId: userId,
        type: "rating",
        storyId: args.storyId,
        ratingValue: args.rating,
      });
    }

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
      .withIndex("by_user_story", (q) =>
        q.eq("userId", user._id).eq("storyId", args.storyId),
      )
      .first();

    return existingRating ? existingRating.value : null;
  },
});

// Mutation for updating story status (moderation)
export const updateStatus = mutation({
  args: {
    storyId: v.id("stories"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const existingStory = await ctx.db.get(args.storyId);
    if (!existingStory) {
      throw new Error("Story not found");
    }

    const updatePayload: Partial<Doc<"stories">> = { status: args.status };
    if (args.status === "rejected") {
      updatePayload.rejectionReason =
        args.rejectionReason || "No reason provided.";
    } else {
      // Clear rejection reason if moving to a non-rejected state
      updatePayload.rejectionReason = undefined;
    }

    await ctx.db.patch(args.storyId, updatePayload);
    return { success: true };
  },
});

// --- Admin/Moderation Mutations ---

export const hideStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.patch(args.storyId, { isHidden: true });
    return { success: true };
  },
});

export const showStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.patch(args.storyId, { isHidden: false });
    return { success: true };
  },
});

// Archive story - hides from default view but keeps accessible via filter
export const archiveStory = mutation({
  args: { storyId: v.id("stories") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.patch(args.storyId, { isArchived: true });
    return { success: true };
  },
});

// Unarchive story - returns to default view
export const unarchiveStory = mutation({
  args: { storyId: v.id("stories") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.patch(args.storyId, { isArchived: false });
    return { success: true };
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");

    // 1. Delete associated comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_storyId_status", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // 2. Delete associated votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // 3. Delete associated ratings
    const ratings = await ctx.db
      .query("storyRatings")
      .withIndex("by_storyId", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const rating of ratings) {
      await ctx.db.delete(rating._id);
    }

    // 4. Delete associated bookmarks
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_storyId", (q) => q.eq("storyId", args.storyId))
      .collect();
    for (const bookmark of bookmarks) {
      await ctx.db.delete(bookmark._id);
    }

    // 5. Delete screenshot from storage if it exists
    if (story.screenshotId) {
      try {
        await ctx.storage.delete(story.screenshotId);
      } catch (error) {
        console.warn(
          `Failed to delete screenshot ${story.screenshotId} for story ${args.storyId}: ${error}`,
        );
        // Continue even if screenshot deletion fails
      }
    }

    // 6. Delete additional images from storage if they exist
    if (story.additionalImageIds && story.additionalImageIds.length > 0) {
      for (const imageId of story.additionalImageIds) {
        try {
          await ctx.storage.delete(imageId);
        } catch (error) {
          console.warn(
            `Failed to delete additional image ${imageId} for story ${args.storyId}: ${error}`,
          );
          // Continue even if additional image deletion fails
        }
      }
    }

    // 7. Delete the story itself
    await ctx.db.delete(args.storyId);
    return { success: true };
  },
});

// NEW: Mutation to update custom message
export const updateStoryCustomMessage = mutation({
  args: {
    storyId: v.id("stories"),
    customMessage: v.optional(v.string()), // Pass undefined or empty string to clear
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.patch(args.storyId, {
      customMessage: args.customMessage || undefined, // Store empty string as undefined
    });

    // Notify author about admin custom message (non-blocking)
    const story = await ctx.db.get(args.storyId);
    if (
      story &&
      story.userId &&
      args.customMessage &&
      args.customMessage.trim().length > 0
    ) {
      await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
        recipientUserId: story.userId,
        actorUserId: undefined,
        type: "admin_message",
        storyId: args.storyId,
      });
    }
    return { success: true };
  },
});

// NEW: Mutation to toggle pin status
export const toggleStoryPinStatus = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    const newPinnedStatus = !story.isPinned;
    await ctx.db.patch(args.storyId, {
      isPinned: newPinnedStatus,
      // Track if story was ever pinned
      wasPinned: newPinnedStatus ? true : story.wasPinned,
    });

    // Notify author about pin status (non-blocking)
    if (story.userId) {
      await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
        recipientUserId: story.userId,
        actorUserId: undefined,
        type: "pinned",
        storyId: args.storyId,
      });
    }
    return { success: true, newPinStatus: !story.isPinned };
  },
});

// Admin mutation to add tags to a story
export const addTagsToStory = mutation({
  args: {
    storyId: v.id("stories"),
    tagIdsToAdd: v.array(v.id("tags")),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    // Validate that all tags exist
    for (const tagId of args.tagIdsToAdd) {
      const tag = await ctx.db.get(tagId);
      if (!tag) {
        throw new Error(`Tag with ID ${tagId} not found`);
      }
    }

    // Get current tags and merge with new ones (avoiding duplicates)
    const currentTagIds = story.tagIds || [];
    const newTagIds = [...new Set([...currentTagIds, ...args.tagIdsToAdd])];

    await ctx.db.patch(args.storyId, { tagIds: newTagIds });
    return { success: true, addedTags: args.tagIdsToAdd.length };
  },
});

// Admin mutation to remove tags from a story
export const removeTagsFromStory = mutation({
  args: {
    storyId: v.id("stories"),
    tagIdsToRemove: v.array(v.id("tags")),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    // Get current tags and filter out the ones to remove
    const currentTagIds = story.tagIds || [];
    const newTagIds = currentTagIds.filter(
      (tagId) => !args.tagIdsToRemove.includes(tagId),
    );

    await ctx.db.patch(args.storyId, { tagIds: newTagIds });
    return { success: true, removedTags: args.tagIdsToRemove.length };
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
      throw new Error(
        "User not authorized to delete this story. Only the owner can delete.",
      );
    }

    // If story has a screenshot, delete it from storage
    if (story.screenshotId) {
      try {
        await ctx.storage.delete(story.screenshotId);
      } catch (error) {
        console.error(
          `Failed to delete screenshot ${story.screenshotId} for story ${args.storyId}:`,
          error,
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

// Mutation to allow a user to update their own story
export const updateOwnStory = mutation({
  args: {
    storyId: v.id("stories"),
    title: v.optional(v.string()),
    description: v.optional(v.string()), // tagline
    longDescription: v.optional(v.string()),
    submitterName: v.optional(v.string()),
    url: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    additionalImageIds: v.optional(v.array(v.id("_storage"))),
    tagIds: v.optional(v.array(v.id("tags"))),
    newTagNames: v.optional(v.array(v.string())),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
    chefAppUrl: v.optional(v.string()),
    // Hackathon team info
    teamName: v.optional(v.string()),
    teamMemberCount: v.optional(v.number()),
    teamMembers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          email: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const story = await ctx.db.get(args.storyId);

    if (!story) {
      throw new Error("Story not found.");
    }

    // Validate additional images limit
    if (args.additionalImageIds && args.additionalImageIds.length > 4) {
      throw new Error("Maximum of 4 additional images allowed");
    }

    if (story.userId !== userId) {
      throw new Error(
        "User not authorized to edit this story. Only the owner can edit.",
      );
    }

    // Track changes for changelog
    const textChanges: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];
    const linkChanges: Array<{
      field: string;
      oldValue?: string;
      newValue?: string;
    }> = [];
    let videoChanged = false;
    let imagesChanged = false;

    // Track text changes
    if (args.title !== undefined && args.title !== story.title) {
      textChanges.push({
        field: "Title",
        oldValue: story.title,
        newValue: args.title,
      });
    }
    if (
      args.description !== undefined &&
      args.description !== story.description
    ) {
      textChanges.push({
        field: "Tagline",
        oldValue: story.description,
        newValue: args.description,
      });
    }
    if (
      args.longDescription !== undefined &&
      args.longDescription !== (story.longDescription || "")
    ) {
      textChanges.push({
        field: "Description",
        oldValue: story.longDescription || "",
        newValue: args.longDescription,
      });
    }
    if (
      args.submitterName !== undefined &&
      args.submitterName !== (story.submitterName || "")
    ) {
      textChanges.push({
        field: "Your Name",
        oldValue: story.submitterName || "",
        newValue: args.submitterName,
      });
    }

    // Track link changes
    if (args.url !== undefined && args.url !== story.url) {
      linkChanges.push({
        field: "App Website Link",
        oldValue: story.url,
        newValue: args.url,
      });
    }
    if (
      args.linkedinUrl !== undefined &&
      args.linkedinUrl !== (story.linkedinUrl || "")
    ) {
      linkChanges.push({
        field: "LinkedIn URL",
        oldValue: story.linkedinUrl || undefined,
        newValue: args.linkedinUrl || undefined,
      });
    }
    if (
      args.twitterUrl !== undefined &&
      args.twitterUrl !== (story.twitterUrl || "")
    ) {
      linkChanges.push({
        field: "Twitter/X URL",
        oldValue: story.twitterUrl || undefined,
        newValue: args.twitterUrl || undefined,
      });
    }
    if (
      args.githubUrl !== undefined &&
      args.githubUrl !== (story.githubUrl || "")
    ) {
      linkChanges.push({
        field: "GitHub URL",
        oldValue: story.githubUrl || undefined,
        newValue: args.githubUrl || undefined,
      });
    }
    if (
      args.chefShowUrl !== undefined &&
      args.chefShowUrl !== (story.chefShowUrl || "")
    ) {
      linkChanges.push({
        field: "Chef Show URL",
        oldValue: story.chefShowUrl || undefined,
        newValue: args.chefShowUrl || undefined,
      });
    }
    if (
      args.chefAppUrl !== undefined &&
      args.chefAppUrl !== (story.chefAppUrl || "")
    ) {
      linkChanges.push({
        field: "Chef App URL",
        oldValue: story.chefAppUrl || undefined,
        newValue: args.chefAppUrl || undefined,
      });
    }

    // Track video changes
    if (
      args.videoUrl !== undefined &&
      args.videoUrl !== (story.videoUrl || "")
    ) {
      videoChanged = true;
    }

    // Track image changes
    if (
      args.screenshotId !== undefined &&
      args.screenshotId !== story.screenshotId
    ) {
      imagesChanged = true;
    }
    if (
      args.additionalImageIds !== undefined &&
      JSON.stringify(args.additionalImageIds) !==
        JSON.stringify(story.additionalImageIds || [])
    ) {
      imagesChanged = true;
    }

    // Handle new tags if provided
    let finalTagIds = args.tagIds;
    if (args.newTagNames && args.newTagNames.length > 0) {
      const newCreatedTagIds = await ctx.runMutation(internal.tags.ensureTags, {
        tagNames: args.newTagNames,
      });
      finalTagIds = finalTagIds
        ? [...new Set([...finalTagIds, ...newCreatedTagIds])]
        : [...newCreatedTagIds];
    }

    // Validate tags if provided
    if (finalTagIds && finalTagIds.length > 0) {
      for (const tagId of finalTagIds) {
        const tag = await ctx.db.get(tagId);
        if (!tag) {
          console.warn(`Tag with ID ${tagId} not found during update.`);
          finalTagIds = finalTagIds.filter((id) => id !== tagId);
        }
      }

      if (finalTagIds.length === 0) {
        throw new Error("At least one valid tag is required.");
      }
    }

    // Track tag changes
    let tagChanges: { added: string[]; removed: string[] } | undefined =
      undefined;
    if (finalTagIds !== undefined) {
      const oldTagIds = story.tagIds || [];
      const addedTagIds = finalTagIds.filter((id) => !oldTagIds.includes(id));
      const removedTagIds = oldTagIds.filter((id) => !finalTagIds.includes(id));

      if (addedTagIds.length > 0 || removedTagIds.length > 0) {
        const addedTags = await Promise.all(
          addedTagIds.map(async (id) => {
            const tag = await ctx.db.get(id);
            return tag?.name || "Unknown Tag";
          }),
        );
        const removedTags = await Promise.all(
          removedTagIds.map(async (id) => {
            const tag = await ctx.db.get(id);
            return tag?.name || "Unknown Tag";
          }),
        );
        tagChanges = { added: addedTags, removed: removedTags };
      }
    }

    // Build update object with only provided fields
    const updateData: Partial<Doc<"stories">> = {};

    if (args.title !== undefined) updateData.title = args.title;
    if (args.description !== undefined)
      updateData.description = args.description;
    if (args.longDescription !== undefined)
      updateData.longDescription = args.longDescription;
    if (args.submitterName !== undefined)
      updateData.submitterName = args.submitterName;
    if (args.url !== undefined) updateData.url = args.url;
    if (args.videoUrl !== undefined) updateData.videoUrl = args.videoUrl;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.screenshotId !== undefined)
      updateData.screenshotId = args.screenshotId;
    if (args.additionalImageIds !== undefined)
      updateData.additionalImageIds = args.additionalImageIds;
    if (finalTagIds !== undefined) updateData.tagIds = finalTagIds;
    if (args.linkedinUrl !== undefined)
      updateData.linkedinUrl = args.linkedinUrl;
    if (args.twitterUrl !== undefined) updateData.twitterUrl = args.twitterUrl;
    if (args.githubUrl !== undefined) updateData.githubUrl = args.githubUrl;
    if (args.chefShowUrl !== undefined)
      updateData.chefShowUrl = args.chefShowUrl;
    if (args.chefAppUrl !== undefined) updateData.chefAppUrl = args.chefAppUrl;

    // Handle team info
    if (args.teamName !== undefined) updateData.teamName = args.teamName;
    if (args.teamMemberCount !== undefined)
      updateData.teamMemberCount = args.teamMemberCount;
    if (args.teamMembers !== undefined)
      updateData.teamMembers = args.teamMembers;

    // Update slug if title changed
    if (args.title && args.title !== story.title) {
      const newSlug = await generateUniqueSlug(ctx, args.title);
      updateData.slug = newSlug;
    }

    // Add changelog entry if there are changes
    if (
      textChanges.length > 0 ||
      linkChanges.length > 0 ||
      tagChanges ||
      videoChanged ||
      imagesChanged
    ) {
      const changeLogEntry = {
        timestamp: Date.now(),
        ...(textChanges.length > 0 && { textChanges }),
        ...(linkChanges.length > 0 && { linkChanges }),
        ...(tagChanges && { tagChanges }),
        ...(videoChanged && { videoChanged: true }),
        ...(imagesChanged && { imagesChanged: true }),
      };

      const existingChangeLog = story.changeLog || [];
      updateData.changeLog = [...existingChangeLog, changeLogEntry];
    }

    await ctx.db.patch(args.storyId, updateData);
    return { success: true, slug: updateData.slug || story.slug };
  },
});

// Mutation to allow an admin to update any story
export const updateStoryAdmin = mutation({
  args: {
    storyId: v.id("stories"),
    title: v.optional(v.string()),
    description: v.optional(v.string()), // tagline
    longDescription: v.optional(v.string()),
    submitterName: v.optional(v.string()),
    url: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    removeScreenshot: v.optional(v.boolean()), // Add this line
    additionalImageIds: v.optional(v.array(v.id("_storage"))),
    removeAdditionalImages: v.optional(v.boolean()),
    tagIds: v.optional(v.array(v.id("tags"))),
    newTagNames: v.optional(v.array(v.string())),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
    chefAppUrl: v.optional(v.string()),
    // Hackathon team info
    teamName: v.optional(v.string()),
    teamMemberCount: v.optional(v.number()),
    teamMembers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          email: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    // Require admin role
    await requireAdminRole(ctx);

    const story = await ctx.db.get(args.storyId);

    if (!story) {
      throw new Error("Story not found.");
    }

    // Validate additional images limit
    if (args.additionalImageIds && args.additionalImageIds.length > 4) {
      throw new Error("Maximum of 4 additional images allowed");
    }

    // Handle new tags if provided
    let finalTagIds = args.tagIds;
    if (args.newTagNames && args.newTagNames.length > 0) {
      const newCreatedTagIds = await ctx.runMutation(internal.tags.ensureTags, {
        tagNames: args.newTagNames,
      });
      finalTagIds = finalTagIds
        ? [...new Set([...finalTagIds, ...newCreatedTagIds])]
        : [...newCreatedTagIds];
    }

    // Validate tags if provided
    if (finalTagIds && finalTagIds.length > 0) {
      for (const tagId of finalTagIds) {
        const tag = await ctx.db.get(tagId);
        if (!tag) {
          console.warn(`Tag with ID ${tagId} not found during update.`);
          finalTagIds = finalTagIds.filter((id) => id !== tagId);
        }
      }

      if (finalTagIds.length === 0) {
        throw new Error("At least one valid tag is required.");
      }
    }

    // Build update object with only provided fields
    const updateData: Partial<Doc<"stories">> = {};

    if (args.title !== undefined) updateData.title = args.title;
    if (args.description !== undefined)
      updateData.description = args.description;
    if (args.longDescription !== undefined)
      updateData.longDescription = args.longDescription;
    if (args.submitterName !== undefined)
      updateData.submitterName = args.submitterName;
    if (args.url !== undefined) updateData.url = args.url;
    if (args.videoUrl !== undefined) updateData.videoUrl = args.videoUrl;
    if (args.email !== undefined) updateData.email = args.email;

    // Handle screenshot removal or update
    if (args.removeScreenshot) {
      updateData.screenshotId = undefined;
    } else if (args.screenshotId !== undefined) {
      updateData.screenshotId = args.screenshotId;
    }

    // Handle additional images removal or update
    if (args.removeAdditionalImages) {
      updateData.additionalImageIds = undefined;
    } else if (args.additionalImageIds !== undefined) {
      updateData.additionalImageIds = args.additionalImageIds;
    }

    if (finalTagIds !== undefined) updateData.tagIds = finalTagIds;
    if (args.linkedinUrl !== undefined)
      updateData.linkedinUrl = args.linkedinUrl;
    if (args.twitterUrl !== undefined) updateData.twitterUrl = args.twitterUrl;
    if (args.githubUrl !== undefined) updateData.githubUrl = args.githubUrl;
    if (args.chefShowUrl !== undefined)
      updateData.chefShowUrl = args.chefShowUrl;
    if (args.chefAppUrl !== undefined) updateData.chefAppUrl = args.chefAppUrl;

    // Handle team info
    if (args.teamName !== undefined) updateData.teamName = args.teamName;
    if (args.teamMemberCount !== undefined)
      updateData.teamMemberCount = args.teamMemberCount;
    if (args.teamMembers !== undefined)
      updateData.teamMembers = args.teamMembers;

    // Update slug if title changed
    if (args.title && args.title !== story.title) {
      const newSlug = generateSlug(args.title);
      const existingWithSlug = await ctx.db
        .query("stories")
        .withIndex("by_slug", (q) => q.eq("slug", newSlug))
        .filter((q) => q.neq(q.field("_id"), args.storyId))
        .first();

      if (existingWithSlug) {
        throw new Error(`Slug "${newSlug}" already exists for another story.`);
      }

      updateData.slug = newSlug;
    }

    await ctx.db.patch(args.storyId, updateData);
    return { success: true, slug: updateData.slug || story.slug };
  },
});

// Updated query to list ALL stories for admin, sorting manually for pinning
export const listAllStoriesAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filters: v.object({
      status: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
      ),
      isHidden: v.optional(v.boolean()),
      isArchived: v.optional(v.boolean()), // Filter archived stories
      tagIds: v.optional(v.array(v.id("tags"))), // Add tag filtering
      startDate: v.optional(v.number()), // Timestamp for date range start
      endDate: v.optional(v.number()), // Timestamp for date range end
      hasMessage: v.optional(v.boolean()), // Filter stories with admin message
      isPinned: v.optional(v.boolean()), // Filter currently pinned stories
      wasPinned: v.optional(v.boolean()), // Filter stories that were ever pinned
      judgingGroupId: v.optional(v.id("judgingGroups")), // Filter by judging group
    }),
    searchTerm: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    page: StoryWithDetails[];
    isDone: boolean;
    continueCursor: string;
  }> => {
    await requireAdminRole(ctx);
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
      if (
        args.filters.status &&
        !initialStories.every((s) => s.status === args.filters.status)
      ) {
        initialStories = initialStories.filter(
          (s) => s.status === args.filters.status,
        );
      }
      if (
        args.filters.isHidden !== undefined &&
        !initialStories.every((s) => s.isHidden === args.filters.isHidden)
      ) {
        initialStories = initialStories.filter(
          (s) => s.isHidden === args.filters.isHidden,
        );
      }
      // Apply isArchived filter - only when explicitly true (viewing archived)
      if (args.filters.isArchived === true) {
        initialStories = initialStories.filter((s) => s.isArchived === true);
      } else {
        // For all other views, exclude archived submissions
        initialStories = initialStories.filter((s) => s.isArchived !== true);
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

      // Apply isArchived filter - only when explicitly true (viewing archived)
      if (args.filters.isArchived === true) {
        initialStories = initialStories.filter((s) => s.isArchived === true);
      } else {
        // For all other views, exclude archived submissions
        initialStories = initialStories.filter((s) => s.isArchived !== true);
      }
    }

    // Apply tag filtering if specified
    if (args.filters.tagIds && args.filters.tagIds.length > 0) {
      initialStories = initialStories.filter((story) => {
        if (!story.tagIds || story.tagIds.length === 0) {
          return false;
        }
        // Check if story has at least one of the specified tags
        return args.filters.tagIds!.some((tagId) =>
          story.tagIds!.includes(tagId),
        );
      });
    }

    // Apply date range filtering if specified
    if (
      args.filters.startDate !== undefined ||
      args.filters.endDate !== undefined
    ) {
      initialStories = initialStories.filter((story) => {
        if (
          args.filters.startDate !== undefined &&
          story._creationTime < args.filters.startDate
        ) {
          return false;
        }
        if (
          args.filters.endDate !== undefined &&
          story._creationTime > args.filters.endDate
        ) {
          return false;
        }
        return true;
      });
    }

    // Apply hasMessage filter - stories with custom admin message
    if (args.filters.hasMessage) {
      initialStories = initialStories.filter(
        (story) => story.customMessage && story.customMessage.trim() !== "",
      );
    }

    // Apply isPinned filter - currently pinned stories
    if (args.filters.isPinned) {
      initialStories = initialStories.filter(
        (story) => story.isPinned === true,
      );
    }

    // Apply wasPinned filter - stories that were ever pinned
    if (args.filters.wasPinned) {
      initialStories = initialStories.filter(
        (story) => story.wasPinned === true,
      );
    }

    // Apply judging group filter - stories in specific judging group
    if (args.filters.judgingGroupId) {
      const groupSubmissions = await ctx.db
        .query("judgingGroupSubmissions")
        .withIndex("by_groupId", (q) =>
          q.eq("groupId", args.filters.judgingGroupId!),
        )
        .collect();
      const storyIdsInGroup = new Set(
        groupSubmissions.map((sub) => sub.storyId),
      );
      initialStories = initialStories.filter((story) =>
        storyIdsInGroup.has(story._id),
      );
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
    const startIndex = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor, 10)
      : 0;
    if (isNaN(startIndex) || startIndex < 0) {
      throw new Error("Invalid pagination cursor");
    }
    const endIndex = startIndex + args.paginationOpts.numItems;
    const pageStories = initialStories.slice(startIndex, endIndex);

    const isDone = endIndex >= initialStories.length;
    const continueCursor = isDone ? null : endIndex.toString();

    // Fetch additional details for the paginated subset
    const storiesWithDetails = await fetchTagsAndCountsForStories(
      ctx,
      pageStories,
    );

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
  returns: v.array(storyWithDetailsValidator),
  handler: async (ctx, args): Promise<StoryWithDetailsPublic[]> => {
    const results: StoryWithDetailsPublic[] = [];
    if (args.storyIds.length === 0) {
      return [];
    }

    // Fetch base story docs
    const stories = await Promise.all(
      args.storyIds.map((id) => ctx.db.get(id)),
    );
    const validStories = stories.filter(Boolean) as Doc<"stories">[];
    if (validStories.length === 0) {
      return [];
    }

    // Enrich stories with tags, counts, author details using the helper
    // fetchTagsAndCountsForStories returns Promise<StoryWithDetails[]> (local type)
    // We need to ensure the object constructed matches StoryWithDetailsPublic
    const enrichedStories = await fetchTagsAndCountsForStories(
      ctx,
      validStories,
    );

    for (const story of enrichedStories) {
      // story is now of type StoryWithDetails (local, enriched type)
      // We need to map it to StoryWithDetailsPublic
      results.push({
        // Spread common fields from Doc<"stories">
        _id: story._id,
        _creationTime: story._creationTime,
        title: story.title,
        slug: story.slug,
        url: story.url,
        description: story.description,
        longDescription: story.longDescription,
        submitterName: story.submitterName,
        tagIds: story.tagIds,
        userId: story.userId,
        votes: story.votes,
        commentCount: story.commentCount,
        screenshotId: story.screenshotId,
        ratingSum: story.ratingSum,
        ratingCount: story.ratingCount,
        videoUrl: story.videoUrl,
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

        // Joined and calculated data, ensuring alignment with StoryWithDetailsPublic
        authorName: story.authorName,
        authorUsername: story.authorUsername,
        authorImageUrl: story.authorImageUrl,
        authorEmail: story.authorEmail,
        tags: story.tags,
        screenshotUrl: story.screenshotUrl,
        additionalImageUrls: story.additionalImageUrls,
        additionalImageIds: story.additionalImageIds,
        voteScore: story.voteScore,
        averageRating: story.averageRating,
        commentsCount: story.commentsCount,
        votesCount: story.votesCount,
        _score: undefined,
      });
    }
    return results;
  },
});

/**
 * Submit story via dynamic form (supports custom field mapping)
 */
export const submitDynamic = mutation({
  args: {
    formData: v.record(v.string(), v.string()),
    customHiddenTag: v.string(),
    screenshotId: v.optional(v.id("_storage")),
  },
  returns: v.id("stories"),
  handler: async (ctx, args) => {
    const { formData, customHiddenTag, screenshotId } = args;

    // Check if user is authenticated
    const userId = await getAuthenticatedUserId(ctx);
    const userRecord = userId ? await ctx.db.get(userId) : null;

    // Extract required fields from formData
    const title = formData.title;
    const description = formData.tagline || formData.description;
    const url = formData.url;
    const email = formData.email;
    const submitterName = formData.submitterName;

    if (!title || !description || !url) {
      throw new Error("Title, description, and URL are required fields.");
    }

    // For anonymous submissions, require email and submitter name
    if (!userId && (!email || !submitterName)) {
      throw new Error(
        "Email and submitter name are required for anonymous submissions.",
      );
    }

    // Check submission limit if anonymous
    if (!userId && email) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const existingSubmissions = await ctx.db
        .query("stories")
        .filter((q) => q.eq(q.field("email"), email))
        .filter((q) => q.gte(q.field("_creationTime"), dayStart.getTime()))
        .collect();

      if (existingSubmissions.length >= 10) {
        throw new Error(
          "Submission limit reached. You can submit up to 10 projects per day.",
        );
      }
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(
        "Invalid URL format. Please enter a valid URL (e.g., https://example.com)",
      );
    }

    const slug = generateSlug(title);

    // Find the tag ID for the custom hidden tag
    const tag = await ctx.db
      .query("tags")
      .filter((q) => q.eq(q.field("name"), customHiddenTag))
      .first();

    const tagIds = tag ? [tag._id] : [];

    // Build story object with available form data
    const storyData: any = {
      title,
      description,
      url,
      slug,
      tagIds,
      votes: 0,
      commentCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      status: "pending" as const,
      isHidden: false,
      isPinned: false,
    };

    // Add optional fields if they exist in formData
    if (formData.longDescription)
      storyData.longDescription = formData.longDescription;
    if (formData.videoUrl) storyData.videoUrl = formData.videoUrl;
    if (formData.linkedinUrl) storyData.linkedinUrl = formData.linkedinUrl;
    if (formData.twitterUrl) storyData.twitterUrl = formData.twitterUrl;
    if (formData.githubUrl) storyData.githubUrl = formData.githubUrl;
    if (formData.chefShowUrl) storyData.chefShowUrl = formData.chefShowUrl;
    if (formData.chefAppUrl) storyData.chefAppUrl = formData.chefAppUrl;
    if (screenshotId) storyData.screenshotId = screenshotId;

    // Set submitter info
    if (userId && userRecord) {
      storyData.userId = userId;
      storyData.submitterName =
        submitterName || userRecord.username || "Anonymous";
      storyData.email = userRecord.email || "unknown@example.com";
    } else {
      storyData.submitterName = submitterName;
      storyData.email = email;
    }

    const storyId = await ctx.db.insert("stories", storyData);
    return storyId;
  },
});

// Example of a public query to list stories (e.g., for the homepage)
export const listApprovedStoriesWithDetails = query({
  args: { paginationOpts: v.optional(v.any()) },
  returns: v.array(storyWithDetailsValidator), // Validator for return shape
  handler: async (ctx, args): Promise<StoryWithDetailsPublic[]> => {
    const approvedStories = await ctx.db
      .query("stories")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("isHidden"), false),
        ),
      )
      .order("desc")
      .collect();

    if (approvedStories.length === 0) {
      return [];
    }

    const storyIds = approvedStories.map((s) => s._id);

    const detailedStories: StoryWithDetailsPublic[] = await ctx.runQuery(
      internal.stories._getStoryDetailsBatch,
      { storyIds },
    );

    return detailedStories;
  },
});

// Return type for leaderboard stories - simplified for the component
export const leaderboardStoryValidator = v.object({
  _id: v.id("stories"),
  title: v.string(),
  slug: v.string(),
  votes: v.number(),
  authorUsername: v.optional(v.string()),
  authorName: v.optional(v.string()),
  // Add _creationTime if you plan to display it
});
export type LeaderboardStory = Infer<typeof leaderboardStoryValidator>;

export const getWeeklyLeaderboardStories = query({
  args: {
    limit: v.number(),
  },
  // Using a simpler return type for the leaderboard
  returns: v.array(leaderboardStoryValidator),
  handler: async (ctx, args) => {
    // Fetch approved, visible stories ordered by votes
    const allTopStories = await ctx.db
      .query("stories")
      .withIndex(
        "by_status_isHidden_votes",
        (q) => q.eq("status", "approved").eq("isHidden", false), // Assuming false means visible
      )
      .order("desc") // Orders by 'votes' descending
      .collect();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recentTopStoriesRaw = allTopStories
      .filter((story) => story._creationTime > sevenDaysAgo)
      .slice(0, args.limit);

    // Fetch author details for these stories
    const storiesToReturn: LeaderboardStory[] = [];
    for (const story of recentTopStoriesRaw) {
      let authorUsername: string | undefined = undefined;
      let authorName: string | undefined = undefined;
      if (story.userId) {
        const author = await ctx.db.get(story.userId);
        authorUsername = author?.username;
        authorName = author?.name;
      }
      storiesToReturn.push({
        _id: story._id,
        title: story.title,
        slug: story.slug,
        votes: story.votes,
        authorUsername: authorUsername,
        authorName: authorName,
      });
    }
    return storiesToReturn;
  },
});

export const getRelatedStoriesByTags = query({
  args: {
    currentStoryId: v.id("stories"),
    tagIds: v.array(v.id("tags")),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.tagIds.length === 0) {
      return [];
    }

    // This initial fetch of all stories is not scalable for large datasets.
    // Consider a more optimized approach with join tables or search indexes for production.
    const allStories = await ctx.db
      .query("stories")
      // .withIndex("by_status_votes", q => q.eq("status", "approved")) // Example: if you have a combined index
      .filter((q) => q.eq(q.field("status"), "approved")) // Filter for approved stories first
      .order("desc") // This will use the default _creationTime or you need a specific index like by_votes
      .collect();

    const relatedStories = allStories
      .filter(
        (story) =>
          story._id !== args.currentStoryId &&
          story.tagIds?.some((tagId) => args.tagIds.includes(tagId)),
      )
      .sort((a, b) => {
        const voteDiff = (b.votes ?? 0) - (a.votes ?? 0);
        if (voteDiff !== 0) return voteDiff;
        // Assuming 'commentCount' exists on the story document
        const commentCountDiff = (b.commentCount ?? 0) - (a.commentCount ?? 0);
        if (commentCountDiff !== 0) return commentCountDiff;
        return b._creationTime - a._creationTime;
      })
      .slice(0, args.limit);

    const enrichedStories = await Promise.all(
      relatedStories.map(async (story) => {
        let authorUsername: string | null = null;
        let authorName: string | null = null;
        if (story.userId) {
          // Ensure userId is correctly typed. It should be Id<"users">
          const author = await ctx.db.get(story.userId as Id<"users">);
          if (author) {
            authorUsername = author.username || null;
            authorName = author.name || null;
          }
        }

        const resolvedTags = story.tagIds
          ? await Promise.all(
              story.tagIds.map((tagId) => ctx.db.get(tagId as Id<"tags">)),
            )
          : [];

        // Resolve screenshot URL from storage
        const screenshotUrl = story.screenshotId
          ? await ctx.storage.getUrl(story.screenshotId)
          : null;

        // Resolve additional image URLs
        const additionalImageUrls = story.additionalImageIds
          ? await Promise.all(
              story.additionalImageIds.map(async (imageId) => {
                const url = await ctx.storage.getUrl(imageId);
                return url || "";
              }),
            ).then((urls) => urls.filter((url) => url !== ""))
          : [];

        return {
          ...story,
          authorUsername,
          authorName,
          tags: resolvedTags.filter((tag) => tag !== null) as Doc<"tags">[],
          screenshotUrl,
          additionalImageUrls,
        };
      }),
    );

    return enrichedStories;
  },
});

// Query to get count of approved stories for a specific tag
export const getApprovedCountByTag = query({
  args: {
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
        v.literal("votes_year"),
        v.literal("votes_all"),
      ),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
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

    // Filter stories with the same criteria as listApproved
    const baseQuery = ctx.db
      .query("stories")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.neq(q.field("isHidden"), true),
          q.gte(q.field("_creationTime"), startTime),
        ),
      );

    const stories = await baseQuery.collect();

    // Filter by tagId if provided
    if (args.tagId) {
      const filteredStories = stories.filter((story) =>
        (story.tagIds || []).includes(args.tagId!),
      );
      return filteredStories.length;
    }

    return stories.length;
  },
});

/**
 * Get basic story information by ID for notifications and other features
 */
export const getById = query({
  args: { id: v.id("stories") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      url: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.id);

    if (!story || story.isHidden || story.status !== "approved") {
      return null;
    }

    return {
      _id: story._id,
      title: story.title,
      slug: story.slug,
      url: story.url,
    };
  },
});

/**
 * Internal query to get basic story information by ID (for actions)
 */
export const getStoryById = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      url: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);

    if (!story) {
      return null;
    }

    return {
      _id: story._id,
      title: story.title,
      slug: story.slug,
      url: story.url,
    };
  },
});

// Internal query for fetching story metadata optimized for social sharing
export const getStoryMetadata = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      title: v.string(),
      description: v.string(),
      screenshotUrl: v.union(v.string(), v.null()),
      slug: v.string(),
      url: v.string(),
      authorName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.neq(q.field("isHidden"), true),
        ),
      )
      .unique();

    if (!story) return null;

    // Resolve screenshot URL (main image for social sharing)
    const screenshotUrl = story.screenshotId
      ? await ctx.storage.getUrl(story.screenshotId)
      : null;

    // Get author info if available
    let authorName: string | undefined = undefined;
    if (story.userId) {
      const author = await ctx.db.get(story.userId);
      authorName = author?.name || story.submitterName;
    } else {
      authorName = story.submitterName;
    }

    return {
      title: story.title,
      description: story.description,
      screenshotUrl,
      slug: story.slug,
      url: story.url,
      authorName,
    };
  },
});
