import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// --- Hackathon URL helpers ---
//
// The hackathon skill API (/api/hackathon/{slug} endpoints, registration
// codes, rules payloads) was removed: the simplified /hackathon agent skill
// keeps one hackathon.md file in the participant's repo, and private/no-repo
// teams paste its contents into the submission form (stories.hackathonLog).
// The shared URL helpers used by stories.submit live here, plus a small
// public query the event submit form uses to warn about duplicate URLs
// before the mutation rejects them.

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

// Public pre-check for the event submit form. Returns only a boolean so the
// form can flag "already submitted to this event" while the user types,
// instead of after a full upload and a redacted server error.
export const isProjectUrlTakenInGroup = query({
  args: {
    groupId: v.id("judgingGroups"),
    url: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await groupHasDuplicateUrl(ctx, args.groupId, args.url);
  },
});
