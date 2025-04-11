import React from "react";
import { Link } from "react-router-dom";
import { ChevronUp, MessageSquare, ArrowDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Story } from "../types";
import { UsePaginatedQueryResult } from "convex/react";

interface StoryListProps {
  stories: Story[];
  viewMode: "list" | "grid";
  status: UsePaginatedQueryResult<any>["status"];
  loadMore: UsePaginatedQueryResult<any>["loadMore"];
  itemsPerPage: number;
}

export function StoryList({ stories, viewMode, status, loadMore, itemsPerPage }: StoryListProps) {
  const containerClass =
    viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4";

  const formatDate = (creationTime: number) => {
    try {
      return formatDistanceToNow(creationTime) + " ago";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date not available";
    }
  };

  return (
    <div className="space-y-8">
      <div className={containerClass}>
        {stories.map((story) => (
          <article
            key={story._id}
            className={`flex ${viewMode === "grid" ? "flex-col" : "flex-row"} gap-4 bg-white rounded-lg p-4 border border-[#D5D3D0]`}>
            <div
              className={`flex ${viewMode === "grid" ? "flex-row items-center gap-1" : "flex-col items-center"} ${viewMode === "list" ? "min-w-[40px]" : "pt-1"}`}>
              <button className="text-[#2A2825] hover:bg-[#F4F0ED] p-1 rounded">
                <ChevronUp className="w-5 h-5" />
              </button>
              <span className="text-[#525252] font-medium text-sm">{story.votes}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-[#525252] font-medium mb-2">
                <Link to={`/s/${story.slug}`} className="hover:text-[#2A2825]">
                  {story.title}
                </Link>
              </h2>
              {viewMode === "grid" && (
                <>
                  {story.screenshotUrl && (
                    <Link
                      to={`/s/${story.slug}`}
                      className="block mb-4 rounded-md overflow-hidden hover:opacity-90 transition-opacity">
                      <img
                        src={story.screenshotUrl}
                        alt={story.title}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                    </Link>
                  )}
                  <p className="text-[#787672] text-sm mb-4 line-clamp-3">{story.description}</p>
                </>
              )}
              {story.customMessage && (
                <div className="mb-4 text-sm text-[#787671] bg-[#F3F0ED] border border-[#D5D3D0] rounded-md p-4">
                  {story.customMessage}
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-[#787672] flex-wrap">
                <span>by {story.name}</span>
                <span>{formatDate(story._creationTime)}</span>
                <Link
                  to={`/s/${story.slug}#comments`}
                  className="flex items-center gap-1 hover:text-[#525252]">
                  <MessageSquare className="w-4 h-4" />
                  {story.commentCount}
                </Link>
                <div className="flex gap-2 flex-wrap">
                  {(story.tags || []).map((tag) => (
                    <Link
                      key={tag._id}
                      to={`/?tag=${tag._id}`}
                      className="text-[#787672] hover:text-[#525252]">
                      {tag.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {status === "CanLoadMore" && (
        <div className="text-center mt-8">
          <button
            onClick={() => loadMore(itemsPerPage)}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 mx-auto"
            disabled={status === "LoadingMore"}>
            {status === "LoadingMore" ? "Loading..." : "Load More"}
            {status !== "LoadingMore" && <ArrowDown className="w-4 h-4" />}
          </button>
        </div>
      )}
      {status === "Exhausted" && stories.length > 0 && (
        <div className="text-center mt-8 text-[#787672]">No more stories.</div>
      )}
    </div>
  );
}
