import React from "react";
import { Link } from "react-router-dom";
import {
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
        className="group flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-4 py-5 hover:bg-surface-hover transition-colors motion-reduce:transition-none"
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
        <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 w-full justify-end sm:w-auto">
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

  // GRID VIEW: poster card — screenshot, title, byline, blurb, two stat
  // tiles, then a full-width primary action.
  const renderGridCard = (story: Story, index: number) => {
    return (
      <article
        key={story._id}
        className="flex flex-col h-full bg-surface rounded-lg p-2.5 border border-hairline shadow-sm hover:shadow-md transition-shadow motion-reduce:transition-none"
      >
        {/* 16:9 screenshot. Aspect box reserved so missing images do not collapse the card. */}
        <div className="relative flex-shrink-0">
          <Link
            to={`/s/${story.slug}`}
            className="w-full aspect-[2/1] rounded-lg overflow-hidden bg-surface-alt block"
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

          {/* Bookmark and repo sit on the image so they cost no card height. */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface/90 text-soft hover:text-copy shadow-sm">
              <BookmarkButton
                storyId={story._id}
                showMessage={showMessage}
                onAuthRequired={() => {
                  setAuthDialogAction("bookmark");
                  setShowAuthDialog(true);
                }}
              />
            </span>
            {story.githubUrl && (
              <a
                href={story.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface/90 text-soft hover:text-copy shadow-sm"
                title="View GitHub Repo"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col flex-1 px-2 pt-3">
          {story.customMessage && (
            <div className="mb-2 text-[13px] text-on-cta bg-cta rounded-lg p-2 italic">
              {story.customMessage}
            </div>
          )}

          <h2 className="app-card-title text-ink flex items-start gap-1.5 min-w-0">
            {story.isPinned && (
              <Pin
                className="w-4 h-4 mt-1 text-faint flex-shrink-0"
                aria-label="Pinned Story"
              />
            )}
            <Link
              to={`/s/${story.slug}`}
              className="line-clamp-2 hover:underline underline-offset-2"
            >
              {story.title}
            </Link>
          </h2>

          <p className="mt-1 text-[14px] text-soft truncate">
            by{" "}
            {story.submitterName ||
              story.authorName ||
              story.authorUsername ||
              "Anonymous User"}
            <span className="mx-1.5">·</span>
            <span className="tabular-nums">
              {compactTimeAgo(story._creationTime)}
            </span>
            <span className="mx-1.5">·</span>
            <MessageSquare className="inline w-3.5 h-3.5 -mt-0.5" />
            <span className="tabular-nums ml-1">{story.commentCount}</span>
          </p>

          {story.description && (
            <p className="mt-2 text-[15px] leading-snug text-copy line-clamp-2">
              {story.description}
            </p>
          )}

          {story.tags && story.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <TagPills tags={story.tags} size="sm" shape="pill" />
            </div>
          )}

          {/* Everything below is pinned to the bottom so cards in a row line up. */}
          <div className="mt-auto pt-3">
            <button
              type="button"
              onClick={() => handleVote(story._id)}
              disabled={!isClerkLoaded}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cta text-on-cta py-2.5 text-[15px] font-semibold hover:bg-cta-hover active:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Vibe it, ${story.votes} ${story.votes === 1 ? "vote" : "votes"} for ${story.title}`}
            >
              Vibe it
              <span className="tabular-nums opacity-70">{story.votes}</span>
            </button>

          </div>
        </div>
      </article>
    );
  };

  const containerClass =
    viewMode === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      : viewMode === "vibe"
        ? "grid grid-cols-1 md:grid-cols-2 gap-6"
        : "flex flex-col divide-y divide-hairline bg-surface rounded-lg border border-hairline overflow-hidden";

  return (
    <>
      <DialogComponents />
      <div className="flex flex-col">
        <div className="w-full">
          <div className="space-y-8">
            <div className={containerClass}>
              {stories.map((story, index) =>
                viewMode === "grid" || viewMode === "vibe"
                  ? renderGridCard(story, index)
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
