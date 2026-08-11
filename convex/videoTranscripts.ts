import { internalMutation, internalQuery, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ContextDev } from "@context-dot-dev/convex";
import { requireJudgingGroupPermission } from "./adminAccess";

// Video demo transcript scraping for the AI judge.
// Context.dev is the primary scraper: YouTube URLs return title, channel,
// duration, description, and the caption transcript when one exists. Other
// video host pages (Vimeo, Loom, Drive share pages) get a best effort page
// scrape via Context.dev with a Firecrawl fallback. Direct media files
// (.mp4 etc.) cannot be scraped and are recorded as unsupported.
// Everything captured here is unverified builder narrative: it may inform
// scores but never overrides verified repo facts.

// Stored markdown cap: transcripts can be long; keep rows well under limits.
const MAX_STORED_TRANSCRIPT_CHARS = 15000;
// Reuse a stored transcript for the same URL within this window.
const TRANSCRIPT_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
// Context.dev server-side cache hint (1 day) so refetches stay cheap.
const CONTEXT_DEV_MAX_AGE_MS = 86400000;

export type VideoTranscriptKind = "youtube" | "page" | "unsupported";
export type VideoTranscriptStatus =
  | "completed"
  | "no_transcript"
  | "failed"
  | "unsupported";

// Shape handed to the AI judge prompt builder
export type VideoContext = {
  // True when we have markdown worth including in the prompt
  included: boolean;
  kind: VideoTranscriptKind | "none";
  status: VideoTranscriptStatus | "skipped";
  markdown: string;
  // Short human-readable note for the prompt when no markdown is available
  note: string;
};

const transcriptFields = {
  storyId: v.id("stories"),
  videoUrl: v.string(),
  provider: v.union(v.literal("contextdev"), v.literal("firecrawl")),
  kind: v.union(v.literal("youtube"), v.literal("page"), v.literal("unsupported")),
  status: v.union(
    v.literal("completed"),
    v.literal("no_transcript"),
    v.literal("failed"),
    v.literal("unsupported"),
  ),
  markdown: v.optional(v.string()),
  metadata: v.optional(
    v.object({
      title: v.optional(v.string()),
      channel: v.optional(v.string()),
      durationSeconds: v.optional(v.number()),
    }),
  ),
  contentLength: v.number(),
  errorMessage: v.optional(v.string()),
  fetchedAt: v.number(),
};

/**
 * Latest stored transcript for a story (one row per story, upserted).
 */
export const getForStory = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("videoTranscripts"),
      _creationTime: v.number(),
      ...transcriptFields,
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoTranscripts")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .unique();
  },
});

/**
 * Upsert the transcript row for a story. Idempotent: one row per story.
 */
export const save = internalMutation({
  args: transcriptFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videoTranscripts")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        videoUrl: args.videoUrl,
        provider: args.provider,
        kind: args.kind,
        status: args.status,
        markdown: args.markdown,
        metadata: args.metadata,
        contentLength: args.contentLength,
        errorMessage: args.errorMessage,
        fetchedAt: args.fetchedAt,
      });
    } else {
      await ctx.db.insert("videoTranscripts", args);
    }
    return null;
  },
});

/**
 * Admin view of a stored transcript, gated by the same judging.ai permission
 * as the AI results dashboard.
 */
export const getTranscriptForStory = query({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
  },
  returns: v.union(
    v.null(),
    v.object({
      videoUrl: v.string(),
      provider: v.union(v.literal("contextdev"), v.literal("firecrawl")),
      kind: v.union(
        v.literal("youtube"),
        v.literal("page"),
        v.literal("unsupported"),
      ),
      status: v.union(
        v.literal("completed"),
        v.literal("no_transcript"),
        v.literal("failed"),
        v.literal("unsupported"),
      ),
      markdown: v.optional(v.string()),
      title: v.optional(v.string()),
      contentLength: v.number(),
      errorMessage: v.optional(v.string()),
      fetchedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    const row = await ctx.db
      .query("videoTranscripts")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .unique();
    if (!row) return null;
    return {
      videoUrl: row.videoUrl,
      provider: row.provider,
      kind: row.kind,
      status: row.status,
      markdown: row.markdown,
      title: row.metadata?.title,
      contentLength: row.contentLength,
      errorMessage: row.errorMessage,
      fetchedAt: row.fetchedAt,
    };
  },
});

// Single YouTube video URL patterns handled first class by Context.dev
// (/watch, youtu.be, /shorts, /embed, /live). Channel URLs are not videos.
const YOUTUBE_VIDEO_REGEX =
  /(?:youtube\.com\/(?:shorts\/|live\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;

// Direct media files: not scrapeable as pages (Context.dev returns 415)
const DIRECT_MEDIA_REGEX = /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)(\?|#|$)/i;

// Classify a submission's video URL for scraping strategy
export function classifyVideoUrl(url: string): VideoTranscriptKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unsupported";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "unsupported";
  }
  if (YOUTUBE_VIDEO_REGEX.test(url)) return "youtube";
  if (DIRECT_MEDIA_REGEX.test(parsed.pathname)) return "unsupported";
  return "page";
}

const contextDev = new ContextDev(components.contextDev);

type ScrapeAttempt = {
  ok: boolean;
  markdown: string;
  title?: string;
  error?: string;
};

// Scrape via the Context.dev component (skipped when the key is not set)
async function scrapeWithContextDev(
  ctx: ActionCtx,
  url: string,
): Promise<ScrapeAttempt | null> {
  if (!process.env.CONTEXT_DEV_API_KEY) return null;
  try {
    const res = await contextDev.scrapeMarkdown(ctx, {
      params: {
        url,
        useMainContentOnly: true,
        maxAgeMs: CONTEXT_DEV_MAX_AGE_MS,
      },
    });
    return {
      ok: res.markdown.length > 0,
      markdown: res.markdown,
      title: res.metadata?.title,
    };
  } catch (error) {
    return {
      ok: false,
      markdown: "",
      error: error instanceof Error ? error.message : "Context.dev scrape failed",
    };
  }
}

// Firecrawl fallback for non-YouTube video host pages. Uses the same direct
// REST pattern as the AI judge's live URL scrape.
async function scrapeWithFirecrawl(url: string): Promise<ScrapeAttempt | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) {
      return { ok: false, markdown: "", error: `Firecrawl HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: { markdown?: string; metadata?: { title?: string } };
    };
    const markdown = json.data?.markdown || "";
    return {
      ok: markdown.length > 0,
      markdown,
      title: json.data?.metadata?.title,
    };
  } catch (error) {
    return {
      ok: false,
      markdown: "",
      error: error instanceof Error ? error.message : "Firecrawl scrape failed",
    };
  }
}

// YouTube responses include the caption transcript when one exists; a
// transcript-bearing response has a transcript heading or is substantially
// longer than metadata-only output.
function looksLikeTranscript(markdown: string): boolean {
  if (/^#{1,6}\s*transcript/im.test(markdown)) return true;
  if (/\btranscript\b/i.test(markdown) && markdown.length > 1500) return true;
  // No labeled section: treat long bodies as transcript-bearing
  return markdown.length > 4000;
}

function capMarkdown(markdown: string): string {
  return markdown.length > MAX_STORED_TRANSCRIPT_CHARS
    ? markdown.slice(0, MAX_STORED_TRANSCRIPT_CHARS) + "\n... (truncated)"
    : markdown;
}

/**
 * Fetch (or reuse) the video demo context for a submission. Called from the
 * AI judge analysis action. Never throws: a failed scrape degrades to a
 * prompt note, exactly like the live URL scrape.
 */
export async function fetchVideoContext(
  ctx: ActionCtx,
  storyId: Id<"stories">,
  videoUrl: string | undefined,
): Promise<VideoContext> {
  const url = videoUrl?.trim();
  if (!url) {
    return {
      included: false,
      kind: "none",
      status: "skipped",
      markdown: "",
      note: "No video submitted.",
    };
  }

  const kind = classifyVideoUrl(url);
  const now = Date.now();

  // Reuse a fresh stored transcript for the same URL
  const existing = await ctx.runQuery(internal.videoTranscripts.getForStory, {
    storyId,
  });
  if (
    existing &&
    existing.videoUrl === url &&
    now - existing.fetchedAt < TRANSCRIPT_CACHE_MS &&
    existing.status !== "failed"
  ) {
    return contextFromStored(existing.kind, existing.status, existing.markdown ?? "");
  }

  if (kind === "unsupported") {
    await ctx.runMutation(internal.videoTranscripts.save, {
      storyId,
      videoUrl: url,
      provider: "contextdev",
      kind: "unsupported",
      status: "unsupported",
      contentLength: 0,
      errorMessage: "Direct media file or unrecognized URL; no page to scrape",
      fetchedAt: now,
    });
    return {
      included: false,
      kind: "unsupported",
      status: "unsupported",
      markdown: "",
      note: "Video provided as a direct media file; no transcript is available.",
    };
  }

  // Scrape: Context.dev first, Firecrawl fallback for non-YouTube pages.
  // Firecrawl cannot extract YouTube captions, so it is not used for YouTube.
  let attempt = await scrapeWithContextDev(ctx, url);
  let provider: "contextdev" | "firecrawl" = "contextdev";
  if ((!attempt || !attempt.ok) && kind === "page") {
    const fallback = await scrapeWithFirecrawl(url);
    if (fallback) {
      attempt = fallback;
      provider = "firecrawl";
    }
  }

  if (!attempt) {
    // Neither scraper is configured: skip without persisting a failure
    return {
      included: false,
      kind,
      status: "skipped",
      markdown: "",
      note: "Video URL provided but transcript scraping is not configured.",
    };
  }

  if (!attempt.ok) {
    await ctx.runMutation(internal.videoTranscripts.save, {
      storyId,
      videoUrl: url,
      provider,
      kind,
      status: "failed",
      contentLength: 0,
      errorMessage: attempt.error ?? "Scrape returned no content",
      fetchedAt: now,
    });
    return {
      included: false,
      kind,
      status: "failed",
      markdown: "",
      note: "Video URL provided but the transcript scrape failed.",
    };
  }

  const markdown = capMarkdown(attempt.markdown);
  const status: VideoTranscriptStatus =
    kind === "youtube" && !looksLikeTranscript(markdown)
      ? "no_transcript"
      : "completed";

  await ctx.runMutation(internal.videoTranscripts.save, {
    storyId,
    videoUrl: url,
    provider,
    kind,
    status,
    markdown,
    metadata: attempt.title ? { title: attempt.title } : undefined,
    contentLength: markdown.length,
    fetchedAt: now,
  });

  return contextFromStored(kind, status, markdown);
}

// Build the prompt-facing context from stored fields
function contextFromStored(
  kind: VideoTranscriptKind,
  status: VideoTranscriptStatus,
  markdown: string,
): VideoContext {
  if (!markdown) {
    return {
      included: false,
      kind,
      status,
      markdown: "",
      note:
        status === "no_transcript"
          ? "Video provided but it has no captions, so no transcript is available."
          : status === "unsupported"
            ? "Video provided as a direct media file; no transcript is available."
            : "Video URL provided but no content could be scraped.",
    };
  }
  return {
    included: true,
    kind,
    status,
    markdown,
    note:
      status === "no_transcript"
        ? "Video metadata only (the video has no captions, so no spoken transcript is included)."
        : kind === "youtube"
          ? "YouTube video metadata and caption transcript."
          : "Content scraped from the video host page (may include a transcript or description).",
  };
}
