import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  X,
  Lock,
  Eye,
  BarChart2,
  ToggleLeft,
  ToggleRight,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Id } from "../../../convex/_generated/dataModel";

interface EditJudgingGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  groupId: Id<"judgingGroups">;
}

export function EditJudgingGroupModal({
  isOpen,
  onClose,
  onSuccess,
  groupId,
}: EditJudgingGroupModalProps) {
  const group = useQuery(
    api.judgingGroups.getGroupWithDetails,
    isOpen ? { groupId } : "skip",
  );
  const allTags = useQuery(api.tags.list);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: true,
    judgePassword: "",
    submissionPageIsPublic: true,
    submissionPagePassword: "",
    resultsIsPublic: false,
    resultsPassword: "",
    isActive: true,
    hasCustomSubmissionPage: false,
    submissionPageImageSize: 400,
    submissionPageLayout: "two-column" as "two-column" | "one-third",
    submissionPageTitle: "",
    submissionPageDescription: "",
    submissionPageLinks: [] as Array<{ label: string; url: string }>,
    submissionFormTitle: "",
    submissionFormSubtitle: "",
    submissionFormRequiredTagId: null as Id<"tags"> | null,
  });
  const [submissionPageImage, setSubmissionPageImage] = useState<File | null>(
    null,
  );
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);

  // Load group data when it's available
  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || "",
        isPublic: group.isPublic,
        judgePassword: "", // Don't show existing password
        submissionPageIsPublic: !group.submissionPagePassword, // If there's a password, it's private
        submissionPagePassword: "", // Don't show existing password
        resultsIsPublic: group.resultsIsPublic ?? false,
        resultsPassword: "", // Don't show existing password
        isActive: group.isActive,
        hasCustomSubmissionPage: group.hasCustomSubmissionPage || false,
        submissionPageImageSize: group.submissionPageImageSize || 400,
        submissionPageLayout: group.submissionPageLayout || "two-column",
        submissionPageTitle: group.submissionPageTitle || "",
        submissionPageDescription: group.submissionPageDescription || "",
        submissionPageLinks: group.submissionPageLinks || [],
        submissionFormTitle: group.submissionFormTitle || "",
        submissionFormSubtitle: group.submissionFormSubtitle || "",
        submissionFormRequiredTagId: group.submissionFormRequiredTagId || null,
      });

      // Load existing image URL if available
      if (group.submissionPageImageId) {
        setExistingImageUrl("(image set)");
      }
    }
  }, [group]);

  const resetForm = () => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || "",
        isPublic: group.isPublic,
        judgePassword: "",
        submissionPageIsPublic: !group.submissionPagePassword,
        submissionPagePassword: "",
        resultsIsPublic: group.resultsIsPublic ?? false,
        resultsPassword: "",
        isActive: group.isActive,
        hasCustomSubmissionPage: group.hasCustomSubmissionPage || false,
        submissionPageImageSize: group.submissionPageImageSize || 400,
        submissionPageLayout: group.submissionPageLayout || "two-column",
        submissionPageTitle: group.submissionPageTitle || "",
        submissionPageDescription: group.submissionPageDescription || "",
        submissionPageLinks: group.submissionPageLinks || [],
        submissionFormTitle: group.submissionFormTitle || "",
        submissionFormSubtitle: group.submissionFormSubtitle || "",
        submissionFormRequiredTagId: group.submissionFormRequiredTagId || null,
      });
    }
    setSubmissionPageImage(null);
    setError("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Validation
    if (!formData.name.trim()) {
      setError("Group name is required");
      setIsSubmitting(false);
      return;
    }

    if (
      !formData.resultsIsPublic &&
      !formData.resultsPassword.trim() &&
      !group?.resultsPassword
    ) {
      setError(
        "Password is required for private results pages. Either keep the existing password or set a new one.",
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const updateData: any = {
        groupId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isPublic: formData.isPublic,
        resultsIsPublic: formData.resultsIsPublic,
        isActive: formData.isActive,
        hasCustomSubmissionPage: formData.hasCustomSubmissionPage,
        submissionPageImageSize: formData.submissionPageImageSize,
        submissionPageLayout: formData.submissionPageLayout,
        submissionPageTitle: formData.submissionPageTitle.trim() || undefined,
        submissionPageDescription:
          formData.submissionPageDescription.trim() || undefined,
        submissionPageLinks:
          formData.submissionPageLinks.length > 0
            ? formData.submissionPageLinks
            : undefined,
        submissionFormTitle: formData.submissionFormTitle.trim() || undefined,
        submissionFormSubtitle:
          formData.submissionFormSubtitle.trim() || undefined,
        submissionFormRequiredTagId:
          formData.submissionFormRequiredTagId || undefined,
      };

      // Only include passwords if they're provided
      if (formData.judgePassword.trim()) {
        updateData.judgePassword = formData.judgePassword.trim();
      }
      if (formData.submissionPagePassword.trim()) {
        updateData.submissionPagePassword =
          formData.submissionPagePassword.trim();
      }
      if (formData.resultsPassword.trim()) {
        updateData.resultsPassword = formData.resultsPassword.trim();
      }

      // Upload submission page image if provided
      if (submissionPageImage) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": submissionPageImage.type },
          body: submissionPageImage,
        });
        const { storageId } = await result.json();
        updateData.submissionPageImageId = storageId;
      }

      await updateGroup(updateData);

      // Success
      resetForm();
      onClose();
      onSuccess?.();
    } catch (error) {
      setError("Failed to update group. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#ffffff] rounded-lg border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-medium text-gray-900">
            Edit Judging Group Settings
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Basic Information
            </h3>

            <div>
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Best App Contest 2024"
                required
                disabled={isSubmitting}
              />
              <p className="mt-1 text-sm text-gray-500">
                This will be displayed to judges and used in the URL
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Provide context about this judging group..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Judge Access Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Judge Access Settings
            </h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPublic"
                  checked={formData.isPublic}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      isPublic: !!checked,
                      judgePassword: !!checked ? "" : prev.judgePassword,
                    }))
                  }
                  disabled={isSubmitting}
                />
                <Label htmlFor="isPublic" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Public Judge Access
                </Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                {formData.isPublic
                  ? "Anyone with the link can access the judging interface"
                  : "Password protection for judge access"}
              </p>
            </div>

            {!formData.isPublic && (
              <div>
                <Label
                  htmlFor="judgePassword"
                  className="flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Judge Access Password
                </Label>
                <Input
                  id="judgePassword"
                  type="password"
                  value={formData.judgePassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      judgePassword: e.target.value,
                    }))
                  }
                  placeholder={
                    group.judgePassword
                      ? "Leave blank to keep existing password"
                      : "Password for judges (optional)"
                  }
                  disabled={isSubmitting}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {group.judgePassword
                    ? "A password is currently set. Leave blank to keep it, or enter a new password."
                    : "Optional password for judges to access the judging interface"}
                </p>
              </div>
            )}
          </div>

          {/* Submission Page Access Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Submission Page Access Settings
            </h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="submissionPageIsPublic"
                  checked={formData.submissionPageIsPublic}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      submissionPageIsPublic: !!checked,
                      submissionPagePassword: !!checked
                        ? ""
                        : prev.submissionPagePassword,
                    }))
                  }
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor="submissionPageIsPublic"
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Public Submission Page Access
                </Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                {formData.submissionPageIsPublic
                  ? "Anyone with the link can access the custom submission form"
                  : "Password protection for custom submission page access"}
              </p>
            </div>

            {!formData.submissionPageIsPublic && (
              <div>
                <Label
                  htmlFor="submissionPagePassword"
                  className="flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Submission Page Password
                </Label>
                <Input
                  id="submissionPagePassword"
                  type="password"
                  value={formData.submissionPagePassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      submissionPagePassword: e.target.value,
                    }))
                  }
                  placeholder={
                    group.submissionPagePassword
                      ? "Leave blank to keep existing password"
                      : "Password for submission form (optional)"
                  }
                  disabled={isSubmitting}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {group.submissionPagePassword
                    ? "A password is currently set. Leave blank to keep it, or enter a new password."
                    : "Optional password for users to access the custom submission form"}
                </p>
              </div>
            )}
          </div>

          {/* Results Page Visibility */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              Results Page Visibility
            </h3>
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resultsIsPublic"
                  checked={formData.resultsIsPublic}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      resultsIsPublic: !!checked,
                      resultsPassword: !!checked ? "" : prev.resultsPassword,
                    }))
                  }
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor="resultsIsPublic"
                  className="flex items-center gap-2"
                >
                  <BarChart2 className="w-4 h-4" />
                  Public Results
                </Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                {formData.resultsIsPublic
                  ? "Anyone with the link can view the judging results"
                  : "Requires a password to view the judging results"}
              </p>
            </div>

            {!formData.resultsIsPublic && (
              <div>
                <Label
                  htmlFor="resultsPassword"
                  className="flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Results Password *
                </Label>
                <Input
                  id="resultsPassword"
                  type="password"
                  value={formData.resultsPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      resultsPassword: e.target.value,
                    }))
                  }
                  placeholder={
                    group.resultsPassword
                      ? "Leave blank to keep existing password"
                      : "Enter password for results access"
                  }
                  disabled={isSubmitting}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {group.resultsPassword
                    ? "A password is currently set. Leave blank to keep it, or enter a new password."
                    : "Required: Set a password to protect results access"}
                </p>
              </div>
            )}
          </div>

          {/* Status Toggle */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Group Status</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                  formData.isActive
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                {formData.isActive ? (
                  <ToggleRight className="w-5 h-5" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
                {formData.isActive ? "Active" : "Inactive"}
              </button>
              <span className="text-sm text-gray-500">
                {formData.isActive
                  ? "Judges can immediately start scoring submissions"
                  : "Judges cannot access this group until activated"}
              </span>
            </div>
          </div>

          {/* Custom Submission Page */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Custom Submission Page
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Create a custom page where users can submit directly to this
                  judging group
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    hasCustomSubmissionPage: !prev.hasCustomSubmissionPage,
                  }))
                }
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                  formData.hasCustomSubmissionPage
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                {formData.hasCustomSubmissionPage ? (
                  <ToggleRight className="w-5 h-5" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
                {formData.hasCustomSubmissionPage ? "Enabled" : "Disabled"}
              </button>
            </div>

            {formData.hasCustomSubmissionPage && (
              <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                {/* Submission Page URL */}
                {group && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-blue-800 flex-1">
                        <strong>Submission Page URL:</strong>{" "}
                        <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                          /judging/{group.slug}/submit
                        </code>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const fullUrl = `${window.location.origin}/judging/${group.slug}/submit`;
                            navigator.clipboard.writeText(fullUrl);
                          }}
                          className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                          title="Copy URL"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={`/judging/${group.slug}/submit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Header Image */}
                <div>
                  <Label htmlFor="submissionImage">Header Image</Label>
                  <input
                    type="file"
                    id="submissionImage"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSubmissionPageImage(e.target.files[0]);
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {existingImageUrl && !submissionPageImage && (
                    <p className="text-sm text-gray-500 mt-1">
                      ✓ Image already uploaded
                    </p>
                  )}
                  {submissionPageImage && (
                    <p className="text-sm text-green-600 mt-1">
                      ✓ New image selected: {submissionPageImage.name}
                    </p>
                  )}
                </div>

                {/* Image Size */}
                <div>
                  <Label htmlFor="imageSize">
                    Image Size (square, in pixels)
                  </Label>
                  <Input
                    id="imageSize"
                    type="number"
                    min="100"
                    max="1000"
                    value={formData.submissionPageImageSize}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        submissionPageImageSize:
                          parseInt(e.target.value) || 400,
                      }))
                    }
                    placeholder="400"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: 400px. Range: 100-1000px
                  </p>
                </div>

                {/* Layout Selection */}
                <div>
                  <Label htmlFor="layoutSelect">Page Layout</Label>
                  <select
                    id="layoutSelect"
                    value={formData.submissionPageLayout}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        submissionPageLayout: e.target.value as
                          | "two-column"
                          | "one-third",
                      }))
                    }
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-white rounded-md text-gray-700 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    <option value="two-column">
                      Two Column (50/50) - Balanced layout
                    </option>
                    <option value="one-third">
                      One Third (33/67) - Larger submission form
                    </option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose how content and form are displayed side by side
                  </p>
                </div>

                {/* Page Title */}
                <div>
                  <Label htmlFor="submissionTitle">Page Title</Label>
                  <Input
                    id="submissionTitle"
                    value={formData.submissionPageTitle}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        submissionPageTitle: e.target.value,
                      }))
                    }
                    placeholder="e.g., Submit to Winter 2025 Hackathon"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Page Description */}
                <div>
                  <Label htmlFor="submissionDescription">
                    Page Description
                  </Label>
                  <Textarea
                    id="submissionDescription"
                    value={formData.submissionPageDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        submissionPageDescription: e.target.value,
                      }))
                    }
                    placeholder="Describe your event, hackathon, or judging criteria..."
                    rows={4}
                    disabled={isSubmitting}
                  />
                </div>

                {/* External Links */}
                <div>
                  <Label>External Links</Label>
                  <div className="space-y-2">
                    {formData.submissionPageLinks.map((link, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Label"
                          value={link.label}
                          onChange={(e) => {
                            const newLinks = [...formData.submissionPageLinks];
                            newLinks[index].label = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              submissionPageLinks: newLinks,
                            }));
                          }}
                          disabled={isSubmitting}
                          className="flex-1"
                        />
                        <Input
                          placeholder="URL"
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...formData.submissionPageLinks];
                            newLinks[index].url = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              submissionPageLinks: newLinks,
                            }));
                          }}
                          disabled={isSubmitting}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newLinks =
                              formData.submissionPageLinks.filter(
                                (_, i) => i !== index,
                              );
                            setFormData((prev) => ({
                              ...prev,
                              submissionPageLinks: newLinks,
                            }));
                          }}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          submissionPageLinks: [
                            ...prev.submissionPageLinks,
                            { label: "", url: "" },
                          ],
                        }));
                      }}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Link
                    </Button>
                  </div>
                </div>

                {/* Submission Form Title */}
                <div>
                  <Label htmlFor="submissionFormTitle">
                    Submission Form Title
                  </Label>
                  <Input
                    id="submissionFormTitle"
                    value={formData.submissionFormTitle}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        submissionFormTitle: e.target.value,
                      }))
                    }
                    placeholder="Submit Your App"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: "Submit Your App"
                  </p>
                </div>

                {/* Submission Form Subtitle */}
                <div>
                  <Label htmlFor="submissionFormSubtitle">
                    Submission Form Subtitle (Optional)
                  </Label>
                  <Textarea
                    id="submissionFormSubtitle"
                    value={formData.submissionFormSubtitle}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        submissionFormSubtitle: e.target.value,
                      }))
                    }
                    placeholder="Add a subtitle or description below the form title"
                    rows={2}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Required Tag */}
                <div>
                  <Label htmlFor="submissionFormRequiredTagId">
                    Required Tag (Optional)
                  </Label>
                  <select
                    id="submissionFormRequiredTagId"
                    value={formData.submissionFormRequiredTagId || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        submissionFormRequiredTagId: (e.target.value ||
                          null) as Id<"tags"> | null,
                      }))
                    }
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {allTags?.map((tag) => (
                      <option key={tag._id} value={tag._id}>
                        {tag.emoji ? `${tag.emoji} ` : ""}
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This tag will be automatically selected and locked on the
                    submission form. Users cannot unselect it.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="bg-[#292929] hover:bg-[#525252]"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
