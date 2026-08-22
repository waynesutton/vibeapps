import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { ThumbsUp, UserCircle } from "lucide-react"; // Example icons
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

export function WeeklyLeaderboard() {
  const topStories = useQuery(api.stories.getWeeklyLeaderboardStories, {
    limit: 5,
  });

  if (topStories === undefined) {
    return (
      <div className="p-4 bg-surface rounded-lg border border-hairline">
        Loading leaderboard...
      </div>
    );
  }

  if (!topStories || topStories.length === 0) {
    return (
      <div className="p-4 boohide bg-surface rounded-lg border border-hairline">
        <h3 className="text-md font-normal text-ink mb-3">
          Most Vibes This Week
        </h3>
        <p className="text-sm text-soft">
          No apps trending this week yet.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface rounded-lg border border-hairline">
      <h3 className="text-md font-normal text-ink mb-3">
        Most Vibes This Week
      </h3>
      <ul className="space-y-3">
        {topStories.map((story, index) => (
          <li key={story._id} className="flex items-start gap-3">
            <span className="text-[15px] font-medium text-faint tabular-nums">
              {index + 1}.
            </span>
            <div className="flex-grow min-w-0">
              <Link
                to={`/s/${story.slug}`}
                className="app-title-sm text-ink hover:text-copy hover:underline break-words line-clamp-2"
                title={story.title}
              >
                {story.title}
              </Link>
              <div className="text-[13px] text-faint flex items-center gap-2 mt-0.5">
                {story.authorUsername ? (
                  <ProfileHoverCard username={story.authorUsername}>
                    <Link
                      to={`/${story.authorUsername}`}
                      className="hover:underline flex items-center gap-1"
                    >
                      <UserCircle className="w-3 h-3" />
                      {story.authorName || story.authorUsername}
                    </Link>
                  </ProfileHoverCard>
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
