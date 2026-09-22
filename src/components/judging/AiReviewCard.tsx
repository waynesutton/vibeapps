import { useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// Collapsed AI review for the judge interface. Renders when the group's
// organizer turned on "Show AI review to judges", or for below-cut rows when
// the organizer shows them (the server decides). The query is session gated
// and returns just the scores, reasoning, and rank: harness signals and git
// facts never reach judges.
export function AiReviewCard({
  groupId,
  storyId,
  sessionId,
  defaultOpen = false,
}: {
  groupId: Id<"judgingGroups">;
  storyId: Id<"stories">;
  sessionId: string;
  // Start expanded (used for below-cut rows where the review is the point)
  defaultOpen?: boolean;
}) {
  const review = useQuery(api.aiJudge.getAiReviewForJudge, {
    groupId,
    storyId,
    sessionId,
  });
  const [open, setOpen] = useState(defaultOpen);

  if (!review) return null;

  const headline =
    review.averageScore !== undefined
      ? `${review.averageScore.toFixed(1)}/10`
      : null;
  const rankLabel =
    review.rank !== undefined && review.rankTotal !== undefined
      ? `#${review.rank} of ${review.rankTotal}`
      : null;

  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors rounded-lg"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-copy flex-shrink-0" />
          <span className="font-medium text-ink">AI review</span>
          {rankLabel && (
            <span className="text-sm text-copy tabular-nums">{rankLabel}</span>
          )}
          {headline && (
            <span className="text-sm text-soft tabular-nums">{headline}</span>
          )}
          <span className="hidden sm:inline text-xs text-faint">
            advisory, score independently first
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-soft flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-soft flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-hairline pt-3">
          <p className="text-xs text-soft">
            The AI judge scored this submission 1 to 10 on its own rubric from
            the live app, repository, video, and social links. It never changes
            your scores. If you disagree, trust your own read and say why in
            your comments.
            {review.isLive === false &&
              " The live app link failed when the AI checked it."}
            {review.editedAt !== undefined &&
              " An organizer edited this review."}
          </p>

          <div className="space-y-2">
            {review.criteriaScores.map((c) => (
              <div
                key={c.key}
                className="rounded-md border border-hairline bg-surface-alt px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{c.label}</span>
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {c.score}
                    <span className="text-xs font-normal text-faint">/10</span>
                  </span>
                </div>
                {c.reasoning && (
                  <p className="text-xs text-soft mt-1 whitespace-pre-wrap">
                    {c.reasoning}
                  </p>
                )}
              </div>
            ))}
          </div>

          {review.overallReasoning && (
            <div>
              <p className="text-xs font-medium text-ink mb-1">Overall</p>
              <p className="text-sm text-copy whitespace-pre-wrap">
                {review.overallReasoning}
              </p>
            </div>
          )}

          {review.judgeModel && (
            <p className="text-xs text-faint">Model: {review.judgeModel}</p>
          )}
        </div>
      )}
    </div>
  );
}
