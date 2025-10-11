import React, { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronUp,
  MessageSquare,
  Star,
  Linkedin,
  Twitter,
  Github,
  Flag,
  Bookmark,
  BookmarkCheck,
  Link2,
  Play,
  Edit3,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation } from "convex/react"; // Import Convex hooks
import { api } from "../../convex/_generated/api"; // Import Convex API
import type { Story, Comment as CommentType } from "../types";
import { Comment } from "./Comment";
import { CommentForm } from "./CommentForm";
import { Id, Doc } from "../../convex/_generated/dataModel"; // Import Id and Doc
import { useAuth, useUser } from "@clerk/clerk-react"; // Added useAuth, useUser
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"; // Assuming you have a Dialog component
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button"; // For modal buttons
import { toast } from "sonner";
import { AuthRequiredDialog } from "./ui/AuthRequiredDialog";
import { ImageGallery } from "./ImageGallery";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { Markdown } from "./Markdown";

// Removed MOCK_COMMENTS

interface StoryDetailProps {
  story: Story; // Expecting story with resolved tags (including colors and isHidden)
}

// Copied and adapted BookmarkButton from StoryList.tsx
const BookmarkButton = ({ storyId }: { storyId: Id<"stories"> }) => {
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth(); // Ensure useAuth is available
  const isBookmarked = useQuery(
    api.bookmarks.isStoryBookmarked,
    isSignedIn ? { storyId } : "skip",
  );
  const addOrRemoveBookmarkMutation = useMutation(
    api.bookmarks.addOrRemoveBookmark,
  );

  const handleBookmarkClick = async () => {
    if (!isClerkLoaded) return;
    if (!isSignedIn) {
      // Instead of alert, navigate or show a toast
      // navigate("/sign-in"); // Assuming navigate is available in this scope or passed as prop
      toast.error("Please sign in to bookmark stories.");
      return;
    }
    try {
      await addOrRemoveBookmarkMutation({ storyId });
      // Optionally, show a success toast
      // toast.success(isBookmarked ? "Bookmark removed" : "Story bookmarked!");
    } catch (error) {
      console.error("Failed to update bookmark:", error);
      toast.error("Failed to update bookmark. Please try again.");
    }
  };

  if (!isClerkLoaded) {
    // Show a loading state or disabled button
    return (
      <button
        className="flex items-center gap-1 text-[#787672] opacity-50 cursor-not-allowed"
        disabled
        title="Loading..."
      >
        <Bookmark className="w-4 h-4" />
      </button>
    );
  }

  if (!isSignedIn) {
    return (
      <button
        className="flex items-center gap-1 text-[#787672] hover:text-[#525252]"
        onClick={() => {
          toast.info("Please sign in to bookmark stories.");
        }}
        title="Sign in to bookmark"
      >
        <Bookmark className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleBookmarkClick}
      className="flex items-center gap-1 text-[#787672] hover:text-[#525252]"
      title={isBookmarked ? "Remove bookmark" : "Bookmark story"}
    >
      {isBookmarked ? (
        <BookmarkCheck className="w-4 h-4 text-black" />
      ) : (
        <Bookmark className="w-4 h-4" />
      )}
    </button>
  );
};

export function StoryDetail({ story }: StoryDetailProps) {
  const navigate = useNavigate(); // Initialize navigate
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth(); // Get auth state
  const { user } = useUser(); // Get current user data
  const [searchParams, setSearchParams] = useSearchParams();

  // Immediately update meta tags on component load (before useEffect)
  React.useMemo(() => {
    const currentUrl = window.location.href;
    const imageUrl = story.screenshotUrl || "/vibe-apps-open-graphi-image.png";

    // Aggressively update meta tags immediately
    const updateMetaImmediately = (
      property: string,
      content: string,
      isProperty: boolean = true,
    ) => {
      const attribute = isProperty ? "property" : "name";
      const selector = `meta[${attribute}="${property}"]`;

      // Find and update existing tag
      const existingTag = document.querySelector(selector);
      if (existingTag) {
        existingTag.setAttribute("content", content);
      }

      // Also create a new tag and prepend it to ensure priority
      const newTag = document.createElement("meta");
      newTag.setAttribute(attribute, property);
      newTag.setAttribute("content", content);

      // Insert at the very beginning of head
      const firstChild = document.head.firstElementChild;
      if (firstChild) {
        document.head.insertBefore(newTag, firstChild);
      } else {
        document.head.appendChild(newTag);
      }
    };

    // Update immediately
    document.title = `${story.title} | Vibe Coding`;
    updateMetaImmediately("description", story.description, false);
    updateMetaImmediately("og:title", story.title);
    updateMetaImmediately("og:description", story.description);
    updateMetaImmediately("og:image", imageUrl);
    updateMetaImmediately("og:url", currentUrl);
    updateMetaImmediately("twitter:title", story.title, false);
    updateMetaImmediately("twitter:description", story.description, false);
    updateMetaImmediately("twitter:image", imageUrl, false);

    return null;
  }, [story.title, story.description, story.screenshotUrl]);

  // Edit mode state
  const isEditMode = searchParams.get("edit") === "true";
  const [isEditing, setIsEditing] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState({
    title: story.title,
    description: story.description,
    longDescription: story.longDescription || "",
    submitterName: story.submitterName || "",
    url: story.url,
    videoUrl: story.videoUrl || "",
    email: story.email || "",
  });
  const [editDynamicFormData, setEditDynamicFormData] = React.useState<
    Record<string, string>
  >({});
  const [selectedTagIds, setSelectedTagIds] = React.useState<Id<"tags">[]>(
    story.tagIds || [],
  );
  const [newTagNames, setNewTagNames] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Dropdown search state for tags
  const [dropdownSearchValue, setDropdownSearchValue] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);

  // Screenshot management state
  const [currentScreenshot, setCurrentScreenshot] = React.useState<
    string | null
  >(story.screenshotUrl || null);
  const [newScreenshotFile, setNewScreenshotFile] = React.useState<File | null>(
    null,
  );
  const [removeScreenshot, setRemoveScreenshot] = React.useState(false);
  const [screenshotPreview, setScreenshotPreview] = React.useState<
    string | null
  >(null);
  // Additional images (gallery) editing state
  const [existingAdditionalImages, setExistingAdditionalImages] =
    React.useState<Array<{ id: Id<"_storage">; url: string }>>(
      () =>
        (story.additionalImageIds || []).map(
          (id: Id<"_storage">, index: number) => ({
            id,
            url: (story.additionalImageUrls || [])[index] || "",
          }),
        ) || [],
    );
  const [newAdditionalImages, setNewAdditionalImages] = React.useState<File[]>(
    [],
  );
  const [newAdditionalPreviewUrls, setNewAdditionalPreviewUrls] =
    React.useState<string[]>([]);

  // Team info editing state
  const [showTeamInfo, setShowTeamInfo] = React.useState(false);
  const [teamData, setTeamData] = React.useState({
    teamName: "",
    teamMemberCount: 1,
    teamMembers: [{ name: "", email: "" }],
  });

  // Fetch APPROVED comments using Convex query
  const comments = useQuery(api.comments.listApprovedByStory, {
    storyId: story._id,
  });
  const currentUserRating = useQuery(
    api.stories.getUserRatingForStory,
    isSignedIn ? { storyId: story._id } : "skip", // Only run if signed in
  );

  const [replyToId, setReplyToId] = React.useState<Id<"comments"> | null>(null);

  // Rating state - keep local state for UI feedback, but rely on Convex for source of truth
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);

  const hasRated =
    currentUserRating !== null && currentUserRating !== undefined;

  // Convex mutations
  const voteStory = useMutation(api.stories.voteStory);
  const rateStory = useMutation(api.stories.rate);
  const addComment = useMutation(api.comments.add);
  const createReportMutation = useMutation(api.reports.createReport);
  const updateOwnStoryMutation = useMutation(api.stories.updateOwnStory);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);

  // Additional queries for editing
  const availableTags = useQuery(api.tags.listHeader);
  const allTags = useQuery(api.tags.listAllForDropdown); // Fetch all tags including hidden ones

  const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState("");
  const [isReporting, setIsReporting] = React.useState(false);
  const [reportModalError, setReportModalError] = React.useState<string | null>(
    null,
  );

  // Auth required dialog state
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [authDialogAction, setAuthDialogAction] = React.useState("");

  // Changelog expand state (all closed by default)
  const [expandedChangelogIndices, setExpandedChangelogIndices] =
    React.useState<Set<number>>(new Set());

  // Fetch related stories
  const relatedStories = useQuery(
    api.stories.getRelatedStoriesByTags,
    story.tags && story.tags.length > 0
      ? {
          currentStoryId: story._id,
          tagIds: story.tags.map((tag: Doc<"tags">) => tag._id),
          limit: 3, // Already limits to 3 max from backend
        }
      : "skip",
  );

  // Fetch enabled form fields for dynamic link display
  const enabledFormFields = useQuery(api.storyFormFields.listEnabled);
  const settings = useQuery(api.settings.get);

  // Get current user's Convex data to check ownership
  const currentUser = useQuery(
    api.users.getMyUserDocument,
    isSignedIn && user ? {} : "skip",
  );

  // Handle edit mode initialization
  React.useEffect(() => {
    // Regular edit mode: user owns the story
    const canEdit =
      isClerkLoaded &&
      isSignedIn &&
      currentUser &&
      story.userId === currentUser._id;

    if (isEditMode && canEdit) {
      setIsEditing(true);

      // Scroll to edit form after a brief delay to ensure it's rendered
      setTimeout(() => {
        const editSection = document.getElementById("edit-submission-form");
        if (editSection) {
          editSection.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
      // Initialize form data with current story values
      setEditFormData({
        title: story.title,
        description: story.description,
        longDescription: story.longDescription || "",
        submitterName: story.submitterName || "",
        url: story.url,
        videoUrl: story.videoUrl || "",
        email: story.email || "",
      });

      // Initialize dynamic form data
      const dynamicData: Record<string, string> = {};
      if (story.linkedinUrl) dynamicData.linkedinUrl = story.linkedinUrl;
      if (story.twitterUrl) dynamicData.twitterUrl = story.twitterUrl;
      if (story.githubUrl) dynamicData.githubUrl = story.githubUrl;
      if (story.chefShowUrl) dynamicData.chefShowUrl = story.chefShowUrl;
      if (story.chefAppUrl) dynamicData.chefAppUrl = story.chefAppUrl;
      setEditDynamicFormData(dynamicData);

      setSelectedTagIds(story.tagIds || []);

      // Initialize team data
      setTeamData({
        teamName: story.teamName || "",
        teamMemberCount: story.teamMemberCount || 1,
        teamMembers:
          story.teamMembers && story.teamMembers.length > 0
            ? story.teamMembers
            : [{ name: "", email: "" }],
      });
      setShowTeamInfo(!!story.teamName);

      // Reset screenshot state
      setCurrentScreenshot(story.screenshotUrl || null);
      setNewScreenshotFile(null);
      setRemoveScreenshot(false);
      setScreenshotPreview(null);
      // Initialize additional images state
      setExistingAdditionalImages(
        (story.additionalImageIds || []).map(
          (id: Id<"_storage">, index: number) => ({
            id,
            url: (story.additionalImageUrls || [])[index] || "",
          }),
        ) || [],
      );
      setNewAdditionalImages([]);
      setNewAdditionalPreviewUrls([]);
    } else if (isEditMode && !canEdit) {
      // Remove edit parameter if user can't edit
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("edit");
      setSearchParams(newSearchParams);
    }
  }, [
    isEditMode,
    isClerkLoaded,
    isSignedIn,
    currentUser,
    story,
    searchParams,
    setSearchParams,
  ]);

  const handleVote = () => {
    if (!isClerkLoaded) return; // Don't do anything if Clerk hasn't loaded

    if (!isSignedIn) {
      setAuthDialogAction("vote");
      setShowAuthDialog(true);
      return;
    }
    voteStory({ storyId: story._id })
      .then((result) => {
        console.log("Vote successful:", result);
        // Optionally, update UI based on result.action and result.newVoteCount
      })
      .catch((error) => {
        console.error("Error voting:", error);
        // Handle error, e.g., show a notification to the user
      });
  };

  const handleRating = (value: number) => {
    if (!isClerkLoaded) return;

    if (!isSignedIn) {
      setAuthDialogAction("rate");
      setShowAuthDialog(true);
      return;
    }
    if (hasRated) {
      // User has already rated, prevent re-rating (or allow update if implemented)
      alert("You have already rated this app.");
      return;
    }
    rateStory({ storyId: story._id, rating: value })
      .then((result) => {
        console.log("Rating success:", result);
        // Optimistically update UI or refetch currentUserRating might be needed here
        // For now, a simple alert.
      })
      .catch((error) => {
        console.error("Error rating:", error);
        alert(`Error rating: ${error.data?.message || error.message}`);
      });
  };

  const handleCommentSubmit = (content: string) => {
    if (!isClerkLoaded) return;
    if (!isSignedIn) {
      setAuthDialogAction("comment");
      setShowAuthDialog(true);
      return;
    }
    addComment({
      storyId: story._id,
      content,
      parentId: replyToId || undefined,
    });
    setReplyToId(null);
  };

  const handleOpenReportModal = () => {
    setReportModalError(null);
    setReportReason("");
    setIsReportModalOpen(true);
  };

  const handleReportModalOpenChange = (open: boolean): void => {
    setIsReportModalOpen(open);
    if (!open) {
      setReportModalError(null);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason.trim()) {
      setReportModalError("Please provide a reason for reporting.");
      return;
    }
    if (!story?._id) {
      setReportModalError("Story ID is missing, cannot submit report.");
      return;
    }

    setIsReporting(true);
    setReportModalError(null);
    try {
      await createReportMutation({ storyId: story._id, reason: reportReason });
      alert("Story reported successfully. An admin will review it.");
      setIsReportModalOpen(false);
      setReportReason("");
    } catch (error: any) {
      console.error("Error reporting story:", error); // Keep full log for debugging

      // Attempt to extract the most user-friendly message from the Convex error
      let userFriendlyMessage =
        "You have already reported this story, and it is pending review."; // Default fallback
      if (error.data) {
        if (typeof error.data === "string") {
          userFriendlyMessage = error.data; // If error.data is the string itself
        } else if (
          error.data.message &&
          typeof error.data.message === "string"
        ) {
          userFriendlyMessage = error.data.message; // Standard Convex error message path
        } else if (
          error.message &&
          typeof error.message === "string" &&
          error.message.includes("Uncaught Error:")
        ) {
          // Fallback to parsing the longer error.message if a specific known phrase is present
          // This is more brittle but can catch the desired message if not in error.data.message
          const match = error.message.match(/Uncaught Error: (.*?) at handler/);
          if (match && match[1]) {
            userFriendlyMessage = match[1];
          }
        }
      }
      setReportModalError(userFriendlyMessage);
    }
    setIsReporting(false);
  };

  // Edit form handlers
  const handleEditCancel = () => {
    setIsEditing(false);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("edit");
    setSearchParams(newSearchParams);
    setEditError(null);

    // Reset screenshot state and cleanup preview URL
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setCurrentScreenshot(story.screenshotUrl || null);
    setNewScreenshotFile(null);
    setRemoveScreenshot(false);
    setScreenshotPreview(null);
  };

  const toggleTag = (tagId: Id<"tags">) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        const totalTags = prev.length + newTagNames.length;
        if (totalTags >= 10) {
          setEditError("You can select a maximum of 10 tags.");
          return prev;
        }
        setEditError(null);
        return [...prev, tagId];
      }
    });
  };

  const handleSelectFromDropdown = (tagId: Id<"tags">) => {
    const totalTags = selectedTagIds.length + newTagNames.length;

    if (totalTags >= 10) {
      setEditError("You can select a maximum of 10 tags.");
      return;
    }

    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds((prev) => [...prev, tagId]);
    }
    setDropdownSearchValue("");
    setShowDropdown(false);
    setEditError(null);
  };

  const handleAddNewTag = () => {
    const tagName = dropdownSearchValue.trim();
    const totalTags = selectedTagIds.length + newTagNames.length;

    if (totalTags >= 10) {
      setEditError("You can select a maximum of 10 tags.");
      return;
    }

    if (
      tagName &&
      !newTagNames.some((t) => t.toLowerCase() === tagName.toLowerCase()) &&
      !availableTags?.some(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      ) &&
      !allTags?.some((t) => t.name.toLowerCase() === tagName.toLowerCase())
    ) {
      setNewTagNames((prev) => [...prev, tagName]);
      setDropdownSearchValue("");
      setShowDropdown(false);
      setEditError(null);
    } else if (tagName) {
      setEditError("Tag name already exists or is invalid.");
    }
  };

  const handleRemoveNewTag = (tagName: string) => {
    setNewTagNames((prev) => prev.filter((t) => t !== tagName));
  };

  // Screenshot handling functions
  const handleScreenshotFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewScreenshotFile(file);
      setRemoveScreenshot(false);

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setScreenshotPreview(previewUrl);
    }
  };

  const handleRemoveScreenshot = () => {
    setRemoveScreenshot(true);
    setNewScreenshotFile(null);
    setScreenshotPreview(null);

    // Clear file input
    const fileInput = document.getElementById(
      "edit-screenshot",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleKeepCurrentScreenshot = () => {
    setRemoveScreenshot(false);
    setNewScreenshotFile(null);
    setScreenshotPreview(null);

    // Clear file input
    const fileInput = document.getElementById(
      "edit-screenshot",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };
  // Additional images handlers
  const handleAdditionalImagesChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const total =
      existingAdditionalImages.length +
      newAdditionalImages.length +
      files.length;
    if (total > 4) {
      toast.error("Maximum of 4 additional images allowed.");
      return;
    }
    const previews: string[] = [];
    const validImages: File[] = [];
    for (const f of files) {
      if (f.type.startsWith("image/")) {
        validImages.push(f);
        previews.push(URL.createObjectURL(f));
      }
    }
    setNewAdditionalImages((prev) => [...prev, ...validImages]);
    setNewAdditionalPreviewUrls((prev) => [...prev, ...previews]);
    e.currentTarget.value = "";
  };

  const removeExistingAdditionalImage = (index: number) => {
    setExistingAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewAdditionalImage = (index: number) => {
    setNewAdditionalImages((prev) => prev.filter((_, i) => i !== index));
    setNewAdditionalPreviewUrls((prev) => {
      const toRevoke = prev[index];
      if (toRevoke) URL.revokeObjectURL(toRevoke);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Team info helper functions
  const handleTeamMemberCountChange = (count: number) => {
    const newCount = Math.max(1, Math.min(10, count)); // Limit between 1-10 members
    setTeamData((prev) => {
      const newMembers = [...prev.teamMembers];

      // Add new empty members if count increased
      while (newMembers.length < newCount) {
        newMembers.push({ name: "", email: "" });
      }

      // Remove members if count decreased
      if (newMembers.length > newCount) {
        newMembers.splice(newCount);
      }

      return {
        ...prev,
        teamMemberCount: newCount,
        teamMembers: newMembers,
      };
    });
  };

  const handleTeamMemberChange = (
    index: number,
    field: "name" | "email",
    value: string,
  ) => {
    setTeamData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.map((member, i) =>
        i === index ? { ...member, [field]: value } : member,
      ),
    }));
  };

  // Cleanup preview URL on component unmount or when preview changes
  React.useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);
  // Cleanup new additional preview URLs on component unmount or when preview changes
  React.useEffect(() => {
    return () => {
      newAdditionalPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newAdditionalPreviewUrls]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".tag-dropdown-container")) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check permissions based on edit mode
    const canEdit = currentUser && story.userId === currentUser._id;

    if (!(isEditMode && canEdit)) {
      return;
    }

    const totalTagsSelected = selectedTagIds.length + newTagNames.length;
    if (totalTagsSelected === 0) {
      setEditError("Please select at least one tag.");
      return;
    }

    setIsSubmitting(true);
    setEditError(null);

    try {
      let screenshotStorageId: Id<"_storage"> | undefined = undefined;
      let uploadedAdditionalImageIds: Array<Id<"_storage">> = [];

      // Handle screenshot upload if a new file is selected
      if (newScreenshotFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": newScreenshotFile.type },
          body: newScreenshotFile,
        });
        const { storageId } = await result.json();
        if (!storageId) {
          throw new Error("Failed to get storage ID after upload.");
        }
        screenshotStorageId = storageId;
      } else if (removeScreenshot) {
        // If user wants to remove screenshot, pass undefined
        screenshotStorageId = undefined;
      } else {
        // Keep current screenshot by not passing screenshotId parameter
        // (the mutation will only update fields that are provided)
      }

      // Upload new additional images
      if (newAdditionalImages.length > 0) {
        const uploadPromises = newAdditionalImages.map(async (file) => {
          const postUrl = await generateUploadUrl();
          const uploadRes = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          const { storageId } = await uploadRes.json();
          if (!storageId)
            throw new Error("Failed to upload an additional image");
          return storageId as Id<"_storage">;
        });
        uploadedAdditionalImageIds = await Promise.all(uploadPromises);
      }

      // Build final additional image ids (existing retained + newly uploaded)
      const finalAdditionalImageIds: Array<Id<"_storage">> = [
        ...existingAdditionalImages.map((img) => img.id),
        ...uploadedAdditionalImageIds,
      ];
      if (finalAdditionalImageIds.length > 4) {
        throw new Error("Maximum of 4 additional images allowed.");
      }

      const result = await updateOwnStoryMutation({
        storyId: story._id,
        title: editFormData.title,
        description: editFormData.description,
        longDescription: editFormData.longDescription || undefined,
        submitterName: editFormData.submitterName || undefined,
        url: editFormData.url,
        videoUrl: editFormData.videoUrl || undefined,
        email: editFormData.email || undefined,
        tagIds: selectedTagIds,
        newTagNames: newTagNames,
        linkedinUrl: editDynamicFormData.linkedinUrl || undefined,
        twitterUrl: editDynamicFormData.twitterUrl || undefined,
        githubUrl: editDynamicFormData.githubUrl || undefined,
        chefShowUrl: editDynamicFormData.chefShowUrl || undefined,
        chefAppUrl: editDynamicFormData.chefAppUrl || undefined,
        // Team info (only include if team info is shown and has data)
        teamName:
          showTeamInfo && teamData.teamName ? teamData.teamName : undefined,
        teamMemberCount:
          showTeamInfo && teamData.teamName
            ? teamData.teamMemberCount
            : undefined,
        teamMembers:
          showTeamInfo && teamData.teamName
            ? teamData.teamMembers.filter(
                (member) => member.name.trim() || member.email.trim(),
              )
            : undefined,
        ...(newScreenshotFile || removeScreenshot
          ? { screenshotId: screenshotStorageId }
          : {}),
        additionalImageIds: finalAdditionalImageIds,
      });

      toast.success("Submission updated successfully!");

      // Navigate to updated story if slug changed
      if (result.slug && result.slug !== story.slug) {
        navigate(`/s/${result.slug}`, { replace: true });
      } else {
        // Just exit edit mode
        handleEditCancel();
        // Force refresh by reloading the page
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Failed to update story:", error);
      setEditError(
        error.data?.message || error.message || "Failed to update submission.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Additional meta tag updates in useEffect as backup
  useEffect(() => {
    const currentUrl = window.location.href;
    const imageUrl = story.screenshotUrl || "/vibe-apps-open-graphi-image.png";

    // Ensure title is updated
    document.title = `${story.title} | Vibe Coding`;

    // Additional cleanup and updates for any remaining default tags
    const cleanupAndUpdate = (
      property: string,
      content: string,
      isProperty: boolean = true,
    ) => {
      const attribute = isProperty ? "property" : "name";
      const selector = `meta[${attribute}="${property}"]`;

      // Remove any duplicate tags
      const existingTags = document.querySelectorAll(selector);
      existingTags.forEach((tag, index) => {
        if (index > 0)
          tag.remove(); // Keep only the first one
        else tag.setAttribute("content", content); // Update the first one
      });
    };

    // Clean up and update
    cleanupAndUpdate("description", story.description, false);
    cleanupAndUpdate("og:title", story.title);
    cleanupAndUpdate("og:description", story.description);
    cleanupAndUpdate("og:image", imageUrl);
    cleanupAndUpdate("og:url", currentUrl);
    cleanupAndUpdate("twitter:title", story.title, false);
    cleanupAndUpdate("twitter:description", story.description, false);
    cleanupAndUpdate("twitter:image", imageUrl, false);
  }, [story.title, story.description, story.screenshotUrl]);

  const averageRating =
    story.ratingCount > 0 ? story.ratingSum / story.ratingCount : 0;
  // The direct GitHub link is removed as per new requirement for modal
  // const reportUrl = `https://github.com/waynesutton/vibeapps/issues/new?q=is%3Aissue+state%3Aopen+Flagged&labels=flagged&title=Flagged+Content%3A+${encodeURIComponent(story.title)}&body=Reporting+issue+for+story%3A+%0A-+Title%3A+${encodeURIComponent(story.title)}%0A-+Slug%3A+${storySlug}%0A-+URL%3A+${encodeURIComponent(story.url)}%0A-+Reason%3A+`;

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="flex gap-8">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <article className="bg-white rounded-lg p-4 sm:p-6 border border-[#D8E1EC]">
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1 pt-1 min-w-[40px]">
                <button
                  onClick={handleVote}
                  disabled={!isClerkLoaded} // Disable while Clerk is loading to prevent premature clicks
                  className={`text-[#292929] hover:bg-[#F4F0ED] p-1 rounded ${
                    !isSignedIn && isClerkLoaded ? "opacity-50 cursor-help" : ""
                  }`}
                  title={
                    !isSignedIn && isClerkLoaded
                      ? "Sign in to vote"
                      : "Vote for this app"
                  }
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <span className="text-[#525252] font-medium text-sm">
                  {story.votes}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl lg:text-1xl font-bold  text-transform: capitalize text-[#000000] mb-2">
                  <a
                    href={story.url}
                    className="hover:text-[#555555] break-words"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {story.title}
                  </a>
                </h1>
                {story.customMessage && (
                  <div className="mb-4 text-sm text-[#ffffff] bg-[#292929] border border-[#D8E1EC] rounded-md p-3 italic">
                    {story.customMessage}
                  </div>
                )}
                <ImageGallery
                  mainImageUrl={story.screenshotUrl}
                  additionalImageUrls={story.additionalImageUrls || []}
                  altText={`${story.title} screenshot`}
                />
                <p className="text-[#000000] mb-4 mt-[20px] prose prose-base max-w-none">
                  {story.description}
                </p>
                {story.longDescription && (
                  <div className="text-[#525252] mb-4 prose prose-base max-w-none">
                    <Markdown>{story.longDescription}</Markdown>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-[#545454] flex-wrap mb-3">
                  {story.authorUsername ? (
                    <ProfileHoverCard username={story.authorUsername}>
                      <Link
                        to={`/${story.authorUsername}`}
                        className="hover:text-[#525252] hover:underline"
                      >
                        by{" "}
                        {story.submitterName ||
                          story.authorName ||
                          story.authorUsername}
                      </Link>
                    </ProfileHoverCard>
                  ) : (
                    <span>
                      by{" "}
                      {story.submitterName ||
                        story.authorName ||
                        "Anonymous User"}
                    </span>
                  )}
                  <span>{formatDistanceToNow(story._creationTime)} ago</span>
                  <Link
                    to="#comments"
                    className="flex items-center gap-1 hover:text-[#525252]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {comments?.length ?? 0} Comments
                  </Link>
                  <BookmarkButton storyId={story._id} />
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* Project Links & Tags Sidebar */}
        {(story.url ||
          story.videoUrl ||
          story.githubUrl ||
          enabledFormFields?.some(
            (field) => (story as any)[field.storyPropertyName],
          ) ||
          story.tags?.length > 0) && (
          <div className="w-80 flex-shrink-0 hidden lg:block">
            <div className="bg-[#F9F9F9] rounded-lg p-4 border border-[#E5E5E5] sticky top-4">
              <h2 className="text-base font-medium text-[#525252] mb-3">
                Project Links & Tags
              </h2>
              <div className="space-y-2">
                {story.url && (
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-[#545454] flex-shrink-0" />
                    <a
                      href={story.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                      title={story.url}
                    >
                      {story.url}
                    </a>
                  </div>
                )}

                {story.videoUrl && story.videoUrl.trim() && (
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-[#545454] flex-shrink-0" />
                    <a
                      href={story.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                      title={story.videoUrl}
                    >
                      Video Demo
                    </a>
                  </div>
                )}

                {/* GitHub Link - Always shown if available */}
                {story.githubUrl && story.githubUrl.trim() && (
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-[#545454] flex-shrink-0" />
                    <a
                      href={story.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                      title={story.githubUrl}
                    >
                      GitHub Repository
                    </a>
                  </div>
                )}

                {/* Dynamic Form Fields */}
                {enabledFormFields
                  ?.filter((field) => field.key !== "githubUrl")
                  .map((field) => {
                    const fieldValue = (story as any)[field.storyPropertyName];
                    if (!fieldValue) return null;

                    // Get appropriate icon based on field key or type
                    const getIcon = () => {
                      if (field.key.toLowerCase().includes("github")) {
                        return (
                          <Github className="w-4 h-4 text-[#545454] flex-shrink-0" />
                        );
                      } else if (field.key.toLowerCase().includes("linkedin")) {
                        return (
                          <Linkedin className="w-4 h-4 text-[#545454] flex-shrink-0" />
                        );
                      } else if (
                        field.key.toLowerCase().includes("twitter") ||
                        field.key.toLowerCase().includes("x")
                      ) {
                        return (
                          <Twitter className="w-4 h-4 text-[#545454] flex-shrink-0" />
                        );
                      } else if (field.key.toLowerCase().includes("chef")) {
                        return (
                          <span className="w-4 h-4 text-[#545454] flex-shrink-0">
                            🍲
                          </span>
                        );
                      } else if (field.fieldType === "url") {
                        return (
                          <Link2 className="w-4 h-4 text-[#545454] flex-shrink-0" />
                        );
                      } else if (field.fieldType === "email") {
                        return (
                          <span className="w-4 h-4 text-[#545454] flex-shrink-0">
                            ✉️
                          </span>
                        );
                      } else {
                        return (
                          <span className="w-4 h-4 text-[#545454] flex-shrink-0">
                            🔗
                          </span>
                        );
                      }
                    };

                    // Get display label
                    const getDisplayLabel = () => {
                      // Remove "(Optional)" and other common suffixes for cleaner display
                      return field.label
                        .replace(/\s*\(Optional\).*$/i, "")
                        .trim();
                    };

                    return (
                      <div key={field._id} className="flex items-center gap-2">
                        {getIcon()}
                        {field.fieldType === "url" ? (
                          <a
                            href={fieldValue}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                            title={fieldValue}
                          >
                            {getDisplayLabel()}
                          </a>
                        ) : field.fieldType === "email" ? (
                          <a
                            href={`mailto:${fieldValue}`}
                            className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                            title={fieldValue}
                          >
                            {getDisplayLabel()}
                          </a>
                        ) : (
                          <span
                            className="text-sm text-[#525252] truncate"
                            title={fieldValue}
                          >
                            {getDisplayLabel()}: {fieldValue}
                          </span>
                        )}
                      </div>
                    );
                  })}

                {/* Tags */}
                {story.tags && story.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap pt-2 border-t border-[#E5E5E5] mt-3">
                    {(story.tags || []).map(
                      (tag: Doc<"tags">) =>
                        !tag.isHidden &&
                        tag.name !== "resendhackathon" &&
                        tag.name !== "ychackathon" && (
                          <Link
                            key={tag._id}
                            to={`/tag/${tag.slug}`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                            style={{
                              backgroundColor: tag.backgroundColor || "#F4F0ED",
                              color: tag.textColor || "#525252",
                              border: `1px solid ${tag.borderColor || (tag.backgroundColor ? "transparent" : "#D5D3D0")}`,
                            }}
                            title={`View all apps tagged with ${tag.name}`}
                          >
                            {tag.emoji && (
                              <span className="mr-1">{tag.emoji}</span>
                            )}
                            {tag.iconUrl && !tag.emoji && (
                              <img
                                src={tag.iconUrl}
                                alt=""
                                className="w-3 h-3 mr-1 rounded-sm object-cover"
                              />
                            )}
                            {tag.name}
                          </Link>
                        ),
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Changelog Link */}
            <div className="mt-4 pt-3 border-t border-[#E5E5E5]">
              <a
                href="#changelog"
                className="flex items-center gap-2 text-sm text-[#525252] hover:text-[#292929] hover:underline"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                View Change Log
              </a>
            </div>
            <Link
              to="/"
              className="text-[#545454] hover:text-[#525252] inline-block mb-6 text-sm mt-[1.5625rem]"
            >
              ← Back to Apps List
            </Link>
          </div>
        )}
      </div>

      {/* Edit Form Section */}
      {isEditing && currentUser && story.userId === currentUser._id && (
        <div
          id="edit-submission-form"
          className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC]"
        >
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-[#525252]">
                Edit Submission
              </h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEditCancel}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isSubmitting ||
                    !editFormData.title ||
                    !editFormData.description ||
                    !editFormData.url
                  }
                  className="text-xs bg-[#292929] text-white hover:bg-[#525252]"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>

            <div>
              {/* Additional Images (Gallery) Upload & Manage */}
              <label className="block text-sm font-medium text-[#525252] mb-1">
                Additional Images (max 4)
              </label>
              {(existingAdditionalImages.length > 0 ||
                newAdditionalImages.length > 0) && (
                <div className="mb-2 text-sm text-[#545454]">
                  {existingAdditionalImages.length + newAdditionalImages.length}
                  /4 selected
                </div>
              )}
              <div className="flex flex-wrap gap-3 mb-3">
                {existingAdditionalImages.map(
                  (img: { id: Id<"_storage">; url: string }, index: number) => (
                    <div key={`exist-${index}`} className="relative">
                      <img
                        src={img.url}
                        alt={`Additional ${index + 1}`}
                        className="w-24 h-24 object-cover rounded border border-[#D8E1EC]"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingAdditionalImage(index)}
                        disabled={isSubmitting}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 disabled:opacity-50"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ),
                )}
                {newAdditionalPreviewUrls.map((url: string, index: number) => (
                  <div key={`new-${index}`} className="relative">
                    <img
                      src={url}
                      alt={`New Additional ${index + 1}`}
                      className="w-24 h-24 object-cover rounded border border-[#D8E1EC]"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewAdditionalImage(index)}
                      disabled={isSubmitting}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 disabled:opacity-50"
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleAdditionalImagesChange}
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#F4F0ED] file:text-[#525252] hover:file:bg-[#e5e1de]"
                disabled={
                  isSubmitting ||
                  existingAdditionalImages.length +
                    newAdditionalImages.length >=
                    4
                }
              />
            </div>
            <div>
              <label
                htmlFor="edit-title"
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                App Title *
              </label>
              <input
                type="text"
                id="edit-title"
                placeholder="Site name"
                value={editFormData.title}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="edit-description"
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                App/Project Tagline *
              </label>
              <input
                type="text"
                id="edit-description"
                placeholder="One sentence pitch or description"
                value={editFormData.description}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="edit-longDescription"
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                Description (Optional)
              </label>
              <textarea
                id="edit-longDescription"
                placeholder="- What it does&#10;- Key Features&#10;- How you built it"
                value={editFormData.longDescription}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    longDescription: e.target.value,
                  }))
                }
                rows={4}
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="edit-url"
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                App Website Link *
              </label>
              <input
                type="url"
                id="edit-url"
                placeholder="https://"
                value={editFormData.url}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, url: e.target.value }))
                }
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="edit-videoUrl"
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                Video Demo (Optional)
              </label>
              <input
                type="url"
                id="edit-videoUrl"
                placeholder="https://youtube.com/..."
                value={editFormData.videoUrl}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    videoUrl: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                disabled={isSubmitting}
              />
            </div>

            {/* Screenshot Upload Section */}
            <div>
              <label className="block text-sm font-medium text-[#525252] mb-2">
                Screenshot (Optional)
              </label>

              {/* Current Screenshot Display */}
              {currentScreenshot && !removeScreenshot && !screenshotPreview && (
                <div className="mb-3">
                  <div className="text-sm text-[#545454] mb-2">
                    Current screenshot:
                  </div>
                  <div className="relative inline-block">
                    <img
                      src={currentScreenshot}
                      alt="Current screenshot"
                      className="max-w-xs max-h-32 rounded-md border border-[#D8E1EC] object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveScreenshot}
                      disabled={isSubmitting}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 disabled:opacity-50"
                      title="Remove screenshot"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* New Screenshot Preview */}
              {screenshotPreview && (
                <div className="mb-3">
                  <div className="text-sm text-[#545454] mb-2">
                    New screenshot:
                  </div>
                  <div className="relative inline-block">
                    <img
                      src={screenshotPreview}
                      alt="New screenshot preview"
                      className="max-w-xs max-h-32 rounded-md border border-[#D8E1EC] object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleKeepCurrentScreenshot}
                      disabled={isSubmitting}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 disabled:opacity-50"
                      title="Cancel new screenshot"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Removed Screenshot Message */}
              {removeScreenshot && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                  <div className="text-sm text-red-700">
                    Screenshot will be removed when you save.
                  </div>
                  <button
                    type="button"
                    onClick={handleKeepCurrentScreenshot}
                    disabled={isSubmitting}
                    className="text-sm text-red-600 hover:text-red-800 underline mt-1"
                  >
                    Keep current screenshot
                  </button>
                </div>
              )}

              {/* File Upload Input */}
              <input
                type="file"
                id="edit-screenshot"
                accept="image/*"
                onChange={handleScreenshotFileChange}
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#F4F0ED] file:text-[#525252] hover:file:bg-[#e5e1de]"
                disabled={isSubmitting}
              />

              {newScreenshotFile && (
                <div className="text-sm text-[#545454] mt-1">
                  Selected: {newScreenshotFile.name}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-submitterName"
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                Your Name *
              </label>
              <input
                type="text"
                id="edit-submitterName"
                placeholder="Your name"
                value={editFormData.submitterName}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    submitterName: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* GitHub URL Field - Always Shown */}
            <div>
              <label
                htmlFor="edit-githubUrl"
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                GitHub Repo URL (Optional)
              </label>
              <div className="text-sm text-[#545454] mb-2">
                GitHub repository URL for your project
              </div>
              <input
                type="url"
                id="edit-githubUrl"
                placeholder="https://github.com/username/repository"
                value={editDynamicFormData.githubUrl || ""}
                onChange={(e) =>
                  setEditDynamicFormData((prev) => ({
                    ...prev,
                    githubUrl: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                disabled={isSubmitting}
              />
            </div>

            {/* Dynamic Form Fields */}
            {enabledFormFields
              ?.filter((field) => field.key !== "githubUrl")
              .map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`edit-${field.key}`}
                    className="block text-sm font-medium text-[#525252] mb-1"
                  >
                    {field.label}
                  </label>
                  {field.description && (
                    <div className="text-sm text-[#545454] mb-2">
                      {field.description}
                    </div>
                  )}
                  <input
                    type={field.fieldType}
                    id={`edit-${field.key}`}
                    placeholder={field.placeholder}
                    value={editDynamicFormData[field.key] || ""}
                    onChange={(e) =>
                      setEditDynamicFormData((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                    required={field.isRequired}
                    disabled={isSubmitting}
                  />
                </div>
              ))}

            {/* Hackathon Team Info Section */}
            {settings?.showHackathonTeamInfo && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setShowTeamInfo(!showTeamInfo)}
                    className="flex items-center gap-2 text-sm font-medium text-[#525252] hover:text-[#292929] transition-colors"
                  >
                    <span
                      className={`transform transition-transform ${showTeamInfo ? "rotate-90" : ""}`}
                    >
                      ▶
                    </span>
                    Team Info (Optional)
                  </button>
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  Add your hackathon team information if you're participating as
                  a team
                </p>

                {showTeamInfo && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                    {/* Team Name */}
                    <div>
                      <label
                        htmlFor="edit-teamName"
                        className="block text-sm font-medium text-[#525252] mb-1"
                      >
                        Team Name
                      </label>
                      <input
                        type="text"
                        id="edit-teamName"
                        placeholder="Enter your team name"
                        value={teamData.teamName}
                        onChange={(e) =>
                          setTeamData((prev) => ({
                            ...prev,
                            teamName: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                        disabled={isSubmitting}
                      />
                    </div>

                    {/* Number of Team Members */}
                    <div>
                      <label
                        htmlFor="edit-teamMemberCount"
                        className="block text-sm font-medium text-[#525252] mb-1"
                      >
                        Number of Team Members
                      </label>
                      <input
                        type="number"
                        id="edit-teamMemberCount"
                        min="1"
                        max="10"
                        value={teamData.teamMemberCount}
                        onChange={(e) =>
                          handleTeamMemberCountChange(
                            parseInt(e.target.value) || 1,
                          )
                        }
                        className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] max-w-[120px]"
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum 10 team members
                      </p>
                    </div>

                    {/* Team Members */}
                    <div>
                      <h4 className="text-sm font-medium text-[#525252] mb-3">
                        Team Members
                      </h4>
                      <div className="space-y-3">
                        {teamData.teamMembers.map((member, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-1 md:grid-cols-2 gap-3"
                          >
                            <div>
                              <label
                                htmlFor={`edit-member-name-${index}`}
                                className="block text-xs font-medium text-[#525252] mb-1"
                              >
                                Member {index + 1} Name
                              </label>
                              <input
                                type="text"
                                id={`edit-member-name-${index}`}
                                placeholder="Full name"
                                value={member.name}
                                onChange={(e) =>
                                  handleTeamMemberChange(
                                    index,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] text-sm"
                                disabled={isSubmitting}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`edit-member-email-${index}`}
                                className="block text-xs font-medium text-[#525252] mb-1"
                              >
                                Member {index + 1} Email
                              </label>
                              <input
                                type="email"
                                id={`edit-member-email-${index}`}
                                placeholder="email@example.com"
                                value={member.email}
                                onChange={(e) =>
                                  handleTeamMemberChange(
                                    index,
                                    "email",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] text-sm"
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tags Selection */}
            <div>
              <label className="block text-sm font-medium text-[#525252] mb-2">
                Select Tags *
              </label>
              <span className="text-xs text-gray-600 mb-2 block">
                Select tags that best describe your app
              </span>
              <div className="flex flex-wrap gap-2 mb-4">
                {availableTags === undefined && (
                  <span className="text-sm text-gray-500">Loading tags...</span>
                )}
                {availableTags
                  ?.filter(
                    (tag) =>
                      tag.name !== "resendhackathon" &&
                      tag.name !== "ychackathon",
                  )
                  .map((tag) => (
                    <button
                      key={tag._id}
                      type="button"
                      onClick={() => toggleTag(tag._id)}
                      disabled={isSubmitting}
                      className={`px-3 py-1 rounded-md text-sm transition-colors border flex items-center gap-1 ${
                        selectedTagIds.includes(tag._id)
                          ? "bg-[#F4F0ED] text-[#292929] border-[#D5D3D0]"
                          : "bg-white text-[#545454] border-[#D5D3D0] hover:border-[#A8A29E] hover:text-[#525252]"
                      }`}
                      style={{
                        backgroundColor: selectedTagIds.includes(tag._id)
                          ? tag.backgroundColor || "#F4F0ED"
                          : "white",
                        color: selectedTagIds.includes(tag._id)
                          ? tag.textColor || "#292929"
                          : "#545454",
                        borderColor: selectedTagIds.includes(tag._id)
                          ? tag.borderColor ||
                            (tag.backgroundColor ? "transparent" : "#D5D3D0")
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
                    </button>
                  ))}
              </div>

              {/* Dropdown Search for All Tags */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#525252] mb-2">
                  Search All Available Tags
                </label>
                <span className="text-xs text-gray-600 mb-2 block">
                  Find and select from all tags, including those not shown above
                </span>
                <div className="relative tag-dropdown-container">
                  <input
                    type="text"
                    value={dropdownSearchValue}
                    onChange={(e) => {
                      setDropdownSearchValue(e.target.value);
                      setShowDropdown(e.target.value.length > 0);
                    }}
                    onFocus={() =>
                      setShowDropdown(dropdownSearchValue.length > 0)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        // Try to select first matching tag or create new tag
                        if (allTags) {
                          const searchTerm = dropdownSearchValue.toLowerCase();
                          const filteredTags = allTags.filter(
                            (tag) =>
                              tag.name.toLowerCase().includes(searchTerm) &&
                              !selectedTagIds.includes(tag._id) &&
                              !newTagNames.some(
                                (newTag) =>
                                  newTag.toLowerCase() ===
                                  tag.name.toLowerCase(),
                              ),
                          );
                          if (filteredTags.length > 0) {
                            handleSelectFromDropdown(filteredTags[0]._id);
                          } else {
                            handleAddNewTag();
                          }
                        }
                      }
                    }}
                    placeholder="Type to search for tags or create new..."
                    className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] text-sm"
                    disabled={isSubmitting}
                  />

                  {/* Dropdown Results */}
                  {showDropdown && allTags && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-[#D8E1EC] rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {(() => {
                        const searchTerm = dropdownSearchValue.toLowerCase();
                        const filteredTags = allTags
                          .filter(
                            (tag) =>
                              tag.name.toLowerCase().includes(searchTerm) &&
                              !selectedTagIds.includes(tag._id) &&
                              !newTagNames.some(
                                (newTag) =>
                                  newTag.toLowerCase() ===
                                  tag.name.toLowerCase(),
                              ),
                          )
                          .slice(0, 10); // Limit to 10 results

                        if (filteredTags.length === 0) {
                          return (
                            <div>
                              <div className="px-3 py-2 text-sm text-gray-500">
                                No matching tags found
                              </div>
                              <button
                                type="button"
                                onClick={handleAddNewTag}
                                disabled={
                                  isSubmitting ||
                                  !dropdownSearchValue.trim() ||
                                  selectedTagIds.length + newTagNames.length >=
                                    10
                                }
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#F4F0ED] focus:bg-[#F4F0ED] focus:outline-none text-blue-600 disabled:opacity-50"
                              >
                                + Create new tag "{dropdownSearchValue}"
                              </button>
                            </div>
                          );
                        }

                        return (
                          <>
                            {filteredTags.map((tag) => (
                              <button
                                key={tag._id}
                                type="button"
                                onClick={() =>
                                  handleSelectFromDropdown(tag._id)
                                }
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#F4F0ED] focus:bg-[#F4F0ED] focus:outline-none flex items-center gap-2"
                                disabled={isSubmitting}
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
                                    backgroundColor:
                                      tag.backgroundColor || "#F4F0ED",
                                    color: tag.textColor || "#525252",
                                    border: `1px solid ${tag.backgroundColor ? "transparent" : "#D5D3D0"}`,
                                  }}
                                >
                                  {tag.name}
                                </span>
                                {tag.isHidden && (
                                  <span className="text-xs text-gray-400">
                                    (Hidden)
                                  </span>
                                )}
                              </button>
                            ))}
                            {dropdownSearchValue.trim() && (
                              <button
                                type="button"
                                onClick={handleAddNewTag}
                                disabled={
                                  isSubmitting ||
                                  selectedTagIds.length + newTagNames.length >=
                                    10
                                }
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#F4F0ED] focus:bg-[#F4F0ED] focus:outline-none text-blue-600 border-t border-gray-100 disabled:opacity-50"
                              >
                                + Create new tag "{dropdownSearchValue}"
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Tags Display */}
              {(selectedTagIds.length > 0 || newTagNames.length > 0) && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#525252] mb-2">
                    Selected Tags ({selectedTagIds.length + newTagNames.length}
                    /10)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {/* Show selected existing tags */}
                    {allTags &&
                      selectedTagIds.map((tagId) => {
                        const tag = allTags.find((t) => t._id === tagId);
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
                            {tag.isHidden && (
                              <span className="text-xs opacity-70">
                                (Hidden)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleTag(tag._id)}
                              disabled={isSubmitting}
                              className="ml-1 text-current hover:opacity-70 transition-opacity"
                              title="Remove tag"
                            >
                              <span className="text-lg leading-none">×</span>
                            </button>
                          </span>
                        );
                      })}

                    {/* Show new tags being created */}
                    {newTagNames.map((tagName) => (
                      <span
                        key={tagName}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm border border-blue-200"
                      >
                        {tagName}
                        <span className="text-xs opacity-70">(New)</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewTag(tagName)}
                          disabled={isSubmitting}
                          className="ml-1 text-blue-500 hover:text-blue-700 transition-colors"
                          title="Remove tag"
                        >
                          <span className="text-lg leading-none">×</span>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTagIds.length === 0 && newTagNames.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Please select or add at least one tag.
                </p>
              )}
              {selectedTagIds.length + newTagNames.length >= 10 && (
                <p className="text-xs text-amber-600 mt-1">
                  Maximum of 10 tags reached. Remove a tag to add another.
                </p>
              )}
            </div>

            {editError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {editError}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Mobile Project Links & Tags Section - Show above video demo on mobile */}
      {!isEditing &&
        (story.url ||
          story.videoUrl ||
          story.githubUrl ||
          enabledFormFields?.some(
            (field) => (story as any)[field.storyPropertyName],
          ) ||
          story.tags?.length > 0) && (
          <div className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC] lg:hidden">
            <h2 className="text-lg font-medium text-[#525252] mb-4">
              Project Links & Tags
            </h2>
            <div className="space-y-3">
              {story.url && (
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#545454] flex-shrink-0" />
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                    title={story.url}
                  >
                    {story.url}
                  </a>
                </div>
              )}

              {story.videoUrl && story.videoUrl.trim() && (
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#545454] flex-shrink-0" />
                  <a
                    href={story.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                    title={story.videoUrl}
                  >
                    Video Demo
                  </a>
                </div>
              )}

              {/* GitHub Link - Always shown if available */}
              {story.githubUrl && story.githubUrl.trim() && (
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-[#545454] flex-shrink-0" />
                  <a
                    href={story.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                    title={story.githubUrl}
                  >
                    GitHub Repository
                  </a>
                </div>
              )}

              {/* Dynamic Form Fields */}
              {enabledFormFields
                ?.filter((field) => field.key !== "githubUrl")
                .map((field) => {
                  const fieldValue = (story as any)[field.storyPropertyName];
                  if (!fieldValue) return null;

                  // Get appropriate icon based on field key or type
                  const getIcon = () => {
                    if (field.key.toLowerCase().includes("github")) {
                      return (
                        <Github className="w-4 h-4 text-[#545454] flex-shrink-0" />
                      );
                    } else if (field.key.toLowerCase().includes("linkedin")) {
                      return (
                        <Linkedin className="w-4 h-4 text-[#545454] flex-shrink-0" />
                      );
                    } else if (
                      field.key.toLowerCase().includes("twitter") ||
                      field.key.toLowerCase().includes("x")
                    ) {
                      return (
                        <Twitter className="w-4 h-4 text-[#545454] flex-shrink-0" />
                      );
                    } else if (field.key.toLowerCase().includes("chef")) {
                      return (
                        <span className="w-4 h-4 text-[#545454] flex-shrink-0">
                          🍲
                        </span>
                      );
                    } else if (field.fieldType === "url") {
                      return (
                        <Link2 className="w-4 h-4 text-[#545454] flex-shrink-0" />
                      );
                    } else if (field.fieldType === "email") {
                      return (
                        <span className="w-4 h-4 text-[#545454] flex-shrink-0">
                          ✉️
                        </span>
                      );
                    } else {
                      return (
                        <span className="w-4 h-4 text-[#545454] flex-shrink-0">
                          🔗
                        </span>
                      );
                    }
                  };

                  // Get display label
                  const getDisplayLabel = () => {
                    // Remove "(Optional)" and other common suffixes for cleaner display
                    return field.label
                      .replace(/\s*\(Optional\).*$/i, "")
                      .trim();
                  };

                  return (
                    <div key={field._id} className="flex items-center gap-2">
                      {getIcon()}
                      {field.fieldType === "url" ? (
                        <a
                          href={fieldValue}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                          title={fieldValue}
                        >
                          {getDisplayLabel()}
                        </a>
                      ) : field.fieldType === "email" ? (
                        <a
                          href={`mailto:${fieldValue}`}
                          className="text-sm text-[#525252] hover:text-[#292929] hover:underline truncate"
                          title={fieldValue}
                        >
                          {getDisplayLabel()}
                        </a>
                      ) : (
                        <span
                          className="text-sm text-[#525252] truncate"
                          title={fieldValue}
                        >
                          {getDisplayLabel()}: {fieldValue}
                        </span>
                      )}
                    </div>
                  );
                })}

              {/* Tags */}
              {story.tags && story.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap pt-3 border-t border-[#E5E5E5] mt-4">
                  {(story.tags || []).map(
                    (tag: Doc<"tags">) =>
                      !tag.isHidden &&
                      tag.name !== "resendhackathon" &&
                      tag.name !== "ychackathon" && (
                        <Link
                          key={tag._id}
                          to={`/tag/${tag.slug}`}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: tag.backgroundColor || "#F4F0ED",
                            color: tag.textColor || "#525252",
                            border: `1px solid ${tag.borderColor || (tag.backgroundColor ? "transparent" : "#D5D3D0")}`,
                          }}
                          title={`View all apps tagged with ${tag.name}`}
                        >
                          {tag.emoji && (
                            <span className="mr-1">{tag.emoji}</span>
                          )}
                          {tag.iconUrl && !tag.emoji && (
                            <img
                              src={tag.iconUrl}
                              alt=""
                              className="w-3 h-3 mr-1 rounded-sm object-cover"
                            />
                          )}
                          {tag.name}
                        </Link>
                      ),
                  )}
                </div>
              )}

              {/* Changelog Link */}
              <div className="pt-3 border-t border-[#E5E5E5] mt-4">
                <a
                  href="#changelog"
                  className="flex items-center gap-2 text-sm text-[#525252] hover:text-[#292929] hover:underline"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  View Change Log
                </a>
              </div>
            </div>
          </div>
        )}

      {/* Video demo start */}
      {story.videoUrl && story.videoUrl.trim() && (
        <div className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC]">
          <div className="flex items-center gap-2 mb-4">
            <Play className="w-4 h-4 text-[#545454] flex-shrink-0" />
            <h3 className="text-lg font-medium text-[#525252]">Video Demo</h3>
            <a
              href={story.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#525252] hover:text-[#292929] hover:underline ml-auto"
              title="Open in new tab"
            >
              ↗
            </a>
          </div>
          <div className="w-full">
            {(() => {
              const url = story.videoUrl.trim();

              // YouTube URL patterns (including Shorts)
              const youtubeMatch = url.match(
                /(?:youtube\.com\/(?:shorts\/|[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
              );
              if (youtubeMatch) {
                const videoId = youtubeMatch[1];
                return (
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    className="w-full aspect-video rounded-md"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    title="Video Demo"
                  />
                );
              }

              // Vimeo URL patterns
              const vimeoMatch = url.match(/(?:vimeo\.com\/)(?:.*\/)?(\d+)/);
              if (vimeoMatch) {
                const videoId = vimeoMatch[1];
                return (
                  <iframe
                    src={`https://player.vimeo.com/video/${videoId}`}
                    className="w-full aspect-video rounded-md"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    title="Video Demo"
                  />
                );
              }

              // Loom URL patterns
              const loomMatch = url.match(/(?:loom\.com\/share\/)([a-f0-9-]+)/);
              if (loomMatch) {
                const videoId = loomMatch[1];
                return (
                  <iframe
                    src={`https://www.loom.com/embed/${videoId}`}
                    className="w-full aspect-video rounded-md"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    title="Video Demo"
                  />
                );
              }

              // Google Drive URL patterns
              const driveMatch = url.match(
                /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
              );
              if (driveMatch) {
                const fileId = driveMatch[1];
                return (
                  <iframe
                    src={`https://drive.google.com/file/d/${fileId}/preview`}
                    className="w-full aspect-video rounded-md"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    title="Video Demo"
                  />
                );
              }

              // Check if it's a direct video file
              const videoExtensions = /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i;
              if (videoExtensions.test(url)) {
                return (
                  <video
                    src={url}
                    className="w-full aspect-video rounded-md bg-black"
                    controls
                    preload="metadata"
                    title="Video Demo"
                  >
                    Your browser does not support the video tag.
                  </video>
                );
              }

              // Fallback for other URLs - show as link in a styled box
              return (
                <div className="w-full aspect-video rounded-md border-2 border-dashed border-[#D8E1EC] flex items-center justify-center bg-[#F9F9F9]">
                  <div className="text-center">
                    <Play className="w-12 h-12 text-[#545454] mx-auto mb-2" />
                    <p className="text-[#525252] mb-2">Video not embeddable</p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#292929] hover:text-[#525252] underline"
                    >
                      Watch Video ↗
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* Video demo end */}

      {/* Team Info Section */}
      {!isEditing && story.teamName && (
        <div className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC]">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#545454]" />
            <h2 className="text-lg font-medium text-[#525252]">Team Info</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-[#525252] mb-1">
                Team Name
              </h3>
              <p className="text-[#292929]">{story.teamName}</p>
            </div>

            {story.teamMemberCount && (
              <div>
                <h3 className="text-sm font-medium text-[#525252] mb-1">
                  Team Size
                </h3>
                <p className="text-[#292929]">
                  {story.teamMemberCount}{" "}
                  {story.teamMemberCount === 1 ? "member" : "members"}
                </p>
              </div>
            )}

            {story.teamMembers && story.teamMembers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#525252] mb-2">
                  Team Members
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {story.teamMembers.map(
                    (
                      member: { name: string; email: string },
                      index: number,
                    ) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-md border border-gray-200"
                      >
                        {member.name && (
                          <p className="font-medium text-[#292929] text-sm">
                            {member.name}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rating Section */}
      {!isEditing && (
        <div className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
            <h2 className="text-lg font-medium text-[#525252]">
              {hasRated ? "Your Rating" : "Rate this app"}
            </h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => handleRating(value)}
                  onMouseEnter={() => !hasRated && setHoveredRating(value)} // Only hover if not rated
                  onMouseLeave={() => setHoveredRating(0)}
                  disabled={!isClerkLoaded || (isSignedIn && hasRated)} // Disable if not loaded, or if signed in AND already rated
                  className={`p-1 transition-colors disabled:cursor-not-allowed ${
                    !isSignedIn && isClerkLoaded ? "opacity-50 cursor-help" : ""
                  } ${
                    hasRated
                      ? value <= (currentUserRating || 0)
                        ? "text-yellow-500"
                        : "text-gray-300"
                      : value <= (hoveredRating || 0)
                        ? "text-yellow-400"
                        : "text-gray-300 hover:text-yellow-400"
                  }`}
                  title={
                    !isSignedIn && isClerkLoaded
                      ? "Sign in to rate"
                      : hasRated
                        ? `You rated ${currentUserRating} star(s)`
                        : `Rate ${value} stars`
                  }
                >
                  <Star className="w-5 h-5 fill-current" />
                </button>
              ))}
            </div>
            {story.ratingCount > 0 && (
              <span className="text-sm text-[#545454]">
                {averageRating.toFixed(1)} stars ({story.ratingCount}
                {story.ratingCount === 1 ? " rating" : " ratings"})
              </span>
            )}
          </div>
          <p className="text-sm text-[#545454]">
            Your rating helps others discover great apps.
          </p>
        </div>
      )}

      {/* Changelog Section */}
      {!isEditing && (
        <div
          id="changelog"
          className="mt-8 bg-white rounded-lg p-6 border border-[#D8E1EC] scroll-mt-20"
        >
          <h2 className="text-lg font-medium text-[#525252] mb-4">
            Change Log
          </h2>

          {/* Original Submission Date */}
          <div className="mb-6 pb-4 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-2 text-sm text-[#545454]">
              <span className="font-medium text-[#292929]">
                Originally submitted:
              </span>
              <span>
                {new Date(story._creationTime).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                at{" "}
                {new Date(story._creationTime).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {story.changeLog && story.changeLog.length > 0 ? (
            <div className="space-y-3">
              {story.changeLog
                .slice()
                .reverse()
                .map(
                  (
                    entry: NonNullable<typeof story.changeLog>[number],
                    index: number,
                  ) => {
                    const isExpanded = expandedChangelogIndices.has(index);
                    const toggleExpanded = () => {
                      const newSet = new Set(expandedChangelogIndices);
                      if (isExpanded) {
                        newSet.delete(index);
                      } else {
                        newSet.add(index);
                      }
                      setExpandedChangelogIndices(newSet);
                    };

                    const changeDate = new Date(entry.timestamp);
                    const formattedDate = changeDate.toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    );
                    const formattedTime = changeDate.toLocaleTimeString(
                      undefined,
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    );

                    const hasChanges =
                      (entry.textChanges && entry.textChanges.length > 0) ||
                      (entry.linkChanges && entry.linkChanges.length > 0) ||
                      entry.tagChanges ||
                      entry.videoChanged ||
                      entry.imagesChanged;

                    if (!hasChanges) return null;

                    return (
                      <div
                        key={index}
                        className="border border-[#E5E5E5] rounded-md overflow-hidden"
                      >
                        <button
                          onClick={toggleExpanded}
                          className="w-full px-4 py-3 bg-[#F9F9F9] hover:bg-[#F4F0ED] transition-colors flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            >
                              ▶
                            </span>
                            <span className="text-sm font-medium text-[#525252]">
                              {formattedDate} at {formattedTime}
                            </span>
                          </div>
                          <span className="text-xs text-[#787672]">
                            {isExpanded ? "Hide changes" : "Show changes"}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="p-4 space-y-4">
                            {/* Text Changes */}
                            {entry.textChanges &&
                              entry.textChanges.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-[#525252] mb-2">
                                    Text Changes
                                  </h4>
                                  <ul className="space-y-2">
                                    {entry.textChanges.map(
                                      (
                                        change: {
                                          field: string;
                                          oldValue: string;
                                          newValue: string;
                                        },
                                        idx: number,
                                      ) => (
                                        <li key={idx} className="text-sm">
                                          <span className="font-medium text-[#292929]">
                                            {change.field}:
                                          </span>
                                          <div className="ml-4 mt-1">
                                            <div className="text-red-600 line-through">
                                              {change.oldValue || "(empty)"}
                                            </div>
                                            <div className="text-green-600">
                                              {change.newValue || "(empty)"}
                                            </div>
                                          </div>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}

                            {/* Link Changes */}
                            {entry.linkChanges &&
                              entry.linkChanges.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-[#525252] mb-2">
                                    Link Changes
                                  </h4>
                                  <ul className="space-y-2">
                                    {entry.linkChanges.map(
                                      (
                                        change: {
                                          field: string;
                                          oldValue?: string;
                                          newValue?: string;
                                        },
                                        idx: number,
                                      ) => (
                                        <li key={idx} className="text-sm">
                                          <span className="font-medium text-[#292929]">
                                            {change.field}:
                                          </span>
                                          <div className="ml-4 mt-1 break-all">
                                            {change.oldValue && (
                                              <div className="text-red-600 line-through">
                                                {change.oldValue}
                                              </div>
                                            )}
                                            {change.newValue && (
                                              <div className="text-green-600">
                                                {change.newValue}
                                              </div>
                                            )}
                                            {!change.oldValue &&
                                              !change.newValue && (
                                                <div className="text-[#787672]">
                                                  (removed)
                                                </div>
                                              )}
                                          </div>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}

                            {/* Tag Changes */}
                            {entry.tagChanges &&
                              (entry.tagChanges.added.length > 0 ||
                                entry.tagChanges.removed.length > 0) && (
                                <div>
                                  <h4 className="text-sm font-medium text-[#525252] mb-2">
                                    Tag Changes
                                  </h4>
                                  <div className="space-y-1">
                                    {entry.tagChanges.added.length > 0 && (
                                      <div className="text-sm">
                                        <span className="text-green-600 font-medium">
                                          Added:
                                        </span>{" "}
                                        {entry.tagChanges.added.join(", ")}
                                      </div>
                                    )}
                                    {entry.tagChanges.removed.length > 0 && (
                                      <div className="text-sm">
                                        <span className="text-red-600 font-medium">
                                          Removed:
                                        </span>{" "}
                                        {entry.tagChanges.removed.join(", ")}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Video Changed */}
                            {entry.videoChanged && (
                              <div className="text-sm text-[#545454]">
                                <span className="font-medium text-[#292929]">
                                  Video:
                                </span>{" "}
                                Video demo was updated
                              </div>
                            )}

                            {/* Images Changed */}
                            {entry.imagesChanged && (
                              <div className="text-sm text-[#545454]">
                                <span className="font-medium text-[#292929]">
                                  Images:
                                </span>{" "}
                                Screenshots or gallery images were updated
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">
                No changes have been made to this submission yet. All future
                edits will be tracked and displayed here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Comments Section */}
      {!isEditing && (
        <div id="comments" className="mt-8 scroll-mt-20">
          <h2 className="text-xl font-medium text-[#525252] mb-4">
            {comments?.length ?? 0}{" "}
            {(comments?.length ?? 0) === 1 ? "Comment" : "Comments"}
          </h2>
          <CommentForm onSubmit={handleCommentSubmit} />
          <div className="mt-8 space-y-6 border-t border-[#F4F0ED] pt-6">
            {comments === undefined && <div>Loading comments...</div>}
            {comments?.map((commentData) => {
              // Rename variable to avoid conflict
              // Ensure commentData conforms to CommentType, though validation should happen in backend
              const comment = commentData as CommentType;
              return (
                <React.Fragment key={comment._id}>
                  <Comment
                    comment={comment}
                    onReply={(parentId) => setReplyToId(parentId)}
                  />
                  {replyToId === comment._id && (
                    <div className="pl-8 pt-4">
                      <CommentForm
                        onSubmit={handleCommentSubmit}
                        parentId={comment._id}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {comments && comments.length === 0 && (
              <div className="text-[#545454]">
                No comments yet. Be the first!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Related Apps Section */}
      {!isEditing && relatedStories && relatedStories.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-medium text-[#525252] mb-6">
            Related Apps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedStories.map((relatedStory: Story) => (
              <div
                key={relatedStory._id}
                className="bg-white rounded-lg p-4 border border-[#D8E1EC] flex flex-col group"
              >
                {relatedStory.screenshotUrl && (
                  <Link
                    to={`/s/${relatedStory.slug}`}
                    className="mb-3 block overflow-hidden rounded-md aspect-video"
                  >
                    <img
                      src={relatedStory.screenshotUrl}
                      alt={`${relatedStory.title} screenshot`}
                      className="w-full h-full object-cover bg-gray-100 group-hover:scale-105 transition-transform duration-300 ease-in-out"
                      loading="lazy"
                    />
                  </Link>
                )}
                <h3 className="text-lg font-semibold text-[#292929] mb-1 truncate">
                  <Link
                    to={`/s/${relatedStory.slug}`}
                    className="hover:text-[#555555] hover:underline"
                  >
                    {relatedStory.title}
                  </Link>
                </h3>
                {relatedStory.description && (
                  <p className="text-sm text-[#545454] mb-2 line-clamp-2 flex-grow">
                    {relatedStory.description}
                  </p>
                )}
                <p
                  className={`text-xs text-[#545454] mb-2 ${relatedStory.description ? "" : "flex-grow"}`}
                >
                  By{" "}
                  {relatedStory.authorName ||
                    relatedStory.authorUsername ||
                    "Anonymous"}
                </p>
                <div className="flex items-center text-xs text-[#545454] gap-3 mt-auto pt-2 border-t border-[#F4F0ED]">
                  <span>{relatedStory.votes} vibes</span>
                  {/* <span>{relatedStory.commentCount ?? 0} comments</span> */}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Submission Section */}
      {!isEditing &&
        isClerkLoaded &&
        isSignedIn &&
        currentUser &&
        story.userId === currentUser._id && (
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between text-sm text-blue-600">
            <div className="flex items-center gap-3">
              <Edit3 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="font-medium text-blue-700">
                Want to update your submission?
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-blue-200 text-blue-600 hover:bg-blue-100"
              onClick={() => {
                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.set("edit", "true");
                setSearchParams(newSearchParams);
              }}
            >
              Edit Submission
            </Button>
          </div>
        )}

      {/* Flag/Report Section */}
      {!isEditing && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <Flag className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="font-medium text-gray-700">
              Seen something inappropriate?
            </span>
          </div>
          {isClerkLoaded && isSignedIn ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleOpenReportModal}
            >
              Report this Submission
            </Button>
          ) : isClerkLoaded && !isSignedIn ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => navigate("/sign-in")}
              title="Sign in to report content"
            >
              Sign in to Report
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="text-xs" disabled>
              Loading...
            </Button>
          )}
        </div>
      )}

      {/* Report Modal */}
      <Dialog
        open={isReportModalOpen}
        onOpenChange={handleReportModalOpenChange}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Report: {story.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-gray-500">
              Please provide a reason for reporting this submission. Your report
              will be reviewed by an administrator.
            </p>
            <Textarea
              placeholder="Reason for reporting..."
              value={reportReason}
              onChange={(e) => {
                setReportReason(e.target.value);
                if (reportModalError && e.target.value.trim()) {
                  setReportModalError(null);
                }
              }}
              rows={4}
              disabled={isReporting}
            />
          </div>
          {reportModalError && (
            <div className="mb-3 p-2 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md">
              {reportModalError}
            </div>
          )}
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsReportModalOpen(false);
                setReportModalError(null);
              }}
              disabled={isReporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReportSubmit}
              disabled={isReporting || !reportReason.trim()}
              className="bg-[#292929] text-white hover:bg-[#525252] disabled:opacity-50 sm:ml-[10px]"
              style={{ fontWeight: "normal" }}
            >
              {isReporting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Required Dialog */}
      <AuthRequiredDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        action={authDialogAction}
      />
    </div>
  );
}
