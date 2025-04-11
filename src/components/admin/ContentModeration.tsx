import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Flag, Check, X, Eye, EyeOff, Trash2 } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { Story, Comment } from "../../types"; // Use our defined types
import { Link } from "react-router-dom";

// Define combined type or handle separately
type ModeratableItem = (Story & { type: "story" }) | (Comment & { type: "comment" });

export function ContentModeration() {
  const [activeTab, setActiveTab] = useState<"submissions" | "comments">("submissions");

  // Fetch pending stories
  const {
    results: pendingStories,
    status: storiesStatus,
    loadMore: loadMoreStories,
  } = usePaginatedQuery(api.stories.listPending, {}, { initialNumItems: 10 });

  // Fetch pending comments (needs a similar query, e.g., listAllPendingComments)
  // For now, let's assume a query exists: api.comments.listAllPending
  // const { results: pendingComments, status: commentsStatus, loadMore: loadMoreComments } =
  //     usePaginatedQuery(api.comments.listAllPending, {}, { initialNumItems: 10 });
  // Placeholder until listAllPending is created:
  const pendingComments: Comment[] = [];
  const commentsStatus = "Exhausted";
  const loadMoreComments = () => {};

  const approveStory = useMutation(api.stories.updateStatus);
  const rejectStory = useMutation(api.stories.updateStatus);
  const approveComment = useMutation(api.comments.updateStatus);
  const rejectComment = useMutation(api.comments.updateStatus);
  // TODO: Add delete mutations if needed (hard delete vs. reject status)

  const handleApprove = (item: ModeratableItem) => {
    if (item.type === "story") {
      approveStory({ storyId: item._id, status: "approved" });
    } else {
      approveComment({ commentId: item._id, status: "approved" });
    }
  };

  const handleReject = (item: ModeratableItem) => {
    if (item.type === "story") {
      rejectStory({ storyId: item._id, status: "rejected" });
    } else {
      rejectComment({ commentId: item._id, status: "rejected" });
    }
  };

  const isLoading = storiesStatus === "LoadingFirstPage" || commentsStatus === "LoadingFirstPage";

  const renderItem = (item: ModeratableItem) => (
    <div key={item._id} className="border-b border-[#F4F0ED] pb-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {item.type === "story" && (
            <Link
              to={`/s/${item.slug}`}
              className="font-medium text-[#525252] hover:text-[#2A2825] block mb-1">
              {item.title}
            </Link>
          )}
          <p
            className={`text-sm ${item.type === "comment" ? "text-[#525252]" : "text-[#787672]"} mt-1`}>
            {item.type === "story" ? item.description : item.content}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-[#787672]">
            <span>by {item.type === "story" ? item.name : item.author}</span>
            {item.type === "story" && item.email && (
              <span className="text-gray-400">({item.email})</span>
            )}
            <span>{formatDistanceToNow(item._creationTime)} ago</span>
            {item.type === "story" && (
              <>
                <span>{item.votes} votes</span>
                <span>({item.commentCount} comments)</span>
              </>
            )}
            {item.type === "comment" && <span>(Comment)</span>}
            {/* Optional: Link to parent story for comments */}
            {item.type === "comment" && item.storyId && (
              <Link to={`/s/${item.storyId}`} className="hover:underline">
                View Story
              </Link>
            )}
          </div>
          {item.type === "story" && item.tags && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {item.tags.map((tag) => (
                <span
                  key={tag._id}
                  className="text-xs text-[#787672] bg-[#F4F0ED] px-2 py-0.5 rounded">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
          <button
            onClick={() => handleApprove(item)}
            className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-sm flex items-center gap-1"
            title="Approve">
            <Check className="w-4 h-4" /> Approve
          </button>
          <button
            onClick={() => handleReject(item)}
            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm flex items-center gap-1"
            title="Reject">
            <X className="w-4 h-4" /> Reject
          </button>
          {/* Add delete button if hard delete is desired */}
          {/* <button
                        // onClick={() => handleDelete(item)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete Permanently"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button> */}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-medium text-[#525252] mb-6">Content Moderation Queue</h2>

        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="space-y-6">
          <Tabs.List className="flex gap-4 border-b border-[#F4F0ED] mb-6">
            <Tabs.Trigger
              value="submissions"
              className="px-4 py-2 text-sm text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:font-medium data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]">
              Pending Submissions ({pendingStories?.length ?? "?"})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="comments"
              className="px-4 py-2 text-sm text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:font-medium data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]">
              Pending Comments ({pendingComments?.length ?? "?"})
            </Tabs.Trigger>
          </Tabs.List>

          {isLoading && <div className="text-center py-4">Loading...</div>}

          <Tabs.Content value="submissions">
            {storiesStatus !== "LoadingFirstPage" && pendingStories?.length === 0 && (
              <div className="text-center py-4 text-[#787672]">No pending submissions.</div>
            )}
            {pendingStories?.map((story) => renderItem({ ...story, type: "story" }))}
            {storiesStatus === "CanLoadMore" && (
              <div className="text-center mt-4">
                <button
                  onClick={() => loadMoreStories(10)}
                  className="text-sm text-[#525252] hover:underline">
                  Load More Submissions
                </button>
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content value="comments">
            {commentsStatus !== "LoadingFirstPage" && pendingComments?.length === 0 && (
              <div className="text-center py-4 text-[#787672]">No pending comments.</div>
            )}
            {pendingComments?.map((comment) => renderItem({ ...comment, type: "comment" }))}
            {commentsStatus === "CanLoadMore" && (
              <div className="text-center mt-4">
                <button
                  onClick={() => loadMoreComments(10)}
                  className="text-sm text-[#525252] hover:underline">
                  Load More Comments
                </button>
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
