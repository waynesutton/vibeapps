import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth"; // Import the helper
import { Id } from "./_generated/dataModel";

// Example: List all stories for admin (pending, etc.)
export const listAllAdmin = query({
  args: {
    // Define your pagination or filter args if any
    status: v.optional(v.string()), // e.g., "pending", "approved", "all"
    paginationOpts: v.optional(v.any()), // For usePaginatedQuery
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // ... your existing logic to list stories for admin
    // Example:
    // let queryBuilder = ctx.db.query("stories");
    // if (args.status && args.status !== "all") {
    //   queryBuilder = queryBuilder.withIndex("by_status", q => q.eq("status", args.status as any));
    // }
    // return await queryBuilder.order("desc").paginate(args.paginationOpts);
    // This is a placeholder, adapt to your actual logic
    if (args.status && args.status !== "all") {
        return await ctx.db.query("stories")
            .withIndex("by_status", q => q.eq("status", args.status as any))
            .order("desc")
            .collect(); // or .paginate(args.paginationOpts) if using pagination
    }
    return await ctx.db.query("stories").order("desc").collect(); // or .paginate(args.paginationOpts)
  },
});

export const updateStoryStatus = mutation({
    args: { storyId: v.id("stories"), status: v.string(), customMessage: v.optional(v.string()) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        // Your logic for approveStory, rejectStory etc. can be consolidated or separate
        await ctx.db.patch(args.storyId, { status: args.status, customMessage: args.customMessage });
    }
});

export const toggleStoryVisibility = mutation({
    args: { storyId: v.id("stories"),isHidden: v.boolean() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        // Your logic for hideStory, showStory
        await ctx.db.patch(args.storyId, { isHidden: args.isHidden });
    }
});

export const deleteStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Implement soft or hard delete as per your requirements
    // Example: Soft delete by marking as hidden and rejected
    // await ctx.db.patch(args.storyId, { isHidden: true, status: "rejected", /* potentially clear sensitive fields */ });
    // Example: Hard delete
    await ctx.db.delete(args.storyId);
    // Also delete related comments, votes, reports if necessary (consider internal mutations for atomicity)
  },
});

export const updateStoryCustomMessage = mutation({
  args: { storyId: v.id("stories"), customMessage: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.storyId, { customMessage: args.customMessage });
  },
});

export const toggleStoryPinStatus = mutation({
  args: { storyId: v.id("stories"), isPinned: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.storyId, { isPinned: args.isPinned });
  },
});

// Add requireAdmin(ctx) to:
// - approveStory (if separate)
// - rejectStory (if separate)
// - hideStory (if separate)
// - showStory (if separate)
// ... and any other admin-specific story functions. 