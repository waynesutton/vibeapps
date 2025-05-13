import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { Doc } from "../_generated/dataModel";

// Assuming settings is a single document.
// You might query it by a known ID or use .first().
const getSettingsDoc = async (db: any) => { // db type from QueryCtx or MutationCtx
    let settingsDoc = await db.query("settings").first();
    if (!settingsDoc) {
        // If no settings doc, create a default one. This could also be in 'initialize'.
        const defaultSettings = { siteTitle: "My Awesome Site", defaultViewMode: "grid", defaultSortPeriod: "today" };
        const id = await db.insert("settings", defaultSettings);
        settingsDoc = await db.get(id);
    }
    return settingsDoc;
};


export const get = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await getSettingsDoc(ctx.db);
  },
});

export const update = mutation({
  args: {
    // Define specific fields from SiteSettings type that can be updated
    siteTitle: v.optional(v.string()),
    defaultViewMode: v.optional(v.union(v.literal("grid"), v.literal("list"), v.literal("vibe"))),
    defaultSortPeriod: v.optional(v.string()), // Be more specific if possible
    // ... other settings fields
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const settingsDoc = await getSettingsDoc(ctx.db);
    if (settingsDoc) {
        await ctx.db.patch(settingsDoc._id, args);
    } else {
        // Should not happen if getSettingsDoc creates one, but as a fallback:
        await ctx.db.insert("settings", args);
    }
  },
});

export const initialize = mutation({
  args: {
    // Initial settings values
    siteTitle: v.string(),
    defaultViewMode: v.union(v.literal("grid"), v.literal("list"), v.literal("vibe")),
    defaultSortPeriod: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("settings").first();
    if (!existing) {
      await ctx.db.insert("settings", args);
    } else {
      // Optionally update if already exists, or throw error
      console.warn("Settings already initialized. Use 'update' to modify.");
      await ctx.db.patch(existing._id, args); // Or just return without changes
    }
  },
}); 