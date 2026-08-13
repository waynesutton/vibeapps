import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEscapeKey } from "../../../hooks/useEscapeKey";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

// Mirror of convex/judgingGroups generateSlug so the preview matches save.
function previewSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Pencil + warning dialog for changing a judging group's URL slug.
 * After save, replace-navigates to /admin/judging/{newSlug} so the workspace
 * does not 404 on the old path.
 */
export function GroupSlugEditor({
  groupId,
  currentSlug,
  variant = "icon",
}: {
  groupId: Id<"judgingGroups">;
  currentSlug: string;
  variant?: "icon" | "button";
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const updateSlug = useMutation(api.judgingGroups.updateGroupSlug);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(currentSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const sanitized = previewSlug(draft);
  const unchanged = sanitized === currentSlug;
  const canSave = sanitized.length >= 2 && !unchanged && !saving;

  useEffect(() => {
    if (open) {
      setDraft(currentSlug);
      setError("");
      setSaving(false);
      // Focus the input once the dialog is painted.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open, currentSlug]);

  const close = () => {
    if (saving) return;
    setOpen(false);
  };

  useEscapeKey(open && !saving, close);

  const handleConfirm = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateSlug({ groupId, slug: draft });
      const section = searchParams.get("section");
      const next = section
        ? `/admin/judging/${result.slug}?section=${section}`
        : `/admin/judging/${result.slug}`;
      setOpen(false);
      toast.success("URL slug updated");
      void navigate(next, { replace: true });
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error
          ? err.message
              .replace(/^\[.*?\]\s*/, "")
              .replace(/^Uncaught Error:\s*/, "")
          : "Could not change the slug. Try again.",
      );
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex p-1 text-faint hover:text-ink hover:bg-surface-hover rounded-md transition-colors"
          title="Change URL slug"
          aria-label="Change URL slug"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-soft hover:text-ink hover:bg-surface-hover rounded-md transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Change slug
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          aria-labelledby="slug-dialog-title"
          aria-describedby="slug-dialog-description"
          aria-modal="true"
          role="alertdialog"
        >
          <div className="bg-canvas rounded-lg border border-hairline p-6 w-full max-w-md m-4">
            <h2
              id="slug-dialog-title"
              className="text-lg font-semibold text-ink mb-2"
            >
              Change URL slug
            </h2>
            <div
              id="slug-dialog-description"
              className="text-sm text-copy mb-4 space-y-2"
            >
              <p>
                Changing this slug updates every public URL for this group. The
                judging interface, submit page, results, AI results, admin
                workspace, and Agent API all follow the new slug.
              </p>
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                Old links stop working. Emails already sent still use the old
                URL. Anyone with a bookmarked or shared link needs the new one.
              </div>
            </div>

            <Label htmlFor="group-slug-input">New slug</Label>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-faint font-mono shrink-0">
                /judging/
              </span>
              <Input
                id="group-slug-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError("");
                }}
                disabled={saving}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleConfirm();
                  }
                }}
              />
            </div>
            <p className="text-xs text-faint font-mono mt-1.5">
              Preview: /judging/{sanitized || "…"}
            </p>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm font-medium bg-surface-alt text-copy hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!canSave}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:hover:bg-red-600"
              >
                {saving ? "Changing…" : "Change slug"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
