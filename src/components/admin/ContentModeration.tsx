import React, { useState, useMemo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Check, X, Eye, EyeOff, Trash2, Search, Pin, Send } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { StoryWithDetails } from "../../../convex/stories";
import { Doc } from "../../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { debounce } from "lodash-es";

type Comment = Doc<"comments">;

type ModeratableItem = (StoryWithDetails & { type: "story" }) | (Comment & { type: "comment" });

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "hidden";

export function ContentModeration() {
  const [activeItemType, setActiveItemType] = useState<"submissions" | "comments">("submissions");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // State for custom message editing - Commented out
  const [editingMessageId, setEditingMessageId] = useState<Id<"stories"> | null>(null);
  const [currentMessage, setCurrentMessage] = useState("");

  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSetSearch(value);
  };

  const filters = useMemo(() => {
    const convexFilters: any = {};
    if (statusFilter === "hidden") {
      convexFilters.isHidden = true;
    } else if (statusFilter !== "all") {
      convexFilters.status = statusFilter;
      convexFilters.isHidden = false; // Explicitly set to false for non-hidden, non-all filters
    } else {
      // For 'all', explicitly set isHidden to undefined
      convexFilters.isHidden = undefined;
    }
    return convexFilters;
  }, [statusFilter]);

  const {
    results: stories,
    status: storiesStatus,
    loadMore: loadMoreStories,
  } = usePaginatedQuery(
    api.stories.listAllStoriesAdmin,
    {
      filters: filters,
      searchTerm: debouncedSearchTerm || undefined,
    },
    { initialNumItems: 10 }
  );

  const {
    results: comments,
    status: commentsStatus,
    loadMore: loadMoreComments,
  } = usePaginatedQuery(
    api.comments.listAllCommentsAdmin,
    {
      filters: filters, // Assuming comments don't have search yet
    },
    { initialNumItems: 10 }
  );

  // Story Mutations
  const approveStory = useMutation(api.stories.updateStatus);
  const rejectStory = useMutation(api.stories.updateStatus);
  const hideStory = useMutation(api.stories.hideStory);
  const showStory = useMutation(api.stories.showStory);
  const deleteStory = useMutation(api.stories.deleteStory);
  const updateCustomMessage = useMutation(api.stories.updateStoryCustomMessage);
  const togglePin = useMutation(api.stories.toggleStoryPinStatus);

  // Comment Mutations
  const approveComment = useMutation(api.comments.updateStatus);
  const rejectComment = useMutation(api.comments.updateStatus);
  const hideComment = useMutation(api.comments.hideComment);
  const showComment = useMutation(api.comments.showComment);
  const deleteComment = useMutation(api.comments.deleteComment);

  const handleAction = (
    action: "approve" | "reject" | "hide" | "show" | "delete" | "togglePin",
    item: ModeratableItem
  ) => {
    if (item.type === "story") {
      const storyId = item._id as Id<"stories">;
      switch (action) {
        case "approve":
          approveStory({ storyId, status: "approved" });
          break;
        case "reject":
          rejectStory({ storyId, status: "rejected" });
          break;
        case "hide":
          hideStory({ storyId });
          break;
        case "show":
          showStory({ storyId });
          break;
        case "delete":
          if (window.confirm("Delete story? This cannot be undone.")) deleteStory({ storyId });
          break;
        case "togglePin":
          togglePin({ storyId });
          break;
      }
    } else {
      // Comment actions
      const commentId = item._id as Id<"comments">;
      switch (action) {
        case "approve":
          approveComment({ commentId, status: "approved" });
          break;
        case "reject":
          rejectComment({ commentId, status: "rejected" });
          break;
        case "hide":
          hideComment({ commentId });
          break;
        case "show":
          showComment({ commentId });
          break;
        case "delete":
          if (window.confirm("Delete comment? This cannot be undone."))
            deleteComment({ commentId });
          break;
      }
    }
  };

  // Handlers for custom message editing - Commented out
  const handleEditMessage = (item: StoryWithDetails) => {
    setEditingMessageId(item._id);
    setCurrentMessage(item.customMessage || "");
  };
  const handleCancelEditMessage = () => {
    setEditingMessageId(null);
    setCurrentMessage("");
  };
  const handleSaveMessage = (storyId: Id<"stories">) => {
    updateCustomMessage({ storyId, customMessage: currentMessage || undefined });
    handleCancelEditMessage(); // Close editor on save
  };

  const isLoading = storiesStatus === "LoadingFirstPage" || commentsStatus === "LoadingFirstPage";

  const renderItem = (item: ModeratableItem) => {
    // Commented out editing state logic
    const isEditing = item.type === "story" && editingMessageId === item._id;
    // const isEditing = false; // Temporarily set to false as editing is disabled

    return (
      <div key={item._id} className="border-b border-[#F4F0ED] py-4 last:border-b-0">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {item.type === "story" && item.isPinned && (
                <Pin className="w-4 h-4 text-blue-600 flex-shrink-0" aria-label="Pinned" />
              )}
              {item.type === "story" && (
                <Link
                  to={`/s/${item.slug}`}
                  target="_blank"
                  className="font-medium text-[#525252] hover:text-[#2A2825] block truncate">
                  {item.title}
                </Link>
              )}
            </div>
            <p
              className={`text-sm ${item.type === "comment" ? "text-[#525252]" : "text-[#787672]"} mt-1 break-words`}>
              {item.type === "story" ? item.description : item.content}
            </p>
            {/* Always show custom message if present, as editing is disabled */}
            {item.type === "story" && item.customMessage && (
              <div className="mt-2 text-sm text-[#787671] bg-[#F3F0ED] border border-[#D5D3D0] rounded-md p-2 italic">
                Admin Message: {item.customMessage}
              </div>
            )}
            {/* Custom Message Editor - Commented out until Textarea is added */}
            {item.type === "story" && isEditing && (
              <div className="mt-3 space-y-2">
                <Textarea // This is the component causing the error if not installed
                  placeholder="Add a custom message to display on the frontend..."
                  value={currentMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCurrentMessage(e.target.value)
                  }
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={handleCancelEditMessage}>
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSaveMessage(item._id as Id<"stories">)}>
                    Save Message
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[#787672]">
              <span>by {item.type === "story" ? item.name : item.author}</span>
              {item.type === "story" && item.email && (
                <span className="text-gray-400">({item.email})</span>
              )}
              <span>{formatDistanceToNow(item._creationTime)} ago</span>
              {item.type === "story" && (
                <>
                  <span>{item.votes} votes</span>
                  <Link to={`/s/${item.slug}#comments`} target="_blank" className="hover:underline">
                    ({item.commentCount ?? 0} comments)
                  </Link>
                </>
              )}
              {item.type === "comment" && <span>(Comment on Story id: {item.storyId})</span>}
              <span
                className={`font-semibold ${
                  item.isHidden
                    ? "text-orange-600"
                    : item.status === "pending"
                      ? "text-blue-600"
                      : item.status === "rejected"
                        ? "text-red-600"
                        : "text-green-600"
                }`}>
                {item.isHidden
                  ? "Hidden"
                  : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </span>
            </div>
            {item.type === "story" && item.tags?.length > 0 && (
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
          <div className="flex flex-wrap gap-2 items-center flex-shrink-0">
            {/* Standard Actions */}
            {item.status === "pending" && (
              <>
                {/* Use standard variants + classes for styling */}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  onClick={() => handleAction("approve", item)}>
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  onClick={() => handleAction("reject", item)}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </>
            )}
            {item.isHidden ? (
              <Button
                variant="outline"
                size="sm"
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                onClick={() => handleAction("show", item)}>
                <Eye className="w-4 h-4 mr-1" /> Show
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                onClick={() => handleAction("hide", item)}>
                <EyeOff className="w-4 h-4 mr-1" /> Hide
              </Button>
            )}

            {/* Story Specific Actions */}
            {item.type === "story" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${item.isPinned ? "text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100" : "text-gray-600 hover:bg-gray-50"}`}
                  onClick={() => handleAction("togglePin", item)}>
                  <Pin className="w-4 h-4 mr-1" /> {item.isPinned ? "Unpin" : "Pin"}
                </Button>
                {/* Commenting out Add Message button until Textarea is added */}
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditMessage(item as StoryWithDetails)}>
                    <MessageSquare className="w-4 h-4 mr-1" /> Add Message
                  </Button>
                )}
              </>
            )}

            {/* Delete Action (Common) - Use standard variant + classes */}
            <Button
              variant="outline"
              size="sm"
              className="text-red-700 hover:bg-red-50 hover:text-red-800 border-red-200"
              onClick={() => handleAction("delete", item)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const itemsToRender: ModeratableItem[] = useMemo(() => {
    if (activeItemType === "submissions") {
      return (stories || []).map((story) => ({ ...story, type: "story" as const }));
    } else {
      return (comments || []).map((comment) => ({ ...comment, type: "comment" as const }));
    }
  }, [activeItemType, stories, comments]);

  const currentStatus = activeItemType === "submissions" ? storiesStatus : commentsStatus;
  const loadMore = activeItemType === "submissions" ? loadMoreStories : loadMoreComments;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-medium text-[#525252] mb-6">Content Moderation</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Select value={activeItemType} onValueChange={(v: string) => setActiveItemType(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submissions">Submissions</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v: string) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (Visible & Hidden)</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="hidden">Hidden Only</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="search"
              placeholder={`Search ${activeItemType}...`}
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
              disabled={activeItemType === "comments"} // Assuming comments search not implemented
            />
            {activeItemType === "comments" && (
              <span className="text-xs text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2">
                (Search N/A)
              </span>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-6 text-lg font-medium text-[#787672]">Loading...</div>
        )}

        {!isLoading && itemsToRender.length === 0 && (
          <div className="text-center py-10 text-[#787672]">
            No {activeItemType} found matching the criteria.
          </div>
        )}

        {!isLoading && itemsToRender.length > 0 && (
          <div>
            {" "}
            {/* Removed redundant divide-y */}
            {itemsToRender.map((item) => renderItem(item))}
          </div>
        )}

        {currentStatus === "CanLoadMore" && (
          <div className="text-center mt-6">
            <Button variant="outline" onClick={() => loadMore(10)}>
              Load More {activeItemType}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
