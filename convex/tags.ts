import { query, mutation, internalMutation } from "./_generated/server";
import { v, type Infer } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./auth"; // Import the auth helper

// Helper function to generate a URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

// Query to list all tags (excluding hidden) - Publicly accessible
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    // Filter out hidden tags
    return await ctx.db
      .query("tags")
      .filter((q) => q.neq(q.field("isHidden"), true)) // Exclude hidden tags
      .order("asc")
      .collect();
  },
});

// Query to list only tags shown in the header (excluding hidden) - Publicly accessible
export const listHeader = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    // Filter out hidden tags and those not shown in header
    return await ctx.db
      .query("tags")
      .filter((q) => q.eq(q.field("showInHeader"), true))
      .filter((q) => q.neq(q.field("isHidden"), true)) // Exclude hidden tags
      .order("asc") // Or order by name if preferred
      .collect();
  },
});

// Query to list ALL tags including hidden ones (for admin purposes) - Requires Auth
export const listAllAdmin = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    // TODO: Remove this comment and uncomment requireAuth once Clerk/Auth is set up!
    // await requireAuth(ctx); // Ensure only admins can see hidden tags
    return await ctx.db.query("tags").order("asc").collect();
  },
});

// Mutation to create a new tag - Requires Auth
export const create = mutation({
  args: {
    name: v.string(),
    showInHeader: v.boolean(),
    isHidden: v.optional(v.boolean()), // Optional: defaults to false
    backgroundColor: v.optional(v.string()), // Optional hex
    textColor: v.optional(v.string()), // Optional hex
  },
  handler: async (ctx, args): Promise<Id<"tags">> => {
    // await requireAuth(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Tag name cannot be empty.");
    }

    const slug = generateSlug(name);
    if (!slug) {
      throw new Error("Could not generate a valid slug from the tag name.");
    }

    // Check for existing name
    const existingName = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existingName) {
      throw new Error(`Tag name "${name}" already exists.`);
    }

    // Check for existing slug
    const existingSlug = await ctx.db
      .query("tags")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existingSlug) {
      // If slug exists but name doesn't, this is a problem (e.g. "My Tag" and "my-tag" and then "My Tag!" both make "my-tag")
      // For now, throw an error. Could append a short random string or number if collisions are expected.
      throw new Error(
        `Tag slug "${slug}" (derived from "${name}") already exists. Please choose a different name.`
      );
    }

    return await ctx.db.insert("tags", {
      name: name,
      slug: slug,
      showInHeader: args.showInHeader,
      isHidden: args.isHidden ?? false, // Default to not hidden
      backgroundColor: args.backgroundColor,
      textColor: args.textColor,
    });
  },
});

// Mutation to update a tag - Requires Auth
export const update = mutation({
  args: {
    tagId: v.id("tags"),
    name: v.optional(v.string()),
    showInHeader: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()),
    backgroundColor: v.optional(v.string()), // Can be null/undefined to clear
    textColor: v.optional(v.string()), // Can be null/undefined to clear
  },
  handler: async (ctx, args) => {
    // await requireAuth(ctx);
    const { tagId, ...rest } = args;

    const updateData: Partial<Omit<Doc<"tags">, "_id" | "_creationTime">> = {};

    if (rest.name !== undefined) {
      const newName = rest.name.trim();
      if (newName === "") {
        throw new Error("Tag name cannot be empty.");
      }
      const newSlug = generateSlug(newName);
      if (!newSlug) {
        throw new Error("Could not generate a valid slug from the new tag name.");
      }

      // Check if new name conflicts with an existing name (excluding current tag)
      const existingName = await ctx.db
        .query("tags")
        .withIndex("by_name", (q) => q.eq("name", newName))
        .filter((q) => q.neq(q.field("_id"), tagId))
        .first();
      if (existingName) {
        throw new Error(`Tag name "${newName}" is already in use.`);
      }

      // Check if new slug conflicts with an existing slug (excluding current tag)
      const existingSlug = await ctx.db
        .query("tags")
        .withIndex("by_slug", (q) => q.eq("slug", newSlug))
        .filter((q) => q.neq(q.field("_id"), tagId))
        .first();
      if (existingSlug) {
        throw new Error(
          `Tag slug "${newSlug}" (derived from "${newName}") is already in use. Please choose a different name.`
        );
      }
      updateData.name = newName;
      updateData.slug = newSlug;
    }

    // Directly assign optional boolean/string fields if they exist in args
    if (rest.showInHeader !== undefined) updateData.showInHeader = rest.showInHeader;
    if (rest.isHidden !== undefined) updateData.isHidden = rest.isHidden;

    // Allow clearing color fields by passing null or undefined
    if (rest.backgroundColor !== undefined) updateData.backgroundColor = rest.backgroundColor;
    if (rest.textColor !== undefined) updateData.textColor = rest.textColor;

    if (Object.keys(updateData).length > 0) {
      await ctx.db.patch(tagId, updateData);
    }
  },
});

// Mutation to delete a tag - Requires Auth
export const deleteTag = mutation({
  args: { tagId: v.id("tags") },
  handler: async (ctx, args) => {
    // TODO: Remove this comment and uncomment requireAuth once Clerk/Auth is set up!
    // await requireAuth(ctx);
    // TODO: Consider implications: Remove tagId from stories? Or prevent deletion if used?
    // For now, just delete the tag document.
    await ctx.db.delete(args.tagId);
  },
});

// --- Internal Mutations ---

/**
 * Takes an array of tag names, finds existing ones, creates new ones,
 * and returns an array of corresponding tag IDs.
 * This should be called internally, likely from the story submission mutation.
 */
export const ensureTags = internalMutation({
  args: {
    tagNames: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"tags">[]> => {
    const tagIds: Id<"tags">[] = [];
    const namesToCreate: string[] = [];

    for (const name of args.tagNames) {
      const trimmedName = name.trim();
      if (!trimmedName) continue; // Skip empty names

      const existing = await ctx.db
        .query("tags")
        .withIndex("by_name", (q) => q.eq("name", trimmedName))
        .first();

      if (existing) {
        tagIds.push(existing._id);
      } else {
        // Collect names to create in bulk later if needed, or create one by one
        // For simplicity here, we create immediately if not found.
        // Avoid creating duplicates if the same new name appears multiple times in input.
        if (!namesToCreate.includes(trimmedName)) {
          namesToCreate.push(trimmedName);
        }
      }
    }

    // Create any new tags found
    for (const nameToCreate of namesToCreate) {
      // Check again *just before* inserting in case of race conditions
      // although less likely in internal mutations called sequentially.
      const existingCheck = await ctx.db
        .query("tags")
        .withIndex("by_name", (q) => q.eq("name", nameToCreate))
        .first();
      if (existingCheck) {
        tagIds.push(existingCheck._id);
      } else {
        const slug = generateSlug(nameToCreate); // Generate slug
        if (!slug) {
          // This case should ideally not happen if nameToCreate is valid
          // but as a fallback, we could skip or use a timestamped slug.
          // For now, we'll log an error and skip, or throw.
          console.error(`Could not generate slug for new tag: ${nameToCreate}`);
          // Or: throw new Error(`Could not generate slug for new tag: ${nameToCreate}`);
          continue; // Skip this tag if slug generation fails
        }

        // Check if generated slug already exists to avoid collision
        const slugCheck = await ctx.db
          .query("tags")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();

        if (slugCheck) {
          // Handle slug collision. For now, we'll log and skip, or throw.
          // A more robust solution might append a short unique hash or number.
          console.warn(`Slug collision for new tag "${nameToCreate}" (slug: "${slug}"). Skipping.`);
          // Or: throw new Error(`Slug collision for tag: ${nameToCreate}`);
          continue;
        }

        // New tags default to NOT visible in header and not hidden initially
        const newTagId = await ctx.db.insert("tags", {
          name: nameToCreate,
          slug: slug, // Add slug here
          showInHeader: false, // Set to false by default
          isHidden: false,
          // Default colors or leave undefined? Let's leave undefined.
        });
        tagIds.push(newTagId);
      }
    }

    return tagIds;
  },
});

// Validator for the return type of getWeeklyTopCategories
export const weeklyTopCategoryValidator = v.object({
  _id: v.id("tags"),
  name: v.string(),
  slug: v.optional(v.string()), // Allow slug to be optional to match schema
  count: v.number(),
});
export type WeeklyTopCategory = Infer<typeof weeklyTopCategoryValidator>;

export const getWeeklyTopCategories = query({
  args: {
    limit: v.number(),
  },
  returns: v.array(weeklyTopCategoryValidator),
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Fetch recent, approved, visible stories
    const recentStories = await ctx.db
      .query("stories")
      .withIndex(
        "by_status_isHidden",
        (q) => q.eq("status", "approved").eq("isHidden", false) // false means visible
      )
      // Order by creation time descending to get the most recent first for the week
      .order("desc")
      .collect();

    // Filter for stories within the last seven days *after* collection
    const storiesLastSevenDays = recentStories.filter(
      (story) => story._creationTime > sevenDaysAgo
    );

    const tagCounts: Map<Id<"tags">, number> = new Map();
    const allTagIdsFromStories = storiesLastSevenDays.flatMap((story) => story.tagIds || []);

    for (const tagId of allTagIdsFromStories) {
      tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
    }

    const uniqueTagIds = Array.from(tagCounts.keys());
    if (uniqueTagIds.length === 0) {
      return [];
    }

    const tagDocs = (await Promise.all(uniqueTagIds.map((id) => ctx.db.get(id)))).filter(
      Boolean
    ) as Doc<"tags">[];

    const visibleHeaderTagsWithCounts = tagDocs
      .filter((tag) => tag.showInHeader === true && tag.isHidden !== true)
      .map((tag) => ({
        _id: tag._id,
        name: tag.name,
        slug: tag.slug, // This can now be string | undefined
        count: tagCounts.get(tag._id) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, args.limit);

    return visibleHeaderTagsWithCounts;
  },
});
