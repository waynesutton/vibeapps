import React from "react";
import { Link } from "react-router-dom";
import { ChevronUp, MessageSquare, ArrowDown, Github, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Story } from "../types";
import { UsePaginatedQueryResult, useMutation } from "convex/react";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

interface StoryListProps {
  stories: Story[];
  viewMode: "list" | "grid" | "vibe";
  status: UsePaginatedQueryResult<any>["status"];
  loadMore: UsePaginatedQueryResult<any>["loadMore"];
  itemsPerPage: number;
}

export function StoryList({ stories, viewMode, status, loadMore, itemsPerPage }: StoryListProps) {
  const voteStory = useMutation(api.stories.voteStory);

  const handleVote = (storyId: Id<"stories">) => {
    voteStory({ storyId });
  };

  const containerClass =
    viewMode === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      : viewMode === "vibe"
        ? "flex flex-col space-y-6"
        : "space-y-4";

  const formatDate = (creationTime: number) => {
    try {
      return formatDistanceToNow(creationTime) + " ago";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date not available";
    }
  };
  // This section is responsible for rendering the story list based on the view mode selected.
  // It dynamically applies different styles and layouts depending on the view mode.
  // For the vibe view, it includes a unique layout with a vibe counter and a button to vibe the story.
  // For the grid view, it includes a thumbnail and a brief summary of the story.
  // For the list view, it includes a detailed summary of the story.

  return (
    <div className="space-y-8">
      <div className={containerClass}>
        {stories.map((story) => (
          <article
            key={story._id}
            className={`flex ${viewMode === "grid" ? "flex-col bg-white rounded-lg p-4 border border-[#D5D3D0]" : viewMode === "vibe" ? "items-start" : "flex-row bg-white rounded-lg p-4 border border-[#D5D3D0]"} gap-4`}>
            <div
              className={`flex ${viewMode === "vibe" ? "flex-col items-center w-[70px] flex-shrink-0" : viewMode === "grid" ? "flex-row items-center gap-1 pt-1" : "flex-col items-center min-w-[40px] pt-1"}`}>
              {viewMode === "vibe" ? (
                <div className="flex flex-col items-center w-full">
                  <div className="bg-gradient-to-b from-[#FBF5DB] to-[#FAF9F1] rounded-t-md w-full h-[62px] flex flex-col items-center justify-center text-lg border border border-[#D5D3D0] font-normal text-[#2A2825] mb-[4px]">
                    {story.votes}
                    <div className="text-xs">Vibes</div>
                  </div>
                  <button
                    onClick={() => handleVote(story._id)}
                    className="bg-white border border-t-0 border-[#D5D3D0] text-[#787671] hover:bg-[#FBF5DB] w-full rounded-b-md py-1 px-2 flex items-center justify-center gap-1 text-sm font-normal h-[24px]">
                    Vibe it
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleVote(story._id)}
                    className="text-[#2A2825] hover:bg-[#FBF5DB] p-1 rounded">
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <span className="text-[#2A2825] font-medium text-sm">{story.votes}</span>
                </>
              )}
            </div>

            {/* THUMBNAIL - Vibe view only */}
            {viewMode === "vibe" && story.screenshotUrl && (
              <Link
                to={`/s/${story.slug}`}
                className="flex-shrink-0 w-40 aspect-video block overflow-hidden rounded-md">
                <img
                  src={story.screenshotUrl}
                  alt={`${story.title} thumbnail`}
                  className="w-full h-full object-cover border border-[#D5D3D0]"
                  loading="lazy"
                />
              </Link>
            )}

            {/* STORY CONTENT - Apply bg/border/padding here for vibe mode */}
            <div
              className={`flex-1 min-w-0 ${viewMode === "vibe" ? "bg-white rounded-lg p-3.5 border border-[#D5D3D0]" : ""}`}>
              {story.customMessage && (
                <div className="mb-4 text-sm text-[#787671] bg-[#F3F0ED] border border-[#D5D3D0] rounded-md p-3 italic">
                  {story.customMessage}
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                {story.isPinned && (
                  <Pin className="w-4 h-4 #787671 flex-shrink-0" aria-label="Pinned Story" />
                )}
                <h2 className="text-[#525252] font-medium truncate">
                  <Link to={`/s/${story.slug}`} className="hover:text-[#2A2825] break-words">
                    {story.title}
                  </Link>
                </h2>
              </div>
              {viewMode === "grid" && story.screenshotUrl && (
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
              {viewMode !== "vibe" && (
                <p className="text-[#787672] text-sm mb-4 line-clamp-3">{story.description}</p>
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
                {story.githubUrl && (
                  <a
                    href={story.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#787672] hover:text-[#525252]"
                    title="View GitHub Repo">
                    <Github className="w-4 h-4" />
                    <span>Repo</span>
                  </a>
                )}
                <div
                  className={`flex gap-1.5 flex-wrap ${viewMode === "vibe" ? "max-w-[calc(100%-150px)] overflow-hidden whitespace-nowrap" : ""}`}>
                  {(story.tags || []).map(
                    (tag: Doc<"tags">) =>
                      !tag.isHidden && (
                        <Link
                          key={tag._id}
                          to={`/?tag=${tag._id}`}
                          className="px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: tag.backgroundColor || "#F4F0ED",
                            color: tag.textColor || "#525252",
                            border: tag.backgroundColor ? "none" : `1px solid #D5D3D0`,
                          }}>
                          {tag.name}
                        </Link>
                      )
                  )}
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
            disabled={status !== "CanLoadMore"}>
            Load More
            {status === "CanLoadMore" && <ArrowDown className="w-4 h-4" />}
          </button>
        </div>
      )}
      {status === "Exhausted" && stories.length > 0 && (
        <div className="text-center mt-8 text-[#787672]">No more stories.</div>
      )}
    </div>
  );
}
