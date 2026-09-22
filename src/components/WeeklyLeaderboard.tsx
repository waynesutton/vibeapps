import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { ThumbsUp, UserCircle } from "lucide-react"; // Example icons
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

// Matches the medal tints on the leaderboard page so the top three read the
// same in both places. Low opacity so they sit correctly on light and dark.
const RANK_TINT: Record<number, { row: string; num: string }> = {
  1: { row: "bg-[rgb(245_197_24_/_0.12)]", num: "text-[rgb(161_128_10)]" },
  2: { row: "bg-[rgb(148_163_184_/_0.14)]", num: "text-[rgb(100_116_139)]" },
  3: { row: "bg-[rgb(205_127_50_/_0.12)]", num: "text-[rgb(154_95_37)]" },
};

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
          <li
            key={story._id}
            style={{ animationDelay: `${index * 60}ms` }}
            className={`flex items-start gap-3 rounded-md px-2 py-1.5 -mx-2 animate-comment-rise motion-reduce:animate-none ${
              RANK_TINT[index + 1]?.row ?? ""
            }`}
          >
            <span
              className={`text-[15px] font-semibold tabular-nums ${
                RANK_TINT[index + 1]?.num ?? "text-faint font-medium"
              }`}
            >
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

      {/* The full board is reachable from here rather than only from a footer
          link, which is where people actually look for it. */}
      <Link
        to="/leaderboard"
        className="mt-4 w-full inline-flex items-center justify-center h-9 rounded-md border border-hairline bg-surface text-sm font-medium text-copy hover:bg-surface-hover hover:text-ink transition-colors motion-reduce:transition-none"
      >
        View leaderboard
      </Link>
    </div>
  );
}
