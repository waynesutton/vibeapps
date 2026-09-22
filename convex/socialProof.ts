import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireJudgingGroupPermission } from "./adminAccess";
import {
  classifySocialUrl,
  socialPlatformLabel,
  type SocialLinkInfo,
} from "./lib/socialLinks";

// Social proof snapshots for judging.
// A submission can carry a LinkedIn link and an X/Bluesky link. This module
// turns each into one stored snapshot (post text, author, date, likes,
// reposts, replies when the platform exposes them) so the AI judge prompt and
// every human judge see the same numbers captured at the same moment.
//
// Sources, in order of preference per platform:
//   X post       Firecrawl x-twitter engine (metrics), oEmbed fallback (text only)
//   Bluesky post public AppView API (metrics, no key)
//   LinkedIn     reachability only; LinkedIn blocks automated reads
//   Profile URL  no network call; recorded as profile_only
// Views are never collected: only the paid X API exposes them and LinkedIn
// never does, so a views based score would be unfair across platforms.

// Reuse a stored snapshot for the same URL within this window
const SOCIAL_CACHE_MS = 24 * 60 * 60 * 1000;
// Per request timeout so a slow host can never stall the review
const FETCH_TIMEOUT_MS = 15000;
// Post text caps: stored row and prompt excerpt
const MAX_STORED_TEXT_CHARS = 4000;
export const MAX_PROMPT_TEXT_CHARS = 1500;

export const SOCIAL_FIELDS = ["linkedinUrl", "twitterUrl"] as const;
export type SocialField = (typeof SOCIAL_FIELDS)[number];

type SnapshotStatus =
  | "completed"
  | "liveness_only"
  | "profile_only"
  | "failed"
  | "unsupported";
type SnapshotSource = "firecrawl-x" | "oembed" | "bsky-api" | "http-head" | "none";

const snapshotFields = {
  storyId: v.id("stories"),
  field: v.union(v.literal("linkedinUrl"), v.literal("twitterUrl")),
  url: v.string(),
  platform: v.union(
    v.literal("x"),
    v.literal("bluesky"),
    v.literal("linkedin"),
    v.literal("other"),
  ),
  kind: v.union(v.literal("post"), v.literal("profile"), v.literal("unknown")),
  status: v.union(
    v.literal("completed"),
    v.literal("liveness_only"),
    v.literal("profile_only"),
    v.literal("failed"),
    v.literal("unsupported"),
  ),
  live: v.boolean(),
  source: v.union(
    v.literal("firecrawl-x"),
    v.literal("oembed"),
    v.literal("bsky-api"),
    v.literal("http-head"),
    v.literal("none"),
  ),
  text: v.optional(v.string()),
  author: v.optional(v.string()),
  postedAt: v.optional(v.number()),
  likes: v.optional(v.number()),
  reposts: v.optional(v.number()),
  replies: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  fetchedAt: v.number(),
};

const snapshotDoc = v.object({
  _id: v.id("socialProofSnapshots"),
  _creationTime: v.number(),
  ...snapshotFields,
});

// Snapshot shape without ids, what the fetcher produces and the prompt reads
export type SocialProofEntry = {
  field: SocialField;
  url: string;
  platform: SocialLinkInfo["platform"];
  kind: SocialLinkInfo["kind"];
  status: SnapshotStatus;
  live: boolean;
  source: SnapshotSource;
  text?: string;
  author?: string;
  postedAt?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
  errorMessage?: string;
  fetchedAt: number;
};

// Shape handed to the AI judge prompt builder
export type SocialProofContext = {
  entries: Array<SocialProofEntry>;
  // True when at least one snapshot captured post content
  included: boolean;
};

/**
 * All stored snapshots for a story (at most one per social field).
 */
export const getForStory = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.array(snapshotDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialProofSnapshots")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
  },
});

/**
 * Upsert the snapshot for a story and field. Idempotent: one row per pair.
 */
export const save = internalMutation({
  args: snapshotFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("socialProofSnapshots")
      .withIndex("by_story_field", (q) =>
        q.eq("storyId", args.storyId).eq("field", args.field),
      )
      .unique();
    if (existing) {
      // Full replace so a refetch never keeps stale metrics from the old row
      await ctx.db.replace(existing._id, args);
    } else {
      await ctx.db.insert("socialProofSnapshots", args);
    }
    return null;
  },
});

/**
 * Social links for one story, read by the refresh action.
 */
export const getStorySocialLinks = internalQuery({
  args: { storyId: v.id("stories") },
  returns: v.union(
    v.null(),
    v.object({
      linkedinUrl: v.optional(v.string()),
      twitterUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;
    return { linkedinUrl: story.linkedinUrl, twitterUrl: story.twitterUrl };
  },
});

// Judge session lookup, same rule as judgingGroupSubmissions: the session
// must exist and belong to the group being viewed.
async function requireJudgeSession(
  ctx: QueryCtx,
  sessionId: string,
  groupId: Id<"judgingGroups">,
): Promise<Doc<"judges">> {
  const judge = await ctx.db
    .query("judges")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .unique();
  if (!judge || judge.groupId !== groupId) {
    throw new Error("Judge session not found");
  }
  return judge;
}

/**
 * Snapshots for a story, for the judge interface (judge session) or the
 * admin AI results view (judging.ai permission). Returns an empty array when
 * nothing has been captured yet so the UI can fall back to plain links.
 */
export const getSocialProofForStory = query({
  args: {
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
    sessionId: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      field: v.union(v.literal("linkedinUrl"), v.literal("twitterUrl")),
      url: v.string(),
      platform: snapshotFields.platform,
      kind: snapshotFields.kind,
      status: snapshotFields.status,
      live: v.boolean(),
      source: snapshotFields.source,
      text: v.optional(v.string()),
      author: v.optional(v.string()),
      postedAt: v.optional(v.number()),
      likes: v.optional(v.number()),
      reposts: v.optional(v.number()),
      replies: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      fetchedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.sessionId) {
      await requireJudgeSession(ctx, args.sessionId, args.groupId);
    } else {
      await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    }
    // The story must be in this group; otherwise a judge could read any story
    const membership = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId_storyId", (q) =>
        q.eq("groupId", args.groupId).eq("storyId", args.storyId),
      )
      .unique();
    if (!membership) return [];

    const rows = await ctx.db
      .query("socialProofSnapshots")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();
    return rows.map((row) => ({
      field: row.field,
      url: row.url,
      platform: row.platform,
      kind: row.kind,
      status: row.status,
      live: row.live,
      source: row.source,
      text: row.text,
      author: row.author,
      postedAt: row.postedAt,
      likes: row.likes,
      reposts: row.reposts,
      replies: row.replies,
      errorMessage: row.errorMessage,
      fetchedAt: row.fetchedAt,
    }));
  },
});

/**
 * Admin: re snapshot every submission in a group right now, bypassing the
 * cache. This is the fairness control: run it once when submissions close so
 * every team's engagement is measured at the same moment. Returns how many
 * submissions were scheduled.
 */
export const refreshSocialProofForGroup = mutation({
  args: { groupId: v.id("judgingGroups") },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new ConvexError("Judging group not found");

    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    let scheduled = 0;
    for (const submission of submissions) {
      const story = await ctx.db.get(submission.storyId);
      if (!story) continue;
      // Only stories that carry at least one social link need a fetch
      if (!story.linkedinUrl?.trim() && !story.twitterUrl?.trim()) continue;
      await ctx.scheduler.runAfter(
        // Light stagger so a large group does not hit one host all at once
        scheduled * 400,
        internal.socialProof.refreshSocialProofForStory,
        { storyId: submission.storyId },
      );
      scheduled += 1;
    }
    return scheduled;
  },
});

/**
 * Re snapshot one story's social links, ignoring the cache window.
 */
export const refreshSocialProofForStory = internalAction({
  args: { storyId: v.id("stories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const links = await ctx.runQuery(internal.socialProof.getStorySocialLinks, {
      storyId: args.storyId,
    });
    if (!links) return null;
    await fetchSocialProofContext(ctx, args.storyId, links, { force: true });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// "1,234", "1.2K", "3M" -> number; anything else -> undefined
function parseCount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/,/g, "");
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KkMm])?$/);
  if (!match) return undefined;
  const base = parseFloat(match[1]);
  if (!Number.isFinite(base)) return undefined;
  const unit = match[2]?.toUpperCase();
  const value = unit === "K" ? base * 1000 : unit === "M" ? base * 1_000_000 : base;
  return Math.round(value);
}

function capText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_STORED_TEXT_CHARS
    ? trimmed.slice(0, MAX_STORED_TEXT_CHARS) + "\n... (truncated)"
    : trimmed;
}

// Strip HTML tags and decode the handful of entities oEmbed uses
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

type FetchOutcome = Omit<SocialProofEntry, "field" | "url" | "fetchedAt">;

// Firecrawl escapes markdown punctuation ("convex\_dev", "2024\-09\-06").
// Undo that before parsing labels, numbers, and dates.
function unescapeMarkdown(markdown: string): string {
  return markdown.replace(/\\([_\-.,*#|[\]()~`>])/g, "$1");
}

// Pull a labeled count out of Firecrawl's x-twitter markdown. The engine
// writes "Likes: 42 | Retweets: 7" on one line; the regex accepts a label at
// line start or after a pipe, with optional bold markers and bullets.
function extractMetric(markdown: string, labels: Array<string>): number | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `(?:^|\\n|\\|)[\\s*-]*\\**${label}\\**\\s*[:-]\\s*\\**([\\d,.]+\\s*[KkMm]?)`,
      "i",
    );
    const match = markdown.match(re);
    const parsed = parseCount(match?.[1]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

// Post body: the "## Post" (or "## Tweet") section when present, otherwise
// the markdown minus metric and metadata lines
function extractPostText(markdown: string): string | undefined {
  const section = markdown.match(
    /(?:^|\n)#{1,3}\s*(?:Post|Tweet|Thread)\s*\n([\s\S]*?)(?=\n#{1,3}\s|\s*$)/i,
  );
  if (section?.[1]?.trim()) return section[1].trim();
  const body = markdown
    .split("\n")
    .filter(
      (line) =>
        !/^\s*[-*]*\s*\**(Likes|Retweets|Reposts|Replies|Quotes|Bookmarks|Views|Author|Date|Posted|URL)\**\s*[:-]/i.test(
          line,
        ),
    )
    .join("\n")
    .trim();
  return body || undefined;
}

function extractAuthor(markdown: string): string | undefined {
  const match = markdown.match(
    /(?:^|\n)[\s*-]*\**(?:Author|By|Name)\**\s*[:-]\s*\**([^\n*]+)/i,
  );
  const author = match?.[1]?.trim();
  if (author) return author;
  // Common heading form: "# Display Name (@handle)"
  const heading = markdown.match(/(?:^|\n)#\s+([^\n]+@[\w]+\)?)/);
  return heading?.[1]?.trim();
}

function extractPostedAt(markdown: string): number | undefined {
  const match = markdown.match(
    /(?:^|\n)[\s*-]*\**(?:Date|Posted|Published|Created)\**\s*[:-]\s*\**([^\n*]+)/i,
  );
  const raw = match?.[1]?.trim();
  if (!raw) return undefined;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

// Parsed fields from one x-twitter engine response. Exported so the parser
// can be checked against captured markdown without a network call.
export function parseXMarkdown(rawMarkdown: string): {
  text?: string;
  author?: string;
  postedAt?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
} {
  const markdown = unescapeMarkdown(rawMarkdown);
  return {
    text: capText(extractPostText(markdown)),
    author: extractAuthor(markdown),
    postedAt: extractPostedAt(markdown),
    likes: extractMetric(markdown, ["Likes", "Like count", "Favorites"]),
    reposts: extractMetric(markdown, ["Retweets", "Reposts", "Repost count"]),
    replies: extractMetric(markdown, ["Replies", "Reply count", "Comments"]),
  };
}

// X post via Firecrawl's dedicated x-twitter engine. Returns null when the
// key is missing so the caller can fall through to oEmbed.
async function fetchXViaFirecrawl(url: string): Promise<FetchOutcome | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });
    if (!res.ok) {
      return {
        platform: "x",
        kind: "post",
        status: "failed",
        live: res.status !== 404,
        source: "firecrawl-x",
        errorMessage: `Firecrawl HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        markdown?: string;
        metadata?: { title?: string; statusCode?: number; author?: string };
      };
    };
    const markdown = json.data?.markdown ?? "";
    if (!markdown.trim()) {
      return {
        platform: "x",
        kind: "post",
        status: "failed",
        live: json.data?.metadata?.statusCode !== 404,
        source: "firecrawl-x",
        errorMessage: "Firecrawl returned no content for this post",
      };
    }
    const parsed = parseXMarkdown(markdown);
    return {
      platform: "x",
      kind: "post",
      status: "completed",
      live: true,
      source: "firecrawl-x",
      ...parsed,
      author: parsed.author ?? json.data?.metadata?.author,
    };
  } catch (error) {
    return {
      platform: "x",
      kind: "post",
      status: "failed",
      live: false,
      source: "firecrawl-x",
      errorMessage:
        error instanceof Error ? error.message : "Firecrawl request failed",
    };
  }
}

// X post via the public oEmbed endpoint: text, author, and date, no metrics.
// A 404 here means the post is gone or private.
async function fetchXViaOembed(url: string): Promise<FetchOutcome> {
  try {
    const res = await fetchWithTimeout(
      `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`,
    );
    if (res.status === 404) {
      return {
        platform: "x",
        kind: "post",
        status: "failed",
        live: false,
        source: "oembed",
        errorMessage: "Post not found (deleted, private, or wrong URL)",
      };
    }
    if (!res.ok) {
      return {
        platform: "x",
        kind: "post",
        status: "failed",
        live: true,
        source: "oembed",
        errorMessage: `oEmbed HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      author_name?: string;
      author_url?: string;
      html?: string;
    };
    const html = json.html ?? "";
    const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
    // The trailing anchor is the post date, e.g. "September 20, 2026"
    const dateText = html.match(/<a href="https?:\/\/(?:twitter|x)\.com\/[^"]+\/status\/\d+[^"]*">([^<]+)<\/a>\s*<\/blockquote>/i)?.[1];
    const postedAt = dateText ? new Date(dateText).getTime() : NaN;
    return {
      platform: "x",
      kind: "post",
      status: "completed",
      live: true,
      source: "oembed",
      text: capText(htmlToText(paragraph)),
      author: json.author_name,
      postedAt: Number.isNaN(postedAt) ? undefined : postedAt,
    };
  } catch (error) {
    return {
      platform: "x",
      kind: "post",
      status: "failed",
      live: false,
      source: "oembed",
      errorMessage: error instanceof Error ? error.message : "oEmbed request failed",
    };
  }
}

// Bluesky post via the public AppView. Handles resolve to a DID first unless
// the URL already carries one.
async function fetchBlueskyPost(info: SocialLinkInfo): Promise<FetchOutcome> {
  const base = "https://public.api.bsky.app/xrpc";
  try {
    let did = info.handle ?? "";
    if (!did.startsWith("did:")) {
      const resolveRes = await fetchWithTimeout(
        `${base}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(did)}`,
      );
      if (!resolveRes.ok) {
        return {
          platform: "bluesky",
          kind: "post",
          status: "failed",
          live: false,
          source: "bsky-api",
          errorMessage: `Could not resolve Bluesky handle (HTTP ${resolveRes.status})`,
        };
      }
      const resolved = (await resolveRes.json()) as { did?: string };
      if (!resolved.did) {
        return {
          platform: "bluesky",
          kind: "post",
          status: "failed",
          live: false,
          source: "bsky-api",
          errorMessage: "Bluesky handle resolution returned no DID",
        };
      }
      did = resolved.did;
    }
    const uri = `at://${did}/app.bsky.feed.post/${info.postId}`;
    const threadRes = await fetchWithTimeout(
      `${base}/app.bsky.feed.getPostThread?depth=0&parentHeight=0&uri=${encodeURIComponent(uri)}`,
    );
    if (!threadRes.ok) {
      return {
        platform: "bluesky",
        kind: "post",
        status: "failed",
        live: threadRes.status !== 404 && threadRes.status !== 400,
        source: "bsky-api",
        errorMessage:
          threadRes.status === 404 || threadRes.status === 400
            ? "Post not found (deleted or wrong URL)"
            : `Bluesky API HTTP ${threadRes.status}`,
      };
    }
    const json = (await threadRes.json()) as {
      thread?: {
        $type?: string;
        post?: {
          author?: { handle?: string; displayName?: string };
          record?: { text?: string; createdAt?: string };
          likeCount?: number;
          repostCount?: number;
          replyCount?: number;
          indexedAt?: string;
        };
      };
    };
    const post = json.thread?.post;
    if (!post) {
      return {
        platform: "bluesky",
        kind: "post",
        status: "failed",
        live: false,
        source: "bsky-api",
        errorMessage: "Post not found (blocked or deleted)",
      };
    }
    const author = post.author?.displayName
      ? `${post.author.displayName} (@${post.author.handle ?? info.handle})`
      : post.author?.handle
        ? `@${post.author.handle}`
        : undefined;
    const createdAt = post.record?.createdAt ?? post.indexedAt;
    const postedAt = createdAt ? new Date(createdAt).getTime() : NaN;
    return {
      platform: "bluesky",
      kind: "post",
      status: "completed",
      live: true,
      source: "bsky-api",
      text: capText(post.record?.text),
      author,
      postedAt: Number.isNaN(postedAt) ? undefined : postedAt,
      likes: post.likeCount,
      reposts: post.repostCount,
      replies: post.replyCount,
    };
  } catch (error) {
    return {
      platform: "bluesky",
      kind: "post",
      status: "failed",
      live: false,
      source: "bsky-api",
      errorMessage:
        error instanceof Error ? error.message : "Bluesky request failed",
    };
  }
}

// LinkedIn blocks automated reads and answers HTTP 200 (authwall) even for
// posts that do not exist, so a 200 proves nothing. Only an explicit 404 or
// 410 is a signal; everything else is recorded as unverified for a human.
async function checkLinkedInLiveness(url: string): Promise<FetchOutcome> {
  try {
    const res = await fetchWithTimeout(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VibeAppsJudge/1.0)" },
    });
    const gone = res.status === 404 || res.status === 410;
    return {
      platform: "linkedin",
      kind: "post",
      status: gone ? "failed" : "liveness_only",
      live: !gone,
      source: "http-head",
      errorMessage: gone
        ? `Post not found (HTTP ${res.status})`
        : "LinkedIn blocks automated reads; the post and its engagement must be verified by a human",
    };
  } catch (error) {
    return {
      platform: "linkedin",
      kind: "post",
      status: "failed",
      live: false,
      source: "http-head",
      errorMessage:
        error instanceof Error ? error.message : "LinkedIn request failed",
    };
  }
}

// Route one classified link to its fetcher. Never throws.
async function fetchOne(info: SocialLinkInfo): Promise<FetchOutcome> {
  if (info.kind === "profile") {
    return {
      platform: info.platform,
      kind: "profile",
      status: "profile_only",
      live: true,
      source: "none",
      errorMessage: `${socialPlatformLabel(info.platform)} profile link, not a post; nothing to measure`,
    };
  }
  if (info.kind === "unknown" || info.platform === "other") {
    return {
      platform: info.platform,
      kind: info.kind,
      status: "unsupported",
      live: false,
      source: "none",
      errorMessage: "Unrecognized social link",
    };
  }
  if (info.platform === "x") {
    const viaFirecrawl = await fetchXViaFirecrawl(info.normalizedUrl);
    if (viaFirecrawl && viaFirecrawl.status === "completed") return viaFirecrawl;
    const viaOembed = await fetchXViaOembed(info.normalizedUrl);
    // Keep the richer failure reason when both paths failed
    if (viaOembed.status === "failed" && viaFirecrawl?.errorMessage) {
      return {
        ...viaOembed,
        errorMessage: `${viaFirecrawl.errorMessage}; ${viaOembed.errorMessage ?? "oEmbed failed"}`,
      };
    }
    return viaOembed;
  }
  if (info.platform === "bluesky") return await fetchBlueskyPost(info);
  return await checkLinkedInLiveness(info.normalizedUrl);
}

function entryFromStored(row: Doc<"socialProofSnapshots">): SocialProofEntry {
  return {
    field: row.field,
    url: row.url,
    platform: row.platform,
    kind: row.kind,
    status: row.status,
    live: row.live,
    source: row.source,
    text: row.text,
    author: row.author,
    postedAt: row.postedAt,
    likes: row.likes,
    reposts: row.reposts,
    replies: row.replies,
    errorMessage: row.errorMessage,
    fetchedAt: row.fetchedAt,
  };
}

/**
 * Fetch (or reuse) social proof snapshots for a submission. Called from the
 * AI judge analysis action and the admin refresh. Never throws: every link
 * degrades to a recorded note so the prompt is never silent about a link
 * the builder supplied.
 */
export async function fetchSocialProofContext(
  ctx: ActionCtx,
  storyId: Id<"stories">,
  links: { linkedinUrl?: string; twitterUrl?: string },
  options: { force?: boolean } = {},
): Promise<SocialProofContext> {
  const wanted: Array<{ field: SocialField; url: string }> = [];
  for (const field of SOCIAL_FIELDS) {
    const url = links[field]?.trim();
    if (url) wanted.push({ field, url });
  }
  if (wanted.length === 0) return { entries: [], included: false };

  const now = Date.now();
  const stored = await ctx.runQuery(internal.socialProof.getForStory, { storyId });
  const storedByField = new Map(stored.map((row) => [row.field, row]));

  const entries = await Promise.all(
    wanted.map(async ({ field, url }): Promise<SocialProofEntry> => {
      const existing = storedByField.get(field);
      const fresh =
        existing &&
        existing.url === url &&
        now - existing.fetchedAt < SOCIAL_CACHE_MS &&
        existing.status !== "failed";
      if (fresh && !options.force) return entryFromStored(existing);

      const info = classifySocialUrl(url);
      const outcome = await fetchOne(info);
      const entry: SocialProofEntry = { field, url, ...outcome, fetchedAt: now };
      await ctx.runMutation(internal.socialProof.save, { storyId, ...entry });
      return entry;
    }),
  );

  return {
    entries,
    included: entries.some((e) => e.status === "completed"),
  };
}

// Render the snapshots as a prompt section. Facts only; the model is told
// elsewhere never to invent numbers the section does not contain.
export function formatSocialProofForPrompt(context: SocialProofContext): string {
  const lines: Array<string> = [];
  for (const e of context.entries) {
    const label = socialPlatformLabel(e.platform);
    const head = `${e.field === "linkedinUrl" ? "LinkedIn field" : "X/Bluesky field"}: ${e.url}`;
    if (e.kind === "profile") {
      lines.push(
        `${head}\n  ${label} profile page, not a post. A profile link alone is not evidence of a public launch post.`,
      );
      continue;
    }
    if (e.status === "unsupported") {
      lines.push(`${head}\n  Unrecognized link; nothing could be verified.`);
      continue;
    }
    if (e.status === "failed") {
      lines.push(
        `${head}\n  ${label} post: ${e.live ? "reachable but not readable" : "NOT FOUND"}. ${e.errorMessage ?? ""}`.trim(),
      );
      continue;
    }
    if (e.status === "liveness_only") {
      lines.push(
        `${head}\n  ${label} post link supplied. LinkedIn blocks automated reads and does not confirm whether a post exists, so the post and its engagement are UNVERIFIED. Give at most partial credit for a plausible launch post URL, write "unverified, human check needed" in the reasoning, and never assume engagement.`,
      );
      continue;
    }
    // completed
    const metrics: Array<string> = [];
    if (e.likes !== undefined) metrics.push(`likes ${e.likes}`);
    if (e.reposts !== undefined) metrics.push(`reposts ${e.reposts}`);
    if (e.replies !== undefined) metrics.push(`replies ${e.replies}`);
    const meta: Array<string> = [];
    if (e.author) meta.push(`author ${e.author}`);
    if (e.postedAt) meta.push(`posted ${new Date(e.postedAt).toISOString().slice(0, 10)}`);
    meta.push(
      metrics.length > 0
        ? metrics.join(", ")
        : "engagement metrics unavailable from this source (text only)",
    );
    const excerpt = e.text
      ? e.text.length > MAX_PROMPT_TEXT_CHARS
        ? e.text.slice(0, MAX_PROMPT_TEXT_CHARS) + " ..."
        : e.text
      : "(no text captured)";
    lines.push(`${head}\n  ${label} post, live. ${meta.join("; ")}.\n  Post text: ${excerpt}`);
  }
  return lines.join("\n\n");
}
