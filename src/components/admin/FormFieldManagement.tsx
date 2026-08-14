import React, { useState, useEffect } from "react";
import {
  Plus,
  X,
  Save,
  Trash2,
  Edit3,
  Check,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";
import { SimpleSelect } from "../ui/SimpleSelect";

// Interface for editable form field
interface EditableFormField extends Doc<"storyFormFields"> {
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

type StoryFormFieldType = Doc<"storyFormFields">["fieldType"];

// Field type choices shared by the add and edit selects
const FIELD_TYPE_OPTIONS = [
  { value: "url", label: "URL" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Textarea" },
  { value: "radio", label: "Radio (single choice)" },
  { value: "multiselect", label: "Multi-select (checkboxes)" },
  { value: "select", label: "Dropdown (select)" },
];

const isChoiceFieldType = (fieldType: string) =>
  fieldType === "radio" || fieldType === "multiselect" || fieldType === "select";

// Newline-separated textarea text -> clean options array
const parseOptionsText = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export function FormFieldManagement() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const storyFormFields = useQuery(
    api.storyFormFields.listAdmin,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  // Per-option answer tallies for choice fields (radio/multiselect/select)
  const answerCounts = useQuery(
    api.storyFormFields.getChoiceAnswerCounts,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  const settings = useQuery(api.settings.get);

  const createField = useMutation(api.storyFormFields.create);
  const updateField = useMutation(api.storyFormFields.update);
  const deleteField = useMutation(api.storyFormFields.deleteField);
  const reorderFields = useMutation(api.storyFormFields.reorder);
  const updateSettings = useMutation(api.settings.update);

  const [editableFields, setEditableFields] = useState<EditableFormField[]>([]);
  const [editingFieldId, setEditingFieldId] =
    useState<Id<"storyFormFields"> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    key: "",
    label: "",
    placeholder: "",
    isEnabled: true,
    isRequired: false,
    fieldType: "url" as StoryFormFieldType,
    description: "",
    storyPropertyName: "",
    optionsText: "",
  });

  // Sync Convex data to local editable state
  useEffect(() => {
    if (storyFormFields) {
      if (!isProcessing) {
        setEditableFields(
          storyFormFields.map((field) => ({
            ...field,
            isNew: false,
            isModified: false,
            isDeleted: false,
          })),
        );
      }
    }
  }, [storyFormFields, isProcessing]);

  const handleFieldChange = (
    fieldId: Id<"storyFormFields">,
    field: keyof EditableFormField,
    value: any,
  ) => {
    setEditableFields((prevFields) =>
      prevFields.map((f) => {
        if (f._id === fieldId) {
          return { ...f, [field]: value, isModified: true };
        }
        return f;
      }),
    );
    setError(null);
  };

  const handleMoveField = (
    fieldId: Id<"storyFormFields">,
    direction: "up" | "down",
  ) => {
    setEditableFields((prevFields) => {
      const newFields = [...prevFields];
      const index = newFields.findIndex((f) => f._id === fieldId);
      if (index === -1) return prevFields;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newFields.length) return prevFields;

      // Swap elements
      [newFields[index], newFields[newIndex]] = [
        newFields[newIndex],
        newFields[index],
      ];

      // Mark all fields as modified for reordering
      return newFields.map((f, idx) => ({
        ...f,
        order: idx,
        isModified: true,
      }));
    });
  };

  const handleToggleEnabled = (fieldId: Id<"storyFormFields">) => {
    const field = editableFields.find((f) => f._id === fieldId);
    if (field) {
      handleFieldChange(fieldId, "isEnabled", !field.isEnabled);
    }
  };

  const handleDeleteField = (fieldId: Id<"storyFormFields">) => {
    setEditableFields((prevFields) =>
      prevFields.map((f) =>
        f._id === fieldId ? { ...f, isDeleted: true, isModified: true } : f,
      ),
    );
  };

  const handleUndeleteField = (fieldId: Id<"storyFormFields">) => {
    setEditableFields((prevFields) =>
      prevFields.map((f) =>
        f._id === fieldId ? { ...f, isDeleted: false, isModified: true } : f,
      ),
    );
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldData.key || !newFieldData.label || !newFieldData.placeholder) {
      setError("Key, label, and placeholder are required");
      return;
    }

    const parsedOptions = parseOptionsText(newFieldData.optionsText);
    if (isChoiceFieldType(newFieldData.fieldType) && parsedOptions.length < 2) {
      setError("Choice fields (radio, multi-select, dropdown) need at least 2 options");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const order = editableFields.length;
      const { optionsText: _optionsText, ...fieldData } = newFieldData;
      await createField({
        ...fieldData,
        options: isChoiceFieldType(newFieldData.fieldType)
          ? parsedOptions
          : undefined,
        order,
      });

      setNewFieldData({
        key: "",
        label: "",
        placeholder: "",
        isEnabled: true,
        isRequired: false,
        fieldType: "url",
        description: "",
        storyPropertyName: "",
        optionsText: "",
      });
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to create field:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create field",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const fieldsToProcess = editableFields.filter((f) => f.isModified);

      for (const field of fieldsToProcess) {
        if (field.isDeleted && !field.isNew) {
          await deleteField({ fieldId: field._id });
        } else if (!field.isDeleted && !field.isNew) {
          // Clean in-progress option lines; clear options for non-choice types
          const cleanedOptions = isChoiceFieldType(field.fieldType)
            ? (field.options ?? []).map((o) => o.trim()).filter(Boolean)
            : [];
          if (
            isChoiceFieldType(field.fieldType) &&
            cleanedOptions.length < 2
          ) {
            throw new Error(
              `"${field.label}" needs at least 2 options for a ${field.fieldType} field`,
            );
          }
          await updateField({
            fieldId: field._id,
            key: field.key,
            label: field.label,
            placeholder: field.placeholder,
            isEnabled: field.isEnabled,
            isRequired: field.isRequired,
            order: field.order,
            fieldType: field.fieldType,
            options: cleanedOptions,
            description: field.description,
            storyPropertyName: field.storyPropertyName,
          });
        }
      }

      // Handle reordering
      const nonDeletedFields = editableFields.filter((f) => !f.isDeleted);
      if (nonDeletedFields.some((f) => f.isModified)) {
        await reorderFields({
          fieldIds: nonDeletedFields.map((f) => f._id),
        });
      }

      setEditingFieldId(null);
    } catch (error) {
      console.error("Failed to save changes:", error);
      setError(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const hasPendingChanges = editableFields.some((f) => f.isModified);

  if (authIsLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-surface rounded-lg p-6 border border-hairline text-center">
          Loading authentication...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-canvas rounded-lg p-6 border border-hairline">
        {/* Header and Save Button */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-medium text-copy">Manage Form Fields</h2>
          <div className="flex gap-2">
            {hasPendingChanges && (
              <button
                onClick={handleSave}
                disabled={isProcessing}
                className="px-4 py-2 bg-surface-alt text-copy rounded-md hover:bg-surface-hover transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Save className="w-4 h-4" />
                {isProcessing ? "Saving..." : "Save Changes"}
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-cta text-on-cta rounded-md hover:bg-cta-hover transition-colors flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          </div>
        </div>

        {/* Hackathon Team Info Settings */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-3">
            Hackathon Team Info Settings
          </h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings?.showHackathonTeamInfo ?? false}
              onChange={async (e) => {
                try {
                  await updateSettings({
                    showHackathonTeamInfo: e.target.checked,
                  });
                } catch (error) {
                  console.error("Failed to update team info setting:", error);
                  setError("Failed to update hackathon team info setting");
                }
              }}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <span className="text-sm text-blue-700">
              Show hackathon team info section on submission forms
            </span>
          </label>
          <p className="text-xs text-blue-600 mt-1 ml-6">
            When enabled, displays a team information section on story
            submission forms allowing users to enter team name and member
            details
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Add Field Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-surface-alt rounded-lg border border-hairline">
            <h3 className="text-lg font-medium text-copy mb-4">
              Add New Form Field
            </h3>
            <form onSubmit={handleAddField} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-copy mb-1">
                    Key (unique identifier) *
                  </label>
                  <input
                    type="text"
                    value={newFieldData.key}
                    onChange={(e) =>
                      setNewFieldData((prev) => ({
                        ...prev,
                        key: e.target.value,
                      }))
                    }
                    placeholder="e.g., customUrl"
                    className="w-full px-3 py-2 border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-copy mb-1">
                    Story Property Name *
                  </label>
                  <input
                    type="text"
                    value={newFieldData.storyPropertyName}
                    onChange={(e) =>
                      setNewFieldData((prev) => ({
                        ...prev,
                        storyPropertyName: e.target.value,
                      }))
                    }
                    placeholder="e.g., customUrl"
                    className="w-full px-3 py-2 border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-copy mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  value={newFieldData.label}
                  onChange={(e) =>
                    setNewFieldData((prev) => ({
                      ...prev,
                      label: e.target.value,
                    }))
                  }
                  placeholder="e.g., Custom URL (Optional)"
                  className="w-full px-3 py-2 border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-copy mb-1">
                  Placeholder *
                </label>
                <input
                  type="text"
                  value={newFieldData.placeholder}
                  onChange={(e) =>
                    setNewFieldData((prev) => ({
                      ...prev,
                      placeholder: e.target.value,
                    }))
                  }
                  placeholder="e.g., https://example.com/..."
                  className="w-full px-3 py-2 border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-copy mb-1">
                    Field Type
                  </label>
                  <SimpleSelect
                    value={newFieldData.fieldType}
                    onChange={(value) =>
                      setNewFieldData((prev) => ({
                        ...prev,
                        fieldType: value as any,
                      }))
                    }
                    aria-label="Field type"
                    className="w-full h-auto py-2 text-sm"
                    options={FIELD_TYPE_OPTIONS}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newFieldData.isEnabled}
                      onChange={(e) =>
                        setNewFieldData((prev) => ({
                          ...prev,
                          isEnabled: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-copy">Enabled</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newFieldData.isRequired}
                      onChange={(e) =>
                        setNewFieldData((prev) => ({
                          ...prev,
                          isRequired: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-copy">Required</span>
                  </label>
                </div>
              </div>
              {isChoiceFieldType(newFieldData.fieldType) && (
                <div>
                  <label className="block text-sm font-medium text-copy mb-1">
                    Options (one per line) *
                  </label>
                  <textarea
                    value={newFieldData.optionsText}
                    onChange={(e) =>
                      setNewFieldData((prev) => ({
                        ...prev,
                        optionsText: e.target.value,
                      }))
                    }
                    rows={4}
                    placeholder={"Option A\nOption B\nOption C"}
                    className="w-full px-3 py-2 border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink text-sm"
                  />
                  <p className="text-xs text-soft mt-1">
                    {newFieldData.fieldType === "multiselect"
                      ? "Submitters can pick multiple options."
                      : newFieldData.fieldType === "select"
                        ? "Submitters pick one option from a dropdown."
                        : "Submitters pick one option."}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-copy mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newFieldData.description}
                  onChange={(e) =>
                    setNewFieldData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of the field"
                  className="w-full px-3 py-2 border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-cta text-on-cta rounded-md hover:bg-cta-hover transition-colors disabled:opacity-50 text-sm"
                >
                  {isProcessing ? "Adding..." : "Add Field"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-soft hover:text-copy rounded-md text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading State */}
        {storyFormFields === undefined && <div>Loading form fields...</div>}

        {/* Form Fields List */}
        <div className="space-y-3">
          {editableFields.map((field, index) => (
            <div
              key={field._id}
              className={`border rounded-md overflow-hidden transition-all duration-200 ease-in-out ${
                field.isDeleted
                  ? "border-red-300 bg-red-50"
                  : field.isNew
                    ? "border-green-300 bg-green-50"
                    : field.isModified
                      ? "border-blue-300 bg-blue-50"
                      : "border-hairline bg-surface"
              }`}
            >
              <div
                className={`flex items-center justify-between p-3 ${field.isDeleted ? "opacity-60" : ""}`}
              >
                {/* Move Buttons */}
                {!field.isDeleted && (
                  <div className="flex flex-col mr-2">
                    <button
                      onClick={() => handleMoveField(field._id, "up")}
                      disabled={index === 0 || isProcessing}
                      className="p-1 text-soft hover:text-copy disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveField(field._id, "down")}
                      disabled={
                        index ===
                          editableFields.filter((f) => !f.isDeleted).length -
                            1 || isProcessing
                      }
                      className="p-1 text-soft hover:text-copy disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Field Info */}
                <div className="flex-1 min-w-0">
                  {editingFieldId === field._id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-copy mb-1">
                            Label *
                          </label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) =>
                              handleFieldChange(
                                field._id,
                                "label",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 border border-hairline rounded text-xs"
                            placeholder="Field label"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-copy mb-1">
                            Key *
                          </label>
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) =>
                              handleFieldChange(
                                field._id,
                                "key",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 border border-hairline rounded text-xs"
                            placeholder="Unique key"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-copy mb-1">
                            Placeholder *
                          </label>
                          <input
                            type="text"
                            value={field.placeholder}
                            onChange={(e) =>
                              handleFieldChange(
                                field._id,
                                "placeholder",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 border border-hairline rounded text-xs"
                            placeholder="Placeholder text"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-copy mb-1">
                            Property Name *
                          </label>
                          <input
                            type="text"
                            value={field.storyPropertyName}
                            onChange={(e) =>
                              handleFieldChange(
                                field._id,
                                "storyPropertyName",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 border border-hairline rounded text-xs"
                            placeholder="Story property"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-copy mb-1">
                            Type
                          </label>
                          <SimpleSelect
                            value={field.fieldType}
                            onChange={(value) =>
                              handleFieldChange(field._id, "fieldType", value)
                            }
                            aria-label="Field type"
                            className="w-full h-auto px-2 py-1 text-xs gap-1"
                            options={FIELD_TYPE_OPTIONS}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.isEnabled}
                              onChange={(e) =>
                                handleFieldChange(
                                  field._id,
                                  "isEnabled",
                                  e.target.checked,
                                )
                              }
                              className="rounded"
                            />
                            <span className="text-xs text-copy">Enabled</span>
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.isRequired}
                              onChange={(e) =>
                                handleFieldChange(
                                  field._id,
                                  "isRequired",
                                  e.target.checked,
                                )
                              }
                              className="rounded"
                            />
                            <span className="text-xs text-copy">Required</span>
                          </label>
                        </div>
                      </div>
                      {isChoiceFieldType(field.fieldType) && (
                        <div>
                          <label className="block text-xs font-medium text-copy mb-1">
                            Options (one per line) *
                          </label>
                          <textarea
                            value={(field.options ?? []).join("\n")}
                            onChange={(e) =>
                              handleFieldChange(
                                field._id,
                                "options",
                                e.target.value.split("\n"),
                              )
                            }
                            rows={4}
                            className="w-full px-2 py-1 border border-hairline rounded text-xs"
                            placeholder={"Option A\nOption B\nOption C"}
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-copy mb-1">
                          Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={field.description || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              field._id,
                              "description",
                              e.target.value,
                            )
                          }
                          className="w-full px-2 py-1 border border-hairline rounded text-xs"
                          placeholder="Brief description"
                        />
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div
                      className="cursor-pointer"
                      onClick={() => setEditingFieldId(field._id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-ink">
                          {field.label}
                        </span>
                        <Edit3 className="w-3 h-3 text-faint" />
                        {field.isRequired && (
                          <span className="text-xs text-red-600 bg-red-100 px-1 rounded">
                            Required
                          </span>
                        )}
                        {!field.isEnabled && (
                          <span className="text-xs text-soft">(Disabled)</span>
                        )}
                      </div>
                      <div className="text-sm text-soft space-y-1">
                        <div>
                          Key:{" "}
                          <code className="bg-surface-alt px-1 rounded">
                            {field.key}
                          </code>
                        </div>
                        <div>Placeholder: {field.placeholder}</div>
                        <div>Type: {field.fieldType}</div>
                        {isChoiceFieldType(field.fieldType) &&
                          field.options &&
                          field.options.length > 0 && (
                            <div className="space-y-1">
                              <div>Options: {field.options.join(", ")}</div>
                              {/* Tiny per-option answer bars from submissions */}
                              {(() => {
                                const stats = answerCounts?.[field.key];
                                if (!stats) return null;
                                const max = Math.max(
                                  1,
                                  ...stats.counts.map((c) => c.count),
                                );
                                return (
                                  <div className="mt-1 space-y-0.5 max-w-xs">
                                    {stats.counts.map(({ option, count }) => (
                                      <div
                                        key={option}
                                        className="flex items-center gap-2"
                                      >
                                        <span
                                          className="w-28 truncate text-xs text-soft"
                                          title={option}
                                        >
                                          {option}
                                        </span>
                                        <span className="flex-1 h-1.5 rounded-full bg-surface-alt overflow-hidden">
                                          <span
                                            className="block h-full rounded-full bg-ink opacity-70"
                                            style={{
                                              width: `${(count / max) * 100}%`,
                                            }}
                                          />
                                        </span>
                                        <span className="w-6 text-right text-xs tabular-nums text-soft">
                                          {count}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="text-[11px] text-faint">
                                      {stats.total}{" "}
                                      {stats.total === 1 ? "answer" : "answers"}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        <div>
                          Property:{" "}
                          <code className="bg-surface-alt px-1 rounded">
                            {field.storyPropertyName}
                          </code>
                        </div>
                        {field.description && (
                          <div>Description: {field.description}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingFieldId === field._id ? (
                    // Edit Mode Buttons
                    <>
                      <button
                        onClick={() => {
                          setEditingFieldId(null);
                          // The field changes are already saved in local state, will be persisted on global save
                        }}
                        className="text-green-600 hover:text-green-700 disabled:opacity-50 p-1"
                        title="Save changes"
                        disabled={isProcessing}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingFieldId(null);
                          // Reset field to original state by refreshing from server data
                          if (storyFormFields) {
                            const originalField = storyFormFields.find(
                              (f) => f._id === field._id,
                            );
                            if (originalField) {
                              setEditableFields((prev) =>
                                prev.map((f) =>
                                  f._id === field._id
                                    ? {
                                        ...originalField,
                                        isNew: false,
                                        isModified: false,
                                        isDeleted: false,
                                      }
                                    : f,
                                ),
                              );
                            }
                          }
                        }}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                        title="Cancel changes"
                        disabled={isProcessing}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    // Normal Mode Buttons
                    <>
                      {!field.isDeleted ? (
                        <>
                          <button
                            onClick={() => handleToggleEnabled(field._id)}
                            className="text-soft hover:text-copy disabled:opacity-50 p-1"
                            title={
                              field.isEnabled ? "Disable field" : "Enable field"
                            }
                            disabled={isProcessing}
                          >
                            {field.isEnabled ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteField(field._id)}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                            title="Delete field"
                            disabled={isProcessing}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleUndeleteField(field._id)}
                          className="text-xs text-copy hover:text-ink font-medium disabled:opacity-50 p-1"
                          disabled={isProcessing}
                        >
                          Undo Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 text-xs text-soft">
          <p>Manage form fields that appear in the story submission form.</p>
          <p className="mt-1">
            <span className="font-medium">Note:</span> The core fields (Title,
            Description, URL, Screenshot) are always shown and cannot be
            modified.
          </p>
        </div>
      </div>
    </div>
  );
}
