// Pure URL classifier for the social proof links a submission can carry.
// Tells a launch post apart from a profile page on X, Bluesky, and LinkedIn
// so the fetcher knows what it can measure and the judge UI can label it.
// Mirrored in src/components/admin/judging/groupSection.tsx for the frontend;
// keep the two in sync.

export type SocialPlatform = "x" | "bluesky" | "linkedin" | "other";
export type SocialLinkKind = "post" | "profile" | "unknown";

export type SocialLinkInfo = {
  platform: SocialPlatform;
  kind: SocialLinkKind;
  normalizedUrl: string;
  // X status id or Bluesky record key when the URL is a post
  postId?: string;
  // Account handle when it appears in the path
  handle?: string;
};

// Hosts that map to each platform (www. is stripped before matching)
const X_HOSTS = new Set(["x.com", "twitter.com", "mobile.twitter.com"]);
const BLUESKY_HOSTS = new Set(["bsky.app"]);
const LINKEDIN_HOSTS = new Set(["linkedin.com"]);

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

export function classifySocialUrl(raw: string): SocialLinkInfo {
  const parsed = parseUrl(raw);
  if (!parsed) {
    return { platform: "other", kind: "unknown", normalizedUrl: raw.trim() };
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  // Drop tracking params; keep the path, which is what identifies a post
  const normalizedUrl = `https://${host}${parsed.pathname.replace(/\/+$/, "")}`;

  if (X_HOSTS.has(host)) {
    // x.com/<handle>/status/<id>[/...]
    const statusIdx = segments.indexOf("status");
    if (statusIdx === 1 && /^\d+$/.test(segments[2] ?? "")) {
      return {
        platform: "x",
        kind: "post",
        normalizedUrl: `https://x.com/${segments[0]}/status/${segments[2]}`,
        postId: segments[2],
        handle: segments[0],
      };
    }
    // Intent, search, hashtag, and similar pages are not a person's profile
    const reserved = new Set(["i", "intent", "search", "hashtag", "explore", "home"]);
    if (segments.length >= 1 && !reserved.has(segments[0])) {
      return {
        platform: "x",
        kind: "profile",
        normalizedUrl: `https://x.com/${segments[0]}`,
        handle: segments[0],
      };
    }
    return { platform: "x", kind: "unknown", normalizedUrl };
  }

  if (BLUESKY_HOSTS.has(host)) {
    // bsky.app/profile/<handle-or-did>/post/<rkey>
    if (segments[0] === "profile" && segments[1]) {
      if (segments[2] === "post" && segments[3]) {
        return {
          platform: "bluesky",
          kind: "post",
          normalizedUrl: `https://bsky.app/profile/${segments[1]}/post/${segments[3]}`,
          postId: segments[3],
          handle: segments[1],
        };
      }
      return {
        platform: "bluesky",
        kind: "profile",
        normalizedUrl: `https://bsky.app/profile/${segments[1]}`,
        handle: segments[1],
      };
    }
    return { platform: "bluesky", kind: "unknown", normalizedUrl };
  }

  if (LINKEDIN_HOSTS.has(host)) {
    // linkedin.com/posts/<slug>, linkedin.com/feed/update/urn:li:activity:<id>,
    // linkedin.com/pulse/<article-slug>
    if (
      segments[0] === "posts" ||
      (segments[0] === "feed" && segments[1] === "update") ||
      segments[0] === "pulse"
    ) {
      return { platform: "linkedin", kind: "post", normalizedUrl };
    }
    // linkedin.com/in/<handle> or linkedin.com/company/<slug>
    if ((segments[0] === "in" || segments[0] === "company") && segments[1]) {
      return {
        platform: "linkedin",
        kind: "profile",
        normalizedUrl,
        handle: segments[1],
      };
    }
    return { platform: "linkedin", kind: "unknown", normalizedUrl };
  }

  return { platform: "other", kind: "unknown", normalizedUrl };
}

// Human readable platform label shared by prompt text and UI copy
export function socialPlatformLabel(platform: SocialPlatform): string {
  switch (platform) {
    case "x":
      return "X";
    case "bluesky":
      return "Bluesky";
    case "linkedin":
      return "LinkedIn";
    default:
      return "Link";
  }
}
