import { v, ConvexError } from "convex/values";
import {
  env,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { requireJudgingGroupPermission } from "./adminAccess";
import { getAuthenticatedUserDoc } from "./users";
import { logActivity } from "./activityLog";
import { clearResearchIndex, startResearchIndex } from "./researchIndex";
import { isResearchModel } from "./lib/researchModels";
import { FALLBACK_LLM_MODEL } from "./lib/llm";

// Per admin send budget across all groups. Each answer can run several
// tool steps and web searches, so keep bursts small.
const researchLimiter = new RateLimiter(components.rateLimiter, {
  researchSend: { kind: "token bucket", rate: 40, period: HOUR, capacity: 15 },
});

const MAX_MESSAGE_CHARS = 8000;
const MAX_TITLE_CHARS = 80;
const THREAD_LIST_LIMIT = 50;
const MESSAGE_LIST_LIMIT = 200;

/**
 * The chat reveals human scores, judge comments, and AI results together,
 * so it needs both result permissions (full admins bypass both).
 */
async function requireResearchAccess(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"judgingGroups">,
): Promise<void> {
  await requireJudgingGroupPermission(ctx, groupId, "judging.results");
  await requireJudgingGroupPermission(ctx, groupId, "judging.ai");
}

async function consumeSendBudget(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const status = await researchLimiter.limit(ctx, "researchSend", {
    key: userId,
  });
  if (!status.ok) {
    const minutes = Math.max(1, Math.ceil(status.retryAfter / 60000));
    throw new ConvexError(
      `You've hit the research limit. Try again in ${minutes} min.`,
    );
  }
}

async function requireActor(
  ctx: MutationCtx,
): Promise<{ userId: Id<"users">; name: string }> {
  const user = await getAuthenticatedUserDoc(ctx);
  if (!user) throw new ConvexError("Please sign in and try again.");
  return { userId: user._id, name: user.name || user.username || "Admin" };
}

// Group override, then AI_RESEARCH_MODEL, then the AI judge model
export function resolveResearchModel(
  group: Pick<Doc<"judgingGroups">, "researchModel">,
): string {
  if (group.researchModel && isResearchModel(group.researchModel)) {
    return group.researchModel;
  }
  return defaultResearchModel();
}

function defaultResearchModel(): string {
  return (
    env.AI_RESEARCH_MODEL?.trim() ||
    env.AI_JUDGE_MODEL?.trim() ||
    FALLBACK_LLM_MODEL
  );
}

const indexStatusValidator = v.object({
  status: v.union(
    v.literal("indexing"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  processed: v.number(),
  total: v.number(),
  startedAt: v.number(),
  readyAt: v.optional(v.number()),
  staleSince: v.optional(v.number()),
  error: v.optional(v.string()),
});

const threadValidator = v.object({
  _id: v.id("researchThreads"),
  _creationTime: v.number(),
  title: v.string(),
  createdByName: v.string(),
  lastMessageAt: v.number(),
});

const messageValidator = v.object({
  _id: v.id("researchMessages"),
  _creationTime: v.number(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("streaming"),
    v.literal("done"),
    v.literal("failed"),
    v.literal("stopped"),
  ),
  model: v.optional(v.string()),
  authorName: v.optional(v.string()),
  toolSteps: v.optional(
    v.array(
      v.object({
        id: v.string(),
        tool: v.string(),
        label: v.string(),
        status: v.union(
          v.literal("running"),
          v.literal("done"),
          v.literal("error"),
        ),
      }),
    ),
  ),
  sources: v.optional(
    v.array(v.object({ title: v.string(), url: v.string() })),
  ),
  error: v.optional(v.string()),
  completedAt: v.optional(v.number()),
});

// --- Queries ---

export const getStatus = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.null(),
    v.object({
      enabled: v.boolean(),
      model: v.string(),
      override: v.union(v.string(), v.null()),
      defaultModel: v.string(),
      index: v.union(v.null(), indexStatusValidator),
    }),
  ),
  handler: async (ctx, args) => {
    await requireResearchAccess(ctx, args.groupId);
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    const row = await ctx.db
      .query("researchIndexes")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .unique();
    return {
      enabled: group.researchEnabled === true,
      model: resolveResearchModel(group),
      override: group.researchModel ?? null,
      defaultModel: defaultResearchModel(),
      index: row
        ? {
            status: row.status,
            processed: row.processed,
            total: row.total,
            startedAt: row.startedAt,
            readyAt: row.readyAt,
            staleSince: row.staleSince,
            error: row.error,
          }
        : null,
    };
  },
});

export const listThreads = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(threadValidator),
  handler: async (ctx, args) => {
    await requireResearchAccess(ctx, args.groupId);
    const threads = await ctx.db
      .query("researchThreads")
      .withIndex("by_groupId_and_lastMessageAt", (q) =>
        q.eq("groupId", args.groupId),
      )
      .order("desc")
      .take(THREAD_LIST_LIMIT);
    return threads.map((t) => ({
      _id: t._id,
      _creationTime: t._creationTime,
      title: t.title,
      createdByName: t.createdByName,
      lastMessageAt: t.lastMessageAt,
    }));
  },
});

export const listMessages = query({
  args: { threadId: v.id("researchThreads") },
  returns: v.array(messageValidator),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];
    await requireResearchAccess(ctx, thread.groupId);
    const messages = await ctx.db
      .query("researchMessages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .take(MESSAGE_LIST_LIMIT);
    return messages.map((m) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      role: m.role,
      content: m.content,
      status: m.status,
      model: m.model,
      authorName: m.authorName,
      toolSteps: m.toolSteps,
      sources: m.sources,
      error: m.error,
      completedAt: m.completedAt,
    }));
  },
});

// --- Index lifecycle ---

export const setEnabled = mutation({
  args: { groupId: v.id("judgingGroups"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireResearchAccess(ctx, args.groupId);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new ConvexError("Judging group not found.");
    // Idempotent: repeated clicks do not restart indexing
    if ((group.researchEnabled === true) === args.enabled) return null;

    await ctx.db.patch(args.groupId, { researchEnabled: args.enabled });
    if (args.enabled) {
      await startResearchIndex(ctx, args.groupId);
    } else {
      await clearResearchIndex(ctx, args.groupId);
    }
    await logActivity(ctx, {
      category: "judging",
      action: args.enabled ? "research.enabled" : "research.disabled",
      message: `${args.enabled ? "Turned on" : "Turned off"} research chat for "${group.name}"`,
      targetType: "judgingGroup",
      targetId: args.groupId,
      targetLabel: group.name,
      groupId: args.groupId,
    });
    return null;
  },
});

export const refreshIndex = mutation({
  args: { groupId: v.id("judgingGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireResearchAccess(ctx, args.groupId);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.researchEnabled !== true) {
      throw new ConvexError("Turn on research for this group first.");
    }
    await startResearchIndex(ctx, args.groupId);
    await logActivity(ctx, {
      category: "judging",
      action: "research.reindexed",
      message: `Refreshed the research index for "${group.name}"`,
      targetType: "judgingGroup",
      targetId: args.groupId,
      targetLabel: group.name,
      groupId: args.groupId,
    });
    return null;
  },
});

// Empty string clears the override so the deployment default applies
export const setModel = mutation({
  args: { groupId: v.id("judgingGroups"), model: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireResearchAccess(ctx, args.groupId);
    if (args.model !== "" && !isResearchModel(args.model)) {
      throw new ConvexError("That model is not available for research.");
    }
    await ctx.db.patch(args.groupId, {
      researchModel: args.model === "" ? undefined : args.model,
    });
    return null;
  },
});

// --- Threads ---

async function requireThreadAccess(
  ctx: MutationCtx,
  threadId: Id<"researchThreads">,
): Promise<Doc<"researchThreads">> {
  const thread = await ctx.db.get(threadId);
  if (!thread) throw new ConvexError("Thread not found.");
  await requireResearchAccess(ctx, thread.groupId);
  return thread;
}

export const renameThread = mutation({
  args: { threadId: v.id("researchThreads"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireThreadAccess(ctx, args.threadId);
    const title = args.title.trim().slice(0, MAX_TITLE_CHARS);
    if (!title) throw new ConvexError("Title cannot be empty.");
    await ctx.db.patch(args.threadId, { title });
    return null;
  },
});

export const deleteThread = mutation({
  args: { threadId: v.id("researchThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireThreadAccess(ctx, args.threadId);
    const messages = await ctx.db
      .query("researchMessages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .take(MESSAGE_LIST_LIMIT * 2);
    await Promise.all(messages.map((m) => ctx.db.delete(m._id)));
    await ctx.db.delete(args.threadId);
    return null;
  },
});

// --- Messages ---

async function lastMessage(
  ctx: MutationCtx,
  threadId: Id<"researchThreads">,
): Promise<Doc<"researchMessages"> | null> {
  return await ctx.db
    .query("researchMessages")
    .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
    .order("desc")
    .first();
}

export const sendMessage = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    threadId: v.optional(v.id("researchThreads")),
    content: v.string(),
  },
  returns: v.object({
    threadId: v.id("researchThreads"),
    messageId: v.id("researchMessages"),
  }),
  handler: async (ctx, args) => {
    await requireResearchAccess(ctx, args.groupId);
    const content = args.content.trim();
    if (!content) throw new ConvexError("Ask a question first.");
    if (content.length > MAX_MESSAGE_CHARS) {
      throw new ConvexError(
        `Keep questions under ${MAX_MESSAGE_CHARS.toLocaleString()} characters.`,
      );
    }

    const group = await ctx.db.get(args.groupId);
    if (!group || group.researchEnabled !== true) {
      throw new ConvexError("Turn on research for this group first.");
    }
    const index = await ctx.db
      .query("researchIndexes")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .unique();
    if (!index || index.status !== "ready") {
      throw new ConvexError("The research index is still building.");
    }

    const actor = await requireActor(ctx);
    await consumeSendBudget(ctx, actor.userId);

    const now = Date.now();
    let threadId = args.threadId;
    if (threadId) {
      const thread = await ctx.db.get(threadId);
      if (!thread || thread.groupId !== args.groupId) {
        throw new ConvexError("Thread not found.");
      }
      const last = await lastMessage(ctx, threadId);
      if (last && (last.status === "pending" || last.status === "streaming")) {
        throw new ConvexError("Wait for the current answer to finish.");
      }
      await ctx.db.patch(threadId, { lastMessageAt: now });
    } else {
      threadId = await ctx.db.insert("researchThreads", {
        groupId: args.groupId,
        title: content.replace(/\s+/g, " ").slice(0, MAX_TITLE_CHARS),
        createdBy: actor.userId,
        createdByName: actor.name,
        lastMessageAt: now,
      });
    }

    await ctx.db.insert("researchMessages", {
      threadId,
      groupId: args.groupId,
      role: "user",
      content,
      status: "done",
      authorId: actor.userId,
      authorName: actor.name,
      completedAt: now,
    });
    const messageId = await ctx.db.insert("researchMessages", {
      threadId,
      groupId: args.groupId,
      role: "assistant",
      content: "",
      status: "pending",
      model: resolveResearchModel(group),
    });
    await ctx.scheduler.runAfter(0, internal.researchAgent.respond, {
      messageId,
    });
    return { threadId, messageId };
  },
});

export const stopMessage = mutation({
  args: { messageId: v.id("researchMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    await requireResearchAccess(ctx, message.groupId);
    if (message.status !== "pending" && message.status !== "streaming") {
      return null;
    }
    await ctx.db.patch(args.messageId, { stopRequested: true });
    return null;
  },
});

export const retryMessage = mutation({
  args: { messageId: v.id("researchMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.role !== "assistant") {
      throw new ConvexError("Only answers can be retried.");
    }
    await requireResearchAccess(ctx, message.groupId);
    if (message.status === "pending" || message.status === "streaming") {
      return null;
    }
    const last = await lastMessage(ctx, message.threadId);
    if (!last || last._id !== message._id) {
      throw new ConvexError("Only the latest answer can be retried.");
    }
    const group = await ctx.db.get(message.groupId);
    if (!group || group.researchEnabled !== true) {
      throw new ConvexError("Turn on research for this group first.");
    }
    const actor = await requireActor(ctx);
    await consumeSendBudget(ctx, actor.userId);
    await ctx.db.patch(args.messageId, {
      content: "",
      status: "pending",
      model: resolveResearchModel(group),
      toolSteps: undefined,
      sources: undefined,
      error: undefined,
      stopRequested: undefined,
      usage: undefined,
      completedAt: undefined,
    });
    await ctx.db.patch(message.threadId, { lastMessageAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.researchAgent.respond, {
      messageId: args.messageId,
    });
    return null;
  },
});
