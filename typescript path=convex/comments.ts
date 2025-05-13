import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { Id } from "./_generated/dataModel";

export const listAllAdmin = query({
  args: {
    status: v.optional(v.string()),
    paginationOpts: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // ... your existing logic
    // Placeholder:
    if (args.status && args.status !== "all") {
        return await ctx.db.query("comments")
            .withIndex("by_status", q => q.eq("status", args.status as any))
            .order("desc")
            .collect(); // or .paginate(args.paginationOpts)
    }
    return await ctx.db.query("comments").order("desc").collect(); // or .paginate(args.paginationOpts)
  },
});

export const updateStatus = mutation({
  args: { commentId: v.id("comments"), status: v.string() /* "approved" | "rejected" */ },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.commentId, { status: args.status });
  },
});

export const hideComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.commentId, { isHidden: true });
  },
});

export const showComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.commentId, { isHidden: false });
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.commentId);
  },
}); 