import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { useMutation, usePaginatedQuery, useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useDialog } from "@/hooks/useDialog";
import type { GroupDetails } from "./groupSection";

// Page size options for the per-group activity feed
const PAGE_SIZES = [30, 60, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

// Friendly labels for the group-scoped action keys
const ACTION_LABELS: Record<string, string> = {
  "judging.submissionAdded": "Submission added",
  "judging.submissionRemoved": "Submission removed",
  "judging.aiRunStarted": "AI run started",
  "judging.aiRetryQueued": "AI retry queued",
  "judging.aiReviewCompleted": "AI review completed",
  "judging.aiReviewFailed": "AI review failed",
  "score.submitted": "Score submitted",
  "judgingGroup.created": "Group created",
  "judgingGroup.updated": "Group updated",
};

// Escape a value for a CSV cell
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Pull the story slug out of entry metadata when present so rows can link
// to the public submission page.
function storySlugFrom(metadata: unknown): string | null {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "storySlug" in metadata &&
    typeof (metadata as { storySlug: unknown }).storySlug === "string"
  ) {
    return (metadata as { storySlug: string }).storySlug;
  }
  return null;
}

// Per-group audit feed: submission adds/removes, AI review lifecycle,
// judge scores, and group setting changes. Entries live in the same table
// as the site-wide Activity Log, so both views stay in sync automatically.
export function GroupActivitySection({
  group,
  canManage,
}: {
  group: GroupDetails;
  canManage: boolean;
}) {
  const { showConfirm, DialogComponents } = useDialog();
  const convex = useConvex();

  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { results, status, loadMore } = usePaginatedQuery(
    api.activityLog.listGroupActivity,
    { groupId: group._id },
    { initialNumItems: pageSize },
  );

  const clearGroupActivity = useMutation(api.activityLog.clearGroupActivity);

  // The paginated hook only reads initialNumItems on mount, so growing the
  // page size loads the missing rows immediately.
  const handlePageSizeChange = (value: string) => {
    const size = Number(value) as PageSize;
    setPageSize(size);
    if (results.length < size && status === "CanLoadMore") {
      loadMore(size - results.length);
    }
  };

  // Shared fetch for both export formats
  const fetchAllRows = () =>
    convex.query(api.activityLog.exportGroupActivity, { groupId: group._id });

  const downloadBlob = (content: string, mime: string, extension: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${group.slug}-activity-${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchAllRows();
      const header = ["Time (UTC)", "Action", "Message", "Actor", "Target"].join(
        ",",
      );
      const lines = rows.map((row) =>
        [
          csvCell(new Date(row._creationTime).toISOString()),
          csvCell(row.action),
          csvCell(row.message),
          csvCell(row.actorName ?? "System"),
          csvCell(row.targetLabel ?? row.targetId ?? ""),
        ].join(","),
      );
      downloadBlob(
        [header, ...lines].join("\n"),
        "text/csv;charset=utf-8;",
        "csv",
      );
      toast.success(`Exported ${rows.length} entries`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchAllRows();
      const lines: string[] = [
        `# Activity log for ${group.name}`,
        "",
        `Exported ${new Date().toISOString()} (${rows.length} entries, newest first)`,
        "",
        "| Time (UTC) | Action | Activity | Actor |",
        "| --- | --- | --- | --- |",
        ...rows.map((row) => {
          const time = new Date(row._creationTime).toISOString();
          const action = ACTION_LABELS[row.action] ?? row.action;
          const message = row.message.replace(/\|/g, "\\|");
          const actor = (row.actorName ?? "System").replace(/\|/g, "\\|");
          return `| ${time} | ${action} | ${message} | ${actor} |`;
        }),
      ];
      downloadBlob(lines.join("\n"), "text/markdown;charset=utf-8;", "md");
      toast.success(`Saved ${rows.length} entries as markdown`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = () => {
    showConfirm(
      "Clear group activity",
      `Permanently delete every activity entry for "${group.name}"? These entries are also removed from the site-wide Activity Log. Export first if you need an audit copy. This cannot be undone.`,
      () => {
        void (async () => {
          setIsClearing(true);
          try {
            let done = false;
            let total = 0;
            while (!done) {
              const result = await clearGroupActivity({ groupId: group._id });
              total += result.deleted;
              done = result.done;
            }
            toast.success(`Cleared ${total} entries`);
          } catch {
            toast.error("Clear failed partway; run it again to finish");
          } finally {
            setIsClearing(false);
          }
        })();
      },
      { confirmButtonText: "Clear log", confirmButtonVariant: "destructive" },
    );
  };

  return (
    <div className="space-y-4">
      {/* Header + toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-ink">Activity</h2>
          <p className="text-[13px] text-soft">
            Realtime audit trail for this group: submissions added or
            removed, AI review runs, and judge scores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  Show {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportCsv()}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportMarkdown()}
            disabled={isExporting}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Save as .md
          </Button>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isClearing || results.length === 0}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isClearing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Entries */}
      <div className="border border-hairline rounded-lg overflow-hidden bg-surface">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-hairline bg-surface-alt text-xs font-medium text-soft">
          <span className="w-36 shrink-0 hidden sm:block">Event</span>
          <span className="flex-1">Activity</span>
          <span className="w-28 shrink-0 hidden md:block">Actor</span>
          <span className="w-24 shrink-0 text-right">When</span>
        </div>

        {status === "LoadingFirstPage" ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-soft">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading activity...
          </div>
        ) : results.length === 0 ? (
          <div className="py-10 text-center text-sm text-soft">
            No activity yet. Submission adds and removals, AI review runs,
            and judge scores for this group will show up here.
          </div>
        ) : (
          results.map((row) => {
            const slug = storySlugFrom(row.metadata);
            return (
              <div
                key={row._id}
                className="flex items-center gap-3 px-3 py-2 border-b border-hairline last:border-b-0 hover:bg-surface-hover"
              >
                <span className="w-36 shrink-0 hidden sm:inline-flex items-center text-[11px] font-medium border border-hairline bg-surface-alt text-copy rounded-full px-2 py-0.5 truncate">
                  {ACTION_LABELS[row.action] ?? row.action}
                </span>
                <span
                  className="flex-1 text-[13px] text-ink truncate"
                  title={row.message}
                >
                  {row.message}
                  {slug && (
                    <Link
                      to={`/s/${slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-1.5 text-xs text-soft hover:text-ink align-middle"
                      title="Open submission"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </span>
                <span className="w-28 shrink-0 hidden md:block text-xs text-soft truncate">
                  {row.actorName ?? "System"}
                </span>
                <span
                  className="w-24 shrink-0 text-right text-xs text-faint"
                  title={new Date(row._creationTime).toLocaleString()}
                >
                  {formatDistanceToNow(row._creationTime, { addSuffix: true })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => loadMore(pageSize)}>
            Load {pageSize} more
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <div className="flex justify-center py-2 text-sm text-soft">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}

      <DialogComponents />
    </div>
  );
}
