import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Save, Trash2, Eye, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { CustomForm, FormField } from "../../types";

// Define field types allowed by Convex schema
const FIELD_TYPES: FormField["fieldType"][] = [
  "shortText",
  "longText",
  "url",
  "email",
  "yesNo",
  "dropdown",
  "multiSelect",
];

// Interface for editable fields in local state
interface EditableFormField extends Partial<FormField> {
  _id?: Id<"formFields">; // Existing ID from Convex
  localId: string; // Local temporary ID for React key
  options?: string[];
  fieldType?: FormField["fieldType"];
  label?: string;
  required?: boolean;
  placeholder?: string;
  order?: number; // Add missing order property
}

export function FormBuilder() {
  const navigate = useNavigate();
  const { formId } = useParams<{ formId?: Id<"forms"> }>(); // Get formId from URL if editing

  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth(); // Get auth state

  // Check if user is admin
  const isUserAdmin = useQuery(
    api.users.checkIsUserAdmin,
    isAuthenticated ? {} : "skip",
  );

  // Fetch existing form data if formId is present
  const existingFormData = useQuery(
    api.forms.getFormWithFields,
    // Skip logic:
    // 1. If no formId (new form), always skip.
    // 2. If formId exists, but auth is loading or user not authenticated, skip.
    // 3. Otherwise (formId exists and auth is OK), pass { formId }.
    !formId || (formId && (authIsLoading || !isAuthenticated))
      ? "skip"
      : { formId },
  );

  const createForm = useMutation(api.forms.createForm);
  const updateForm = useMutation(api.forms.updateForm);
  const saveFieldsMutation = useMutation(api.forms.saveFields);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [resultsArePublic, setResultsArePublic] = useState(false);
  const [fields, setFields] = useState<EditableFormField[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFormId, setCurrentFormId] = useState<Id<"forms"> | null>(
    formId ?? null,
  );

  // Load existing form data into state
  useEffect(() => {
    if (existingFormData) {
      setCurrentFormId(existingFormData._id);
      setTitle(existingFormData.title);
      setSlug(existingFormData.slug);
      setIsPublic(existingFormData.isPublic);
      setResultsArePublic(existingFormData.resultsArePublic ?? false);
      setFields(existingFormData.fields.map((f) => ({ ...f, localId: f._id })));
    } else if (!formId) {
      // Reset state if creating a new form (no formId)
      setTitle("");
      setSlug("");
      setIsPublic(false);
      setResultsArePublic(false);
      setFields([]);
      setCurrentFormId(null);
    }
  }, [existingFormData, formId]);

  const addField = (type: FormField["fieldType"]) => {
    const newField: EditableFormField = {
      localId: `new-${Date.now()}`,
      fieldType: type,
      label: "",
      order: fields.length, // Assign order based on current length
      required: false,
      options: type === "dropdown" || type === "multiSelect" ? [""] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (
    localId: string,
    updates: Partial<EditableFormField>,
  ) => {
    setFields(
      fields.map((field) =>
        field.localId === localId ? { ...field, ...updates } : field,
      ),
    );
  };

  const removeField = (localId: string) => {
    setFields(
      fields
        .filter((field) => field.localId !== localId)
        .map((f, index) => ({ ...f, order: index })),
    ); // Re-order remaining
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      let savedFormId = currentFormId;

      // Step 1: Create or Update the Form document
      if (savedFormId) {
        // Update existing form title, public status, and results public status
        await updateForm({
          formId: savedFormId,
          title,
          isPublic,
          resultsArePublic,
        });
      } else {
        // Create new form - only pass title, backend handles slug and defaults
        savedFormId = await createForm({ title });
        if (!savedFormId) throw new Error("Failed to create form document.");
        setCurrentFormId(savedFormId);
        // Navigate to the edit page with the new ID, replacing history
        navigate(`/admin/forms/${savedFormId}`, { replace: true });
      }

      // Step 2: Save the fields associated with the form
      // Ensure fields are valid before sending
      const fieldsToSave = fields.map((f, index) => {
        if (!f.fieldType)
          throw new Error(`Field at index ${index} missing fieldType`);
        return {
          order: index, // Ensure order is sequential
          label: f.label || "Untitled Field", // Provide default label
          fieldType: f.fieldType,
          required: f.required || false,
          options: f.options,
          placeholder: f.placeholder,
        };
      });

      await saveFieldsMutation({
        formId: savedFormId,
        fields: fieldsToSave,
      });

      console.log("Form and fields saved successfully!");
      // Optionally show a success message (could be a state update)
      // Example: setShowSuccess(true); setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save form:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred during save.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle auth loading state first
  if (authIsLoading || (isAuthenticated && isUserAdmin === undefined)) {
    return <div>Loading authentication...</div>;
  }

  // Show 404 for non-authenticated users or users without admin role
  if (!isAuthenticated || isUserAdmin === false) {
    return <NotFoundPage />;
  }

  // Loading state for existing form (only if formId is present and auth is fine)
  if (formId && isAuthenticated && existingFormData === undefined) {
    return <div>Loading form data...</div>;
  }
  // Error state if formId provided but not found (and auth is fine)
  if (formId && isAuthenticated && existingFormData === null) {
    return (
      <div>
        Form not found. <Link to="/admin/forms/new">Create a new one?</Link>
      </div>
    );
  }

  // --- Render Helper for Field Editor ---
  const renderFieldEditor = (field: EditableFormField) => (
    <div
      key={field.localId}
      className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white"
    >
      <div className="flex justify-between items-start gap-2">
        {/* Field Label Input */}
        <input
          type="text"
          value={field.label ?? ""}
          onChange={(e) =>
            updateField(field.localId, { label: e.target.value })
          }
          placeholder="Field Label (e.g., Your Name)"
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929]"
        />
        {/* Field Type Selector */}
        <select
          value={field.fieldType}
          onChange={(e) =>
            updateField(field.localId, {
              fieldType: e.target.value as FormField["fieldType"],
            })
          }
          className="px-2 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929]"
        >
          {FIELD_TYPES.map((ft) => (
            <option key={ft} value={ft}>
              {ft}
            </option>
          ))}
        </select>
        {/* Delete Field Button */}
        <button
          onClick={() => removeField(field.localId)}
          className="p-2 text-gray-400 hover:text-red-600"
          title="Delete Field"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Placeholder Input */}
      {(field.fieldType === "shortText" ||
        field.fieldType === "longText" ||
        field.fieldType === "url" ||
        field.fieldType === "email") && (
        <input
          type="text"
          value={field.placeholder ?? ""}
          onChange={(e) =>
            updateField(field.localId, { placeholder: e.target.value })
          }
          placeholder="Placeholder Text (Optional)"
          className="w-full px-3 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#292929]"
        />
      )}

      {/* Options Editor (for dropdown/multiSelect) */}
      {(field.fieldType === "dropdown" ||
        field.fieldType === "multiSelect") && (
        <div className="space-y-2 pl-4 border-l-2 border-gray-100">
          <label className="block text-xs font-medium text-gray-500">
            Options
          </label>
          {(field.options || []).map((option, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...(field.options || [])];
                  newOptions[index] = e.target.value;
                  updateField(field.localId, { options: newOptions });
                }}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929]"
              />
              <button
                onClick={() => {
                  const newOptions = (field.options || []).filter(
                    (_, i) => i !== index,
                  );
                  updateField(field.localId, { options: newOptions });
                }}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Delete Option"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newOptions = [...(field.options || []), ""];
              updateField(field.localId, { options: newOptions });
            }}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Option
          </button>
        </div>
      )}

      {/* Required Toggle */}
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) =>
              updateField(field.localId, { required: e.target.checked })
            }
            className="rounded border-gray-300 text-[#292929] focus:ring-[#292929] focus:ring-offset-0 h-4 w-4"
          />
          <span className="text-xs text-[#525252]">Required</span>
        </label>
      </div>
    </div>
  );

  // --- Render Helper for Form Preview ---
  const renderPreview = () => (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h1 className="text-xl font-medium text-[#292929] mb-6">
        {title || "Untitled Form"}
      </h1>
      {fields.length === 0 && (
        <p className="text-gray-500">Add some fields to see the preview.</p>
      )}
      <form className="space-y-6">
        {fields.map((field) => (
          <div key={field.localId}>
            <label className="block text-sm font-medium text-[#525252] mb-1">
              {field.label || "Untitled Field"}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {/* Simplified rendering for preview */}
            <input
              type="text"
              placeholder={field.placeholder || ""}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 text-sm cursor-not-allowed"
              disabled
            />
            {/* Add more sophisticated preview rendering based on fieldType if needed */}
          </div>
        ))}
      </form>
    </div>
  );

  // --- Main Component Return ---
  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/admin?tab=forms"
        className="text-sm text-[#545454] hover:text-[#525252] flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Forms List
      </Link>

      {/* Header: Title, Preview/Save Buttons */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl font-medium text-[#525252]">
          {currentFormId ? "Edit Form" : "Create New Form"}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-3 py-1.5 bg-white border border-gray-300 text-[#525252] rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 text-sm"
          >
            <Eye className="w-4 h-4" />
            {previewMode ? "Edit Fields" : "Preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="px-4 py-1.5 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            {isSaving
              ? "Saving..."
              : currentFormId
                ? "Save Changes"
                : "Save Form"}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Editor or Preview Pane */}
      {!previewMode ? (
        <div className="space-y-6">
          {/* Form Settings (Title, Slug, Public, Results Public) */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Form Settings
            </h3>
            {/* Form Title */}
            <div>
              <label
                htmlFor="formTitle"
                className="block text-xs text-gray-500 mb-1"
              >
                Form Title
              </label>
              <input
                id="formTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter form title (e.g., Contact Us)"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] text-sm"
                required
              />
            </div>
            {/* Display Slug (read-only from state) */}
            {slug && (
              <div className="text-xs text-gray-400">
                Public URL: /f/{slug} (Auto-generated from title on save)
              </div>
            )}
            {/* Make Form Public */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-gray-300 text-[#292929] focus:ring-[#292929] focus:ring-offset-0 h-4 w-4"
                />
                <span className="text-sm text-[#525252]">
                  Make Form Publicly Accessible
                </span>
              </label>
            </div>
            {/* Make Results Public */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resultsArePublic}
                  onChange={(e) => setResultsArePublic(e.target.checked)}
                  className="rounded border-gray-300 text-[#292929] focus:ring-[#292929] focus:ring-offset-0 h-4 w-4"
                />
                <span className="text-sm text-[#525252]">
                  Make Results Publicly Accessible (at /results/{slug})
                </span>
              </label>
            </div>
          </div>

          {/* Field Editor Area */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-500">Form Fields</h3>
            {fields.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                No fields added yet.
              </p>
            )}
            {fields.map((field) => renderFieldEditor(field))}
          </div>

          {/* Add Field Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
            {FIELD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addField(type)}
                className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1 text-xs"
              >
                <Plus className="w-3 h-3" />
                {type}
              </button>
            ))}
          </div>
        </div>
      ) : (
        renderPreview()
      )}
    </div>
  );
}
