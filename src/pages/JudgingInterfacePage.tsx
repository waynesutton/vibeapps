import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Clock,
  Home,
  BarChart2,
  Github,
  Linkedin,
  Twitter,
  MessageSquare,
  Send,
  Reply,
  FileX,
  PlayCircle,
  User,
  Search,
  Users,
  Play,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { ImageGallery } from "../components/ImageGallery";
import { renderTextWithMentions } from "../utils/mentions";
import { MentionTextarea } from "../components/ui/MentionTextarea";
import { Markdown } from "../components/Markdown";
import { useDialog } from "../hooks/useDialog";

export default function JudgingInterfacePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { showMessage, DialogComponents } = useDialog();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);
  const [scores, setScores] = useState<
    Record<Id<"judgingCriteria">, { score: number; comments?: string }>
  >({});
  const [newNote, setNewNote] = useState("");
  const [replyingTo, setReplyingTo] = useState<Id<"submissionNotes"> | null>(
    null,
  );
  const [replyContent, setReplyContent] = useState("");
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [jumpToSubmission, setJumpToSubmission] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<Id<"tags"> | null>(null);
  const [filterNotJudged, setFilterNotJudged] = useState(false);
  const [selectedJudgeName, setSelectedJudgeName] = useState<string | null>(
    null,
  );

  // Get session ID from localStorage on mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem("judgeSessionId");
    if (!storedSessionId) {
      navigate(`/judging/${slug}`);
      return;
    }
    setSessionId(storedSessionId);
  }, [navigate, slug]);

  const judgeSession = useQuery(
    api.judges.getJudgeSession,
    sessionId ? { sessionId } : "skip",
  );

  const allSubmissions = useQuery(
    api.judgingGroupSubmissions.getGroupSubmissions,
    judgeSession ? { groupId: judgeSession.group._id } : "skip",
  );

  const criteria = useQuery(
    api.judgingCriteria.getGroupCriteria,
    judgeSession ? { groupId: judgeSession.group._id } : "skip",
  );

  const judgeProgress = useQuery(
    api.judges.getJudgeProgress,
    sessionId ? { sessionId } : "skip",
  );

  // Show ALL submissions in the group (no filtering)
  // The backend determines edit permissions via canEdit field
  const submissions = allSubmissions;

  // Check if any filters are active
  const hasActiveFilters =
    selectedTagId !== null || filterNotJudged || selectedJudgeName !== null;

  // Get unique list of judges who have completed at least one submission
  const activeJudges = judgeProgress?.submissionProgress
    ? Array.from(
        new Set(
          judgeProgress.submissionProgress
            .map((p) => p.completedBy)
            .filter((name): name is string => !!name),
        ),
      ).sort((a, b) => a.localeCompare(b))
    : [];

  // Filter submissions based on selected tag, judged status, and judge name
  const displaySubmissions =
    submissions?.filter((submission) => {
      // Filter by tag
      const matchesTag =
        !selectedTagId ||
        ((submission as any).tags || []).some(
          (tag: Doc<"tags">) => tag._id === selectedTagId,
        );

      // Filter by judged status
      let matchesJudgedFilter = true;
      if (filterNotJudged) {
        // When "Not Judged" is selected, only show submissions that haven't been completed by ANY judge
        const progressInfo = judgeProgress?.submissionProgress?.find(
          (p) => p.storyId === submission._id,
        );

        // Include only if no one has completed it yet (completedBy is undefined/null)
        matchesJudgedFilter = !progressInfo?.completedBy;
      }

      // Filter by selected judge name
      let matchesJudgeFilter = true;
      if (selectedJudgeName) {
        // When a specific judge is selected, only show submissions completed by that judge
        const progressInfo = judgeProgress?.submissionProgress?.find(
          (p) => p.storyId === submission._id,
        );

        // Include only if the selected judge completed it
        matchesJudgeFilter = progressInfo?.completedBy === selectedJudgeName;
      }

      return matchesTag && matchesJudgedFilter && matchesJudgeFilter;
    }) || [];

  // Get unique tags from submissions in the judging group
  // Must be calculated AFTER displaySubmissions since we use displaySubmissions for filtering
  const availableTags = submissions
    ? Array.from(
        new Map(
          submissions
            .flatMap((s) => (s as any).tags || [])
            .filter((tag: Doc<"tags">) => !tag.isHidden)
            .map((tag: Doc<"tags">) => [tag._id, tag]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Get scores from completed submission (if viewing submission completed by another judge)
  // This must be defined AFTER displaySubmissions since it depends on it
  const completedSubmissionScores = useQuery(
    api.judgeScores.getCompletedSubmissionScores,
    sessionId &&
      displaySubmissions &&
      displaySubmissions.length > 0 &&
      displaySubmissions[currentSubmissionIndex]
      ? { sessionId, storyId: displaySubmissions[currentSubmissionIndex]._id }
      : "skip",
  );

  const existingScores = useQuery(
    api.judgeScores.getJudgeSubmissionScores,
    sessionId &&
      displaySubmissions &&
      displaySubmissions.length > 0 &&
      displaySubmissions[currentSubmissionIndex]
      ? { sessionId, storyId: displaySubmissions[currentSubmissionIndex]._id }
      : "skip",
  );

  const submitScore = useMutation(api.judgeScores.submitScore);
  const updateActivity = useMutation(api.judges.updateActivity);

  // Status and notes functionality
  const submissionStatus = useQuery(
    api.judgingGroupSubmissions.getSubmissionStatusForJudge,
    judgeSession &&
      displaySubmissions &&
      displaySubmissions.length > 0 &&
      displaySubmissions[currentSubmissionIndex]
      ? {
          groupId: judgeSession.group._id,
          storyId: displaySubmissions[currentSubmissionIndex]._id,
          judgeId: judgeSession._id,
        }
      : "skip",
  );

  const submissionNotes = useQuery(
    api.judgingGroupSubmissions.getSubmissionNotes,
    judgeSession &&
      displaySubmissions &&
      displaySubmissions.length > 0 &&
      displaySubmissions[currentSubmissionIndex]
      ? {
          groupId: judgeSession.group._id,
          storyId: displaySubmissions[currentSubmissionIndex]._id,
        }
      : "skip",
  );

  const updateSubmissionStatus = useMutation(
    api.judgingGroupSubmissions.updateSubmissionStatus,
  );
  const addSubmissionNote = useMutation(
    api.judgingGroupSubmissions.addSubmissionNote,
  );

  // Reset index when filters change and current index is out of bounds
  useEffect(() => {
    if (
      displaySubmissions &&
      displaySubmissions.length > 0 &&
      currentSubmissionIndex >= displaySubmissions.length
    ) {
      setCurrentSubmissionIndex(0);
    }
  }, [displaySubmissions, currentSubmissionIndex]);

  // Load existing scores when submission changes
  useEffect(() => {
    if (existingScores) {
      const scoreMap: Record<string, { score: number; comments?: string }> = {};
      existingScores.forEach((score) => {
        scoreMap[score.criteriaId] = {
          score: score.score,
          comments: score.comments,
        };
      });
      setScores(scoreMap);
    } else {
      setScores({});
    }
  }, [existingScores, currentSubmissionIndex]);

  // Update activity periodically with client-side throttling
  useEffect(() => {
    if (sessionId) {
      const interval = setInterval(() => {
        // Pass current timestamp to the mutation
        updateActivity({
          sessionId,
          lastActiveAt: Date.now(),
        });
      }, 60000); // Update every 60 seconds (reduced from 30s to minimize conflicts)

      return () => clearInterval(interval);
    }
  }, [sessionId, updateActivity]);

  const handleScoreChange = async (
    criteriaId: Id<"judgingCriteria">,
    score: number,
    criteriaComments?: string,
  ) => {
    if (!sessionId || !displaySubmissions || !criteria) return;

    const currentSubmission = displaySubmissions[currentSubmissionIndex];

    try {
      await submitScore({
        sessionId,
        storyId: currentSubmission._id,
        criteriaId,
        score,
        comments: criteriaComments,
      });

      // Update local state
      setScores((prev) => ({
        ...prev,
        [criteriaId]: { score, comments: criteriaComments },
      }));
    } catch (error) {
      console.error("Error submitting score:", error);
      showMessage("Error", "Failed to save score. Please try again.", "error");
    }
  };

  const handleStatusUpdate = async (
    newStatus: "pending" | "completed" | "skip",
  ) => {
    if (!judgeSession || !displaySubmissions) return;

    const currentSubmission = displaySubmissions[currentSubmissionIndex];

    try {
      await updateSubmissionStatus({
        groupId: judgeSession.group._id,
        storyId: currentSubmission._id,
        status: newStatus,
        judgeId: judgeSession._id,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      showMessage(
        "Error",
        "Failed to update status. Please try again.",
        "error",
      );
    }
  };

  const handleMarkCompleted = async () => {
    if (!criteria) return;

    // Check if all criteria have been scored
    const allCriteriaScored = criteria.every(
      (criterion) => scores[criterion._id] && scores[criterion._id].score > 0,
    );

    if (!allCriteriaScored) {
      showMessage(
        "Incomplete Scoring",
        "Please score all criteria before marking as completed.",
        "warning",
      );
      return;
    }

    setIsMarkingCompleted(true);
    try {
      await handleStatusUpdate("completed");
    } finally {
      setIsMarkingCompleted(false);
    }
  };

  const handleAddNote = async () => {
    if (!judgeSession || !displaySubmissions || !newNote.trim()) return;

    const currentSubmission = displaySubmissions[currentSubmissionIndex];

    try {
      await addSubmissionNote({
        groupId: judgeSession.group._id,
        storyId: currentSubmission._id,
        judgeId: judgeSession._id,
        content: newNote.trim(),
      });
      setNewNote("");
    } catch (error) {
      console.error("Error adding note:", error);
      showMessage("Error", "Failed to add note. Please try again.", "error");
    }
  };

  const handleReply = async (noteId: Id<"submissionNotes">) => {
    if (!judgeSession || !displaySubmissions || !replyContent.trim()) return;

    const currentSubmission = displaySubmissions[currentSubmissionIndex];

    try {
      await addSubmissionNote({
        groupId: judgeSession.group._id,
        storyId: currentSubmission._id,
        judgeId: judgeSession._id,
        content: replyContent.trim(),
        replyToId: noteId,
      });
      setReplyContent("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error adding reply:", error);
      showMessage("Error", "Failed to add reply. Please try again.", "error");
    }
  };

  const isSessionValid = useQuery(
    api.judges.isSessionValid,
    sessionId ? { sessionId } : "skip",
  );

  if (isSessionValid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-medium text-gray-900 mb-4">
            Session Expired
          </h1>
          <p className="text-gray-600 mb-6">
            Your judging session has expired or the judging period has ended.
          </p>
          <Link
            to={`/judging/${slug}`}
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            Return to Group
          </Link>
        </div>
      </div>
    );
  }

  if (
    !judgeSession ||
    !submissions ||
    !criteria ||
    judgeProgress === undefined
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading judging interface...</p>
        </div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center">
          <h1 className="text-xl font-medium text-gray-900 mb-4">
            No Submissions
          </h1>
          <p className="text-gray-600 mb-6">
            There are no submissions to judge in this group yet.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Show filtered message if no submissions match filters
  if (displaySubmissions.length === 0 && hasActiveFilters) {
    return (
      <div className="min-h-screen bg-[#F4F2EE]">
        <div className="bg-[#F4F2EE] border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-medium text-gray-900">
                  {judgeSession.group.name}
                </h1>
                <p className="text-sm text-gray-600">
                  Judge: {judgeSession.name}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              No Submissions Match Filters
            </h2>
            <p className="text-gray-600 mb-4">
              Try adjusting your filters to see more submissions.
            </p>
            <Button
              onClick={() => {
                setSelectedTagId(null);
                setFilterNotJudged(false);
                setSelectedJudgeName(null);
              }}
              className="inline-flex items-center gap-2"
            >
              Clear All Filters
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentSubmission = displaySubmissions[currentSubmissionIndex];

  // If no current submission after filters (edge case), show loading
  if (!currentSubmission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading submission...</p>
        </div>
      </div>
    );
  }

  // Count submissions completed by ANY judge in the group (not just this judge)
  const completedSubmissions =
    judgeProgress?.submissionProgress.filter((s) => s.completedBy).length || 0;

  // Calculate group-wide completion percentage based on total submissions
  const groupCompletionPercentage = judgeProgress?.totalSubmissions
    ? (completedSubmissions / judgeProgress.totalSubmissions) * 100
    : 0;

  const nextSubmission = () => {
    setCurrentSubmissionIndex((prev) =>
      prev < displaySubmissions.length - 1 ? prev + 1 : prev,
    );
  };

  const previousSubmission = () => {
    setCurrentSubmissionIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleJumpToSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    const submissionNumber = parseInt(jumpToSubmission);
    if (
      !isNaN(submissionNumber) &&
      submissionNumber >= 1 &&
      submissionNumber <= displaySubmissions.length
    ) {
      setCurrentSubmissionIndex(submissionNumber - 1); // Convert to 0-based index
      setJumpToSubmission("");
    }
  };

  // Filter for search dropdown (applies search on top of display filters)
  const filteredSubmissions =
    displaySubmissions?.filter((submission) => {
      const matchesSearch = submission.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesSearch;
    }) || [];

  const handleSearchSubmission = (submissionId: string) => {
    if (!displaySubmissions) return;

    const index = displaySubmissions.findIndex((s) => s._id === submissionId);
    if (index !== -1) {
      setCurrentSubmissionIndex(index);
      setSearchQuery("");
      setShowSearchResults(false);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchResults(value.length > 0);
  };

  const renderStarRating = (
    criteriaId: Id<"judgingCriteria">,
    currentScore?: number,
    readonly: boolean = false,
    completedScore?: number,
  ) => {
    // If readonly, show the completed score
    const displayScore =
      readonly && completedScore !== undefined ? completedScore : currentScore;

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
            <button
              key={score}
              onClick={() =>
                !readonly &&
                handleScoreChange(
                  criteriaId,
                  score,
                  scores[criteriaId]?.comments,
                )
              }
              disabled={readonly}
              className={`px-2 py-1 text-sm font-medium rounded transition-colors ${
                displayScore === score
                  ? "bg-yellow-400 text-white"
                  : displayScore && score <= displayScore
                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } ${readonly ? "cursor-not-allowed opacity-75" : ""}`}
            >
              {score}
            </button>
          ))}
        </div>
        <span className="ml-2 text-sm text-gray-600">
          {displayScore ? `${displayScore}/10` : "Not scored"}
        </span>
      </div>
    );
  };

  return (
    <>
      <DialogComponents />
      <div className="min-h-screen bg-[#F4F2EE]">
        {/* Header */}
        <div className="bg-[#F4F2EE] border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-medium text-gray-900">
                  {judgeSession.group.name}
                </h1>
                <p className="text-sm text-gray-600">
                  Judge: {judgeSession.name}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Progress: {completedSubmissions}/
                  {judgeProgress?.totalSubmissions || 0} submissions
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${groupCompletionPercentage}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Legend */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg mx-4 my-4">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-6">
              <h3 className="text-sm font-medium text-blue-900">
                Judging Status Legend:
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-blue-800">
                    <strong>Pending</strong> - Ready to be judged
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-blue-800">
                    <strong>Completed</strong> - Judging finished
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileX className="w-4 h-4 text-gray-600" />
                  <span className="text-blue-800">
                    <strong>Skip</strong> - Not being judged
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Submission Details */}
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-3">
                  Submission {currentSubmissionIndex + 1} of{" "}
                  {displaySubmissions.length}
                  {hasActiveFilters && (
                    <span className="text-sm text-gray-500 ml-2">
                      (filtered from {submissions.length} total)
                    </span>
                  )}
                </h2>

                {/* Filters Row */}
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search submissions */}
                    <div className="relative w-full sm:w-48">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                        onBlur={() => {
                          // Delay hiding results to allow clicking on them
                          setTimeout(() => setShowSearchResults(false), 200);
                        }}
                        onFocus={() =>
                          searchQuery && setShowSearchResults(true)
                        }
                        placeholder="Search submissions..."
                        className="w-full h-8 text-sm pl-7"
                      />

                      {/* Search Results Dropdown */}
                      {showSearchResults && filteredSubmissions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 sm:min-w-[300px] mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                          {filteredSubmissions
                            .slice(0, 10)
                            .map((submission) => {
                              const submissionIndex =
                                displaySubmissions.findIndex(
                                  (s) => s._id === submission._id,
                                );
                              // Get completion info from judgeProgress
                              const progressInfo =
                                judgeProgress?.submissionProgress.find(
                                  (p) => p.storyId === submission._id,
                                );
                              return (
                                <button
                                  key={submission._id}
                                  onClick={() =>
                                    handleSearchSubmission(submission._id)
                                  }
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {submission.title}
                                    </span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {progressInfo?.isComplete && (
                                        <CheckCircle className="w-3 h-3 text-green-600" />
                                      )}
                                      {!progressInfo?.canEdit && (
                                        <span className="text-xs text-gray-500">
                                          (by {progressInfo?.completedBy})
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-500">
                                        #{submissionIndex + 1}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          {filteredSubmissions.length > 10 && (
                            <div className="px-3 py-2 text-xs text-gray-500 text-center border-t border-gray-100">
                              Showing first 10 of {filteredSubmissions.length}{" "}
                              results
                            </div>
                          )}
                        </div>
                      )}

                      {/* No results message */}
                      {showSearchResults &&
                        searchQuery &&
                        filteredSubmissions.length === 0 && (
                          <div className="absolute top-full left-0 right-0 sm:min-w-[300px] mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              No submissions found matching "{searchQuery}"
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Filter by tag */}
                    <div className="relative w-full sm:w-auto">
                      <select
                        value={selectedTagId || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedTagId(
                            value ? (value as Id<"tags">) : null,
                          );
                        }}
                        className="w-full sm:w-44 h-8 text-sm px-2 pr-8 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                      >
                        <option value="">All Tags</option>
                        {availableTags.map((tag) => (
                          <option key={tag._id} value={tag._id}>
                            {tag.emoji ? `${tag.emoji} ` : ""}
                            {tag.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Filter by judged status */}
                    <div className="relative w-full sm:w-auto">
                      <select
                        value={filterNotJudged ? "notJudged" : "all"}
                        onChange={(e) => {
                          setFilterNotJudged(e.target.value === "notJudged");
                        }}
                        className="w-full sm:w-44 h-8 text-sm px-2 pr-8 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                      >
                        <option value="all">All Submissions</option>
                        <option value="notJudged">Not Judged</option>
                      </select>
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Filter by Judge - separate dropdown with all active judges */}
                    <div className="relative w-full sm:w-auto">
                      <select
                        value={selectedJudgeName || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedJudgeName(value ? value : null);
                        }}
                        className="w-full sm:w-44 h-8 text-sm px-2 pr-8 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                      >
                        <option value="">All Judges</option>
                        {activeJudges.map((judgeName) => (
                          <option key={judgeName} value={judgeName}>
                            {judgeName}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Row */}
                  <div className="flex items-center gap-2">
                    <form
                      onSubmit={handleJumpToSubmission}
                      className="flex items-center gap-1"
                    >
                      <Input
                        type="number"
                        value={jumpToSubmission}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setJumpToSubmission(e.target.value)
                        }
                        placeholder="#"
                        min="1"
                        max={displaySubmissions.length}
                        className="w-12 sm:w-16 h-8 text-sm text-center"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={!jumpToSubmission.trim()}
                        className="px-2 text-xs sm:text-sm"
                      >
                        Go
                      </Button>
                    </form>

                    {/* Navigation buttons */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={previousSubmission}
                      disabled={currentSubmissionIndex === 0}
                      className="px-2 sm:px-3"
                    >
                      <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={nextSubmission}
                      disabled={
                        currentSubmissionIndex === displaySubmissions.length - 1
                      }
                      className="px-2 sm:px-3"
                    >
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      {currentSubmission.title}
                    </h3>

                    {/* App/Project Tagline Description */}
                    <p className="text-gray-600 text-sm leading-relaxed mb-3">
                      {currentSubmission.description}
                    </p>

                    {/* Status Section */}
                    {submissionStatus && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                              Status:
                            </span>
                            <div className="flex items-center gap-1">
                              {submissionStatus.status === "pending" && (
                                <>
                                  <PlayCircle className="w-4 h-4 text-yellow-600" />
                                  <span className="text-sm text-yellow-700 font-medium">
                                    Pending
                                  </span>
                                </>
                              )}
                              {submissionStatus.status === "completed" && (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-sm text-green-700 font-medium">
                                    Completed
                                  </span>
                                  {submissionStatus.assignedJudgeName && (
                                    <span className="text-sm text-gray-600">
                                      by {submissionStatus.assignedJudgeName}
                                    </span>
                                  )}
                                </>
                              )}
                              {submissionStatus.status === "skip" && (
                                <>
                                  <FileX className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm text-gray-700 font-medium">
                                    Skip
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Status Controls */}
                          {(submissionStatus.canJudge ||
                            (submissionStatus.status === "completed" &&
                              submissionStatus.assignedJudgeName &&
                              judgeSession &&
                              submissionStatus.assignedJudgeName ===
                                judgeSession.name)) && (
                            <div className="flex items-center gap-2">
                              {submissionStatus.status !== "skip" &&
                                submissionStatus.status !== "completed" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStatusUpdate("skip")}
                                    className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
                                  >
                                    <FileX className="w-3 h-3" />
                                    Skip
                                  </Button>
                                )}
                              {submissionStatus.status === "skip" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStatusUpdate("pending")}
                                  className="text-yellow-600 hover:text-yellow-800 flex items-center gap-2"
                                >
                                  <PlayCircle className="w-3 h-3" />
                                  Resume
                                </Button>
                              )}
                              {submissionStatus.status === "completed" &&
                                submissionStatus.assignedJudgeName &&
                                judgeSession &&
                                submissionStatus.assignedJudgeName ===
                                  judgeSession.name && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleStatusUpdate("pending")
                                    }
                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
                                  >
                                    <PlayCircle className="w-3 h-3" />
                                    Edit Scores
                                  </Button>
                                )}
                            </div>
                          )}
                        </div>

                        {!submissionStatus.canJudge &&
                          submissionStatus.status === "completed" && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600">
                                This submission has been completed by{" "}
                                {submissionStatus.assignedJudgeName ||
                                  "another judge"}
                                . You can view it but cannot edit the scores.
                              </p>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Project Info Section - Combined Box */}
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                      {/* Project Links */}
                      {(currentSubmission.url ||
                        (currentSubmission as any).linkedinUrl ||
                        (currentSubmission as any).twitterUrl ||
                        (currentSubmission as any).githubUrl ||
                        (currentSubmission as any).chefShowUrl ||
                        (currentSubmission as any).chefAppUrl) && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            Project Links
                          </h4>
                          <div className="flex flex-wrap gap-4">
                            {currentSubmission.url && (
                              <div className="flex items-center gap-2">
                                <ExternalLink className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                <a
                                  href={currentSubmission.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline truncate"
                                  title={currentSubmission.url}
                                >
                                  Live App
                                </a>
                              </div>
                            )}
                            {(currentSubmission as any).linkedinUrl && (
                              <div className="flex items-center gap-2">
                                <Linkedin className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                <a
                                  href={(currentSubmission as any).linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline truncate"
                                  title={(currentSubmission as any).linkedinUrl}
                                >
                                  LinkedIn
                                </a>
                              </div>
                            )}
                            {(currentSubmission as any).twitterUrl && (
                              <div className="flex items-center gap-2">
                                <Twitter className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                <a
                                  href={(currentSubmission as any).twitterUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline truncate"
                                  title={(currentSubmission as any).twitterUrl}
                                >
                                  Twitter
                                </a>
                              </div>
                            )}
                            {(currentSubmission as any).githubUrl && (
                              <div className="flex items-center gap-2">
                                <Github className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                <a
                                  href={(currentSubmission as any).githubUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline truncate"
                                  title={(currentSubmission as any).githubUrl}
                                >
                                  GitHub
                                </a>
                              </div>
                            )}
                            {(currentSubmission as any).chefShowUrl && (
                              <div className="flex items-center gap-2">
                                <span className="w-4 h-4 text-gray-600 flex-shrink-0">
                                  🍲
                                </span>
                                <a
                                  href={(currentSubmission as any).chefShowUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline truncate"
                                  title={(currentSubmission as any).chefShowUrl}
                                >
                                  Chef Show
                                </a>
                              </div>
                            )}
                            {(currentSubmission as any).chefAppUrl && (
                              <div className="flex items-center gap-2">
                                <span className="w-4 h-4 text-gray-600 flex-shrink-0">
                                  🍲
                                </span>
                                <a
                                  href={(currentSubmission as any).chefAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline truncate"
                                  title={(currentSubmission as any).chefAppUrl}
                                >
                                  Chef App
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {(currentSubmission as any).tags &&
                        (currentSubmission as any).tags.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">
                              Tags
                            </h4>
                            <div className="flex gap-1.5 flex-wrap">
                              {((currentSubmission as any).tags || []).map(
                                (tag: Doc<"tags">) =>
                                  !tag.isHidden &&
                                  tag.name !== "resendhackathon" &&
                                  tag.name !== "ychackathon" && (
                                    <Link
                                      key={tag._id}
                                      to={`/tag/${tag.slug}`}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                                      style={{
                                        backgroundColor:
                                          tag.backgroundColor || "#F4F0ED",
                                        color: tag.textColor || "#525252",
                                        border: `1px solid ${tag.borderColor || (tag.backgroundColor ? "transparent" : "#D5D3D0")}`,
                                      }}
                                      title={`View all apps tagged with ${tag.name}`}
                                    >
                                      {tag.emoji && (
                                        <span className="mr-1">
                                          {tag.emoji}
                                        </span>
                                      )}
                                      {tag.iconUrl && !tag.emoji && (
                                        <img
                                          src={tag.iconUrl}
                                          alt=""
                                          className="w-3 h-3 mr-1 rounded-sm object-cover"
                                        />
                                      )}
                                      {tag.name}
                                    </Link>
                                  ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Visit Submission and View Change Log buttons */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <Link
                          to={`/s/${currentSubmission.slug}`}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Visit Submission
                        </Link>
                        <Link
                          to={`/s/${currentSubmission.slug}#changelog`}
                          className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
                        >
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          View Change Log
                        </Link>
                      </div>

                      {/* Originally submitted date */}
                      <div className="text-sm text-gray-600 space-y-1 pt-2 border-t border-gray-200">
                        <div>
                          <span className="font-medium text-gray-700">
                            Originally submitted:
                          </span>{" "}
                          {new Date(
                            currentSubmission._creationTime,
                          ).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          at{" "}
                          {new Date(
                            currentSubmission._creationTime,
                          ).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {(currentSubmission as any).changeLog &&
                          (currentSubmission as any).changeLog.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700">
                                Last modified:
                              </span>{" "}
                              {new Date(
                                (currentSubmission as any).changeLog[
                                  (currentSubmission as any).changeLog.length -
                                    1
                                ].timestamp,
                              ).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              at{" "}
                              {new Date(
                                (currentSubmission as any).changeLog[
                                  (currentSubmission as any).changeLog.length -
                                    1
                                ].timestamp,
                              ).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {currentSubmission.longDescription && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Detailed Description
                      </h4>
                      <div className="prose prose-sm max-w-none text-gray-700">
                        <Markdown>{currentSubmission.longDescription}</Markdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Demo Section */}
              {currentSubmission.videoUrl &&
                currentSubmission.videoUrl.trim() && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Play className="w-4 h-4 text-gray-600 flex-shrink-0" />
                      <h3 className="font-medium text-gray-900">Video Demo</h3>
                      <a
                        href={currentSubmission.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-600 hover:text-gray-900 hover:underline ml-auto"
                        title="Open in new tab"
                      >
                        ↗
                      </a>
                    </div>
                    <div className="w-full">
                      {(() => {
                        const url = currentSubmission.videoUrl.trim();

                        // YouTube URL patterns (including Shorts)
                        const youtubeMatch = url.match(
                          /(?:youtube\.com\/(?:shorts\/|[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
                        );
                        if (youtubeMatch) {
                          const videoId = youtubeMatch[1];
                          return (
                            <iframe
                              src={`https://www.youtube.com/embed/${videoId}`}
                              className="w-full aspect-video rounded-md"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                              title="Video Demo"
                            />
                          );
                        }

                        // Vimeo URL patterns
                        const vimeoMatch = url.match(
                          /(?:vimeo\.com\/)(?:.*\/)?(\d+)/,
                        );
                        if (vimeoMatch) {
                          const videoId = vimeoMatch[1];
                          return (
                            <iframe
                              src={`https://player.vimeo.com/video/${videoId}`}
                              className="w-full aspect-video rounded-md"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                              title="Video Demo"
                            />
                          );
                        }

                        // Loom URL patterns
                        const loomMatch = url.match(
                          /(?:loom\.com\/share\/)([a-f0-9-]+)/,
                        );
                        if (loomMatch) {
                          const videoId = loomMatch[1];
                          return (
                            <iframe
                              src={`https://www.loom.com/embed/${videoId}`}
                              className="w-full aspect-video rounded-md"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                              title="Video Demo"
                            />
                          );
                        }

                        // Google Drive URL patterns
                        const driveMatch = url.match(
                          /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
                        );
                        if (driveMatch) {
                          const fileId = driveMatch[1];
                          return (
                            <iframe
                              src={`https://drive.google.com/file/d/${fileId}/preview`}
                              className="w-full aspect-video rounded-md"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                              title="Video Demo"
                            />
                          );
                        }

                        // Check if it's a direct video file
                        const videoExtensions =
                          /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i;
                        if (videoExtensions.test(url)) {
                          return (
                            <video
                              src={url}
                              className="w-full aspect-video rounded-md bg-black"
                              controls
                              preload="metadata"
                              title="Video Demo"
                            >
                              Your browser does not support the video tag.
                            </video>
                          );
                        }

                        // Fallback for other URLs - show as link in a styled box
                        return (
                          <div className="w-full aspect-video rounded-md border-2 border-dashed border-gray-200 flex items-center justify-center bg-[#F4F2EE]">
                            <div className="text-center">
                              <Play className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-600 mb-2">
                                Video not embeddable
                              </p>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-900 hover:text-gray-700 underline"
                              >
                                Watch Video ↗
                              </a>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

              {/* Screenshot/Media */}
              {(currentSubmission.screenshotUrl ||
                (currentSubmission as any).additionalImageUrls?.length > 0) && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="font-medium text-gray-900 mb-4">
                    {currentSubmission.screenshotUrl &&
                    (currentSubmission as any).additionalImageUrls?.length > 0
                      ? "Images"
                      : currentSubmission.screenshotUrl
                        ? "Screenshot"
                        : "Additional Images"}
                  </h3>

                  <ImageGallery
                    mainImageUrl={currentSubmission.screenshotUrl || null}
                    additionalImageUrls={
                      (currentSubmission as any).additionalImageUrls || []
                    }
                    altText={`${currentSubmission.title} screenshot`}
                  />
                </div>
              )}

              {/* Team Info Section */}
              {(currentSubmission as any).teamName && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-gray-600" />
                    <h3 className="font-medium text-gray-900">Team Info</h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Team Name:{" "}
                      </span>
                      <span className="text-sm text-gray-900">
                        {(currentSubmission as any).teamName}
                      </span>
                    </div>

                    {(currentSubmission as any).teamMemberCount && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Team Size:{" "}
                        </span>
                        <span className="text-sm text-gray-900">
                          {(currentSubmission as any).teamMemberCount}{" "}
                          {(currentSubmission as any).teamMemberCount === 1
                            ? "member"
                            : "members"}
                        </span>
                      </div>
                    )}

                    {(currentSubmission as any).teamMembers &&
                      (currentSubmission as any).teamMembers.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-700 block mb-2">
                            Team Members:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(currentSubmission as any).teamMembers.map(
                              (member: any, index: number) => (
                                <div
                                  key={index}
                                  className="p-2 bg-gray-50 rounded border border-gray-200"
                                >
                                  {member.name && (
                                    <p className="font-medium text-gray-900 text-xs">
                                      {member.name}
                                    </p>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Judge Notes Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Judge Collaboration Notes
                  </h3>
                  <span className="text-sm text-gray-500">
                    {submissionNotes ? submissionNotes.length : 0} notes
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Share observations and collaborate with other judges. These
                  notes don't affect scoring.
                </p>

                {/* Add Note Form */}
                <div className="mb-6">
                  <MentionTextarea
                    value={newNote}
                    onChange={setNewNote}
                    placeholder="Add a note for other judges to see... (use @username to mention users)"
                    rows={3}
                    className="mb-2"
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Send className="w-3 h-3" />
                    Add Note
                  </Button>
                </div>

                {/* Notes Thread */}
                <div className="space-y-4">
                  {submissionNotes && submissionNotes.length > 0 ? (
                    submissionNotes.map((note) => (
                      <div
                        key={note._id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {note.judgeName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(note._creationTime).toLocaleString()}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReplyingTo(note._id)}
                            className="text-xs"
                          >
                            <Reply className="w-3 h-3 mr-1" />
                            Reply
                          </Button>
                        </div>

                        <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
                          {renderTextWithMentions(note.content)}
                        </div>

                        {/* Replies */}
                        {note.replies && note.replies.length > 0 && (
                          <div className="ml-6 space-y-3 border-l-2 border-gray-100 pl-4">
                            {note.replies.map((reply) => (
                              <div
                                key={reply._id}
                                className="bg-gray-50 rounded p-3"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs font-medium text-gray-900">
                                    {reply.judgeName}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(
                                      reply._creationTime,
                                    ).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-700 whitespace-pre-wrap">
                                  {renderTextWithMentions(reply.content)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Form */}
                        {replyingTo === note._id && (
                          <div className="ml-6 mt-3 border-l-2 border-blue-200 pl-4">
                            <MentionTextarea
                              value={replyContent}
                              onChange={setReplyContent}
                              placeholder="Write a reply... (use @username to mention users)"
                              rows={2}
                              className="mb-2"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => handleReply(note._id)}
                                disabled={!replyContent.trim()}
                                size="sm"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Reply
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyContent("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">
                        No notes yet. Be the first to add one!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scoring Section */}
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Scoring Criteria
                </h3>

                {/* Show completion notice if completed by another judge */}
                {submissionStatus &&
                  submissionStatus.status === "completed" &&
                  submissionStatus.assignedJudgeName &&
                  judgeSession &&
                  submissionStatus.assignedJudgeName !== judgeSession.name && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <h4 className="font-medium text-gray-900">
                          Completed by Another Judge
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        This submission has been completed by{" "}
                        <strong>{submissionStatus.assignedJudgeName}</strong>.
                        You can view their scores below but cannot edit them.
                      </p>
                    </div>
                  )}

                <div className={`space-y-4`}>
                  {criteria.map((criterion) => {
                    const currentScore = scores[criterion._id]?.score;
                    const isComplete = !!currentScore;
                    const isReadonly =
                      submissionStatus &&
                      submissionStatus.status === "completed" &&
                      submissionStatus.assignedJudgeName &&
                      judgeSession &&
                      submissionStatus.assignedJudgeName !== judgeSession.name;

                    // Get completed score if viewing another judge's work
                    const completedScore =
                      isReadonly && completedSubmissionScores
                        ? completedSubmissionScores.scores.find(
                            (s) => s.criteriaId === criterion._id,
                          )?.score
                        : undefined;
                    const completedComments =
                      isReadonly && completedSubmissionScores
                        ? completedSubmissionScores.scores.find(
                            (s) => s.criteriaId === criterion._id,
                          )?.comments
                        : undefined;

                    return (
                      <div key={criterion._id} className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900">
                                {criterion.question}
                              </h4>
                              {(isComplete || completedScore) && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                            </div>
                            {criterion.description && (
                              <p className="text-sm text-gray-600 mb-3">
                                {criterion.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {renderStarRating(
                          criterion._id,
                          currentScore,
                          !!isReadonly,
                          completedScore,
                        )}

                        <div>
                          <Label
                            htmlFor={`comments-${criterion._id}`}
                            className="text-sm"
                          >
                            Comments {isReadonly ? "" : "(Optional)"}
                          </Label>
                          <Textarea
                            id={`comments-${criterion._id}`}
                            value={
                              isReadonly
                                ? completedComments || "No comments provided"
                                : scores[criterion._id]?.comments || ""
                            }
                            onChange={(e) => {
                              if (isReadonly) return;
                              const newComments = e.target.value;
                              // Update local state immediately for smooth typing
                              setScores((prev) => ({
                                ...prev,
                                [criterion._id]: {
                                  score: prev[criterion._id]?.score || 0,
                                  comments: newComments,
                                },
                              }));
                            }}
                            onBlur={() => {
                              if (isReadonly) return;
                              // Save to backend when user finishes typing (on blur)
                              const currentScore = scores[criterion._id]?.score;
                              const currentComments =
                                scores[criterion._id]?.comments;
                              if (
                                currentScore &&
                                currentComments !== undefined
                              ) {
                                handleScoreChange(
                                  criterion._id,
                                  currentScore,
                                  currentComments,
                                );
                              }
                            }}
                            placeholder={
                              isReadonly
                                ? "No comments provided"
                                : "Add your thoughts about this criteria..."
                            }
                            className="text-sm"
                            rows={2}
                            disabled={!!isReadonly}
                            readOnly={!!isReadonly}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Summary */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Your Progress
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Completed Submissions</span>
                    <span className="font-medium">
                      {completedSubmissions}/
                      {judgeProgress?.totalSubmissions || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Overall Progress</span>
                    <span className="font-medium">
                      {Math.round(groupCompletionPercentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${groupCompletionPercentage}%`,
                      }}
                    ></div>
                  </div>

                  {/* Mark Completed Button */}
                  {submissionStatus &&
                    submissionStatus.canJudge &&
                    submissionStatus.status !== "completed" && (
                      <div className="pt-3 border-t border-gray-100">
                        <Button
                          onClick={handleMarkCompleted}
                          disabled={isMarkingCompleted}
                          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {isMarkingCompleted
                            ? "Marking Complete..."
                            : "Mark Submission Complete"}
                        </Button>
                        <p className="text-xs text-gray-500 text-center mt-2">
                          All criteria must be scored before marking complete
                        </p>
                      </div>
                    )}

                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <Link
                        to={`/judging/${slug}/results`}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <BarChart2 className="w-4 h-4" />
                        View Results
                      </Link>
                      <Link
                        to={`/judging/${slug}`}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <BarChart2 className="w-4 h-4" />
                        Back to Group Page
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
