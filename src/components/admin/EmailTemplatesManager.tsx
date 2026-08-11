import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Eye, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  TEMPLATE_VARIABLES,
  applyTemplateVars,
  judgingGroupUrls,
  renderMarkdownLite,
  templateEmailShell,
} from "../../../convex/emails/render";
import AlertDialog from "../ui/AlertDialog";

// Sample values so the preview shows what a real recipient would get.
// Link variables resolve to the real group's URLs at send time.
const PREVIEW_VARS = {
  firstname: "Ada",
  name: "Ada Lovelace",
  email: "ada@example.com",
  groupname: "Fall Hackathon",
  ...judgingGroupUrls("fall-hackathon"),
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
      <div className="bg-surface rounded-lg p-6 border border-hairline">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-copy flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xl font-medium text-copy">
                Email Templates
              </h2>
              <p className="text-sm text-copy mt-1 max-w-2xl">
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
            className="flex items-center gap-2 px-4 py-2 bg-cta text-on-cta rounded-md hover:bg-cta-hover transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            New template
          </button>
        </div>

        {/* Supported variables */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-soft mr-1">Variables:</span>
          {TEMPLATE_VARIABLES.map((variable) => (
            <code
              key={variable.key}
              title={variable.description}
              className="text-xs text-copy bg-surface-alt border border-hairline rounded px-1.5 py-0.5 font-mono"
            >
              {`{{${variable.key}}}`}
            </code>
          ))}
        </div>
      </div>

      {/* Editor */}
      {editor && (
        <div className="bg-surface rounded-lg p-6 border border-hairline space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-ink">
              {editor.templateId ? "Edit template" : "New template"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditor(null);
                setShowPreview(false);
              }}
              className="text-faint hover:text-copy transition-colors"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label
              htmlFor="template-name"
              className="block text-sm font-medium text-copy mb-1"
            >
              Template name
            </label>
            <input
              id="template-name"
              type="text"
              value={editor.name}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              placeholder="e.g. Judge welcome, Scoring reminder"
              className="w-full max-w-lg px-3 py-2 bg-surface border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink"
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              htmlFor="template-subject"
              className="block text-sm font-medium text-copy mb-1"
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
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink"
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              htmlFor="template-body"
              className="block text-sm font-medium text-copy mb-1"
            >
              Body (markdown)
            </label>
            <textarea
              id="template-body"
              value={editor.body}
              onChange={(e) => setEditor({ ...editor, body: e.target.value })}
              placeholder={`Hi {{firstname}},\n\nJudging for **{{groupname}}** is open.\n\n- Review your assigned submissions\n- Score each criteria\n\nThanks!`}
              rows={10}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink font-mono text-sm"
              disabled={isSaving}
            />
            <p className="text-xs text-soft mt-1">
              Supports **bold**, *italic*, [links](https://example.com), and
              lists starting with "- ". Blank lines separate paragraphs.
            </p>
          </div>

          <div>
            <label
              htmlFor="template-signature"
              className="block text-sm font-medium text-copy mb-1"
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
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink font-mono text-sm"
              disabled={isSaving}
            />
            <p className="text-xs text-soft mt-1">
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
              className="px-4 py-2 rounded-md text-sm font-medium bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-copy bg-surface-alt hover:bg-surface-hover transition-colors disabled:opacity-50"
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
              className="px-4 py-2 rounded-md text-sm font-medium text-copy hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>

          {showPreview && (
            <div className="border border-hairline rounded-md overflow-hidden">
              <div className="px-4 py-2 bg-surface-alt border-b border-hairline text-xs text-copy">
                Preview with sample values: subject "
                {applyTemplateVars(editor.subject, PREVIEW_VARS)}"
              </div>
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                className="w-full h-96 bg-surface"
                sandbox=""
              />
            </div>
          )}
        </div>
      )}

      {/* Template list */}
      <div className="bg-surface rounded-lg border border-hairline">
        <div className="px-6 py-4 border-b border-hairline">
          <h3 className="text-base font-medium text-ink">
            Saved templates
          </h3>
          <p className="text-xs text-soft mt-0.5">
            {templates === undefined
              ? "Loading..."
              : templates.length === 0
                ? "No templates yet. Create one to use it when emailing a judging group."
                : `${templates.length} template${templates.length === 1 ? "" : "s"} available in the judging group Emails section.`}
          </p>
        </div>
        {templates !== undefined && templates.length > 0 && (
          <ul className="divide-y divide-hairline">
            {templates.map((template) => (
              <li
                key={template._id}
                className="px-6 py-4 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">
                    {template.name}
                  </div>
                  <div className="text-xs text-soft truncate">
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
                    className="p-2 text-faint hover:text-copy transition-colors"
                    aria-label={`Edit ${template.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ id: template._id, name: template.name })
                    }
                    className="p-2 text-faint hover:text-red-600 transition-colors"
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
