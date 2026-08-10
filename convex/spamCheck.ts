import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal, components } from "./_generated/api";
import { Workpool } from "@convex-dev/workpool";
import { requirePermission } from "./adminAccess";
import { getAuthenticatedUserId } from "./users";
import { logActivity } from "./activityLog";

// Spam scans run through their own workpool so batch scans never queue
// behind (or starve) the AI judge pool.
const spamPool = new Workpool(components.spamWorkpool, { maxParallelism: 3 });

// Caps that keep batch mutations inside Convex limits
const MAX_BATCH_SCAN = 500;
const DEFAULT_BATCH_SCAN = 100;
const MAX_BULK_ACTION = 50;

// appSettings key holding an admin-customized spam system prompt
const SPAM_PROMPT_SETTING_KEY = "spamCheckSystemPrompt";

// Default system prompt for the spam verdict AI. Admins can override it from
// the AI Spam tab; reset restores this exact text.
export const DEFAULT_SPAM_SYSTEM_PROMPT = `You are a spam reviewer for a community app directory where builders share apps they made. Decide whether a submission is spam.

Spam looks like: dead or parked URLs, link farms, SEO/affiliate content, crypto/pharma/gambling promos unrelated to a built app, duplicate mass submissions, placeholder or empty repos passed off as products, or pages with no relation to the claimed app.

NOT spam: a real app that is rough, unfinished, low quality, or simply unimpressive. Never punish quality; only punish deception and irrelevance. Social links blocked by bot protection (403/429 from LinkedIn or X) are weak signals and must not drive the verdict alone.

You will receive verified deterministic signals (measured by direct HTTP requests) plus scraped page content. Trust the verified signals over your own assumptions.

Respond with JSON only:
{
  "verdict": "spam" | "suspicious" | "clean",
  "confidence": 0-100,
  "reasons": ["short human-readable reason", ...],
  "reasoning": "2-4 sentence explanation"
}

Use "spam" only when the evidence is strong. Use "suspicious" when something is off but a human should look. Keep reasons short and specific; they may be shown to the submitter.`;

// Shared validator for the deterministic signals block (mirrors schema.ts)
export const spamSignalsValidator = v.object({
  urlLive: v.boolean(),
  urlNote: v.string(),
  urlStatusCode: v.optional(v.number()),
  scrapedContent: v.boolean(),
  duplicateUrlCount: v.number(),
  repoChecked: v.boolean(),
  repoAccessible: v.optional(v.boolean()),
  repoFileCount: v.optional(v.number()),
  repoIsEmpty: v.optional(v.boolean()),
  repoNote: v.optional(v.string()),
  linksChecked: v.array(
    v.object({
      label: v.string(),
      url: v.string(),
      ok: v.boolean(),
      note: v.string(),
    }),
  ),
});

const verdictValidator = v.union(
  v.literal("spam"),
  v.literal("suspicious"),
  v.literal("clean"),
);

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);

// Fully-shaped result row returned to the admin UI
const spamResultValidator = v.object({
  _id: v.id("spamCheckResults"),
  _creationTime: v.number(),
  storyId: v.id("stories"),
  storyTitle: v.string(),
  storySlug: v.string(),
  storyUrl: v.string(),
  githubUrl: v.optional(v.string()),
  submitterName: v.optional(v.string()),
  authorUsername: v.optional(v.string()),
  submittedAt: v.number(),
  isHidden: v.boolean(),
  isSpam: v.boolean(),
  spamReason: v.optional(v.string()),
  status: statusValidator,
  verdict: v.optional(verdictValidator),
  confidence: v.optional(v.number()),
  reasons: v.optional(v.array(v.string())),
  llmReasoning: v.optional(v.string()),
  signals: v.optional(spamSignalsValidator),
  provider: v.optional(v.string()),
  model: v.optional(v.string()),
  error: v.optional(v.string()),
  triggeredBy: v.union(v.literal("auto"), v.literal("manual")),
  checkedAt: v.optional(v.number()),
});

// Upsert a scan row to pending and enqueue the analysis action.
// Shared by the auto-scan hook, single re-scan, and batch scan.
async function upsertAndEnqueue(
  ctx: MutationCtx,
  storyId: Id<"stories">,
  triggeredBy: "auto" | "manual",
): Promise<boolean> {
  const existing = await ctx.db
    .query("spamCheckResults")
    .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
    .unique();

  if (existing) {
    // A scan is already queued or in flight: don't double-enqueue
    if (existing.status === "pending" || existing.status === "running") {
      return false;
    }
    await ctx.db.patch(existing._id, {
      status: "pending" as const,
      error: undefined,
      triggeredBy,
    });
    await spamPool.enqueueAction(
      ctx,
      internal.spamCheckAnalysis.analyzeSubmission,
      { resultId: existing._id },
    );
    return true;
  }

  const resultId = await ctx.db.insert("spamCheckResults", {
    storyId,
    status: "pending" as const,
    triggeredBy,
  });
  await spamPool.enqueueAction(
    ctx,
    internal.spamCheckAnalysis.analyzeSubmission,
    { resultId },
  );
  return true;
}

// Core mark-as-spam logic shared by the single and bulk mutations:
// hide the story, label it, alert the author in-app, and email them.
async function markStoryAsSpam(
  ctx: MutationCtx,
  storyId: Id<"stories">,
  adminUserId: Id<"users">,
  reason: string | undefined,
): Promise<boolean> {
  const story = await ctx.db.get(storyId);
  if (!story) return false;
  // Idempotent: already marked means nothing to do (no duplicate emails)
  if (story.isSpam === true) return false;

  // Default reason comes from the AI scan's stored reasons when available
  let effectiveReason = reason?.trim();
  if (!effectiveReason) {
    const result = await ctx.db
      .query("spamCheckResults")
      .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
      .unique();
    effectiveReason =
      result?.reasons && result.reasons.length > 0
        ? result.reasons.join("; ")
        : "This submission was flagged by our spam review process.";
  }

  await ctx.db.patch(storyId, {
    isSpam: true,
    spamReason: effectiveReason,
    spamMarkedAt: Date.now(),
    spamMarkedBy: adminUserId,
    isHidden: true,
  });

  // In-app alert for the author (only registered users have alerts)
  if (story.userId) {
    await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
      recipientUserId: story.userId,
      actorUserId: undefined,
      type: "spam" as const,
      storyId,
    });
  }

  // Email notification with the reason and a reply-to back to the admins
  await ctx.scheduler.runAfter(
    0,
    internal.emails.spam.sendSpamNotificationEmail,
    { storyId, reason: effectiveReason },
  );

  return true;
}

// --- Admin queries ---

/**
 * Admin view: every spam scan result enriched with story info, plus counts.
 * Filtering and sorting run server-side so the UI stays a thin table.
 */
export const listSpamResults = query({
  args: {
    verdictFilter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("spam"),
        v.literal("suspicious"),
        v.literal("clean"),
        v.literal("failed"),
        v.literal("marked"),
      ),
    ),
    sortBy: v.optional(
      v.union(
        v.literal("newest"),
        v.literal("oldest"),
        v.literal("confidence"),
      ),
    ),
    // Filter results by story submission time (ms timestamps, inclusive)
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    results: v.array(spamResultValidator),
    counts: v.object({
      total: v.number(),
      pending: v.number(),
      running: v.number(),
      failed: v.number(),
      spam: v.number(),
      suspicious: v.number(),
      clean: v.number(),
      marked: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.view");

    const rows = await ctx.db.query("spamCheckResults").collect();

    const counts = {
      total: rows.length,
      pending: 0,
      running: 0,
      failed: 0,
      spam: 0,
      suspicious: 0,
      clean: 0,
      marked: 0,
    };

    const enriched: Array<{
      _id: Id<"spamCheckResults">;
      _creationTime: number;
      storyId: Id<"stories">;
      storyTitle: string;
      storySlug: string;
      storyUrl: string;
      githubUrl?: string;
      submitterName?: string;
      authorUsername?: string;
      submittedAt: number;
      isHidden: boolean;
      isSpam: boolean;
      spamReason?: string;
      status: "pending" | "running" | "completed" | "failed";
      verdict?: "spam" | "suspicious" | "clean";
      confidence?: number;
      reasons?: Array<string>;
      llmReasoning?: string;
      signals?: Doc<"spamCheckResults">["signals"];
      provider?: string;
      model?: string;
      error?: string;
      triggeredBy: "auto" | "manual";
      checkedAt?: number;
    }> = [];

    for (const row of rows) {
      const story = await ctx.db.get(row.storyId);
      if (!story) continue; // Story deleted since the scan

      if (row.status === "pending") counts.pending++;
      else if (row.status === "running") counts.running++;
      else if (row.status === "failed") counts.failed++;
      else if (row.verdict === "spam") counts.spam++;
      else if (row.verdict === "suspicious") counts.suspicious++;
      else if (row.verdict === "clean") counts.clean++;
      if (story.isSpam === true) counts.marked++;

      let authorUsername: string | undefined;
      if (story.userId) {
        const author = await ctx.db.get(story.userId);
        authorUsername = author?.username;
      }

      enriched.push({
        _id: row._id,
        _creationTime: row._creationTime,
        storyId: row.storyId,
        storyTitle: story.title,
        storySlug: story.slug,
        storyUrl: story.url,
        githubUrl: story.githubUrl,
        submitterName: story.submitterName,
        authorUsername,
        submittedAt: story._creationTime,
        isHidden: story.isHidden,
        isSpam: story.isSpam === true,
        spamReason: story.spamReason,
        status: row.status,
        verdict: row.verdict,
        confidence: row.confidence,
        reasons: row.reasons,
        llmReasoning: row.llmReasoning,
        signals: row.signals,
        provider: row.provider,
        model: row.model,
        error: row.error,
        triggeredBy: row.triggeredBy,
        checkedAt: row.checkedAt,
      });
    }

    // Server-side date range filter (by story submission time)
    let filtered = enriched;
    if (args.startDate !== undefined) {
      const start = args.startDate;
      filtered = filtered.filter((r) => r.submittedAt >= start);
    }
    if (args.endDate !== undefined) {
      const end = args.endDate;
      filtered = filtered.filter((r) => r.submittedAt <= end);
    }

    // Server-side verdict filter
    const filter = args.verdictFilter ?? "all";
    if (filter === "failed") {
      filtered = filtered.filter((r) => r.status === "failed");
    } else if (filter === "marked") {
      filtered = filtered.filter((r) => r.isSpam);
    } else if (filter !== "all") {
      filtered = filtered.filter((r) => r.verdict === filter);
    }

    // Server-side sort
    const sortBy = args.sortBy ?? "newest";
    if (sortBy === "newest") {
      filtered.sort((a, b) => b.submittedAt - a.submittedAt);
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => a.submittedAt - b.submittedAt);
    } else {
      // Highest confidence first; unscored rows go last
      filtered.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
    }

    return { results: filtered, counts };
  },
});

// --- Admin: AI system prompt (view, edit, reset) ---

/**
 * Current spam AI system prompt for the admin UI, with the default text so
 * the editor can offer a reset.
 */
export const getSpamPrompt = query({
  args: {},
  returns: v.object({
    prompt: v.string(),
    isCustom: v.boolean(),
    defaultPrompt: v.string(),
  }),
  handler: async (ctx) => {
    await requirePermission(ctx, "moderation.view");
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", SPAM_PROMPT_SETTING_KEY))
      .unique();
    const custom = row?.valueString?.trim();
    return {
      prompt: custom || DEFAULT_SPAM_SYSTEM_PROMPT,
      isCustom: Boolean(custom),
      defaultPrompt: DEFAULT_SPAM_SYSTEM_PROMPT,
    };
  },
});

/**
 * Save a custom spam AI system prompt. Saving empty text or the exact
 * default restores the default (clears the override).
 */
export const setSpamPrompt = mutation({
  args: { prompt: v.string() },
  returns: v.object({ isCustom: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.moderate");

    const trimmed = args.prompt.trim();
    const isReset = trimmed === "" || trimmed === DEFAULT_SPAM_SYSTEM_PROMPT;

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", SPAM_PROMPT_SETTING_KEY))
      .unique();

    if (isReset) {
      if (existing) await ctx.db.delete(existing._id);
      return { isCustom: false };
    }
    if (existing) {
      await ctx.db.patch(existing._id, { valueString: trimmed });
    } else {
      await ctx.db.insert("appSettings", {
        key: SPAM_PROMPT_SETTING_KEY,
        valueString: trimmed,
      });
    }
    return { isCustom: true };
  },
});

/**
 * Effective prompt for the analysis action: the admin override when set,
 * otherwise the default.
 */
export const getSpamPromptInternal = internalQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", SPAM_PROMPT_SETTING_KEY))
      .unique();
    const custom = row?.valueString?.trim();
    return custom || DEFAULT_SPAM_SYSTEM_PROMPT;
  },
});

// --- Admin mutations: scanning ---

/**
 * Batch scan: queue AI spam scans for recent submissions. Skips stories
 * already marked as spam and (unless rescan is set) stories that already
 * have a completed scan.
 */
export const startBatchScan = mutation({
  args: {
    rescan: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    // Optional date range (ms timestamps, inclusive) to scan a specific window
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.moderate");

    const limit = Math.min(
      Math.max(args.limit ?? DEFAULT_BATCH_SCAN, 1),
      MAX_BATCH_SCAN,
    );

    // When a date range is set, scan within that window instead of just
    // the most recent submissions.
    const hasRange = args.startDate !== undefined || args.endDate !== undefined;
    const stories = hasRange
      ? await ctx.db
          .query("stories")
          .withIndex("by_creation_time", (q) => {
            const start = args.startDate;
            const end = args.endDate;
            if (start !== undefined && end !== undefined) {
              return q.gte("_creationTime", start).lte("_creationTime", end);
            }
            if (start !== undefined) {
              return q.gte("_creationTime", start);
            }
            return q.lte("_creationTime", end as number);
          })
          .order("desc")
          .take(limit)
      : await ctx.db.query("stories").order("desc").take(limit);

    let queued = 0;
    let skipped = 0;
    for (const story of stories) {
      if (story.isSpam === true) {
        skipped++;
        continue;
      }
      if (!args.rescan) {
        const existing = await ctx.db
          .query("spamCheckResults")
          .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
          .unique();
        if (existing && existing.status !== "failed") {
          skipped++;
          continue;
        }
      }
      const didQueue = await upsertAndEnqueue(ctx, story._id, "manual");
      if (didQueue) queued++;
      else skipped++;
    }

    await logActivity(ctx, {
      category: "spam",
      action: "spam.batchScan",
      message: `Started a spam batch scan (${queued} queued, ${skipped} skipped)`,
      metadata: { queued, skipped, rescan: args.rescan ?? false },
    });

    return { queued, skipped };
  },
});

/**
 * Re-scan a single submission (from a result row or a story).
 */
export const scanStory = mutation({
  args: { storyId: v.id("stories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.moderate");
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    await upsertAndEnqueue(ctx, args.storyId, "manual");
    return null;
  },
});

// --- Admin mutations: marking ---

/**
 * Confirm a flagged submission as spam: hides it, labels it with the
 * reason, sends an in-app alert, and emails the submitter. Deletion stays
 * a separate explicit action.
 */
export const markAsSpam = mutation({
  args: {
    storyId: v.id("stories"),
    reason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.moderate");
    const adminUserId = await getAuthenticatedUserId(ctx);
    const success = await markStoryAsSpam(
      ctx,
      args.storyId,
      adminUserId,
      args.reason,
    );
    if (success) {
      await logActivity(ctx, {
        category: "spam",
        action: "spam.marked",
        message: `Marked a submission as spam${args.reason ? ` (${args.reason})` : ""}`,
        targetType: "story",
        targetId: args.storyId,
      });
    }
    return { success };
  },
});

/**
 * Undo a spam mark: clears the label and unhides the story.
 */
export const unmarkSpam = mutation({
  args: { storyId: v.id("stories") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.moderate");
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }
    await ctx.db.patch(args.storyId, {
      isSpam: undefined,
      spamReason: undefined,
      spamMarkedAt: undefined,
      spamMarkedBy: undefined,
      isHidden: false,
    });
    await logActivity(ctx, {
      category: "spam",
      action: "spam.unmarked",
      message: `Cleared the spam label on "${story.title}"`,
      targetType: "story",
      targetId: args.storyId,
      targetLabel: story.title,
    });
    return { success: true };
  },
});

/**
 * Bulk confirm: mark up to 50 submissions as spam in one call.
 */
export const bulkMarkAsSpam = mutation({
  args: {
    storyIds: v.array(v.id("stories")),
    reason: v.optional(v.string()),
  },
  returns: v.object({ marked: v.number() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.moderate");
    if (args.storyIds.length > MAX_BULK_ACTION) {
      throw new Error(`At most ${MAX_BULK_ACTION} submissions per bulk action`);
    }
    const adminUserId = await getAuthenticatedUserId(ctx);
    let marked = 0;
    for (const storyId of args.storyIds) {
      const success = await markStoryAsSpam(
        ctx,
        storyId,
        adminUserId,
        args.reason,
      );
      if (success) marked++;
    }
    if (marked > 0) {
      await logActivity(ctx, {
        category: "spam",
        action: "spam.bulkMarked",
        message: `Marked ${marked} submissions as spam${args.reason ? ` (${args.reason})` : ""}`,
        metadata: { count: marked },
      });
    }
    return { marked };
  },
});

/**
 * Bulk hide submissions without labeling them as spam (softer action).
 */
export const bulkHide = mutation({
  args: { storyIds: v.array(v.id("stories")) },
  returns: v.object({ hidden: v.number() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.moderate");
    if (args.storyIds.length > MAX_BULK_ACTION) {
      throw new Error(`At most ${MAX_BULK_ACTION} submissions per bulk action`);
    }
    let hidden = 0;
    for (const storyId of args.storyIds) {
      const story = await ctx.db.get(storyId);
      if (!story || story.isHidden) continue;
      await ctx.db.patch(storyId, { isHidden: true });
      hidden++;
    }
    if (hidden > 0) {
      await logActivity(ctx, {
        category: "spam",
        action: "spam.bulkHidden",
        message: `Hid ${hidden} submissions from the spam review queue`,
        metadata: { count: hidden },
      });
    }
    return { hidden };
  },
});

/**
 * Bulk delete submissions plus every related row (comments, votes, ratings,
 * bookmarks, scan results, stored images). Destructive and permission-gated.
 */
export const bulkDelete = mutation({
  args: { storyIds: v.array(v.id("stories")) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "moderation.delete");
    if (args.storyIds.length > MAX_BULK_ACTION) {
      throw new Error(`At most ${MAX_BULK_ACTION} submissions per bulk action`);
    }

    let deleted = 0;
    for (const storyId of args.storyIds) {
      const story = await ctx.db.get(storyId);
      if (!story) continue;

      const [comments, votes, ratings, bookmarks, scanResults] =
        await Promise.all([
          ctx.db
            .query("comments")
            .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
            .collect(),
          ctx.db
            .query("votes")
            .withIndex("by_story", (q) => q.eq("storyId", storyId))
            .collect(),
          ctx.db
            .query("storyRatings")
            .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
            .collect(),
          ctx.db
            .query("bookmarks")
            .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
            .collect(),
          ctx.db
            .query("spamCheckResults")
            .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
            .collect(),
        ]);

      await Promise.all([
        ...comments.map((row) => ctx.db.delete(row._id)),
        ...votes.map((row) => ctx.db.delete(row._id)),
        ...ratings.map((row) => ctx.db.delete(row._id)),
        ...bookmarks.map((row) => ctx.db.delete(row._id)),
        ...scanResults.map((row) => ctx.db.delete(row._id)),
      ]);

      if (story.screenshotId) {
        try {
          await ctx.storage.delete(story.screenshotId);
        } catch {
          // Missing storage objects should not block deletion
        }
      }
      if (story.additionalImageIds) {
        await Promise.all(
          story.additionalImageIds.map(async (imageId) => {
            try {
              await ctx.storage.delete(imageId);
            } catch {
              // Missing storage objects should not block deletion
            }
          }),
        );
      }

      await ctx.db.delete(storyId);
      deleted++;
    }

    if (deleted > 0) {
      await logActivity(ctx, {
        category: "spam",
        action: "spam.bulkDeleted",
        message: `Deleted ${deleted} submissions from the spam review queue`,
        metadata: { count: deleted },
      });
    }
    return { deleted };
  },
});

// --- Internal: auto-scan hook and analysis chain ---

/**
 * Auto-scan a freshly submitted story. Scheduled fire-and-forget from the
 * submit mutations so a scan failure can never break a submission.
 */
export const autoScanStory = internalMutation({
  args: { storyId: v.id("stories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;
    await upsertAndEnqueue(ctx, args.storyId, "auto");
    return null;
  },
});

/**
 * Mark a scan row as running before analysis begins.
 */
export const markRunning = internalMutation({
  args: { resultId: v.id("spamCheckResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.resultId, { status: "running" as const });
    return null;
  },
});

/**
 * Everything the analysis action needs for one submission.
 */
export const getStoryForAnalysis = internalQuery({
  args: { resultId: v.id("spamCheckResults") },
  returns: v.union(
    v.null(),
    v.object({
      storyId: v.id("stories"),
      title: v.string(),
      description: v.string(),
      longDescription: v.optional(v.string()),
      url: v.string(),
      githubUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      twitterUrl: v.optional(v.string()),
      submitterName: v.optional(v.string()),
      tags: v.array(v.string()),
      duplicateUrlCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) return null;
    const story = await ctx.db.get(result.storyId);
    if (!story) return null;

    const tags: Array<string> = [];
    for (const tagId of story.tagIds || []) {
      const tag = await ctx.db.get(tagId);
      if (tag) tags.push(tag.name);
    }

    // Deterministic duplicate detection: other submissions with the same URL
    const sameUrl = await ctx.db
      .query("stories")
      .withIndex("by_url", (q) => q.eq("url", story.url))
      .collect();
    const duplicateUrlCount = sameUrl.filter(
      (s) => s._id !== story._id,
    ).length;

    return {
      storyId: story._id,
      title: story.title,
      description: story.description,
      longDescription: story.longDescription,
      url: story.url,
      githubUrl: story.githubUrl,
      videoUrl: story.videoUrl,
      linkedinUrl: story.linkedinUrl,
      twitterUrl: story.twitterUrl,
      submitterName: story.submitterName,
      tags,
      duplicateUrlCount,
    };
  },
});

/**
 * Save a scan outcome (success or failure).
 */
export const saveResult = internalMutation({
  args: {
    resultId: v.id("spamCheckResults"),
    outcome: v.union(
      v.object({
        kind: v.literal("success"),
        verdict: verdictValidator,
        confidence: v.number(),
        reasons: v.array(v.string()),
        llmReasoning: v.string(),
        signals: spamSignalsValidator,
        provider: v.string(),
        model: v.string(),
      }),
      v.object({
        kind: v.literal("error"),
        errorMessage: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) return null;

    if (args.outcome.kind === "success") {
      await ctx.db.patch(args.resultId, {
        status: "completed" as const,
        verdict: args.outcome.verdict,
        confidence: args.outcome.confidence,
        reasons: args.outcome.reasons,
        llmReasoning: args.outcome.llmReasoning,
        signals: args.outcome.signals,
        provider: args.outcome.provider,
        model: args.outcome.model,
        error: undefined,
        checkedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(args.resultId, {
        status: "failed" as const,
        error: args.outcome.errorMessage,
        checkedAt: Date.now(),
      });
    }
    return null;
  },
});
