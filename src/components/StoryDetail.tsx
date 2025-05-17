import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronUp,
  MessageSquare,
  Star,
  Linkedin,
  Twitter,
  Github,
  Flag,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation } from "convex/react"; // Import Convex hooks
import { api } from "../../convex/_generated/api"; // Import Convex API
import type { Story, Comment as CommentType } from "../types";
import { Comment } from "./Comment";
import { CommentForm } from "./CommentForm";
import { Id, Doc } from "../../convex/_generated/dataModel"; // Import Id and Doc
import { useAuth, useUser } from "@clerk/clerk-react"; // Added useAuth, useUser
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"; // Assuming you have a Dialog component
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button"; // For modal buttons
import { toast } from "sonner";

// Removed MOCK_COMMENTS

interface StoryDetailProps {
  story: Story; // Expecting story with resolved tags (including colors and isHidden)
}

// Copied and adapted BookmarkButton from StoryList.tsx
const BookmarkButton = ({ storyId }: { storyId: Id<"stories"> }) => {
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth(); // Ensure useAuth is available
  const isBookmarked = useQuery(api.bookmarks.isStoryBookmarked, isSignedIn ? { storyId } : "skip");
  const addOrRemoveBookmarkMutation = useMutation(api.bookmarks.addOrRemoveBookmark);

  const handleBookmarkClick = async () => {
    if (!isClerkLoaded) return;
    if (!isSignedIn) {
      // Instead of alert, navigate or show a toast
      // navigate("/sign-in"); // Assuming navigate is available in this scope or passed as prop
      toast.error("Please sign in to bookmark stories.");
      return;
    }
    try {
      await addOrRemoveBookmarkMutation({ storyId });
      // Optionally, show a success toast
      // toast.success(isBookmarked ? "Bookmark removed" : "Story bookmarked!");
    } catch (error) {
      console.error("Failed to update bookmark:", error);
      toast.error("Failed to update bookmark. Please try again.");
    }
  };

  if (!isClerkLoaded) {
    // Show a loading state or disabled button
    return (
      <button
        className="flex items-center gap-1 text-[#787672] opacity-50 cursor-not-allowed"
        disabled
        title="Loading...">
        <Bookmark className="w-4 h-4" />
      </button>
    );
  }

  if (!isSignedIn) {
    return (
      <button
        className="flex items-center gap-1 text-[#787672] hover:text-[#525252]"
        onClick={() => {
          // Assuming navigate is available and you want to redirect
          // navigate("/sign-in");
          // Or, if toast is preferred for non-navigation action:
          toast.info("Please sign in to bookmark stories.");
        }}
        title="Sign in to bookmark">
        <Bookmark className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleBookmarkClick}
      className="flex items-center gap-1 text-[#787672] hover:text-[#525252]"
      title={isBookmarked ? "Remove bookmark" : "Bookmark story"}>
      {isBookmarked ? (
        <BookmarkCheck className="w-4 h-4 text-black" />
      ) : (
        <Bookmark className="w-4 h-4" />
      )}
    </button>
  );
};

export function StoryDetail({ story }: StoryDetailProps) {
  const navigate = useNavigate(); // Initialize navigate
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth(); // Get auth state

  // Fetch APPROVED comments using Convex query
  const comments = useQuery(api.comments.listApprovedByStory, { storyId: story._id });
  const currentUserRating = useQuery(
    api.stories.getUserRatingForStory,
    isSignedIn ? { storyId: story._id } : "skip" // Only run if signed in
  );

  const [replyToId, setReplyToId] = React.useState<Id<"comments"> | null>(null);

  // Rating state - keep local state for UI feedback, but rely on Convex for source of truth
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);

  const hasRated = currentUserRating !== null && currentUserRating !== undefined;

  // Convex mutations
  const voteStory = useMutation(api.stories.voteStory);
  const rateStory = useMutation(api.stories.rate);
  const addComment = useMutation(api.comments.add);
  const createReportMutation = useMutation(api.reports.createReport);

  const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState("");
  const [isReporting, setIsReporting] = React.useState(false);
  const [reportModalError, setReportModalError] = React.useState<string | null>(null);

  const handleVote = () => {
    if (!isClerkLoaded) return; // Don't do anything if Clerk hasn't loaded

    if (!isSignedIn) {
      navigate("/sign-in"); // Redirect to sign-in if not logged in
      return;
    }
    voteStory({ storyId: story._id })
      .then((result) => {
        console.log("Vote successful:", result);
        // Optionally, update UI based on result.action and result.newVoteCount
      })
      .catch((error) => {
        console.error("Error voting:", error);
        // Handle error, e.g., show a notification to the user
      });
  };

  const handleRating = (value: number) => {
    if (!isClerkLoaded) return;

    if (!isSignedIn) {
      navigate("/sign-in");
      return;
    }
    if (hasRated) {
      // User has already rated, prevent re-rating (or allow update if implemented)
      alert("You have already rated this app.");
      return;
    }
    rateStory({ storyId: story._id, rating: value })
      .then((result) => {
        console.log("Rating success:", result);
        // Optimistically update UI or refetch currentUserRating might be needed here
        // For now, a simple alert.
      })
      .catch((error) => {
        console.error("Error rating:", error);
        alert(`Error rating: ${error.data?.message || error.message}`);
      });
  };

  const handleCommentSubmit = (content: string) => {
    if (!isClerkLoaded) return;
    if (!isSignedIn) {
      navigate("/sign-in");
      return;
    }
    addComment({
      storyId: story._id,
      content,
      parentId: replyToId || undefined,
    });
    setReplyToId(null);
  };

  const handleOpenReportModal = () => {
    setReportModalError(null);
    setReportReason("");
    setIsReportModalOpen(true);
  };

  const handleReportModalOpenChange = (open: boolean): void => {
    setIsReportModalOpen(open);
    if (!open) {
      setReportModalError(null);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason.trim()) {
      setReportModalError("Please provide a reason for reporting.");
      return;
    }
    if (!story?._id) {
      setReportModalError("Story ID is missing, cannot submit report.");
      return;
    }

    setIsReporting(true);
    setReportModalError(null);
    try {
      await createReportMutation({ storyId: story._id, reason: reportReason });
      toast.success("Story reported successfully. An admin will review it.");
      setIsReportModalOpen(false);
      setReportReason("");
    } catch (error: any) {
      console.error("Error reporting story:", error); // Keep full log for debugging

      // Attempt to extract the most user-friendly message from the Convex error
      let userFriendlyMessage = "You have already reported this story, and it is pending review."; // Default fallback
      if (error.data) {
        if (typeof error.data === "string") {
          userFriendlyMessage = error.data; // If error.data is the string itself
        } else if (error.data.message && typeof error.data.message === "string") {
          userFriendlyMessage = error.data.message; // Standard Convex error message path
        } else if (
          error.message &&
          typeof error.message === "string" &&
          error.message.includes("Uncaught Error:")
        ) {
          // Fallback to parsing the longer error.message if a specific known phrase is present
          // This is more brittle but can catch the desired message if not in error.data.message
          const match = error.message.match(/Uncaught Error: (.*?) at handler/);
          if (match && match[1]) {
            userFriendlyMessage = match[1];
          }
        }
      }
      setReportModalError(userFriendlyMessage);
    }
    setIsReporting(false);
  };

  // Update document title and meta description
  useEffect(() => {
    document.title = `${story.title} | Vibe Coding`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", story.description);
    } else {
      // Create meta tag if it doesn't exist
      const newMeta = document.createElement("meta");
      newMeta.name = "description";
      newMeta.content = story.description;
      document.head.appendChild(newMeta);
    }
  }, [story.title, story.description]);

  const averageRating = story.ratingCount > 0 ? story.ratingSum / story.ratingCount : 0;
  // Display user's own rating if they have rated, otherwise the average or hover state
  const displayRatingForStars = hasRated ? currentUserRating : hoveredRating;

  // Generate slug from title (simple example)
  const storySlug = story.title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
  // The direct GitHub link is removed as per new requirement for modal
  // const reportUrl = `https://github.com/waynesutton/vibeapps/issues/new?q=is%3Aissue+state%3Aopen+Flagged&labels=flagged&title=Flagged+Content%3A+${encodeURIComponent(story.title)}&body=Reporting+issue+for+story%3A+%0A-+Title%3A+${encodeURIComponent(story.title)}%0A-+Slug%3A+${storySlug}%0A-+URL%3A+${encodeURIComponent(story.url)}%0A-+Reason%3A+`;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-[#545454] hover:text-[#525252] inline-block mb-6 text-sm">
        ← Back to Apps
      </Link>

      <article className="bg-white rounded-lg p-4 sm:p-6 border border-[#D8E1EC]">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 pt-1 min-w-[40px]">
            <button
              onClick={handleVote}
              disabled={!isClerkLoaded} // Disable while Clerk is loading to prevent premature clicks
              className={`text-[#292929] hover:bg-[#F4F0ED] p-1 rounded ${
                !isSignedIn && isClerkLoaded ? "opacity-50 cursor-help" : ""
              }`}
              title={!isSignedIn && isClerkLoaded ? "Sign in to vote" : "Vote for this app"}>
              <ChevronUp className="w-5 h-5" />
            </button>
            <span className="text-[#525252] font-medium text-sm">{story.votes}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold  text-transform: capitalize text-[#000000] mb-2">
              <a
                href={story.url}
                className="hover:text-[#555555] break-words"
                target="_blank"
                rel="noopener noreferrer">
                {story.title}
              </a>
            </h1>
            {story.customMessage && (
              <div className="mb-4 text-sm text-[#ffffff] bg-[#292929] border border-[#D8E1EC] rounded-md p-3 italic">
                {story.customMessage}
              </div>
            )}
            {story.screenshotUrl && (
              <div className="mb-4 rounded-md overflow-hidden border border-[#F4F0ED]">
                <img
                  src={story.screenshotUrl}
                  alt={`${story.title} screenshot`}
                  className="w-full max-h-[60vh] object-contain bg-gray-100"
                  loading="lazy"
                />
              </div>
            )}
            <p className="text-[#000000] mb-4 mt-[20px] prose prose-base max-w-none">
              {story.description}
            </p>
            <div className="flex items-center gap-2 text-sm text-[#545454] flex-wrap mb-3">
              {story.authorUsername ? (
                <Link
                  to={`/${story.authorUsername}`}
                  className="hover:text-[#525252] hover:underline">
                  by {story.authorName || story.authorUsername}
                </Link>
              ) : (
                <span>by {story.authorName || "Anonymous User"}</span>
              )}
              <span>{formatDistanceToNow(story._creationTime)} ago</span>
              <Link to="#comments" className="flex items-center gap-1 hover:text-[#525252]">
                <MessageSquare className="w-4 h-4" />
                {comments?.length ?? 0} Comments
              </Link>
              <BookmarkButton storyId={story._id} />
            </div>
          </div>
        </div>
      </article>

      {/* Rating Section */}
      <div className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <h2 className="text-lg font-medium text-[#525252]">
            {hasRated ? "Your Rating" : "Rate this app"}
          </h2>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                onMouseEnter={() => !hasRated && setHoveredRating(value)} // Only hover if not rated
                onMouseLeave={() => setHoveredRating(0)}
                disabled={!isClerkLoaded || (isSignedIn && hasRated)} // Disable if not loaded, or if signed in AND already rated
                className={`p-1 transition-colors disabled:cursor-not-allowed ${
                  !isSignedIn && isClerkLoaded ? "opacity-50 cursor-help" : ""
                } ${
                  hasRated
                    ? value <= (currentUserRating || 0)
                      ? "text-yellow-500"
                      : "text-gray-300"
                    : value <= (hoveredRating || 0)
                      ? "text-yellow-400"
                      : "text-gray-300 hover:text-yellow-400"
                }`}
                title={
                  !isSignedIn && isClerkLoaded
                    ? "Sign in to rate"
                    : hasRated
                      ? `You rated ${currentUserRating} star(s)`
                      : `Rate ${value} stars`
                }>
                <Star className="w-5 h-5 fill-current" />
              </button>
            ))}
          </div>
          {story.ratingCount > 0 && (
            <span className="text-sm text-[#545454]">
              {averageRating.toFixed(1)} stars ({story.ratingCount}
              {story.ratingCount === 1 ? " rating" : " ratings"})
            </span>
          )}
        </div>
        <p className="text-sm text-[#545454]">Your rating helps others discover great apps.</p>
      </div>

      {/* Project Links & Tags Section */}
      {(story.linkedinUrl ||
        story.twitterUrl ||
        story.githubUrl ||
        story.chefShowUrl ||
        story.chefAppUrl ||
        story.tags?.length > 0) && (
        <div className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC]">
          <h2 className="text-lg font-medium text-[#525252] mb-4">Project Links & Tags</h2>
          <div className="space-y-3">
            {story.githubUrl && (
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-[#545454] flex-shrink-0" />
                <a
                  href={story.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                  title={story.githubUrl}>
                  GitHub Repo
                </a>
              </div>
            )}
            {story.linkedinUrl && (
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-[#545454] flex-shrink-0" />
                <a
                  href={story.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                  title={story.linkedinUrl}>
                  LinkedIn URL
                </a>
              </div>
            )}
            {story.twitterUrl && (
              <div className="flex items-center gap-2">
                <Twitter className="w-4 h-4 text-[#545454] flex-shrink-0" />
                <a
                  href={story.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                  title={story.twitterUrl}>
                  X/Bluesky URL
                </a>
              </div>
            )}
            {story.chefAppUrl && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-[#545454] flex-shrink-0">🍲</span>
                <a
                  href={story.chefAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                  title={story.chefAppUrl}>
                  Convex.app Project
                </a>
              </div>
            )}
            {story.chefShowUrl && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-[#545454] flex-shrink-0">🍳</span>
                <a
                  href={story.chefShowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                  title={story.chefShowUrl}>
                  Chef.show Project
                </a>
              </div>
            )}

            {/* Moved Tags Here */}
            {story.tags && story.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap pt-3 border-t border-[#F4F0ED] mt-3">
                {(story.tags || []).map(
                  (tag: Doc<"tags">) =>
                    !tag.isHidden && (
                      <Link
                        key={tag._id}
                        to={`/?tag=${tag._id}`}
                        className="px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                        style={{
                          backgroundColor: tag.backgroundColor || "#F4F0ED",
                          color: tag.textColor || "#525252",
                          border: tag.backgroundColor ? "none" : `1px solid #D5D3D0`,
                        }}>
                        {tag.name}
                      </Link>
                    )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div id="comments" className="mt-8 scroll-mt-20">
        <h2 className="text-xl font-medium text-[#525252] mb-4">
          {comments?.length ?? 0} {(comments?.length ?? 0) === 1 ? "Comment" : "Comments"}
        </h2>
        <CommentForm onSubmit={handleCommentSubmit} />
        <div className="mt-8 space-y-6 border-t border-[#F4F0ED] pt-6">
          {comments === undefined && <div>Loading comments...</div>}
          {comments?.map((commentData) => {
            // Rename variable to avoid conflict
            // Ensure commentData conforms to CommentType, though validation should happen in backend
            const comment = commentData as CommentType;
            return (
              <React.Fragment key={comment._id}>
                <Comment comment={comment} onReply={(parentId) => setReplyToId(parentId)} />
                {replyToId === comment._id && (
                  <div className="pl-8 pt-4">
                    <CommentForm onSubmit={handleCommentSubmit} parentId={comment._id} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {comments && comments.length === 0 && (
            <div className="text-[#545454]">No comments yet. Be the first!</div>
          )}
        </div>
      </div>

      {/* Flag/Report Section */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-3">
          <Flag className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="font-medium text-gray-700">Seen something inappropriate?</span>
        </div>
        {isClerkLoaded && isSignedIn ? (
          <Button variant="outline" size="sm" className="text-xs" onClick={handleOpenReportModal}>
            Report this Submission
          </Button>
        ) : isClerkLoaded && !isSignedIn ? (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => navigate("/sign-in")}
            title="Sign in to report content">
            Sign in to Report
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-xs" disabled>
            Loading...
          </Button>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={handleReportModalOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Report: {story.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-gray-500">
              Please provide a reason for reporting this submission. Your report will be reviewed by
              an administrator.
            </p>
            <Textarea
              placeholder="Reason for reporting..."
              value={reportReason}
              onChange={(e) => {
                setReportReason(e.target.value);
                if (reportModalError && e.target.value.trim()) {
                  setReportModalError(null);
                }
              }}
              rows={4}
              disabled={isReporting}
            />
          </div>
          {reportModalError && (
            <div className="mb-3 p-2 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md">
              {reportModalError}
            </div>
          )}
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsReportModalOpen(false);
                setReportModalError(null);
              }}
              disabled={isReporting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReportSubmit}
              disabled={isReporting || !reportReason.trim()}
              className="bg-[#292929] text-white hover:bg-[#525252] disabled:opacity-50 sm:ml-[10px]"
              style={{ fontWeight: "normal" }}>
              {isReporting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
