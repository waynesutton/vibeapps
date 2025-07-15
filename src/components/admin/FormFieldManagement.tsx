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
  Settings,
} from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";

// Interface for editable form field
interface EditableFormField extends Doc<"storyFormFields"> {
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export function FormFieldManagement() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const storyFormFields = useQuery(
    api.storyFormFields.listAdmin,
    authIsLoading || !isAuthenticated ? "skip" : {}
  );

  const createField = useMutation(api.storyFormFields.create);
  const updateField = useMutation(api.storyFormFields.update);
  const deleteField = useMutation(api.storyFormFields.deleteField);
  const reorderFields = useMutation(api.storyFormFields.reorder);

  const [editableFields, setEditableFields] = useState<EditableFormField[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<Id<"storyFormFields"> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    key: "",
    label: "",
    placeholder: "",
    isEnabled: true,
    isRequired: false,
    fieldType: "url" as const,
    description: "",
    storyPropertyName: "",
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
          }))
        );
      }
    }
  }, [storyFormFields, isProcessing]);

  const handleFieldChange = (
    fieldId: Id<"storyFormFields">,
    field: keyof EditableFormField,
    value: any
  ) => {
    setEditableFields((prevFields) =>
      prevFields.map((f) => {
        if (f._id === fieldId) {
          return { ...f, [field]: value, isModified: true };
        }
        return f;
      })
    );
    setError(null);
  };

  const handleMoveField = (fieldId: Id<"storyFormFields">, direction: "up" | "down") => {
    setEditableFields((prevFields) => {
      const newFields = [...prevFields];
      const index = newFields.findIndex((f) => f._id === fieldId);
      if (index === -1) return prevFields;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newFields.length) return prevFields;

      // Swap elements
      [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];

      // Mark all fields as modified for reordering
      return newFields.map((f, idx) => ({ ...f, order: idx, isModified: true }));
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
      prevFields.map((f) => (f._id === fieldId ? { ...f, isDeleted: true, isModified: true } : f))
    );
  };

  const handleUndeleteField = (fieldId: Id<"storyFormFields">) => {
    setEditableFields((prevFields) =>
      prevFields.map((f) => (f._id === fieldId ? { ...f, isDeleted: false, isModified: true } : f))
    );
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldData.key || !newFieldData.label || !newFieldData.placeholder) {
      setError("Key, label, and placeholder are required");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const order = editableFields.length;
      await createField({
        ...newFieldData,
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
      });
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to create field:", error);
      setError(error instanceof Error ? error.message : "Failed to create field");
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
          await updateField({
            fieldId: field._id,
            key: field.key,
            label: field.label,
            placeholder: field.placeholder,
            isEnabled: field.isEnabled,
            isRequired: field.isRequired,
            order: field.order,
            fieldType: field.fieldType,
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
      setError(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsProcessing(false);
    }
  };

  const hasPendingChanges = editableFields.some((f) => f.isModified);

  if (authIsLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          Loading authentication...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        {/* Header and Save Button */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-medium text-[#525252]">Manage Form Fields</h2>
          <div className="flex gap-2">
            {hasPendingChanges && (
              <button
                onClick={handleSave}
                disabled={isProcessing}
                className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm">
                <Save className="w-4 h-4" />
                {isProcessing ? "Saving..." : "Save Changes"}
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-900 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Add Field Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-[#525252] mb-4">Add New Form Field</h3>
            <form onSubmit={handleAddField} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#525252] mb-1">
                    Key (unique identifier) *
                  </label>
                  <input
                    type="text"
                    value={newFieldData.key}
                    onChange={(e) => setNewFieldData((prev) => ({ ...prev, key: e.target.value }))}
                    placeholder="e.g., customUrl"
                    className="w-full px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#525252] mb-1">
                    Story Property Name *
                  </label>
                  <input
                    type="text"
                    value={newFieldData.storyPropertyName}
                    onChange={(e) =>
                      setNewFieldData((prev) => ({ ...prev, storyPropertyName: e.target.value }))
                    }
                    placeholder="e.g., customUrl"
                    className="w-full px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#525252] mb-1">Label *</label>
                <input
                  type="text"
                  value={newFieldData.label}
                  onChange={(e) => setNewFieldData((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Custom URL (Optional)"
                  className="w-full px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#525252] mb-1">
                  Placeholder *
                </label>
                <input
                  type="text"
                  value={newFieldData.placeholder}
                  onChange={(e) =>
                    setNewFieldData((prev) => ({ ...prev, placeholder: e.target.value }))
                  }
                  placeholder="e.g., https://example.com/..."
                  className="w-full px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#525252] mb-1">
                    Field Type
                  </label>
                  <select
                    value={newFieldData.fieldType}
                    onChange={(e) =>
                      setNewFieldData((prev) => ({ ...prev, fieldType: e.target.value as any }))
                    }
                    className="w-full px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] text-sm">
                    <option value="url">URL</option>
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newFieldData.isEnabled}
                      onChange={(e) =>
                        setNewFieldData((prev) => ({ ...prev, isEnabled: e.target.checked }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-[#525252]">Enabled</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newFieldData.isRequired}
                      onChange={(e) =>
                        setNewFieldData((prev) => ({ ...prev, isRequired: e.target.checked }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-[#525252]">Required</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#525252] mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newFieldData.description}
                  onChange={(e) =>
                    setNewFieldData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Brief description of the field"
                  className="w-full px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors disabled:opacity-50 text-sm">
                  {isProcessing ? "Adding..." : "Add Field"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-[#545454] hover:text-[#525252] rounded-md text-sm">
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
                      : "border-gray-200 bg-white"
              }`}>
              <div
                className={`flex items-center justify-between p-3 ${field.isDeleted ? "opacity-60" : ""}`}>
                {/* Move Buttons */}
                {!field.isDeleted && (
                  <div className="flex flex-col mr-2">
                    <button
                      onClick={() => handleMoveField(field._id, "up")}
                      disabled={index === 0 || isProcessing}
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveField(field._id, "down")}
                      disabled={
                        index === editableFields.filter((f) => !f.isDeleted).length - 1 ||
                        isProcessing
                      }
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down">
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
                          <label className="block text-xs font-medium text-[#525252] mb-1">
                            Label *
                          </label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleFieldChange(field._id, "label", e.target.value)}
                            className="w-full px-2 py-1 border border-[#D8E1EC] rounded text-xs"
                            placeholder="Field label"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#525252] mb-1">
                            Key *
                          </label>
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => handleFieldChange(field._id, "key", e.target.value)}
                            className="w-full px-2 py-1 border border-[#D8E1EC] rounded text-xs"
                            placeholder="Unique key"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-[#525252] mb-1">
                            Placeholder *
                          </label>
                          <input
                            type="text"
                            value={field.placeholder}
                            onChange={(e) =>
                              handleFieldChange(field._id, "placeholder", e.target.value)
                            }
                            className="w-full px-2 py-1 border border-[#D8E1EC] rounded text-xs"
                            placeholder="Placeholder text"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#525252] mb-1">
                            Property Name *
                          </label>
                          <input
                            type="text"
                            value={field.storyPropertyName}
                            onChange={(e) =>
                              handleFieldChange(field._id, "storyPropertyName", e.target.value)
                            }
                            className="w-full px-2 py-1 border border-[#D8E1EC] rounded text-xs"
                            placeholder="Story property"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-[#525252] mb-1">
                            Type
                          </label>
                          <select
                            value={field.fieldType}
                            onChange={(e) =>
                              handleFieldChange(field._id, "fieldType", e.target.value)
                            }
                            className="w-full px-2 py-1 border border-[#D8E1EC] rounded text-xs">
                            <option value="url">URL</option>
                            <option value="text">Text</option>
                            <option value="email">Email</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.isEnabled}
                              onChange={(e) =>
                                handleFieldChange(field._id, "isEnabled", e.target.checked)
                              }
                              className="rounded"
                            />
                            <span className="text-xs text-[#525252]">Enabled</span>
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={field.isRequired}
                              onChange={(e) =>
                                handleFieldChange(field._id, "isRequired", e.target.checked)
                              }
                              className="rounded"
                            />
                            <span className="text-xs text-[#525252]">Required</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#525252] mb-1">
                          Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={field.description || ""}
                          onChange={(e) =>
                            handleFieldChange(field._id, "description", e.target.value)
                          }
                          className="w-full px-2 py-1 border border-[#D8E1EC] rounded text-xs"
                          placeholder="Brief description"
                        />
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="cursor-pointer" onClick={() => setEditingFieldId(field._id)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[#292929]">{field.label}</span>
                        <Edit3 className="w-3 h-3 text-gray-400" />
                        {field.isRequired && (
                          <span className="text-xs text-red-600 bg-red-100 px-1 rounded">
                            Required
                          </span>
                        )}
                        {!field.isEnabled && (
                          <span className="text-xs text-gray-500">(Disabled)</span>
                        )}
                      </div>
                      <div className="text-sm text-[#545454] space-y-1">
                        <div>
                          Key: <code className="bg-gray-100 px-1 rounded">{field.key}</code>
                        </div>
                        <div>Placeholder: {field.placeholder}</div>
                        <div>Type: {field.fieldType}</div>
                        <div>
                          Property:{" "}
                          <code className="bg-gray-100 px-1 rounded">
                            {field.storyPropertyName}
                          </code>
                        </div>
                        {field.description && <div>Description: {field.description}</div>}
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
                        disabled={isProcessing}>
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingFieldId(null);
                          // Reset field to original state by refreshing from server data
                          if (storyFormFields) {
                            const originalField = storyFormFields.find((f) => f._id === field._id);
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
                                    : f
                                )
                              );
                            }
                          }
                        }}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                        title="Cancel changes"
                        disabled={isProcessing}>
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
                            className="text-[#545454] hover:text-[#525252] disabled:opacity-50 p-1"
                            title={field.isEnabled ? "Disable field" : "Enable field"}
                            disabled={isProcessing}>
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
                            disabled={isProcessing}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleUndeleteField(field._id)}
                          className="text-xs text-gray-600 hover:text-black font-medium disabled:opacity-50 p-1"
                          disabled={isProcessing}>
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
        <div className="mt-6 text-xs text-[#545454]">
          <p>Manage form fields that appear in the story submission form.</p>
          <p className="mt-1">
            <span className="font-medium">Note:</span> The core fields (Title, Description, URL,
            Screenshot) are always shown and cannot be modified.
          </p>
        </div>
      </div>
    </div>
  );
}
