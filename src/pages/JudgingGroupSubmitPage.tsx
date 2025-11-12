import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ExternalLink, Lock, Plus, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Markdown } from "../components/Markdown";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export function JudgingGroupSubmitPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch submission page data
  const submissionPage = useQuery(
    api.judgingGroups.getSubmissionPage,
    slug ? { slug } : "skip",
  );
  const validatePassword = useMutation(api.judgingGroups.validatePassword);

  // Handle password validation
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionPage) return;

    try {
      const isValid = await validatePassword({
        groupId: submissionPage._id,
        password,
      });

      if (isValid) {
        setIsAuthenticated(true);
        setPasswordError("");
      } else {
        setPasswordError("Incorrect password");
      }
    } catch (error) {
      setPasswordError("Error validating password");
    }
  };

  // Auto-authenticate if public
  useEffect(() => {
    if (submissionPage && submissionPage.isPublic) {
      setIsAuthenticated(true);
    }
  }, [submissionPage]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
        <div className="text-[#525252]">Loading...</div>
      </div>
    );
  }

  if (submissionPage === undefined) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
        <div className="text-[#525252]">Loading submission page...</div>
      </div>
    );
  }

  if (submissionPage === null) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-medium text-[#292929] mb-4">
          Page Not Found
        </h1>
        <p className="text-[#525252] mb-6">
          This submission page doesn't exist or isn't enabled.
        </p>
        <Link to="/" className="text-[#292929] hover:underline">
          ← Back to Home
        </Link>
      </div>
    );
  }

  // Show password form if not authenticated
  if (!isAuthenticated && submissionPage.hasPassword) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full border border-[#D8E1EC]">
          <div className="flex items-center justify-center w-12 h-12 bg-[#F2F4F7] rounded-full mx-auto mb-4">
            <Lock className="w-6 h-6 text-[#525252]" />
          </div>
          <h2 className="text-xl font-medium text-[#292929] text-center mb-2">
            Password Required
          </h2>
          <p className="text-sm text-[#525252] text-center mb-6">
            This submission page is password-protected
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full"
                required
              />
              {passwordError && (
                <p className="text-sm text-red-600 mt-1">{passwordError}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-[#292929] hover:bg-[#525252]"
            >
              Submit
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Determine grid layout classes based on admin setting
  const layoutClass =
    submissionPage.submissionPageLayout === "one-third"
      ? "lg:grid-cols-[1fr_2fr]" // 33/67 split
      : "lg:grid-cols-2"; // 50/50 split

  // Calculate image size (square)
  const imageSize = submissionPage.submissionPageImageSize || 400;

  // Main submission page - Luma-style layout
  return (
    <div className="min-h-screen bg-[#F2F4F7]">
      {/* Main Content - Dynamic Column Layout */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className={`grid grid-cols-1 ${layoutClass} gap-8`}>
          {/* Left Column - Event Info */}
          <div className="space-y-6 lg:sticky lg:top-4 self-start max-h-screen overflow-y-auto">
            {/* Header Image */}
            {submissionPage.submissionPageImageUrl && (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={submissionPage.submissionPageImageUrl}
                  alt={submissionPage.submissionPageTitle || submissionPage.name}
                  style={{
                    width: `${imageSize}px`,
                    height: `${imageSize}px`,
                    objectFit: "cover",
                  }}
                  className="mx-auto"
                />
              </div>
            )}

            {/* Title & Description */}
            <div className="bg-white rounded-lg p-6 border border-[#D8E1EC]">
              <h1 className="text-3xl font-medium text-[#292929] mb-4">
                {submissionPage.submissionPageTitle || submissionPage.name}
              </h1>
              {submissionPage.submissionPageDescription && (
                <div className="prose prose-sm max-w-none text-[#525252]">
                  <p className="whitespace-pre-wrap">
                    {submissionPage.submissionPageDescription}
                  </p>
                </div>
              )}
            </div>

            {/* Links - No Heading, Just Links */}
            {submissionPage.submissionPageLinks &&
              submissionPage.submissionPageLinks.length > 0 && (
                <div className="bg-white rounded-lg p-6 border border-[#D8E1EC]">
                  <div className="space-y-2">
                    {submissionPage.submissionPageLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-[#292929] hover:text-[#525252] transition-colors group"
                      >
                        <ExternalLink className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="group-hover:underline">
                          {link.label}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Submission Form */}
          <div>
            <div className="bg-white rounded-lg p-6 border border-[#D8E1EC]">
              {showSuccess ? (
                /* Success Message */
                <div className="text-center py-12">
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-16 w-16 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-medium text-[#292929] mb-2">
                    Thank You!
                  </h2>
                  <p className="text-[#525252]">
                    Your submission has been received successfully.
                  </p>
                  <p className="text-sm text-[#787672] mt-4">
                    Redirecting you to the homepage...
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-medium text-[#292929] mb-2">
                    {submissionPage.submissionFormTitle || "Submit Your App"}
                  </h2>
                  {submissionPage.submissionFormSubtitle && (
                    <p className="text-sm text-[#525252] mb-4">
                      {submissionPage.submissionFormSubtitle}
                    </p>
                  )}
                  <div className="mb-6" />

                  {/* Notice about authentication */}
                  {!isSignedIn && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        You need to{" "}
                        <Link to="/sign-in" className="underline font-medium">
                          sign in
                        </Link>{" "}
                        to submit your app to this judging group.
                      </p>
                    </div>
                  )}

                  {isSignedIn ? (
                    <SubmissionFormContent
                      judgingGroupId={submissionPage._id}
                      onSuccess={() => {
                        setShowSuccess(true);
                        // Redirect to homepage after 2.5 seconds
                        setTimeout(() => {
                          navigate("/");
                        }, 2500);
                      }}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[#525252] mb-4">
                        Sign in to submit your app
                      </p>
                      <Link to="/sign-in">
                        <Button className="bg-[#292929] hover:bg-[#525252]">
                          Sign In
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Submission Form Content Component - Matches StoryForm.tsx exactly
function SubmissionFormContent({
  judgingGroupId,
  onSuccess,
}: {
  judgingGroupId: Id<"judgingGroups">;
  onSuccess: () => void;
}) {
  const submit = useMutation(api.stories.submit);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const allTags = useQuery(api.tags.list);
  const allTagsForDropdown = useQuery(api.tags.listAllForDropdown);
  const formFields = useQuery(api.storyFormFields.listEnabled);
  const settings = useQuery(api.settings.get);

  const [selectedTagIds, setSelectedTagIds] = React.useState<Id<"tags">[]>([]);
  const [newTagInputValue, setNewTagInputValue] = React.useState("");
  const [newTagNames, setNewTagNames] = React.useState<string[]>([]);
  const [dropdownSearchValue, setDropdownSearchValue] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);

  const [formData, setFormData] = useState({
    title: "",
    tagline: "",
    longDescription: "",
    submitterName: "",
    url: "",
    videoUrl: "",
    email: "",
  });

  const [teamData, setTeamData] = useState({
    teamName: "",
    teamSize: "",
    teamMembers: [{ name: "", email: "" }],
  });

  const [dynamicFormData, setDynamicFormData] = useState<Record<string, string>>({});
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const MAX_TAGLINE_LENGTH = 140;

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshot(e.target.files[0]);
    }
  };

  const handleAdditionalImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const totalImages = additionalImages.length + filesArray.length;
      if (totalImages > 5) {
        setError("You can upload a maximum of 5 additional images.");
        return;
      }
      setAdditionalImages((prev) => [...prev, ...filesArray]);
    }
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNewTag = () => {
    const tagName = newTagInputValue.trim();
    const totalTags = selectedTagIds.length + newTagNames.length;

    if (totalTags >= 10) {
      setError("You can select a maximum of 10 tags.");
      return;
    }

    if (
      tagName &&
      !newTagNames.some((t) => t.toLowerCase() === tagName.toLowerCase()) &&
      !allTags?.some((t) => t.name.toLowerCase() === tagName.toLowerCase()) &&
      !allTagsForDropdown?.some((t) => t.name.toLowerCase() === tagName.toLowerCase())
    ) {
      setNewTagNames((prev) => [...prev, tagName]);
      setNewTagInputValue("");
      setError("");
    } else if (tagName) {
      setError("Tag name already exists or is invalid.");
    }
  };

  const handleSelectFromDropdown = (tagId: Id<"tags">) => {
    const totalTags = selectedTagIds.length + newTagNames.length;
    if (totalTags >= 10) {
      setError("You can select a maximum of 10 tags.");
      return;
    }
    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds((prev) => [...prev, tagId]);
      setError("");
    }
    setDropdownSearchValue("");
    setShowDropdown(false);
  };

  const toggleTag = (tagId: Id<"tags">) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Upload main screenshot
      let screenshotId: Id<"_storage"> | undefined = undefined;
      if (screenshot) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": screenshot.type },
          body: screenshot,
        });
        const { storageId } = await result.json();
        screenshotId = storageId;
      }

      // Upload additional images
      const additionalImageIds: Id<"_storage">[] = [];
      for (const image of additionalImages) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": image.type },
          body: image,
        });
        const { storageId } = await result.json();
        additionalImageIds.push(storageId);
      }

      // Submit story with all fields
      // Prepare team info if enabled
      const showTeamInfo = settings?.showHackathonTeamInfo;
      
      await submit({
        title: formData.title,
        tagline: formData.tagline,
        longDescription: formData.longDescription || undefined,
        submitterName: formData.submitterName || undefined,
        url: formData.url,
        videoUrl: formData.videoUrl || undefined,
        email: formData.email || undefined,
        tagIds: selectedTagIds,
        newTagNames,
        screenshotId,
        additionalImageIds: additionalImageIds.length > 0 ? additionalImageIds : undefined,
        judgingGroupId, // Auto-add to judging group
        // Dynamic form fields
        linkedinUrl: dynamicFormData.linkedinUrl || undefined,
        twitterUrl: dynamicFormData.twitterUrl || undefined,
        githubUrl: dynamicFormData.githubUrl || undefined,
        chefShowUrl: dynamicFormData.chefShowUrl || undefined,
        chefAppUrl: dynamicFormData.chefAppUrl || undefined,
        // Team info (if enabled and provided)
        teamName:
          showTeamInfo && teamData.teamName ? teamData.teamName : undefined,
        teamMemberCount:
          showTeamInfo && teamData.teamName
            ? parseInt(teamData.teamSize) || undefined
            : undefined,
        teamMembers:
          showTeamInfo && teamData.teamName
            ? teamData.teamMembers.filter(
                (m) => m.name.trim() || m.email.trim(),
              )
            : undefined,
      });

      onSuccess();
    } catch (err) {
      console.error("Submission error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit");
      setIsSubmitting(false);
    }
  };

  // Filter tags for dropdown search
  const filteredDropdownTags = allTagsForDropdown
    ?.filter(
      (tag) =>
        tag.name.toLowerCase().includes(dropdownSearchValue.toLowerCase()) &&
        !selectedTagIds.includes(tag._id) &&
        !newTagNames.some((name) => name.toLowerCase() === tag.name.toLowerCase()),
    )
    .slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* App Title */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          App Title*
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          placeholder="Site name"
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          App/Project Tagline*
        </label>
        <input
          type="text"
          value={formData.tagline}
          onChange={(e) => {
            if (e.target.value.length <= MAX_TAGLINE_LENGTH) {
              setFormData((prev) => ({ ...prev, tagline: e.target.value }));
            }
          }}
          maxLength={MAX_TAGLINE_LENGTH}
          placeholder="One sentence pitch or description"
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          required
          disabled={isSubmitting}
        />
        <div className="text-xs text-right text-[#545454] mt-1">
          {formData.tagline.length}/{MAX_TAGLINE_LENGTH}
        </div>
      </div>

      {/* Long Description */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          Description (Markdown and fenced `code` blocks supported)
        </label>
        <textarea
          value={formData.longDescription}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, longDescription: e.target.value }))
          }
          placeholder="- Problem you're solving&#10;- How the app works&#10;- Notable features&#10;- Why did you build this&#10;- Tech stack list&#10;- Challenges we ran into&#10;- Any success stories or metrics&#10;"
          rows={8}
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          disabled={isSubmitting}
        />
        {formData.longDescription && (
          <div className="mt-2">
            <div className="text-xs text-[#545454] mb-1">Preview</div>
            <div className="prose prose-sm max-w-none text-[#525252] bg-gray-50 border border-[#D8E1EC] rounded-md p-3">
              <Markdown>{formData.longDescription}</Markdown>
            </div>
          </div>
        )}
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          App Website Link*
        </label>
        <div className="text-sm text-[#545454] mb-2">
          Enter your app url (ex: https://)
        </div>
        <input
          type="url"
          value={formData.url}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, url: e.target.value }))
          }
          placeholder="https://"
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Video URL */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          Video Demo (Recommended)
        </label>
        <div className="text-sm text-[#545454] mb-2">
          Share a video demo of your app (YouTube, Vimeo, etc.)
        </div>
        <input
          type="url"
          value={formData.videoUrl}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))
          }
          placeholder="https://youtube.com/..."
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          disabled={isSubmitting}
        />
      </div>

      {/* Submitter Name */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          Your Name*
        </label>
        <input
          type="text"
          value={formData.submitterName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, submitterName: e.target.value }))
          }
          placeholder="Your name"
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          Email (Optional)
        </label>
        <div className="text-sm text-[#545454] mb-2">
          Hidden and for hackathon notifications
        </div>
        <input
          type="email"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          placeholder="your@email.com"
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          disabled={isSubmitting}
        />
      </div>

      {/* Hackathon Team Info - Conditional */}
      {settings?.showHackathonTeamInfo && (
        <div className="bg-[#F2F4F7] p-4 rounded-md border border-[#D8E1EC]">
          <h3 className="text-base font-medium text-[#292929] mb-3">
            Hackathon Team Info (Optional)
          </h3>

          <div className="space-y-4">
            {/* Team Name */}
            <div>
              <label
                className="block text-sm font-medium text-[#525252] mb-1"
                htmlFor="teamName"
              >
                Team Name (Optional)
              </label>
              <input
                type="text"
                id="teamName"
                placeholder="e.g., The Code Wizards"
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

            {/* Team Size */}
            {teamData.teamName && (
              <div>
                <label
                  className="block text-sm font-medium text-[#525252] mb-1"
                  htmlFor="teamSize"
                >
                  Team Size
                </label>
                <input
                  type="number"
                  id="teamSize"
                  min="1"
                  max="20"
                  placeholder="e.g., 4"
                  value={teamData.teamSize}
                  onChange={(e) =>
                    setTeamData((prev) => ({
                      ...prev,
                      teamSize: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Team Members */}
            {teamData.teamName && (
              <div>
                <label className="block text-sm font-medium text-[#525252] mb-2">
                  Team Members (Optional)
                </label>
                <div className="space-y-2">
                  {teamData.teamMembers.map((member, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => {
                          const newMembers = [...teamData.teamMembers];
                          newMembers[index].name = e.target.value;
                          setTeamData((prev) => ({
                            ...prev,
                            teamMembers: newMembers,
                          }));
                        }}
                        className="flex-1 px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                        disabled={isSubmitting}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={member.email}
                        onChange={(e) => {
                          const newMembers = [...teamData.teamMembers];
                          newMembers[index].email = e.target.value;
                          setTeamData((prev) => ({
                            ...prev,
                            teamMembers: newMembers,
                          }));
                        }}
                        className="flex-1 px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
                        disabled={isSubmitting}
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newMembers = teamData.teamMembers.filter(
                              (_, i) => i !== index,
                            );
                            setTeamData((prev) => ({
                              ...prev,
                              teamMembers: newMembers,
                            }));
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          disabled={isSubmitting}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTeamData((prev) => ({
                        ...prev,
                        teamMembers: [
                          ...prev.teamMembers,
                          { name: "", email: "" },
                        ],
                      }));
                    }}
                    className="w-full px-3 py-2 border border-[#D8E1EC] text-[#525252] hover:bg-[#F2F4F7] rounded-md transition-colors flex items-center justify-center gap-2"
                    disabled={isSubmitting}
                  >
                    <Plus className="w-4 h-4" />
                    Add Team Member
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screenshot */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          Screenshot or Image*
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          disabled={isSubmitting}
          className="w-full text-sm text-[#525252] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#F2F4F7] file:text-[#292929] hover:file:bg-[#D8E1EC]"
          required
        />
      </div>

      {/* Additional Images */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-1">
          Additional Images (Optional, max 4)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleAdditionalImagesChange}
          disabled={isSubmitting || additionalImages.length >= 5}
          className="w-full text-sm text-[#525252] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#F2F4F7] file:text-[#292929] hover:file:bg-[#D8E1EC]"
        />
        {additionalImages.length > 0 && (
          <div className="mt-2 space-y-1">
            {additionalImages.map((file, index) => (
              <div key={index} className="flex items-center justify-between text-sm text-[#525252] bg-gray-50 p-2 rounded">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAdditionalImage(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags Section */}
      <div>
        <label className="block text-sm font-medium text-[#525252] mb-2">
          Tags (Select or create, max 10)
        </label>

        {/* Visible Header Tags */}
        {allTags && allTags.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-[#545454] mb-2">Quick Select:</div>
            <div className="flex flex-wrap gap-2">
              {allTags
                .filter((tag) => !tag.isHidden)
                .map((tag) => (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => toggleTag(tag._id)}
                    disabled={isSubmitting}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      selectedTagIds.includes(tag._id)
                        ? "bg-[#292929] text-white border-[#292929]"
                        : "bg-white text-[#525252] border-[#D8E1EC] hover:border-[#292929]"
                    }`}
                    style={
                      selectedTagIds.includes(tag._id) && tag.backgroundColor
                        ? {
                            backgroundColor: tag.backgroundColor,
                            color: tag.textColor || "#FFFFFF",
                            borderColor: tag.borderColor || tag.backgroundColor,
                          }
                        : undefined
                    }
                  >
                    {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
                    {tag.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Search All Tags Dropdown */}
        <div className="mb-3" ref={dropdownRef}>
          <div className="relative">
            <input
              type="text"
              value={dropdownSearchValue}
              onChange={(e) => {
                setDropdownSearchValue(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search all tags..."
              disabled={isSubmitting || selectedTagIds.length + newTagNames.length >= 10}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
            />
            {showDropdown && filteredDropdownTags && filteredDropdownTags.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[#D8E1EC] rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredDropdownTags.map((tag) => (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => handleSelectFromDropdown(tag._id)}
                    className="w-full text-left px-3 py-2 hover:bg-[#F2F4F7] flex items-center gap-2"
                  >
                    {tag.emoji && <span>{tag.emoji}</span>}
                    <span className="flex-1">{tag.name}</span>
                    {tag.isHidden && (
                      <span className="text-xs text-gray-500">(Hidden)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create New Tag */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newTagInputValue}
            onChange={(e) => setNewTagInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNewTag();
              }
            }}
            placeholder="Create new tag..."
            disabled={isSubmitting || selectedTagIds.length + newTagNames.length >= 10}
            className="flex-1 px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
          />
          <button
            type="button"
            onClick={handleAddNewTag}
            disabled={isSubmitting || !newTagInputValue.trim() || selectedTagIds.length + newTagNames.length >= 10}
            className="px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-[#525252] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>

        {/* Selected Tags Display */}
        {(selectedTagIds.length > 0 || newTagNames.length > 0) && (
          <div className="bg-[#F2F4F7] rounded-md p-3">
            <div className="text-xs font-medium text-[#525252] mb-2">
              Selected Tags ({selectedTagIds.length + newTagNames.length}/10)
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTagIds.map((tagId) => {
                const tag = allTags?.find((t) => t._id === tagId) ||
                  allTagsForDropdown?.find((t) => t._id === tagId);
                if (!tag) return null;
                return (
                  <div
                    key={tagId}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white border border-[#D8E1EC]"
                    style={
                      tag.backgroundColor
                        ? {
                            backgroundColor: tag.backgroundColor,
                            color: tag.textColor || "#FFFFFF",
                            borderColor: tag.borderColor || tag.backgroundColor,
                          }
                        : undefined
                    }
                  >
                    {tag.emoji && <span>{tag.emoji}</span>}
                    <span>{tag.name}</span>
                    {tag.isHidden && (
                      <span className="text-xs opacity-70">(Hidden)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleTag(tagId)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {newTagNames.map((tagName) => (
                <div
                  key={tagName}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-50 border border-green-200 text-green-800"
                >
                  <span>{tagName}</span>
                  <span className="text-xs">(New)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewTagNames((prev) => prev.filter((t) => t !== tagName))
                    }
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Form Fields */}
      {formFields && formFields.length > 0 && (
        <div className="space-y-4">
          {formFields.map((field) => (
            <div key={field._id}>
              <label className="block text-sm font-medium text-[#525252] mb-1">
                {field.label}
                {field.isRequired && "*"}
              </label>
              {field.helpText && (
                <div className="text-sm text-[#545454] mb-2">
                  {field.helpText}
                </div>
              )}
              <input
                type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
                value={dynamicFormData[field.key] || ""}
                onChange={(e) =>
                  setDynamicFormData((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                placeholder={field.placeholder || ""}
                required={field.key === "githubUrl" ? false : field.isRequired}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#292929] hover:bg-[#525252]"
      >
        {isSubmitting ? "Submitting..." : "Submit App"}
      </Button>
    </form>
  );
}
