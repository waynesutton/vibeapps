import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  UserCheck,
  Award,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronRight,
  User,
  Mail,
  Target,
  AlertTriangle,
  Download,
  MessageSquare,
  Send,
  Star,
} from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ProfileHoverCard } from "../ui/ProfileHoverCard";
import { MentionTextarea } from "../ui/MentionTextarea";
import { renderTextWithMentions } from "../../utils/mentions";

interface JudgeTrackingProps {
  groupId: Id<"judgingGroups">;
  groupName: string;
  onBack: () => void;
}

export function JudgeTracking({
  groupId,
  groupName,
  onBack,
}: JudgeTrackingProps) {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const trackingData = useQuery(
    api.adminJudgeTracking.getGroupJudgeTracking,
    authIsLoading || !isAuthenticated ? "skip" : { groupId },
  );

  const [expandedJudges, setExpandedJudges] = useState<Set<Id<"judges">>>(
    new Set(),
  );
  const [editingScore, setEditingScore] = useState<{
    scoreId: Id<"judgeScores">;
    score: number;
    comments: string;
  } | null>(null);
  const [deleteConfirmJudge, setDeleteConfirmJudge] =
    useState<Id<"judges"> | null>(null);
  const [deleteConfirmScore, setDeleteConfirmScore] =
    useState<Id<"judgeScores"> | null>(null);
  const [expandedScoreForNotes, setExpandedScoreForNotes] =
    useState<Id<"judgeScores"> | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyingToNote, setReplyingToNote] =
    useState<Id<"submissionNotes"> | null>(null);
  const [selectedJudgeTabIndex, setSelectedJudgeTabIndex] = useState(0);

  // Mutations
  const updateJudgeScore = useMutation(api.adminJudgeTracking.updateJudgeScore);
  const toggleScoreVisibility = useMutation(
    api.adminJudgeTracking.toggleScoreVisibility,
  );
  const deleteJudgeScore = useMutation(api.adminJudgeTracking.deleteJudgeScore);
  const deleteJudge = useMutation(api.adminJudgeTracking.deleteJudge);
  const addSubmissionNote = useMutation(
    api.judgingGroupSubmissions.addSubmissionNote,
  );

  const judgeScores = useQuery(
    api.adminJudgeTracking.getJudgeDetailedScores,
    expandedJudges.size > 0 && authIsLoading === false && isAuthenticated
      ? { judgeId: Array.from(expandedJudges)[0] }
      : "skip",
  );

  // Get export data
  const exportData = useQuery(
    api.adminJudgeTracking.getJudgeTrackingExportData,
    authIsLoading || !isAuthenticated ? "skip" : { groupId },
  );

  // Get note counts for submissions
  const noteCountsData = useQuery(
    api.adminJudgeTracking.getSubmissionNoteCounts,
    authIsLoading || !isAuthenticated ? "skip" : { groupId },
  );

  // Get judge details for Judge Scores & Comments section
  const judgeDetailsData = useQuery(
    api.judgeScores.getGroupJudgeDetails,
    authIsLoading || !isAuthenticated ? "skip" : { groupId },
  );

  // Get submission notes when viewing notes for a score
  const submissionNotes = useQuery(
    api.judgingGroupSubmissions.getSubmissionNotes,
    expandedScoreForNotes && judgeScores
      ? {
          groupId,
          storyId:
            judgeScores.find((s) => s._id === expandedScoreForNotes)?.story
              ._id || ("" as Id<"stories">),
        }
      : "skip",
  );

  // Reset selected judge tab index if it's out of bounds
  useEffect(() => {
    if (judgeDetailsData && selectedJudgeTabIndex >= judgeDetailsData.length) {
      setSelectedJudgeTabIndex(0);
    }
  }, [judgeDetailsData, selectedJudgeTabIndex]);

  const handleExpandJudge = (judgeId: Id<"judges">) => {
    const newExpanded = new Set(expandedJudges);
    if (newExpanded.has(judgeId)) {
      newExpanded.delete(judgeId);
    } else {
      newExpanded.clear(); // Only allow one expanded at a time
      newExpanded.add(judgeId);
    }
    setExpandedJudges(newExpanded);
  };

  const handleUpdateScore = async () => {
    if (!editingScore) return;

    try {
      await updateJudgeScore({
        scoreId: editingScore.scoreId,
        score: editingScore.score,
        comments: editingScore.comments || undefined,
      });
      setEditingScore(null);
    } catch (error) {
      console.error("Error updating score:", error);
      alert("Failed to update score. Please try again.");
    }
  };

  const handleToggleScoreVisibility = async (
    scoreId: Id<"judgeScores">,
    isHidden: boolean,
  ) => {
    try {
      await toggleScoreVisibility({ scoreId, isHidden });
    } catch (error) {
      console.error("Error toggling score visibility:", error);
      alert("Failed to update score visibility. Please try again.");
    }
  };

  const handleDeleteScore = async (scoreId: Id<"judgeScores">) => {
    try {
      await deleteJudgeScore({ scoreId });
      setDeleteConfirmScore(null);
    } catch (error) {
      console.error("Error deleting score:", error);
      alert("Failed to delete score. Please try again.");
    }
  };

  const handleDeleteJudge = async (judgeId: Id<"judges">) => {
    try {
      await deleteJudge({ judgeId });
      setDeleteConfirmJudge(null);
      setExpandedJudges(new Set()); // Collapse any expanded judges
    } catch (error) {
      console.error("Error deleting judge:", error);
      alert("Failed to delete judge. Please try again.");
    }
  };

  const handleReplyToNote = async (noteId: Id<"submissionNotes">) => {
    if (!replyContent.trim() || !expandedScoreForNotes || !judgeScores) return;

    const score = judgeScores.find((s) => s._id === expandedScoreForNotes);
    if (!score) return;

    const currentJudgeId = Array.from(expandedJudges)[0];
    if (!currentJudgeId) return;

    try {
      await addSubmissionNote({
        groupId,
        storyId: score.story._id,
        judgeId: currentJudgeId,
        content: replyContent.trim(),
        replyToId: noteId,
      });
      setReplyContent("");
      setReplyingToNote(null);
    } catch (error) {
      console.error("Error adding reply:", error);
      alert("Failed to add reply. Please try again.");
    }
  };

  // CSV export handler
  const handleExportCSV = () => {
    if (!exportData || exportData.length === 0) {
      alert("No data available to export");
      return;
    }

    // CSV headers
    const headers = [
      "Judge Name",
      "Judge Email",
      "Judge Username",
      "Linked User ID",
      "Submission Title",
      "Submission Slug",
      "Criteria Question",
      "Criteria Description",
      "Score",
      "Total Score for Submission",
      "Comments",
      "Judge Notes",
      "Is Hidden",
      "Submitted At",
    ];

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Group data by submission (judgeName + storySlug) to add blank rows between submissions
    const groupedData: Array<Array<string[]>> = [];
    let currentGroup: Array<string[]> = [];
    let lastSubmissionKey = "";

    exportData.forEach((row, index) => {
      const submissionKey = `${row.judgeName}-${row.storySlug}`;

      // If we're on a new submission, save the current group and start a new one
      if (submissionKey !== lastSubmissionKey && currentGroup.length > 0) {
        groupedData.push(currentGroup);
        currentGroup = [];
      }

      currentGroup.push([
        row.judgeName,
        row.judgeEmail || "",
        row.judgeUsername || "",
        row.linkedUserId || "",
        row.storyTitle,
        row.storySlug,
        row.criteriaQuestion,
        row.criteriaDescription || "",
        row.score.toString(),
        row.totalScoreForSubmission.toString(),
        row.comments || "",
        row.judgeNotes || "",
        row.isHidden ? "Yes" : "No",
        row.submittedAtFormatted,
      ]);

      lastSubmissionKey = submissionKey;

      // Add the last group
      if (index === exportData.length - 1) {
        groupedData.push(currentGroup);
      }
    });

    // Build CSV content with blank rows between submissions
    const csvLines = [headers.map(escapeCSV).join(",")];

    groupedData.forEach((group, groupIndex) => {
      group.forEach((row) => {
        csvLines.push(row.map(escapeCSV).join(","));
      });
      // Add blank row between submissions (except after the last one)
      if (groupIndex < groupedData.length - 1) {
        csvLines.push("");
      }
    });

    const csvContent = csvLines.join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `judge-activity-${groupName.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authIsLoading) {
    return (
      <div className="space-y-6 text-center">Loading authentication...</div>
    );
  }

  if (!trackingData) {
    return (
      <div className="space-y-6 text-center">
        Loading judge tracking data...
      </div>
    );
  }

  const { group, judges } = trackingData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
          >
            ← Back to Judging System
          </button>
          <h2 className="text-xl font-medium text-[#525252]">
            Judge Tracking: {groupName}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Monitor and moderate judge activity and scores
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={handleExportCSV}
            disabled={!exportData || exportData.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            title="Export all judge scores to CSV"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${
              group.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {group.isActive ? "Active" : "Inactive"}
          </div>
          <span className="text-gray-500">
            {judges.length} judge{judges.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              Total Judges
            </span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {judges.length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">
              Total Scores
            </span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {judges.reduce((sum, judge) => sum + judge.scoresCount, 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Avg Score</span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {judges.length > 0
              ? (
                  judges.reduce(
                    (sum, judge) => sum + (judge.averageScore || 0),
                    0,
                  ) / judges.filter((j) => j.averageScore).length
                ).toFixed(1)
              : "0.0"}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700">
              Linked Profiles
            </span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {judges.filter((judge) => judge.userProfile).length}
          </div>
        </div>
      </div>

      {/* Judge Scores & Comments */}
      {judgeDetailsData && judgeDetailsData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Judge Scores & Comments
            </h3>
          </div>

          {/* Judge Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex flex-wrap gap-1 p-4">
              {judgeDetailsData.map((judge, index) => (
                <button
                  key={judge.judgeId}
                  onClick={() => setSelectedJudgeTabIndex(index)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedJudgeTabIndex === index
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
              const judge = judgeDetailsData[selectedJudgeTabIndex];
              return (
                <div key={judge.judgeId}>
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
                      ).map(([storyId, submissionData], submissionIndex) => (
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
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Judges List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Judge Activity</h3>
          <p className="text-sm text-gray-600 mt-1">
            Click on a judge to view and moderate their scores
          </p>
        </div>

        {judges.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No judges have registered for this group yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {judges.map((judge) => (
              <div key={judge._id} className="p-4">
                {/* Judge Header */}
                <div className="flex items-center justify-between gap-8">
                  <button
                    onClick={() => handleExpandJudge(judge._id)}
                    className="flex items-center gap-3 text-left hover:bg-gray-50 rounded p-2 -m-2"
                  >
                    <div className="flex items-center gap-2">
                      {expandedJudges.has(judge._id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        {judge.userProfile?.imageUrl ? (
                          <img
                            src={judge.userProfile.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <User className="w-4 h-4 text-gray-600" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {judge.name}
                        </span>
                        {judge.userProfile && (
                          <ProfileHoverCard
                            username={judge.userProfile.username}
                          >
                            <Link
                              to={`/${judge.userProfile.username || judge.userProfile._id}`}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                              title={`View profile: ${judge.userProfile.name}`}
                            >
                              <UserCheck className="w-3 h-3 mr-1" />
                              Linked Profile
                            </Link>
                          </ProfileHoverCard>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-4">
                        {judge.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {judge.email}
                          </span>
                        )}
                        {judge.userProfile?.username && (
                          <span>@{judge.userProfile.username}</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-6 text-sm text-gray-500 ml-auto">
                    <div className="text-center min-w-20">
                      <div className="font-medium text-gray-900">
                        {judge.submissionsJudged}
                      </div>
                      <div className="text-xs text-gray-500">
                        submissions judged
                      </div>
                    </div>
                    <div className="text-center min-w-16">
                      <div className="font-medium text-gray-900 flex items-center gap-1 justify-center">
                        {judge.notesCount || 0}
                        <MessageSquare className="w-3 h-3 text-purple-500" />
                      </div>
                      <div className="text-xs text-gray-500">notes</div>
                    </div>
                    <div className="text-center min-w-16">
                      <div className="font-medium text-gray-900">
                        {judge.averageScore
                          ? judge.averageScore.toFixed(1)
                          : "N/A"}
                      </div>
                      <div className="text-xs text-gray-500">avg score</div>
                    </div>
                    <div className="text-center min-w-24">
                      <div className="text-xs text-gray-600">
                        {judge.lastScoreAt
                          ? formatDistanceToNow(judge.lastScoreAt, {
                              addSuffix: true,
                            })
                          : "No scores"}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirmJudge(judge._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded ml-2"
                      title="Delete judge and all scores"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Judge Details */}
                {expandedJudges.has(judge._id) && judgeScores && (
                  <div className="mt-4 pl-6 border-l-2 border-gray-100">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          Judge Scores
                        </h4>
                        <div className="text-sm text-gray-500">
                          {judgeScores.length} total scores
                        </div>
                      </div>

                      {judgeScores.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <Target className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No scores submitted yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {judgeScores.map((score) => (
                            <div
                              key={score._id}
                              className={`p-3 rounded border ${
                                score.isHidden
                                  ? "bg-red-50 border-red-200"
                                  : "bg-gray-50 border-gray-200"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Link
                                      to={`/s/${score.story.slug}`}
                                      className="font-medium text-blue-600 hover:text-blue-800 truncate"
                                    >
                                      {score.story.title}
                                    </Link>
                                    {score.isHidden && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                                        <EyeOff className="w-3 h-3 mr-1" />
                                        Hidden
                                      </span>
                                    )}
                                    {noteCountsData &&
                                      noteCountsData[score.story._id] > 0 && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                                          <MessageSquare className="w-3 h-3 mr-1" />
                                          {noteCountsData[score.story._id]}{" "}
                                          {noteCountsData[score.story._id] === 1
                                            ? "note"
                                            : "notes"}
                                        </span>
                                      )}
                                  </div>
                                  <div className="text-sm text-gray-600 mb-2">
                                    <strong>{score.criteria.question}</strong>
                                    {score.criteria.description && (
                                      <span className="text-gray-500">
                                        {" "}
                                        - {score.criteria.description}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1">
                                      <Award className="w-3 h-3 text-yellow-500" />
                                      <span className="font-medium">
                                        {score.score}/10
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-gray-500">
                                      <Clock className="w-3 h-3" />
                                      {formatDistanceToNow(
                                        score._creationTime,
                                        { addSuffix: true },
                                      )}
                                    </div>
                                  </div>
                                  {score.comments && (
                                    <div className="mt-2 text-sm text-gray-700 bg-white p-2 rounded border">
                                      {score.comments}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() =>
                                      setExpandedScoreForNotes(
                                        expandedScoreForNotes === score._id
                                          ? null
                                          : score._id,
                                      )
                                    }
                                    className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                                    title="View judge notes"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setEditingScore({
                                        scoreId: score._id,
                                        score: score.score,
                                        comments: score.comments || "",
                                      })
                                    }
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit score"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleToggleScoreVisibility(
                                        score._id,
                                        !score.isHidden,
                                      )
                                    }
                                    className={`p-1 rounded ${
                                      score.isHidden
                                        ? "text-green-600 hover:bg-green-50"
                                        : "text-yellow-600 hover:bg-yellow-50"
                                    }`}
                                    title={
                                      score.isHidden
                                        ? "Show score"
                                        : "Hide score"
                                    }
                                  >
                                    {score.isHidden ? (
                                      <Eye className="w-3 h-3" />
                                    ) : (
                                      <EyeOff className="w-3 h-3" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      setDeleteConfirmScore(score._id)
                                    }
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Delete score"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Judge Notes Section */}
                              {expandedScoreForNotes === score._id &&
                                submissionNotes && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Judge Notes for this Submission
                                      </h5>
                                      <span className="text-xs text-gray-500">
                                        {submissionNotes.length} notes
                                      </span>
                                    </div>

                                    {submissionNotes.length === 0 ? (
                                      <div className="text-center py-4 text-gray-500 text-xs">
                                        <MessageSquare className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                        <p>No notes left by judges yet</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        {submissionNotes.map((note) => (
                                          <div
                                            key={note._id}
                                            className="bg-[#FFF9C4] border border-[#F9E79F] rounded p-3"
                                          >
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <User className="w-3 h-3 text-gray-600" />
                                                <span className="text-xs font-medium text-black">
                                                  {note.judgeName}
                                                </span>
                                                <span className="text-xs text-gray-700">
                                                  {formatDistanceToNow(
                                                    note._creationTime,
                                                    { addSuffix: true },
                                                  )}
                                                </span>
                                              </div>
                                              <button
                                                onClick={() =>
                                                  setReplyingToNote(note._id)
                                                }
                                                className="text-xs text-blue-700 hover:text-blue-900 hover:underline flex-shrink-0"
                                              >
                                                Reply
                                              </button>
                                            </div>

                                            <div className="text-xs text-black whitespace-pre-wrap mb-2">
                                              {renderTextWithMentions(
                                                note.content,
                                              )}
                                            </div>

                                            {/* Replies */}
                                            {note.replies &&
                                              note.replies.length > 0 && (
                                                <div className="ml-4 mt-3 space-y-2 border-l-2 border-[#F9E79F] pl-3">
                                                  {note.replies.map((reply) => (
                                                    <div
                                                      key={reply._id}
                                                      className="bg-[#FFFDE7] rounded p-2 border border-[#F9E79F]"
                                                    >
                                                      <div className="flex items-center gap-2 mb-1">
                                                        <User className="w-3 h-3 text-gray-600" />
                                                        <span className="text-xs font-medium text-black">
                                                          {reply.judgeName}
                                                        </span>
                                                        <span className="text-xs text-gray-700">
                                                          {formatDistanceToNow(
                                                            reply._creationTime,
                                                            { addSuffix: true },
                                                          )}
                                                        </span>
                                                      </div>
                                                      <div className="text-xs text-black whitespace-pre-wrap">
                                                        {renderTextWithMentions(
                                                          reply.content,
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}

                                            {/* Reply Form */}
                                            {replyingToNote === note._id && (
                                              <div className="ml-4 mt-3 border-l-2 border-[#F9E79F] pl-3">
                                                <MentionTextarea
                                                  value={replyContent}
                                                  onChange={setReplyContent}
                                                  placeholder="Write a reply as admin/moderator... (use @username to mention)"
                                                  rows={2}
                                                  className="mb-2 text-xs"
                                                />
                                                <div className="flex items-center gap-2">
                                                  <Button
                                                    onClick={() =>
                                                      handleReplyToNote(
                                                        note._id,
                                                      )
                                                    }
                                                    disabled={
                                                      !replyContent.trim()
                                                    }
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                  >
                                                    <Send className="w-3 h-3 mr-1" />
                                                    Reply
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                      setReplyingToNote(null);
                                                      setReplyContent("");
                                                    }}
                                                    className="h-7 text-xs"
                                                  >
                                                    Cancel
                                                  </Button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Score Modal */}
      {editingScore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit Score
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="score">Score (1-10)</Label>
                <Input
                  id="score"
                  type="number"
                  min="1"
                  max="10"
                  value={editingScore.score}
                  onChange={(e) =>
                    setEditingScore({
                      ...editingScore,
                      score: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  value={editingScore.comments}
                  onChange={(e) =>
                    setEditingScore({
                      ...editingScore,
                      comments: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingScore(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateScore}>Update Score</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Judge Confirmation */}
      {deleteConfirmJudge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Delete Judge
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will permanently delete the judge and all their scores. This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmJudge(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  deleteConfirmJudge && handleDeleteJudge(deleteConfirmJudge)
                }
              >
                Delete Judge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Score Confirmation */}
      {deleteConfirmScore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Delete Score
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will permanently delete this score. This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmScore(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  deleteConfirmScore && handleDeleteScore(deleteConfirmScore)
                }
              >
                Delete Score
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
