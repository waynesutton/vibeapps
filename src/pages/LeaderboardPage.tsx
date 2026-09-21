import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ThumbsUp, UserCircle } from "lucide-react";
import { ProfileHoverCard } from "../components/ui/ProfileHoverCard";
import { BackToAppsLink } from "../components/BackToAppsLink";

export function LeaderboardPage() {
  // Get top stories for the leaderboard
  const topStories = useQuery(api.stories.getWeeklyLeaderboardStories, {
    limit: 20, // Show more stories on the dedicated page
  });

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
    _id: string;
    title: string;
    slug: string;
    votes: number;
    authorUsername?: string;
    authorName?: string;
  };
  rank: number;
}

function LeaderboardItem({ story, rank }: LeaderboardItemProps) {
  return (
    <div className="px-3 sm:px-4 py-3 hover:bg-surface-hover transition-colors motion-reduce:transition-none">
      {/* Rank, then the app, then the count pinned right — the same left-to-right
          order the feed cards and list rows use. */}
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cta flex items-center justify-center text-on-cta text-[13px] font-medium tabular-nums">
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          <Link
            to={`/s/${story.slug}`}
            className="app-title-sm text-ink hover:underline underline-offset-2 block truncate"
          >
            {story.title}
          </Link>
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

        <div className="flex-shrink-0 flex items-center gap-1.5 text-ink">
          <ThumbsUp className="w-4 h-4 text-soft" aria-hidden="true" />
          <span className="text-sm font-semibold tabular-nums">
            {story.votes}
          </span>
          <span className="hidden sm:inline text-xs text-soft">
            {story.votes === 1 ? "vibe" : "vibes"}
          </span>
        </div>
      </div>
    </div>
  );
}
