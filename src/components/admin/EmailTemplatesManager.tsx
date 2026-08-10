import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Eye, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  TEMPLATE_VARIABLES,
  applyTemplateVars,
  renderMarkdownLite,
  templateEmailShell,
} from "../../../convex/emails/render";
import AlertDialog from "../ui/AlertDialog";

// Sample values so the preview shows what a real recipient would get.
const PREVIEW_VARS = {
  firstname: "Ada",
  name: "Ada Lovelace",
  email: "ada@example.com",
  groupname: "Fall Hackathon",
};

type EditorState = {
  templateId: Id<"emailTemplates"> | null;
  name: string;
  subject: string;
  body: string;
  signature: string;
};

const EMPTY_EDITOR: EditorState = {
  templateId: null,
  name: "",
  subject: "",
  body: "",
  signature: "",
};

// Templates sub tab of Email Management: reusable subject + markdown body +
// optional signature, with {{variable}} support and a live preview.
export function EmailTemplatesManager() {
  const templates = useQuery(api.emailTemplates.listTemplates, {});
  const createTemplate = useMutation(api.emailTemplates.createTemplate);
  const updateTemplate = useMutation(api.emailTemplates.updateTemplate);
  const deleteTemplate = useMutation(api.emailTemplates.deleteTemplate);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"emailTemplates">;
    name: string;
  } | null>(null);

  const handleSave = async () => {
    if (!editor) return;
    setIsSaving(true);
    try {
      if (editor.templateId) {
        await updateTemplate({
          templateId: editor.templateId,
          name: editor.name,
          subject: editor.subject,
          body: editor.body,
          signature: editor.signature.trim() || undefined,
        });
        toast.success(`Template "${editor.name.trim()}" updated`);
      } else {
        await createTemplate({
          name: editor.name,
          subject: editor.subject,
          body: editor.body,
          signature: editor.signature.trim() || undefined,
        });
        toast.success(`Template "${editor.name.trim()}" created`);
      }
      setEditor(null);
      setShowPreview(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save template",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTemplate({ templateId: deleteTarget.id });
      toast.success(`Template "${deleteTarget.name}" deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete template",
      );
    } finally {
      setDeleteTarget(null);
    }
  };

  // Rendered preview HTML using the exact same renderer the backend uses
  const previewHtml = editor
    ? templateEmailShell(
        renderMarkdownLite(applyTemplateVars(editor.body, PREVIEW_VARS)),
        editor.signature.trim()
          ? renderMarkdownLite(
              applyTemplateVars(editor.signature, PREVIEW_VARS),
            )
          : undefined,
      )
    : "";

  return (
    <div className="space-y-6">
      {/* Header + create */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-[#525252] flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xl font-medium text-[#525252]">
                Email Templates
              </h2>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                Reusable templates for judging group emails. Bodies support
                basic markdown (bold, italic, links, lists) plus variables that
                fill in per recipient at send time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditor({ ...EMPTY_EDITOR });
              setShowPreview(false);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            New template
          </button>
        </div>

        {/* Supported variables */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">Variables:</span>
          {TEMPLATE_VARIABLES.map((variable) => (
            <code
              key={variable.key}
              title={variable.description}
              className="text-xs text-gray-700 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-mono"
            >
              {`{{${variable.key}}}`}
            </code>
          ))}
        </div>
      </div>

      {/* Editor */}
      {editor && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-[#292929]">
              {editor.templateId ? "Edit template" : "New template"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditor(null);
                setShowPreview(false);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label
              htmlFor="template-name"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Template name
            </label>
            <input
              id="template-name"
              type="text"
              value={editor.name}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              placeholder="e.g. Judge welcome, Scoring reminder"
              className="w-full max-w-lg px-3 py-2 bg-white border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929]"
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              htmlFor="template-subject"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Subject
            </label>
            <input
              id="template-subject"
              type="text"
              value={editor.subject}
              onChange={(e) =>
                setEditor({ ...editor, subject: e.target.value })
              }
              placeholder="e.g. {{groupname}} judging starts today"
              className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929]"
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              htmlFor="template-body"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Body (markdown)
            </label>
            <textarea
              id="template-body"
              value={editor.body}
              onChange={(e) => setEditor({ ...editor, body: e.target.value })}
              placeholder={`Hi {{firstname}},\n\nJudging for **{{groupname}}** is open.\n\n- Review your assigned submissions\n- Score each criteria\n\nThanks!`}
              rows={10}
              className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] font-mono text-sm"
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports **bold**, *italic*, [links](https://example.com), and
              lists starting with "- ". Blank lines separate paragraphs.
            </p>
          </div>

          <div>
            <label
              htmlFor="template-signature"
              className="block text-sm font-medium text-[#525252] mb-1"
            >
              Signature (optional, markdown)
            </label>
            <textarea
              id="template-signature"
              value={editor.signature}
              onChange={(e) =>
                setEditor({ ...editor, signature: e.target.value })
              }
              placeholder={`**The VibeApps Team**\n[vibeapps.dev](https://vibeapps.dev)`}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] font-mono text-sm"
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Rendered below the body with a divider.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={
                isSaving ||
                !editor.name.trim() ||
                !editor.subject.trim() ||
                !editor.body.trim()
              }
              className="px-4 py-2 rounded-md text-sm font-medium bg-[#292929] text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving
                ? "Saving..."
                : editor.templateId
                  ? "Update template"
                  : "Create template"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              disabled={!editor.body.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? "Hide preview" : "Preview"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditor(null);
                setShowPreview(false);
              }}
              className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>

          {showPreview && (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                Preview with sample values: subject "
                {applyTemplateVars(editor.subject, PREVIEW_VARS)}"
              </div>
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                className="w-full h-96 bg-white"
                sandbox=""
              />
            </div>
          )}
        </div>
      )}

      {/* Template list */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-medium text-[#292929]">
            Saved templates
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {templates === undefined
              ? "Loading..."
              : templates.length === 0
                ? "No templates yet. Create one to use it when emailing a judging group."
                : `${templates.length} template${templates.length === 1 ? "" : "s"} available in the judging group Emails section.`}
          </p>
        </div>
        {templates !== undefined && templates.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {templates.map((template) => (
              <li
                key={template._id}
                className="px-6 py-4 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#292929] truncate">
                    {template.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {template.subject}
                    {" · updated "}
                    {new Date(template.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditor({
                        templateId: template._id,
                        name: template.name,
                        subject: template.subject,
                        body: template.body,
                        signature: template.signature ?? "",
                      });
                      setShowPreview(false);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={`Edit ${template.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ id: template._id, name: template.name })
                    }
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label={`Delete ${template.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete template"
        description={`This permanently deletes the "${deleteTarget?.name ?? ""}" template. Emails already sent are not affected.`}
        confirmButtonText="Delete template"
        confirmButtonVariant="destructive"
      />
    </div>
  );
}
