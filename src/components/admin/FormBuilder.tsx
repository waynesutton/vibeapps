import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Save, Trash2, Eye, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { api } from "../../../convex/_generated/api";
import { useAdminAccessQuery } from "./useAdminAccess";
import { Id } from "../../../convex/_generated/dataModel";
import type { CustomForm, FormField } from "../../types";
import { SimpleSelect } from "../ui/SimpleSelect";

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

  const { isLoading: authIsLoading, isAuthenticated, access } =
    useAdminAccessQuery();

  // Needs forms.manage (full admins always pass)
  const canManageForms =
    access !== null &&
    (access.isAdmin || access.permissions.includes("forms.manage"));

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
  if (authIsLoading) {
    return <div>Loading authentication...</div>;
  }

  // Show 404 for non-authenticated users or users without forms access
  if (!isAuthenticated || !canManageForms) {
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
      className="border border-hairline rounded-lg p-4 space-y-3 bg-surface"
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
          className="flex-1 px-3 py-2 bg-surface border border-hairline-strong rounded-md text-sm text-copy focus:outline-none focus:ring-1 focus:ring-ink"
        />
        {/* Field Type Selector */}
        <SimpleSelect
          value={field.fieldType}
          onChange={(value) =>
            updateField(field.localId, {
              fieldType: value as FormField["fieldType"],
            })
          }
          aria-label="Field type"
          className="w-auto h-auto px-2 py-2 text-sm gap-1"
          options={FIELD_TYPES.map((ft) => ({ value: ft, label: ft }))}
        />
        {/* Delete Field Button */}
        <button
          onClick={() => removeField(field.localId)}
          className="p-2 text-faint hover:text-red-600"
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
          className="w-full px-3 py-1 bg-surface-alt border border-hairline rounded-md text-xs text-soft focus:outline-none focus:ring-1 focus:ring-ink"
        />
      )}

      {/* Options Editor (for dropdown/multiSelect) */}
      {(field.fieldType === "dropdown" ||
        field.fieldType === "multiSelect") && (
        <div className="space-y-2 pl-4 border-l-2 border-hairline">
          <label className="block text-xs font-medium text-soft">
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
                className="flex-1 px-2 py-1 bg-surface border border-hairline-strong rounded-md text-sm text-copy focus:outline-none focus:ring-1 focus:ring-ink"
              />
              <button
                onClick={() => {
                  const newOptions = (field.options || []).filter(
                    (_, i) => i !== index,
                  );
                  updateField(field.localId, { options: newOptions });
                }}
                className="p-1 text-faint hover:text-red-600"
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
            className="rounded border-hairline-strong text-ink focus:ring-ink focus:ring-offset-0 h-4 w-4"
          />
          <span className="text-xs text-copy">Required</span>
        </label>
      </div>
    </div>
  );

  // --- Render Helper for Form Preview ---
  const renderPreview = () => (
    <div className="bg-surface rounded-lg p-6 border border-hairline">
      <h1 className="text-xl font-medium text-ink mb-6">
        {title || "Untitled Form"}
      </h1>
      {fields.length === 0 && (
        <p className="text-soft">Add some fields to see the preview.</p>
      )}
      <form className="space-y-6">
        {fields.map((field) => (
          <div key={field.localId}>
            <label className="block text-sm font-medium text-copy mb-1">
              {field.label || "Untitled Field"}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {/* Simplified rendering for preview */}
            <input
              type="text"
              placeholder={field.placeholder || ""}
              className="w-full px-3 py-2 bg-surface-alt border border-hairline-strong rounded-md text-copy text-sm cursor-not-allowed"
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
        className="text-sm text-soft hover:text-copy flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Forms List
      </Link>

      {/* Header: Title, Preview/Save Buttons */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl font-medium text-copy">
          {currentFormId ? "Edit Form" : "Create New Form"}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-3 py-1.5 bg-surface border border-hairline-strong text-copy rounded-md hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-sm"
          >
            <Eye className="w-4 h-4" />
            {previewMode ? "Edit Fields" : "Preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="px-4 py-1.5 bg-cta text-on-cta rounded-md hover:bg-cta-hover transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
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
          <div className="bg-surface p-4 rounded-lg border border-hairline space-y-4">
            <h3 className="text-sm font-medium text-soft mb-2">
              Form Settings
            </h3>
            {/* Form Title */}
            <div>
              <label
                htmlFor="formTitle"
                className="block text-xs text-soft mb-1"
              >
                Form Title
              </label>
              <input
                id="formTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter form title (e.g., Contact Us)"
                className="w-full px-3 py-2 bg-surface border border-hairline-strong rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink text-sm"
                required
              />
            </div>
            {/* Display Slug (read-only from state) */}
            {slug && (
              <div className="text-xs text-faint">
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
                  className="rounded border-hairline-strong text-ink focus:ring-ink focus:ring-offset-0 h-4 w-4"
                />
                <span className="text-sm text-copy">
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
                  className="rounded border-hairline-strong text-ink focus:ring-ink focus:ring-offset-0 h-4 w-4"
                />
                <span className="text-sm text-copy">
                  Make Results Publicly Accessible (at /results/{slug})
                </span>
              </label>
            </div>
          </div>

          {/* Field Editor Area */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-soft">Form Fields</h3>
            {fields.length === 0 && (
              <p className="text-sm text-faint italic">
                No fields added yet.
              </p>
            )}
            {fields.map((field) => renderFieldEditor(field))}
          </div>

          {/* Add Field Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-hairline">
            {FIELD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addField(type)}
                className="px-3 py-1 bg-surface-alt text-copy rounded-md hover:bg-surface-hover transition-colors flex items-center gap-1 text-xs"
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
