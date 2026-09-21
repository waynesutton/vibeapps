import React from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  ThumbsUp,
  ArrowDown,
  Github,
  Pin,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
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

// Same medal tints as the leaderboard and the sidebar card, so this week's top
// three are recognisable wherever they show up.
const RANK_RIBBON: Record<number, string> = {
  1: "bg-[rgb(245_197_24)] text-[rgb(61_46_0)]",
  2: "bg-[rgb(148_163_184)] text-[rgb(30_36_46)]",
  3: "bg-[rgb(205_127_50)] text-[rgb(48_28_6)]",
};

const RANK_TINT: Record<number, string> = {
  1: "bg-[rgb(245_197_24_/_0.08)]",
  2: "bg-[rgb(148_163_184_/_0.10)]",
  3: "bg-[rgb(205_127_50_/_0.08)]",
};

export function StoryList({
  stories,
  viewMode,
  status,
  loadMore,
  itemsPerPage,
}: StoryListProps) {
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();
  const voteStory = useMutation(api.stories.voteStory);

  // The feed is usually sorted by recency, so position is not rank. Look up
  // this week's top three by id instead of tinting the first three rows, which
  // would be wrong under every sort but "most vibes".
  const weeklyTop = useQuery(api.stories.getWeeklyLeaderboardStories, {
    limit: 3,
  });
  const weeklyRank = React.useMemo(() => {
    const map = new Map<string, number>();
    weeklyTop?.forEach((s, i) => map.set(s._id as unknown as string, i + 1));
    return map;
  }, [weeklyTop]);
  const rankTint = (storyId: string) =>
    RANK_TINT[weeklyRank.get(storyId) ?? 0] ?? "";

  // Rank ribbon for this week's top three, sat on the screenshot corner.
  const RankRibbon = ({
    storyId,
    inline = false,
  }: {
    storyId: string;
    inline?: boolean;
  }) => {
    const rank = weeklyRank.get(storyId);
    if (!rank || !RANK_RIBBON[rank]) return null;
    return (
      <span
        className={`inline-flex items-center h-6 px-2 rounded-md text-[12px] font-semibold tabular-nums shadow-sm ${
          inline ? "flex-shrink-0" : "absolute top-2 left-2 z-10"
        } ${RANK_RIBBON[rank]}`}
        aria-label={`Number ${rank} this week`}
      >
        #{rank}
      </span>
    );
  };
  const { showMessage, DialogComponents } = useDialog();

  // Auth required dialog state
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [authDialogAction, setAuthDialogAction] = React.useState("");

  // Which story just got voted, so its control can play the feedback once.
  const [justVoted, setJustVoted] = React.useState<Id<"stories"> | null>(null);
  const vibeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (vibeTimer.current) clearTimeout(vibeTimer.current);
    },
    [],
  );

  const handleVote = (storyId: Id<"stories">) => {
    if (!isClerkLoaded) return;

    if (!isSignedIn) {
      setAuthDialogAction("vote");
      setShowAuthDialog(true);
      return;
    }

    // Fire the animation straight away rather than waiting on the round trip;
    // Convex reconciles the count when the mutation lands.
    setJustVoted(storyId);
    if (vibeTimer.current) clearTimeout(vibeTimer.current);
    vibeTimer.current = setTimeout(() => setJustVoted(null), 950);

    voteStory({ storyId });
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

  // Author name, carrying the hover card when we know their username. Both
  // layouts render it, so it lives here rather than being duplicated.
  const AuthorName = ({ story }: { story: Story }) => {
    const label =
      story.submitterName ||
      story.authorName ||
      story.authorUsername ||
      "Anonymous User";
    if (!story.authorUsername) {
      return <>by {label}</>;
    }
    return (
      <ProfileHoverCard username={story.authorUsername}>
        <Link
          to={`/${story.authorUsername}`}
          className="hover:text-copy hover:underline underline-offset-2"
        >
          by {label}
        </Link>
      </ProfileHoverCard>
    );
  };

  // LIST VIEW: a dense ranked row. Two lines of text at every width — the
  // previous version wrapped to five on a phone, with the blurb truncated to
  // "Amet quo voluptate qui…" and the vote pill stranded on its own line.
  const renderListRow = (story: Story, index: number) => {
    const leadTag = visibleTags(story.tags ?? []).slice(0, 1);

    return (
      <article
        key={story._id}
        className={`group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-4 transition-colors motion-reduce:transition-none hover:bg-surface-hover ${rankTint(
          story._id,
        )}`}
      >
        {/* Square thumbnail. A square holds its size in a dense row far better
            than a 16:9 box, which had to go wide to stay legible. */}
        <Link
          to={`/s/${story.slug}`}
          className="flex-shrink-0 w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] rounded-lg overflow-hidden border border-hairline bg-surface-alt block"
          tabIndex={-1}
          aria-hidden="true"
        >
          {story.screenshotUrl ? (
            <img
              src={story.screenshotUrl}
              alt=""
              className="w-full h-full object-cover"
              loading={index < 6 ? "eager" : "lazy"}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-soft">
              {story.title.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {story.isPinned && (
              <Pin
                className="w-3.5 h-3.5 text-faint flex-shrink-0"
                aria-label="Pinned Story"
              />
            )}
            <RankRibbon storyId={story._id} inline />
            <h2 className="app-title text-ink truncate min-w-0">
              <Link
                to={`/s/${story.slug}`}
                className="hover:underline underline-offset-2"
              >
                {story.title}
              </Link>
            </h2>
            {leadTag.length > 0 && (
              <span className="hidden sm:flex flex-shrink-0">
                <TagPills tags={leadTag} size="sm" shape="pill" />
              </span>
            )}
          </div>

          {story.description && (
            <p className="text-[13px] text-copy line-clamp-1 mt-0.5">
              {story.description}
            </p>
          )}

          {/* Everything secondary on one line so the row stays two lines tall. */}
          <div className="mt-1 flex items-center gap-2 min-w-0 text-[13px] text-soft">
            <span className="truncate">
              <AuthorName story={story} />
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums flex-shrink-0">
              {compactTimeAgo(story._creationTime)}
            </span>
            <Link
              to={`/s/${story.slug}#comments`}
              className="flex items-center gap-1 flex-shrink-0 hover:text-copy"
              aria-label={`${story.commentCount} ${story.commentCount === 1 ? "comment" : "comments"}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="tabular-nums">{story.commentCount}</span>
            </Link>
            <span className="hidden sm:flex items-center gap-2 flex-shrink-0">
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
                  className="hover:text-copy"
                  title="View GitHub Repo"
                >
                  <Github className="w-3.5 h-3.5" />
                </a>
              )}
            </span>
          </div>
        </div>

        <span className="relative flex-shrink-0">
          {justVoted === story._id && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-lg bg-cta animate-vibe-halo motion-reduce:hidden"
            />
          )}
          <button
            type="button"
            onClick={() => handleVote(story._id)}
            disabled={!isClerkLoaded}
            className={`relative inline-flex items-center justify-center gap-1.5 h-10 px-3 sm:px-4 rounded-lg bg-cta text-on-cta whitespace-nowrap hover:bg-cta-hover active:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ${
              justVoted === story._id
                ? "animate-vibe-pop motion-reduce:animate-none"
                : ""
            }`}
            aria-label={`Vibe, ${story.votes} ${story.votes === 1 ? "vote" : "votes"} for ${story.title}`}
          >
            <ThumbsUp className="w-4 h-4" aria-hidden="true" />
            <span className="text-[14px] font-semibold">Vibe</span>
            <span
              className={`text-[14px] font-semibold tabular-nums opacity-70 ${
                justVoted === story._id
                  ? "inline-block animate-vibe-bump motion-reduce:animate-none"
                  : ""
              }`}
            >
              {story.votes}
            </span>
          </button>
        </span>
      </article>
    );
  };


  // VIBE VIEW: wide editorial row — a prominent vibe block on the left, then
  // the screenshot, then the copy. Grid keeps the poster card; this is the
  // scannable feed layout.
  const renderVibeRow = (story: Story, index: number) => (
    <article
      key={story._id}
      className={`flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4 rounded-lg border border-hairline p-3 sm:p-4 transition-colors motion-reduce:transition-none hover:bg-surface-hover ${
        rankTint(story._id) || "bg-surface"
      }`}
    >
      {/* Vibe block. Deliberately the heaviest thing in the row. */}
      <div className="flex sm:flex-col items-stretch gap-2 w-full sm:w-[84px] flex-shrink-0 order-3">
        <div className="hidden sm:flex flex-col items-center justify-center rounded-lg bg-brand-soft border border-hairline py-2 px-3">
          <span className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-ink leading-none">
            {story.votes}
          </span>
          <span className="text-[11px] text-copy mt-1">
            {story.votes === 1 ? "Vibe" : "Vibes"}
          </span>
        </div>
        <span className="relative w-full sm:flex-none">
          {justVoted === story._id && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-lg bg-cta animate-vibe-halo motion-reduce:hidden"
            />
          )}
          <button
            type="button"
            onClick={() => handleVote(story._id)}
            disabled={!isClerkLoaded}
            className={`relative w-full h-full min-h-[36px] inline-flex items-center justify-center rounded-lg bg-cta text-on-cta text-[13px] font-semibold hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ${
              justVoted === story._id
                ? "animate-vibe-pop motion-reduce:animate-none"
                : ""
            }`}
            aria-label={`Vibe, ${story.votes} ${story.votes === 1 ? "vote" : "votes"} for ${story.title}`}
          >
            <ThumbsUp className="w-4 h-4" aria-hidden="true" />
            Vibe
            <span className="sm:hidden tabular-nums opacity-70">
              {story.votes}
            </span>
          </button>
        </span>
      </div>

      {/* Screenshot */}
      <div className="relative w-full sm:w-[190px] sm:flex-shrink-0 order-1">
      <RankRibbon storyId={story._id} />
      <Link
        to={`/s/${story.slug}`}
        className="w-full aspect-video block overflow-hidden rounded-lg border border-hairline bg-surface-alt"
        tabIndex={-1}
        aria-hidden="true"
      >
        {story.screenshotUrl ? (
          <img
            src={story.screenshotUrl}
            alt=""
            className="w-full h-full object-cover"
            loading={index < 4 ? "eager" : "lazy"}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-soft">
            {story.title.charAt(0).toUpperCase()}
          </div>
        )}
      </Link>
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0 order-2">
        {story.customMessage && (
          <div className="mb-2 text-[13px] text-on-cta bg-cta rounded-lg px-2 py-1 italic inline-block">
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
            className="hover:underline underline-offset-2 line-clamp-1"
          >
            {story.title}
          </Link>
        </h2>
        <p className="mt-1 text-[15px] leading-snug text-copy line-clamp-2">
          {story.description}
        </p>
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            <TagPills tags={story.tags} size="sm" shape="pill" />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-[13px] text-soft">
          <span className="truncate">
            <AuthorName story={story} />
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums flex-shrink-0">
            {compactTimeAgo(story._creationTime)}
          </span>
          <Link
            to={`/s/${story.slug}#comments`}
            className="flex items-center gap-1 flex-shrink-0 hover:text-copy"
            aria-label={`${story.commentCount} ${story.commentCount === 1 ? "comment" : "comments"}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="tabular-nums">{story.commentCount}</span>
          </Link>
          <span className="flex items-center gap-2 flex-shrink-0">
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
                className="hover:text-copy"
                title="View GitHub Repo"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
          </span>
        </div>
      </div>
    </article>
  );

  // GRID VIEW: poster card — screenshot, title, byline, blurb, two stat
  // tiles, then a full-width primary action.
  const renderGridCard = (story: Story, index: number) => {
    return (
      <article
        key={story._id}
        className={`flex flex-col h-full rounded-lg p-2.5 border border-hairline shadow-sm hover:shadow-md transition-shadow motion-reduce:transition-none ${
        rankTint(story._id) || "bg-surface"
      }`}
      >
        {/* 16:9 screenshot. Aspect box reserved so missing images do not collapse the card. */}
        <div className="relative flex-shrink-0">
          <RankRibbon storyId={story._id} />
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
            <AuthorName story={story} />
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
            <div className="relative">
              {justVoted === story._id && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-lg bg-cta animate-vibe-halo motion-reduce:hidden"
                />
              )}
              <button
                type="button"
                onClick={() => handleVote(story._id)}
                disabled={!isClerkLoaded}
                className={`relative w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cta text-on-cta py-2.5 text-[15px] font-semibold hover:bg-cta-hover active:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  justVoted === story._id
                    ? "animate-vibe-pop motion-reduce:animate-none"
                    : ""
                }`}
                aria-label={`Vibe, ${story.votes} ${story.votes === 1 ? "vote" : "votes"} for ${story.title}`}
              >
                <ThumbsUp className="w-4 h-4" aria-hidden="true" />
                Vibe
                <span
                  className={`tabular-nums opacity-70 ${
                    justVoted === story._id
                      ? "inline-block animate-vibe-bump motion-reduce:animate-none"
                      : ""
                  }`}
                >
                  {story.votes}
                </span>
              </button>
            </div>

          </div>
        </div>
      </article>
    );
  };

  const containerClass =
    viewMode === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      : viewMode === "vibe"
        ? "flex flex-col gap-4"
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
                    ? renderVibeRow(story, index)
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
