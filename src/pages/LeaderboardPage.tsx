import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ThumbsUp, UserCircle } from "lucide-react";
import { ProfileHoverCard } from "../components/ui/ProfileHoverCard";

export function LeaderboardPage() {
  // Get top stories for the leaderboard
  const topStories = useQuery(api.stories.getWeeklyLeaderboardStories, {
    limit: 20, // Show more stories on the dedicated page
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-medium text-ink">Leaderboard</h1>
          <p className="text-copy mt-2">
            Top apps with the most vibes this week.
          </p>
        </div>

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
    <div className="p-4 hover:bg-surface-hover transition-colors">
      <div className="flex items-start gap-3">
        {/* Rank Number */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-cta flex items-center justify-center">
            <span className="text-on-cta text-sm font-medium">{rank}</span>
          </div>
        </div>

        {/* Story Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink">
            <Link
              to={`/s/${story.slug}`}
              className="font-medium hover:underline block"
            >
              {story.title}
            </Link>
          </div>

          <div className="flex items-center gap-4 mt-2">
            {/* Author Info */}
            {story.authorUsername ? (
              <ProfileHoverCard username={story.authorUsername}>
                <Link
                  to={`/${story.authorUsername}`}
                  className="text-xs text-soft hover:underline flex items-center gap-1"
                >
                  <UserCircle className="w-3 h-3" />
                  {story.authorName || story.authorUsername}
                </Link>
              </ProfileHoverCard>
            ) : story.authorName ? (
              <span className="text-xs text-soft flex items-center gap-1">
                <UserCircle className="w-3 h-3" />
                {story.authorName}
              </span>
            ) : null}

            {/* Vote Count */}
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-4 h-4 text-soft" />
              <span className="text-sm font-medium text-ink">
                {story.votes} vibes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
