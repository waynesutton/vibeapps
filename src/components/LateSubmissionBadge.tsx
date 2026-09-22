import { Clock } from "lucide-react";
import {
  formatLateBy,
  type SubmissionTiming,
} from "../../convex/lib/submissionTiming";
import { formatDeadline } from "../lib/countdown";

// One "Late submission" chip for every surface: judge interface, admin
// submissions table, and AI results (admin and public). Renders nothing when
// the submission was on time or the group has no deadline, so callers can
// drop it in without a guard. The platform flags; organizers decide
// eligibility, so the wording never says "disqualified".

type Props = {
  timing: SubmissionTiming | undefined;
  // "chip" is the rounded pill used beside other fact badges; "inline" is a
  // compact text row for tight list items
  variant?: "chip" | "inline";
  className?: string;
};

// Tooltip and Markdown text shared by the badge and the report builders
export function describeLateSubmission(timing: SubmissionTiming): string {
  if (timing.status !== "late" || timing.deadlineAt === undefined) return "";
  return `Submitted ${formatDeadline(timing.submittedAt)}, ${formatLateBy(timing.lateByMs ?? 0)} after the ${formatDeadline(timing.deadlineAt)} deadline. Scored normally; eligibility is the organizer's call.`;
}

export function LateSubmissionBadge({
  timing,
  variant = "chip",
  className = "",
}: Props) {
  if (!timing || timing.status !== "late") return null;
  const detail = describeLateSubmission(timing);

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium text-red-700 ${className}`}
        title={detail}
        aria-label={`Late submission. ${detail}`}
      >
        <Clock className="h-3 w-3" aria-hidden="true" />
        Late
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-700 ${className}`}
      title={detail}
      aria-label={`Late submission. ${detail}`}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      Late submission
    </span>
  );
}
