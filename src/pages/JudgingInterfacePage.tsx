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
          </div>

          {/* Scoring Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">
                Scoring Criteria
              </h3>
              <div className="space-y-6">
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
