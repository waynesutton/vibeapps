import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, MessageSquare, Star, Linkedin, Twitter, Github, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation } from "convex/react"; // Import Convex hooks
import { api } from "../../convex/_generated/api"; // Import Convex API
import type { Story, Comment as CommentType } from "../types";
import { Comment } from "./Comment";
import { CommentForm } from "./CommentForm";
import { Id, Doc } from "../../convex/_generated/dataModel"; // Import Id and Doc

// Removed MOCK_COMMENTS

interface StoryDetailProps {
  story: Story; // Expecting story with resolved tags (including colors and isHidden)
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
  const voteStory = useMutation(api.stories.voteStory);
  const rateStory = useMutation(api.stories.rate);
  const addComment = useMutation(api.comments.add);

  const handleVote = () => {
    // TODO: Add auth check & potentially disable after voting
    voteStory({ storyId: story._id });
  };

  const handleRating = (value: number) => {
    // TODO: Add auth check & prevent re-rating
    if (!hasRated) {
      rateStory({ storyId: story._id, rating: value });
    }
  };

  const handleCommentSubmit = (content: string, author: string) => {
    // TODO: Replace hardcoded author with authenticated user
    addComment({
      storyId: story._id,
      content,
      author: author || "Anonymous",
      parentId: replyToId || undefined,
    });
    setReplyToId(null);
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
  const currentRatingDisplay = averageRating; // Display average for now

  // Generate slug from title (simple example)
  const storySlug = story.title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
  const reportUrl = `https://github.com/waynesutton/vibeapps/issues/new?q=is%3Aissue+state%3Aopen+Flagged&title=Flagged+Content%3A+${encodeURIComponent(story.title)}&body=Reporting+issue+for+story%3A+%0A-+Title%3A+${encodeURIComponent(story.title)}%0A-+Slug%3A+${storySlug}%0A-+URL%3A+${encodeURIComponent(story.url)}%0A-+Reason%3A+`;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-[#787672] hover:text-[#525252] inline-block mb-6 text-sm">
        ← Back to Apps
      </Link>

      <article className="bg-white rounded-lg p-4 sm:p-6 border border-[#D5D3D0]">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 pt-1 min-w-[40px]">
            <button
              onClick={handleVote}
              className="text-[#2A2825] hover:bg-[#F4F0ED] p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              // TODO: Add disabled logic based on auth/vote status
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <span className="text-[#525252] font-medium text-sm">{story.votes}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-medium text-[#525252] mb-2">
              <a
                href={story.url}
                className="hover:text-[#2A2825] break-words"
                target="_blank"
                rel="noopener noreferrer">
                {story.title}
              </a>
            </h1>
            {story.customMessage && (
              <div className="mb-4 text-sm text-[#787671] bg-[#F3F0ED] border border-[#D5D3D0] rounded-md p-3 italic">
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
            <p className="text-[#525252] mb-4 prose prose-sm max-w-none">{story.description}</p>
            <div className="flex items-center gap-4 text-sm text-[#787672] flex-wrap mb-3">
              <span>by {story.name}</span>
              <span>{formatDistanceToNow(story._creationTime)} ago</span>
              <Link to="#comments" className="flex items-center gap-1 hover:text-[#525252]">
                <MessageSquare className="w-4 h-4" />
                {comments?.length ?? 0} Comments
              </Link>
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
                    ? value <= Math.round(averageRating) // Show rounded average if already rated
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

      {/* Project Links & Tags Section */}
      {(story.linkedinUrl ||
        story.twitterUrl ||
        story.githubUrl ||
        story.chefShowUrl ||
        story.chefAppUrl ||
        story.tags?.length > 0) && (
        <div className="mt-8 bg-white rounded-lg p-6 border border-[#D5D3D0]">
          <h2 className="text-lg font-medium text-[#525252] mb-4">Project Links & Tags</h2>
          <div className="space-y-3">
            {story.githubUrl && (
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-[#787672] flex-shrink-0" />
                <a
                  href={story.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#2A2825] hover:underline truncate"
                  title={story.githubUrl}>
                  GitHub Repo
                </a>
              </div>
            )}
            {story.linkedinUrl && (
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-[#787672] flex-shrink-0" />
                <a
                  href={story.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#2A2825] hover:underline truncate"
                  title={story.linkedinUrl}>
                  LinkedIn URL
                </a>
              </div>
            )}
            {story.twitterUrl && (
              <div className="flex items-center gap-2">
                <Twitter className="w-4 h-4 text-[#787672] flex-shrink-0" />
                <a
                  href={story.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#2A2825] hover:underline truncate"
                  title={story.twitterUrl}>
                  X/Bluesky URL
                </a>
              </div>
            )}
            {story.chefAppUrl && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-[#787672] flex-shrink-0">🍲</span>
                <a
                  href={story.chefAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#2A2825] hover:underline truncate"
                  title={story.chefAppUrl}>
                  Convex.app Project
                </a>
              </div>
            )}
            {story.chefShowUrl && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-[#787672] flex-shrink-0">🍳</span>
                <a
                  href={story.chefShowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#525252] hover:text-[#2A2825] hover:underline truncate"
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
            <div className="text-[#787672]">No comments yet. Be the first!</div>
          )}
        </div>
      </div>

      {/* Flag/Report Section */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3 text-sm text-gray-600">
        <Flag className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <button className="font-medium text-gray-700 hover:text-gray-900">Flag/Report</button>
        <span>-</span>
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline hover:text-blue-800">
          Report / Moderate Content
        </a>
      </div>
    </div>
  );
}
