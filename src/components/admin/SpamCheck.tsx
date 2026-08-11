import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  RefreshCw,
  EyeOff,
  Trash2,
  Undo2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Github,
  PenLine,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DateRangePicker,
  type DateRange,
} from "@/components/ui/date-range-picker";

type VerdictFilter = "all" | "spam" | "suspicious" | "clean" | "failed" | "marked";
type SortBy = "newest" | "oldest" | "confidence";

// localStorage keys so picked date ranges survive tab switches and reloads
const SCAN_RANGE_KEY = "adminSpamScanRange";
const FILTER_RANGE_KEY = "adminSpamFilterRange";

// Read a saved range ({from, to} ms timestamps) back into a DateRange
function loadSavedRange(key: string): DateRange | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { from?: number; to?: number };
    if (typeof parsed.from !== "number") return undefined;
    return {
      from: new Date(parsed.from),
      to: typeof parsed.to === "number" ? new Date(parsed.to) : undefined,
    };
  } catch {
    return undefined;
  }
}

// Persist a range, or clear the saved value when the range is unset
function persistRange(key: string, range: DateRange | undefined) {
  if (!range?.from) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(
    key,
    JSON.stringify({ from: range.from.getTime(), to: range.to?.getTime() }),
  );
}

// Badge for the AI verdict on a scan row
function VerdictBadge({
  status,
  verdict,
  confidence,
}: {
  status: "pending" | "running" | "completed" | "failed";
  verdict?: "spam" | "suspicious" | "clean";
  confidence?: number;
}) {
  if (status === "pending" || status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-soft bg-surface-alt border border-hairline rounded-full px-2 py-0.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        {status === "pending" ? "Queued" : "Scanning"}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        Failed
      </span>
    );
  }
  if (verdict === "spam") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <ShieldAlert className="w-3 h-3" />
        Spam {confidence !== undefined ? `${confidence}%` : ""}
      </span>
    );
  }
  if (verdict === "suspicious") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <ShieldQuestion className="w-3 h-3" />
        Suspicious {confidence !== undefined ? `${confidence}%` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <ShieldCheck className="w-3 h-3" />
      Clean {confidence !== undefined ? `${confidence}%` : ""}
    </span>
  );
}

// Clickable count pill: click applies its verdict filter, click again clears
// back to "all". colorClass carries the verdict's bg/border/text styling.
function CountPill({
  label,
  count,
  filter,
  activeFilter,
  onSelect,
  colorClass,
}: {
  label: string;
  count: number;
  filter: VerdictFilter;
  activeFilter: VerdictFilter;
  onSelect: (filter: VerdictFilter) => void;
  colorClass: string;
}) {
  const isActive = activeFilter === filter;
  // "scanned" maps to the "all" filter: it resets instead of toggling
  const isAllPill = filter === "all";
  return (
    <button
      type="button"
      aria-pressed={isActive}
      title={
        isAllPill
          ? "Show all results"
          : isActive
            ? "Clear this filter"
            : `Show only ${label} results`
      }
      onClick={() => onSelect(isActive && !isAllPill ? "all" : filter)}
      className={`px-2 py-1 border rounded-full transition-shadow cursor-pointer hover:shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ink ${colorClass} ${
        isActive ? "ring-1 ring-current shadow-sm font-medium" : ""
      }`}
    >
      {count} {label}
    </button>
  );
}

export function SpamCheck() {
  const { can } = useAdminAccess();
  const { showConfirm, DialogComponents } = useDialog();

  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  // Two independent ranges: one picks what to scan, one filters the results
  // view. Both are saved to localStorage so they persist across visits.
  const [scanRange, setScanRangeState] = useState<DateRange | undefined>(() =>
    loadSavedRange(SCAN_RANGE_KEY),
  );
  const [filterRange, setFilterRangeState] = useState<DateRange | undefined>(
    () => loadSavedRange(FILTER_RANGE_KEY),
  );

  const setScanRange = (range: DateRange | undefined) => {
    persistRange(SCAN_RANGE_KEY, range);
    setScanRangeState(range);
  };

  const setFilterRange = (range: DateRange | undefined) => {
    persistRange(FILTER_RANGE_KEY, range);
    setFilterRangeState(range);
  };
  const [selectedIds, setSelectedIds] = useState<Set<Id<"stories">>>(new Set());
  const [expandedId, setExpandedId] = useState<Id<"spamCheckResults"> | null>(
    null,
  );
  const [bulkReason, setBulkReason] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  // AI prompt editor: draft is null while closed, a string while editing
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Convert a picked range to ms timestamps (start of first day to end of last day)
  const rangeToMs = (
    range: DateRange | undefined,
  ): { startMs?: number; endMs?: number } => {
    if (!range?.from) return {};
    const startMs = new Date(range.from).setHours(0, 0, 0, 0);
    const endMs = new Date(range.to ?? range.from).setHours(23, 59, 59, 999);
    return { startMs, endMs };
  };

  const { startMs: filterStartMs, endMs: filterEndMs } = rangeToMs(filterRange);

  const data = useQuery(api.spamCheck.listSpamResults, {
    verdictFilter,
    sortBy,
    startDate: filterStartMs,
    endDate: filterEndMs,
  });

  const promptData = useQuery(api.spamCheck.getSpamPrompt, {});

  const startBatchScan = useMutation(api.spamCheck.startBatchScan);
  const setSpamPrompt = useMutation(api.spamCheck.setSpamPrompt);
  const scanStory = useMutation(api.spamCheck.scanStory);
  const markAsSpam = useMutation(api.spamCheck.markAsSpam);
  const unmarkSpam = useMutation(api.spamCheck.unmarkSpam);
  const bulkMarkAsSpam = useMutation(api.spamCheck.bulkMarkAsSpam);
  const bulkHide = useMutation(api.spamCheck.bulkHide);
  const bulkDelete = useMutation(api.spamCheck.bulkDelete);

  const canModerate = can("moderation.moderate");
  const canDelete = can("moderation.delete");

  const results = data?.results ?? [];
  const counts = data?.counts;

  const toggleSelect = (storyId: Id<"stories">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r) => r.storyId)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBatchScan = (rescan: boolean) => {
    const { startMs, endMs } = rangeToMs(scanRange);
    const hasRange = startMs !== undefined || endMs !== undefined;
    const scope = hasRange
      ? "up to 100 submissions in the selected date range"
      : "the 100 most recent submissions";
    showConfirm(
      rescan ? "Re-scan submissions?" : "Scan submissions?",
      rescan
        ? `This re-runs the AI spam scan on ${scope}, including ones already scanned.`
        : `This runs the AI spam scan on ${scope} that have not been scanned yet.`,
      () => {
        setIsScanning(true);
        startBatchScan({ rescan, limit: 100, startDate: startMs, endDate: endMs })
          .then(({ queued, skipped }) => {
            toast.success(
              `Queued ${queued} scan${queued === 1 ? "" : "s"} (${skipped} skipped)`,
            );
          })
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to start scan",
            );
          })
          .finally(() => setIsScanning(false));
      },
      { confirmButtonText: rescan ? "Re-scan" : "Scan" },
    );
  };

  const handleMarkSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    showConfirm(
      `Mark ${ids.length} submission${ids.length === 1 ? "" : "s"} as spam?`,
      "Each submission will be hidden, labeled as spam, and the submitter will get an in-app alert plus an email with the reason. " +
        (bulkReason.trim()
          ? `Reason sent: "${bulkReason.trim()}"`
          : "The AI scan's reasons will be sent as the explanation."),
      () => {
        bulkMarkAsSpam({
          storyIds: ids,
          reason: bulkReason.trim() || undefined,
        })
          .then(({ marked }) => {
            toast.success(`Marked ${marked} as spam and notified submitters`);
            clearSelection();
            setBulkReason("");
          })
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to mark as spam",
            );
          });
      },
      { confirmButtonText: "Mark as spam", confirmButtonVariant: "destructive" },
    );
  };

  const handleHideSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    showConfirm(
      `Hide ${ids.length} submission${ids.length === 1 ? "" : "s"}?`,
      "Hidden submissions stay in the database but are not visible on the site. No notification is sent.",
      () => {
        bulkHide({ storyIds: ids })
          .then(({ hidden }) => {
            toast.success(`Hid ${hidden} submission${hidden === 1 ? "" : "s"}`);
            clearSelection();
          })
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to hide",
            );
          });
      },
      { confirmButtonText: "Hide" },
    );
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    showConfirm(
      `Permanently delete ${ids.length} submission${ids.length === 1 ? "" : "s"}?`,
      "This permanently deletes the submissions along with their comments, votes, ratings, bookmarks, and images. This cannot be undone.",
      () => {
        bulkDelete({ storyIds: ids })
          .then(({ deleted }) => {
            toast.success(`Deleted ${deleted} submission${deleted === 1 ? "" : "s"}`);
            clearSelection();
          })
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to delete",
            );
          });
      },
      { confirmButtonText: "Delete forever", confirmButtonVariant: "destructive" },
    );
  };

  const handleMarkOne = (storyId: Id<"stories">, title: string) => {
    showConfirm(
      "Mark as spam?",
      `"${title}" will be hidden, labeled as spam, and the submitter will be notified with the reason.`,
      () => {
        markAsSpam({ storyId })
          .then(() => toast.success("Marked as spam and notified the submitter"))
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to mark as spam",
            );
          });
      },
      { confirmButtonText: "Mark as spam", confirmButtonVariant: "destructive" },
    );
  };

  const handleUnmarkOne = (storyId: Id<"stories">, title: string) => {
    showConfirm(
      "Unmark spam?",
      `"${title}" will lose its spam label and become visible again.`,
      () => {
        unmarkSpam({ storyId })
          .then(() => toast.success("Spam label removed; submission is visible"))
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to unmark",
            );
          });
      },
      { confirmButtonText: "Unmark" },
    );
  };

  // AI prompt editor handlers (open seeds the draft; no effect needed)
  const handleTogglePromptEditor = () => {
    if (promptDraft !== null) {
      setPromptDraft(null);
    } else if (promptData) {
      setPromptDraft(promptData.prompt);
    }
  };

  const handleSavePrompt = () => {
    if (promptDraft === null) return;
    setIsSavingPrompt(true);
    setSpamPrompt({ prompt: promptDraft })
      .then(({ isCustom }) => {
        toast.success(
          isCustom
            ? "Custom prompt saved. Future scans will use it."
            : "Prompt matches the default, so the default stays active.",
        );
        setPromptDraft(null);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to save prompt",
        );
      })
      .finally(() => setIsSavingPrompt(false));
  };

  const handleResetPrompt = () => {
    showConfirm(
      "Reset AI prompt to default?",
      "This removes your custom prompt. Future scans will use the built-in default prompt.",
      () => {
        setIsSavingPrompt(true);
        setSpamPrompt({ prompt: "" })
          .then(() => {
            toast.success("Prompt reset to default");
            setPromptDraft(promptData ? promptData.defaultPrompt : null);
          })
          .catch((error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to reset prompt",
            );
          })
          .finally(() => setIsSavingPrompt(false));
      },
      { confirmButtonText: "Reset" },
    );
  };

  const handleRescanOne = (storyId: Id<"stories">) => {
    scanStory({ storyId })
      .then(() => toast.success("Re-scan queued"))
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to queue re-scan",
        );
      });
  };

  return (
    <div className="space-y-4">
      {/* Header and counts */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-ink">AI Spam Check</h2>
          <p className="text-sm text-soft mt-1">
            New submissions are scanned automatically. Scans check the live
            URL, scrape page content with Firecrawl, verify the GitHub repo,
            and ask the AI for a verdict.
          </p>
        </div>
        {canModerate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePromptEditor}
            disabled={promptData === undefined}
          >
            <PenLine className="w-4 h-4 mr-1" />
            AI prompt
            {promptData?.isCustom && (
              <span className="ml-1.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-px">
                custom
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Step 1: run a scan (pick an optional date range, then scan) */}
      {canModerate && (
        <div className="border border-hairline rounded-lg bg-surface p-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-ink">Run a scan</h3>
            <p className="text-xs text-soft mt-0.5">
              New submissions are scanned on their own. Use this to scan older
              submissions: pick a date range (or a month preset), or leave it
              empty to scan the 100 most recent.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              value={scanRange}
              onChange={setScanRange}
              placeholder="All recent submissions"
            />
            <Button
              size="sm"
              onClick={() => handleBatchScan(false)}
              disabled={isScanning}
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${isScanning ? "animate-spin" : ""}`}
              />
              {scanRange?.from ? "Scan this range" : "Scan recent"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchScan(true)}
              disabled={isScanning}
              title="Also re-checks submissions that already have a verdict"
            >
              {scanRange?.from ? "Re-scan this range" : "Re-scan recent"}
            </Button>
          </div>
          <p className="text-xs text-faint">
            Scan checks submissions that have no verdict yet. Re-scan also
            re-checks ones already scanned. Up to 100 per run.
          </p>
        </div>
      )}

      {/* AI system prompt editor */}
      {promptDraft !== null && promptData && (
        <div className="border border-hairline rounded-lg p-4 bg-surface space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-ink">
                AI spam review prompt
              </h3>
              <p className="text-xs text-soft mt-0.5">
                This system prompt drives the spam / suspicious / clean
                verdict. Edits apply to future scans only.{" "}
                {promptData.isCustom
                  ? "A custom prompt is active."
                  : "The default prompt is active."}
              </p>
            </div>
          </div>
          <textarea
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full text-xs font-mono text-ink border border-hairline rounded-md p-3 bg-surface-alt focus:outline-none focus:ring-1 focus:ring-ink resize-y"
            aria-label="AI spam review system prompt"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleSavePrompt}
              disabled={isSavingPrompt || promptDraft.trim() === ""}
            >
              {isSavingPrompt ? "Saving..." : "Save prompt"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPrompt}
              disabled={isSavingPrompt || !promptData.isCustom}
            >
              Reset to default
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPromptDraft(null)}
              disabled={isSavingPrompt}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: scan results with view-only filters */}
      <div className="pt-1">
        <h3 className="text-sm font-medium text-ink">Scan results</h3>
        <p className="text-xs text-soft mt-0.5">
          Every submission that has been scanned shows up here. The filters
          below only change what you see; they do not start a scan.
        </p>
      </div>

      {/* Count pills double as quick filters: click to filter, click again to clear */}
      {counts && (
        <div className="flex flex-wrap gap-2 text-xs">
          <CountPill
            label="scanned"
            count={counts.total}
            filter="all"
            activeFilter={verdictFilter}
            onSelect={setVerdictFilter}
            colorClass="bg-surface-alt border-hairline text-copy"
          />
          <CountPill
            label="spam"
            count={counts.spam}
            filter="spam"
            activeFilter={verdictFilter}
            onSelect={setVerdictFilter}
            colorClass="bg-red-50 border-red-200 text-red-700"
          />
          <CountPill
            label="suspicious"
            count={counts.suspicious}
            filter="suspicious"
            activeFilter={verdictFilter}
            onSelect={setVerdictFilter}
            colorClass="bg-amber-50 border-amber-200 text-amber-700"
          />
          <CountPill
            label="clean"
            count={counts.clean}
            filter="clean"
            activeFilter={verdictFilter}
            onSelect={setVerdictFilter}
            colorClass="bg-green-50 border-green-200 text-green-700"
          />
          <CountPill
            label="marked"
            count={counts.marked}
            filter="marked"
            activeFilter={verdictFilter}
            onSelect={setVerdictFilter}
            colorClass="bg-surface-alt border-hairline text-copy"
          />
          {counts.pending + counts.running > 0 && (
            <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700">
              {counts.pending + counts.running} in progress
            </span>
          )}
          {counts.failed > 0 && (
            <CountPill
              label="failed"
              count={counts.failed}
              filter="failed"
              activeFilter={verdictFilter}
              onSelect={setVerdictFilter}
              colorClass="bg-red-50 border-red-200 text-red-700"
            />
          )}
        </div>
      )}

      {/* Filters and sort */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={verdictFilter}
          onValueChange={(value) => setVerdictFilter(value as VerdictFilter)}
        >
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="spam">Spam verdict</SelectItem>
            <SelectItem value="suspicious">Suspicious</SelectItem>
            <SelectItem value="clean">Clean</SelectItem>
            <SelectItem value="marked">Marked as spam</SelectItem>
            <SelectItem value="failed">Failed scans</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as SortBy)}
        >
          <SelectTrigger className="w-[170px] h-9 text-sm">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="confidence">Highest confidence</SelectItem>
          </SelectContent>
        </Select>
        {/* View-only filter by submission date; does not affect scans */}
        <DateRangePicker
          value={filterRange}
          onChange={setFilterRange}
          placeholder="Filter by submission date"
        />
        {results.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-soft ml-1 cursor-pointer">
            <input
              type="checkbox"
              checked={
                selectedIds.size === results.length && results.length > 0
              }
              onChange={toggleSelectAll}
              className="rounded border-hairline-strong"
            />
            Select all ({results.length})
          </label>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && canModerate && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-canvas border border-hairline rounded-lg">
          <span className="text-sm font-medium text-ink">
            {selectedIds.size} selected
          </span>
          <Input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="Optional reason sent to submitters (default: AI reasons)"
            className="h-8 text-sm flex-1 min-w-[220px] max-w-md bg-surface"
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={handleMarkSelected}
          >
            <ShieldAlert className="w-4 h-4 mr-1" />
            Mark as spam
          </Button>
          <Button variant="outline" size="sm" onClick={handleHideSelected}>
            <EyeOff className="w-4 h-4 mr-1" />
            Hide
          </Button>
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Results list */}
      {data === undefined ? (
        <div className="text-sm text-soft py-8 text-center">
          Loading scan results...
        </div>
      ) : results.length === 0 ? (
        <div className="text-sm text-soft py-8 text-center border border-dashed border-hairline rounded-lg">
          {filterRange?.from || verdictFilter !== "all"
            ? "No scan results match these filters. Clear the filters, or run a scan above to check submissions from this period."
            : 'No scan results yet. New submissions are scanned automatically, or use "Run a scan" above to check existing ones.'}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((result) => {
            const isExpanded = expandedId === result._id;
            return (
              <div
                key={result._id}
                className={`border rounded-lg bg-surface ${
                  result.isSpam
                    ? "border-red-200"
                    : result.verdict === "spam"
                      ? "border-red-100"
                      : "border-hairline"
                }`}
              >
                <div className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(result.storyId)}
                    onChange={() => toggleSelect(result.storyId)}
                    className="mt-1 rounded border-hairline-strong"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/s/${result.storySlug}`}
                        className="text-sm font-medium text-ink hover:underline truncate"
                      >
                        {result.storyTitle}
                      </Link>
                      <VerdictBadge
                        status={result.status}
                        verdict={result.verdict}
                        confidence={result.confidence}
                      />
                      {result.isSpam && (
                        <span className="text-xs font-medium text-white bg-red-600 rounded-full px-2 py-0.5">
                          Marked spam
                        </span>
                      )}
                      {result.isHidden && !result.isSpam && (
                        <span className="text-xs font-medium text-copy bg-surface-alt border border-hairline rounded-full px-2 py-0.5">
                          Hidden
                        </span>
                      )}
                      <span className="text-xs text-faint">
                        {result.triggeredBy === "auto" ? "auto scan" : "manual scan"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-soft">
                      <span>
                        by{" "}
                        {result.authorUsername ? (
                          <Link
                            to={`/${result.authorUsername}`}
                            className="hover:underline"
                          >
                            {result.submitterName || result.authorUsername}
                          </Link>
                        ) : (
                          (result.submitterName || "anonymous")
                        )}
                      </span>
                      <span>
                        submitted{" "}
                        {formatDistanceToNow(result.submittedAt, {
                          addSuffix: true,
                        })}
                      </span>
                      <a
                        href={result.storyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {result.signals
                          ? result.signals.urlLive
                            ? "URL live"
                            : `URL dead (${result.signals.urlNote})`
                          : "URL"}
                      </a>
                      {result.githubUrl && (
                        <a
                          href={result.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <Github className="w-3 h-3" />
                          {result.signals?.repoChecked
                            ? result.signals.repoAccessible
                              ? `repo ok (${result.signals.repoFileCount ?? "?"} files)`
                              : "repo inaccessible"
                            : "repo"}
                        </a>
                      )}
                      {result.signals &&
                        result.signals.duplicateUrlCount > 0 && (
                          <span className="text-amber-700">
                            {result.signals.duplicateUrlCount} duplicate URL
                            {result.signals.duplicateUrlCount === 1 ? "" : "s"}
                          </span>
                        )}
                    </div>
                    {result.reasons && result.reasons.length > 0 && (
                      <div className="mt-1 text-xs text-soft">
                        {result.reasons.join(" · ")}
                      </div>
                    )}
                    {result.status === "failed" && result.error && (
                      <div className="mt-1 text-xs text-red-600">
                        {result.error}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canModerate &&
                      (result.isSpam ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() =>
                            handleUnmarkOne(result.storyId, result.storyTitle)
                          }
                        >
                          <Undo2 className="w-3.5 h-3.5 mr-1" />
                          Unmark
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-600 hover:bg-red-50"
                          onClick={() =>
                            handleMarkOne(result.storyId, result.storyTitle)
                          }
                        >
                          <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                          Spam
                        </Button>
                      ))}
                    {canModerate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleRescanOne(result.storyId)}
                        disabled={
                          result.status === "pending" ||
                          result.status === "running"
                        }
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : result._id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-hairline px-4 py-3 space-y-2 text-xs text-soft bg-surface-alt rounded-b-lg">
                    {result.llmReasoning && (
                      <div>
                        <span className="font-medium text-ink">
                          AI reasoning:
                        </span>{" "}
                        {result.llmReasoning}
                      </div>
                    )}
                    {result.spamReason && (
                      <div>
                        <span className="font-medium text-ink">
                          Reason sent to submitter:
                        </span>{" "}
                        {result.spamReason}
                      </div>
                    )}
                    {result.signals && (
                      <div className="space-y-1">
                        <div>
                          <span className="font-medium text-ink">
                            URL:
                          </span>{" "}
                          {result.signals.urlLive ? "live" : "not reachable"} (
                          {result.signals.urlNote})
                          {result.signals.scrapedContent
                            ? " · page content scraped"
                            : " · no page content"}
                        </div>
                        {result.signals.repoChecked && (
                          <div>
                            <span className="font-medium text-ink">
                              Repo:
                            </span>{" "}
                            {result.signals.repoNote}
                            {result.signals.repoIsEmpty
                              ? " (effectively empty)"
                              : ""}
                          </div>
                        )}
                        {result.signals.linksChecked.length > 0 && (
                          <div>
                            <span className="font-medium text-ink">
                              Other links:
                            </span>{" "}
                            {result.signals.linksChecked
                              .map(
                                (l) => `${l.label}: ${l.ok ? "ok" : l.note}`,
                              )
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-faint">
                      {result.provider && result.model
                        ? `Verdict by ${result.provider} (${result.model})`
                        : ""}
                      {result.checkedAt
                        ? ` · scanned ${formatDistanceToNow(result.checkedAt, { addSuffix: true })}`
                        : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DialogComponents />
    </div>
  );
}
