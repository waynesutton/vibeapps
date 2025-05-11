import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Default settings
const DEFAULT_SETTINGS = {
  itemsPerPage: 20,
  siteTitle: "Vibe Apps",
  defaultViewMode: "vibe" as const,
  // Add other defaults as needed
};

// Type for settings, could be a DB doc or the defaults
export type SettingsData = {
  itemsPerPage: number;
  siteTitle: string;
  defaultViewMode: "list" | "grid" | "vibe";
  // Add other fields from Doc<"settings"> or DEFAULT_SETTINGS if needed
} & Partial<Doc<"settings">>; // Combine defaults/structure with actual Doc fields

// Query to get the current settings
export const get = query({
  args: {},
  // Update return type
  handler: async (ctx): Promise<SettingsData> => {
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      // If no settings found, return defaults
      console.warn(
        "Settings not found in DB, returning defaults. Run initialize mutation to persist."
      );
      // Return the default object directly
      return DEFAULT_SETTINGS;
    }
    // Ensure the fetched settings object conforms to SettingsData
    return {
      ...DEFAULT_SETTINGS, // Start with defaults
      ...settings, // Override with actual DB values
    };
  },
});

// Mutation to initialize settings (run once by admin)
export const initialize = mutation({
  args: {},
  handler: async (ctx): Promise<Id<"settings"> | null> => {
    // TODO: Add admin authentication check
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
    // TODO: Add admin authentication check
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      throw new Error("Settings not initialized. Cannot update.");
    }
    await ctx.db.patch(settings._id, args);
  },
});
