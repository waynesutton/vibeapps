import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

// Type for the user object returned by getRecentVibers
type RecentViberUser = {
  _id: string;
  _creationTime: number;
  name: string;
  username?: string;
  imageUrl?: string;
  isVerified?: boolean;
};

// Component displays users with recent activity including joins, comments, ratings, votes, and submissions
export function RecentVibers() {
  const recentVibers = useQuery(api.users.getRecentVibers, { limit: 36 });

  if (recentVibers === undefined) {
    return (
      <div className="p-4 bg-white rounded-lg">
        <h3 className="text-md font-normal text-[#292929] mb-3">
          Recent Vibers
        </h3>
        <div className="grid grid-cols-6 gap-1.5">
          {/* Loading skeleton placeholders */}
          {Array.from({ length: 36 }).map((_, index) => (
            <div
              key={index}
              className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!recentVibers || recentVibers.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg">
        <h3 className="text-md font-normal text-[#292929] mb-3">
          Recent Vibers
        </h3>
        <p className="text-sm text-[#545454]">No recent activity yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg">
      <h3 className="text-md font-normal text-[#292929] mb-3">Recent Vibers</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {recentVibers.map((user: RecentViberUser) => {
          // Skip users without usernames (shouldn't happen due to backend filter)
          if (!user.username) {
            return null;
          }

          return (
            <ProfileHoverCard key={user._id} username={user.username}>
              <Link
                to={`/${user.username}`}
                className="block relative group focus:outline-none rounded-full"
                title={`${user.name} (@${user.username})`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden group-hover:scale-105 transition-transform duration-200">
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#F5F0EE] flex items-center justify-center">
                      <span className="text-[#DFDFE1] text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {/* Verified badge - completely hidden */}
              </Link>
            </ProfileHoverCard>
          );
        })}

        {/* Fill empty slots with invisible placeholders for consistent grid layout */}
        {recentVibers.length < 36 &&
          Array.from({ length: 36 - recentVibers.length }).map((_, index) => (
            <div key={`placeholder-${index}`} className="w-8 h-8" />
          ))}
      </div>
    </div>
  );
}
