import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Eye, EyeOff, Copy, ExternalLink, Trash2, BarChart2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { CustomForm } from "../../types";

export function Forms() {
  const forms = useQuery(api.forms.listForms);
  const updateForm = useMutation(api.forms.updateForm);
  const deleteForm = useMutation(api.forms.deleteForm);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id<"forms"> | null>(null);

  const toggleVisibility = (form: CustomForm) => {
    updateForm({ formId: form._id, isPublic: !form.isPublic });
  };

  const copyFormUrl = async (form: CustomForm) => {
    const url = `${window.location.origin}/f/${form.slug}`; // Use /f/ prefix
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      // Optionally show an error message to the user
    }
  };

  const handleDelete = (formId: Id<"forms">) => {
    if (deleteConfirmId === formId) {
      // Confirm deletion
      deleteForm({ formId });
      setDeleteConfirmId(null);
    } else {
      // Ask for confirmation
      setDeleteConfirmId(formId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl font-medium text-[#525252]">Custom Forms</h2>
        <Link
          to="/admin/forms/new"
          className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Create New Form
        </Link>
      </div>

      {forms === undefined && <div>Loading forms...</div>}
      {forms && forms.length === 0 && (
        <div className="text-center py-8 text-gray-500">You haven't created any forms yet.</div>
      )}

      {forms && forms.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left p-3 px-4 text-[#525252] font-medium">Form Title</th>
                  <th className="text-left p-3 px-4 text-[#525252] font-medium">Status</th>
                  <th className="text-left p-3 px-4 text-[#525252] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((form) => (
                  <tr
                    key={form._id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    {/* Form Title / Link to Builder */}
                    <td className="p-3 px-4">
                      <Link
                        to={`/admin/forms/${form._id}`}
                        className="text-[#525252] hover:text-[#2A2825] font-medium">
                        {form.title}
                      </Link>
                      <span className="text-xs text-gray-400 ml-2">/f/{form.slug}</span>
                    </td>
                    {/* Status (Public/Private) */}
                    <td className="p-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          form.isPublic
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                        {form.isPublic ? "Public" : "Private"}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-3">
                        {/* Edit Form */}
                        <Link
                          to={`/admin/forms/${form._id}`}
                          className="text-gray-500 hover:text-blue-600"
                          title="Edit Form">
                          <FileText className="w-4 h-4" />
                        </Link>
                        {/* View Results */}
                        <Link
                          to={`/admin/forms/${form._id}/results`}
                          className="text-gray-500 hover:text-purple-600"
                          title="View Results">
                          <BarChart2 className="w-4 h-4" />
                        </Link>
                        {/* Toggle Visibility */}
                        <button
                          onClick={() => toggleVisibility(form)}
                          className="text-gray-500 hover:text-gray-800"
                          title={form.isPublic ? "Make Private" : "Make Public"}>
                          {form.isPublic ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        {/* Copy URL */}
                        <button
                          onClick={() => copyFormUrl(form)}
                          className={`text-gray-500 ${copiedId === form._id ? "text-green-600" : "hover:text-gray-800"}`}
                          title={copiedId === form._id ? "Copied!" : "Copy Public URL"}
                          disabled={!form.isPublic}>
                          <Copy className="w-4 h-4" />
                        </button>
                        {/* Visit Public URL */}
                        <Link
                          to={`/f/${form.slug}`}
                          target="_blank"
                          className={`text-gray-500 ${!form.isPublic ? "opacity-50 cursor-not-allowed" : "hover:text-blue-600"}`}
                          title={form.isPublic ? "Visit Public Form" : "Form is private"}
                          onClick={(e) => !form.isPublic && e.preventDefault()} // Prevent navigation if private
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(form._id)}
                          className={`text-gray-500 ${deleteConfirmId === form._id ? "text-red-600 font-bold" : "hover:text-red-600"}`}
                          title={deleteConfirmId === form._id ? "Confirm Delete?" : "Delete Form"}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {deleteConfirmId === form._id && (
                        <span className="text-xs text-red-600 ml-2">
                          Click again to confirm delete.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
