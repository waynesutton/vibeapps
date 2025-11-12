import React, { useState, useMemo, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  MessageSquare,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2,
  Search,
  Pin,
  Send,
  Tag,
  Plus,
  Scale,
  Lock,
  CheckCircle,
  PlayCircle,
  FileX,
  User,
  Edit,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  usePaginatedQuery,
  useMutation,
  useConvexAuth,
  useQuery,
} from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { StoryWithDetails } from "../../../convex/stories";
import { Doc } from "../../../convex/_generated/dataModel";
import { Link, useNavigate } from "react-router-dom";
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
import { toast } from "sonner";
import { useDialog } from "@/hooks/useDialog";

type Comment = Doc<"comments"> & {
  authorName?: string;
  authorUsername?: string;
};

type ModeratableItem =
  | (StoryWithDetails & { type: "story" })
  | (Comment & { type: "comment" });

type StatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "hidden"
  | "archived";

export function ContentModeration() {
  const navigate = useNavigate();
  const { showMessage, showConfirm, DialogComponents } = useDialog();
  const [activeItemType, setActiveItemType] = useState<
    "submissions" | "comments"
  >("submissions");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // Date range filtering
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  // Advanced filters
  const [hasMessage, setHasMessage] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [wasPinned, setWasPinned] = useState(false);
  const [selectedJudgingGroupIdFilter, setSelectedJudgingGroupIdFilter] =
    useState<Id<"judgingGroups"> | null>(null);
  // State for custom message editing - Commented out
  const [editingMessageId, setEditingMessageId] =
    useState<Id<"stories"> | null>(null);
  const [currentMessage, setCurrentMessage] = useState("");
  // State for tag management
  const [showTagSelector, setShowTagSelector] = useState<Id<"stories"> | null>(
    null,
  );
  const [selectedTagId, setSelectedTagId] = useState<Id<"tags"> | null>(null);
  // State for judging group management
  const [showJudgingGroupSelector, setShowJudgingGroupSelector] =
    useState<Id<"stories"> | null>(null);
  const [selectedJudgingGroupId, setSelectedJudgingGroupId] =
    useState<Id<"judgingGroups"> | null>(null);

  // State for tag filtering
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
  const [tagSearchTerm, setTagSearchTerm] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // State for inline editing
  const [editingStoryId, setEditingStoryId] = useState<Id<"stories"> | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    longDescription: "",
    submitterName: "",
    url: "",
    videoUrl: "",
    email: "",
    linkedinUrl: "",
    twitterUrl: "",
    githubUrl: "",
    chefShowUrl: "",
    chefAppUrl: "",
    teamName: "",
    teamMemberCount: 1,
    additionalImageIds: undefined as Id<"_storage">[] | undefined,
    removeAdditionalImages: false,
  });
  const [editSelectedTagIds, setEditSelectedTagIds] = useState<Id<"tags">[]>(
    [],
  );
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [newScreenshotFile, setNewScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const [removeScreenshot, setRemoveScreenshot] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    Array<{ name: string; email: string }>
  >([]);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] =
    useState<Id<"comments"> | null>(null);

  // Bulk selection state (only for submissions)
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<Id<"stories">>>(
    new Set(),
  );
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<
    "tag" | "removeTag" | "judging" | null
  >(null);
  const [bulkSelectedTagId, setBulkSelectedTagId] = useState<Id<"tags"> | null>(
    null,
  );
  const [bulkRemoveTagId, setBulkRemoveTagId] = useState<Id<"tags"> | null>(
    null,
  );
  const [bulkSelectedJudgingGroupId, setBulkSelectedJudgingGroupId] =
    useState<Id<"judgingGroups"> | null>(null);

  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
    }, 300),
    [],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSetSearch(value);
  };

  const storyFilters = useMemo(() => {
    const convexFilters: any = {};

    // Handle archive filter - only set when explicitly viewing archived
    if (statusFilter === "archived") {
      convexFilters.isArchived = true;
    } else {
      // For all other views, don't filter on isArchived
      // This allows submissions without isArchived field to appear
      if (statusFilter === "hidden") {
        convexFilters.isHidden = true;
      } else if (statusFilter !== "all") {
        convexFilters.status = statusFilter;
        convexFilters.isHidden = false;
      } else {
        // For 'all', explicitly set isHidden to undefined
        convexFilters.isHidden = undefined;
      }
    }

    // Add tag filtering for stories
    if (selectedTagIds.length > 0) {
      convexFilters.tagIds = selectedTagIds;
    }

    // Add date range filtering
    if (startDate) {
      convexFilters.startDate = new Date(startDate).getTime();
    }
    if (endDate) {
      // Set end date to end of day (23:59:59.999)
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      convexFilters.endDate = endDateTime.getTime();
    }

    // Add advanced filters
    if (hasMessage) {
      convexFilters.hasMessage = true;
    }
    if (isPinned) {
      convexFilters.isPinned = true;
    }
    if (wasPinned) {
      convexFilters.wasPinned = true;
    }
    if (selectedJudgingGroupIdFilter) {
      convexFilters.judgingGroupId = selectedJudgingGroupIdFilter;
    }

    return convexFilters;
  }, [
    statusFilter,
    selectedTagIds,
    startDate,
    endDate,
    hasMessage,
    isPinned,
    wasPinned,
    selectedJudgingGroupIdFilter,
  ]);

  const commentFilters = useMemo(() => {
    const convexFilters: any = {};

    // Comments don't support "archived" filter - that's only for stories
    if (statusFilter === "archived") {
      // Don't set any status filter for comments when viewing archived
      // (comments don't have isArchived field)
    } else if (statusFilter === "hidden") {
      convexFilters.isHidden = true;
    } else if (statusFilter !== "all") {
      convexFilters.status = statusFilter;
      convexFilters.isHidden = false; // Explicitly set to false for non-hidden, non-all filters
    } else {
      // For 'all', explicitly set isHidden to undefined
      convexFilters.isHidden = undefined;
    }

    // Comments don't have tag filtering - no tagIds field

    // Add date range filtering
    if (startDate) {
      convexFilters.startDate = new Date(startDate).getTime();
    }
    if (endDate) {
      // Set end date to end of day (23:59:59.999)
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      convexFilters.endDate = endDateTime.getTime();
    }

    return convexFilters;
  }, [statusFilter, selectedTagIds, startDate, endDate]);

  const {
    results: stories,
    status: storiesStatus,
    loadMore: loadMoreStories,
  } = usePaginatedQuery(
    api.stories.listAllStoriesAdmin,
    authIsLoading || !isAuthenticated
      ? "skip"
      : {
          filters: storyFilters,
          searchTerm: debouncedSearchTerm || undefined,
        },
    { initialNumItems: 10 },
  );

  const {
    results: comments,
    status: commentsStatus,
    loadMore: loadMoreComments,
  } = usePaginatedQuery(
    api.comments.listAllCommentsAdmin,
    authIsLoading || !isAuthenticated
      ? "skip"
      : {
          filters: commentFilters, // Comments use separate filters without tagIds
        },
    { initialNumItems: 10 },
  );

  // Story Mutations
  const approveStory = useMutation(api.stories.updateStatus);
  const rejectStory = useMutation(api.stories.updateStatus);
  const hideStory = useMutation(api.stories.hideStory);
  const showStory = useMutation(api.stories.showStory);
  const archiveStory = useMutation(api.stories.archiveStory);
  const unarchiveStory = useMutation(api.stories.unarchiveStory);
  const deleteStory = useMutation(api.stories.deleteStory);
  const updateCustomMessage = useMutation(api.stories.updateStoryCustomMessage);
  const togglePin = useMutation(api.stories.toggleStoryPinStatus);
  const addTagsToStory = useMutation(api.stories.addTagsToStory);
  const removeTagsFromStory = useMutation(api.stories.removeTagsFromStory);
  const updateStoryAdmin = useMutation(api.stories.updateStoryAdmin);

  // Judging group queries and mutations
  const judgingGroups = useQuery(
    api.judgingGroups.listGroups,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  const addSubmissionsToJudgingGroup = useMutation(
    api.judgingGroupSubmissions.addSubmissions,
  );
  const removeSubmissionFromJudgingGroup = useMutation(
    api.judgingGroupSubmissions.removeSubmission,
  );

  // Additional queries for editing
  const availableTags = useQuery(
    api.tags.listAllAdmin,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);

  // Comment Mutations
  const approveComment = useMutation(api.comments.updateStatus);
  const rejectComment = useMutation(api.comments.updateStatus);
  const hideComment = useMutation(api.comments.hideComment);
  const showComment = useMutation(api.comments.showComment);
  const deleteComment = useMutation(api.comments.deleteComment);

  const handleAction = (
    action:
      | "approve"
      | "reject"
      | "hide"
      | "show"
      | "delete"
      | "togglePin"
      | "archive"
      | "unarchive",
    item: ModeratableItem,
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
        case "archive":
          archiveStory({ storyId });
          toast.success("Story archived");
          break;
        case "unarchive":
          unarchiveStory({ storyId });
          toast.success("Story unarchived");
          break;
        case "delete":
          showConfirm(
            "Delete Story",
            "Delete story? This cannot be undone.",
            () => deleteStory({ storyId }),
            {
              confirmButtonText: "Delete",
              confirmButtonVariant: "destructive",
            }
          );
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
          setConfirmDeleteCommentId(commentId);
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
    updateCustomMessage({
      storyId,
      customMessage: currentMessage || undefined,
    });
    handleCancelEditMessage(); // Close editor on save
  };

  // Handlers for tag management
  const handleShowTagSelector = (storyId: Id<"stories">) => {
    setShowTagSelector(storyId);
    setSelectedTagId(null);
  };

  const handleCancelTagSelector = () => {
    setShowTagSelector(null);
    setSelectedTagId(null);
  };

  const handleAddTag = async (storyId: Id<"stories">) => {
    if (!selectedTagId) return;

    try {
      await addTagsToStory({ storyId, tagIdsToAdd: [selectedTagId] });
      handleCancelTagSelector();
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  // Handlers for judging group management
  const handleShowJudgingGroupSelector = (storyId: Id<"stories">) => {
    setShowJudgingGroupSelector(storyId);
    setSelectedJudgingGroupId(null);
  };

  const handleCancelJudgingGroupSelector = () => {
    setShowJudgingGroupSelector(null);
    setSelectedJudgingGroupId(null);
  };

  const handleAddToJudgingGroup = async (storyId: Id<"stories">) => {
    if (!selectedJudgingGroupId) return;

    try {
      const result = await addSubmissionsToJudgingGroup({
        groupId: selectedJudgingGroupId,
        storyIds: [storyId],
      });

      if (result.added > 0) {
        console.log(`Successfully added submission to judging group`);
      } else if (result.skipped > 0) {
        console.log(`Submission already in judging group`);
      }

      if (result.errors.length > 0) {
        console.error("Errors adding to judging group:", result.errors);
      }

      handleCancelJudgingGroupSelector();
    } catch (error) {
      console.error("Failed to add to judging group:", error);
    }
  };

  const handleRemoveFromJudgingGroup = async (
    storyId: Id<"stories">,
    groupId: Id<"judgingGroups">,
    groupName: string,
  ) => {
    showConfirm(
      "Remove Submission",
      `Remove this submission from "${groupName}"? This will also delete all associated judge scores.`,
      async () => {
        try {
          await removeSubmissionFromJudgingGroup({
            groupId,
            storyId,
          });
          console.log(`Successfully removed submission from ${groupName}`);
        } catch (error) {
          console.error("Failed to remove from judging group:", error);
        }
      },
      {
        confirmButtonText: "Remove",
        confirmButtonVariant: "destructive",
      }
    );
  };

  // Handler for edit story - show inline edit form
  const handleEditStory = (item: StoryWithDetails) => {
    setEditingStoryId(item._id);
    setEditFormData({
      title: item.title,
      description: item.description,
      longDescription: item.longDescription || "",
      submitterName: item.submitterName || "",
      url: item.url,
      videoUrl: item.videoUrl || "",
      email: item.email || "",
      linkedinUrl: item.linkedinUrl || "",
      twitterUrl: item.twitterUrl || "",
      githubUrl: item.githubUrl || "",
      chefShowUrl: item.chefShowUrl || "",
      chefAppUrl: item.chefAppUrl || "",
      teamName: (item as any).teamName || "",
      teamMemberCount: (item as any).teamMemberCount || 1,
      additionalImageIds: (item as any).additionalImageIds || undefined,
      removeAdditionalImages: false,
    });
    setTeamMembers((item as any).teamMembers || []);
    setEditSelectedTagIds(item.tagIds || []);
    setNewTagNames([]);
    setNewScreenshotFile(null);
    setScreenshotPreview(null);
    setRemoveScreenshot(false);
  };

  // Handler to cancel editing
  const handleCancelEdit = () => {
    setEditingStoryId(null);
    setEditFormData({
      title: "",
      description: "",
      longDescription: "",
      submitterName: "",
      url: "",
      videoUrl: "",
      email: "",
      linkedinUrl: "",
      twitterUrl: "",
      githubUrl: "",
      chefShowUrl: "",
      chefAppUrl: "",
      teamName: "",
      teamMemberCount: 1,
      additionalImageIds: undefined,
      removeAdditionalImages: false,
    });
    setTeamMembers([]);
    setEditSelectedTagIds([]);
    setNewTagNames([]);
    setNewScreenshotFile(null);
    setScreenshotPreview(null);
    setRemoveScreenshot(false);
  };

  // Handler to save edit
  const handleSaveEdit = async () => {
    if (!editingStoryId) return;

    try {
      // Validate required fields
      if (!editFormData.title.trim()) {
        toast.error("Title is required");
        return;
      }
      if (!editFormData.url.trim()) {
        toast.error("URL is required");
        return;
      }

      // Handle screenshot upload if there's a new file
      let screenshotStorageId: Id<"_storage"> | undefined = undefined;
      if (newScreenshotFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": newScreenshotFile.type },
          body: newScreenshotFile,
        });
        if (!result.ok) {
          throw new Error("Failed to upload screenshot");
        }
        const response = await result.json();
        screenshotStorageId = response.storageId;
      }

      // Prepare mutation arguments
      const mutationArgs: any = {
        storyId: editingStoryId,
        title: editFormData.title,
        description: editFormData.description,
        longDescription: editFormData.longDescription || undefined,
        submitterName: editFormData.submitterName || undefined,
        url: editFormData.url,
        videoUrl: editFormData.videoUrl || undefined,
        email: editFormData.email || undefined,
        linkedinUrl: editFormData.linkedinUrl || undefined,
        twitterUrl: editFormData.twitterUrl || undefined,
        githubUrl: editFormData.githubUrl || undefined,
        chefShowUrl: editFormData.chefShowUrl || undefined,
        chefAppUrl: editFormData.chefAppUrl || undefined,
        teamName: editFormData.teamName || undefined,
        teamMemberCount: editFormData.teamMemberCount || undefined,
        teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
        tagIds: editSelectedTagIds.length > 0 ? editSelectedTagIds : undefined,
        newTagNames: newTagNames.length > 0 ? newTagNames : undefined,
        additionalImageIds: editFormData.additionalImageIds,
        removeAdditionalImages: editFormData.removeAdditionalImages,
      };

      // Handle screenshot update explicitly
      if (removeScreenshot && !newScreenshotFile) {
        // Only removing, no new upload
        mutationArgs.removeScreenshot = true;
      } else if (newScreenshotFile) {
        // New upload (may or may not be replacing)
        mutationArgs.screenshotId = screenshotStorageId;
      }

      await updateStoryAdmin(mutationArgs);

      handleCancelEdit();
      toast.success("Story updated successfully!");
    } catch (error) {
      console.error("Failed to update story:", error);
      toast.error("Failed to update story");
    }
  };

  // Tag management helpers
  const toggleTag = (tagId: Id<"tags">) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // Tag management helpers for inline editing
  const toggleEditTag = (tagId: Id<"tags">) => {
    setEditSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleAddNewTag = () => {
    const newTag = prompt("Enter new tag name:");
    if (newTag && newTag.trim()) {
      const trimmedTag = newTag.trim();
      if (!newTagNames.includes(trimmedTag)) {
        setNewTagNames((prev) => [...prev, trimmedTag]);
      }
    }
  };

  const handleRemoveNewTag = (tagName: string) => {
    setNewTagNames((prev) => prev.filter((name) => name !== tagName));
  };

  // File upload handlers
  const handleScreenshotFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewScreenshotFile(file);
      setRemoveScreenshot(false);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => setScreenshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveScreenshot = () => {
    setNewScreenshotFile(null);
    setScreenshotPreview(null);
    setRemoveScreenshot(true);
  };

  const handleKeepCurrentScreenshot = () => {
    setNewScreenshotFile(null);
    setScreenshotPreview(null);
    setRemoveScreenshot(false);
  };

  // Combined loading state: check auth loading first, then query loading
  const uiIsLoading =
    authIsLoading ||
    storiesStatus === "LoadingFirstPage" ||
    commentsStatus === "LoadingFirstPage";

  // Close tag dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".tag-search-container")) {
        setShowTagDropdown(false);
      }
    };

    if (showTagDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTagDropdown]);

  // Clear tag filters when switching to comments
  React.useEffect(() => {
    if (activeItemType === "comments") {
      setSelectedTagIds([]);
      setTagSearchTerm("");
      setShowTagDropdown(false);
      // Also clear bulk selections when switching away from submissions
      setSelectedStoryIds(new Set());
      setShowBulkActions(false);
      setBulkActionType(null);
      // Clear advanced filters when switching away from submissions
      setHasMessage(false);
      setIsPinned(false);
      setWasPinned(false);
      setSelectedJudgingGroupIdFilter(null);
    }
  }, [activeItemType]);

  // Update bulk actions visibility when selection changes
  React.useEffect(() => {
    setShowBulkActions(selectedStoryIds.size > 0);
  }, [selectedStoryIds]);

  // Bulk selection handlers
  const toggleStorySelection = (storyId: Id<"stories">) => {
    setSelectedStoryIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStoryIds.size === itemsToRender.length) {
      // Deselect all
      setSelectedStoryIds(new Set());
    } else {
      // Select all visible stories
      const allStoryIds = itemsToRender
        .filter((item) => item.type === "story")
        .map((item) => item._id as Id<"stories">);
      setSelectedStoryIds(new Set(allStoryIds));
    }
  };

  const clearSelections = () => {
    setSelectedStoryIds(new Set());
    setBulkActionType(null);
    setBulkSelectedTagId(null);
    setBulkRemoveTagId(null);
    setBulkSelectedJudgingGroupId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedStoryIds.size === 0) return;

    showConfirm(
      "Bulk Delete Submissions",
      `Delete ${selectedStoryIds.size} submissions? This cannot be undone.`,
      async () => {
        try {
          const deletePromises = Array.from(selectedStoryIds).map((storyId) =>
            deleteStory({ storyId }),
          );
          await Promise.all(deletePromises);
          toast.success(`Deleted ${selectedStoryIds.size} submissions`);
          clearSelections();
        } catch (error) {
          console.error("Failed to delete submissions:", error);
          toast.error("Failed to delete some submissions");
        }
      },
      {
        confirmButtonText: "Delete",
        confirmButtonVariant: "destructive",
      }
    );
  };

  const handleBulkAddTag = async () => {
    if (selectedStoryIds.size === 0 || !bulkSelectedTagId) return;

    try {
      const addTagPromises = Array.from(selectedStoryIds).map((storyId) =>
        addTagsToStory({ storyId, tagIdsToAdd: [bulkSelectedTagId] }),
      );
      await Promise.all(addTagPromises);
      toast.success(`Added tag to ${selectedStoryIds.size} submissions`);
      clearSelections();
      setBulkActionType(null);
    } catch (error) {
      console.error("Failed to add tags:", error);
      toast.error("Failed to add tag to some submissions");
    }
  };

  const handleBulkRemoveTag = async () => {
    if (selectedStoryIds.size === 0 || !bulkRemoveTagId) return;

    try {
      const removeTagPromises = Array.from(selectedStoryIds).map((storyId) =>
        removeTagsFromStory({ storyId, tagIdsToRemove: [bulkRemoveTagId] }),
      );
      await Promise.all(removeTagPromises);
      toast.success(`Removed tag from ${selectedStoryIds.size} submissions`);
      clearSelections();
      setBulkActionType(null);
    } catch (error) {
      console.error("Failed to remove tags:", error);
      toast.error("Failed to remove tag from some submissions");
    }
  };

  const handleBulkAddToJudgingGroup = async () => {
    if (selectedStoryIds.size === 0 || !bulkSelectedJudgingGroupId) return;

    try {
      const result = await addSubmissionsToJudgingGroup({
        groupId: bulkSelectedJudgingGroupId,
        storyIds: Array.from(selectedStoryIds),
      });

      toast.success(
        `Added ${result.added} submissions to judging group${result.skipped > 0 ? ` (${result.skipped} already in group)` : ""}`,
      );

      if (result.errors.length > 0) {
        console.error("Errors adding to judging group:", result.errors);
      }

      clearSelections();
      setBulkActionType(null);
    } catch (error) {
      console.error("Failed to add to judging group:", error);
      toast.error("Failed to add submissions to judging group");
    }
  };

  if (authIsLoading) {
    return <div className="p-4">Loading authentication...</div>;
  }

  const renderItem = (item: ModeratableItem) => {
    // Commented out editing state logic
    const isEditing = item.type === "story" && editingMessageId === item._id;
    // const isEditing = false; // Temporarily set to false as editing is disabled
    const isSelected =
      item.type === "story" && selectedStoryIds.has(item._id as Id<"stories">);

    return (
      <div
        key={item._id}
        className={`border-b border-[#F4F0ED] py-4 last:border-b-0 transition-colors ${
          isSelected ? "bg-blue-50" : ""
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          {/* Checkbox for bulk selection (only for submissions) */}
          {item.type === "story" && activeItemType === "submissions" && (
            <div className="flex-shrink-0 pt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleStorySelection(item._id as Id<"stories">)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                aria-label="Select submission"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {item.type === "story" && item.isPinned && (
                <Pin
                  className="w-4 h-4 text-blue-600 flex-shrink-0"
                  aria-label="Pinned"
                />
              )}
              {item.type === "story" && (
                <Link
                  to={`/s/${item.slug}`}
                  target="_blank"
                  className="font-medium text-[#525252] hover:text-[#292929] block truncate"
                >
                  {item.title}
                </Link>
              )}
            </div>
            {/* Comprehensive Inline Edit Form */}
            {item.type === "story" && editingStoryId === item._id ? (
              <div className="mt-3 space-y-4 p-4 bg-[#F2F4F7] rounded-lg border">
                {/* Basic Information */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <Input
                        value={editFormData.title}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Story title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL *
                      </label>
                      <Input
                        value={editFormData.url}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            url: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <Input
                        value={editFormData.description}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Short description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Submitter Name
                      </label>
                      <Input
                        value={editFormData.submitterName}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            submitterName: e.target.value,
                          }))
                        }
                        placeholder="Submitter name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Video URL
                      </label>
                      <Input
                        value={editFormData.videoUrl}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            videoUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <Input
                        value={editFormData.email}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="contact@example.com"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Long Description
                    </label>
                    <Textarea
                      value={editFormData.longDescription}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          longDescription: e.target.value,
                        }))
                      }
                      placeholder="Detailed description"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Social Links */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Social & Project Links
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        LinkedIn URL
                      </label>
                      <Input
                        value={editFormData.linkedinUrl}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            linkedinUrl: e.target.value,
                          }))
                        }
                        placeholder="https://linkedin.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Twitter/X URL
                      </label>
                      <Input
                        value={editFormData.twitterUrl}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            twitterUrl: e.target.value,
                          }))
                        }
                        placeholder="https://twitter.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GitHub URL
                      </label>
                      <Input
                        value={editFormData.githubUrl}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            githubUrl: e.target.value,
                          }))
                        }
                        placeholder="https://github.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Chef Show URL
                      </label>
                      <Input
                        value={editFormData.chefShowUrl}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            chefShowUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Chef App URL
                      </label>
                      <Input
                        value={editFormData.chefAppUrl}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            chefAppUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                {/* Team Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Team Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Team Name
                      </label>
                      <Input
                        value={editFormData.teamName}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            teamName: e.target.value,
                          }))
                        }
                        placeholder="Enter team name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Team Member Count
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={editFormData.teamMemberCount}
                        onChange={(e) => {
                          const count = parseInt(e.target.value) || 1;
                          setEditFormData((prev) => ({
                            ...prev,
                            teamMemberCount: count,
                          }));
                          // Adjust team members array
                          const newMembers = [...teamMembers];
                          while (newMembers.length < count) {
                            newMembers.push({ name: "", email: "" });
                          }
                          if (newMembers.length > count) {
                            newMembers.splice(count);
                          }
                          setTeamMembers(newMembers);
                        }}
                        placeholder="Number of members"
                      />
                    </div>
                  </div>

                  {/* Team Members */}
                  {editFormData.teamName && teamMembers.length > 0 && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Team Members
                      </label>
                      <div className="space-y-2">
                        {teamMembers.map((member, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-1 md:grid-cols-2 gap-2"
                          >
                            <Input
                              value={member.name}
                              onChange={(e) => {
                                const newMembers = [...teamMembers];
                                newMembers[index] = {
                                  ...member,
                                  name: e.target.value,
                                };
                                setTeamMembers(newMembers);
                              }}
                              placeholder={`Member ${index + 1} name`}
                            />
                            <Input
                              type="email"
                              value={member.email}
                              onChange={(e) => {
                                const newMembers = [...teamMembers];
                                newMembers[index] = {
                                  ...member,
                                  email: e.target.value,
                                };
                                setTeamMembers(newMembers);
                              }}
                              placeholder={`Member ${index + 1} email`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Tags</h4>
                  <div className="space-y-3">
                    {/* Available Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Tags
                      </label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded p-2 bg-white">
                        {availableTags?.map((tag) => (
                          <button
                            key={tag._id}
                            type="button"
                            onClick={() => toggleEditTag(tag._id)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              editSelectedTagIds.includes(tag._id)
                                ? "bg-blue-100 text-blue-700 border border-blue-300"
                                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
                            }`}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* New Tags */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          New Tags
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAddNewTag}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add New
                        </Button>
                      </div>
                      {newTagNames.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {newTagNames.map((tagName) => (
                            <span
                              key={tagName}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded border border-green-300"
                            >
                              {tagName}
                              <button
                                type="button"
                                onClick={() => handleRemoveNewTag(tagName)}
                                className="text-green-600 hover:text-green-800"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Screenshot */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Screenshot</h4>
                  <div className="space-y-3">
                    {/* Current Screenshot */}
                    {item.screenshotUrl &&
                      !removeScreenshot &&
                      !screenshotPreview && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Current Screenshot
                          </label>
                          <div className="relative inline-block">
                            <img
                              src={item.screenshotUrl}
                              alt="Current screenshot"
                              className="w-32 h-24 object-cover rounded border"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleRemoveScreenshot}
                              className="mt-2"
                            >
                              Remove Screenshot
                            </Button>
                          </div>
                        </div>
                      )}

                    {/* New Screenshot Preview */}
                    {screenshotPreview && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          New Screenshot
                        </label>
                        <div className="relative inline-block">
                          <img
                            src={screenshotPreview}
                            alt="New screenshot preview"
                            className="w-32 h-24 object-cover rounded border"
                          />
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNewScreenshotFile(null);
                                setScreenshotPreview(null);
                              }}
                            >
                              Remove New
                            </Button>
                            {item.screenshotUrl && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleKeepCurrentScreenshot}
                              >
                                Keep Current
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* File Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {screenshotPreview
                          ? "Replace with Different Image"
                          : "Upload New Screenshot"}
                      </label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotFileChange}
                        className="file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      />
                    </div>

                    {/* Removed Screenshot Indicator */}
                    {removeScreenshot && (
                      <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
                        Screenshot will be removed.{" "}
                        <button
                          type="button"
                          onClick={handleKeepCurrentScreenshot}
                          className="underline hover:no-underline"
                        >
                          Undo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Images */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Additional Images ({item.additionalImageUrls?.length || 0})
                  </h4>
                  <div className="space-y-3">
                    {/* Current Additional Images */}
                    {item.additionalImageUrls &&
                      item.additionalImageUrls.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Current Additional Images
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {item.additionalImageUrls.map((imageUrl, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={imageUrl}
                                  alt={`Additional image ${index + 1}`}
                                  className="w-20 h-16 object-cover rounded border"
                                />
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditFormData((prev) => ({
                                ...prev,
                                removeAdditionalImages: true,
                              }));
                            }}
                            className="mt-2"
                          >
                            Remove All Additional Images
                          </Button>
                        </div>
                      )}

                    {/* File Upload for Additional Images */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Upload Additional Images (Max 4)
                      </label>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;

                          // Validate files
                          const validFiles: File[] = [];
                          for (const file of files) {
                            if (file.size > 5 * 1024 * 1024) {
                              showMessage("File Too Large", `File ${file.name} exceeds 5MB limit.`, "error");
                              continue;
                            }
                            if (!file.type.startsWith("image/")) {
                              showMessage("Invalid File Type", `File ${file.name} is not an image.`, "error");
                              continue;
                            }
                            validFiles.push(file);
                          }

                          if (validFiles.length === 0) return;

                          const totalImages =
                            (item.additionalImageUrls?.length || 0) +
                            validFiles.length;
                          if (totalImages > 4) {
                            showMessage("Too Many Images", "Maximum of 4 additional images allowed.", "warning");
                            return;
                          }

                          // Upload files
                          const uploadPromises = validFiles.map(
                            async (file) => {
                              const postUrl = await generateUploadUrl();
                              const result = await fetch(postUrl, {
                                method: "POST",
                                headers: { "Content-Type": file.type },
                                body: file,
                              });
                              const { storageId } = await result.json();
                              if (!storageId) {
                                throw new Error(
                                  `Failed to upload ${file.name}`,
                                );
                              }
                              return storageId;
                            },
                          );

                          try {
                            const newImageIds =
                              await Promise.all(uploadPromises);
                            const existingIds = item.additionalImageIds || [];
                            const allImageIds = [
                              ...existingIds,
                              ...newImageIds,
                            ];

                            setEditFormData((prev) => ({
                              ...prev,
                              additionalImageIds: allImageIds,
                            }));
                          } catch (error) {
                            showMessage("Upload Failed", `Failed to upload images: ${error}`, "error");
                          }
                        }}
                        className="file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" onClick={handleSaveEdit}>
                    Save Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p
                className={`text-sm ${item.type === "comment" ? "text-[#525252]" : "text-[#545454]"} mt-1 break-words`}
              >
                {item.type === "story" ? item.description : item.content}
              </p>
            )}
            {/* Always show custom message if present, as editing is disabled */}
            {item.type === "story" && item.customMessage && (
              <div className="mt-2 text-sm text-[#ffffff] bg-[#292929] border border-[#D8E1EC] rounded-md p-2 italic">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEditMessage}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSaveMessage(item._id as Id<"stories">)}
                  >
                    Save Message
                  </Button>
                </div>
              </div>
            )}
            {/* Tag Selector - Show for current story if active */}
            {item.type === "story" && showTagSelector === item._id && (
              <div className="mt-3 space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm font-medium text-gray-700">
                  Add Tag to Story:
                </p>
                <div className="flex gap-2 items-center">
                  <Select
                    value={selectedTagId || ""}
                    onValueChange={(value) =>
                      setSelectedTagId(value as Id<"tags">)
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a tag to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTags
                        ?.filter(
                          (tag) =>
                            // Only show tags that aren't already on this story
                            !item.tags?.some(
                              (existingTag) => existingTag._id === tag._id,
                            ),
                        )
                        .map((tag) => (
                          <SelectItem key={tag._id} value={tag._id}>
                            <div className="flex items-center gap-2">
                              {tag.emoji && <span>{tag.emoji}</span>}
                              {tag.iconUrl && !tag.emoji && (
                                <img
                                  src={tag.iconUrl}
                                  alt=""
                                  className="w-4 h-4 rounded-sm object-cover"
                                />
                              )}
                              <span>{tag.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAddTag(item._id as Id<"stories">)}
                    disabled={!selectedTagId}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelTagSelector}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {/* Judging Group Selector - Show for current story if active */}
            {item.type === "story" && showJudgingGroupSelector === item._id && (
              <div className="mt-3 space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm font-medium text-gray-700">
                  Add to Judging Group:
                </p>
                <div className="flex gap-2 items-center">
                  <Select
                    value={selectedJudgingGroupId || ""}
                    onValueChange={(value) =>
                      setSelectedJudgingGroupId(value as Id<"judgingGroups">)
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a judging group..." />
                    </SelectTrigger>
                    <SelectContent>
                      {judgingGroups
                        ?.filter((group) => group.isActive) // Only show active groups
                        .map((group) => (
                          <SelectItem key={group._id} value={group._id}>
                            <div className="flex items-center gap-2">
                              <Scale className="w-4 h-4" />
                              <span>{group.name}</span>
                              <span className="text-xs text-gray-500">
                                ({group.submissionCount} submissions)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                      handleAddToJudgingGroup(item._id as Id<"stories">)
                    }
                    disabled={!selectedJudgingGroupId}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelJudgingGroupSelector}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {/* Show existing judging groups for stories */}
            {item.type === "story" && (
              <StoryJudgingGroups
                storyId={item._id as Id<"stories">}
                onRemove={handleRemoveFromJudgingGroup}
              />
            )}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[#545454]">
              <span>
                by{" "}
                {item.type === "story"
                  ? (item as any).submitterName ||
                    (item as any).authorName ||
                    "Unknown"
                  : (item as any).authorName || "Unknown"}
              </span>
              {item.type === "story" && (item as any).authorUsername && (
                <span className="text-gray-400">
                  (@{(item as any).authorUsername})
                </span>
              )}
              {item.type === "comment" && (item as any).authorUsername && (
                <span className="text-gray-400">
                  (@{(item as any).authorUsername})
                </span>
              )}
              {item.type === "story" && (item as any).email && (
                <span className="text-gray-400">({(item as any).email})</span>
              )}
              <span>
                {format(item._creationTime, "MMM dd, yyyy 'at' h:mm a")}
              </span>
              {item.type === "story" && (
                <>
                  <span>{item.votes} votes</span>
                  <Link
                    to={`/s/${item.slug}#comments`}
                    target="_blank"
                    className="hover:underline"
                  >
                    ({item.commentCount ?? 0} comments)
                  </Link>
                </>
              )}
              {item.type === "comment" && (
                <span>(Comment on Story id: {item.storyId})</span>
              )}
              <span
                className={`font-semibold ${
                  item.isHidden
                    ? "text-orange-600"
                    : item.status === "pending"
                      ? "text-blue-600"
                      : item.status === "rejected"
                        ? "text-red-600"
                        : "text-green-600"
                }`}
              >
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
                    className="text-xs text-[#545454] bg-[#F4F0ED] px-2 py-0.5 rounded"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {/* Approve/Reject actions for pending items */}
            {item.status === "pending" && (
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  onClick={() => handleAction("approve", item)}
                >
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  onClick={() => handleAction("reject", item)}
                >
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            )}

            {/* Row 1: Hide/Show, Pin, Add Message, Add Tag */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Hide/Show Button */}
              {item.isHidden ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  onClick={() => handleAction("show", item)}
                >
                  <Eye className="w-4 h-4 mr-1" /> Show
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                  onClick={() => handleAction("hide", item)}
                >
                  <EyeOff className="w-4 h-4 mr-1" /> Hide
                </Button>
              )}

              {/* Archive/Unarchive Button - Only for stories */}
              {item.type === "story" && (
                <>
                  {(item as StoryWithDetails).isArchived ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                      onClick={() => handleAction("unarchive", item)}
                    >
                      <FileX className="w-4 h-4 mr-1" /> Unarchive
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                      onClick={() => handleAction("archive", item)}
                    >
                      <FileX className="w-4 h-4 mr-1" /> Archive
                    </Button>
                  )}
                </>
              )}

              {/* Story Specific Actions for Row 1 */}
              {item.type === "story" && (
                <>
                  {/* Pin Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${item.isPinned ? "text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100" : "text-gray-600 hover:bg-gray-50"}`}
                    onClick={() => handleAction("togglePin", item)}
                  >
                    <Pin className="w-4 h-4 mr-1" />{" "}
                    {item.isPinned ? "Unpin" : "Pin"}
                  </Button>
                  {/* Add Message Button */}
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleEditMessage(item as StoryWithDetails)
                      }
                    >
                      <MessageSquare className="w-4 h-4 mr-1" /> Add Message
                    </Button>
                  )}
                  {/* Add Tag Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleShowTagSelector(item._id as Id<"stories">)
                    }
                  >
                    <Tag className="w-4 h-4 mr-1" /> Add Tag
                  </Button>
                </>
              )}
            </div>

            {/* Row 2: Add to Judging, Edit, Delete */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Story Specific Actions for Row 2 */}
              {item.type === "story" && (
                <>
                  {/* Add to Judging Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleShowJudgingGroupSelector(item._id as Id<"stories">)
                    }
                  >
                    <Scale className="w-4 h-4 mr-1" /> Add to Judging
                  </Button>
                  {/* Edit Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                    onClick={() => handleEditStory(item as StoryWithDetails)}
                  >
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </>
              )}

              {/* Delete Action (Common) */}
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 hover:bg-red-50 hover:text-red-800 border-red-200"
                onClick={() => handleAction("delete", item)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const itemsToRender: ModeratableItem[] = useMemo(() => {
    if (activeItemType === "submissions") {
      return (stories || []).map((story) => ({
        ...story,
        type: "story" as const,
      }));
    } else {
      return (comments || []).map((comment) => ({
        ...comment,
        type: "comment" as const,
      }));
    }
  }, [activeItemType, stories, comments]);

  const currentStatus =
    activeItemType === "submissions" ? storiesStatus : commentsStatus;
  const loadMore =
    activeItemType === "submissions" ? loadMoreStories : loadMoreComments;

  return (
    <>
      <DialogComponents />
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-medium text-[#525252] mb-6">
          Content Moderation
        </h2>

        {/* First Row - Main Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Select
            value={activeItemType}
            onValueChange={(v: string) => setActiveItemType(v as any)}
          >
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
            onValueChange={(v: string) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (Active)</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="hidden">Hidden Only</SelectItem>
              <SelectItem value="archived">Archived Only</SelectItem>
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

        {/* Second Row - Date Range and Tag Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Date Range Filter */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-600 mb-1 block">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-600 mb-1 block">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-3 py-2 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>

          {/* Tag Filter - Only show for submissions */}
          {activeItemType === "submissions" && (
            <div className="relative tag-search-container">
              <label className="text-xs text-gray-600 mb-1 block">
                Filter by Tags
              </label>
              <Input
                type="search"
                placeholder="Search tags to filter..."
                value={tagSearchTerm}
                onChange={(e) => {
                  setTagSearchTerm(e.target.value);
                  setShowTagDropdown(e.target.value.length > 0);
                }}
                onFocus={() => setShowTagDropdown(tagSearchTerm.length > 0)}
                className="text-sm"
              />

              {/* Tag Dropdown */}
              {showTagDropdown && availableTags && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-[#D8E1EC] rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {(() => {
                    const searchTerm = tagSearchTerm.toLowerCase();
                    const filteredTags = availableTags
                      .filter(
                        (tag) =>
                          tag.name.toLowerCase().includes(searchTerm) &&
                          !selectedTagIds.includes(tag._id),
                      )
                      .slice(0, 10);

                    if (filteredTags.length === 0) {
                      return (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No matching tags found
                        </div>
                      );
                    }

                    return filteredTags.map((tag) => (
                      <button
                        key={tag._id}
                        type="button"
                        onClick={() => {
                          setSelectedTagIds((prev) => [...prev, tag._id]);
                          setTagSearchTerm("");
                          setShowTagDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#F4F0ED] focus:bg-[#F4F0ED] focus:outline-none flex items-center gap-2"
                      >
                        {tag.emoji && (
                          <span className="text-sm">{tag.emoji}</span>
                        )}
                        {tag.iconUrl && !tag.emoji && (
                          <img
                            src={tag.iconUrl}
                            alt=""
                            className="w-4 h-4 rounded-sm object-cover"
                          />
                        )}
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: tag.backgroundColor || "#F4F0ED",
                            color: tag.textColor || "#525252",
                            border: `1px solid ${tag.backgroundColor ? "transparent" : "#D5D3D0"}`,
                          }}
                        >
                          {tag.name}
                        </span>
                      </button>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Advanced Filters Section */}
        {activeItemType === "submissions" && (
          <div className="mb-6 p-4 bg-[#F2F4F7] rounded-lg border border-gray-200">
            <label className="text-sm font-medium text-gray-700 block mb-3">
              Advanced Filters
            </label>

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasMessage}
                  onChange={(e) => setHasMessage(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-700">Has Admin Message</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-700">Currently Pinned</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wasPinned}
                  onChange={(e) => setWasPinned(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-700">Was Pinned Before</span>
              </label>
            </div>

            {/* Judging Group Filter */}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">
                In Judging Group
              </label>
              <Select
                value={selectedJudgingGroupIdFilter || "all"}
                onValueChange={(value) =>
                  setSelectedJudgingGroupIdFilter(
                    value === "all" ? null : (value as Id<"judgingGroups">),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All groups..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {judgingGroups?.map((group) => (
                    <SelectItem key={group._id} value={group._id}>
                      {group.name} ({group.submissionCount} submissions)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {activeItemType === "submissions" && showBulkActions && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedStoryIds.size} submission
                  {selectedStoryIds.size !== 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={clearSelections}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Clear selection
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Bulk Add Tag */}
                {bulkActionType === "tag" ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={bulkSelectedTagId || ""}
                      onValueChange={(value) =>
                        setBulkSelectedTagId(value as Id<"tags">)
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select tag..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags?.map((tag) => (
                          <SelectItem key={tag._id} value={tag._id}>
                            <div className="flex items-center gap-2">
                              {tag.emoji && <span>{tag.emoji}</span>}
                              {tag.iconUrl && !tag.emoji && (
                                <img
                                  src={tag.iconUrl}
                                  alt=""
                                  className="w-4 h-4 rounded-sm object-cover"
                                />
                              )}
                              <span>{tag.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleBulkAddTag}
                      disabled={!bulkSelectedTagId}
                    >
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setBulkActionType(null);
                        setBulkSelectedTagId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : bulkActionType === "removeTag" ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={bulkRemoveTagId || ""}
                      onValueChange={(value) =>
                        setBulkRemoveTagId(value as Id<"tags">)
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select tag to remove..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags?.map((tag) => (
                          <SelectItem key={tag._id} value={tag._id}>
                            <div className="flex items-center gap-2">
                              {tag.emoji && <span>{tag.emoji}</span>}
                              {tag.iconUrl && !tag.emoji && (
                                <img
                                  src={tag.iconUrl}
                                  alt=""
                                  className="w-4 h-4 rounded-sm object-cover"
                                />
                              )}
                              <span>{tag.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleBulkRemoveTag}
                      disabled={!bulkRemoveTagId}
                    >
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setBulkActionType(null);
                        setBulkRemoveTagId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : bulkActionType === "judging" ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={bulkSelectedJudgingGroupId || ""}
                      onValueChange={(value) =>
                        setBulkSelectedJudgingGroupId(
                          value as Id<"judgingGroups">,
                        )
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Select judging group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {judgingGroups
                          ?.filter((group) => group.isActive)
                          .map((group) => (
                            <SelectItem key={group._id} value={group._id}>
                              <div className="flex items-center gap-2">
                                <Scale className="w-4 h-4" />
                                <span>{group.name}</span>
                                <span className="text-xs text-gray-500">
                                  ({group.submissionCount} submissions)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleBulkAddToJudgingGroup}
                      disabled={!bulkSelectedJudgingGroupId}
                    >
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setBulkActionType(null);
                        setBulkSelectedJudgingGroupId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkActionType("tag")}
                      className="bg-white"
                    >
                      <Tag className="w-4 h-4 mr-1" /> Add Tag
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkActionType("removeTag")}
                      className="bg-white"
                    >
                      <X className="w-4 h-4 mr-1" /> Remove Tag
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkActionType("judging")}
                      className="bg-white"
                    >
                      <Scale className="w-4 h-4 mr-1" /> Add to Judging
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDelete}
                      className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Tags Display */}
        {activeItemType === "submissions" && selectedTagIds.length > 0 && (
          <div className="mb-6 p-4 bg-[#F2F4F7] rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                Filtering by Tags ({selectedTagIds.length})
              </h3>
              <button
                onClick={() => setSelectedTagIds([])}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTags &&
                selectedTagIds.map((tagId) => {
                  const tag = availableTags.find((t) => t._id === tagId);
                  if (!tag) return null;

                  return (
                    <span
                      key={tag._id}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm border transition-colors"
                      style={{
                        backgroundColor: tag.backgroundColor || "#F4F0ED",
                        color: tag.textColor || "#292929",
                        borderColor: tag.backgroundColor
                          ? "transparent"
                          : "#D5D3D0",
                      }}
                    >
                      {tag.emoji && (
                        <span className="text-sm">{tag.emoji}</span>
                      )}
                      {tag.iconUrl && !tag.emoji && (
                        <img
                          src={tag.iconUrl}
                          alt=""
                          className="w-4 h-4 rounded-sm object-cover"
                        />
                      )}
                      {tag.name}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTagIds((prev) =>
                            prev.filter((id) => id !== tag._id),
                          )
                        }
                        className="ml-1 text-current hover:opacity-70 transition-opacity"
                        title="Remove tag filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
            </div>
          </div>
        )}

        {uiIsLoading && (
          <div className="text-center py-6 text-lg font-medium text-[#545454]">
            Loading...
          </div>
        )}

        {!uiIsLoading && itemsToRender.length === 0 && (
          <div className="text-center py-10 text-[#545454]">
            No {activeItemType} found matching the criteria.
          </div>
        )}

        {!uiIsLoading && itemsToRender.length > 0 && (
          <div>
            {/* Select All Checkbox - Only for submissions */}
            {activeItemType === "submissions" && itemsToRender.length > 0 && (
              <div className="border-b border-[#F4F0ED] py-3 mb-2 bg-gray-50">
                <label className="flex items-center gap-3 px-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedStoryIds.size > 0 &&
                      selectedStoryIds.size === itemsToRender.length
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    aria-label="Select all submissions"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedStoryIds.size === itemsToRender.length &&
                    selectedStoryIds.size > 0
                      ? "Deselect All"
                      : "Select All"}{" "}
                    ({itemsToRender.length} submissions)
                  </span>
                </label>
              </div>
            )}
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

      {/* Delete Comment Confirmation Modal */}
      {confirmDeleteCommentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Delete comment
            </h3>
            <p className="text-sm text-gray-600">This cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setConfirmDeleteCommentId(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#292929] text-white hover:bg-[#525252]"
                onClick={async () => {
                  await deleteComment({ commentId: confirmDeleteCommentId });
                  setConfirmDeleteCommentId(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// Helper component to show judging groups for a story
function StoryJudgingGroups({
  storyId,
  onRemove,
}: {
  storyId: Id<"stories">;
  onRemove: (
    storyId: Id<"stories">,
    groupId: Id<"judgingGroups">,
    groupName: string,
  ) => void;
}) {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const storyGroups = useQuery(
    api.judgingGroupSubmissions.getStoryJudgingGroups,
    authIsLoading || !isAuthenticated ? "skip" : { storyId },
  );

  // Get submission statuses for this story across all its judging groups
  const storyStatuses = useQuery(
    api.judgingGroupSubmissions.getStorySubmissionStatuses,
    authIsLoading || !isAuthenticated ? "skip" : { storyId },
  );

  if (!storyGroups || storyGroups.length === 0) {
    return null;
  }

  const getStatusForGroup = (groupId: Id<"judgingGroups">) => {
    if (!storyStatuses) return null;
    return storyStatuses.find((status) => status.groupId === groupId);
  };

  const renderStatusIcon = (
    status: "pending" | "completed" | "skip" | null,
    assignedJudgeName?: string,
  ) => {
    if (!status) return null;

    switch (status) {
      case "pending":
        return (
          <div
            className="flex items-center gap-1"
            title="Pending - Ready to be judged"
          >
            <PlayCircle className="w-3 h-3 text-yellow-600" />
          </div>
        );
      case "completed":
        return (
          <div
            className="flex items-center gap-1"
            title={`Completed${assignedJudgeName ? ` by ${assignedJudgeName}` : ""}`}
          >
            <CheckCircle className="w-3 h-3 text-green-600" />
            {assignedJudgeName && <User className="w-3 h-3 text-gray-500" />}
          </div>
        );
      case "skip":
        return (
          <div
            className="flex items-center gap-1"
            title="Skip - Not being judged"
          >
            <FileX className="w-3 h-3 text-gray-600" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          In Judging Groups ({storyGroups.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {storyGroups.map((group) => {
          const statusInfo = getStatusForGroup(group._id);

          return (
            <div
              key={group._id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs"
            >
              <span className="font-medium text-blue-900">{group.name}</span>
              <span className="text-blue-600">/{group.slug}</span>

              {/* Status Icon */}
              {statusInfo &&
                renderStatusIcon(
                  statusInfo.status,
                  statusInfo.assignedJudgeName,
                )}

              {!group.isActive && (
                <span className="text-orange-600 font-medium">(Inactive)</span>
              )}
              {!group.isPublic && <Lock className="w-3 h-3 text-gray-500" />}
              <button
                onClick={() => onRemove(storyId, group._id, group.name)}
                className="ml-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded p-0.5 transition-colors"
                title={`Remove from ${group.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Status Legend */}
      <div className="mt-2 pt-2 border-t border-blue-200">
        <div className="flex items-center gap-4 text-xs text-blue-700">
          <div className="flex items-center gap-1">
            <PlayCircle className="w-3 h-3 text-yellow-600" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-600" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <FileX className="w-3 h-3 text-gray-600" />
            <span>Skip</span>
          </div>
        </div>
      </div>
    </div>
  );
}
