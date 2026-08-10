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

type VerdictFilter = "all" | "spam" | "suspicious" | "clean" | "failed" | "marked";
type SortBy = "newest" | "oldest" | "confidence";

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
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
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

export function SpamCheck() {
  const { can } = useAdminAccess();
  const { showConfirm, DialogComponents } = useDialog();

  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"stories">>>(new Set());
  const [expandedId, setExpandedId] = useState<Id<"spamCheckResults"> | null>(
    null,
  );
  const [bulkReason, setBulkReason] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  // AI prompt editor: draft is null while closed, a string while editing
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Convert date input strings to ms timestamps (end date is end of day)
  const startMs = startDate ? new Date(startDate).getTime() : undefined;
  let endMs: number | undefined;
  if (endDate) {
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);
    endMs = endDateTime.getTime();
  }

  const data = useQuery(api.spamCheck.listSpamResults, {
    verdictFilter,
    sortBy,
    startDate: startMs,
    endDate: endMs,
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
          <h2 className="text-lg font-medium text-[#292929]">AI Spam Check</h2>
          <p className="text-sm text-[#545454] mt-1">
            New submissions are scanned automatically. Scans check the live
            URL, scrape page content with Firecrawl, verify the GitHub repo,
            and ask the AI for a verdict.
          </p>
        </div>
        {canModerate && (
          <div className="flex gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchScan(false)}
              disabled={isScanning}
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${isScanning ? "animate-spin" : ""}`}
              />
              Scan recent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchScan(true)}
              disabled={isScanning}
            >
              Re-scan all recent
            </Button>
          </div>
        )}
      </div>

      {/* AI system prompt editor */}
      {promptDraft !== null && promptData && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-[#292929]">
                AI spam review prompt
              </h3>
              <p className="text-xs text-[#545454] mt-0.5">
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
            className="w-full text-xs font-mono text-[#292929] border border-gray-200 rounded-md p-3 bg-[#FAFAF9] focus:outline-none focus:ring-1 focus:ring-[#292929] resize-y"
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

      {counts && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-100 border border-gray-200 rounded-full text-gray-600">
            {counts.total} scanned
          </span>
          <span className="px-2 py-1 bg-red-50 border border-red-200 rounded-full text-red-700">
            {counts.spam} spam
          </span>
          <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-700">
            {counts.suspicious} suspicious
          </span>
          <span className="px-2 py-1 bg-green-50 border border-green-200 rounded-full text-green-700">
            {counts.clean} clean
          </span>
          <span className="px-2 py-1 bg-gray-100 border border-gray-200 rounded-full text-gray-600">
            {counts.marked} marked
          </span>
          {counts.pending + counts.running > 0 && (
            <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700">
              {counts.pending + counts.running} in progress
            </span>
          )}
          {counts.failed > 0 && (
            <span className="px-2 py-1 bg-red-50 border border-red-200 rounded-full text-red-700">
              {counts.failed} failed
            </span>
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
        {/* Date range filter (by submission date), also scopes batch scans */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 w-[150px] text-sm"
            aria-label="Start date"
          />
          <span className="text-sm text-[#545454]">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 w-[150px] text-sm"
            aria-label="End date"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="text-xs text-[#545454] hover:text-[#292929] underline"
            >
              Clear dates
            </button>
          )}
        </div>
        {results.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-[#545454] ml-1 cursor-pointer">
            <input
              type="checkbox"
              checked={
                selectedIds.size === results.length && results.length > 0
              }
              onChange={toggleSelectAll}
              className="rounded border-gray-300"
            />
            Select all ({results.length})
          </label>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && canModerate && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-[#F4F2EE] border border-gray-200 rounded-lg">
          <span className="text-sm font-medium text-[#292929]">
            {selectedIds.size} selected
          </span>
          <Input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="Optional reason sent to submitters (default: AI reasons)"
            className="h-8 text-sm flex-1 min-w-[220px] max-w-md bg-white"
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
        <div className="text-sm text-[#545454] py-8 text-center">
          Loading scan results...
        </div>
      ) : results.length === 0 ? (
        <div className="text-sm text-[#545454] py-8 text-center border border-dashed border-gray-200 rounded-lg">
          No scan results yet. New submissions are scanned automatically, or
          run "Scan recent" to check existing ones.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((result) => {
            const isExpanded = expandedId === result._id;
            return (
              <div
                key={result._id}
                className={`border rounded-lg bg-white ${
                  result.isSpam
                    ? "border-red-200"
                    : result.verdict === "spam"
                      ? "border-red-100"
                      : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(result.storyId)}
                    onChange={() => toggleSelect(result.storyId)}
                    className="mt-1 rounded border-gray-300"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/s/${result.storySlug}`}
                        className="text-sm font-medium text-[#292929] hover:underline truncate"
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
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                          Hidden
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {result.triggeredBy === "auto" ? "auto scan" : "manual scan"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[#545454]">
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
                      <div className="mt-1 text-xs text-[#545454]">
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
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2 text-xs text-[#545454] bg-gray-50 rounded-b-lg">
                    {result.llmReasoning && (
                      <div>
                        <span className="font-medium text-[#292929]">
                          AI reasoning:
                        </span>{" "}
                        {result.llmReasoning}
                      </div>
                    )}
                    {result.spamReason && (
                      <div>
                        <span className="font-medium text-[#292929]">
                          Reason sent to submitter:
                        </span>{" "}
                        {result.spamReason}
                      </div>
                    )}
                    {result.signals && (
                      <div className="space-y-1">
                        <div>
                          <span className="font-medium text-[#292929]">
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
                            <span className="font-medium text-[#292929]">
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
                            <span className="font-medium text-[#292929]">
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
                    <div className="text-gray-400">
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
