import React from "react";
import { Link } from "react-router-dom";
import {
  ChevronUp,
  MessageSquare,
  ArrowDown,
  Github,
  Pin,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Story } from "../types";
import { UsePaginatedQueryResult, useMutation, useQuery } from "convex/react";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@clerk/clerk-react";
import { WeeklyLeaderboard } from "./WeeklyLeaderboard";
import { TopCategoriesOfWeek } from "./TopCategoriesOfWeek";
import { AuthRequiredDialog } from "./ui/AuthRequiredDialog";

interface StoryListProps {
  stories: Story[];
  viewMode: "list" | "grid" | "vibe";
  status: UsePaginatedQueryResult<any>["status"];
  loadMore: UsePaginatedQueryResult<any>["loadMore"];
  itemsPerPage: number;
}

const BookmarkButton = ({
  storyId,
  onAuthRequired,
}: {
  storyId: Id<"stories">;
  onAuthRequired: () => void;
}) => {
  const { isSignedIn } = useAuth();
  const isBookmarked = useQuery(api.bookmarks.isStoryBookmarked, isSignedIn ? { storyId } : "skip");
  const addOrRemoveBookmarkMutation = useMutation(api.bookmarks.addOrRemoveBookmark);

  const handleBookmarkClick = async () => {
    if (!isSignedIn) {
      onAuthRequired();
      return;
    }
    try {
      await addOrRemoveBookmarkMutation({ storyId });
    } catch (error) {
      console.error("Failed to update bookmark:", error);
      alert("Failed to update bookmark. Please try again.");
    }
  };

  if (!isSignedIn) {
    return (
      <button
        className="flex items-center gap-2 text-[#787672] hover:text-[#525252] cursor-not-allowed"
        title="Sign in to bookmark">
        <Bookmark className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleBookmarkClick}
      className="flex items-center gap-2 text-[#787672] hover:text-[#525252]"
      title={isBookmarked ? "Remove bookmark" : "Bookmark story"}>
      {isBookmarked ? (
        <BookmarkCheck className="w-4 h-4 text-black" />
      ) : (
        <Bookmark className="w-4 h-4" />
      )}
    </button>
  );
};

export function StoryList({ stories, viewMode, status, loadMore, itemsPerPage }: StoryListProps) {
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();
  const voteStory = useMutation(api.stories.voteStory);

  // Auth required dialog state
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [authDialogAction, setAuthDialogAction] = React.useState("");

  const handleVote = (storyId: Id<"stories">) => {
    if (!isClerkLoaded) return;

    if (!isSignedIn) {
      setAuthDialogAction("vote");
      setShowAuthDialog(true);
      return;
    }

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

  const mainContentContainerClass = viewMode === "vibe" ? "flex-grow" : "w-full";
  const rightSidebarClass = "w-80 flex-shrink-0 space-y-6 hidden lg:block";

  return (
    <div className={`flex ${viewMode === "vibe" ? "flex-row gap-6" : "flex-col"}`}>
      <div className={mainContentContainerClass}>
        <div className="space-y-8">
          <div className={containerClass}>
            {stories.map((story) => (
              <article
                key={story._id}
                className={`flex ${viewMode === "grid" ? "flex-col bg-white rounded-lg p-4 border border-[#D8E1EC]" : viewMode === "vibe" ? "flex-col md:flex-row items-start" : "flex-row bg-white rounded-lg p-4 border border-[#D8E1EC]"} gap-4`}>
                {viewMode !== "grid" && (
                  <div
                    className={`flex ${
                      viewMode === "vibe"
                        ? "flex-col items-center w-[70px] flex-shrink-0"
                        : "flex-col items-center min-w-[40px] pt-1"
                    }`}>
                    {viewMode === "vibe" ? (
                      <div className="flex flex-col items-center w-full">
                        <div className="bg-gradient-to-b from-[#FBF5DB] to-[#FAF9F1] rounded-t-md w-full h-[62px] flex flex-col items-center justify-center text-lg border border border-[#D8E1EC] font-normal text-[#292929] mb-[0px]">
                          <span className="font-alfa-slab-one">{story.votes}</span>
                          <div className="text-xs">Vibes</div>
                        </div>
                        <button
                          onClick={() => handleVote(story._id)}
                          className="bg-white border border-t-0 border-[#D5D3D0] text-[#292929] hover:bg-[#FBF5DB] w-full rounded-b-md py-1 px-2 flex items-center justify-center gap-1 text-sm font-normal h-[24px]">
                          Vibe it
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleVote(story._id)}
                          className="text-[#292929] hover:bg-[#FBF5DB] p-1 rounded">
                          <ChevronUp className="w-5 h-5" />
                        </button>
                        <span className="text-[#292929] font-medium text-sm">{story.votes}</span>
                      </>
                    )}
                  </div>
                )}

                {/* THUMBNAIL - Vibe view only */}
                {viewMode === "vibe" && story.screenshotUrl && (
                  <Link
                    to={`/s/${story.slug}`}
                    className="w-full md:w-[195px] md:flex-shrink-0 aspect-video block overflow-hidden rounded-md">
                    <img
                      src={story.screenshotUrl}
                      alt={`${story.title} thumbnail`}
                      className="w-full h-full object-cover border border-[#D8E1EC]"
                      loading="lazy"
                    />
                  </Link>
                )}

                {/* STORY CONTENT - Apply bg/border/padding here for vibe mode */}
                <div
                  className={`flex-1 min-w-0 ${viewMode === "vibe" ? "bg-white rounded-lg p-3.5 border border-[#D8E1EC]" : ""}`}>
                  {story.customMessage && (
                    <div className="mb-4 text-sm text-[#ffffff] bg-[#292929] border border-[#D8E1EC] rounded-md p-3 italic">
                      {story.customMessage}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    {story.isPinned && (
                      <Pin
                        className="w-4 h-4 text-[#787671] flex-shrink-0"
                        aria-label="Pinned Story"
                      />
                    )}
                    {viewMode === "grid" && (
                      <>
                        <button
                          onClick={() => handleVote(story._id)}
                          className="text-[#292929] hover:bg-[#FBF5DB] p-1 rounded">
                          <ChevronUp className="w-5 h-5" />
                        </button>
                        <span className="text-[#292929] font-medium text-sm">{story.votes}</span>
                      </>
                    )}
                    <h2 className="text-[#292929] font-bold truncate">
                      <Link to={`/s/${story.slug}`} className="hover:text-[#292929] break-words">
                        {story.title}
                      </Link>
                    </h2>
                  </div>
                  {viewMode === "vibe" && (
                    <p className="text-[#000000] text-[14px] leading-[20px] mb-1 line-clamp-2">
                      {story.description}
                    </p>
                  )}
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
                    <p className="text-[#000000] text-[14px] leading-[20px] mb-2 line-clamp-3">
                      {story.description}
                    </p>
                  )}

                  {/* Tags */}
                  {story.tags && story.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {story.tags.map((tag) => (
                        <Link
                          key={tag._id}
                          to={`/tag/${tag.slug}`}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: tag.backgroundColor || "#F4F0ED",
                            color: tag.textColor || "#525252",
                            border: `1px solid ${tag.backgroundColor ? "transparent" : "#D5D3D0"}`,
                          }}
                          title={`View all apps tagged with ${tag.name}`}>
                          {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
                          {tag.iconUrl && !tag.emoji && (
                            <img
                              src={tag.iconUrl}
                              alt=""
                              className="w-3 h-3 mr-1 rounded-sm object-cover"
                            />
                          )}
                          {tag.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-[#545454] flex-wrap">
                    {story.authorUsername ? (
                      <Link
                        to={`/${story.authorUsername}`}
                        className="hover:text-[#525252] hover:underline">
                        by {story.submitterName || story.authorName || story.authorUsername}
                      </Link>
                    ) : (
                      <span>by {story.submitterName || story.authorName || "Anonymous User"}</span>
                    )}
                    <span>{formatDate(story._creationTime)}</span>
                    <Link
                      to={`/s/${story.slug}#comments`}
                      className="flex items-center gap-2 hover:text-[#525252]">
                      <MessageSquare className="w-4 h-4" />
                      {story.commentCount}
                    </Link>
                    <BookmarkButton
                      storyId={story._id}
                      onAuthRequired={() => {
                        setAuthDialogAction("bookmark");
                        setShowAuthDialog(true);
                      }}
                    />
                    {story.githubUrl && (
                      <a
                        href={story.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[#545454] hover:text-[#525252]"
                        title="View GitHub Repo">
                        <Github className="w-4 h-4" />
                        <span>Repo</span>
                      </a>
                    )}
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
            <div className="text-center mt-8 text-[#545454]"></div>
          )}
        </div>
      </div>

      {/* {viewMode === "vibe" && (
        <aside className={rightSidebarClass}>
          <WeeklyLeaderboard />
          <TopCategoriesOfWeek />
        </aside>
      )} */}

      {/* Auth Required Dialog */}
      <AuthRequiredDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        action={authDialogAction}
      />
    </div>
  );
}
