import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users"; // Import requireAdminRole

// Define the type for SortPeriod based on schema/frontend usage
export type SortPeriodConvex = Doc<"settings">["defaultSortPeriod"]; // Infer from schema
export type ViewModeConvex = Doc<"settings">["defaultViewMode"]; // Infer from schema

// Default settings
const DEFAULT_SETTINGS = {
  itemsPerPage: 20,
  siteTitle: "Vibe Apps",
  defaultViewMode: "vibe" as ViewModeConvex, // Use the inferred type
  defaultSortPeriod: "all" as SortPeriodConvex, // Add default and use inferred type
};

// Type for settings data returned by the 'get' query.
// This should encompass all fields from DEFAULT_SETTINGS and actual Doc<"settings"> fields.
export type SettingsData = typeof DEFAULT_SETTINGS & Partial<Doc<"settings">>;

// Query to get the current settings
export const get = query({
  args: {},
  handler: async (ctx): Promise<SettingsData> => {
    // Publicly readable, but initialization/update requires admin
    const settingsDoc = await ctx.db.query("settings").first();
    if (!settingsDoc) {
      console.warn(
        "Settings not found in DB, returning defaults. Run initialize mutation to persist."
      );
      return DEFAULT_SETTINGS;
    }
    // Combine defaults with DB values, ensuring DB values override.
    // And ensure all default keys are present if not in DB doc yet.
    return {
      ...DEFAULT_SETTINGS,
      ...settingsDoc,
    } as SettingsData; // Assert to ensure type compatibility
  },
});

// Mutation to initialize settings (run once by admin)
export const initialize = mutation({
  args: {},
  handler: async (ctx): Promise<Id<"settings"> | null> => {
    await requireAdminRole(ctx);
    const existing = await ctx.db.query("settings").first();
    if (existing) {
      console.log("Settings already initialized.");
      return existing._id; // Return existing ID
    }
    const settingsId = await ctx.db.insert("settings", DEFAULT_SETTINGS);
    console.log("Site settings initialized.");
    return settingsId; // Return the new ID
  },
});

// Mutation to update settings
export const update = mutation({
  // Allow updating specific fields
  args: {
    itemsPerPage: v.optional(v.number()),
    siteTitle: v.optional(v.string()),
    defaultViewMode: v.optional(v.union(v.literal("list"), v.literal("grid"), v.literal("vibe"))),
    defaultSortPeriod: v.optional(
      v.union(
        v.literal("today"),
        v.literal("week"),
        v.literal("month"),
        v.literal("year"),
        v.literal("all"),
        v.literal("votes_today"),
        v.literal("votes_week"),
        v.literal("votes_month"),
        v.literal("votes_year")
      )
    ),
    // Add other updatable settings here
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      throw new Error("Settings not initialized. Cannot update.");
    }
    await ctx.db.patch(settings._id, args);
  },
});
