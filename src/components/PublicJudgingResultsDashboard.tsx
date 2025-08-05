import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Trophy,
  Users,
  BarChart3,
  Star,
  TrendingUp,
  Award,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PublicJudgingResultsDashboardProps {
  groupId: Id<"judgingGroups">;
}

export function PublicJudgingResultsDashboard({
  groupId,
}: PublicJudgingResultsDashboardProps) {
  const groupScores = useQuery(api.judgeScores.getPublicGroupScores, {
    groupId,
  });
  const judgeDetails = useQuery(api.judgeScores.getPublicGroupJudgeDetails, {
    groupId,
  });

  // If data is not ready
  if (groupScores === undefined || judgeDetails === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  // If group not found or not public
  if (groupScores === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Results Not Available
          </h2>
          <p className="text-gray-600">
            This judging group's results are private or the group doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center">
            <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Scores</p>
              <p className="text-2xl font-bold text-gray-900">
                {groupScores.totalScores}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center">
            <Users className="w-5 h-5 text-blue-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-600">Judges</p>
              <p className="text-2xl font-bold text-gray-900">
                {groupScores.judgeCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center">
            <BarChart3 className="w-5 h-5 text-green-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-600">Submissions</p>
              <p className="text-2xl font-bold text-gray-900">
                {groupScores.submissionCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="w-5 h-5 text-purple-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-600">Progress</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(groupScores.completionPercentage)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Rankings
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {groupScores.rankings.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No scores submitted yet
            </div>
          ) : (
            groupScores.rankings.map((submission, index) => (
              <div
                key={submission.storyId}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {index === 0 && (
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-yellow-600" />
                      </div>
                    )}
                    {index === 1 && (
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Award className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    {index === 2 && (
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <Award className="w-4 h-4 text-orange-600" />
                      </div>
                    )}
                    {index > 2 && (
                      <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {index + 1}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">
                        {submission.storyTitle}
                      </h4>
                      {submission.storyUrl && (
                        <a
                          href={submission.storyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {submission.scoreCount} score
                      {submission.scoreCount !== 1 ? "s" : ""} submitted
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {submission.averageScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Total: {submission.totalScore}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Criteria Performance */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Criteria Performance
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {groupScores.criteriaBreakdown.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No criteria defined yet
            </div>
          ) : (
            groupScores.criteriaBreakdown.map((criteria) => (
              <div
                key={criteria.criteriaId}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-medium text-gray-900">
                    {criteria.criteriaName}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {criteria.scoreCount} score
                    {criteria.scoreCount !== 1 ? "s" : ""} submitted
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {criteria.averageScore.toFixed(1)}
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= criteria.averageScore
                            ? "text-yellow-400 fill-current"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Judge Scores & Comments */}
      {judgeDetails && judgeDetails.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Judge Scores & Comments
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {judgeDetails.map((judge) => (
              <div key={judge.judgeName} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {judge.judgeName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {judge.scoreCount} submission
                      {judge.scoreCount !== 1 ? "s" : ""} completed
                      {judge.lastActive && (
                        <span>
                          {" "}
                          • Last active{" "}
                          {formatDistanceToNow(new Date(judge.lastActive))} ago
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {judge.averageScore.toFixed(1)} avg
                    </div>
                    <div className="text-sm text-gray-500">
                      Total: {judge.totalScore}
                    </div>
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
                    ).map(([storyId, submissionData], submissionIndex) => (
                      <div
                        key={storyId}
                        className={`rounded-lg p-4 border border-gray-200 ${
                          submissionIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
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
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">
                                  {score.criteriaName}
                                </span>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-3 h-3 ${
                                        star <= score.score
                                          ? "text-yellow-400 fill-current"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                  <span className="text-sm font-medium text-gray-900 ml-1">
                                    {score.score}
                                  </span>
                                </div>
                              </div>
                              {score.comments && (
                                <p className="text-sm text-gray-600 italic mt-2">
                                  "{score.comments}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
