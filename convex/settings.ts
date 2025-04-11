import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Default settings
const DEFAULT_SETTINGS = {
  itemsPerPage: 20,
  siteTitle: "Vibe Apps",
  // Add other defaults as needed
};

// Type for settings, could be a DB doc or the defaults
export type SettingsData = Doc<"settings"> | typeof DEFAULT_SETTINGS;

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
    return settings;
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
