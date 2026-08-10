import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireJudgingGroupPermission } from "./adminAccess";
import { getRubricForGroup } from "./aiJudge";

// --- Hackathon skill support ---
//
// Backend for the /api/hackathon/{slug}/... HTTP endpoints (convex/http.ts)
// that the /hackathon agent skill talks to: register a team with a group
// registration code, fetch the event rules, and check submission status.
// Submissions themselves still flow through the group submit form at
// /judging/{slug}/submit; there is no API submit path.

// Normalize a project URL for duplicate comparison: lowercase scheme/host,
// drop hash and trailing slashes. Returns null for unparseable values.
export function normalizeProjectUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const host = url.host.toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    const search = url.search;
    return `${host}${path}${search}`;
  } catch {
    // Not an absolute URL; compare the raw string case-insensitively
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

// Uppercase-trim a registration code so "aug18-global" matches "AUG18-GLOBAL"
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// Context shared by every authenticated hackathon endpoint
const hackathonContextValidator = v.object({
  groupId: v.id("judgingGroups"),
  groupName: v.string(),
  groupSlug: v.string(),
  isActive: v.boolean(),
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
  code: v.string(),
});

/**
 * Resolve a group slug + registration code to a hackathon context. Returns
 * null when the group is missing, the skill endpoints are disabled, or the
 * code does not match; the HTTP layer maps that to 403.
 */
export const validateCode = internalQuery({
  args: { slug: v.string(), code: v.string() },
  returns: v.union(v.null(), hackathonContextValidator),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!group) return null;
    if (group.hackathonSkillEnabled !== true) return null;

    const normalized = normalizeCode(args.code);
    if (!normalized) return null;
    const codes = (group.hackathonRegistrationCodes ?? []).map(normalizeCode);
    if (!codes.includes(normalized)) return null;

    return {
      groupId: group._id,
      groupName: group.name,
      groupSlug: group.slug,
      isActive: group.isActive,
      startDate: group.startDate,
      endDate: group.endDate,
      code: normalized,
    };
  },
});

/**
 * Record a team registration from "/hackathon start CODE". Idempotent: the
 * same team name in the same group returns the existing row.
 */
export const registerTeam = internalMutation({
  args: {
    groupId: v.id("judgingGroups"),
    code: v.string(),
    teamName: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.object({
    registrationId: v.id("hackathonRegistrations"),
    alreadyRegistered: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const teamName = args.teamName.trim();
    if (teamName.length < 2) {
      throw new Error("Team name must be at least 2 characters long");
    }

    const existing = await ctx.db
      .query("hackathonRegistrations")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const match = existing.find(
      (r) => r.teamName.toLowerCase() === teamName.toLowerCase(),
    );
    if (match) {
      return { registrationId: match._id, alreadyRegistered: true };
    }

    const registrationId = await ctx.db.insert("hackathonRegistrations", {
      groupId: args.groupId,
      code: normalizeCode(args.code),
      teamName,
      email: args.email?.trim() || undefined,
      registeredAt: Date.now(),
    });
    return { registrationId, alreadyRegistered: false };
  },
});

// Rules payload shared by the register and rules.json endpoints
const rulesPayloadValidator = v.object({
  group: v.object({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    scoreScale: v.number(),
  }),
  updatedAt: v.number(),
  rulesMarkdown: v.union(v.string(), v.null()),
  submitPath: v.string(),
  resultsPath: v.union(v.string(), v.null()),
  criteria: v.array(
    v.object({
      question: v.string(),
      description: v.optional(v.string()),
      weight: v.optional(v.number()),
      order: v.number(),
    }),
  ),
  aiJudge: v.union(
    v.null(),
    v.object({
      enabled: v.boolean(),
      rubric: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          description: v.string(),
        }),
      ),
    }),
  ),
});

/**
 * Full rules payload for the skill: markdown rules, human criteria, AI
 * rubric, dates, score scale, and the submit page path. updatedAt covers
 * both rules edits and criteria changes so the skill can diff staleness.
 */
export const getRules = internalQuery({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(v.null(), rulesPayloadValidator),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || group.hackathonSkillEnabled !== true) return null;

    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .order("asc")
      .collect();

    // Staleness marker: rules edits bump hackathonRulesUpdatedAt; criteria
    // saves recreate rows, so their creation times cover criteria changes.
    const updatedAt = Math.max(
      group.hackathonRulesUpdatedAt ?? group._creationTime,
      ...criteria.map((c) => c._creationTime),
    );

    return {
      group: {
        name: group.name,
        slug: group.slug,
        description: group.description,
        isActive: group.isActive,
        startDate: group.startDate,
        endDate: group.endDate,
        scoreScale: group.scoreScale ?? 10,
      },
      updatedAt,
      rulesMarkdown: group.hackathonRules ?? null,
      submitPath: `/judging/${group.slug}/submit`,
      resultsPath:
        group.resultsIsPublic === true ? `/judging/${group.slug}/results` : null,
      criteria: criteria.map((c) => ({
        question: c.question,
        description: c.description,
        weight: c.weight,
        order: c.order,
      })),
      aiJudge:
        group.aiJudgeEnabled === true
          ? {
              enabled: true,
              rubric: getRubricForGroup(group).map((c) => ({
                key: c.key,
                label: c.label,
                description: c.description,
              })),
            }
          : null,
    };
  },
});

// Status payload for one project URL inside a group
const statusPayloadValidator = v.object({
  found: v.boolean(),
  // Admin-safe lifecycle: spam/hidden stories report "under_review" rather
  // than exposing moderation flags to the submitter's agent.
  submissionStatus: v.optional(
    v.union(
      v.literal("pending_review"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("under_review"),
    ),
  ),
  title: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  judging: v.optional(
    v.object({
      status: v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("skip"),
      ),
      completedJudgeCount: v.number(),
    }),
  ),
  aiJudgeStatus: v.optional(v.string()),
  resultsPath: v.union(v.string(), v.null()),
});

/**
 * Submission lifecycle for a project URL within a group. Matches on the
 * normalized story URL so trailing slashes and casing never hide a match.
 */
export const getStatusForUrl = internalQuery({
  args: { groupId: v.id("judgingGroups"), url: v.string() },
  returns: statusPayloadValidator,
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    const resultsPath =
      group?.resultsIsPublic === true
        ? `/judging/${group.slug}/results`
        : null;

    const target = normalizeProjectUrl(args.url);
    if (!target) return { found: false, resultsPath };

    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const submission of submissions) {
      const story = await ctx.db.get(submission.storyId);
      if (!story) continue;
      if (normalizeProjectUrl(story.url) !== target) continue;

      // Moderation-safe status wording
      const submissionStatus =
        story.isHidden === true || story.isSpam === true
          ? ("under_review" as const)
          : story.status === "rejected"
            ? ("rejected" as const)
            : story.status === "approved"
              ? ("accepted" as const)
              : ("pending_review" as const);

      const statusRow = await ctx.db
        .query("submissionStatuses")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", args.groupId).eq("storyId", story._id),
        )
        .unique();

      const completions = await ctx.db
        .query("submissionJudgeCompletions")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", args.groupId).eq("storyId", story._id),
        )
        .collect();

      const aiResult = await ctx.db
        .query("aiJudgeResults")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", args.groupId).eq("storyId", story._id),
        )
        .unique();

      return {
        found: true,
        submissionStatus,
        title: story.title,
        submittedAt: story._creationTime,
        judging: {
          status: statusRow?.status ?? ("pending" as const),
          completedJudgeCount: completions.length,
        },
        aiJudgeStatus: aiResult?.status,
        resultsPath,
      };
    }

    return { found: false, resultsPath };
  },
});

// --- Admin functions (Hackathon skill card on the group page) ---

/**
 * Update hackathon skill settings for a group (admin only). Any change to
 * the rules markdown bumps hackathonRulesUpdatedAt so skills refetch.
 */
export const updateHackathonSettings = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    enabled: v.optional(v.boolean()),
    codes: v.optional(v.array(v.string())),
    rules: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");

    const updates: {
      hackathonSkillEnabled?: boolean;
      hackathonRegistrationCodes?: Array<string>;
      hackathonRules?: string;
      hackathonRulesUpdatedAt?: number;
    } = {};

    if (args.enabled !== undefined) {
      updates.hackathonSkillEnabled = args.enabled;
    }
    if (args.codes !== undefined) {
      // Store codes uppercased and de-duplicated; drop empties
      const cleaned = [
        ...new Set(args.codes.map(normalizeCode).filter(Boolean)),
      ];
      updates.hackathonRegistrationCodes = cleaned;
    }
    if (args.rules !== undefined) {
      updates.hackathonRules = args.rules?.trim() || undefined;
      updates.hackathonRulesUpdatedAt = Date.now();
    }

    await ctx.db.patch(args.groupId, updates);
    return null;
  },
});

/**
 * Teams that registered with this group's codes (admin only).
 */
export const listRegistrations = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      _id: v.id("hackathonRegistrations"),
      teamName: v.string(),
      email: v.optional(v.string()),
      code: v.string(),
      registeredAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");

    const registrations = await ctx.db
      .query("hackathonRegistrations")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    return registrations
      .sort((a, b) => b.registeredAt - a.registeredAt)
      .map((r) => ({
        _id: r._id,
        teamName: r.teamName,
        email: r.email,
        code: r.code,
        registeredAt: r.registeredAt,
      }));
  },
});

// Duplicate-URL guard shared by stories.submit: true when another story in
// the group already uses this project URL (ignoring hidden/rejected ones).
export async function groupHasDuplicateUrl(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"judgingGroups">,
  url: string,
): Promise<boolean> {
  const target = normalizeProjectUrl(url);
  if (!target) return false;

  const submissions = await ctx.db
    .query("judgingGroupSubmissions")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();

  for (const submission of submissions) {
    const story = await ctx.db.get(submission.storyId);
    if (!story) continue;
    // Hidden or rejected entries free up the URL for a clean resubmission
    if (story.isHidden === true || story.status === "rejected") continue;
    if (normalizeProjectUrl(story.url) === target) return true;
  }
  return false;
}
