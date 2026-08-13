// Pure builders for live discovery files. No Convex function registrations.
// HTTP routes in http.ts and the siteFiles cache rebuild both import these.

export const SITE_ORIGIN = "https://vibeapps.dev";
export const DIRECTORY_CAP = 2000;

export type PublicDirectoryStory = {
  title: string;
  slug: string;
  description: string;
  url: string;
  githubUrl?: string;
  votes: number;
  isPinned: boolean;
  createdAt: number;
  tags: Array<string>;
};

export type PublicDirectory = {
  stories: Array<PublicDirectoryStory>;
  newestCreatedAt: number | null;
};

export function isPublicStory(story: {
  status: string;
  isHidden: boolean;
  isSpam?: boolean;
  isArchived?: boolean;
}): boolean {
  if (story.status !== "approved") return false;
  if (story.isHidden === true) return false;
  if (story.isSpam === true) return false;
  if (story.isArchived === true) return false;
  return true;
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function oneLine(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max - 1).trimEnd() + "…";
}

function escapeMdLinkLabel(text: string): string {
  return text.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const SITE_PAGES: Array<{ title: string; path: string; description: string }> =
  [
    {
      title: "Home",
      path: "/",
      description:
        "Browse the latest apps submitted by the community, vote, and comment.",
    },
    {
      title: "Submit an app",
      path: "/submit",
      description: "Share what you have built with the Vibe Apps community.",
    },
    {
      title: "Search",
      path: "/search",
      description: "Search apps, tags, and creators across the site.",
    },
    {
      title: "Leaderboard",
      path: "/leaderboard",
      description:
        "Top apps and builders ranked by community votes and engagement.",
    },
  ];

export function buildRobotsTxt(baseUrl: string): string {
  const lines: Array<string> = [
    "# Vibe Apps robots.txt",
    "# Public directory files: /llms.txt and /vibeapps.md",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: anthropic-ai",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "",
    "User-agent: CCBot",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: Applebot-Extended",
    "Allow: /",
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    `LLMs: ${baseUrl}/llms.txt`,
    `# Markdown directory: ${baseUrl}/vibeapps.md`,
  ];
  return lines.join("\n") + "\n";
}

export function buildLlmsTxt(
  directory: PublicDirectory,
  baseUrl: string,
): string {
  const updated = directory.newestCreatedAt
    ? formatDay(directory.newestCreatedAt)
    : "unknown";
  const lines: Array<string> = [
    "# Vibe Apps",
    "",
    "> The place to share and discover new apps. A public directory of apps built with Convex, vibe coding, and modern AI tools.",
    "",
    "Vibe Apps lists community submitted apps that are approved and visible. Hidden, spam, and archived submissions are not included.",
    "",
    `This file lists ${directory.stories.length} public apps. Updated ${updated}.`,
    "",
    "Optional:",
    `- [Full markdown directory](${baseUrl}/vibeapps.md): title, tagline, live URL, GitHub, tags, and vibes for every public app`,
    `- [Sitemap](${baseUrl}/sitemap.xml)`,
    `- [Homepage](${baseUrl}/)`,
    "",
    "## Site",
    "",
  ];

  for (const page of SITE_PAGES) {
    lines.push(
      `- [${page.title}](${baseUrl}${page.path}): ${page.description}`,
    );
  }

  lines.push("", "## Apps", "");

  for (const story of directory.stories) {
    const label = escapeMdLinkLabel(story.title);
    const tagline = oneLine(story.description, 220);
    lines.push(`- [${label}](${baseUrl}/s/${story.slug}): ${tagline}`);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildVibeappsMd(
  directory: PublicDirectory,
  baseUrl: string,
): string {
  const updated = directory.newestCreatedAt
    ? formatDay(directory.newestCreatedAt)
    : "unknown";
  const lines: Array<string> = [
    "# Vibe Apps directory",
    "",
    `A live catalog of public apps on [Vibe Apps](${baseUrl}). Hidden, spam, and unpublished submissions are excluded.`,
    "",
    `${directory.stories.length} apps | Updated ${updated}`,
    "",
    "Agents: treat this file as the canonical directory. Each app links to its page on vibeapps.dev. Fetch `/llms.txt` for the shorter index.",
    "",
    "## Site",
    "",
  ];

  for (const page of SITE_PAGES) {
    lines.push(
      `- [${page.title}](${baseUrl}${page.path}): ${page.description}`,
    );
  }

  lines.push("", "## Apps", "");

  for (const story of directory.stories) {
    const label = escapeMdLinkLabel(story.title);
    lines.push(`### [${label}](${baseUrl}/s/${story.slug})`);
    lines.push("");
    lines.push(oneLine(story.description, 400));
    lines.push("");
    lines.push(`- Live app: ${story.url}`);
    if (story.githubUrl) {
      lines.push(`- GitHub: ${story.githubUrl}`);
    }
    if (story.tags.length > 0) {
      lines.push(`- Tags: ${story.tags.join(", ")}`);
    }
    lines.push(`- Vibes: ${story.votes}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`[View the full site](${baseUrl}/)`);
  lines.push("");
  return lines.join("\n");
}

export function buildSitemapXml(
  directory: PublicDirectory,
  baseUrl: string,
): string {
  const homepageLastmod = directory.newestCreatedAt
    ? isoDate(directory.newestCreatedAt)
    : "2026-01-01";

  const urls: Array<{
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: string;
  }> = [
    {
      loc: `${baseUrl}/`,
      lastmod: homepageLastmod,
      changefreq: "hourly",
      priority: "1.0",
    },
    {
      loc: `${baseUrl}/submit`,
      lastmod: homepageLastmod,
      changefreq: "weekly",
      priority: "0.8",
    },
    {
      loc: `${baseUrl}/search`,
      lastmod: homepageLastmod,
      changefreq: "weekly",
      priority: "0.6",
    },
    {
      loc: `${baseUrl}/leaderboard`,
      lastmod: homepageLastmod,
      changefreq: "daily",
      priority: "0.7",
    },
    {
      loc: `${baseUrl}/vibeapps.md`,
      lastmod: homepageLastmod,
      changefreq: "hourly",
      priority: "0.5",
    },
    {
      loc: `${baseUrl}/llms.txt`,
      lastmod: homepageLastmod,
      changefreq: "hourly",
      priority: "0.5",
    },
  ];

  for (const story of directory.stories) {
    urls.push({
      loc: `${baseUrl}/s/${story.slug}`,
      lastmod: isoDate(story.createdAt),
      changefreq: "weekly",
      priority: story.isPinned ? "0.9" : "0.6",
    });
  }

  const body = urls
    .map((entry) => {
      return [
        "  <url>",
        `    <loc>${xmlEscape(entry.loc)}</loc>`,
        `    <lastmod>${entry.lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
