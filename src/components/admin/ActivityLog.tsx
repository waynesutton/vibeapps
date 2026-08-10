import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  Inbox,
  ShieldAlert,
  Scale,
  Star,
  Gavel,
  KeyRound,
  Settings2,
  Pause,
  Play,
  Download,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, usePaginatedQuery, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
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
import { useAdminAccess } from "./useAdminAccess";

type Category =
  | "email"
  | "submission"
  | "spam"
  | "judging"
  | "scoring"
  | "moderation"
  | "access"
  | "settings";

type CategoryFilter = "all" | Category;
type SortOrder = "desc" | "asc";
type ViewMode = "active" | "archived";

// Icon + tint per category for the row badge
const CATEGORY_META: Record<
  Category,
  { label: string; icon: typeof Mail; className: string }
> = {
  email: {
    label: "Email",
    icon: Mail,
    className: "text-sky-700 bg-sky-50 border-sky-200",
  },
  submission: {
    label: "Submission",
    icon: Inbox,
    className: "text-green-700 bg-green-50 border-green-200",
  },
  spam: {
    label: "Spam",
    icon: ShieldAlert,
    className: "text-red-700 bg-red-50 border-red-200",
  },
  judging: {
    label: "Judging",
    icon: Scale,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  scoring: {
    label: "Scoring",
    icon: Star,
    className: "text-yellow-700 bg-yellow-50 border-yellow-200",
  },
  moderation: {
    label: "Moderation",
    icon: Gavel,
    className: "text-orange-700 bg-orange-50 border-orange-200",
  },
  access: {
    label: "Access",
    icon: KeyRound,
    className: "text-gray-700 bg-gray-100 border-gray-200",
  },
  settings: {
    label: "Settings",
    icon: Settings2,
    className: "text-gray-700 bg-gray-100 border-gray-200",
  },
};

const CATEGORY_FILTERS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "All" },
  ...Object.entries(CATEGORY_META).map(([value, meta]) => ({
    value: value as CategoryFilter,
    label: meta.label,
  })),
];

// Escape a value for a CSV cell
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function ActivityLog() {
  const { can } = useAdminAccess();
  const canManage = can("activity.manage");
  const { showConfirm, DialogComponents } = useDialog();
  const convex = useConvex();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"activityLog">>>(
    new Set(),
  );
  const [expandedId, setExpandedId] = useState<Id<"activityLog"> | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const status = useQuery(api.activityLog.getStatus, {});
  const {
    results,
    status: pageStatus,
    loadMore,
  } = usePaginatedQuery(
    api.activityLog.listActivity,
    {
      category: categoryFilter === "all" ? undefined : categoryFilter,
      archived: viewMode === "archived",
      sortOrder,
    },
    { initialNumItems: 50 },
  );

  const setPaused = useMutation(api.activityLog.setPaused);
  const bulkArchive = useMutation(api.activityLog.bulkArchive);
  const bulkUnarchive = useMutation(api.activityLog.bulkUnarchive);
  const bulkDelete = useMutation(api.activityLog.bulkDelete);
  const clearLog = useMutation(api.activityLog.clearLog);

  // Reset selection when the view changes
  const changeView = (next: Partial<{ view: ViewMode; cat: CategoryFilter }>) => {
    if (next.view) setViewMode(next.view);
    if (next.cat) setCategoryFilter(next.cat);
    setSelectedIds(new Set());
    setExpandedId(null);
  };

  const allSelected =
    results.length > 0 && results.every((row) => selectedIds.has(row._id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((row) => row._id)));
    }
  };

  const toggleSelect = (id: Id<"activityLog">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePauseToggle = async () => {
    if (!status) return;
    try {
      await setPaused({ paused: !status.paused });
      toast.success(
        status.paused ? "Activity logging resumed" : "Activity logging paused",
      );
    } catch {
      toast.error("Could not update the pause setting");
    }
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    try {
      if (viewMode === "active") {
        await bulkArchive({ ids });
        toast.success(`Archived ${ids.length} entries`);
      } else {
        await bulkUnarchive({ ids });
        toast.success(`Restored ${ids.length} entries`);
      }
      setSelectedIds(new Set());
    } catch {
      toast.error("Bulk action failed");
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    showConfirm(
      "Delete entries",
      `Permanently delete ${ids.length} activity entries? This cannot be undone.`,
      () => {
        void (async () => {
          try {
            await bulkDelete({ ids });
            toast.success(`Deleted ${ids.length} entries`);
            setSelectedIds(new Set());
          } catch {
            toast.error("Delete failed");
          }
        })();
      },
      { confirmButtonText: "Delete", confirmButtonVariant: "destructive" },
    );
  };

  const handleClear = () => {
    const label = viewMode === "active" ? "active log" : "archived log";
    showConfirm(
      "Clear activity log",
      `Permanently delete every entry in the ${label}? This cannot be undone.`,
      () => {
        void (async () => {
          setIsClearing(true);
          try {
            let done = false;
            let total = 0;
            while (!done) {
              const result = await clearLog({
                archived: viewMode === "archived",
              });
              total += result.deleted;
              done = result.done;
            }
            toast.success(`Cleared ${total} entries`);
            setSelectedIds(new Set());
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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const rows = await convex.query(api.activityLog.exportActivity, {
        category: categoryFilter === "all" ? undefined : categoryFilter,
        archived: viewMode === "archived",
      });
      const header = [
        "Time (UTC)",
        "Category",
        "Action",
        "Message",
        "Actor",
        "Target",
      ].join(",");
      const lines = rows.map((row) =>
        [
          csvCell(new Date(row._creationTime).toISOString()),
          csvCell(row.category),
          csvCell(row.action),
          csvCell(row.message),
          csvCell(row.actorName ?? "System"),
          csvCell(row.targetLabel ?? row.targetId ?? ""),
        ].join(","),
      );
      const blob = new Blob([[header, ...lines].join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vibeapps-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} entries`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-[#292929]">Activity Log</h2>
          {status?.paused && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <Pause className="w-3 h-3" />
              Paused
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handlePauseToggle()}
              disabled={status === undefined}
            >
              {status?.paused ? (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Resume
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            Export CSV
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
              Clear log
            </Button>
          )}
        </div>
      </div>

      {status?.paused && (
        <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Logging is paused. New activity is not being recorded until you
          resume.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => changeView({ cat: filter.value })}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                categoryFilter === filter.value
                  ? "bg-[#292929] text-white border-[#292929]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Select
            value={viewMode}
            onValueChange={(value) => changeView({ view: value as ViewMode })}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as SortOrder)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk action bar */}
      {canManage && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          <span className="text-[13px] text-gray-600">
            {selectedIds.size} selected
          </span>
          <Button variant="outline" size="sm" onClick={() => void handleBulkArchive()}>
            {viewMode === "active" ? (
              <>
                <Archive className="w-3.5 h-3.5 mr-1.5" /> Archive
              </>
            ) : (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" /> Restore
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Entries */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500">
          {canManage && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label="Select all loaded entries"
              className="rounded border-gray-300"
            />
          )}
          <span className="w-24 shrink-0">Category</span>
          <span className="flex-1">Activity</span>
          <span className="w-28 shrink-0 hidden sm:block">Actor</span>
          <span className="w-24 shrink-0 text-right">When</span>
        </div>

        {pageStatus === "LoadingFirstPage" ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading activity...
          </div>
        ) : results.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            {viewMode === "archived"
              ? "No archived entries."
              : "No activity yet. Emails, submissions, spam actions, judging, scoring, access grants, and settings changes will show up here."}
          </div>
        ) : (
          results.map((row) => {
            const meta = CATEGORY_META[row.category as Category];
            const Icon = meta.icon;
            const isExpanded = expandedId === row._id;
            return (
              <div key={row._id} className="border-b border-gray-100 last:border-b-0">
                <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row._id)}
                      onChange={() => toggleSelect(row._id)}
                      aria-label="Select entry"
                      className="rounded border-gray-300"
                    />
                  )}
                  <span
                    className={`w-24 shrink-0 inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${meta.className}`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    {meta.label}
                  </span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row._id)}
                    className="flex-1 text-left text-[13px] text-[#292929] truncate"
                    title={row.message}
                  >
                    {row.message}
                  </button>
                  <span className="w-28 shrink-0 hidden sm:block text-xs text-gray-500 truncate">
                    {row.actorName ?? "System"}
                  </span>
                  <span
                    className="w-24 shrink-0 text-right text-xs text-gray-400"
                    title={new Date(row._creationTime).toLocaleString()}
                  >
                    {formatDistanceToNow(row._creationTime, {
                      addSuffix: true,
                    })}
                  </span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row._id)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 pl-10 text-xs text-gray-600 space-y-1">
                    <div>
                      <span className="font-medium text-gray-500">Action:</span>{" "}
                      {row.action}
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Time:</span>{" "}
                      {new Date(row._creationTime).toLocaleString()}
                    </div>
                    {row.targetLabel && (
                      <div>
                        <span className="font-medium text-gray-500">
                          Target:
                        </span>{" "}
                        {row.targetLabel}
                        {row.targetType ? ` (${row.targetType})` : ""}
                      </div>
                    )}
                    {row.metadata !== undefined && row.metadata !== null && (
                      <pre className="bg-gray-50 border border-gray-200 rounded-md p-2 overflow-x-auto text-[11px]">
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {pageStatus === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => loadMore(50)}>
            Load more
          </Button>
        </div>
      )}
      {pageStatus === "LoadingMore" && (
        <div className="flex justify-center py-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}

      <DialogComponents />
    </div>
  );
}
