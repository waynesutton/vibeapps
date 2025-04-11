import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

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

export const listApproved = query({
  args: {
    paginationOpts: paginationOptsValidator,
    tagId: v.optional(v.id("tags")), // Filter by tag ID now
  },
  handler: async (
    ctx,
    args
  ): Promise<{ page: StoryWithDetails[]; isDone: boolean; continueCursor: string }> => {
    let query = ctx.db.query("stories").withIndex("by_status", (q) => q.eq("status", "approved")); // Only fetch approved

    // TODO: Filtering by tagId efficiently requires a proper index
    // on the `tagIds` array or a different schema design (e.g., join table).
    // For now, filtering post-pagination or relying on search.
    if (args.tagId) {
      console.warn(
        "Filtering by tagId directly in query isn't efficient without a specific index or schema change. This filter might not work as expected."
      );
      // Example of how it *might* work with a hypothetical index:
      // query = query.withIndex("by_tagIds", q => q.eq("tagIds", args.tagId));
    }

    // Sort approved stories by creation time (newest first)
    const paginatedStories = await query.order("desc").paginate(args.paginationOpts);

    const storiesWithDetails = await fetchTagsForStories(ctx, paginatedStories.page);

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
      .withIndex("by_status", (q) => q.eq("status", "pending"))
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
    tagIds: v.array(v.id("tags")), // Changed from tags: v.array(v.string())
    name: v.string(), // NEW: Submitter's name
    email: v.optional(v.string()), // NEW: Submitter's email
    screenshotId: v.optional(v.id("_storage")),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    redditUrl: v.optional(v.string()),
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

    // Validate tagIds exist (optional but good practice)
    for (const tagId of args.tagIds) {
      const tag = await ctx.db.get(tagId);
      if (!tag) {
        console.warn(`Tag with ID ${tagId} not found during submission.`);
        // Decide whether to throw error or just skip the tag
      }
    }

    const storyId = await ctx.db.insert("stories", {
      title: args.title,
      slug: slug,
      url: args.url,
      description: args.tagline,
      tagIds: args.tagIds, // Use tagIds
      name: args.name, // USE: name
      email: args.email, // USE: email
      votes: 1,
      commentCount: 0,
      screenshotId: args.screenshotId,
      ratingSum: 0,
      ratingCount: 0,
      linkedinUrl: args.linkedinUrl,
      twitterUrl: args.twitterUrl,
      redditUrl: args.redditUrl,
      status: "pending", // Set initial status to pending
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
