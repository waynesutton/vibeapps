import { v } from "convex/values";

/**
 * Single source of truth for "was this submission in before the deadline".
 *
 * The deadline is the judging group's event end (judgingGroups.endDate) and
 * the submission time is the story's _creationTime. Nothing is stored:
 * every read recomputes from the group's current end date, so moving the
 * deadline relabels every row live and there is no backfill to run.
 *
 * The platform only flags. Whether a late submission is eligible is the
 * organizer's call, which is why the label reads "Late submission" and not
 * "Disqualified".
 */

export type SubmissionTimingStatus = "on_time" | "late" | "no_deadline_set";

export type SubmissionTiming = {
  status: SubmissionTimingStatus;
  // Story _creationTime (when the team submitted the app)
  submittedAt: number;
  // Group endDate when one is set
  deadlineAt?: number;
  // Positive ms past the deadline; only present when late
  lateByMs?: number;
};

// Validator shared by every query that returns timing to a client
export const submissionTimingValidator = v.object({
  status: v.union(
    v.literal("on_time"),
    v.literal("late"),
    v.literal("no_deadline_set"),
  ),
  submittedAt: v.number(),
  deadlineAt: v.optional(v.number()),
  lateByMs: v.optional(v.number()),
});

// Compare the submission time with the deadline. A submission exactly at the
// deadline counts as on time.
export function computeSubmissionTiming(
  submittedAt: number,
  deadlineAt: number | undefined | null,
): SubmissionTiming {
  if (deadlineAt === undefined || deadlineAt === null) {
    return { status: "no_deadline_set", submittedAt };
  }
  if (submittedAt > deadlineAt) {
    return {
      status: "late",
      submittedAt,
      deadlineAt,
      lateByMs: submittedAt - deadlineAt,
    };
  }
  return { status: "on_time", submittedAt, deadlineAt };
}

// Human readable "2 days 3 hours" style duration for prompts and tooltips.
// Never returns an empty string; sub minute gaps read "under a minute".
export function formatLateBy(lateByMs: number): string {
  const totalMinutes = Math.floor(lateByMs / 60_000);
  if (totalMinutes < 1) return "under a minute";
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts: Array<string> = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (days === 0 && minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
  return parts.join(" ");
}
