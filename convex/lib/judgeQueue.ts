import type { Doc } from "../_generated/dataModel";

/**
 * One rule for which submissions reach human (and agent) judges.
 *
 * judgeQueueMode "all" (default, also when unset) = every submission in the
 * group. "shortlist" = only rows flagged shortlisted = true, which organizers
 * set from AI results (Shortlist top N) or per row in the submissions table.
 *
 * Callers still apply their own story validity check (hidden, archived,
 * rejected). AI runs and AI results never use this: the AI judge always
 * reviews every submission so the shortlist can be picked from it.
 */
export function isInJudgeQueue(
  group: Pick<Doc<"judgingGroups">, "judgeQueueMode"> | null | undefined,
  submission: Pick<Doc<"judgingGroupSubmissions">, "shortlisted">,
): boolean {
  if ((group?.judgeQueueMode ?? "all") !== "shortlist") return true;
  return submission.shortlisted === true;
}
