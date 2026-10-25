import type { Doc } from "../_generated/dataModel";

// Judging only stories are hidden from every public surface (isHidden=true)
// but stay judgeable. Requiring both flags means an admin unhide publishes
// the story without any extra cleanup.
export function isJudgingOnlyStory(
  story: Pick<Doc<"stories">, "isHidden" | "judgingOnly">,
): boolean {
  return story.isHidden === true && story.judgingOnly === true;
}

// Slug for activity log links; undefined when the story has no public page
export function publicSlugOf(
  story: Pick<Doc<"stories">, "isHidden" | "judgingOnly" | "slug"> | null,
): string | undefined {
  if (!story || isJudgingOnlyStory(story)) return undefined;
  return story.slug;
}

// Single source of truth for "can this story be judged, scored, AI judged,
// and emailed as a group submission". Excludes deleted, archived, rejected,
// and moderation hidden stories; keeps judging only imports.
export function isStoryJudgeable(
  story: Doc<"stories"> | null,
): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  if (story.isHidden === true && story.judgingOnly !== true) return false;
  return true;
}
