// Research chat agent. One internal action streams an answer for a pending
// assistant message through the Convex AI Gateway, with tools that read the
// group's indexed dossiers, live leaderboards, and the web.
//
// Streaming: the action patches the full answer text about every 250ms.
// Each patch returns a stop flag so the Stop button aborts the model call.

import { v } from "convex/values";
import { z } from "zod";
import { streamText, tool, isStepCount, type ModelMessage } from "ai";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { ContextDev } from "@context-dot-dev/convex";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildAiLeaderboardDoc,
  buildCombinedLeaderboardDoc,
  buildHumanLeaderboardDoc,
  buildOverviewDoc,
  buildRosterDoc,
  buildRulesDoc,
  buildSubmissionDossier,
  loadGroupContext,
  loadGroupSnapshot,
  loadSubmissionBundle,
  SITE_URL,
} from "./lib/researchDossier";
import { researchModelLabel } from "./lib/researchModels";

const firecrawl = new FirecrawlClient(components.firecrawl);
const contextDev = new ContextDev(components.contextDev);

const FLUSH_INTERVAL_MS = 250;
const MAX_STEPS = 8;
const MAX_OUTPUT_TOKENS = 6000;
const HISTORY_LIMIT = 20;
const SEARCH_EXCERPT_CHARS = 1200;
const MAX_DOSSIERS_PER_CALL = 6;
const WEB_PAGE_CHARS = 12000;
const MAX_TOOL_STEPS = 40;
const MAX_SOURCES = 24;
const WEB_CACHE_MS = 6 * 3_600_000;

const toolStepValidator = v.object({
  id: v.string(),
  tool: v.string(),
  label: v.string(),
  status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
});

const sourceValidator = v.object({ title: v.string(), url: v.string() });

// --- Context loading ---

export const loadRunContext = internalQuery({
  args: { messageId: v.id("researchMessages") },
  returns: v.union(
    v.null(),
    v.object({
      groupId: v.id("judgingGroups"),
      threadId: v.id("researchThreads"),
      groupName: v.string(),
      model: v.string(),
      overview: v.string(),
      rules: v.string(),
      leaderboard: v.string(),
      history: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.status !== "pending") return null;
    const gc = await loadGroupContext(ctx, message.groupId);
    if (!gc || gc.group.researchEnabled !== true) return null;

    const prior = await ctx.db
      .query("researchMessages")
      .withIndex("by_threadId", (q) => q.eq("threadId", message.threadId))
      .order("desc")
      .take(HISTORY_LIMIT + 1);
    const history = prior
      .filter(
        (m) =>
          m._id !== message._id &&
          m._creationTime <= message._creationTime &&
          m.content.trim().length > 0 &&
          (m.role === "user" || m.status === "done" || m.status === "stopped"),
      )
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    // Leaderboards are computed live so answers always match the results pages
    const snap = await loadGroupSnapshot(ctx, gc);
    return {
      groupId: message.groupId,
      threadId: message.threadId,
      groupName: gc.group.name,
      model: message.model ?? "",
      overview: buildOverviewDoc(snap),
      rules: buildRulesDoc(gc),
      leaderboard: buildCombinedLeaderboardDoc(snap, 15),
      history,
    };
  },
});

export const searchDocs = internalQuery({
  args: {
    groupId: v.id("judgingGroups"),
    query: v.string(),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      storyId: v.optional(v.id("stories")),
      kind: v.string(),
      title: v.string(),
      excerpt: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit), 1), 15);
    const docs = await ctx.db
      .query("researchDocs")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query).eq("groupId", args.groupId),
      )
      .take(limit);
    return docs.map((d) => ({
      storyId: d.storyId,
      kind: d.kind,
      title: d.title,
      excerpt: d.content.slice(0, SEARCH_EXCERPT_CHARS),
    }));
  },
});

export const getDossiers = internalQuery({
  args: {
    groupId: v.id("judgingGroups"),
    storyIds: v.array(v.string()),
  },
  returns: v.array(v.object({ storyId: v.string(), dossier: v.string() })),
  handler: async (ctx, args) => {
    const gc = await loadGroupContext(ctx, args.groupId);
    if (!gc) return [];
    const out: Array<{ storyId: string; dossier: string }> = [];
    for (const raw of args.storyIds.slice(0, MAX_DOSSIERS_PER_CALL)) {
      const storyId = ctx.db.normalizeId("stories", raw.trim());
      if (!storyId) {
        out.push({ storyId: raw, dossier: "Unknown submission id." });
        continue;
      }
      const membership = await ctx.db
        .query("judgingGroupSubmissions")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", args.groupId).eq("storyId", storyId),
        )
        .first();
      if (!membership) {
        out.push({ storyId: raw, dossier: "Not a submission in this group." });
        continue;
      }
      const bundle = await loadSubmissionBundle(ctx, args.groupId, membership);
      out.push({
        storyId: raw,
        dossier: bundle
          ? buildSubmissionDossier(gc, bundle)
          : "Submission is hidden or archived.",
      });
    }
    return out;
  },
});

const boardValidator = v.union(
  v.literal("human"),
  v.literal("ai"),
  v.literal("combined"),
  v.literal("roster"),
);

export const getLeaderboard = internalQuery({
  args: {
    groupId: v.id("judgingGroups"),
    board: boardValidator,
    limit: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const gc = await loadGroupContext(ctx, args.groupId);
    if (!gc) return "Group not found.";
    const snap = await loadGroupSnapshot(ctx, gc);
    const limit = Math.min(Math.max(Math.floor(args.limit), 1), 300);
    switch (args.board) {
      case "human":
        return buildHumanLeaderboardDoc(snap, limit);
      case "ai":
        return buildAiLeaderboardDoc(snap, limit);
      case "combined":
        return buildCombinedLeaderboardDoc(snap, limit);
      case "roster":
        return buildRosterDoc(snap, limit);
    }
  },
});

// --- Message writes ---

export const appendChunk = internalMutation({
  args: { messageId: v.id("researchMessages"), content: v.string() },
  returns: v.object({ stop: v.boolean() }),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.stopRequested === true || !isActive(message)) {
      return { stop: true };
    }
    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "streaming",
    });
    return { stop: false };
  },
});

export const recordToolStep = internalMutation({
  args: { messageId: v.id("researchMessages"), step: toolStepValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    const steps = message.toolSteps ?? [];
    const index = steps.findIndex((s) => s.id === args.step.id);
    const next =
      index === -1
        ? [...steps, args.step].slice(-MAX_TOOL_STEPS)
        : steps.map((s, i) => (i === index ? args.step : s));
    await ctx.db.patch(args.messageId, {
      toolSteps: next,
      status: message.status === "pending" ? "streaming" : message.status,
    });
    return null;
  },
});

export const addSources = internalMutation({
  args: {
    messageId: v.id("researchMessages"),
    sources: v.array(sourceValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    const merged = [...(message.sources ?? [])];
    for (const source of args.sources) {
      if (!merged.some((s) => s.url === source.url)) merged.push(source);
    }
    await ctx.db.patch(args.messageId, {
      sources: merged.slice(0, MAX_SOURCES),
    });
    return null;
  },
});

export const finish = internalMutation({
  args: {
    messageId: v.id("researchMessages"),
    content: v.string(),
    stopped: v.boolean(),
    usage: v.optional(
      v.object({
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || !isActive(message)) return null;
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(args.messageId, {
        content: args.content,
        status: args.stopped ? "stopped" : "done",
        usage: args.usage,
        completedAt: now,
        toolSteps: settleSteps(message.toolSteps),
      }),
      ctx.db.patch(message.threadId, { lastMessageAt: now }),
    ]);
    return null;
  },
});

export const fail = internalMutation({
  args: {
    messageId: v.id("researchMessages"),
    content: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || !isActive(message)) return null;
    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "failed",
      error: args.error.slice(0, 500),
      completedAt: Date.now(),
      toolSteps: settleSteps(message.toolSteps),
    });
    return null;
  },
});

function isActive(message: Doc<"researchMessages">): boolean {
  return message.status === "pending" || message.status === "streaming";
}

// Steps still "running" when the answer ends were cut off by stop or error
function settleSteps(
  steps: Doc<"researchMessages">["toolSteps"],
): Doc<"researchMessages">["toolSteps"] {
  return steps?.map((s) =>
    s.status === "running" ? { ...s, status: "error" as const } : s,
  );
}

// --- Web helpers (Firecrawl first, Context.dev fallback) ---

type WebHit = { title: string; url: string; snippet: string };

function readHit(raw: unknown): WebHit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const metadata =
    typeof record.metadata === "object" && record.metadata !== null
      ? (record.metadata as Record<string, unknown>)
      : {};
  const url =
    typeof record.url === "string"
      ? record.url
      : typeof metadata.sourceURL === "string"
        ? metadata.sourceURL
        : null;
  if (!url) return null;
  const title =
    typeof record.title === "string"
      ? record.title
      : typeof metadata.title === "string"
        ? metadata.title
        : url;
  const snippet =
    typeof record.description === "string"
      ? record.description
      : typeof metadata.description === "string"
        ? metadata.description
        : "";
  return { title, url, snippet };
}

function extractMarkdown(response: unknown): string | undefined {
  if (typeof response !== "object" || response === null) return undefined;
  const record = response as Record<string, unknown>;
  if (typeof record.markdown === "string") return record.markdown;
  const data = record.data;
  if (typeof data === "object" && data !== null) {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.markdown === "string") return dataRecord.markdown;
  }
  return undefined;
}

async function webSearch(
  ctx: ActionCtx,
  query: string,
  limit: number,
): Promise<Array<WebHit>> {
  try {
    const res = await firecrawl.search(ctx, query, { limit });
    const hits = (res.web ?? [])
      .map(readHit)
      .filter((h): h is WebHit => h !== null);
    if (hits.length > 0) return hits;
  } catch (error) {
    console.warn("research web_search: Firecrawl failed", error);
  }
  const res = await contextDev.search(ctx, {
    body: { query, numResults: limit },
  });
  return res.results.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    snippet: r.description,
  }));
}

async function readUrl(
  ctx: ActionCtx,
  url: string,
): Promise<{ title: string; markdown: string }> {
  try {
    const res = await firecrawl.scrape(ctx, url, {
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: WEB_CACHE_MS,
    });
    const markdown = extractMarkdown(res);
    if (markdown && markdown.trim()) {
      return { title: readHit(res)?.title ?? url, markdown };
    }
  } catch (error) {
    console.warn("research read_url: Firecrawl failed", error);
  }
  const res = await contextDev.scrapeMarkdown(ctx, {
    params: { url, useMainContentOnly: true, maxAgeMs: WEB_CACHE_MS },
  });
  return { title: res.metadata?.title || url, markdown: res.markdown };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// --- System prompt ---

function systemPrompt(run: {
  groupName: string;
  model: string;
  overview: string;
  rules: string;
  leaderboard: string;
}): string {
  return `You are the research analyst for the "${run.groupName}" judging group on VibeApps (${SITE_URL}). Admins ask you to compare submissions, explain rankings, and recommend winners.

You know this group through tools:
- search_submissions: full text search over every submission dossier (title, team, description, links, form answers, human scores and comments, AI review). Use it to find candidates by topic, tech, or keyword.
- get_submissions: full dossiers by story id. Always read dossiers before making claims about specific submissions.
- get_leaderboard: live rankings. "human" is the official judge ranking, "ai" is the AI judge ranking, "combined" compares both on a 10 point scale, "roster" lists every submission with ids.
- web_search and read_url: the public web. Use them for repos, live apps, social posts, or outside context. Never invent web facts.

Rules:
- Ground every claim in tool output or the context below. If data is missing (for example no human scores yet), say so plainly.
- Human judge results are the official outcome. AI judge results are advisory. Say which one you are using.
- For eligibility, criteria, and rubric questions, use the rules and rubric section below. Organizer rules and context there take priority. If a rule is not written down, say so instead of guessing.
- When ranking or picking winners, give a short reason per pick that cites scores, judge comments, or AI reasoning.
- Link submissions as [Title](${SITE_URL}/s/slug) using the links from the dossiers. Include repo and live links when relevant.
- Never reveal judge emails or private contact info.
- Write clean GitHub flavored Markdown: short headings, tables for comparisons, tight bullets. No emoji.
- Be direct. Lead with the answer, then the evidence.

You are running on ${researchModelLabel(run.model)}.

# Group overview
${run.overview}

${run.rules}

# Top of the combined leaderboard (live)
${run.leaderboard}`;
}

// --- The agent ---

export const respond = internalAction({
  args: { messageId: v.id("researchMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.runQuery(internal.researchAgent.loadRunContext, {
      messageId: args.messageId,
    });
    if (!run) {
      await ctx.runMutation(internal.researchAgent.fail, {
        messageId: args.messageId,
        content: "",
        error: "Research is off for this group or the message was removed.",
      });
      return null;
    }

    const groupId: Id<"judgingGroups"> = run.groupId;
    const messageId = args.messageId;
    const controller = new AbortController();
    let stepCounter = 0;

    // Wrap a tool body so every call shows up as a live step in the UI
    async function traced<T>(
      name: string,
      label: string,
      body: () => Promise<T>,
    ): Promise<T> {
      stepCounter += 1;
      const id = `${name}-${stepCounter}`;
      await ctx.runMutation(internal.researchAgent.recordToolStep, {
        messageId,
        step: { id, tool: name, label, status: "running" },
      });
      try {
        const result = await body();
        await ctx.runMutation(internal.researchAgent.recordToolStep, {
          messageId,
          step: { id, tool: name, label, status: "done" },
        });
        return result;
      } catch (error) {
        await ctx.runMutation(internal.researchAgent.recordToolStep, {
          messageId,
          step: { id, tool: name, label, status: "error" },
        });
        throw error;
      }
    }

    const tools = {
      search_submissions: tool({
        description:
          "Full text search over this group's submission dossiers. Returns story ids, titles, and excerpts.",
        inputSchema: z.object({
          query: z.string().min(1).describe("Keywords, topic, tech, or name"),
          limit: z.number().int().min(1).max(15).optional(),
        }),
        execute: async ({ query, limit }) =>
          await traced("search_submissions", `Searched submissions for "${query}"`, async () =>
            await ctx.runQuery(internal.researchAgent.searchDocs, {
              groupId,
              query,
              limit: limit ?? 8,
            }),
          ),
      }),
      get_submissions: tool({
        description: `Full dossiers for up to ${MAX_DOSSIERS_PER_CALL} submissions by story id (ids come from search or the roster).`,
        inputSchema: z.object({
          storyIds: z.array(z.string()).min(1).max(MAX_DOSSIERS_PER_CALL),
        }),
        execute: async ({ storyIds }) =>
          await traced(
            "get_submissions",
            `Read ${storyIds.length} submission${storyIds.length === 1 ? "" : "s"}`,
            async () =>
              await ctx.runQuery(internal.researchAgent.getDossiers, {
                groupId,
                storyIds,
              }),
          ),
      }),
      get_leaderboard: tool({
        description:
          "Live rankings for this group: human (official judges), ai (AI judge), combined (both side by side), or roster (every submission with ids).",
        inputSchema: z.object({
          board: z.enum(["human", "ai", "combined", "roster"]),
          limit: z.number().int().min(1).max(300).optional(),
        }),
        execute: async ({ board, limit }) =>
          await traced(
            "get_leaderboard",
            `Loaded the ${board} leaderboard`,
            async () =>
              await ctx.runQuery(internal.researchAgent.getLeaderboard, {
                groupId,
                board,
                limit: limit ?? 25,
              }),
          ),
      }),
      web_search: tool({
        description:
          "Search the public web. Returns titles, urls, and snippets.",
        inputSchema: z.object({
          query: z.string().min(1),
          limit: z.number().int().min(1).max(8).optional(),
        }),
        execute: async ({ query, limit }) =>
          await traced("web_search", `Searched the web for "${query}"`, async () => {
            const hits = await webSearch(ctx, query, limit ?? 5);
            await ctx.runMutation(internal.researchAgent.addSources, {
              messageId,
              sources: hits.map((h) => ({ title: h.title, url: h.url })),
            });
            return hits;
          }),
      }),
      read_url: tool({
        description:
          "Read a public web page (repo README, live app, blog, social post) as Markdown.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) =>
          await traced("read_url", `Read ${hostOf(url)}`, async () => {
            const page = await readUrl(ctx, url);
            await ctx.runMutation(internal.researchAgent.addSources, {
              messageId,
              sources: [{ title: page.title, url }],
            });
            return {
              title: page.title,
              markdown: page.markdown.slice(0, WEB_PAGE_CHARS),
            };
          }),
      }),
    };

    const messages: Array<ModelMessage> = run.history.map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.content },
    );

    let text = "";
    let lastFlush = 0;
    let stopped = false;
    let streamError: string | null = null;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;

    // Push the running text; abort the model call when Stop was pressed
    async function flush(force: boolean): Promise<void> {
      const now = Date.now();
      if (!force && now - lastFlush < FLUSH_INTERVAL_MS) return;
      lastFlush = now;
      const { stop } = await ctx.runMutation(
        internal.researchAgent.appendChunk,
        { messageId, content: text },
      );
      if (stop && !stopped) {
        stopped = true;
        controller.abort();
      }
    }

    try {
      const result = streamText({
        model: convexGateway(run.model),
        system: systemPrompt(run),
        messages,
        tools,
        stopWhen: isStepCount(MAX_STEPS),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: controller.signal,
      });

      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          text += part.text;
          await flush(false);
        } else if (part.type === "start-step") {
          // Separate prose from consecutive steps
          if (text && !text.endsWith("\n\n")) text += "\n\n";
          await flush(true);
        } else if (part.type === "error") {
          streamError = errorText(part.error);
        } else if (part.type === "finish") {
          usage = {
            inputTokens: part.totalUsage.inputTokens,
            outputTokens: part.totalUsage.outputTokens,
          };
        }
        if (stopped) break;
      }
    } catch (error) {
      if (!(stopped || isAbort(error))) streamError = errorText(error);
    }

    text = text.trim();
    if (stopped || (!streamError && text)) {
      await ctx.runMutation(internal.researchAgent.finish, {
        messageId,
        content: text,
        stopped,
        usage,
      });
    } else {
      console.error("research respond failed", {
        messageId,
        model: run.model,
        error: streamError,
      });
      await ctx.runMutation(internal.researchAgent.fail, {
        messageId,
        content: text,
        error: streamError
          ? `The model call failed: ${streamError}`
          : "The model returned an empty answer. Try again or pick another model.",
      });
    }
    return null;
  },
});

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "a page";
  }
}
