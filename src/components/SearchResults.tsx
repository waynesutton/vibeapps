import React from "react";
import { StoryList } from "./StoryList";
import type { Story } from "../types";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { User } from "lucide-react";

interface SearchResultsProps {
  query: string;
  stories: Story[];
  viewMode: "list" | "grid" | "vibe";
}

export function SearchResults({ query, stories, viewMode }: SearchResultsProps) {
  // Search for users as well
  const users = useQuery(api.users.searchUsers, query.trim() ? { searchTerm: query } : "skip");

  const totalResults = stories.length + (users?.length || 0);

  return (
    <div>
      <div className="mb-4">
        <Link to="/" className="text-[#292929] hover:underline text-sm">
          ← Back to Apps
        </Link>
      </div>
      <div className="mb-6">
        <h2 className="text-xl text-[#525252] mb-2">Search Results for "{query}"</h2>
        <p className="text-[#545454]">
          Found {totalResults} {totalResults === 1 ? "result" : "results"}
          {stories.length > 0 && users && users.length > 0 && (
            <span> ({stories.length} {stories.length === 1 ? "app" : "apps"}, {users.length} {users.length === 1 ? "user" : "users"})</span>
          )}
        </p>
      </div>

      {/* Users Section */}
      {users && users.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium text-[#292929] mb-4">Users</h3>
          <div className="grid gap-3">
            {users.map((user) => (
              <Link
                key={user._id}
                to={`/${user.username}`}
                className="flex items-center gap-3 p-3 rounded-md border border-[#D8E1EC] bg-white hover:bg-[#F4F2EE] transition-colors"
              >
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#292929] flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#292929]">{user.name}</p>
                    {user.isVerified && (
                      <span className="text-xs text-[#292929]" title="Verified">
                        ✓
                      </span>
                    )}
                  </div>
                  {user.username && (
                    <p className="text-sm text-[#545454]">@{user.username}</p>
                  )}
                  {user.bio && (
                    <p className="text-sm text-[#545454] mt-1 line-clamp-1">
                      {user.bio}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Apps Section */}
      {stories.length > 0 && (
        <div>
          {users && users.length > 0 && (
            <h3 className="text-lg font-medium text-[#292929] mb-4">Apps</h3>
          )}
          <StoryList
            stories={stories}
            viewMode={viewMode}
            status={"Exhausted"}
            loadMore={() => {}}
            itemsPerPage={stories.length}
          />
        </div>
      )}

      {/* No Results */}
      {stories.length === 0 && (!users || users.length === 0) && (
        <div className="text-center py-12">
          <p className="text-[#545454] mb-4">No results found for "{query}"</p>
          <p className="text-sm text-[#545454]">
            Try searching with different keywords
          </p>
        </div>
      )}
    </div>
  );
}
