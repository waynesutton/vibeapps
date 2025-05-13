import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { Id } from "./_generated/dataModel";

// Assuming there's only one config document.
// You might need a way to identify it, e.g., a fixed ID or .first()
const CONFIG_DOC_ID_PLACEHOLDER = "your_config_doc_id_here" as Id<"convexBoxConfig">;


export const get = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // return await ctx.db.get(CONFIG_DOC_ID_PLACEHOLDER);
    // Or, if it's always the first/only document:
    const config = await ctx.db.query("convexBoxConfig").first();
    return config;
  },
});

export const update = mutation({
  args: {
    // id: v.id("convexBoxConfig"), // if passing ID
    isEnabled: v.optional(v.boolean()),
    displayText: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const config = await ctx.db.query("convexBoxConfig").first();
    if (!config) {
        // Create if doesn't exist
        await ctx.db.insert("convexBoxConfig", {
            isEnabled: args.isEnabled ?? true,
            displayText: args.displayText ?? "",
            linkUrl: args.linkUrl ?? "",
            logoStorageId: args.logoStorageId === null ? undefined : args.logoStorageId,
        });
    } else {
        const { ...updates } = args;
        if (args.logoStorageId === null) {
          (updates as any).logoStorageId = undefined; // Convex way to unset optional field
        }
        await ctx.db.patch(config._id, updates);
    }
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  await requireAdmin(ctx);
  return await ctx.storage.generateUploadUrl();
}); 