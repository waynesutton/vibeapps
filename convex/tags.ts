import { query, mutation, internalMutation } from "./_generated/server";
import { v, type Infer } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users"; // Updated to requireAdminRole

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
      .order("asc") // This likely sorts by _creationTime or another default
      .collect();
  },
});

// Query to list only tags shown in the header (excluding hidden) - Publicly accessible
// Sorted by manual order, then by name.
export const listHeader = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    const tags = await ctx.db
      .query("tags")
      .filter((q) => q.eq(q.field("showInHeader"), true))
      .filter((q) => q.neq(q.field("isHidden"), true))
      .collect();

    // Sort by order (ascending, undefined/null last), then by name for stability
    tags.sort((a, b) => {
      const orderA = a.order ?? Infinity;
      const orderB = b.order ?? Infinity;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    return tags;
  },
});

// Query to get a single tag by slug - Publicly accessible
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("tags"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.optional(v.string()),
      showInHeader: v.boolean(),
      isHidden: v.optional(v.boolean()),
      backgroundColor: v.optional(v.string()),
      textColor: v.optional(v.string()),
      borderColor: v.optional(v.string()),
      emoji: v.optional(v.string()),
      iconUrl: v.optional(v.string()),
      order: v.optional(v.number()),
      createdByAdmin: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args): Promise<Doc<"tags"> | null> => {
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.neq(q.field("isHidden"), true)) // Exclude hidden tags
      .first();

    return tag || null;
  },
});

// Query to list ALL tags including hidden ones (for admin purposes) - Requires Auth
export const listAllAdmin = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    await requireAdminRole(ctx); // Ensure only admins can see hidden tags
    const tags = await ctx.db.query("tags").collect();
    // Sort by: 1) Admin tags first, 2) Order (ascending, undefined/null last), 3) Name for consistency
    tags.sort((a, b) => {
      // First sort by createdByAdmin (admin tags first)
      const aIsAdmin = a.createdByAdmin ?? true; // Default to admin for existing tags
      const bIsAdmin = b.createdByAdmin ?? true;
      if (aIsAdmin !== bIsAdmin) {
        return bIsAdmin ? 1 : -1; // Admin tags (true) come first
      }

      // Then sort by order (ascending, undefined/null last)
      const orderA = a.order ?? Infinity;
      const orderB = b.order ?? Infinity;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Finally sort by name for consistency
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
    return tags;
  },
});

// Query to list ALL tags including hidden ones (for form dropdown) - Publicly accessible
export const listAllForDropdown = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    const tags = await ctx.db.query("tags").collect();
    // Sort by order (ascending, undefined/null last), then by name for consistency
    tags.sort((a, b) => {
      const orderA = a.order ?? Infinity;
      const orderB = b.order ?? Infinity;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
    return tags;
  },
});

// Mutation to create a new tag - Requires Auth
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(), // Accept slug from frontend
    showInHeader: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()), // Optional: defaults to false
    backgroundColor: v.optional(v.union(v.string(), v.null())), // Allow null for clearing
    textColor: v.optional(v.union(v.string(), v.null())), // Allow null for clearing
    borderColor: v.optional(v.union(v.string(), v.null())), // Allow null for clearing
    emoji: v.optional(v.union(v.string(), v.null())), // Allow null for clearing
    iconUrl: v.optional(v.union(v.string(), v.null())), // Accept iconUrl (for legacy, but not used)
    iconStorageId: v.optional(v.id("_storage")), // Accept storageId for uploaded icon
    order: v.optional(v.number()), // Added order
    createdByAdmin: v.optional(v.boolean()), // Track if created by admin
  },
  handler: async (ctx, args): Promise<Id<"tags">> => {
    await requireAdminRole(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Tag name cannot be empty.");
    }
    const slug = args.slug.trim();
    if (!slug) {
      throw new Error("Slug cannot be empty.");
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
      throw new Error(
        `Tag slug "${slug}" (derived from "${name}") already exists. Please choose a different name.`,
      );
    }
    let iconUrl: string | undefined = args.iconUrl ?? undefined;
    if (args.iconStorageId) {
      const url = await ctx.storage.getUrl(args.iconStorageId);
      iconUrl = url ?? undefined;
    }
    return await ctx.db.insert("tags", {
      name: name,
      slug: slug,
      showInHeader: args.showInHeader ?? false,
      isHidden: args.isHidden ?? false,
      backgroundColor: args.backgroundColor ?? undefined,
      textColor: args.textColor ?? undefined,
      borderColor: args.borderColor ?? undefined,
      emoji: args.emoji ?? undefined,
      iconUrl: iconUrl,
      order: args.order,
      createdByAdmin: args.createdByAdmin ?? true, // Default to admin-created for admin-created tags
    });
  },
});

// Mutation to update a tag - Fixed: Validation reads done before write
export const update = mutation({
  args: {
    tagId: v.id("tags"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    showInHeader: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()),
    backgroundColor: v.optional(v.union(v.string(), v.null())),
    textColor: v.optional(v.union(v.string(), v.null())),
    borderColor: v.optional(v.union(v.string(), v.null())),
    emoji: v.optional(v.union(v.string(), v.null())),
    iconUrl: v.optional(v.union(v.string(), v.null())),
    iconStorageId: v.optional(v.id("_storage")), // Accept storageId for uploaded icon
    clearIcon: v.optional(v.boolean()), // Allow clearing icon
    order: v.optional(v.union(v.number(), v.null())), // Added order, allow null to unset
    createdByAdmin: v.optional(v.boolean()), // Allow updating admin/user status
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const { tagId, iconStorageId, clearIcon, ...rest } = args;
    const updateData: Partial<Omit<Doc<"tags">, "_id" | "_creationTime">> = {};
    
    // Perform all validation reads first
    if (rest.name !== undefined) {
      const newName = rest.name.trim();
      if (newName === "") {
        throw new Error("Tag name cannot be empty.");
      }
      const newSlug = rest.slug ? rest.slug.trim() : generateSlug(newName);
      if (!newSlug) {
        throw new Error(
          "Could not generate a valid slug from the new tag name.",
        );
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
          `Tag slug "${newSlug}" (derived from "${newName}") is already in use. Please choose a different name.`,
        );
      }
      updateData.name = newName;
      updateData.slug = newSlug;
    }
    
    // Build update payload
    if (rest.showInHeader !== undefined)
      updateData.showInHeader = rest.showInHeader;
    if (rest.isHidden !== undefined) updateData.isHidden = rest.isHidden;
    if (rest.backgroundColor !== undefined)
      updateData.backgroundColor =
        rest.backgroundColor === null ? undefined : rest.backgroundColor;
    if (rest.textColor !== undefined)
      updateData.textColor =
        rest.textColor === null ? undefined : rest.textColor;
    if (rest.borderColor !== undefined)
      updateData.borderColor =
        rest.borderColor === null ? undefined : rest.borderColor;
    if (rest.emoji !== undefined)
      updateData.emoji = rest.emoji === null ? undefined : rest.emoji;
    if (rest.iconUrl !== undefined)
      updateData.iconUrl = rest.iconUrl === null ? undefined : rest.iconUrl;

    if (iconStorageId) {
      const url = await ctx.storage.getUrl(iconStorageId);
      updateData.iconUrl = url ?? undefined;
      if (url) updateData.emoji = undefined; // Clear emoji if new icon is set
    } else if (clearIcon) {
      updateData.iconUrl = undefined;
    }

    // Handle order: if null is passed, unset it (undefined). Otherwise, use the value.
    if (rest.order !== undefined) {
      updateData.order = rest.order === null ? undefined : rest.order;
    }

    // Handle createdByAdmin field
    if (rest.createdByAdmin !== undefined) {
      updateData.createdByAdmin = rest.createdByAdmin;
    }

    // All validation complete - perform single write
    if (Object.keys(updateData).length > 0) {
      await ctx.db.patch(tagId, updateData);
    }
  },
});

// Mutation to delete a tag - Requires Auth
export const deleteTag = mutation({
  args: { tagId: v.id("tags") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    // TODO: Consider implications: Remove tagId from stories? Or prevent deletion if used?
    // For now, just delete the tag document.
    await ctx.db.delete(args.tagId);
  },
});

// --- Internal Mutations ---

/**
 * Takes an array of tag names, finds existing ones, creates new ones,
 * and returns an array of corresponding tag IDs - Fixed: Reduced sequential operations
 */
export const ensureTags = internalMutation({
  args: {
    tagNames: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"tags">[]> => {
    const tagIds: Id<"tags">[] = [];
    const trimmedNames = args.tagNames
      .map((name) => name.trim())
      .filter((name) => name !== "");
    
    if (trimmedNames.length === 0) return [];

    // Check all tags at once to reduce sequential operations
    const uniqueNames = Array.from(new Set(trimmedNames));
    const existingTagsMap = new Map<string, Id<"tags">>();
    
    // Read all existing tags in one pass
    for (const name of uniqueNames) {
      const existing = await ctx.db
        .query("tags")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (existing) {
        existingTagsMap.set(name, existing._id);
      }
    }

    // Collect names that need to be created
    const namesToCreate = uniqueNames.filter(
      (name) => !existingTagsMap.has(name)
    );

    // Prepare all new tags with slugs
    const tagsToInsert: Array<{
      name: string;
      slug: string;
    }> = [];

    for (const nameToCreate of namesToCreate) {
      const slug = generateSlug(nameToCreate);
      if (!slug) {
        console.error(`Could not generate slug for new tag: ${nameToCreate}`);
        continue;
      }

      // Check if generated slug already exists to avoid collision
      const slugCheck = await ctx.db
        .query("tags")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (slugCheck) {
        console.warn(
          `Slug collision for new tag "${nameToCreate}" (slug: "${slug}"). Skipping.`,
        );
        continue;
      }

      tagsToInsert.push({ name: nameToCreate, slug });
    }

    // Insert all new tags
    const newTagIds = await Promise.all(
      tagsToInsert.map(({ name, slug }) =>
        ctx.db.insert("tags", {
          name,
          slug,
          showInHeader: false,
          isHidden: false,
          createdByAdmin: false,
        })
      )
    );

    // Build the final tagIds array in the original order
    for (const name of trimmedNames) {
      const existingId = existingTagsMap.get(name);
      if (existingId) {
        tagIds.push(existingId);
      } else {
        const idx = tagsToInsert.findIndex((t) => t.name === name);
        if (idx !== -1) {
          tagIds.push(newTagIds[idx]);
        }
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
        (q) => q.eq("status", "approved").eq("isHidden", false), // false means visible
      )
      // Order by creation time descending to get the most recent first for the week
      .order("desc")
      .collect();

    // Filter for stories within the last seven days *after* collection
    const storiesLastSevenDays = recentStories.filter(
      (story) => story._creationTime > sevenDaysAgo,
    );

    const tagCounts: Map<Id<"tags">, number> = new Map();
    const allTagIdsFromStories = storiesLastSevenDays.flatMap(
      (story) => story.tagIds || [],
    );

    for (const tagId of allTagIdsFromStories) {
      tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
    }

    const uniqueTagIds = Array.from(tagCounts.keys());
    if (uniqueTagIds.length === 0) {
      return [];
    }

    const tagDocs = (
      await Promise.all(uniqueTagIds.map((id) => ctx.db.get(id)))
    ).filter(Boolean) as Doc<"tags">[];

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

// Public mutation to generate an upload URL for tag icon PNGs
export const generateIconUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
