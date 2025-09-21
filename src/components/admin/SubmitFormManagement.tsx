import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  FileText,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Trash2,
  Edit,
  Settings,
} from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CreateSubmitFormModal } from "./CreateSubmitFormModal";
import { EditSubmitFormModal } from "./EditSubmitFormModal";
import { SubmitFormBuilder } from "./SubmitFormBuilder";

interface SubmitForm {
  _id: Id<"submitForms">;
  _creationTime: number;
  title: string;
  slug: string;
  description?: string;
  isEnabled: boolean;
  customHiddenTag: string;
  headerText?: string;
  submitButtonText?: string;
  successMessage?: string;
  disabledMessage?: string;
  isBuiltIn?: boolean;
  createdBy: Id<"users">;
  submissionCount?: number;
}

export function SubmitFormManagement() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const submitForms = useQuery(
    api.submitForms.listSubmitForms,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  const updateSubmitForm = useMutation(api.submitForms.updateSubmitForm);
  const deleteSubmitForm = useMutation(api.submitForms.deleteSubmitForm);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] =
    useState<Id<"submitForms"> | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForm, setEditingForm] = useState<SubmitForm | null>(null);
  const [builderFormId, setBuilderFormId] = useState<Id<"submitForms"> | null>(
    null,
  );

  const toggleFormStatus = (form: SubmitForm) => {
    updateSubmitForm({
      formId: form._id,
      isEnabled: !form.isEnabled,
    });
  };

  const copyFormUrl = async (form: SubmitForm) => {
    const url = `${window.location.origin}/submit/${form.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy Form URL:", err);
    }
  };

  const handleDelete = (formId: Id<"submitForms">) => {
    if (deleteConfirmId === formId) {
      deleteSubmitForm({ formId });
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(formId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleCreateSuccess = () => {
    // Refetch data after successful creation
    setShowCreateModal(false);
  };

  const handleEditSuccess = () => {
    // Refetch data after successful edit
    setEditingForm(null);
  };

  const handleEdit = (form: SubmitForm) => {
    setEditingForm(form);
  };

  const handleManageFields = (formId: Id<"submitForms">) => {
    setBuilderFormId(formId);
  };

  if (authIsLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-[#F2F4F7] rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          Loading authentication...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="bg-[#F2F4F7] rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          Please log in to access submit form management.
        </div>
      </div>
    );
  }

  // Show form builder if a form is selected
  if (builderFormId) {
    return (
      <SubmitFormBuilder
        formId={builderFormId}
        onBack={() => setBuilderFormId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Submit Forms</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage custom submission forms and their settings
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Submit Form
        </button>
      </div>

      {submitForms === undefined ? (
        <div className="bg-[#F2F4F7] rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          Loading submit forms...
        </div>
      ) : submitForms.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-800">
            No Submit Forms Found
          </h2>
          <p className="text-gray-500 mt-2 mb-6">
            Get started by creating your first custom submission form.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Submit Form
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {submitForms.map((form) => (
            <div
              key={form._id}
              className="bg-[#F2F4F7] rounded-lg p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {form.title}
                    </h3>
                    {form.isBuiltIn && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Built-in
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        form.isEnabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {form.isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  {form.description && (
                    <p className="text-gray-600 text-sm mb-2">
                      {form.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>/{form.slug}</span>
                    <span>•</span>
                    <span>{form.submissionCount || 0} submissions</span>
                    <span>•</span>
                    <span>Hidden tag: {form.customHiddenTag}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* Toggle Status */}
                  <button
                    onClick={() => toggleFormStatus(form)}
                    className={`p-2 rounded-lg transition-colors ${
                      form.isEnabled
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    title={form.isEnabled ? "Disable form" : "Enable form"}
                  >
                    {form.isEnabled ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>

                  {/* Copy URL */}
                  <button
                    onClick={() => copyFormUrl(form)}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Copy form URL"
                  >
                    {copiedId === form._id ? (
                      <span className="text-green-600 text-xs font-medium">
                        Copied!
                      </span>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  {/* View Form */}
                  <Link
                    to={`/submit/${form.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    title="View form"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  {/* Edit Form */}
                  <button
                    onClick={() => handleEdit(form)}
                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Edit form"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* Manage Fields */}
                  <button
                    onClick={() => handleManageFields(form._id)}
                    className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    title="Manage form fields"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {/* Delete Form */}
                  {!form.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(form._id)}
                      className={`p-2 rounded-lg transition-colors ${
                        deleteConfirmId === form._id
                          ? "bg-red-200 text-red-800"
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      }`}
                      title={
                        deleteConfirmId === form._id
                          ? "Click again to confirm"
                          : "Delete form"
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateSubmitFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <EditSubmitFormModal
        isOpen={!!editingForm}
        onClose={() => setEditingForm(null)}
        onSuccess={handleEditSuccess}
        form={editingForm}
      />
    </div>
  );
}
