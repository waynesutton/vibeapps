import { Link } from "react-router-dom";
import React from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { UserCircle } from "lucide-react";
import { ProfileHoverCard } from "../components/ui/ProfileHoverCard";
import { BackToAppsLink } from "../components/BackToAppsLink";

export function LeaderboardPage() {
  // Get top stories for the leaderboard
  const liveStories = useQuery(api.stories.getWeeklyLeaderboardStories, {
    limit: 20, // Show more stories on the dedicated page
  });

  // Voting bumps the count, the reactive query re-sorts, and the row jumps to a
  // new rank while its animation is still playing — which reads as the feedback
  // firing on somebody else's app. Hold the order still until it finishes, then
  // let the new ranking land.
  const [votingId, setVotingId] = React.useState<string | null>(null);
  const frozen = React.useRef<typeof liveStories>(undefined);
  const voteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!votingId) {
    frozen.current = liveStories;
  }
  const topStories = votingId ? frozen.current : liveStories;

  React.useEffect(
    () => () => {
      if (voteTimer.current) clearTimeout(voteTimer.current);
    },
    [],
  );

  const handleVoted = (storyId: string) => {
    setVotingId(storyId);
    if (voteTimer.current) clearTimeout(voteTimer.current);
    voteTimer.current = setTimeout(() => setVotingId(null), 950);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <header className="flex items-center gap-1.5 mb-4 min-h-11">
          <BackToAppsLink />
          <h1 className="text-xl font-medium text-ink">Leaderboard</h1>
        </header>
        <p className="text-copy mb-6">
          Top apps with the most vibes this week.
        </p>

        <div className="bg-surface rounded-lg border border-hairline">
          {topStories === undefined ? (
            <div className="p-8 text-center text-copy">
              Loading leaderboard...
            </div>
          ) : topStories.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-copy mb-4">No apps trending yet</div>
              <p className="text-sm text-soft">
                When apps start getting vibes, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {topStories.map((story, index) => (
                <LeaderboardItem
                  key={story._id}
                  story={story}
                  rank={index + 1}
                  justVoted={votingId === story._id}
                  onVoted={handleVoted}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface LeaderboardItemProps {
  story: {
    _id: any;
    title: string;
    slug: string;
    votes: number;
    description: string;
    screenshotUrl: string | null;
    authorUsername?: string;
    authorName?: string;
  };
  rank: number;
  justVoted: boolean;
  onVoted: (storyId: string) => void;
}

function LeaderboardItem({
  story,
  rank,
  justVoted,
  onVoted,
}: LeaderboardItemProps) {
  const { isSignedIn, isLoaded } = useUser();
  const voteStory = useMutation(api.stories.voteStory);

  const handleVote = () => {
    if (!isLoaded || !isSignedIn) return;
    onVoted(story._id);
    voteStory({ storyId: story._id });
  };

  return (
    <div className="px-3 sm:px-4 py-3 hover:bg-surface-hover transition-colors motion-reduce:transition-none">
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cta flex items-center justify-center text-on-cta text-[13px] font-medium tabular-nums">
          {rank}
        </span>

        <Link
          to={`/s/${story.slug}`}
          className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-hairline bg-surface-alt block"
          tabIndex={-1}
          aria-hidden="true"
        >
          {story.screenshotUrl ? (
            <img
              src={story.screenshotUrl}
              alt=""
              className="w-full h-full object-cover"
              loading={rank <= 6 ? "eager" : "lazy"}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-soft">
              {story.title.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <Link
            to={`/s/${story.slug}`}
            className="app-title-sm text-ink hover:underline underline-offset-2 block truncate"
          >
            {story.title}
          </Link>
          {story.description && (
            <p className="text-[13px] text-copy line-clamp-1 mt-0.5">
              {story.description}
            </p>
          )}
          {story.authorUsername ? (
            <ProfileHoverCard username={story.authorUsername}>
              <Link
                to={`/${story.authorUsername}`}
                className="mt-0.5 text-xs text-soft hover:text-copy inline-flex items-center gap-1 max-w-full"
              >
                <UserCircle className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {story.authorName || story.authorUsername}
                </span>
              </Link>
            </ProfileHoverCard>
          ) : story.authorName ? (
            <span className="mt-0.5 text-xs text-soft inline-flex items-center gap-1 max-w-full">
              <UserCircle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{story.authorName}</span>
            </span>
          ) : null}
        </div>

        {/* Count reads as a figure, not a footnote, and the row can be voted on
            directly rather than only from the feed. */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="text-right leading-none">
            <div className="text-[20px] font-semibold text-ink tabular-nums">
              {story.votes}
            </div>
            <div className="text-[11px] text-soft mt-0.5">
              {story.votes === 1 ? "vibe" : "vibes"}
            </div>
          </div>
          <span className="relative">
            {justVoted && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-lg bg-cta animate-vibe-halo motion-reduce:hidden"
              />
            )}
            <button
              type="button"
              onClick={handleVote}
              disabled={!isLoaded}
              className={`relative inline-flex items-center justify-center h-9 px-3 rounded-lg bg-cta text-on-cta text-[13px] font-semibold whitespace-nowrap hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ${
                justVoted ? "animate-vibe-pop motion-reduce:animate-none" : ""
              }`}
              aria-label={`Vibe it, ${story.votes} ${story.votes === 1 ? "vote" : "votes"} for ${story.title}`}
            >
              Vibe it
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
