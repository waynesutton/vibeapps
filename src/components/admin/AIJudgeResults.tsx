import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  Github,
  Globe,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { useDialog } from "../../hooks/useDialog";

interface AIJudgeResultsProps {
  groupId: Id<"judgingGroups">;
  groupName: string;
  onBack: () => void;
}

type CriteriaScore = {
  key: string;
  label: string;
  score: number;
  reasoning: string;
};

export function AIJudgeResults({
  groupId,
  groupName,
  onBack,
}: AIJudgeResultsProps) {
  const data = useQuery(api.aiJudge.getGroupAiResults, { groupId });
  const startReview = useMutation(api.aiJudge.startReview);
  const retrySubmission = useMutation(api.aiJudge.retrySubmission);
  const updateResultScore = useMutation(api.aiJudge.updateResultScore);
  const { showMessage, DialogComponents } = useDialog();

  const [isStarting, setIsStarting] = useState(false);
  const [expandedId, setExpandedId] = useState<Id<"aiJudgeResults"> | null>(
    null,
  );
  const [editingId, setEditingId] = useState<Id<"aiJudgeResults"> | null>(null);
  const [editScores, setEditScores] = useState<Array<CriteriaScore>>([]);
  const [editOverall, setEditOverall] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isRunning =
    (data?.counts.pending ?? 0) > 0 || (data?.counts.running ?? 0) > 0;

  const handleStartReview = async () => {
    setIsStarting(true);
    try {
      const result = await startReview({ groupId });
      showMessage(
        "AI Review Started",
        `Queued ${result.queued} submission${result.queued === 1 ? "" : "s"} for AI review. Results appear here as each submission completes.`,
        "success",
      );
    } catch (error) {
      showMessage(
        "Could Not Start AI Review",
        error instanceof Error
          ? error.message.replace(/^\[.*?\]\s*/, "").replace(/^Uncaught Error:\s*/, "")
          : "Please try again.",
        "error",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleRetry = async (resultId: Id<"aiJudgeResults">) => {
    try {
      await retrySubmission({ resultId });
    } catch (error) {
      showMessage(
        "Retry Failed",
        error instanceof Error ? error.message : "Please try again.",
        "error",
      );
    }
  };

  const startEditing = (result: {
    _id: Id<"aiJudgeResults">;
    criteriaScores?: Array<CriteriaScore>;
    overallReasoning?: string;
  }) => {
    setEditingId(result._id);
    setEditScores(result.criteriaScores ? [...result.criteriaScores] : []);
    setEditOverall(result.overallReasoning || "");
    setExpandedId(result._id);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditScores([]);
    setEditOverall("");
  };

  const saveEditing = async () => {
    if (!editingId) return;
    setIsSavingEdit(true);
    try {
      await updateResultScore({
        resultId: editingId,
        criteriaScores: editScores,
        overallReasoning: editOverall,
      });
      cancelEditing();
    } catch (error) {
      showMessage(
        "Save Failed",
        error instanceof Error ? error.message : "Please try again.",
        "error",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            Completed
          </span>
        );
      case "running":
        return (
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Reviewing
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            Pending
          </span>
        );
    }
  };

  const completedResults = (data?.results || []).filter(
    (r) => r.status === "completed",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to judging groups"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-medium text-[#525252] flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Judge: Best Use of Convex
            </h2>
            <p className="text-sm text-gray-500">{groupName}</p>
          </div>
        </div>
        <Button
          onClick={handleStartReview}
          disabled={isStarting || isRunning}
          className="bg-[#292929] hover:bg-[#525252]"
        >
          {isStarting || isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isRunning ? "Review in progress..." : "Starting..."}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {completedResults.length > 0 ? "Re-run AI Review" : "Run AI Review"}
            </>
          )}
        </Button>
      </div>

      {data === undefined && <div>Loading AI results...</div>}

      {data && (
        <>
          {/* Progress counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                { label: "Pending", value: data.counts.pending, color: "text-gray-600" },
                { label: "Reviewing", value: data.counts.running, color: "text-blue-600" },
                { label: "Completed", value: data.counts.completed, color: "text-green-600" },
                { label: "Failed", value: data.counts.failed, color: "text-red-600" },
              ] as const
            ).map((stat) => (
              <div
                key={stat.label}
                className="bg-white p-4 rounded-lg border border-gray-200"
              >
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className={`text-2xl font-semibold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {data.results.length === 0 && (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No AI reviews yet</p>
              <p className="text-sm">
                Run the AI review to score every submission in this group on
                Best Use of Convex.
              </p>
            </div>
          )}

          {/* Ranked results */}
          {data.results.length > 0 && (
            <div className="space-y-3">
              {data.results.map((result, index) => {
                const isExpanded = expandedId === result._id;
                const isEditing = editingId === result._id;
                return (
                  <div
                    key={result._id}
                    className="bg-white rounded-lg border border-gray-200"
                  >
                    {/* Row header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {result.status === "completed" && (
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`/s/${result.storySlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 hover:underline truncate"
                            >
                              {result.storyTitle}
                            </a>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            {statusBadge(result.status)}
                            {result.editedAt && (
                              <span className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded-full">
                                Edited by admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {result.sourcesUsed && (
                              <>
                                <span
                                  className={`inline-flex items-center gap-1 ${result.sourcesUsed.github ? "text-green-600" : "text-gray-400"}`}
                                  title={
                                    result.sourcesUsed.github
                                      ? "GitHub repo was analyzed"
                                      : "GitHub repo was not accessible"
                                  }
                                >
                                  <Github className="w-3 h-3" />
                                  {result.sourcesUsed.github ? "repo" : "no repo"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 ${result.sourcesUsed.liveUrl ? "text-green-600" : "text-gray-400"}`}
                                  title={
                                    result.sourcesUsed.liveUrl
                                      ? "Live site was scraped"
                                      : "Live site was not scraped"
                                  }
                                >
                                  <Globe className="w-3 h-3" />
                                  {result.sourcesUsed.liveUrl ? "site" : "no site"}
                                </span>
                              </>
                            )}
                            {result.urlCheck && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${
                                  result.urlCheck.isLive
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                                title={`Live app URL check: ${result.urlCheck.note}${result.urlCheck.checkedUrl ? ` (${result.urlCheck.checkedUrl})` : ""}`}
                              >
                                {result.urlCheck.isLive
                                  ? "URL live"
                                  : result.urlCheck.statusCode === 404
                                    ? "URL 404"
                                    : result.urlCheck.checkedUrl
                                      ? "URL down"
                                      : "no URL"}
                              </span>
                            )}
                            {result.provider && (
                              <span title={result.model}>
                                via {result.provider}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {result.status === "completed" &&
                          result.averageScore !== undefined && (
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900">
                                {result.averageScore.toFixed(1)}
                                <span className="text-sm text-gray-400">/10</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                total {result.totalScore}
                              </p>
                            </div>
                          )}
                        {result.status === "failed" && (
                          <button
                            onClick={() => handleRetry(result._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                            title="Retry AI review for this submission"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                          </button>
                        )}
                        {result.status === "completed" && (
                          <button
                            onClick={() =>
                              setExpandedId(isExpanded ? null : result._id)
                            }
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title={isExpanded ? "Collapse" : "Expand details"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Failed error message */}
                    {result.status === "failed" && result.error && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                          {result.error}
                        </p>
                      </div>
                    )}

                    {/* Expanded details */}
                    {isExpanded && result.status === "completed" && (
                      <div className="border-t border-gray-100 p-4 space-y-4">
                        {/* Edit toggle */}
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900">
                            Criteria Scores
                          </h4>
                          {!isEditing ? (
                            <button
                              onClick={() => startEditing(result)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit Scores
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={saveEditing}
                                disabled={isSavingEdit}
                                className="bg-[#292929] hover:bg-[#525252]"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                {isSavingEdit ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                disabled={isSavingEdit}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Criteria */}
                        <div className="space-y-3">
                          {(isEditing ? editScores : result.criteriaScores || []).map(
                            (cs, csIndex) => (
                              <div
                                key={cs.key}
                                className="bg-gray-50 border border-gray-200 rounded-md p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-gray-900">
                                    {cs.label}
                                  </p>
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 10 }, (_, i) => i + 1).map(
                                        (score) => (
                                          <button
                                            key={score}
                                            type="button"
                                            onClick={() =>
                                              setEditScores((prev) =>
                                                prev.map((item, idx) =>
                                                  idx === csIndex
                                                    ? { ...item, score }
                                                    : item,
                                                ),
                                              )
                                            }
                                            className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${
                                              cs.score === score
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                                            }`}
                                          >
                                            {score}
                                          </button>
                                        ),
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm font-semibold text-gray-900">
                                      {cs.score}/10
                                    </span>
                                  )}
                                </div>
                                {isEditing ? (
                                  <div className="mt-2">
                                    <Label
                                      htmlFor={`reasoning-${result._id}-${cs.key}`}
                                      className="text-xs text-gray-500"
                                    >
                                      Reasoning
                                    </Label>
                                    <Textarea
                                      id={`reasoning-${result._id}-${cs.key}`}
                                      value={cs.reasoning}
                                      onChange={(e) =>
                                        setEditScores((prev) =>
                                          prev.map((item, idx) =>
                                            idx === csIndex
                                              ? {
                                                  ...item,
                                                  reasoning: e.target.value,
                                                }
                                              : item,
                                          ),
                                        )
                                      }
                                      rows={2}
                                      className="mt-1"
                                    />
                                  </div>
                                ) : (
                                  cs.reasoning && (
                                    <p className="text-sm text-gray-600 mt-2">
                                      {cs.reasoning}
                                    </p>
                                  )
                                )}
                              </div>
                            ),
                          )}
                        </div>

                        {/* Overall reasoning */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            Overall Note
                          </h4>
                          {isEditing ? (
                            <Textarea
                              value={editOverall}
                              onChange={(e) => setEditOverall(e.target.value)}
                              rows={3}
                            />
                          ) : (
                            <p className="text-sm text-gray-600">
                              {result.overallReasoning || "No overall note."}
                            </p>
                          )}
                        </div>

                        {/* Convex features detected */}
                        {result.convexFeaturesDetected &&
                          result.convexFeaturesDetected.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">
                                Convex Features Detected
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {result.convexFeaturesDetected.map((feature) => (
                                  <span
                                    key={feature}
                                    className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full"
                                  >
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Retry a completed review */}
                        <div className="pt-2 border-t border-gray-100">
                          <button
                            onClick={() => handleRetry(result._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                            title="Re-run the AI review for this submission (overwrites current scores)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Re-run this submission
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <DialogComponents />
    </div>
  );
}
