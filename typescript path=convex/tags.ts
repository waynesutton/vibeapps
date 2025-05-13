import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { Id } from "./_generated/dataModel";

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
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Add slug/name uniqueness check if necessary
    return await ctx.db.insert("tags", { ...args, isHidden: args.isHidden ?? false, showInHeader: args.showInHeader ?? false });
  },
});

export const update = mutation({
  args: {
    tagId: v.id("tags"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    backgroundColor: v.optional(v.union(v.string(), v.null())), // Allow null to unset
    textColor: v.optional(v.union(v.string(), v.null())),       // Allow null to unset
    showInHeader: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { tagId, ...updates } = args;
    
    // Handle null values to unset optional fields
    const finalUpdates: Partial<typeof args> = { ...updates };
    if (updates.backgroundColor === null) (finalUpdates as any).backgroundColor = undefined;
    if (updates.textColor === null) (finalUpdates as any).textColor = undefined;

    await ctx.db.patch(tagId, finalUpdates as any); // Cast if type complains about undefined
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