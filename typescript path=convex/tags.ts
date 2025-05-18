import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { Id } from "./_generated/dataModel";

// New mutation to generate a URL for icon uploads
export const generateIconUploadUrl = mutation({
  handler: async (ctx): Promise<string> => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listAllAdmin = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Fetch all tags, including those marked as 'isHidden'
    return await ctx.db.query("tags").order("asc").collect(); // Adjust order as needed
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(), // Ensure slug is unique
    description: v.optional(v.string()),
    backgroundColor: v.optional(v.string()),
    textColor: v.optional(v.string()),
    showInHeader: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()),
    order: v.optional(v.number()),
    emoji: v.optional(v.string()),
    iconStorageId: v.optional(v.id("_storage")), // Changed from iconUrl to iconStorageId
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let iconUrl: string | undefined | null = undefined;
    if (args.iconStorageId) {
      iconUrl = await ctx.storage.getUrl(args.iconStorageId);
      if (!iconUrl) {
        // This case should ideally not happen if a valid storageId is passed
        console.warn(`Could not get URL for storage ID: ${args.iconStorageId}`);
      }
    }

    // Add slug/name uniqueness check if necessary
    // TODO: Add proper slug/name uniqueness check here before inserting
    const { iconStorageId, ...restArgs } = args; // Exclude iconStorageId from direct insertion

    return await ctx.db.insert("tags", {
      ...restArgs,
      iconUrl: iconUrl, // Store the resolved URL
      isHidden: args.isHidden ?? false,
      showInHeader: args.showInHeader ?? false,
    });
  },
});

export const update = mutation({
  args: {
    tagId: v.id("tags"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    backgroundColor: v.optional(v.union(v.string(), v.null())),
    textColor: v.optional(v.union(v.string(), v.null())),
    showInHeader: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()),
    order: v.optional(v.number()),
    emoji: v.optional(v.union(v.string(), v.null())),
    iconStorageId: v.optional(v.id("_storage")), // To set/update icon
    clearIcon: v.optional(v.boolean()), // To remove existing icon
    // iconUrl is no longer directly updatable from client; managed via iconStorageId or clearIcon
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { tagId, iconStorageId, clearIcon, ...updates } = args;

    const finalUpdates: any = { ...updates }; // Use 'any' for flexibility, or define a more precise type

    if (iconStorageId) {
      const url = await ctx.storage.getUrl(iconStorageId);
      if (url) {
        finalUpdates.iconUrl = url;
        finalUpdates.emoji = undefined; // Clear emoji if icon is set
      } else {
        console.warn(`Could not get URL for storage ID: ${iconStorageId} during update.`);
        // Decide if you want to error out or proceed without updating iconUrl
      }
    } else if (clearIcon) {
      finalUpdates.iconUrl = undefined; // Explicitly remove iconUrl
    }
    // If emoji is provided and non-null, it will be in 'updates' and thus in 'finalUpdates'
    // If emoji is explicitly set to null, clear it
    if (updates.emoji === null) {
      finalUpdates.emoji = undefined;
    } else if (updates.emoji && iconStorageId) {
      // If we just uploaded an icon, but emoji was also sent (not null), prioritize icon
      finalUpdates.emoji = undefined;
    }

    // Handle null values to unset optional fields explicitly
    if (updates.backgroundColor === null) finalUpdates.backgroundColor = undefined;
    if (updates.textColor === null) finalUpdates.textColor = undefined;
    // emoji is handled above based on iconStorageId/clearIcon logic
    // iconUrl is handled above

    // TODO: If name or slug is updated, add uniqueness checks similar to create mutation

    if (Object.keys(finalUpdates).length > 0 || iconStorageId || clearIcon) {
      await ctx.db.patch(tagId, finalUpdates);
    }
  },
});

export const deleteTag = mutation({
  args: { tagId: v.id("tags") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Consider implications: what happens to stories using this tag?
    // Option 1: Just delete the tag. Stories will have a dangling ID.
    // Option 2: Remove tagId from all stories (more complex, might need internal iteration).
    await ctx.db.delete(args.tagId);
  },
});
