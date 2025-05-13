import React, { useState, useMemo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  EyeOff,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";
import type { ReportWithDetails } from "../../../convex/reports"; // Import the type
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type ReportStatusFilter = "all" | "pending" | "resolved_hidden" | "resolved_deleted" | "dismissed";

export function ReportManagement() {
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("pending");
  const [sortField, setSortField] = useState<string>("_creationTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [confirmingAction, setConfirmingAction] = useState<{
    reportId: Id<"reports">;
    action: "hide" | "delete" | "dismiss" | "show_story";
    storyId?: Id<"stories">;
    currentStoryIsHidden?: boolean;
  } | null>(null);

  const reportsData = useQuery(
    api.reports.listAllReportsAdmin,
    statusFilter === "all" ? {} : { filters: { status: statusFilter } }
  );
  const updateReportStatus = useMutation(api.reports.updateReportStatusByAdmin);
  const showStoryMutation = useMutation(api.stories.showStory);

  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(fieldKey);
      setSortDirection("desc");
    }
  };

  const sortedReports = useMemo(() => {
    if (!reportsData) return [];
    return [...reportsData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === "_creationTime") {
        aValue = a._creationTime;
        bValue = b._creationTime;
      } else if (sortField === "reporter") {
        aValue = a.reporter?.name?.toLowerCase() || "";
        bValue = b.reporter?.name?.toLowerCase() || "";
      } else if (sortField === "story") {
        aValue = a.story?.title?.toLowerCase() || "";
        bValue = b.story?.title?.toLowerCase() || "";
      } else if (sortField === "status") {
        aValue = a.status.toLowerCase();
        bValue = b.status.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [reportsData, sortField, sortDirection]);

  const handleAction = async (
    reportId: Id<"reports">,
    actionTypeFromButtonClick:
      | "resolved_hidden"
      | "resolved_deleted"
      | "dismissed"
      | "show_story_action",
    storyId?: Id<"stories">,
    permanentlyDeleteStory?: boolean,
    currentStoryIsHidden?: boolean
  ) => {
    if (confirmingAction && confirmingAction.reportId === reportId) {
      try {
        if (confirmingAction.action === "show_story" && storyId) {
          await showStoryMutation({ storyId });
          await updateReportStatus({ reportId, newStatus: "pending" });
          toast.success(`Story "${reportId}" is now visible. Report reset to pending.`);
        } else if (confirmingAction.action === "hide" && storyId) {
          await updateReportStatus({ reportId, newStatus: "resolved_hidden" });
          toast.success("Story hidden and report updated.");
        } else if (confirmingAction.action === "delete" && storyId) {
          await updateReportStatus({
            reportId,
            newStatus: "resolved_deleted",
            permanentlyDeleteStory: permanentlyDeleteStory,
          });
          toast.success(
            `Story ${permanentlyDeleteStory ? "permanently deleted" : "marked for deletion"}. Report updated.`
          );
        } else if (confirmingAction.action === "dismiss") {
          await updateReportStatus({ reportId, newStatus: "dismissed" });
          toast.success("Report dismissed.");
        }
        setConfirmingAction(null);
      } catch (error: any) {
        console.error("Failed to update report/story status:", error);
        toast.error(`Failed: ${error.data?.message || error.message}`);
        setConfirmingAction(null);
      }
    } else {
      let modalActionType: "hide" | "delete" | "dismiss" | "show_story" = "dismiss";
      if (actionTypeFromButtonClick === "resolved_hidden") modalActionType = "hide";
      else if (actionTypeFromButtonClick === "resolved_deleted") modalActionType = "delete";
      else if (actionTypeFromButtonClick === "show_story_action") modalActionType = "show_story";

      setConfirmingAction({
        reportId,
        action: modalActionType,
        storyId,
        currentStoryIsHidden,
      });
    }
  };

  const isLoading = reportsData === undefined;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-medium text-[#525252] mb-6">Report Management</h2>

        <div className="flex items-center gap-4 mb-6">
          <Select
            value={statusFilter}
            onValueChange={(v: string) => setStatusFilter(v as ReportStatusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved_hidden">Resolved (Hidden)</SelectItem>
              <SelectItem value="resolved_deleted">Resolved (Deleted)</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="text-center py-6 text-lg font-medium text-[#787672]">
            Loading reports...
          </div>
        )}
        {!isLoading && sortedReports.length === 0 && (
          <div className="text-center py-10 text-[#787672]">
            No reports found matching the criteria.
          </div>
        )}

        {!isLoading && sortedReports.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {[
                    { label: "Reported At", key: "_creationTime" },
                    { label: "Story Title", key: "story" },
                    { label: "Reporter", key: "reporter" },
                    { label: "Reason", key: null },
                    { label: "Status", key: "status" },
                    { label: "Actions", key: null },
                  ].map((col) => (
                    <th
                      key={col.key || col.label}
                      className="text-left p-3 px-4 text-gray-600 font-medium whitespace-nowrap hover:bg-gray-100"
                      onClick={() => col.key && handleSort(col.key)}>
                      <div className="flex items-center gap-1 cursor-pointer">
                        {col.label}
                        {col.key &&
                          sortField === col.key &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((report: ReportWithDetails) => {
                  const storyIsHidden =
                    report.story?.isHidden === true || report.status === "resolved_hidden";
                  const storyIsDeleted = report.status === "resolved_deleted";
                  const storyExists = !!report.story;

                  return (
                    <tr
                      key={report._id}
                      className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                      <td className="p-3 px-4 text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(report._creationTime, { addSuffix: true })}
                      </td>
                      <td className="p-3 px-4">
                        {report.story ? (
                          <Link
                            to={`/s/${report.story.slug}`}
                            target="_blank"
                            className={`text-blue-600 hover:underline ${storyIsHidden || storyIsDeleted ? "line-through text-gray-400" : ""}`}>
                            {report.story.title}
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic">Story (may be deleted)</span>
                        )}
                      </td>
                      <td className="p-3 px-4 text-gray-500">
                        {report.reporter ? (
                          <Link
                            to={`/u/${report.reporter.username}`}
                            target="_blank"
                            className="hover:underline">
                            {report.reporter.name || report.reporter.username}
                          </Link>
                        ) : (
                          <span className="italic text-gray-400">Unknown reporter</span>
                        )}
                      </td>
                      <td
                        className="p-3 px-4 text-gray-600 max-w-xs truncate"
                        title={report.reason}>
                        {report.reason}
                      </td>
                      <td className="p-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${report.status === "pending" ? "bg-yellow-100 text-yellow-800" : report.status.startsWith("resolved") ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="p-3 px-4">
                        <div className="flex gap-2 items-center flex-wrap">
                          {storyExists && !storyIsHidden && report.status !== "resolved_hidden" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 border-orange-300 hover:bg-orange-50"
                              onClick={() =>
                                handleAction(
                                  report._id,
                                  "resolved_hidden",
                                  report.storyId,
                                  undefined,
                                  storyIsHidden
                                )
                              }>
                              <EyeOff className="w-3 h-3 mr-1" /> Hide Story
                            </Button>
                          )}
                          {storyExists && storyIsHidden && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              onClick={() =>
                                handleAction(
                                  report._id,
                                  "show_story_action",
                                  report.storyId,
                                  undefined,
                                  storyIsHidden
                                )
                              }>
                              <Eye className="w-3 h-3 mr-1" /> Show Story
                            </Button>
                          )}
                          {storyExists && report.status !== "resolved_deleted" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() =>
                                handleAction(
                                  report._id,
                                  "resolved_deleted",
                                  report.storyId,
                                  false,
                                  storyIsHidden
                                )
                              }>
                              <Trash2 className="w-3 h-3 mr-1" /> Delete Story
                            </Button>
                          )}
                          {report.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300 hover:bg-gray-100"
                              onClick={() => handleAction(report._id, "dismissed")}>
                              <XCircle className="w-3 h-3 mr-1" /> Dismiss Report
                            </Button>
                          )}
                          {storyIsDeleted && !storyExists && (
                            <span className="text-xs text-gray-500 italic">
                              Story permanently deleted.
                            </span>
                          )}
                        </div>
                        {confirmingAction && confirmingAction.reportId === report._id && (
                          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md space-y-2">
                            <p className="text-sm text-yellow-700 font-medium flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-2 text-yellow-600" />
                              Confirm Action:{" "}
                              {confirmingAction.action.toUpperCase().replace("_", " ")} for story "
                              {report.story?.title || "N/A"}"
                            </p>
                            {confirmingAction.action === "delete" && storyExists && (
                              <p className="text-xs text-yellow-600">
                                Soft delete marks the story as hidden and rejected. Permanent delete
                                removes the story and its data.
                              </p>
                            )}
                            {confirmingAction.action === "show_story" && (
                              <p className="text-xs text-yellow-600">
                                This will make the story visible again and reset the report to
                                pending for review.
                              </p>
                            )}
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmingAction(null)}>
                                Cancel
                              </Button>
                              {confirmingAction.action === "delete" && storyExists && (
                                <Button
                                  variant="destructive_outline"
                                  size="sm"
                                  onClick={() =>
                                    handleAction(
                                      report._id,
                                      "resolved_deleted",
                                      report.storyId,
                                      false,
                                      confirmingAction.currentStoryIsHidden
                                    )
                                  }>
                                  Mark Deleted (Soft)
                                </Button>
                              )}
                              <Button
                                variant={
                                  confirmingAction.action === "delete" ||
                                  confirmingAction.action === "hide"
                                    ? "destructive"
                                    : "default"
                                }
                                size="sm"
                                onClick={() =>
                                  handleAction(
                                    report._id,
                                    confirmingAction.action === "hide"
                                      ? "resolved_hidden"
                                      : confirmingAction.action === "delete"
                                        ? "resolved_deleted"
                                        : confirmingAction.action === "show_story"
                                          ? "show_story_action"
                                          : "dismissed",
                                    report.storyId,
                                    confirmingAction.action === "delete" ? true : undefined,
                                    confirmingAction.currentStoryIsHidden
                                  )
                                }>
                                {confirmingAction.action === "delete" && storyExists
                                  ? "Delete Permanently"
                                  : confirmingAction.action === "show_story"
                                    ? "Confirm Show Story"
                                    : `Confirm ${confirmingAction.action.replace("_", " ")}`}
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
