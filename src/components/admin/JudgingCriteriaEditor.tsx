import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Plus,
  Trash2,
  GripVertical,
  Star,
  Save,
  ArrowLeft,
  AlertCircle,
  Settings,
  List,
  Lock,
  Unlock,
  Calendar,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface CriteriaItem {
  _id?: Id<"judgingCriteria">;
  question: string;
  description?: string;
  weight?: number;
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
  startDate: string;
  endDate: string;
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

  // Group settings state
  const [groupSettings, setGroupSettings] = useState<GroupSettings>({
    name: "",
    description: "",
    isPublic: true,
    password: "",
    startDate: "",
    endDate: "",
  });
  const [hasGroupChanges, setHasGroupChanges] = useState(false);

  const existingCriteria = useQuery(api.judgingCriteria.listByGroup, {
    groupId,
  });
  const groupDetails = useQuery(api.judgingGroups.getGroupWithDetails, {
    groupId,
  });
  const saveCriteria = useMutation(api.judgingCriteria.saveCriteria);
  const updateGroup = useMutation(api.judgingGroups.updateGroup);

  // Load existing criteria
  useEffect(() => {
    if (existingCriteria) {
      setCriteria(
        existingCriteria.map((c) => ({
          _id: c._id,
          question: c.question,
          description: c.description,
          weight: c.weight,
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
        startDate: groupDetails.startDate
          ? new Date(groupDetails.startDate).toISOString().slice(0, 16)
          : "",
        endDate: groupDetails.endDate
          ? new Date(groupDetails.endDate).toISOString().slice(0, 16)
          : "",
      });
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
        weight: 1,
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
        startDate: groupSettings.startDate
          ? new Date(groupSettings.startDate).getTime()
          : undefined,
        endDate: groupSettings.endDate
          ? new Date(groupSettings.endDate).getTime()
          : undefined,
      };

      // Only include password if it's provided
      if (groupSettings.password.trim()) {
        updateData.password = groupSettings.password.trim();
      }

      await updateGroup(updateData);

      setHasGroupChanges(false);
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
        weight: item.weight || 1,
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
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className="w-4 h-4 text-yellow-400 fill-current" />
      ))}
      <span className="ml-2 text-sm text-gray-600">1-5 Rating Scale</span>
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
              <p>• Each question uses a 1-5 star rating scale</p>
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
                    className="bg-white border border-gray-200 rounded-lg p-4 space-y-4"
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

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor={`weight-${index}`}>
                            Weight (Optional)
                          </Label>
                          <Input
                            id={`weight-${index}`}
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={criterion.weight || 1}
                            onChange={(e) =>
                              updateCriterion(
                                index,
                                "weight",
                                parseFloat(e.target.value) || 1,
                              )
                            }
                            className="w-20"
                          />
                        </div>
                        <div className="flex-2">
                          <p className="text-sm text-gray-600 mt-6">
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
                            weight: c.weight,
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

            {/* Timing Settings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Timing Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={groupSettings.startDate}
                      onChange={(e) =>
                        updateGroupSetting("startDate", e.target.value)
                      }
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    When judging should begin
                  </p>
                </div>
                <div>
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={groupSettings.endDate}
                      onChange={(e) =>
                        updateGroupSetting("endDate", e.target.value)
                      }
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    When judging should end
                  </p>
                </div>
              </div>
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
                            startDate: groupDetails.startDate
                              ? new Date(groupDetails.startDate)
                                  .toISOString()
                                  .slice(0, 16)
                              : "",
                            endDate: groupDetails.endDate
                              ? new Date(groupDetails.endDate)
                                  .toISOString()
                                  .slice(0, 16)
                              : "",
                          });
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
