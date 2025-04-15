import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./auth"; // Import the auth helper

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
    // TODO: Remove this comment and uncomment requireAuth once Clerk/Auth is set up!
    // await requireAuth(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Tag name cannot be empty.");
    }
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) {
      throw new Error(`Tag "${name}" already exists.`);
    }
    return await ctx.db.insert("tags", {
      name: name,
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
    // TODO: Remove this comment and uncomment requireAuth once Clerk/Auth is set up!
    // await requireAuth(ctx);
    const { tagId, ...rest } = args;

    const updateData: Partial<Doc<"tags">> = {};

    if (rest.name !== undefined) {
      const newName = rest.name.trim();
      if (newName === "") {
        throw new Error("Tag name cannot be empty.");
      }
      const existing = await ctx.db
        .query("tags")
        .withIndex("by_name", (q) => q.eq("name", newName))
        .filter((q) => q.neq(q.field("_id"), tagId))
        .first();
      if (existing) {
        throw new Error(`Tag name "${newName}" is already in use.`);
      }
      updateData.name = newName;
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
        // New tags default to visible in header and not hidden
        const newTagId = await ctx.db.insert("tags", {
          name: nameToCreate,
          showInHeader: true,
          isHidden: false,
          // Default colors or leave undefined? Let's leave undefined.
        });
        tagIds.push(newTagId);
      }
    }

    return tagIds;
  },
});
