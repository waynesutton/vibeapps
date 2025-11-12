import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  ArrowLeft,
  AlertCircle,
  Settings,
  List,
  Lock,
  Unlock,
  ToggleLeft,
  ToggleRight,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface CriteriaItem {
  _id?: Id<"judgingCriteria">;
  question: string;
  description?: string;
  order: number;
}

interface JudgingCriteriaEditorProps {
  groupId: Id<"judgingGroups">;
  groupName: string;
  onBack: () => void;
}

interface GroupSettings {
  name: string;
  description: string;
  isPublic: boolean;
  password: string;
  isActive: boolean;
  hasCustomSubmissionPage: boolean;
  submissionPageImageSize: number;
  submissionPageLayout: "two-column" | "one-third";
  submissionPageTitle: string;
  submissionPageDescription: string;
  submissionPageLinks: Array<{ label: string; url: string }>;
  submissionFormTitle: string;
  submissionFormSubtitle: string;
  submissionFormRequiredTagId?: Id<"tags"> | null;
}

export function JudgingCriteriaEditor({
  groupId,
  groupName,
  onBack,
}: JudgingCriteriaEditorProps) {
  const [activeTab, setActiveTab] = useState<"criteria" | "settings">(
    "criteria",
  );
  const [criteria, setCriteria] = useState<CriteriaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState("");
  const draggingCriteriaIndexRef = useRef<number | null>(null);

  // Group settings state
  const [groupSettings, setGroupSettings] = useState<GroupSettings>({
    name: "",
    description: "",
    isPublic: true,
    password: "",
    isActive: true,
    hasCustomSubmissionPage: false,
    submissionPageImageSize: 400,
    submissionPageLayout: "two-column",
    submissionPageTitle: "",
    submissionPageDescription: "",
    submissionPageLinks: [],
    submissionFormTitle: "",
    submissionFormSubtitle: "",
    submissionFormRequiredTagId: null,
  });
  const [hasGroupChanges, setHasGroupChanges] = useState(false);
  const [submissionPageImage, setSubmissionPageImage] = useState<File | null>(
    null,
  );
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const existingCriteria = useQuery(api.judgingCriteria.listByGroup, {
    groupId,
  });
  const groupDetails = useQuery(api.judgingGroups.getGroupWithDetails, {
    groupId,
  });
  const allTags = useQuery(api.tags.list);
  const saveCriteria = useMutation(api.judgingCriteria.saveCriteria);
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);

  // Load existing criteria
  useEffect(() => {
    if (existingCriteria) {
      setCriteria(
        existingCriteria.map((c) => ({
          _id: c._id,
          question: c.question,
          description: c.description,
          order: c.order,
        })),
      );
      setHasChanges(false);
    }
  }, [existingCriteria]);

  // Load existing group settings
  useEffect(() => {
    if (groupDetails) {
      setGroupSettings({
        name: groupDetails.name,
        description: groupDetails.description || "",
        isPublic: groupDetails.isPublic,
        password: "", // Don't load password for security
        isActive: groupDetails.isActive,
        hasCustomSubmissionPage: groupDetails.hasCustomSubmissionPage || false,
        submissionPageImageSize: groupDetails.submissionPageImageSize || 400,
        submissionPageLayout: groupDetails.submissionPageLayout || "two-column",
        submissionPageTitle: groupDetails.submissionPageTitle || "",
        submissionPageDescription: groupDetails.submissionPageDescription || "",
        submissionPageLinks: groupDetails.submissionPageLinks || [],
        submissionFormTitle: groupDetails.submissionFormTitle || "",
        submissionFormSubtitle: groupDetails.submissionFormSubtitle || "",
        submissionFormRequiredTagId: groupDetails.submissionFormRequiredTagId || null,
      });
      
      // Load existing image URL if available
      if (groupDetails.submissionPageImageId) {
        // The image URL will be fetched separately if needed
        setExistingImageUrl("(image set)"); // Placeholder since we can't get URL directly
      }
      
      setHasGroupChanges(false);
    }
  }, [groupDetails]);

  const addCriterion = () => {
    const newOrder =
      criteria.length > 0 ? Math.max(...criteria.map((c) => c.order)) + 1 : 1;
    setCriteria((prev) => [
      ...prev,
      {
        question: "",
        description: "",
        order: newOrder,
      },
    ]);
    setHasChanges(true);
  };

  const removeCriterion = (index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateCriterion = (
    index: number,
    field: keyof CriteriaItem,
    value: any,
  ) => {
    setCriteria((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
    setHasChanges(true);
  };

  const moveCriterion = (index: number, direction: "up" | "down") => {
    setCriteria((prev) => {
      const newCriteria = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex >= 0 && targetIndex < newCriteria.length) {
        [newCriteria[index], newCriteria[targetIndex]] = [
          newCriteria[targetIndex],
          newCriteria[index],
        ];

        // Update order values
        newCriteria.forEach((item, i) => {
          item.order = i + 1;
        });
      }

      return newCriteria;
    });
    setHasChanges(true);
  };

  // Drag and drop handlers for criteria
  const handleCriteriaDragStart = (index: number) => {
    draggingCriteriaIndexRef.current = index;
  };

  const handleCriteriaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCriteriaDrop = (targetIndex: number) => {
    const draggedIndex = draggingCriteriaIndexRef.current;
    draggingCriteriaIndexRef.current = null;

    if (draggedIndex === null || draggedIndex === targetIndex) {
      return;
    }

    setCriteria((prev) => {
      const newCriteria = [...prev];
      const [draggedItem] = newCriteria.splice(draggedIndex, 1);
      newCriteria.splice(targetIndex, 0, draggedItem);

      // Update order values
      newCriteria.forEach((item, i) => {
        item.order = i + 1;
      });

      return newCriteria;
    });
    setHasChanges(true);
  };

  const updateGroupSetting = (field: keyof GroupSettings, value: any) => {
    setGroupSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasGroupChanges(true);
  };

  const handleSaveGroupSettings = async () => {
    setError("");
    setIsSubmitting(true);

    // Validation
    if (!groupSettings.name.trim()) {
      setError("Group name is required");
      setIsSubmitting(false);
      return;
    }

    try {
      const updateData: any = {
        groupId,
        name: groupSettings.name.trim(),
        description: groupSettings.description.trim() || undefined,
        isPublic: groupSettings.isPublic,
        isActive: groupSettings.isActive,
        hasCustomSubmissionPage: groupSettings.hasCustomSubmissionPage,
        submissionPageImageSize: groupSettings.submissionPageImageSize,
        submissionPageLayout: groupSettings.submissionPageLayout,
        submissionPageTitle:
          groupSettings.submissionPageTitle.trim() || undefined,
        submissionPageDescription:
          groupSettings.submissionPageDescription.trim() || undefined,
        submissionPageLinks:
          groupSettings.submissionPageLinks.length > 0
            ? groupSettings.submissionPageLinks
            : undefined,
        submissionFormTitle:
          groupSettings.submissionFormTitle.trim() || undefined,
        submissionFormSubtitle:
          groupSettings.submissionFormSubtitle.trim() || undefined,
        submissionFormRequiredTagId: groupSettings.submissionFormRequiredTagId || undefined,
      };

      // Only include password if it's provided
      if (groupSettings.password.trim()) {
        updateData.password = groupSettings.password.trim();
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

      setHasGroupChanges(false);
      setSubmissionPageImage(null);
      console.log("Group settings saved successfully");
    } catch (error) {
      console.error("Error saving group settings:", error);
      setError("Failed to save group settings. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setIsSubmitting(true);

    // Validation
    const validCriteria = criteria.filter((c) => c.question.trim());
    if (validCriteria.length === 0) {
      setError("At least one criterion with a question is required");
      setIsSubmitting(false);
      return;
    }

    // Check for duplicate questions
    const questions = validCriteria.map((c) => c.question.trim().toLowerCase());
    if (new Set(questions).size !== questions.length) {
      setError("All criteria questions must be unique");
      setIsSubmitting(false);
      return;
    }

    try {
      // Prepare criteria with correct order
      const criteriaToSave = validCriteria.map((item, index) => ({
        _id: item._id,
        question: item.question.trim(),
        description: item.description?.trim() || undefined,
        order: index + 1,
      }));

      await saveCriteria({
        groupId,
        criteria: criteriaToSave,
      });

      setHasChanges(false);
      console.log("Criteria saved successfully");
    } catch (error) {
      console.error("Error saving criteria:", error);
      setError("Failed to save criteria. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarPreview = () => (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
          <span
            key={score}
            className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded"
          >
            {score}
          </span>
        ))}
      </div>
      <span className="ml-2 text-sm text-gray-600">1-10 Rating Scale</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Groups
          </Button>
          <div>
            <h2 className="text-xl font-medium text-gray-900">
              {activeTab === "criteria" ? "Judging Criteria" : "Group Settings"}
            </h2>
            <p className="text-sm text-gray-600">
              {groupSettings.name || groupName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {((activeTab === "criteria" && hasChanges) ||
            (activeTab === "settings" && hasGroupChanges)) && (
            <span className="text-sm text-orange-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </span>
          )}
          {activeTab === "criteria" ? (
            <Button
              onClick={handleSave}
              disabled={isSubmitting || !hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save Criteria"}
            </Button>
          ) : (
            <Button
              onClick={handleSaveGroupSettings}
              disabled={isSubmitting || !hasGroupChanges}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save Settings"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("criteria")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "criteria"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <List className="w-4 h-4 inline mr-2" />
            Criteria ({criteria.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "settings"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Group Settings
          </button>
        </nav>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === "criteria" ? (
        // Criteria Tab Content
        <>
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              How Judging Works
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                • Create questions that judges will use to evaluate submissions
              </p>
              <p>• Each question uses a 1-10 point rating scale</p>
              <p>• Judges will score every submission against all criteria</p>
              <p>• Total scores are automatically calculated and ranked</p>
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium text-blue-900 mb-1">
                Rating Scale:
              </p>
              {renderStarPreview()}
            </div>
          </div>

          {/* Criteria List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Criteria ({criteria.length})
              </h3>
              <Button
                onClick={addCriterion}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Criterion
              </Button>
            </div>

            {criteria.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <div className="space-y-2">
                  <p className="text-lg font-medium">No criteria yet</p>
                  <p className="text-sm">
                    Add your first judging criterion to get started
                  </p>
                  <Button
                    onClick={addCriterion}
                    variant="outline"
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Criterion
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {criteria.map((criterion, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleCriteriaDragStart(index)}
                    onDragOver={handleCriteriaDragOver}
                    onDrop={() => handleCriteriaDrop(index)}
                    className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 cursor-move hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveCriterion(index, "up")}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move up"
                          >
                            <GripVertical className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {index + 1}
                        </span>
                      </div>
                      <Button
                        onClick={() => removeCriterion(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`question-${index}`}>
                          Judging Question *
                        </Label>
                        <Input
                          id={`question-${index}`}
                          value={criterion.question}
                          onChange={(e) =>
                            updateCriterion(index, "question", e.target.value)
                          }
                          placeholder="e.g., How innovative is this app?"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor={`description-${index}`}>
                          Description (Optional)
                        </Label>
                        <Textarea
                          id={`description-${index}`}
                          value={criterion.description || ""}
                          onChange={(e) =>
                            updateCriterion(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          placeholder="Provide additional context or guidance for judges..."
                          rows={2}
                        />
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">
                            Preview: {renderStarPreview()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save Actions */}
          {hasChanges && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  You have unsaved changes
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Reset to original state
                      if (existingCriteria) {
                        setCriteria(
                          existingCriteria.map((c) => ({
                            _id: c._id,
                            question: c.question,
                            description: c.description,
                            order: c.order,
                          })),
                        );
                        setHasChanges(false);
                      }
                    }}
                  >
                    Discard Changes
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSubmitting ? "Saving..." : "Save Criteria"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // Group Settings Tab Content
        <>
          <div className="max-w-2xl space-y-6">
            {/* Basic Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Basic Information
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="groupName">Group Name *</Label>
                  <Input
                    id="groupName"
                    value={groupSettings.name}
                    onChange={(e) => updateGroupSetting("name", e.target.value)}
                    placeholder="Enter group name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="groupDescription">Description</Label>
                  <Textarea
                    id="groupDescription"
                    value={groupSettings.description}
                    onChange={(e) =>
                      updateGroupSetting("description", e.target.value)
                    }
                    placeholder="Optional description of the judging group"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Privacy Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateGroupSetting("isPublic", !groupSettings.isPublic)
                    }
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                      groupSettings.isPublic
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    }`}
                  >
                    {groupSettings.isPublic ? (
                      <Unlock className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {groupSettings.isPublic
                      ? "Public Access"
                      : "Private Access"}
                  </button>
                  <span className="text-sm text-gray-500">
                    {groupSettings.isPublic
                      ? "Anyone with the link can access this group"
                      : "Only users with the password can access this group"}
                  </span>
                </div>
                {!groupSettings.isPublic && (
                  <div>
                    <Label htmlFor="groupPassword">Access Password</Label>
                    <Input
                      id="groupPassword"
                      type="password"
                      value={groupSettings.password}
                      onChange={(e) =>
                        updateGroupSetting("password", e.target.value)
                      }
                      placeholder={
                        groupDetails?.hasPassword
                          ? "Enter new password (leave blank to keep current)"
                          : "Set access password"
                      }
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {groupDetails?.hasPassword
                        ? "Leave blank to keep the current password"
                        : "Required for private groups"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Group Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Group Status
              </h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    updateGroupSetting("isActive", !groupSettings.isActive)
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                    groupSettings.isActive
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  {groupSettings.isActive ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  {groupSettings.isActive ? "Active" : "Inactive"}
                </button>
                <span className="text-sm text-gray-500">
                  {groupSettings.isActive
                    ? "Judges can access and score submissions"
                    : "Group is inactive and judges cannot access it"}
                </span>
              </div>
            </div>

            {/* Custom Submission Page */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
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
                    updateGroupSetting(
                      "hasCustomSubmissionPage",
                      !groupSettings.hasCustomSubmissionPage,
                    )
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                    groupSettings.hasCustomSubmissionPage
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  {groupSettings.hasCustomSubmissionPage ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  {groupSettings.hasCustomSubmissionPage ? "Enabled" : "Disabled"}
                </button>
              </div>

              {groupSettings.hasCustomSubmissionPage && (
                <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                  {/* Submission Page URL */}
                  {groupDetails && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-blue-800 flex-1">
                          <strong>Submission Page URL:</strong>{" "}
                          <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                            /judging/{groupDetails.slug}/submit
                          </code>
                        </p>
                        <div className="flex items-center gap-2">
                          {/* Copy URL Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const fullUrl = `${window.location.origin}/judging/${groupDetails.slug}/submit`;
                              navigator.clipboard.writeText(fullUrl);
                              // Optional: Add toast notification
                            }}
                            className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                            title="Copy URL"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {/* Open URL Button */}
                          <a
                            href={`/judging/${groupDetails.slug}/submit`}
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
                          setHasGroupChanges(true);
                        }
                      }}
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
                      value={groupSettings.submissionPageImageSize}
                      onChange={(e) =>
                        updateGroupSetting(
                          "submissionPageImageSize",
                          parseInt(e.target.value) || 400,
                        )
                      }
                      placeholder="400"
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
                      value={groupSettings.submissionPageLayout}
                      onChange={(e) =>
                        updateGroupSetting(
                          "submissionPageLayout",
                          e.target.value as "two-column" | "one-third",
                        )
                      }
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
                      value={groupSettings.submissionPageTitle}
                      onChange={(e) =>
                        updateGroupSetting(
                          "submissionPageTitle",
                          e.target.value,
                        )
                      }
                      placeholder="e.g., Submit to Winter 2025 Hackathon"
                    />
                  </div>

                  {/* Page Description */}
                  <div>
                    <Label htmlFor="submissionDescription">
                      Page Description
                    </Label>
                    <Textarea
                      id="submissionDescription"
                      value={groupSettings.submissionPageDescription}
                      onChange={(e) =>
                        updateGroupSetting(
                          "submissionPageDescription",
                          e.target.value,
                        )
                      }
                      placeholder="Describe your event, hackathon, or judging criteria..."
                      rows={4}
                    />
                  </div>

                  {/* External Links */}
                  <div>
                    <Label>External Links</Label>
                    <div className="space-y-2">
                      {groupSettings.submissionPageLinks.map((link, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Label"
                            value={link.label}
                            onChange={(e) => {
                              const newLinks = [
                                ...groupSettings.submissionPageLinks,
                              ];
                              newLinks[index].label = e.target.value;
                              updateGroupSetting("submissionPageLinks", newLinks);
                            }}
                            className="flex-1"
                          />
                          <Input
                            placeholder="URL"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [
                                ...groupSettings.submissionPageLinks,
                              ];
                              newLinks[index].url = e.target.value;
                              updateGroupSetting("submissionPageLinks", newLinks);
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newLinks =
                                groupSettings.submissionPageLinks.filter(
                                  (_, i) => i !== index,
                                );
                              updateGroupSetting("submissionPageLinks", newLinks);
                            }}
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
                          updateGroupSetting("submissionPageLinks", [
                            ...groupSettings.submissionPageLinks,
                            { label: "", url: "" },
                          ]);
                        }}
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
                      value={groupSettings.submissionFormTitle}
                      onChange={(e) =>
                        updateGroupSetting("submissionFormTitle", e.target.value)
                      }
                      placeholder="Submit Your App"
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
                      value={groupSettings.submissionFormSubtitle}
                      onChange={(e) =>
                        updateGroupSetting(
                          "submissionFormSubtitle",
                          e.target.value,
                        )
                      }
                      placeholder="Add a subtitle or description below the form title"
                      rows={2}
                    />
                  </div>

                  {/* Required Tag for Submission Form */}
                  <div>
                    <Label htmlFor="submissionFormRequiredTagId">
                      Required Tag (Optional)
                    </Label>
                    <select
                      id="submissionFormRequiredTagId"
                      value={groupSettings.submissionFormRequiredTagId || ""}
                      onChange={(e) =>
                        updateGroupSetting(
                          "submissionFormRequiredTagId",
                          e.target.value || null,
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">None</option>
                      {allTags?.map((tag) => (
                        <option key={tag._id} value={tag._id}>
                          {tag.emoji ? `${tag.emoji} ` : ""}{tag.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      This tag will be automatically selected and locked on the submission form. Users cannot unselect it.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Save Actions for Group Settings */}
            {hasGroupChanges && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    You have unsaved changes
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Reset to original state
                        if (groupDetails) {
                          setGroupSettings({
                            name: groupDetails.name,
                            description: groupDetails.description || "",
                            isPublic: groupDetails.isPublic,
                            password: "",
                            isActive: groupDetails.isActive,
                            hasCustomSubmissionPage: groupDetails.hasCustomSubmissionPage || false,
                            submissionPageImageSize: groupDetails.submissionPageImageSize || 400,
                            submissionPageLayout: groupDetails.submissionPageLayout || "two-column",
                            submissionPageTitle: groupDetails.submissionPageTitle || "",
                            submissionPageDescription: groupDetails.submissionPageDescription || "",
                            submissionPageLinks: groupDetails.submissionPageLinks || [],
                            submissionFormTitle: groupDetails.submissionFormTitle || "",
                            submissionFormSubtitle: groupDetails.submissionFormSubtitle || "",
                            submissionFormRequiredTagId: groupDetails.submissionFormRequiredTagId || null,
                          });
                          setSubmissionPageImage(null);
                          setHasGroupChanges(false);
                        }
                      }}
                    >
                      Discard Changes
                    </Button>
                    <Button
                      onClick={handleSaveGroupSettings}
                      disabled={isSubmitting}
                      className="flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSubmitting ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
