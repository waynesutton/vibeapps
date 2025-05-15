import React from "react";
import { StoryList } from "./StoryList";
import type { Story } from "../types";
import { Link } from "react-router-dom";

interface SearchResultsProps {
  query: string;
  stories: Story[];
  viewMode: "list" | "grid" | "vibe";
}

export function SearchResults({ query, stories, viewMode }: SearchResultsProps) {
  return (
    <div>
      <div className="mb-4">
        <Link to="/" className="text-[#2A2825] hover:underline text-sm">
          ← Back to Apps
        </Link>
      </div>
      <div className="mb-6">
        <h2 className="text-xl text-[#525252] mb-2">Search Results for "{query}"</h2>
        <p className="text-[#545454]">
          Found {stories.length} {stories.length === 1 ? "result" : "results"}
        </p>
      </div>
      <StoryList
        stories={stories}
        viewMode={viewMode}
        status={"Exhausted"}
        loadMore={() => {}}
        itemsPerPage={stories.length}
      />
    </div>
  );
}
