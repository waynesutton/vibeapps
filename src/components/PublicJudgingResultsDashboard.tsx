import { Link } from "react-router-dom";
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

interface PublicJudgingResultsDashboardProps {
  groupId: Id<"judgingGroups">;
}

export function PublicJudgingResultsDashboard({
  groupId,
}: PublicJudgingResultsDashboardProps) {
  const groupScores = useQuery(api.judgeScores.getPublicGroupScores, {
    groupId,
  });

  // If data is not ready
  if (groupScores === undefined) {
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
              <p className="text-sm font-medium text-gray-600">
                Submissions Judged
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {groupScores.submissionsJudged}
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
                      <Link
                        to={`/s/${submission.storySlug}`}
                        className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                      >
                        {submission.storyTitle}
                      </Link>
                      {submission.storyUrl && (
                        <a
                          href={submission.storyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-gray-700"
                          title="Visit live app"
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
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{
                          width: `${(criteria.averageScore / 10) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">/10</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
