import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
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
  // defaultViewMode: "vibe" as ViewModeConvex, // LEGACY - siteDefaultViewMode is primary. Keep for potential old doc structure, but don't rely on it for new defaults.
  defaultSortPeriod: "all" as SortPeriodConvex,
  // New view mode settings
  showListView: true,
  showGridView: true,
  showVibeView: true,
  siteDefaultViewMode: "vibe" as ViewModeConvex | "none", // 'none' means user choice, no pre-selection
  profilePageDefaultViewMode: "list" as ViewModeConvex | "none", // Default for profile pages, allow none
  adminDashboardDefaultViewMode: "list" as ViewModeConvex | "none", // Default for admin dashboard, allow none
  // Submission limit settings
  showSubmissionLimit: true,
  submissionLimitCount: 10,
  // Hackathon team info settings
  showHackathonTeamInfo: false,
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
        "Settings not found in DB, returning defaults. Run initialize mutation to persist.",
      );
      return DEFAULT_SETTINGS;
    }
    // Combine defaults with DB values, ensuring DB values override.
    // And ensure all default keys are present if not in DB doc yet.
    return {
      ...DEFAULT_SETTINGS,
      ...settingsDoc,
      // Ensure new fields have defaults if settingsDoc is old
      showListView: settingsDoc.showListView ?? DEFAULT_SETTINGS.showListView,
      showGridView: settingsDoc.showGridView ?? DEFAULT_SETTINGS.showGridView,
      showVibeView: settingsDoc.showVibeView ?? DEFAULT_SETTINGS.showVibeView,
      siteDefaultViewMode:
        settingsDoc.siteDefaultViewMode ?? DEFAULT_SETTINGS.siteDefaultViewMode,
      profilePageDefaultViewMode:
        settingsDoc.profilePageDefaultViewMode ??
        DEFAULT_SETTINGS.profilePageDefaultViewMode,
      adminDashboardDefaultViewMode:
        settingsDoc.adminDashboardDefaultViewMode ??
        DEFAULT_SETTINGS.adminDashboardDefaultViewMode,
      showSubmissionLimit:
        settingsDoc.showSubmissionLimit ?? DEFAULT_SETTINGS.showSubmissionLimit,
      submissionLimitCount:
        settingsDoc.submissionLimitCount ??
        DEFAULT_SETTINGS.submissionLimitCount,
      showHackathonTeamInfo:
        settingsDoc.showHackathonTeamInfo ??
        DEFAULT_SETTINGS.showHackathonTeamInfo,
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
      // Patch existing with any new default fields if they are missing
      const updates: Partial<typeof DEFAULT_SETTINGS> = {};
      if (existing.showListView === undefined)
        updates.showListView = DEFAULT_SETTINGS.showListView;
      if (existing.showGridView === undefined)
        updates.showGridView = DEFAULT_SETTINGS.showGridView;
      if (existing.showVibeView === undefined)
        updates.showVibeView = DEFAULT_SETTINGS.showVibeView;
      if (existing.siteDefaultViewMode === undefined)
        updates.siteDefaultViewMode = DEFAULT_SETTINGS.siteDefaultViewMode;
      if (existing.profilePageDefaultViewMode === undefined)
        updates.profilePageDefaultViewMode =
          DEFAULT_SETTINGS.profilePageDefaultViewMode;
      if (existing.adminDashboardDefaultViewMode === undefined)
        updates.adminDashboardDefaultViewMode =
          DEFAULT_SETTINGS.adminDashboardDefaultViewMode;
      if (existing.showSubmissionLimit === undefined)
        updates.showSubmissionLimit = DEFAULT_SETTINGS.showSubmissionLimit;
      if (existing.submissionLimitCount === undefined)
        updates.submissionLimitCount = DEFAULT_SETTINGS.submissionLimitCount;
      // also ensure old defaultViewMode is updated if new one not present
      if (
        existing.defaultViewMode &&
        existing.siteDefaultViewMode === undefined
      ) {
        updates.siteDefaultViewMode = existing.defaultViewMode as
          | ViewModeConvex
          | "none";
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
        console.log("Patched existing settings with new default fields.");
      }
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
    // defaultViewMode: v.optional(v.union(v.literal("list"), v.literal("grid"), v.literal("vibe"))), // REMOVED LEGACY FIELD
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
        v.literal("votes_year"),
      ),
    ),
    // Add other updatable settings here
    showListView: v.optional(v.boolean()),
    showGridView: v.optional(v.boolean()),
    showVibeView: v.optional(v.boolean()),
    siteDefaultViewMode: v.optional(
      v.union(
        v.literal("list"),
        v.literal("grid"),
        v.literal("vibe"),
        v.literal("none"),
      ),
    ),
    profilePageDefaultViewMode: v.optional(
      v.union(
        v.literal("list"),
        v.literal("grid"),
        v.literal("vibe"),
        v.literal("none"),
      ),
    ),
    adminDashboardDefaultViewMode: v.optional(
      v.union(
        v.literal("list"),
        v.literal("grid"),
        v.literal("vibe"),
        v.literal("none"),
      ),
    ),
    // Submission limit settings
    showSubmissionLimit: v.optional(v.boolean()),
    submissionLimitCount: v.optional(v.number()),
    // Hackathon team info settings
    showHackathonTeamInfo: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      throw new Error("Settings not initialized. Cannot update.");
    }
    await ctx.db.patch(settings._id, args);
  },
});

/**
 * Get a boolean value from appSettings table (public query for admin dashboard)
 */
export const getBoolean = query({
  args: { key: v.string() },
  returns: v.union(v.null(), v.boolean()),
  handler: async (ctx, args) => {
    // Only allow admins to access app settings
    await requireAdminRole(ctx);

    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row?.valueBoolean ?? null;
  },
});

/**
 * Internal version of getBoolean for use in actions
 */
export const getBooleanInternal = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.null(), v.boolean()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row?.valueBoolean ?? null;
  },
});

/**
 * Set a boolean value in appSettings table
 */
export const setBoolean = internalMutation({
  args: { key: v.string(), value: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { valueBoolean: args.value });
    } else {
      await ctx.db.insert("appSettings", {
        key: args.key,
        valueBoolean: args.value,
      });
    }
    return null;
  },
});

/**
 * Get a string value from appSettings table
 */
export const getString = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row?.valueString ?? null;
  },
});

/**
 * Set a string value in appSettings table
 */
export const setString = internalMutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { valueString: args.value });
    } else {
      await ctx.db.insert("appSettings", {
        key: args.key,
        valueString: args.value,
      });
    }
    return null;
  },
});

/**
 * Admin mutation to toggle global email sending
 */
export const toggleEmails = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "emailsEnabled"))
      .unique();

    const currentValue = existing?.valueBoolean ?? true; // Default to enabled
    const newValue = !currentValue;

    if (existing) {
      await ctx.db.patch(existing._id, { valueBoolean: newValue });
    } else {
      await ctx.db.insert("appSettings", {
        key: "emailsEnabled",
        valueBoolean: newValue,
      });
    }

    console.log(`Admin toggled emails: ${newValue ? "enabled" : "disabled"}`);
    return null;
  },
});
