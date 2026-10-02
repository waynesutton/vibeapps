import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Check, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useDialog } from "../../../hooks/useDialog";
import { getConvexErrorMessage } from "../../../lib/convexErrors";
import type { ResearchThread } from "./researchExport";

// Shared thread list: newest activity first, inline rename, confirm delete
export function ResearchThreadList({
  threads,
  activeId,
  onSelect,
  onNew,
}: {
  threads: Array<ResearchThread> | undefined;
  activeId: Id<"researchThreads"> | null;
  onSelect: (threadId: Id<"researchThreads">) => void;
  onNew: () => void;
}) {
  const renameThread = useMutation(api.research.renameThread);
  const deleteThread = useMutation(api.research.deleteThread);
  const { showConfirm, DialogComponents } = useDialog();
  const [editingId, setEditingId] = useState<Id<"researchThreads"> | null>(
    null,
  );
  const [title, setTitle] = useState("");

  const startEdit = (thread: ResearchThread) => {
    setEditingId(thread._id);
    setTitle(thread.title);
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    try {
      await renameThread({ threadId: editingId, title });
      setEditingId(null);
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not rename the thread"));
    }
  };

  const confirmDelete = (thread: ResearchThread) => {
    showConfirm(
      "Delete this thread?",
      `"${thread.title}" and every answer in it will be removed for all admins.`,
      () => {
        void (async () => {
          try {
            // Leave the thread first so the shared link check does not flag
            // our own delete as a missing thread
            if (activeId === thread._id) onNew();
            await deleteThread({ threadId: thread._id });
            toast.success("Thread deleted");
          } catch (error) {
            toast.error(
              getConvexErrorMessage(error, "Could not delete the thread"),
            );
          }
        })();
      },
      { confirmButtonText: "Delete", confirmButtonVariant: "destructive" },
    );
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-2 border-b border-hairline">
        <button
          type="button"
          onClick={onNew}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline bg-surface text-[13px] font-medium text-ink hover:bg-surface-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New thread
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
        {threads === undefined ? (
          <p className="px-2 py-2 text-[12px] text-faint">Loading...</p>
        ) : threads.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-faint">
            No threads yet. Ask your first question.
          </p>
        ) : (
          threads.map((thread) => {
            const isActive = thread._id === activeId;
            if (editingId === thread._id) {
              return (
                <form
                  key={thread._id}
                  onSubmit={(event) => void saveEdit(event)}
                  className="flex items-center gap-1 px-1 py-1"
                >
                  <input
                    autoFocus
                    value={title}
                    maxLength={80}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    aria-label="Thread title"
                    className="flex-1 min-w-0 px-2 py-1 rounded border border-hairline bg-surface text-[12px] text-ink focus:outline-none focus:border-hairline-strong"
                  />
                  <button
                    type="submit"
                    className="p-1 text-faint hover:text-ink"
                    aria-label="Save title"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="p-1 text-faint hover:text-ink"
                    aria-label="Cancel rename"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              );
            }
            return (
              <div
                key={thread._id}
                className={`group flex items-start gap-1 rounded-md transition-colors ${
                  isActive ? "bg-surface-alt" : "hover:bg-surface-hover"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(thread._id)}
                  aria-current={isActive ? "true" : undefined}
                  className="flex-1 min-w-0 flex items-start gap-2 px-2 py-1.5 text-left"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-faint flex-shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span
                      className={`block text-[12px] truncate ${
                        isActive ? "text-ink font-medium" : "text-copy"
                      }`}
                    >
                      {thread.title}
                    </span>
                    <span className="block text-[11px] text-faint truncate">
                      {thread.createdByName} ·{" "}
                      {formatDistanceToNow(thread.lastMessageAt, {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                </button>
                <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity pt-1 pr-1">
                  <button
                    type="button"
                    onClick={() => startEdit(thread)}
                    className="p-1 text-faint hover:text-ink"
                    aria-label={`Rename ${thread.title}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(thread)}
                    className="p-1 text-faint hover:text-red-600"
                    aria-label={`Delete ${thread.title}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <DialogComponents />
    </div>
  );
}
