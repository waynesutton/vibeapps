import React from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { LeaderboardStory } from "../../convex/stories"; // Import the type
import { ThumbsUp, UserCircle } from "lucide-react"; // Example icons

export function WeeklyLeaderboard() {
  const topStories = useQuery(api.stories.getWeeklyLeaderboardStories, {
    limit: 5,
  });

  if (topStories === undefined) {
    return (
      <div className="p-4 bg-white rounded-lg border border-[#D8E1EC]">
        Loading leaderboard...
      </div>
    );
  }

  if (!topStories || topStories.length === 0) {
    return (
      <div className="p-4 boohide bg-white rounded-lg border border-[#D8E1EC]">
        <h3 className="text-md font-normal text-[#292929] mb-3">
          Most Vibes This Week
        </h3>
        <p className="text-sm text-[#545454]">
          No apps trending this week yet.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-[#D8E1EC]">
      <h3 className="text-md font-normal text-[#292929] mb-3">
        Most Vibes This Week
      </h3>
      <ul className="space-y-3">
        {topStories.map((story, index) => (
          <li key={story._id} className="flex items-start gap-3">
            <span className="text-sm font-medium text-[#787672] pt-0.5">
              {index + 1}.
            </span>
            <div className="flex-grow min-w-0">
              <Link
                to={`/s/${story.slug}`}
                className="text-sm text-[#292929] hover:text-[#525252] hover:underline font-medium break-words line-clamp-2"
                title={story.title}
              >
                {story.title}
              </Link>
              <div className="text-xs text-[#787672] flex items-center gap-2 mt-0.5">
                {story.authorUsername ? (
                  <Link
                    to={`/${story.authorUsername}`}
                    className="hover:underline flex items-center gap-1"
                  >
                    <UserCircle className="w-3 h-3" />
                    {story.authorName || story.authorUsername}
                  </Link>
                ) : story.authorName ? (
                  <span className="flex items-center gap-1">
                    <UserCircle className="w-3 h-3" />
                    {story.authorName}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" />
                  {story.votes} vibes
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
