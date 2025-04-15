import React from "react";
import { Link } from "react-router-dom";
import { ChevronUp, MessageSquare, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation } from "convex/react"; // Import Convex hooks
import { api } from "../../convex/_generated/api"; // Import Convex API
import type { Story, Comment as CommentType } from "../types";
import { Comment } from "./Comment";
import { CommentForm } from "./CommentForm";
import { Id, Doc } from "../../convex/_generated/dataModel"; // Import Id and Doc

// Removed MOCK_COMMENTS

interface StoryDetailProps {
  story: Story; // Expecting story with resolved tags and screenshotUrl
}

export function StoryDetail({ story }: StoryDetailProps) {
  // Fetch APPROVED comments using Convex query
  const comments = useQuery(api.comments.listApprovedByStory, { storyId: story._id });

  const [replyToId, setReplyToId] = React.useState<Id<"comments"> | null>(null);

  // Rating state - keep local state for UI feedback, but rely on Convex for source of truth
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);
  // TODO: Check if user has already rated (needs auth)
  const hasRated = false; // Placeholder

  // Convex mutations
  const voteStory = useMutation(api.stories.vote);
  const rateStory = useMutation(api.stories.rate);
  const addComment = useMutation(api.comments.add);

  const handleVote = () => {
    voteStory({ storyId: story._id });
    // TODO: Add optimistic update or visual feedback
  };

  const handleRating = (value: number) => {
    if (!hasRated) {
      rateStory({ storyId: story._id, rating: value });
      // TODO: Set local state hasRated based on auth/user status later
      // Maybe provide immediate visual feedback before confirmation
    }
  };

  const handleCommentSubmit = (content: string, author: string) => {
    // TODO: Replace hardcoded author with authenticated user
    addComment({
      storyId: story._id,
      content,
      author: author || "Anonymous", // Use provided author or default
      parentId: replyToId || undefined,
    });
    setReplyToId(null); // Close reply form
  };

  const averageRating = story.ratingCount > 0 ? story.ratingSum / story.ratingCount : 0;
  const currentRatingDisplay = averageRating; // Display average for now

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-[#787672] hover:text-[#525252] inline-block mb-6">
        ← Back to Apps
      </Link>

      <article className="bg-white rounded-lg p-4 border border-[#D5D3D0]">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 pt-1 min-w-[40px]">
            <button onClick={handleVote} className="text-[#2A2825] hover:bg-[#F4F0ED] p-1 rounded">
              <ChevronUp className="w-5 h-5" />
            </button>
            <span className="text-[#525252] font-medium text-sm">{story.votes}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-medium text-[#525252] mb-2">
              <a
                href={story.url}
                className="hover:text-[#2A2825] break-words"
                target="_blank"
                rel="noopener noreferrer">
                {story.title}
              </a>
            </h1>
            {story.screenshotUrl && (
              <div className="mb-4 rounded-md overflow-hidden border border-[#F4F0ED]">
                <img
                  src={story.screenshotUrl}
                  alt={`${story.title} screenshot`}
                  className="w-full max-h-[50vh] object-contain bg-gray-100"
                  loading="lazy"
                />
              </div>
            )}
            <p className="text-[#525252] mb-4 prose prose-sm max-w-none">{story.description}</p>
            <div className="flex items-center gap-4 text-sm text-[#787672] flex-wrap">
              <span>by {story.name}</span>
              <span>{formatDistanceToNow(story._creationTime)} ago</span>
              <Link to="#comments" className="flex items-center gap-1 hover:text-[#525252]">
                <MessageSquare className="w-4 h-4" />
                {comments?.length ?? 0} Comments
              </Link>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {(story.tags || []).map((tag: Doc<"tags">) => (
                <Link
                  key={tag._id}
                  to={`/?tag=${tag._id}`}
                  className="text-xs text-[#787672] bg-[#F4F0ED] px-2 py-1 rounded hover:bg-[#e5e1de] hover:text-[#525252] transition-colors">
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* Rating Section */}
      <div className="mt-8 bg-white rounded-lg p-6 border border-[#D5D3D0]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <h2 className="text-lg font-medium text-[#525252]">Rate this app</h2>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                disabled={hasRated} // TODO: Base on actual user rating status
                className={`p-1 transition-colors disabled:cursor-not-allowed ${
                  hasRated
                    ? value <= Math.round(averageRating) // Show rounded average rating if already rated
                      ? "text-yellow-400"
                      : "text-[#D5D3D0]"
                    : value <= (hoveredRating || 0) // Show hover state
                      ? "text-yellow-400"
                      : "text-[#D5D3D0] hover:text-yellow-400"
                }`}>
                <Star className="w-5 h-5 fill-current" />
              </button>
            ))}
          </div>
          {story.ratingCount > 0 && (
            <span className="text-sm text-[#787672]">
              {averageRating.toFixed(1)} stars ({story.ratingCount}
              {story.ratingCount === 1 ? " rating" : " ratings"})
            </span>
          )}
        </div>
        <p className="text-sm text-[#787672]">Your rating helps others discover great apps.</p>
      </div>

      {/* Comments Section */}
      <div id="comments" className="mt-8 scroll-mt-20">
        <h2 className="text-xl font-medium text-[#525252] mb-4">
          {comments?.length ?? 0} {(comments?.length ?? 0) === 1 ? "Comment" : "Comments"}
        </h2>
        <CommentForm onSubmit={handleCommentSubmit} />
        <div className="mt-8 space-y-6 border-t border-[#F4F0ED] pt-6">
          {comments === undefined && <div>Loading comments...</div>}
          {comments?.map((comment: CommentType) => (
            <React.Fragment key={comment._id}>
              <Comment comment={comment} onReply={(parentId) => setReplyToId(parentId)} />
              {replyToId === comment._id && (
                <div className="pl-8 pt-4">
                  <CommentForm onSubmit={handleCommentSubmit} parentId={comment._id} />
                </div>
              )}
            </React.Fragment>
          ))}
          {comments && comments.length === 0 && (
            <div className="text-[#787672]">No comments yet. Be the first!</div>
          )}
        </div>
      </div>
    </div>
  );
}
