import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import { requirePermission } from "./adminAccess";

// Category keys for activity entries. Matches the schema union.
export const ACTIVITY_CATEGORIES = [
  "email",
  "submission",
  "spam",
  "judging",
  "scoring",
  "moderation",
  "access",
  "settings",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const activityCategoryValidator = v.union(
  v.literal("email"),
  v.literal("submission"),
  v.literal("spam"),
  v.literal("judging"),
  v.literal("scoring"),
  v.literal("moderation"),
  v.literal("access"),
  v.literal("settings"),
);

// appSettings key for the pause switch
const PAUSE_KEY = "activityLogPaused";

// Batch size for clearLog so a huge log clears across multiple calls
const CLEAR_BATCH = 500;

// Cap for CSV export rows
const EXPORT_CAP = 5000;

export type ActivityEntryInput = {
  category: ActivityCategory;
  action: string;
  message: string;
  actorName?: string; // Override; otherwise resolved from ctx.auth, "System" when absent
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  metadata?: unknown;
};

/**
 * Insert one activity entry. Call from any V8 mutation. Never throws:
 * logging must not break the host mutation. No-ops while the log is paused.
 */
export async function logActivity(
  ctx: MutationCtx,
  entry: ActivityEntryInput,
): Promise<void> {
  try {
    const pauseRow = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PAUSE_KEY))
      .unique();
    if (pauseRow?.valueBoolean === true) return;

    let actorName = entry.actorName;
    let actorUserId: Id<"users"> | undefined;
    if (!actorName) {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        actorName =
          (identity.name as string | undefined) ??
          (identity.nickname as string | undefined) ??
          (identity.email as string | undefined) ??
          "Admin";
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
          .unique();
        if (user) actorUserId = user._id;
      }
    }

    await ctx.db.insert("activityLog", {
      category: entry.category,
      action: entry.action,
      message: entry.message,
      actorUserId,
      actorName: actorName ?? "System",
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetLabel: entry.targetLabel,
      metadata: entry.metadata,
      isArchived: false,
    });
  } catch (error) {
    console.error("activityLog: failed to record entry", error);
  }
}

const entryValidator = v.object({
  _id: v.id("activityLog"),
  _creationTime: v.number(),
  category: activityCategoryValidator,
  action: v.string(),
  message: v.string(),
  actorUserId: v.optional(v.id("users")),
  actorName: v.optional(v.string()),
  targetType: v.optional(v.string()),
  targetId: v.optional(v.string()),
  targetLabel: v.optional(v.string()),
  metadata: v.optional(v.any()),
  isArchived: v.boolean(),
});

/**
 * Paginated activity list with category filter, archived view, and sort
 * direction. Index-backed on both paths.
 */
export const listActivity = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(activityCategoryValidator),
    archived: v.boolean(),
    sortOrder: v.union(v.literal("asc"), v.literal("desc")),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "activity.view");
    const base = args.category
      ? ctx.db
          .query("activityLog")
          .withIndex("by_archived_category", (q) =>
            q.eq("isArchived", args.archived).eq("category", args.category!),
          )
      : ctx.db
          .query("activityLog")
          .withIndex("by_archived", (q) => q.eq("isArchived", args.archived));
    return await base.order(args.sortOrder).paginate(args.paginationOpts);
  },
});

/**
 * Pause switch state for the toolbar.
 */
export const getStatus = query({
  args: {},
  returns: v.object({ paused: v.boolean() }),
  handler: async (ctx) => {
    await requirePermission(ctx, "activity.view");
    const pauseRow = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PAUSE_KEY))
      .unique();
    return { paused: pauseRow?.valueBoolean === true };
  },
});

/**
 * Pause or resume logging. While paused, logActivity drops entries.
 */
export const setPaused = mutation({
  args: { paused: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "activity.manage");
    const pauseRow = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", PAUSE_KEY))
      .unique();
    if (pauseRow) {
      await ctx.db.patch(pauseRow._id, { valueBoolean: args.paused });
    } else {
      await ctx.db.insert("appSettings", {
        key: PAUSE_KEY,
        valueBoolean: args.paused,
      });
    }
    return null;
  },
});

/**
 * Archive selected entries (moves them to the Archived view).
 */
export const bulkArchive = mutation({
  args: { ids: v.array(v.id("activityLog")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "activity.manage");
    await Promise.all(
      args.ids.map((id) => ctx.db.patch(id, { isArchived: true })),
    );
    return null;
  },
});

/**
 * Restore selected entries from the Archived view.
 */
export const bulkUnarchive = mutation({
  args: { ids: v.array(v.id("activityLog")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "activity.manage");
    await Promise.all(
      args.ids.map((id) => ctx.db.patch(id, { isArchived: false })),
    );
    return null;
  },
});

/**
 * Permanently delete selected entries.
 */
export const bulkDelete = mutation({
  args: { ids: v.array(v.id("activityLog")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "activity.manage");
    await Promise.all(args.ids.map((id) => ctx.db.delete(id)));
    return null;
  },
});

/**
 * Clear the current view (active or archived) in batches of 500.
 * Frontend calls repeatedly until done is true.
 */
export const clearLog = mutation({
  args: { archived: v.boolean() },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "activity.manage");
    const batch = await ctx.db
      .query("activityLog")
      .withIndex("by_archived", (q) => q.eq("isArchived", args.archived))
      .take(CLEAR_BATCH);
    await Promise.all(batch.map((row) => ctx.db.delete(row._id)));
    return { deleted: batch.length, done: batch.length < CLEAR_BATCH };
  },
});

/**
 * Rows for client-side CSV export, honoring the current filters.
 * Capped at 5000 newest-first rows.
 */
export const exportActivity = query({
  args: {
    category: v.optional(activityCategoryValidator),
    archived: v.boolean(),
  },
  returns: v.array(entryValidator),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "activity.view");
    const base = args.category
      ? ctx.db
          .query("activityLog")
          .withIndex("by_archived_category", (q) =>
            q.eq("isArchived", args.archived).eq("category", args.category!),
          )
      : ctx.db
          .query("activityLog")
          .withIndex("by_archived", (q) => q.eq("isArchived", args.archived));
    return await base.order("desc").take(EXPORT_CAP);
  },
});
