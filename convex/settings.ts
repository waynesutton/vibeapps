import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission, hasPermission } from "./adminAccess"; // Granular admin permissions
import { logActivity } from "./activityLog"; // Admin activity log
import {
  EMAIL_TYPES,
  EMAIL_TYPE_DEFAULTS,
  emailTypeSettingKey,
  emailTypeValidator,
} from "./emails/emailTypes";

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
  // Default /submit page layout: hide right sidebar and widen the form
  hideSubmitPageSidebar: false,
  // Catalog sidebar widgets. entireApp off hides the block everywhere
  // except Luma on judging group pages (those use hideLumaEvents).
  sidebarWidgets: {
    mostVibes: {
      entireApp: true,
      listView: true,
      gridView: false,
      vibeView: true,
      submitPage: true,
      tagPage: true,
    },
    recentVibers: {
      entireApp: true,
      listView: true,
      gridView: false,
      vibeView: true,
      submitPage: true,
      tagPage: true,
    },
    topCategories: {
      entireApp: true,
      listView: true,
      gridView: false,
      vibeView: true,
      submitPage: true,
      tagPage: true,
    },
    lumaEvents: {
      entireApp: true,
      listView: true,
      gridView: false,
      vibeView: true,
      submitPage: true,
      tagPage: true,
      storyDetail: true,
    },
  },
  // Tag limit settings (managed from Tags admin section)
  maxTagsPerSubmission: 6,
  maxTagLength: 20,
};

export const sidebarWidgetSurfacesValidator = v.object({
  entireApp: v.boolean(),
  listView: v.boolean(),
  gridView: v.boolean(),
  vibeView: v.boolean(),
  submitPage: v.boolean(),
  tagPage: v.boolean(),
});

export const lumaWidgetSurfacesValidator = v.object({
  entireApp: v.boolean(),
  listView: v.boolean(),
  gridView: v.boolean(),
  vibeView: v.boolean(),
  submitPage: v.boolean(),
  tagPage: v.boolean(),
  storyDetail: v.boolean(),
});

export const sidebarWidgetsValidator = v.object({
  mostVibes: sidebarWidgetSurfacesValidator,
  recentVibers: sidebarWidgetSurfacesValidator,
  topCategories: sidebarWidgetSurfacesValidator,
  lumaEvents: v.optional(lumaWidgetSurfacesValidator),
});

type SidebarWidgets = typeof DEFAULT_SETTINGS.sidebarWidgets;

function mergeSidebarWidgets(
  widgets: Partial<SidebarWidgets> | undefined,
): SidebarWidgets {
  const defaults = DEFAULT_SETTINGS.sidebarWidgets;
  return {
    mostVibes: { ...defaults.mostVibes, ...widgets?.mostVibes },
    recentVibers: { ...defaults.recentVibers, ...widgets?.recentVibers },
    topCategories: { ...defaults.topCategories, ...widgets?.topCategories },
    lumaEvents: { ...defaults.lumaEvents, ...widgets?.lumaEvents },
  };
}

const LUMA_CONFIG_ID = "global";

export async function patchLumaWidgetEntireApp(
  ctx: { db: MutationCtx["db"] },
  enabled: boolean,
): Promise<void> {
  const settings = await ctx.db.query("settings").first();
  if (!settings) return;
  const widgets = mergeSidebarWidgets(settings.sidebarWidgets);
  widgets.lumaEvents.entireApp = enabled;
  await ctx.db.patch(settings._id, { sidebarWidgets: widgets });
}

async function patchLumaConfigEnabled(
  ctx: MutationCtx,
  enabled: boolean,
): Promise<void> {
  const existing = await ctx.db
    .query("lumaConfig")
    .withIndex("by_identifier", (q) => q.eq("identifier", LUMA_CONFIG_ID))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { enabled });
    return;
  }
  await ctx.db.insert("lumaConfig", {
    identifier: LUMA_CONFIG_ID,
    enabled,
    showThumbnail: true,
    showName: true,
    showDates: true,
    showDescription: true,
  });
}

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
      hideSubmitPageSidebar:
        settingsDoc.hideSubmitPageSidebar ??
        DEFAULT_SETTINGS.hideSubmitPageSidebar,
      sidebarWidgets: mergeSidebarWidgets(settingsDoc.sidebarWidgets),
      maxTagsPerSubmission:
        settingsDoc.maxTagsPerSubmission ??
        DEFAULT_SETTINGS.maxTagsPerSubmission,
      maxTagLength: settingsDoc.maxTagLength ?? DEFAULT_SETTINGS.maxTagLength,
    } as SettingsData; // Assert to ensure type compatibility
  },
});

// Mutation to initialize settings (run once by admin)
export const initialize = mutation({
  args: {},
  handler: async (ctx): Promise<Id<"settings"> | null> => {
    await requirePermission(ctx, "settings.manage");
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
    // Default /submit page layout: hide right sidebar and widen the form
    hideSubmitPageSidebar: v.optional(v.boolean()),
    sidebarWidgets: v.optional(sidebarWidgetsValidator),
    // Tag limit settings
    maxTagsPerSubmission: v.optional(v.number()),
    maxTagLength: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "settings.manage");
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      throw new Error("Settings not initialized. Cannot update.");
    }
    const { sidebarWidgets, ...rest } = args;
    const patch: Record<string, unknown> = { ...rest };
    if (sidebarWidgets !== undefined) {
      patch.sidebarWidgets = mergeSidebarWidgets(sidebarWidgets);
    }
    await ctx.db.patch(settings._id, patch);
    if (sidebarWidgets?.lumaEvents?.entireApp !== undefined) {
      await patchLumaConfigEnabled(ctx, sidebarWidgets.lumaEvents.entireApp);
    }
    const changedFields = Object.keys(args);
    await logActivity(ctx, {
      category: "settings",
      action: "settings.updated",
      message: `Updated site settings (${changedFields.join(", ")})`,
      metadata: { fields: changedFields },
    });
    return null;
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
    // Readable by anyone with settings or emails access (EmailManagement reads
    // the emailsEnabled flag through this query).
    const canRead =
      (await hasPermission(ctx, "settings.view")) ||
      (await hasPermission(ctx, "emails.view"));
    if (!canRead) {
      throw new Error("Permission required: settings.view or emails.view");
    }

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
 * Effective on/off state for every email type (stored value or default),
 * so the Email dashboard renders all toggles from one query.
 */
export const getEmailTypeSettings = query({
  args: {},
  returns: v.record(v.string(), v.boolean()),
  handler: async (ctx) => {
    const canRead =
      (await hasPermission(ctx, "settings.view")) ||
      (await hasPermission(ctx, "emails.view"));
    if (!canRead) {
      throw new Error("Permission required: settings.view or emails.view");
    }

    const result: Record<string, boolean> = {};
    for (const emailType of EMAIL_TYPES) {
      const row = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", emailTypeSettingKey(emailType)))
        .unique();
      result[emailType] = row?.valueBoolean ?? EMAIL_TYPE_DEFAULTS[emailType];
    }
    return result;
  },
});

/**
 * Turn one email type on or off from the Email dashboard. The global
 * emailsEnabled master switch still wins when it is off.
 */
export const setEmailTypeEnabled = mutation({
  args: { emailType: emailTypeValidator, enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "emails.send");

    const key = emailTypeSettingKey(args.emailType);
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { valueBoolean: args.enabled });
    } else {
      await ctx.db.insert("appSettings", {
        key,
        valueBoolean: args.enabled,
      });
    }

    await logActivity(ctx, {
      category: "settings",
      action: "settings.emailTypeToggled",
      message: `${args.emailType.replace(/_/g, " ")} emails ${args.enabled ? "enabled" : "disabled"}`,
      metadata: { emailType: args.emailType, enabled: args.enabled },
    });
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
    await requirePermission(ctx, "emails.send");

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
    await logActivity(ctx, {
      category: "settings",
      action: "settings.emailsToggled",
      message: `Global email sending ${newValue ? "enabled" : "disabled"}`,
    });
    return null;
  },
});
