import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./auth"; // Import the helper

// Query to list all tags
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    // TODO: Add authentication check - only admins should see all?
    // Or maybe this is fine for populating the submit form?
    return await ctx.db.query("tags").order("asc").collect();
  },
});

// Query to list only tags shown in the header
export const listHeader = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tags">[]> => {
    return await ctx.db
      .query("tags")
      .filter((q) => q.eq(q.field("showInHeader"), true))
      .order("asc") // Or order by name if preferred
      .collect();
  },
});

// Mutation to create a new tag
export const create = mutation({
  args: {
    name: v.string(),
    showInHeader: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"tags">> => {
    await requireAuth(ctx); // Add authentication check
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) {
      throw new Error(`Tag "${args.name}" already exists.`);
    }
    return await ctx.db.insert("tags", {
      name: args.name,
      showInHeader: args.showInHeader,
    });
  },
});

// Mutation to update a tag
export const update = mutation({
  args: {
    tagId: v.id("tags"),
    name: v.optional(v.string()),
    showInHeader: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx); // Add authentication check
    const { tagId, ...rest } = args;

    // Prepare potential update data
    const updateData: Partial<Doc<"tags">> = {};

    // Validate and check name if provided
    if (rest.name !== undefined) {
      const newName = rest.name.trim(); // Trim whitespace
      if (newName === "") {
        throw new Error("Tag name cannot be empty.");
      }

      // Check if the trimmed name already exists for another tag
      const existing = await ctx.db
        .query("tags")
        .withIndex("by_name", (q) => q.eq("name", newName)) // Use validated newName
        .filter((q) => q.neq(q.field("_id"), tagId)) // Exclude the current tag
        .first();

      if (existing) {
        throw new Error(`Tag name "${newName}" is already in use.`);
      }
      // If valid and unique, add to update data
      updateData.name = newName;
    }

    // Add showInHeader if provided
    if (rest.showInHeader !== undefined) {
      updateData.showInHeader = rest.showInHeader;
    }

    // Only patch if there's something to update
    if (Object.keys(updateData).length > 0) {
      await ctx.db.patch(tagId, updateData);
    }
  },
});

// Mutation to delete a tag
export const deleteTag = mutation({
  args: { tagId: v.id("tags") },
  handler: async (ctx, args) => {
    await requireAuth(ctx); // Add authentication check

    // Optional: Check if the tag is in use by any stories before deleting
    // This could be complex if stories have many tags.
    // Alternatively, handle broken tag references gracefully in the frontend
    // or update stories to remove the tagId.
    // For simplicity now, we just delete the tag.
    // const storiesUsingTag = await ctx.db.query('stories')
    //     .filter(q => q.eq(q.field('tagIds'), args.tagId)) // This filter might not work directly on arrays
    //     .collect();
    // if (storiesUsingTag.length > 0) {
    //     throw new Error("Cannot delete tag, it is currently in use.");
    // }

    await ctx.db.delete(args.tagId);
  },
});
