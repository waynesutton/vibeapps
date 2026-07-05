import { action, mutation, query } from "../_generated/server";
import { components } from "../_generated/api";
import { v } from "convex/values";
import { requireAdminRole } from "../users";

// App-facing wrappers for the Agent Ready component.
// Components run in isolation, so browser clients call these wrappers,
// which delegate to the component functions.

const fileTypeValidator = v.union(
  v.literal("llms.txt"),
  v.literal("agents.md"),
  v.literal("llms-full.txt"),
);

const pageStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

const pageValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  title: v.string(),
  path: v.string(),
  description: v.string(),
  fullContent: v.optional(v.string()),
  status: pageStatusValidator,
  isOptional: v.optional(v.boolean()),
  order: v.optional(v.number()),
  section: v.optional(v.string()),
  descriptionGeneratedByAi: v.optional(v.boolean()),
  deletedAt: v.optional(v.number()),
});

const cacheStatusValidator = v.object({
  testMode: v.boolean(),
  appName: v.union(v.string(), v.null()),
  appUrl: v.union(v.string(), v.null()),
  lastGeneratedAt: v.union(v.number(), v.null()),
  generatedFromVersion: v.union(v.string(), v.null()),
  generationInProgress: v.boolean(),
  hasDrafts: v.boolean(),
  fullTxtEnabled: v.boolean(),
  widgetVisible: v.boolean(),
  widgetStatusVisible: v.boolean(),
  widgetShowFiles: v.boolean(),
  widgetShowAppName: v.boolean(),
  widgetShowDescription: v.boolean(),
  widgetShowMeta: v.boolean(),
  widgetShowScoreTab: v.boolean(),
  widgetDesktopCollapse: v.boolean(),
  widgetCleanMode: v.boolean(),
  widgetShowHumanTab: v.boolean(),
  widgetShowMachineTab: v.boolean(),
  widgetShowChatLinks: v.boolean(),
  widgetShowChatGPT: v.boolean(),
  widgetShowClaude: v.boolean(),
  widgetShowPerplexity: v.boolean(),
  readinessEndpointEnabled: v.boolean(),
  robotsTxtEnabled: v.boolean(),
  sitemapEnabled: v.boolean(),
  rssEnabled: v.boolean(),
  agentSkillsEnabled: v.boolean(),
  discoveryHeaders: v.boolean(),
  markdownNegotiation: v.boolean(),
});

export const getCacheStatus = query({
  args: {},
  returns: cacheStatusValidator,
  handler: async (ctx) => {
    return await ctx.runQuery(components.agentReady.content.getCacheStatus, {});
  },
});

export const listPages = query({
  args: { includeAllStatuses: v.optional(v.boolean()) },
  returns: v.array(pageValidator),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.agentReady.content.listPages, args);
  },
});

// Write operations below require the Clerk admin role.

export const publishPage = mutation({
  args: { path: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.runMutation(components.agentReady.content.publishPage, args);
    return null;
  },
});

export const draftPage = mutation({
  args: { path: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.runMutation(components.agentReady.content.draftPage, args);
    return null;
  },
});

export const archivePage = mutation({
  args: { path: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.runMutation(components.agentReady.content.archivePage, args);
    return null;
  },
});

export const rollbackCache = mutation({
  args: { fileType: fileTypeValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.runMutation(components.agentReady.content.rollbackCache, args);
    return null;
  },
});

export const regenerateAll = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    // Actions have a different ctx type, so check the Clerk role inline.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || (identity as { role?: string }).role !== "admin") {
      throw new Error("Admin privileges required.");
    }
    return await ctx.runAction(components.agentReady.content.regenerateAll, {});
  },
});
