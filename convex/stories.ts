import { query, mutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id, DataModel } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { GenericDatabaseReader, StorageReader } from "convex/server";

// Extend the Doc type for Story to include calculated fields and tags
export type StoryWithDetails = Doc<"stories"> & {
  voteScore: number; // Optional: if we want to calculate a score based on votes and time
  screenshotUrl: string | null;
  tags: Doc<"tags">[]; // Include full tag documents
  commentCount: number; // Ensure commentCount is part of the type
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

      return {
        ...story,
        voteScore,
        screenshotUrl,
        tags: storyTags,
        commentCount,
      };
    })
  );
};

// Define SortPeriod type
type SortPeriod = "today" | "week" | "month" | "year" | "all";

// Updated listApproved query to sort by pinned status first
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
        v.literal("all")
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

    const initialFilteredStories = await ctx.db
      .query("stories")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.neq(q.field("isHidden"), true),
          q.gte(q.field("_creationTime"), startTime)
        )
      )
      .collect();

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

    if (args.tagId) {
      console.warn("Filtering by tagId after fetching isn't efficient...");
      storiesWithDetails = storiesWithDetails.filter((story) =>
        (story.tagIds || []).includes(args.tagId!)
      );
    }

    return {
      page: storiesWithDetails,
      isDone,
      continueCursor: continueCursor ?? "",
    };
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
      .withIndex("by_status_creationTime", (q) => q.eq("status", "pending"))
      .order("asc");

    const paginatedStories = await query.paginate(args.paginationOpts);
    const storiesWithDetails = await fetchTagsAndCountsForStories(ctx, paginatedStories.page);

    return {
      ...paginatedStories,
      page: storiesWithDetails,
    };
  },
});

// Updated getBySlug to fetch tags and counts
export const getBySlug = query({
  args: { slug: v.string() },
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
    newTagNames: v.optional(v.array(v.string())),
    name: v.string(),
    email: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Rate Limiting Check
    if (args.email) {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentSubmissions = await ctx.db
        .query("submissionLogs")
        .withIndex("by_email_time", (q) =>
          q.eq("submitterEmail", args.email!).gt("submissionTime", twentyFourHoursAgo)
        )
        .collect();

      if (recentSubmissions.length >= 10) {
        throw new Error("Submission limit reached. You can submit up to 10 projects per day.");
      }
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
      name: args.name,
      email: args.email,
      votes: 1,
      commentCount: 0,
      screenshotId: args.screenshotId,
      ratingSum: 0,
      ratingCount: 0,
      linkedinUrl: args.linkedinUrl,
      twitterUrl: args.twitterUrl,
      githubUrl: args.githubUrl,
      chefShowUrl: args.chefShowUrl,
      status: "approved",
      isHidden: false,
      isPinned: false,
      customMessage: undefined,
    });

    // Log the submission if email was provided
    if (args.email) {
      await ctx.db.insert("submissionLogs", {
        submitterEmail: args.email,
        submissionTime: Date.now(),
      });
    }

    return { storyId, slug };
  },
});

// Mutation to generate upload URL for screenshots
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// vote remains the same
export const vote = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, { votes: story.votes + 1 });
  },
});

// rate remains the same
export const rate = mutation({
  args: {
    storyId: v.id("stories"),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    if (args.rating < 1 || args.rating > 5) throw new Error("Rating must be between 1 and 5");
    await ctx.db.patch(args.storyId, {
      ratingSum: story.ratingSum + args.rating,
      ratingCount: story.ratingCount + 1,
    });
  },
});

// Mutation for updating story status (moderation)
export const updateStatus = mutation({
  args: {
    storyId: v.id("stories"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    // TODO: Add admin auth check
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, { status: args.status });
  },
});

// --- Admin/Moderation Mutations ---

export const hideStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    // TODO: Add admin auth check
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, { isHidden: true });
  },
});

export const showStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    // TODO: Add admin auth check
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, { isHidden: false });
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    // TODO: Add admin auth check
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
    // TODO: Add admin auth check
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
    // TODO: Add admin auth check
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    await ctx.db.patch(args.storyId, {
      isPinned: !story.isPinned,
    });
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
    // TODO: Add admin auth check

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
