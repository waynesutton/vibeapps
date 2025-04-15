import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";

// Extend the Doc type for Story to include calculated fields and tags
export type StoryWithDetails = Doc<"stories"> & {
  voteScore: number; // Optional: if we want to calculate a score based on votes and time
  screenshotUrl: string | null;
  tags: Doc<"tags">[]; // Include full tag documents
};

// Helper to fetch tags for a list of stories
const fetchTagsForStories = async (
  ctx: any, // Using 'any' for simplicity, replace with proper context type
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
      const voteScore = story.votes; // Simple example
      const storyTags = (story.tagIds || [])
        .map((id) => tagsMap.get(id))
        .filter(Boolean) as Doc<"tags">[];

      return {
        ...story,
        voteScore,
        screenshotUrl,
        tags: storyTags,
      };
    })
  );
};

// Define SortPeriod type (can be shared or defined here)
type SortPeriod = "today" | "week" | "month" | "year" | "all";

export const listApproved = query({
  args: {
    paginationOpts: paginationOptsValidator,
    tagId: v.optional(v.id("tags")), // Filter by tag ID
    sortPeriod: v.optional(
      v.union(
        v.literal("today"),
        v.literal("week"),
        v.literal("month"),
        v.literal("year"),
        v.literal("all")
      )
    ), // Add sort period argument
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
        startTime = now - 30 * 24 * 60 * 60 * 1000; // Approx month
        break;
      case "year":
        startTime = now - 365 * 24 * 60 * 60 * 1000; // Approx year
        break;
      case "all":
      default:
        startTime = 0; // No time filter
        break;
    }

    let query = ctx.db
      .query("stories")
      // Use the new index for status filtering primarily
      .withIndex("by_status_creationTime", (q) => q.eq("status", "approved"))
      // Apply time filtering and isHidden check using .filter()
      .filter((q) =>
        q.and(q.neq(q.field("isHidden"), true), q.gte(q.field("_creationTime"), startTime))
      );

    // Apply tag filtering if needed (inefficient without proper index)
    if (args.tagId) {
      console.warn("Filtering by tagId directly in query isn't efficient...");
      // This filter will likely happen in memory after fetching, which is inefficient
      // A better approach involves schema changes or search indexes.
    }

    // Order by creation time, newest first
    const paginatedStories = await query.order("desc").paginate(args.paginationOpts);

    // Fetch tags and screenshot URLs
    let storiesWithDetails = await fetchTagsForStories(ctx, paginatedStories.page);

    // Manual filtering for tagId if present (inefficient)
    if (args.tagId) {
      storiesWithDetails = storiesWithDetails.filter((story) => story.tagIds.includes(args.tagId!));
      // Note: This post-filtering means the page might contain fewer items
      // than paginationOpts.numItems requested.
    }

    return {
      ...paginatedStories,
      page: storiesWithDetails,
    };
  },
});

// Query to list stories pending moderation (for admin)
export const listPending = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (
    ctx,
    args
  ): Promise<{ page: StoryWithDetails[]; isDone: boolean; continueCursor: string }> => {
    // TODO: Add authentication check - only admins should access pending stories
    const query = ctx.db
      .query("stories")
      .withIndex("by_status_creationTime", (q) => q.eq("status", "pending"))
      .order("asc"); // Show oldest pending first

    const paginatedStories = await query.paginate(args.paginationOpts);
    const storiesWithDetails = await fetchTagsForStories(ctx, paginatedStories.page);

    return {
      ...paginatedStories,
      page: storiesWithDetails,
    };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<StoryWithDetails | null> => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("status"), "approved")) // Only return if approved
      .unique();

    if (!story) {
      return null;
    }

    const storiesWithDetails = await fetchTagsForStories(ctx, [story]);
    return storiesWithDetails[0]; // fetchTagsForStories returns an array
  },
});

// Helper function to generate a URL-friendly slug
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove invalid characters
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens
}

export const submit = mutation({
  args: {
    title: v.string(),
    tagline: v.string(),
    url: v.string(),
    tagIds: v.array(v.id("tags")), // Existing tag IDs
    newTagNames: v.optional(v.array(v.string())), // NEW: Names of new tags to create
    name: v.string(),
    email: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = generateSlug(args.title);

    const existing = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      throw new Error(`Slug "${slug}" already exists for story: ${existing.title}`);
    }

    let allTagIds: Id<"tags">[] = [...args.tagIds]; // Start with existing tag IDs

    // Ensure any new tags are created and get their IDs
    if (args.newTagNames && args.newTagNames.length > 0) {
      const newCreatedTagIds = await ctx.runMutation(internal.tags.ensureTags, {
        tagNames: args.newTagNames,
      });
      // Combine existing and newly created tag IDs, ensuring uniqueness
      allTagIds = [...new Set([...allTagIds, ...newCreatedTagIds])];
    }

    // Validate final tagIds exist (optional but good practice)
    for (const tagId of allTagIds) {
      const tag = await ctx.db.get(tagId);
      if (!tag) {
        console.warn(`Tag with ID ${tagId} not found during final check.`);
        // Filter out potentially invalid IDs just in case
        allTagIds = allTagIds.filter((id) => id !== tagId);
      }
    }

    // Only proceed if there's at least one valid tag
    if (allTagIds.length === 0) {
      throw new Error("At least one valid tag is required to submit a story.");
    }

    const storyId = await ctx.db.insert("stories", {
      title: args.title,
      slug: slug,
      url: args.url,
      description: args.tagline,
      tagIds: allTagIds, // Use the combined & validated list of tag IDs
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
      isHidden: false, // Default to not hidden
    });

    return { storyId, slug };
  },
});

// Mutation to generate upload URL for screenshots
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// vote remains the same (votes on approved stories typically)
export const vote = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    // Optional: Check if story is approved before allowing votes?
    // if (story.status !== 'approved') {
    //   throw new Error("Cannot vote on a story that is not approved.");
    // }

    await ctx.db.patch(args.storyId, {
      votes: story.votes + 1,
    });
  },
});

// rate remains the same (rates on approved stories typically)
export const rate = mutation({
  args: {
    storyId: v.id("stories"),
    rating: v.number(), // Expecting a rating from 1 to 5
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    // Optional: Check if story is approved before allowing rating?
    // if (story.status !== 'approved') {
    //   throw new Error("Cannot rate a story that is not approved.");
    // }

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    await ctx.db.patch(args.storyId, {
      ratingSum: story.ratingSum + args.rating,
      ratingCount: story.ratingCount + 1,
    });
  },
});

// New mutation for updating story status (moderation)
export const updateStatus = mutation({
  args: {
    storyId: v.id("stories"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    // TODO: Add authentication check - only admins should update status
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    await ctx.db.patch(args.storyId, { status: args.status });
  },
});

// --- New Moderation Mutations ---

// Mutation to hide a story (soft delete / visibility toggle)
export const hideStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    // TODO: Add admin authentication check
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    await ctx.db.patch(args.storyId, { isHidden: true });
  },
});

// Mutation to show a hidden story
export const showStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    // TODO: Add admin authentication check
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    await ctx.db.patch(args.storyId, { isHidden: false });
  },
});

// Mutation to permanently delete a story
export const deleteStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    // TODO: Add admin authentication check
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      console.warn(`Story ${args.storyId} not found for deletion.`);
      return; // Or throw error if preferred
    }

    // Optionally: Delete associated comments and votes first
    // This requires iterating through comments related to the story
    // const comments = await ctx.db.query('comments').withIndex('by_storyId', q => q.eq('storyId', args.storyId)).collect();
    // for (const comment of comments) {
    //   await ctx.db.delete(comment._id);
    // }

    // Optionally: Delete screenshot from storage
    if (story.screenshotId) {
      try {
        await ctx.storage.delete(story.screenshotId);
      } catch (error) {
        console.error(
          `Failed to delete screenshot ${story.screenshotId} for story ${args.storyId}:`,
          error
        );
        // Decide if deletion should proceed or throw
      }
    }

    await ctx.db.delete(args.storyId);
  },
});

// Query to list ALL stories for admin, with filtering and search
export const listAllStoriesAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filters: v.object({
      status: v.optional(
        v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
      ),
      isHidden: v.optional(v.boolean()),
      // tagId: v.optional(v.id("tags")), // Potential future filter
    }),
    searchTerm: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ page: StoryWithDetails[]; isDone: boolean; continueCursor: string }> => {
    // TODO: Add authentication check - only admins should access

    let query; // Use 'let' because it will be reassigned based on logic

    if (args.searchTerm && args.searchTerm.trim() !== "") {
      const searchTerm = args.searchTerm.trim(); // Ensure it's a non-empty string
      // Use search index if searching
      query = ctx.db.query("stories").withSearchIndex("search_all", (q) => {
        let builder = q.search("title", searchTerm); // Use the checked searchTerm
        // Apply filters within the search query if supported by the index setup
        if (args.filters.status) {
          builder = builder.eq("status", args.filters.status);
        }
        // Note: Convex search might not directly support filtering by boolean `isHidden`
        // If `isHidden` needs filtering during search, it might require schema adjustment
        // (e.g., storing isHidden as a string literal) or post-search filtering.
        // Let's assume for now search focuses on title and status filter works.
        if (args.filters.isHidden !== undefined) {
          console.warn(
            "Filtering by isHidden during search might not be optimized or directly supported by current search index config."
          );
          // We might need to filter results *after* the search pagination if this filter is crucial during search
          builder = builder.eq("isHidden", args.filters.isHidden); // Attempt to add, check if it works
        }
        return builder;
      });
      // Ordering with search results might be based on relevance.
      // Explicit ordering might need to happen after fetching if possible.
    } else {
      // Use regular indexes if not searching
      let baseQuery = ctx.db.query("stories");

      // Apply filters using indexes - prioritize more specific indexes
      if (args.filters.isHidden !== undefined && args.filters.status) {
        query = baseQuery.withIndex("by_hidden_status", (q) =>
          q.eq("isHidden", args.filters.isHidden!).eq("status", args.filters.status!)
        );
      } else if (args.filters.isHidden !== undefined) {
        // Using filter as fallback for boolean (check Convex docs for optimal boolean indexing)
        query = baseQuery.filter((q) => q.eq(q.field("isHidden"), args.filters.isHidden));
      } else if (args.filters.status) {
        // Add explicit check for status being defined
        query = baseQuery.withIndex("by_status_creationTime", (q) =>
          q.eq("status", args.filters.status!)
        );
      } else {
        // No filters, fetch all
        query = baseQuery; // Assign baseQuery to query
      }
      // Apply default ordering when not searching
      query = query.order("desc"); // Default order: newest first by _creationTime
    }

    // Execute pagination
    const paginatedStories = await query.paginate(args.paginationOpts);

    // Fetch additional details (tags, URLs)
    const storiesWithDetails = await fetchTagsForStories(ctx, paginatedStories.page);

    // Filter by isHidden *after* search pagination if search index didn't support it well
    let finalPage = storiesWithDetails;
    if (args.searchTerm && args.searchTerm.trim() !== "" && args.filters.isHidden !== undefined) {
      // Re-filter the fetched page if the search index couldn't handle the boolean filter reliably
      finalPage = storiesWithDetails.filter((story) => story.isHidden === args.filters.isHidden);
      // Note: This post-filtering affects pagination accuracy (might get fewer items than requested).
      // A better solution might involve schema changes or different indexing for boolean search filters.
    }

    return {
      ...paginatedStories,
      page: finalPage, // Use potentially post-filtered page
    };
  },
});
