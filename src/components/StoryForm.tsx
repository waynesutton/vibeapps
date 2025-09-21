import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AuthRequiredDialog } from "./ui/AuthRequiredDialog";

interface Tag extends Doc<"tags"> {
  // Inherits _id, _creationTime, name, showInHeader, isHidden?, backgroundColor?, textColor?
}

export function StoryForm() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();
  const [selectedTagIds, setSelectedTagIds] = React.useState<Id<"tags">[]>([]);
  const [newTagInputValue, setNewTagInputValue] = React.useState("");
  const [newTagNames, setNewTagNames] = React.useState<string[]>([]);

  // Dropdown search state
  const [dropdownSearchValue, setDropdownSearchValue] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: "",
    tagline: "",
    longDescription: "",
    submitterName: "",
    url: "",
    videoUrl: "",
    email: "",
    image: null as File | null,
  });

  // Additional images state
  const [additionalImages, setAdditionalImages] = React.useState<File[]>([]);
  const [imageModalOpen, setImageModalOpen] = React.useState(false);
  const [imageModalImages, setImageModalImages] = React.useState<string[]>([]);
  const [imageModalCurrentIndex, setImageModalCurrentIndex] = React.useState(0);

  const [dynamicFormData, setDynamicFormData] = React.useState<
    Record<string, string>
  >({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = React.useState(false);

  // Auth required dialog state
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);

  // Hackathon team info state
  const [showTeamInfo, setShowTeamInfo] = React.useState(false);
  const [teamData, setTeamData] = React.useState({
    teamName: "",
    teamMemberCount: 1,
    teamMembers: [{ name: "", email: "" }],
  });

  const MAX_TAGLINE_LENGTH = 140;

  const availableTags = useQuery(api.tags.listHeader);
  const allTags = useQuery(api.tags.listAllForDropdown); // Fetch all tags including hidden ones
  const formFields = useQuery(api.storyFormFields.listEnabled);
  const settings = useQuery(api.settings.get);

  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const submitStory = useMutation(api.stories.submit);

  const handleAddNewTag = () => {
    const tagName = newTagInputValue.trim();
    const totalTags = selectedTagIds.length + newTagNames.length;

    if (totalTags >= 10) {
      setSubmitError("You can select a maximum of 10 tags.");
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
      setNewTagInputValue("");
      setSubmitError(null);
    } else if (tagName) {
      setSubmitError("Tag name already exists or is invalid.");
    }
  };

  const handleRemoveNewTag = (tagName: string) => {
    setNewTagNames((prev) => prev.filter((t) => t !== tagName));
  };

  const handleSelectFromDropdown = (tagId: Id<"tags">) => {
    const totalTags = selectedTagIds.length + newTagNames.length;

    if (totalTags >= 10) {
      setSubmitError("You can select a maximum of 10 tags.");
      return;
    }

    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds((prev) => [...prev, tagId]);
    }
    setDropdownSearchValue("");
    setShowDropdown(false);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check authentication first
    if (!isClerkLoaded) return;
    if (!isSignedIn) {
      setShowAuthDialog(true);
      return;
    }

    const totalTagsSelected = selectedTagIds.length + newTagNames.length;
    if (isSubmitting || totalTagsSelected === 0) {
      if (totalTagsSelected === 0) {
        setSubmitError("Please select or add at least one tag.");
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setShowSuccessMessage(false);

    try {
      let screenshotId: Id<"_storage"> | undefined = undefined;
      let additionalImageIds: Id<"_storage">[] | undefined = undefined;

      // Upload main screenshot
      if (formData.image) {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": formData.image.type },
          body: formData.image,
        });
        const { storageId } = await result.json();
        if (!storageId) {
          throw new Error("Failed to get storage ID after upload.");
        }
        screenshotId = storageId;
      }

      // Upload additional images
      if (additionalImages.length > 0) {
        const uploadPromises = additionalImages.map(async (file) => {
          const postUrl = await generateUploadUrl();
          const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          const { storageId } = await result.json();
          if (!storageId) {
            throw new Error(`Failed to get storage ID for ${file.name}`);
          }
          return storageId;
        });

        additionalImageIds = await Promise.all(uploadPromises);
      }

      await submitStory({
        title: formData.title,
        tagline: formData.tagline,
        longDescription: formData.longDescription || undefined,
        submitterName: formData.submitterName || undefined,
        url: formData.url,
        videoUrl: formData.videoUrl || undefined,
        email: formData.email || undefined,
        tagIds: selectedTagIds,
        newTagNames: newTagNames,
        screenshotId: screenshotId,
        additionalImageIds: additionalImageIds,
        linkedinUrl: dynamicFormData.linkedinUrl || undefined,
        twitterUrl: dynamicFormData.twitterUrl || undefined,
        githubUrl: dynamicFormData.githubUrl || undefined,
        chefShowUrl: dynamicFormData.chefShowUrl || undefined,
        chefAppUrl: dynamicFormData.chefAppUrl || undefined,
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
      });

      setShowSuccessMessage(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Failed to submit story:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "An unknown error occurred during submission.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: Id<"tags">) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        const totalTags = prev.length + newTagNames.length;
        if (totalTags >= 10) {
          setSubmitError("You can select a maximum of 10 tags.");
          return prev;
        }
        setSubmitError(null);
        return [...prev, tagId];
      }
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError("Screenshot file size should not exceed 5MB.");
        e.target.value = "";
        setFormData((prev) => ({ ...prev, image: null }));
      } else {
        setSubmitError(null);
        setFormData((prev) => ({ ...prev, image: file }));
      }
    } else {
      setFormData((prev) => ({ ...prev, image: null }));
    }
  };

  const handleAdditionalImagesChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError(`File ${file.name} exceeds 5MB limit.`);
        continue;
      }
      if (!file.type.startsWith("image/")) {
        setSubmitError(`File ${file.name} is not an image.`);
        continue;
      }
      validFiles.push(file);
    }

    const totalImages = additionalImages.length + validFiles.length;
    if (totalImages > 4) {
      setSubmitError("Maximum of 4 additional images allowed.");
      return;
    }

    setAdditionalImages((prev) => [...prev, ...validFiles]);
    setSubmitError(null);
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const openImageModal = (images: string[]) => {
    setImageModalImages(images);
    setImageModalCurrentIndex(0);
    setImageModalOpen(true);
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setImageModalImages([]);
    setImageModalCurrentIndex(0);
  };

  const navigateImageModal = (direction: "prev" | "next") => {
    setImageModalCurrentIndex((prev) => {
      if (direction === "prev") {
        return prev > 0 ? prev - 1 : imageModalImages.length - 1;
      } else {
        return prev < imageModalImages.length - 1 ? prev + 1 : 0;
      }
    });
  };

  // Keyboard navigation for image modal
  React.useEffect(() => {
    if (!imageModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeImageModal();
          break;
        case "ArrowLeft":
          navigateImageModal("prev");
          break;
        case "ArrowRight":
          navigateImageModal("next");
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [imageModalOpen]);

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

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/"
        className="text-[#545454] hover:text-[#525252] inline-block mb-6"
      >
        ← Back to Apps
      </Link>

      <div className="bg-white p-6 rounded-lg border border-[#D8E1EC]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-[#292929]">Submit your app</h2>{" "}
          <span className="ml-2 text-sm text-gray-600">
            What did you build?
          </span>
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              App Title *
            </label>
            <input
              type="text"
              id="title"
              placeholder="Site name"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="tagline"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              App/Project Tagline*
            </label>
            <input
              type="text"
              id="tagline"
              placeholder="One sentence pitch or description"
              value={formData.tagline}
              onChange={(e) => {
                if (e.target.value.length <= MAX_TAGLINE_LENGTH) {
                  setFormData((prev) => ({ ...prev, tagline: e.target.value }));
                }
              }}
              maxLength={MAX_TAGLINE_LENGTH}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              required
              disabled={isSubmitting}
            />
            <div className="text-xs text-right text-[#545454] mt-1">
              {formData.tagline.length}/{MAX_TAGLINE_LENGTH}
            </div>
          </div>
          <div>
            <label
              htmlFor="longDescription"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Description
            </label>
            <textarea
              id="longDescription"
              placeholder="- Problem you're solving&#10;- How the app works&#10;- Notable features&#10;- Why did you build this&#10;- Modern Stack cohost(s) included&#10;- Tech stack list&#10;- Prize category OpenAI or InKeep (select the correct tag)"
              value={formData.longDescription}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  longDescription: e.target.value,
                }))
              }
              rows={8}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              App Website Link *
            </label>
            <div className="text-sm text-[#545454] mb-2">
              Enter your app url (ex: https://)
            </div>
            <input
              type="url"
              id="url"
              placeholder="https://"
              value={formData.url}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, url: e.target.value }))
              }
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="videoUrl"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Video Demo (Recommended)
            </label>
            <div className="text-sm text-[#545454] mb-2">
              Share a video demo of your app (YouTube, Vimeo, etc.)
            </div>
            <input
              type="url"
              id="videoUrl"
              placeholder="https://youtube.com/..."
              value={formData.videoUrl}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))
              }
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="submitterName"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Your Name *
            </label>
            <input
              type="text"
              id="submitterName"
              placeholder="Your name"
              value={formData.submitterName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  submitterName: e.target.value,
                }))
              }
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Email (Optional)
            </label>
            <div className="text-sm text-[#545454] mb-2">
              Hidden and for hackathon notifications
            </div>
            <input
              type="email"
              id="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="image"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Upload Screenshot (Recommended)
            </label>
            <input
              type="file"
              id="image"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#F4F0ED] file:text-[#525252] hover:file:bg-[#e5e1de]"
              disabled={isSubmitting}
            />
            {formData.image && (
              <div className="text-sm text-[#545454] mt-1">
                Selected: {formData.image.name}
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="additionalImages"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Additional Images (Optional)
            </label>
            <div className="text-sm text-[#545454] mb-2">
              Upload up to 4 additional images to showcase your app
            </div>
            <input
              type="file"
              id="additionalImages"
              accept="image/*"
              multiple
              onChange={handleAdditionalImagesChange}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#F4F0ED] file:text-[#525252] hover:file:bg-[#e5e1de]"
              disabled={isSubmitting || additionalImages.length >= 4}
            />
            {additionalImages.length > 0 && (
              <div className="mt-3">
                <div className="text-sm text-[#545454] mb-2">
                  Selected images ({additionalImages.length}/4):
                </div>
                <div className="flex flex-wrap gap-2">
                  {additionalImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-16 h-16 object-cover rounded border border-[#D8E1EC] cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          const allImages = [
                            ...(formData.image
                              ? [URL.createObjectURL(formData.image)]
                              : []),
                            ...additionalImages.map((f) =>
                              URL.createObjectURL(f),
                            ),
                          ];
                          openImageModal(allImages);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeAdditionalImage(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                        disabled={isSubmitting}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {additionalImages.length >= 4 && (
              <div className="text-sm text-amber-600 mt-1">
                Maximum of 4 additional images reached
              </div>
            )}
          </div>
          {/* Dynamic Form Fields */}
          {formFields?.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={field.key}
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
                id={field.key}
                placeholder={field.placeholder}
                value={dynamicFormData[field.key] || ""}
                onChange={(e) =>
                  setDynamicFormData((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                required={field.key === "githubUrl" ? false : field.isRequired}
                disabled={isSubmitting}
              />
            </div>
          ))}
          {formFields === undefined && (
            <div className="text-sm text-gray-500">Loading form fields...</div>
          )}
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
                Add your hackathon team information if you're participating as a
                team
              </p>

              {showTeamInfo && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                  {/* Team Name */}
                  <div>
                    <label
                      htmlFor="teamName"
                      className="block text-sm font-medium text-[#525252] mb-1"
                    >
                      Team Name
                    </label>
                    <input
                      type="text"
                      id="teamName"
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
                      htmlFor="teamMemberCount"
                      className="block text-sm font-medium text-[#525252] mb-1"
                    >
                      Number of Team Members
                    </label>
                    <input
                      type="number"
                      id="teamMemberCount"
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
                              htmlFor={`member-name-${index}`}
                              className="block text-xs font-medium text-[#525252] mb-1"
                            >
                              Member {index + 1} Name
                            </label>
                            <input
                              type="text"
                              id={`member-name-${index}`}
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
                              htmlFor={`member-email-${index}`}
                              className="block text-xs font-medium text-[#525252] mb-1"
                            >
                              Member {index + 1} Email
                            </label>
                            <input
                              type="email"
                              id={`member-email-${index}`}
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
          <div>
            <label className="block text-sm font-medium text-[#525252] mb-2">
              Select Tags *
            </label>{" "}
            <span className="ml-2 text-xs text-gray-600">
              Select tags that best describe your app or hackathon
              participation?
            </span>
            <div className="flex flex-wrap gap-2 mb-4">
              {availableTags === undefined && (
                <span className="text-sm text-gray-500">Loading tags...</span>
              )}
              {availableTags
                ?.filter(
                  (tag: Tag) =>
                    tag.name !== "resendhackathon" &&
                    tag.name !== "ychackathon",
                )
                .map((tag: Tag) => (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => toggleTag(tag._id)}
                    className={`px-3 py-1 rounded-md text-sm transition-colors border flex items-center gap-1 ${selectedTagIds.includes(tag._id) ? "bg-[#F4F0ED] text-[#292929] border-[#D5D3D0]" : "bg-white text-[#545454] border-[#D5D3D0] hover:border-[#A8A29E] hover:text-[#525252]"}`}
                    style={{
                      backgroundColor: selectedTagIds.includes(tag._id)
                        ? tag.backgroundColor || "#F4F0ED"
                        : "white",
                      color: selectedTagIds.includes(tag._id)
                        ? tag.textColor || "#292929"
                        : "#545454",
                      borderColor: selectedTagIds.includes(tag._id)
                        ? tag.backgroundColor
                          ? "transparent"
                          : "#D5D3D0"
                        : "#D5D3D0",
                    }}
                  >
                    {tag.emoji && <span className="text-sm">{tag.emoji}</span>}
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
              <span className="ml-2 text-xs text-gray-600 mb-2 block">
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
                  placeholder="Type to search for tags..."
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
                                newTag.toLowerCase() === tag.name.toLowerCase(),
                            ),
                        )
                        .slice(0, 10); // Limit to 10 results for performance

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
                          onClick={() => handleSelectFromDropdown(tag._id)}
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
                              backgroundColor: tag.backgroundColor || "#F4F0ED",
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
                      ));
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
                            <span className="text-xs opacity-70">(Hidden)</span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleTag(tag._id)}
                            disabled={isSubmitting}
                            className="ml-1 text-current hover:opacity-70 transition-opacity"
                            title="Remove tag"
                          >
                            <X className="w-3 h-3" />
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
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <label className="block text-sm font-medium text-[#525252] mb-2">
              Add New Tags (optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTagInputValue}
                onChange={(e) => setNewTagInputValue(e.target.value)}
                placeholder={
                  selectedTagIds.length + newTagNames.length >= 10
                    ? "Maximum 10 tags reached"
                    : "Enter new tag name..."
                }
                className="flex-1 px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] text-sm"
                disabled={
                  isSubmitting ||
                  selectedTagIds.length + newTagNames.length >= 10
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddNewTag}
                disabled={
                  !newTagInputValue.trim() ||
                  isSubmitting ||
                  selectedTagIds.length + newTagNames.length >= 10
                }
                className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {newTagNames.map((tagName) => (
                <span
                  key={tagName}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm border border-blue-200"
                >
                  {tagName}
                  <button
                    type="button"
                    onClick={() => handleRemoveNewTag(tagName)}
                    disabled={isSubmitting}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
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
          <div className="flex gap-4 items-center pt-4 border-t border-[#F4F0ED]">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (selectedTagIds.length === 0 && newTagNames.length === 0) ||
                !formData.title ||
                !formData.tagline ||
                formData.tagline.length > MAX_TAGLINE_LENGTH ||
                !formData.url ||
                !formData.submitterName
              }
              className="px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit App"}
            </button>
            <Link
              to="/"
              className="px-4 py-2 text-[#545454] hover:text-[#525252] rounded-md text-sm"
            >
              Cancel
            </Link>
          </div>
          {settings?.showSubmissionLimit && (
            <div className="text-sm text-[#545454]">
              To maintain quality and prevent spam, you can submit up to{" "}
              {settings.submissionLimitCount || 10} projects per day.
            </div>
          )}
          {submitError && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {submitError}
            </div>
          )}
          {showSuccessMessage && (
            <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-md text-sm">
              Thanks for sharing!
            </div>
          )}
        </form>
      </div>

      {/* Auth Required Dialog */}
      <AuthRequiredDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        action="submit your app"
        title="Sign in to submit"
        description="You need to be signed in to submit apps to the community. Join to share your projects!"
      />

      {/* Image Modal */}
      {imageModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={closeImageModal}
        >
          <div
            className="relative max-w-4xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
              aria-label="Close image viewer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation Buttons */}
            {imageModalImages.length > 1 && (
              <>
                <button
                  onClick={() => navigateImageModal("prev")}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => navigateImageModal("next")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Main Image in Modal */}
            <img
              src={imageModalImages[imageModalCurrentIndex]}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {/* Image Counter */}
            {imageModalImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                {imageModalCurrentIndex + 1} / {imageModalImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
