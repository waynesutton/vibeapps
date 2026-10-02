import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildAiLeaderboardDoc,
  buildCombinedLeaderboardDoc,
  buildHumanLeaderboardDoc,
  buildOverviewDoc,
  buildRulesDoc,
  buildSubmissionDossier,
  loadGroupContext,
  loadGroupSnapshot,
  loadSubmissionBundle,
} from "./lib/researchDossier";

// Submissions per indexing transaction. Each one reads scores, notes, the AI
// result, social snapshots, and a transcript, so keep batches modest.
const INDEX_BATCH_SIZE = 20;
// Docs scanned per purge transaction
const PURGE_BATCH_SIZE = 200;
// Threads removed per group cleanup transaction (each with its messages)
const THREAD_PURGE_BATCH = 10;

type DocKind = Doc<"researchDocs">["kind"];

async function getIndexRow(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<Doc<"researchIndexes"> | null> {
  return await ctx.db
    .query("researchIndexes")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .unique();
}

/**
 * Begin (or restart) indexing a group. A fresh runId makes any batch still
 * scheduled from an older run exit on its next step.
 */
export async function startResearchIndex(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<void> {
  const runId = Date.now();
  const memberships = await ctx.db
    .query("judgingGroupSubmissions")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();
  const fields = {
    status: "indexing" as const,
    processed: 0,
    total: memberships.length,
    cursor: undefined,
    runId,
    startedAt: runId,
    readyAt: undefined,
    staleSince: undefined,
    error: undefined,
  };
  const existing = await getIndexRow(ctx, groupId);
  if (existing) {
    await ctx.db.patch(existing._id, fields);
  } else {
    await ctx.db.insert("researchIndexes", { groupId, ...fields });
  }
  await ctx.scheduler.runAfter(0, internal.researchIndex.indexBatch, {
    groupId,
    runId,
    cursor: null,
  });
}

/**
 * Turn the index off: drop the status row now and purge docs in the
 * background. Only docs older than this moment are removed, so turning the
 * index back on right away never loses fresh docs.
 */
export async function clearResearchIndex(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<void> {
  const existing = await getIndexRow(ctx, groupId);
  if (existing) await ctx.db.delete(existing._id);
  await ctx.scheduler.runAfter(0, internal.researchIndex.purgeDocs, {
    groupId,
    before: Date.now(),
    cursor: null,
  });
}

/**
 * Flag a ready index as stale after scores, AI results, or membership
 * change. Only the first change after an index patches, so busy scoring
 * sessions do not keep rewriting the row.
 */
export async function markResearchStale(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<void> {
  const row = await getIndexRow(ctx, groupId);
  if (!row || row.status !== "ready" || row.staleSince !== undefined) return;
  await ctx.db.patch(row._id, { staleSince: Date.now() });
}

/**
 * Remove every research row for a group (index, docs, threads, messages).
 * Called when the judging group itself is deleted.
 */
export async function deleteGroupResearch(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<void> {
  await clearResearchIndex(ctx, groupId);
  await ctx.scheduler.runAfter(0, internal.researchIndex.purgeThreads, {
    groupId,
  });
}

async function upsertDoc(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
  kind: DocKind,
  storyId: Id<"stories"> | undefined,
  title: string,
  content: string,
): Promise<void> {
  const now = Date.now();
  const existing =
    kind === "submission"
      ? await ctx.db
          .query("researchDocs")
          .withIndex("by_groupId_and_storyId", (q) =>
            q.eq("groupId", groupId).eq("storyId", storyId),
          )
          .first()
      : await ctx.db
          .query("researchDocs")
          .withIndex("by_groupId_and_kind", (q) =>
            q.eq("groupId", groupId).eq("kind", kind),
          )
          .first();
  if (existing) {
    await ctx.db.patch(existing._id, { title, content, updatedAt: now });
  } else {
    await ctx.db.insert("researchDocs", {
      groupId,
      storyId,
      kind,
      title,
      content,
      updatedAt: now,
    });
  }
}

// One page of submissions per transaction, then reschedule with the cursor
export const indexBatch = internalMutation({
  args: {
    groupId: v.id("judgingGroups"),
    runId: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await getIndexRow(ctx, args.groupId);
    if (!row || row.runId !== args.runId) return null;
    const gc = await loadGroupContext(ctx, args.groupId);
    if (!gc || gc.group.researchEnabled !== true) return null;

    const page = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .paginate({ numItems: INDEX_BATCH_SIZE, cursor: args.cursor });

    for (const membership of page.page) {
      const bundle = await loadSubmissionBundle(ctx, args.groupId, membership);
      if (!bundle) continue;
      await upsertDoc(
        ctx,
        args.groupId,
        "submission",
        bundle.story._id,
        bundle.story.title,
        buildSubmissionDossier(gc, bundle),
      );
    }

    await ctx.db.patch(row._id, {
      processed: Math.min(row.processed + page.page.length, row.total),
      cursor: page.continueCursor,
    });

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.researchIndex.indexBatch, {
        groupId: args.groupId,
        runId: args.runId,
        cursor: page.continueCursor,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.researchIndex.finalizeIndex, {
        groupId: args.groupId,
        runId: args.runId,
      });
    }
    return null;
  },
});

// Write overview and leaderboard docs, mark ready, purge leftovers
export const finalizeIndex = internalMutation({
  args: { groupId: v.id("judgingGroups"), runId: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await getIndexRow(ctx, args.groupId);
    if (!row || row.runId !== args.runId) return null;
    const gc = await loadGroupContext(ctx, args.groupId);
    if (!gc || gc.group.researchEnabled !== true) return null;

    const snap = await loadGroupSnapshot(ctx, gc);
    await Promise.all([
      upsertDoc(ctx, args.groupId, "overview", undefined, "Group overview", buildOverviewDoc(snap)),
      upsertDoc(ctx, args.groupId, "rules", undefined, "Rules and rubric", buildRulesDoc(gc)),
      upsertDoc(ctx, args.groupId, "humanLeaderboard", undefined, "Human judges leaderboard", buildHumanLeaderboardDoc(snap, 1000)),
      upsertDoc(ctx, args.groupId, "aiLeaderboard", undefined, "AI judge leaderboard", buildAiLeaderboardDoc(snap, 1000)),
      upsertDoc(ctx, args.groupId, "combinedLeaderboard", undefined, "Combined human and AI view", buildCombinedLeaderboardDoc(snap, 1000)),
    ]);

    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "ready",
      processed: row.total,
      readyAt: now,
      staleSince: undefined,
      cursor: undefined,
    });

    // Submissions removed since the last run leave docs older than runId
    await ctx.scheduler.runAfter(0, internal.researchIndex.purgeDocs, {
      groupId: args.groupId,
      before: args.runId,
      cursor: null,
    });
    return null;
  },
});

// Delete docs last written before `before`, one page per transaction
export const purgeDocs = internalMutation({
  args: {
    groupId: v.id("judgingGroups"),
    before: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("researchDocs")
      .withIndex("by_groupId_and_storyId", (q) => q.eq("groupId", args.groupId))
      .paginate({ numItems: PURGE_BATCH_SIZE, cursor: args.cursor });
    for (const doc of page.page) {
      if (doc.updatedAt < args.before) await ctx.db.delete(doc._id);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.researchIndex.purgeDocs, {
        groupId: args.groupId,
        before: args.before,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

// Delete a group's threads and their messages in small batches
export const purgeThreads = internalMutation({
  args: { groupId: v.id("judgingGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("researchThreads")
      .withIndex("by_groupId_and_lastMessageAt", (q) =>
        q.eq("groupId", args.groupId),
      )
      .take(THREAD_PURGE_BATCH);
    for (const thread of threads) {
      const messages = await ctx.db
        .query("researchMessages")
        .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
        .collect();
      await Promise.all(messages.map((m) => ctx.db.delete(m._id)));
      await ctx.db.delete(thread._id);
    }
    if (threads.length === THREAD_PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.researchIndex.purgeThreads, {
        groupId: args.groupId,
      });
    }
    return null;
  },
});
