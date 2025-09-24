import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Extract @username handles from text content
 * Returns deduplicated list of usernames without @ prefix
 */
export const extractHandles = internalQuery({
  args: { text: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const handles = new Set<string>();
    // Match @username patterns with allowed characters: letters, numbers, underscore, dot
    const regex = /(^|\s)@([a-zA-Z0-9_.]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(args.text))) {
      handles.add(match[2]);
    }

    return Array.from(handles);
  },
});

/**
 * Resolve username handles to actual user documents
 * Returns array of resolved users, skipping unknown handles
 */
export const resolveHandlesToUsers = internalQuery({
  args: { handles: v.array(v.string()) },
  returns: v.array(v.object({ handle: v.string(), userId: v.id("users") })),
  handler: async (ctx, args) => {
    const results: Array<{ handle: string; userId: any }> = [];

    for (const handle of args.handles) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", handle))
        .unique();

      if (user) {
        results.push({ handle, userId: user._id });
      }
    }

    return results as any;
  },
});

/**
 * Get current daily mention count for an actor
 * Used for quota enforcement
 */
export const getActorDailyCount = internalQuery({
  args: { actorUserId: v.id("users"), date: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_actor_and_date", (q) =>
        q.eq("actorUserId", args.actorUserId).eq("date", args.date),
      )
      .collect();
    return mentions.length;
  },
});

/**
 * Record mention events with quota enforcement
 * Creates mention records for valid targets within daily limit
 */
export const recordMentions = internalMutation({
  args: {
    actorUserId: v.id("users"),
    resolvedTargets: v.array(
      v.object({ handle: v.string(), userId: v.id("users") }),
    ),
    context: v.union(v.literal("comment"), v.literal("judge_note")),
    sourceId: v.union(v.id("comments"), v.id("submissionNotes")),
    storyId: v.id("stories"),
    groupId: v.optional(v.id("judgingGroups")),
    contentExcerpt: v.string(),
    date: v.string(),
  },
  returns: v.object({
    inserted: v.number(),
    skippedSelf: v.number(),
    skippedQuota: v.number(),
  }),
  handler: async (ctx, args) => {
    // Remove self-mentions (actor mentioning themselves)
    const targets = args.resolvedTargets.filter(
      (target) => target.userId !== args.actorUserId,
    );

    // Get current daily count for quota check
    const currentMentions = await ctx.db
      .query("mentions")
      .withIndex("by_actor_and_date", (q) =>
        q.eq("actorUserId", args.actorUserId).eq("date", args.date),
      )
      .collect();
    const currentCount = currentMentions.length;

    // Calculate remaining quota (max 30 per day)
    const remaining = Math.max(30 - currentCount, 0);

    // Insert mentions up to the remaining quota
    let inserted = 0;
    for (const target of targets.slice(0, remaining)) {
      await ctx.db.insert("mentions", {
        actorUserId: args.actorUserId,
        targetUserId: target.userId,
        context: args.context,
        sourceId: args.sourceId as any,
        storyId: args.storyId,
        groupId: args.groupId,
        contentExcerpt: args.contentExcerpt,
        date: args.date,
      });
      inserted++;
    }

    return {
      inserted,
      skippedSelf: args.resolvedTargets.length - targets.length,
      skippedQuota: Math.max(targets.length - remaining, 0),
    };
  },
});
