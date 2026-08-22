import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Download,
  Trophy,
  Users,
  BarChart3,
  Star,
  TrendingUp,
  Award,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/button";
import { useDialog } from "../../hooks/useDialog";

// Rendered inside the group workspace; the workspace header and sidebar
// provide navigation, so this component has no back button or title.
interface JudgingResultsDashboardProps {
  groupId: Id<"judgingGroups">;
}

export function JudgingResultsDashboard({
  groupId,
}: JudgingResultsDashboardProps) {
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedJudgeIndex, setSelectedJudgeIndex] = useState(0);
  const { showMessage, DialogComponents } = useDialog();

  const groupScores = useQuery(api.judgeScores.getGroupScores, { groupId });
  const judgeDetails = useQuery(api.judgeScores.getGroupJudgeDetails, {
    groupId,
  });

  const exportScores = useQuery(api.judgeScores.exportScores, { groupId });

  // Reset selected judge index if it's out of bounds
  React.useEffect(() => {
    if (judgeDetails && selectedJudgeIndex >= judgeDetails.length) {
      setSelectedJudgeIndex(0);
    }
  }, [judgeDetails, selectedJudgeIndex]);

  const handleExport = async () => {
    if (!exportScores) {
      showMessage(
        "Not Ready",
        "Export data not ready. Please try again.",
        "warning",
      );
      return;
    }

    setExportLoading(true);
    try {
      // Create CSV content
      const headers = [
        "Story Title",
        "Story URL",
        "Judge Name",
        "Criteria Question",
        "Score",
        "Comments",
        "Timestamp",
      ];

      const csvRows = [
        headers.join(","),
        ...exportScores.data.map((row) =>
          [
            `"${row.storyTitle}"`,
            `"${row.storyUrl}"`,
            `"${row.judgeName}"`,
            `"${row.criteriaQuestion}"`,
            row.score,
            `"${row.comments || ""}"`,
            new Date(row.scoreTimestamp).toISOString(),
          ].join(","),
        ),
      ];

      // Download CSV
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportScores.groupName.replace(/\s+/g, "_")}_results_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      showMessage(
        "Export Failed",
        "Failed to export results. Please try again.",
        "error",
      );
    } finally {
      setExportLoading(false);
    }
  };

  if (!groupScores || !judgeDetails) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-hairline-strong border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-copy">Loading results...</p>
      </div>
    );
  }

  const {
    submissionsJudged,
    averageScore,
    judgeCount,
    completionPercentage,
    submissionRankings,
    criteriaBreakdown,
  } = groupScores;

  return (
    <>
      <DialogComponents />
      <div className="space-y-5">
        {/* Actions row: export lives here, navigation is handled by the workspace */}
        <div className="flex items-center justify-end">
          <Button
            onClick={handleExport}
            disabled={exportLoading || submissionsJudged === 0}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {exportLoading ? "Exporting..." : "Export CSV"}
          </Button>
        </div>

        {/* Overview stats: small inline icons keep the numbers as the focus */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              {
                label: "Submissions judged",
                value: String(submissionsJudged),
                icon: BarChart3,
              },
              {
                label: "Average score",
                value: averageScore ? averageScore.toFixed(1) : "0",
                icon: Star,
              },
              { label: "Judges", value: String(judgeCount), icon: Users },
              {
                label: "Completion",
                value: `${Math.round(completionPercentage)}%`,
                icon: TrendingUp,
              },
            ] as const
          ).map((stat) => (
            <div
              key={stat.label}
              className="bg-surface rounded-lg border border-hairline p-4"
            >
              <div className="flex items-center gap-1.5 text-soft">
                <stat.icon className="w-3.5 h-3.5" />
                <p className="text-xs">{stat.label}</p>
              </div>
              <p className="text-2xl font-semibold text-ink mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {submissionsJudged === 0 ? (
          <div className="text-center py-12 bg-surface rounded-lg border border-hairline">
            <Award className="w-10 h-10 text-faint mx-auto mb-4" />
            <h3 className="text-lg font-medium text-ink mb-2">
              No Scores Yet
            </h3>
            <p className="text-copy mb-4">
              Judges haven't started scoring submissions in this group yet.
            </p>
            <p className="text-sm text-soft">
              Share the judging link with judges to get started!
            </p>
          </div>
        ) : (
          <>
            {/* Submission Rankings */}
            <div className="bg-surface rounded-lg border border-hairline">
              <div className="p-6 border-b border-hairline">
                <h3 className="text-lg font-medium text-ink flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  Submission Rankings
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-hairline bg-surface-alt">
                    <tr>
                      <th className="text-left p-4 font-medium text-copy">
                        Rank
                      </th>
                      <th className="text-left p-4 font-medium text-copy">
                        Submission
                      </th>
                      <th className="text-left p-4 font-medium text-copy">
                        Total Score
                      </th>
                      <th className="text-left p-4 font-medium text-copy">
                        Average Score
                      </th>
                      <th className="text-left p-4 font-medium text-copy">
                        Progress
                      </th>
                      <th className="text-left p-4 font-medium text-copy">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionRankings.map((submission, index) => (
                      <tr
                        key={submission.storyId}
                        className="border-b border-hairline hover:bg-surface-hover"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {index === 0 && (
                              <Trophy className="w-4 h-4 text-yellow-500" />
                            )}
                            {index === 1 && (
                              <Trophy className="w-4 h-4 text-faint" />
                            )}
                            {index === 2 && (
                              <Trophy className="w-4 h-4 text-orange-500" />
                            )}
                            <span className="font-medium">#{index + 1}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="app-title-sm text-ink">
                              {submission.storyTitle}
                            </p>
                            <p className="text-xs text-soft">
                              /{submission.storySlug}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-lg font-semibold text-ink">
                            {submission.totalScore}
                          </span>
                          <span className="text-sm text-soft">
                            /{submission.maxPossibleScore}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="font-medium">
                              {submission.averageScore.toFixed(1)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-surface-hover rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{
                                  width: `${submission.completionPercentage}%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-xs text-soft">
                              {Math.round(submission.completionPercentage)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <a
                            href={`/s/${submission.storySlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Criteria Breakdown */}
            <div className="bg-surface rounded-lg border border-hairline">
              <div className="p-6 border-b border-hairline">
                <h3 className="text-lg font-medium text-ink">
                  Criteria Performance
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {criteriaBreakdown.map((criterion) => (
                    <div
                      key={criterion.criteriaId}
                      className="flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-ink">
                          {criterion.question}
                        </p>
                        <p className="text-sm text-copy">
                          {criterion.scoreCount} scores
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="font-medium">
                            {criterion.averageScore.toFixed(1)}
                          </span>
                        </div>
                        <div className="w-24 bg-surface-hover rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${(criterion.averageScore / 5) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Judge Details Section */}
            <div className="bg-surface rounded-lg border border-hairline">
              <div className="p-6 border-b border-hairline">
                <h3 className="text-lg font-medium text-ink">
                  Judge Scores & Comments
                </h3>
              </div>

              {judgeDetails.length > 0 && (
                <>
                  {/* Judge Tabs */}
                  <div className="border-b border-hairline">
                    <div className="flex flex-wrap gap-1 p-4">
                      {judgeDetails.map((judge, index) => (
                        <button
                          key={judge.judgeId}
                          onClick={() => setSelectedJudgeIndex(index)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            selectedJudgeIndex === index
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "text-copy hover:text-ink hover:bg-surface-hover border border-transparent"
                          }`}
                        >
                          {judge.judgeName}
                          {judge.judgeType === "agent" && (
                            <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                              Agent
                            </span>
                          )}
                          <span className="ml-2 text-xs bg-surface-alt text-copy px-2 py-1 rounded-full">
                            {judge.totalScores}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Judge Content */}
                  <div className="p-6">
                    {(() => {
                      const judge = judgeDetails[selectedJudgeIndex];
                      return (
                        <div
                          key={judge.judgeId}
                          className="border-b border-hairline last:border-b-0 pb-6 last:pb-0"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-medium text-ink flex items-center gap-2">
                                {judge.judgeName}
                                {judge.judgeType === "agent" && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-normal">
                                    Agent
                                  </span>
                                )}
                              </h4>
                              {judge.judgeEmail && (
                                <p className="text-sm text-copy">
                                  {judge.judgeEmail}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span className="font-medium">
                                  {judge.averageScore
                                    ? judge.averageScore.toFixed(1)
                                    : "No scores"}
                                </span>
                              </div>
                              <p className="text-sm text-copy">
                                {judge.totalScores} scores submitted
                              </p>
                            </div>
                          </div>

                          {judge.scores.length > 0 && (
                            <div className="space-y-3">
                              {/* Group scores by submission */}
                              {Object.entries(
                                judge.scores.reduce(
                                  (acc, score) => {
                                    if (!acc[score.storyId]) {
                                      acc[score.storyId] = {
                                        storyTitle: score.storyTitle,
                                        scores: [],
                                        totalScore: 0,
                                      };
                                    }
                                    acc[score.storyId].scores.push(score);
                                    acc[score.storyId].totalScore +=
                                      score.score;
                                    return acc;
                                  },
                                  {} as Record<
                                    string,
                                    {
                                      storyTitle: string;
                                      scores: any[];
                                      totalScore: number;
                                    }
                                  >,
                                ),
                              ).map(
                                (
                                  [storyId, submissionData],
                                  submissionIndex,
                                ) => (
                                  <div
                                    key={storyId}
                                    className={`rounded-lg p-4 border border-hairline ${
                                      submissionIndex % 2 === 0
                                        ? "bg-surface"
                                        : "bg-surface-alt"
                                    }`}
                                  >
                                    {/* Submission Header */}
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-hairline">
                                      <h5 className="app-title-sm font-semibold text-ink">
                                        {submissionData.storyTitle}
                                      </h5>
                                      <div className="text-right">
                                        <div className="text-lg font-bold text-ink">
                                          {submissionData.totalScore}
                                        </div>
                                        <div className="text-sm text-soft">
                                          Total Score
                                        </div>
                                      </div>
                                    </div>

                                    {/* Individual Criteria Scores */}
                                    <div className="space-y-2">
                                      {submissionData.scores.map((score) => (
                                        <div
                                          key={`${score.storyId}-${score.criteriaId}`}
                                          className="bg-surface bg-opacity-50 rounded p-3 border border-hairline"
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex-1">
                                              <p className="text-sm font-medium text-copy">
                                                {score.criteriaQuestion}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                              <span className="font-medium text-sm">
                                                {score.score}/
                                                {groupScores?.scoreScale ?? 10}
                                              </span>
                                            </div>
                                          </div>
                                          {score.comments && (
                                            <p className="text-sm text-copy italic bg-surface rounded p-2 border bg-canvas mt-2">
                                              "{score.comments}"
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {judgeDetails.length === 0 && (
                <div className="p-6">
                  <div className="text-center py-8 text-soft">
                    No judges have submitted scores yet.
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
