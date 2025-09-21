import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  ArrowLeft,
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

interface JudgingResultsDashboardProps {
  groupId: Id<"judgingGroups">;
  groupName: string;
  onBack: () => void;
}

export function JudgingResultsDashboard({
  groupId,
  groupName,
  onBack,
}: JudgingResultsDashboardProps) {
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedJudgeIndex, setSelectedJudgeIndex] = useState(0);

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
      alert("Export data not ready. Please try again.");
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
      alert("Failed to export results. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  if (!groupScores || !judgeDetails) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Groups
          </Button>
          <div>
            <h2 className="text-xl font-medium text-gray-900">
              Judging Results
            </h2>
            <p className="text-sm text-gray-600">{groupName}</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Groups
          </Button>
          <div>
            <h2 className="text-xl font-medium text-gray-900">
              Judging Results
            </h2>
            <p className="text-sm text-gray-600">{groupName}</p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exportLoading || submissionsJudged === 0}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          {exportLoading ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Submissions Judged</p>
              <p className="text-2xl font-semibold text-gray-900">
                {submissionsJudged}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-2xl font-semibold text-gray-900">
                {averageScore ? averageScore.toFixed(1) : "0"}
              </p>
            </div>
            <Star className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Judges</p>
              <p className="text-2xl font-semibold text-gray-900">
                {judgeCount}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completion</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(completionPercentage)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {submissionsJudged === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Scores Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Judges haven't started scoring submissions in this group yet.
          </p>
          <p className="text-sm text-gray-500">
            Share the judging link with judges to get started!
          </p>
        </div>
      ) : (
        <>
          {/* Submission Rankings */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Submission Rankings
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-700">
                      Rank
                    </th>
                    <th className="text-left p-4 font-medium text-gray-700">
                      Submission
                    </th>
                    <th className="text-left p-4 font-medium text-gray-700">
                      Total Score
                    </th>
                    <th className="text-left p-4 font-medium text-gray-700">
                      Average Score
                    </th>
                    <th className="text-left p-4 font-medium text-gray-700">
                      Progress
                    </th>
                    <th className="text-left p-4 font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissionRankings.map((submission, index) => (
                    <tr
                      key={submission.storyId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <Trophy className="w-4 h-4 text-yellow-500" />
                          )}
                          {index === 1 && (
                            <Trophy className="w-4 h-4 text-gray-400" />
                          )}
                          {index === 2 && (
                            <Trophy className="w-4 h-4 text-orange-500" />
                          )}
                          <span className="font-medium">#{index + 1}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {submission.storyTitle}
                          </p>
                          <p className="text-xs text-gray-500">
                            /{submission.storySlug}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-lg font-semibold text-gray-900">
                          {submission.totalScore}
                        </span>
                        <span className="text-sm text-gray-500">
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
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${submission.completionPercentage}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">
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
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
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
                      <p className="font-medium text-gray-900">
                        {criterion.question}
                      </p>
                      <p className="text-sm text-gray-600">
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
                      <div className="w-24 bg-gray-200 rounded-full h-2">
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
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Judge Scores & Comments
              </h3>
            </div>

            {judgeDetails.length > 0 && (
              <>
                {/* Judge Tabs */}
                <div className="border-b border-gray-200">
                  <div className="flex flex-wrap gap-1 p-4">
                    {judgeDetails.map((judge, index) => (
                      <button
                        key={judge.judgeId}
                        onClick={() => setSelectedJudgeIndex(index)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          selectedJudgeIndex === index
                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent"
                        }`}
                      >
                        {judge.judgeName}
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
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
                        className="border-b border-gray-100 last:border-b-0 pb-6 last:pb-0"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {judge.judgeName}
                            </h4>
                            {judge.judgeEmail && (
                              <p className="text-sm text-gray-600">
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
                            <p className="text-sm text-gray-600">
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
                                  acc[score.storyId].totalScore += score.score;
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
                              ([storyId, submissionData], submissionIndex) => (
                                <div
                                  key={storyId}
                                  className={`rounded-lg p-4 border border-gray-200 ${
                                    submissionIndex % 2 === 0
                                      ? "bg-white"
                                      : "bg-gray-50"
                                  }`}
                                >
                                  {/* Submission Header */}
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                                    <h5 className="font-semibold text-gray-900">
                                      {submissionData.storyTitle}
                                    </h5>
                                    <div className="text-right">
                                      <div className="text-lg font-bold text-gray-900">
                                        {submissionData.totalScore}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Total Score
                                      </div>
                                    </div>
                                  </div>

                                  {/* Individual Criteria Scores */}
                                  <div className="space-y-2">
                                    {submissionData.scores.map((score) => (
                                      <div
                                        key={`${score.storyId}-${score.criteriaId}`}
                                        className="bg-white bg-opacity-50 rounded p-3 border border-gray-100"
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-700">
                                              {score.criteriaQuestion}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                            <span className="font-medium text-sm">
                                              {score.score}/10
                                            </span>
                                          </div>
                                        </div>
                                        {score.comments && (
                                          <p className="text-sm text-gray-600 italic bg-white rounded p-2 border border-gray-200 mt-2">
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
                <div className="text-center py-8 text-gray-500">
                  No judges have submitted scores yet.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
