import {
  internalQuery,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  DIRECTORY_CAP,
  SITE_ORIGIN,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  buildVibeappsMd,
  isPublicStory,
  type PublicDirectory,
  type PublicDirectoryStory,
  type PublicStoryFile,
} from "./siteDirectory";

const publicDirectoryStoryValidator = v.object({
  title: v.string(),
  slug: v.string(),
  description: v.string(),
  url: v.string(),
  githubUrl: v.optional(v.string()),
  votes: v.number(),
  isPinned: v.boolean(),
  createdAt: v.number(),
  tags: v.array(v.string()),
});

const publicStoryFileValidator = v.object({
  title: v.string(),
  slug: v.string(),
  description: v.string(),
  url: v.string(),
  githubUrl: v.optional(v.string()),
  votes: v.number(),
  isPinned: v.boolean(),
  createdAt: v.number(),
  tags: v.array(v.string()),
  longDescription: v.optional(v.string()),
  authorName: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
});

const publicDirectoryValidator = v.object({
  stories: v.array(publicDirectoryStoryValidator),
  newestCreatedAt: v.union(v.number(), v.null()),
});

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

// Public approved apps only: hidden, spam, and archived rows are excluded.
export const listPublicDirectory = internalQuery({
  args: {},
  returns: publicDirectoryValidator,
  handler: async (ctx): Promise<PublicDirectory> => {
    const rows = await ctx.db
      .query("stories")
      .withIndex("by_status_isHidden_votes", (q) =>
        q.eq("status", "approved").eq("isHidden", false),
      )
      .order("desc")
      .take(DIRECTORY_CAP * 2);

    const publicStories = rows.filter(isPublicStory).slice(0, DIRECTORY_CAP);

    const tagIds = [...new Set(publicStories.flatMap((story) => story.tagIds))];
    const tagDocs = await Promise.all(tagIds.map((id) => ctx.db.get(id)));
    const tagsById = new Map(
      tagDocs.filter((tag) => tag !== null).map((tag) => [tag._id, tag]),
    );

    const stories: Array<PublicDirectoryStory> = publicStories
      .map((story) => {
        const tags: Array<string> = [];
        for (const tagId of story.tagIds) {
          const tag = tagsById.get(tagId);
          if (!tag) continue;
          if (tag.isHidden === true) continue;
          if (tag.hideInStoryList === true) continue;
          tags.push(tag.name);
        }
        const item: PublicDirectoryStory = {
          title: story.title,
          slug: story.slug,
          description: story.description,
          url: story.url,
          votes: story.votes,
          isPinned: story.isPinned,
          createdAt: story._creationTime,
          tags,
        };
        if (story.githubUrl) item.githubUrl = story.githubUrl;
        return item;
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.votes - a.votes;
      });

    let newestCreatedAt: number | null = null;
    for (const story of stories) {
      if (newestCreatedAt === null || story.createdAt > newestCreatedAt) {
        newestCreatedAt = story.createdAt;
      }
    }

    return { stories, newestCreatedAt };
  },
});

// One public app for per-slug discovery files. Indexed by slug, then
// the same public-story rules as the site directory.
export const getPublicStoryBySlug = internalQuery({
  args: { slug: v.string() },
  returns: v.union(publicStoryFileValidator, v.null()),
  handler: async (ctx, args): Promise<PublicStoryFile | null> => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || !isPublicStory(story)) return null;

    const tagDocs = await Promise.all(story.tagIds.map((id) => ctx.db.get(id)));
    const tags: Array<string> = [];
    for (const tag of tagDocs) {
      if (!tag) continue;
      if (tag.isHidden === true) continue;
      if (tag.hideInStoryList === true) continue;
      tags.push(tag.name);
    }

    let authorName: string | undefined;
    if (story.userId) {
      const author = await ctx.db.get(story.userId);
      authorName = author?.name || story.submitterName;
    } else {
      authorName = story.submitterName;
    }

    const item: PublicStoryFile = {
      title: story.title,
      slug: story.slug,
      description: story.description,
      url: story.url,
      votes: story.votes,
      isPinned: story.isPinned,
      createdAt: story._creationTime,
      tags,
    };
    if (story.githubUrl) item.githubUrl = story.githubUrl;
    if (story.longDescription) item.longDescription = story.longDescription;
    if (authorName) item.authorName = authorName;
    if (story.videoUrl) item.videoUrl = story.videoUrl;
    return item;
  },
});

async function upsertSiteFile(
  ctx: MutationCtx,
  key: string,
  content: string,
  updatedAt: number,
): Promise<void> {
  const existing = await ctx.db
    .query("siteFiles")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { content, updatedAt });
  } else {
    await ctx.db.insert("siteFiles", { key, content, updatedAt });
  }
}

export const rebuild = internalMutation({
  args: { baseUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const baseUrl = (args.baseUrl || SITE_ORIGIN).replace(/\/$/, "");
    const directory: PublicDirectory = await ctx.runQuery(
      internal.siteFiles.listPublicDirectory,
      {},
    );

    const now = Date.now();
    await upsertSiteFile(ctx, "robots.txt", buildRobotsTxt(baseUrl), now);
    await upsertSiteFile(ctx, "llms.txt", buildLlmsTxt(directory, baseUrl), now);
    await upsertSiteFile(
      ctx,
      "vibeapps.md",
      buildVibeappsMd(directory, baseUrl),
      now,
    );
    await upsertSiteFile(
      ctx,
      "sitemap.xml",
      buildSitemapXml(directory, baseUrl),
      now,
    );

    return null;
  },
});
