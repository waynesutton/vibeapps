import React from "react";
import { Link } from "react-router-dom";
import {
  ChevronUp,
  MessageSquare,
  ArrowDown,
  Github,
  Pin,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Story } from "../types";
import { UsePaginatedQueryResult, useMutation, useQuery } from "convex/react";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@clerk/clerk-react";
import { AuthRequiredDialog } from "./ui/AuthRequiredDialog";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { useDialog } from "../hooks/useDialog";

interface StoryListProps {
  stories: Story[];
  viewMode: "list" | "grid" | "vibe";
  status: UsePaginatedQueryResult<any>["status"];
  loadMore: UsePaginatedQueryResult<any>["loadMore"];
  itemsPerPage: number;
}

const BookmarkButton = ({
  storyId,
  onAuthRequired,
  showMessage,
}: {
  storyId: Id<"stories">;
  onAuthRequired: () => void;
  showMessage: (
    title: string,
    message: string,
    variant: "info" | "success" | "warning" | "error",
  ) => void;
}) => {
  const { isSignedIn } = useAuth();
  const isBookmarked = useQuery(
    api.bookmarks.isStoryBookmarked,
    isSignedIn ? { storyId } : "skip",
  );
  const addOrRemoveBookmarkMutation = useMutation(
    api.bookmarks.addOrRemoveBookmark,
  );

  const handleBookmarkClick = async () => {
    if (!isSignedIn) {
      onAuthRequired();
      return;
    }
    try {
      await addOrRemoveBookmarkMutation({ storyId });
    } catch (error) {
      console.error("Failed to update bookmark:", error);
      showMessage(
        "Bookmark Error",
        "Failed to update bookmark. Please try again.",
        "error",
      );
    }
  };

  if (!isSignedIn) {
    return (
      <button
        className="flex items-center gap-2 text-faint hover:text-copy cursor-not-allowed"
        title="Sign in to bookmark"
      >
        <Bookmark className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleBookmarkClick}
      className="flex items-center gap-2 text-faint hover:text-copy"
      title={isBookmarked ? "Remove bookmark" : "Bookmark story"}
    >
      {isBookmarked ? (
        <BookmarkCheck className="w-4 h-4 text-ink" />
      ) : (
        <Bookmark className="w-4 h-4" />
      )}
    </button>
  );
};

// Filters out hidden/legacy tags, then renders themed tag pills.
// DB-set tag colors are respected; fallbacks adapt to the current theme.
const visibleTags = (tags: Array<Doc<"tags">>) =>
  tags.filter(
    (tag) =>
      !tag.isHidden &&
      !tag.hideInStoryList &&
      tag.name !== "resendhackathon" &&
      tag.name !== "ychackathon",
  );

const TagPills = ({
  tags,
  size = "sm",
}: {
  tags: Array<Doc<"tags">>;
  size?: "sm" | "md";
}) => (
  <>
    {visibleTags(tags).map((tag) => (
      <Link
        key={tag._id}
        to={`/tag/${tag.slug}`}
        className={`inline-flex items-center ${
          size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
        } rounded font-medium transition-colors hover:opacity-80`}
        style={{
          backgroundColor: tag.backgroundColor || "var(--th-surface-alt)",
          color: tag.textColor || "var(--th-copy)",
          border: `1px solid ${
            tag.borderColor ||
            (tag.backgroundColor ? "transparent" : "var(--th-hairline-strong)")
          }`,
        }}
        title={`View all apps tagged with ${tag.name}`}
      >
        {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
        {tag.iconUrl && !tag.emoji && (
          <img
            src={tag.iconUrl}
            alt=""
            className={`${size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} mr-1 rounded-sm object-cover`}
          />
        )}
        {tag.name}
      </Link>
    ))}
  </>
);

export function StoryList({
  stories,
  viewMode,
  status,
  loadMore,
  itemsPerPage,
}: StoryListProps) {
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();
  const voteStory = useMutation(api.stories.voteStory);
  const { showMessage, DialogComponents } = useDialog();

  // Auth required dialog state
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [authDialogAction, setAuthDialogAction] = React.useState("");

  const handleVote = (storyId: Id<"stories">) => {
    if (!isClerkLoaded) return;

    if (!isSignedIn) {
      setAuthDialogAction("vote");
      setShowAuthDialog(true);
      return;
    }

    voteStory({ storyId });
  };

  const formatDate = (creationTime: number) => {
    try {
      return formatDistanceToNow(creationTime) + " ago";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date not available";
    }
  };

  // Shared byline + comments + bookmark + repo meta row
  const MetaRow = ({
    story,
    className = "",
    size = "sm",
  }: {
    story: Story;
    className?: string;
    size?: "sm" | "md";
  }) => (
    <div
      className={`flex items-center gap-x-2.5 gap-y-1 ${size === "sm" ? "text-xs" : "text-sm"} text-soft flex-wrap ${className}`}
    >
      {story.authorUsername ? (
        <ProfileHoverCard username={story.authorUsername}>
          <Link
            to={`/${story.authorUsername}`}
            className="hover:text-copy hover:underline"
          >
            by {story.submitterName || story.authorName || story.authorUsername}
          </Link>
        </ProfileHoverCard>
      ) : (
        <span>
          by {story.submitterName || story.authorName || "Anonymous User"}
        </span>
      )}
      <span aria-hidden="true" className="text-faint">
        &middot;
      </span>
      <span>{formatDate(story._creationTime)}</span>
      <span aria-hidden="true" className="text-faint">
        &middot;
      </span>
      <Link
        to={`/s/${story.slug}#comments`}
        className="flex items-center gap-1 hover:text-copy"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        {story.commentCount}
      </Link>
      <BookmarkButton
        storyId={story._id}
        showMessage={showMessage}
        onAuthRequired={() => {
          setAuthDialogAction("bookmark");
          setShowAuthDialog(true);
        }}
      />
      {story.githubUrl && (
        <a
          href={story.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-soft hover:text-copy"
          title="View GitHub Repo"
        >
          <Github className="w-3.5 h-3.5" />
          <span>Repo</span>
        </a>
      )}
    </div>
  );

  // LIST VIEW: ranked rows (number, app thumbnail, copy, upvote box on the right)
  const renderListRow = (story: Story, index: number) => (
    <article
      key={story._id}
      className="group flex items-start gap-3 sm:gap-4 py-4 first:pt-1"
    >
      {/* Rank */}
      <span className="w-6 pt-2 text-right text-sm text-faint tabular-nums flex-shrink-0 select-none">
        {index + 1}
      </span>

      {/* App thumbnail (falls back to an initial block) */}
      <Link
        to={`/s/${story.slug}`}
        className="flex-shrink-0 mt-0.5"
        tabIndex={-1}
        aria-hidden="true"
      >
        {story.screenshotUrl ? (
          <img
            src={story.screenshotUrl}
            alt=""
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-hairline bg-surface-alt"
            loading="lazy"
          />
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-hairline bg-surface-alt flex items-center justify-center text-lg font-semibold text-soft">
            {story.title.charAt(0).toUpperCase()}
          </div>
        )}
      </Link>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        {story.customMessage && (
          <div className="mb-1.5 text-xs text-on-cta bg-cta border border-hairline rounded-md px-2 py-1 italic inline-block">
            {story.customMessage}
          </div>
        )}
        <h2 className="text-[15px] leading-snug text-ink font-semibold flex items-center gap-1.5 min-w-0">
          {story.isPinned && (
            <Pin
              className="w-3.5 h-3.5 text-faint flex-shrink-0"
              aria-label="Pinned Story"
            />
          )}
          <Link
            to={`/s/${story.slug}`}
            className="truncate hover:underline underline-offset-2"
          >
            {story.title}
          </Link>
        </h2>
        {story.description && (
          <p className="text-[13px] leading-[19px] text-copy line-clamp-2 mt-0.5">
            {story.description}
          </p>
        )}
        <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap mt-1.5">
          {story.tags && story.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <TagPills tags={story.tags} size="sm" />
            </div>
          )}
        </div>
        <MetaRow story={story} className="mt-1.5" />
      </div>

      {/* Upvote box */}
      <button
        onClick={() => handleVote(story._id)}
        className="flex-shrink-0 flex flex-col items-center justify-center w-11 min-h-[52px] rounded-lg border border-hairline bg-surface text-ink hover:border-hairline-strong hover:bg-surface-hover transition-colors"
        title="Vibe it"
        aria-label={`Upvote ${story.title}`}
      >
        <ChevronUp className="w-4 h-4" />
        <span className="text-sm font-semibold tabular-nums leading-none mt-0.5">
          {story.votes}
        </span>
      </button>
    </article>
  );

  // VIBE VIEW: modern card row (vibes block + thumbnail + copy)
  const renderVibeRow = (story: Story) => (
    <article
      key={story._id}
      className="flex flex-col md:flex-row items-stretch gap-4 bg-surface rounded-xl border border-hairline p-4"
    >
      {/* Vibes block */}
      <div className="flex md:flex-col items-center md:items-stretch gap-0 w-full md:w-[76px] flex-shrink-0 order-2 md:order-1">
        <div className="bg-brand-soft rounded-l-lg md:rounded-l-none md:rounded-t-lg flex-1 md:flex-none md:h-[64px] flex flex-col items-center justify-center border border-hairline py-1.5">
          <span className="font-alfa-slab-one text-lg text-ink leading-none">
            {story.votes}
          </span>
          <span className="text-[11px] text-copy mt-0.5">Vibes</span>
        </div>
        <button
          onClick={() => handleVote(story._id)}
          className="bg-surface border border-l-0 md:border-l md:border-t-0 border-hairline text-ink hover:bg-brand-soft rounded-r-lg md:rounded-r-none md:rounded-b-lg py-1.5 px-3 md:px-2 flex items-center justify-center gap-1 text-sm font-medium transition-colors"
        >
          Vibe it
        </button>
      </div>

      {/* Thumbnail */}
      {story.screenshotUrl && (
        <Link
          to={`/s/${story.slug}`}
          className="w-full md:w-[195px] md:flex-shrink-0 aspect-video block overflow-hidden rounded-lg border border-hairline order-1 md:order-2"
        >
          <img
            src={story.screenshotUrl}
            alt={`${story.title} thumbnail`}
            className="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.02]"
            loading="lazy"
          />
        </Link>
      )}

      {/* Copy */}
      <div className="flex-1 min-w-0 order-3">
        {story.customMessage && (
          <div className="mb-2 text-xs text-on-cta bg-cta border border-hairline rounded-md px-2 py-1 italic inline-block">
            {story.customMessage}
          </div>
        )}
        <h2 className="text-[15px] leading-snug text-ink font-semibold flex items-center gap-1.5 min-w-0 mb-1">
          {story.isPinned && (
            <Pin
              className="w-3.5 h-3.5 text-faint flex-shrink-0"
              aria-label="Pinned Story"
            />
          )}
          <Link
            to={`/s/${story.slug}`}
            className="truncate hover:underline underline-offset-2"
          >
            {story.title}
          </Link>
        </h2>
        <p className="text-[13px] leading-[19px] text-copy mb-2 line-clamp-2">
          {story.description}
        </p>
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            <TagPills tags={story.tags} size="sm" />
          </div>
        )}
        <MetaRow story={story} />
      </div>
    </article>
  );

  // GRID VIEW: unchanged layout
  const renderGridCard = (story: Story) => (
    <article
      key={story._id}
      className="flex flex-col bg-surface rounded-lg p-4 border border-hairline gap-4"
    >
      <div className="flex-1 min-w-0">
        {story.customMessage && (
          <div className="mb-2 text-xs text-on-cta bg-cta border border-hairline rounded-md p-2 italic">
            {story.customMessage}
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          {story.isPinned && (
            <Pin
              className="w-3.5 h-3.5 text-faint flex-shrink-0"
              aria-label="Pinned Story"
            />
          )}
          <button
            onClick={() => handleVote(story._id)}
            className="text-ink hover:bg-brand-soft p-1 rounded"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <span className="text-ink font-medium text-sm">{story.votes}</span>
          <h2 className="text-base text-ink font-bold truncate">
            <Link to={`/s/${story.slug}`} className="hover:text-ink break-words">
              {story.title}
            </Link>
          </h2>
        </div>
        {story.screenshotUrl && (
          <Link
            to={`/s/${story.slug}`}
            className="block mb-4 rounded-md overflow-hidden hover:opacity-90 transition-opacity"
          >
            <img
              src={story.screenshotUrl}
              alt={story.title}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
          </Link>
        )}
        <p className="text-ink text-[14px] leading-[20px] mb-2 line-clamp-3">
          {story.description}
        </p>
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            <TagPills tags={story.tags} size="md" />
          </div>
        )}
        <MetaRow story={story} size="md" />
      </div>
    </article>
  );

  const containerClass =
    viewMode === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      : viewMode === "vibe"
        ? "flex flex-col space-y-4"
        : "flex flex-col divide-y divide-hairline";

  return (
    <>
      <DialogComponents />
      <div className="flex flex-col">
        <div className="w-full">
          <div className="space-y-8">
            <div className={containerClass}>
              {stories.map((story, index) =>
                viewMode === "grid"
                  ? renderGridCard(story)
                  : viewMode === "vibe"
                    ? renderVibeRow(story)
                    : renderListRow(story, index),
              )}
            </div>

            {(status === "CanLoadMore" || status === "LoadingMore") && (
              <div className="text-center mt-8">
                <button
                  onClick={() => loadMore(itemsPerPage)}
                  className="px-4 py-2 bg-surface-alt text-copy rounded-md hover:bg-surface-hover transition-colors flex items-center gap-2 mx-auto disabled:opacity-75 disabled:cursor-not-allowed"
                  disabled={status === "LoadingMore"}
                >
                  {status === "LoadingMore" ? (
                    <>
                      <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More
                      <ArrowDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
            {status === "Exhausted" && stories.length > 0 && (
              <div className="text-center mt-8 text-soft"></div>
            )}
          </div>
        </div>

        {/* Auth Required Dialog */}
        <AuthRequiredDialog
          isOpen={showAuthDialog}
          onClose={() => setShowAuthDialog(false)}
          action={authDialogAction}
        />
      </div>
    </>
  );
}
