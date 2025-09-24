import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getFile = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("siteFiles")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return existing?.content ?? null;
  },
});

function buildRobotsTxt(baseUrl: string): string {
  const lines: string[] = [];
  lines.push("User-agent: *");
  lines.push("Allow: /");
  lines.push("Crawl-delay: 5");
  lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);
  lines.push(`LLMs: ${baseUrl}/llms.txt`);
  return lines.join("\n") + "\n";
}

async function buildLlmsTxt(ctx: any, baseUrl: string): Promise<string> {
  const lines: string[] = [];
  lines.push("User-agent: *");
  lines.push("Allow: /");
  lines.push("");
  lines.push("# Story URLs for AI indexing");

  const stories = await ctx.db
    .query("stories")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("status"), "approved"),
        q.eq(q.field("isHidden"), false),
      ),
    )
    .collect();

  for (const story of stories) {
    const url = `${baseUrl}/s/${story.slug}`;
    lines.push(url);
  }

  return lines.join("\n") + "\n";
}

export const rebuild = internalMutation({
  args: { baseUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const baseUrl = (args.baseUrl || "https://vibeapps.dev").replace(/\/$/, "");

    const robots = buildRobotsTxt(baseUrl);
    const llms = await buildLlmsTxt(ctx, baseUrl);

    const existingRobots = await ctx.db
      .query("siteFiles")
      .withIndex("by_key", (q) => q.eq("key", "robots.txt"))
      .unique();
    if (existingRobots) {
      await ctx.db.patch(existingRobots._id, {
        content: robots,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("siteFiles", {
        key: "robots.txt",
        content: robots,
        updatedAt: Date.now(),
      });
    }

    const existingLlms = await ctx.db
      .query("siteFiles")
      .withIndex("by_key", (q) => q.eq("key", "llms.txt"))
      .unique();
    if (existingLlms) {
      await ctx.db.patch(existingLlms._id, {
        content: llms,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("siteFiles", {
        key: "llms.txt",
        content: llms,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});
