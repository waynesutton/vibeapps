import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Star,
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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";

export default function JudgingInterfacePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

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

  const submissions = useQuery(
    api.judgingGroupSubmissions.getGroupSubmissions,
    judgeSession ? { groupId: judgeSession.group._id } : "skip",
  );

  const criteria = useQuery(
    api.judgingCriteria.getGroupCriteria,
    judgeSession ? { groupId: judgeSession.group._id } : "skip",
  );

  const existingScores = useQuery(
    api.judgeScores.getJudgeSubmissionScores,
    sessionId && submissions && submissions.length > 0
      ? { sessionId, storyId: submissions[currentSubmissionIndex]._id }
      : "skip",
  );

  const judgeProgress = useQuery(
    api.judges.getJudgeProgress,
    sessionId ? { sessionId } : "skip",
  );

  const submitScore = useMutation(api.judgeScores.submitScore);
  const updateActivity = useMutation(api.judges.updateActivity);

  // Status and notes functionality
  const submissionStatus = useQuery(
    api.judgingGroupSubmissions.getSubmissionStatusForJudge,
    judgeSession && submissions && submissions.length > 0
      ? {
          groupId: judgeSession.group._id,
          storyId: submissions[currentSubmissionIndex]._id,
          judgeId: judgeSession._id,
        }
      : "skip",
  );

  const submissionNotes = useQuery(
    api.judgingGroupSubmissions.getSubmissionNotes,
    judgeSession && submissions && submissions.length > 0
      ? {
          groupId: judgeSession.group._id,
          storyId: submissions[currentSubmissionIndex]._id,
        }
      : "skip",
  );

  const updateSubmissionStatus = useMutation(
    api.judgingGroupSubmissions.updateSubmissionStatus,
  );
  const addSubmissionNote = useMutation(
    api.judgingGroupSubmissions.addSubmissionNote,
  );

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

  // Update activity periodically
  useEffect(() => {
    if (sessionId) {
      const interval = setInterval(() => {
        updateActivity({ sessionId });
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [sessionId, updateActivity]);

  const handleScoreChange = async (
    criteriaId: Id<"judgingCriteria">,
    score: number,
    criteriaComments?: string,
  ) => {
    if (!sessionId || !submissions || !criteria) return;

    const currentSubmission = submissions[currentSubmissionIndex];

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
      alert("Failed to save score. Please try again.");
    }
  };

  const handleStatusUpdate = async (
    newStatus: "pending" | "completed" | "skip",
  ) => {
    if (!judgeSession || !submissions) return;

    const currentSubmission = submissions[currentSubmissionIndex];

    try {
      await updateSubmissionStatus({
        groupId: judgeSession.group._id,
        storyId: currentSubmission._id,
        status: newStatus,
        judgeId: judgeSession._id,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  const handleMarkCompleted = async () => {
    if (!criteria) return;

    // Check if all criteria have been scored
    const allCriteriaScored = criteria.every(
      (criterion) => scores[criterion._id] && scores[criterion._id].score > 0,
    );

    if (!allCriteriaScored) {
      alert("Please score all criteria before marking as completed.");
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
    if (!judgeSession || !submissions || !newNote.trim()) return;

    const currentSubmission = submissions[currentSubmissionIndex];

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
      alert("Failed to add note. Please try again.");
    }
  };

  const handleReply = async (noteId: Id<"submissionNotes">) => {
    if (!judgeSession || !submissions || !replyContent.trim()) return;

    const currentSubmission = submissions[currentSubmissionIndex];

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
      alert("Failed to add reply. Please try again.");
    }
  };

  const isSessionValid = useQuery(
    api.judges.isSessionValid,
    sessionId ? { sessionId } : "skip",
  );

  if (isSessionValid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
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
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
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

  const currentSubmission = submissions[currentSubmissionIndex];
  const completedSubmissions =
    judgeProgress?.submissionProgress.filter((s) => s.isComplete).length || 0;

  const nextSubmission = () => {
    setCurrentSubmissionIndex((prev) =>
      prev < submissions.length - 1 ? prev + 1 : prev,
    );
  };

  const previousSubmission = () => {
    setCurrentSubmissionIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const renderStarRating = (
    criteriaId: Id<"judgingCriteria">,
    currentScore?: number,
  ) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() =>
              handleScoreChange(criteriaId, star, scores[criteriaId]?.comments)
            }
            className="transition-colors hover:scale-110"
          >
            <Star
              className={`w-6 h-6 ${
                currentScore && star <= currentScore
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 hover:text-yellow-300"
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {currentScore ? `${currentScore}/5` : "Not scored"}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
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
                    width: `${judgeProgress?.completionPercentage || 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-blue-50 border-b border-blue-200">
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

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submission Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Submission {currentSubmissionIndex + 1} of{" "}
                  {submissions.length}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previousSubmission}
                    disabled={currentSubmissionIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextSubmission}
                    disabled={currentSubmissionIndex === submissions.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    {currentSubmission.title}
                  </h3>

                  {/* Status Section */}
                  {submissionStatus && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
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
                                  className="text-gray-600 hover:text-gray-800"
                                >
                                  <FileX className="w-3 h-3 mr-1" />
                                  Skip
                                </Button>
                              )}
                            {submissionStatus.status === "skip" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate("pending")}
                                className="text-yellow-600 hover:text-yellow-800"
                              >
                                <PlayCircle className="w-3 h-3 mr-1" />
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
                                  onClick={() => handleStatusUpdate("pending")}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <PlayCircle className="w-3 h-3 mr-1" />
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
                              This submission has been completed and can no
                              longer be judged.
                            </p>
                          </div>
                        )}
                    </div>
                  )}

                  <p className="text-gray-600 text-sm leading-relaxed">
                    {currentSubmission.description}
                  </p>
                </div>

                {currentSubmission.longDescription && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Detailed Description
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {currentSubmission.longDescription}
                    </p>
                  </div>
                )}

                {/* Project Links Section */}
                {((currentSubmission as any).linkedinUrl ||
                  (currentSubmission as any).twitterUrl ||
                  (currentSubmission as any).githubUrl ||
                  (currentSubmission as any).chefShowUrl ||
                  (currentSubmission as any).chefAppUrl) && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      Project Links
                    </h4>
                    <div className="flex flex-wrap gap-4">
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

                <div className="flex items-center gap-4">
                  <a
                    href={currentSubmission.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Visit App
                  </a>
                  {currentSubmission.videoUrl && (
                    <a
                      href={currentSubmission.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Watch Demo
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Screenshot/Media */}
            {currentSubmission.screenshotUrl && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Screenshot</h3>
                <img
                  src={currentSubmission.screenshotUrl}
                  alt={`Screenshot of ${currentSubmission.title}`}
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            )}

            {/* Judge Notes Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
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
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note for other judges to see..."
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

                      <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
                        {note.content}
                      </p>

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
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                {reply.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Form */}
                      {replyingTo === note._id && (
                        <div className="ml-6 mt-3 border-l-2 border-blue-200 pl-4">
                          <Textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
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
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">
                Scoring Criteria
              </h3>

              {/* Show completion notice if completed by another judge */}
              {submissionStatus &&
                submissionStatus.status === "completed" &&
                submissionStatus.assignedJudgeName &&
                judgeSession &&
                submissionStatus.assignedJudgeName !== judgeSession.name && (
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h4 className="font-medium text-gray-900">
                        Submission Completed
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      This submission has been completed by{" "}
                      <strong>{submissionStatus.assignedJudgeName}</strong>. The
                      scoring criteria are disabled.
                    </p>
                  </div>
                )}

              <div
                className={`space-y-6 ${
                  submissionStatus &&
                  submissionStatus.status === "completed" &&
                  submissionStatus.assignedJudgeName &&
                  judgeSession &&
                  submissionStatus.assignedJudgeName !== judgeSession.name
                    ? "opacity-50 pointer-events-none"
                    : ""
                }`}
              >
                {criteria.map((criterion) => {
                  const currentScore = scores[criterion._id]?.score;
                  const isComplete = !!currentScore;

                  return (
                    <div key={criterion._id} className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {criterion.question}
                            </h4>
                            {isComplete && (
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

                      {renderStarRating(criterion._id, currentScore)}

                      <div>
                        <Label
                          htmlFor={`comments-${criterion._id}`}
                          className="text-sm"
                        >
                          Comments (Optional)
                        </Label>
                        <Textarea
                          id={`comments-${criterion._id}`}
                          value={scores[criterion._id]?.comments || ""}
                          onChange={(e) => {
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
                            // Save to backend when user finishes typing (on blur)
                            const currentScore = scores[criterion._id]?.score;
                            const currentComments =
                              scores[criterion._id]?.comments;
                            if (currentScore && currentComments !== undefined) {
                              handleScoreChange(
                                criterion._id,
                                currentScore,
                                currentComments,
                              );
                            }
                          }}
                          placeholder="Add your thoughts about this criteria..."
                          className="text-sm"
                          rows={2}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
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
                    {Math.round(judgeProgress?.completionPercentage || 0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${judgeProgress?.completionPercentage || 0}%`,
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
  );
}
