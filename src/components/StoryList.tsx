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
  shape = "default",
}: {
  tags: Array<Doc<"tags">>;
  size?: "sm" | "md";
  shape?: "default" | "pill";
}) => (
  <>
    {visibleTags(tags).map((tag) => (
      <Link
        key={tag._id}
        to={`/tag/${tag.slug}`}
        className={`inline-flex items-center ${
          size === "sm"
            ? shape === "pill"
              ? "px-2 py-0.5 text-[12px]"
              : "px-1.5 py-0.5 text-[12px]"
            : "px-2 py-0.5 text-[13px]"
        } ${shape === "pill" ? "rounded-full" : "rounded"} font-medium transition-colors hover:opacity-80`}
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

  // Compact relative time for list scanning ("14h ago"), matching the mockup.
  const compactTimeAgo = (timestamp: number) => {
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45) return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.round(days / 365)}y ago`;
  };

  // Shared byline + comments + bookmark + repo meta row
  const MetaRow = ({
    story,
    className = "",
    size = "sm",
    compactTime = false,
    commentsClassName,
  }: {
    story: Story;
    className?: string;
    size?: "sm" | "md";
    compactTime?: boolean;
    commentsClassName?: string;
  }) => (
    <div
      className={`flex items-center gap-x-2.5 gap-y-1 ${size === "sm" ? "text-[13px]" : "text-sm"} text-soft flex-wrap ${className}`}
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
      <span>
        {compactTime
          ? compactTimeAgo(story._creationTime)
          : formatDate(story._creationTime)}
      </span>
      <span
        aria-hidden="true"
        className={`text-faint ${commentsClassName ?? ""}`}
      >
        &middot;
      </span>
      <Link
        to={`/s/${story.slug}#comments`}
        className={`flex items-center gap-1 hover:text-copy ${commentsClassName ?? ""}`}
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

  // LIST VIEW: ranked editorial row (rank, 16:9 shot, copy, Vibe it pill)
  const renderListRow = (story: Story, index: number) => {
    const leadTag = visibleTags(story.tags ?? []).slice(0, 1);

    return (
      <article
        key={story._id}
        className="group flex items-center gap-3 sm:gap-4 px-4 py-5 hover:bg-surface-hover transition-colors motion-reduce:transition-none"
      >
        {/* Two-digit rank. Sized under the 18px title so it stays a quiet index. */}
        <span className="w-7 sm:w-8 flex-shrink-0 text-right text-[15px] font-normal text-faint tabular-nums tracking-tight leading-none select-none">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* 16:9 screenshot. Aspect box reserved so missing images do not shift the row. */}
        <Link
          to={`/s/${story.slug}`}
          className="flex-shrink-0 w-20 sm:w-[8.5rem] aspect-video rounded-md overflow-hidden border border-hairline bg-surface-alt block"
          tabIndex={-1}
          aria-hidden="true"
        >
          {story.screenshotUrl ? (
            <img
              src={story.screenshotUrl}
              alt=""
              className="w-full h-full object-cover"
              loading={index < 3 ? "eager" : "lazy"}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-base sm:text-lg font-semibold text-soft">
              {story.title.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        {/* Copy: title + one tag, one-line description, byline */}
        <div className="flex-1 min-w-0">
          {story.customMessage && (
            <div className="mb-1.5 text-[13px] text-on-cta bg-cta border border-hairline rounded-md px-2 py-1 italic inline-block">
              {story.customMessage}
            </div>
          )}
          <div className="flex items-center gap-2 min-w-0">
            {story.isPinned && (
              <Pin
                className="w-4 h-4 text-faint flex-shrink-0"
                aria-label="Pinned Story"
              />
            )}
            <h2 className="app-title text-ink min-w-0 truncate">
              <Link
                to={`/s/${story.slug}`}
                className="hover:underline underline-offset-2"
              >
                {story.title}
              </Link>
            </h2>
            {leadTag.length > 0 && (
              <div className="hidden sm:flex flex-shrink-0">
                <TagPills tags={leadTag} size="sm" shape="pill" />
              </div>
            )}
          </div>
          {leadTag.length > 0 && (
            <div className="flex sm:hidden mt-1">
              <TagPills tags={leadTag} size="sm" shape="pill" />
            </div>
          )}
          {story.description && (
            <p className="app-desc text-copy line-clamp-1 mt-0.5">
              {story.description}
            </p>
          )}
          <MetaRow
            story={story}
            compactTime
            commentsClassName="sm:hidden"
            className="mt-1"
          />
        </div>

        {/* Comments + Vibe it pill. Comments sit here from sm up; mobile keeps them in the byline. */}
        <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3">
          <Link
            to={`/s/${story.slug}#comments`}
            className="hidden sm:inline-flex items-center justify-end min-w-[1.75rem] h-8 text-[13px] text-faint hover:text-copy tabular-nums"
            aria-label={`${story.commentCount} ${story.commentCount === 1 ? "comment" : "comments"}`}
          >
            {story.commentCount}c
          </Link>
          <button
            type="button"
            onClick={() => handleVote(story._id)}
            disabled={!isClerkLoaded}
            className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-full border border-ink bg-surface text-ink whitespace-nowrap hover:bg-surface-hover active:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Vibe it"
            aria-label={`Vibe it, ${story.votes} ${story.votes === 1 ? "vote" : "votes"} for ${story.title}`}
          >
            <span className="text-[13px] font-medium">Vibe it</span>
            <span className="text-[13px] font-semibold tabular-nums">
              {story.votes}
            </span>
          </button>
        </div>
      </article>
    );
  };

  // VIBE VIEW: modern card row (vibes block + thumbnail + copy)
  const renderVibeRow = (story: Story) => (
    <article
      key={story._id}
      className="flex flex-col md:flex-row items-stretch gap-4 bg-surface rounded-xl border border-hairline p-4"
    >
      {/* Vibes block */}
      <div className="flex md:flex-col items-center md:items-stretch gap-0 w-full md:w-[76px] flex-shrink-0 order-2 md:order-1">
        <div className="bg-brand-soft rounded-l-lg md:rounded-l-none md:rounded-t-lg flex-1 md:flex-none md:h-[64px] flex flex-col items-center justify-center border border-hairline py-1.5">
          {/* Geist at 22px semibold holds the weight the slab face gave this
              number. Tabular figures stop 3 and 4 digit counts shifting. */}
          <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-ink leading-none">
            {story.votes}
          </span>
          <span className="text-[12px] text-copy mt-0.5">Vibes</span>
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
          <div className="mb-2 text-[13px] text-on-cta bg-cta border border-hairline rounded-md px-2 py-1 italic inline-block">
            {story.customMessage}
          </div>
        )}
        <h2 className="app-title text-ink flex items-center gap-1.5 min-w-0 mb-1">
          {story.isPinned && (
            <Pin
              className="w-4 h-4 text-faint flex-shrink-0"
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
        <p className="app-desc text-copy mb-2 line-clamp-2">
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

  // GRID VIEW: screenshot first, title, blurb, time left / vote pill right
  const renderGridCard = (story: Story, index: number) => (
    <article
      key={story._id}
      className="flex flex-col h-full bg-surface rounded-lg p-4 border border-hairline hover:bg-surface-hover transition-colors motion-reduce:transition-none"
    >
      {/* 16:9 screenshot. Aspect box reserved so missing images do not collapse the card. */}
      <Link
        to={`/s/${story.slug}`}
        className="flex-shrink-0 w-full aspect-video rounded-md overflow-hidden border border-hairline bg-surface-alt block mb-3"
        tabIndex={-1}
        aria-hidden="true"
      >
        {story.screenshotUrl ? (
          <img
            src={story.screenshotUrl}
            alt=""
            className="w-full h-full object-cover"
            loading={index < 3 ? "eager" : "lazy"}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-soft">
            {story.title.charAt(0).toUpperCase()}
          </div>
        )}
      </Link>

      {story.customMessage && (
        <div className="mb-2 text-[13px] text-on-cta bg-cta border border-hairline rounded-md p-2 italic">
          {story.customMessage}
        </div>
      )}

      <h2 className="app-title text-ink flex items-center gap-1.5 min-w-0 mb-1">
        {story.isPinned && (
          <Pin
            className="w-4 h-4 text-faint flex-shrink-0"
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
        <p className="app-desc text-copy mb-2 line-clamp-2">{story.description}</p>
      )}

      {story.tags && story.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          <TagPills tags={story.tags} size="sm" shape="pill" />
        </div>
      )}

      {/* Footer stays on the bottom of short cards. Time left, vote pill right. */}
      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 text-[13px] text-soft">
          <span className="tabular-nums">
            {compactTimeAgo(story._creationTime)}
          </span>
          <Link
            to={`/s/${story.slug}#comments`}
            className="flex items-center gap-1 hover:text-copy"
            aria-label={`${story.commentCount} ${story.commentCount === 1 ? "comment" : "comments"}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="tabular-nums">{story.commentCount}</span>
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
              className="text-soft hover:text-copy"
              title="View GitHub Repo"
            >
              <Github className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleVote(story._id)}
          disabled={!isClerkLoaded}
          className="inline-flex items-center justify-center gap-1 h-8 px-2.5 flex-shrink-0 rounded-full bg-brand-soft border border-hairline text-ink whitespace-nowrap hover:bg-surface-alt active:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Vibe it"
          aria-label={`Vibe it, ${story.votes} ${story.votes === 1 ? "vote" : "votes"} for ${story.title}`}
        >
          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-[13px] font-semibold tabular-nums">
            {story.votes}
          </span>
        </button>
      </div>
    </article>
  );

  const containerClass =
    viewMode === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      : viewMode === "vibe"
        ? "flex flex-col space-y-4"
        : "flex flex-col divide-y divide-hairline bg-surface rounded-lg border border-hairline overflow-hidden";

  return (
    <>
      <DialogComponents />
      <div className="flex flex-col">
        <div className="w-full">
          <div className="space-y-8">
            <div className={containerClass}>
              {stories.map((story, index) =>
                viewMode === "grid"
                  ? renderGridCard(story, index)
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
