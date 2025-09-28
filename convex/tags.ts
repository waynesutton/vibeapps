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

// Mutation to update a tag - Requires Auth
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
          console.warn(
            `Slug collision for new tag "${nameToCreate}" (slug: "${slug}"). Skipping.`,
          );
          // Or: throw new Error(`Slug collision for tag: ${nameToCreate}`);
          continue;
        }

        // New tags default to NOT visible in header and not hidden initially
        const newTagId = await ctx.db.insert("tags", {
          name: nameToCreate,
          slug: slug, // Add slug here
          showInHeader: false, // Set to false by default
          isHidden: false,
          createdByAdmin: false, // User-created tags
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
