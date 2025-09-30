import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, XCircle, Shield } from "lucide-react";
import { Link } from "react-router-dom";

type UserReportStatus =
  | "pending"
  | "resolved_warned"
  | "resolved_banned"
  | "resolved_paused"
  | "dismissed";

export function UserReportManagement() {
  const [statusFilter, setStatusFilter] = useState<UserReportStatus | "all">(
    "pending",
  );

  const allUserReports = useQuery(api.reports.listAllUserReportsAdmin, {});

  const updateUserReportStatusMutation = useMutation(
    api.reports.updateUserReportStatusByAdmin,
  );

  const filteredReports = useMemo(() => {
    if (!allUserReports) return [];
    if (statusFilter === "all") return allUserReports;
    return allUserReports.filter((report) => report.status === statusFilter);
  }, [allUserReports, statusFilter]);

  const handleStatusChange = async (
    reportId: Id<"userReports">,
    newStatus: UserReportStatus,
  ) => {
    try {
      await updateUserReportStatusMutation({
        reportId,
        newStatus,
      });
    } catch (error) {
      console.error("Failed to update user report status:", error);
      alert("Failed to update user report status. Please try again.");
    }
  };

  const getStatusBadge = (status: UserReportStatus) => {
    const baseClasses = "px-2 py-1 rounded-md text-xs font-medium";
    switch (status) {
      case "pending":
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
            Pending
          </span>
        );
      case "resolved_warned":
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-800`}>
            Resolved (Warned)
          </span>
        );
      case "resolved_banned":
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800`}>
            Resolved (Banned)
          </span>
        );
      case "resolved_paused":
        return (
          <span className={`${baseClasses} bg-orange-100 text-orange-800`}>
            Resolved (Paused)
          </span>
        );
      case "dismissed":
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
            Dismissed
          </span>
        );
    }
  };

  const getPendingCount = () => {
    if (!allUserReports) return 0;
    return allUserReports.filter((r) => r.status === "pending").length;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium text-[#525252]">
            User Report Management
          </h2>
          {getPendingCount() > 0 && (
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              {getPendingCount()} Pending
            </span>
          )}
        </div>

        <div className="mb-6">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as UserReportStatus | "all")
            }
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved_warned">Resolved (Warned)</SelectItem>
              <SelectItem value="resolved_banned">Resolved (Banned)</SelectItem>
              <SelectItem value="resolved_paused">Resolved (Paused)</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-10 text-[#545454]">
            {allUserReports === undefined
              ? "Loading user reports..."
              : "No user reports found."}
          </div>
        )}

        {filteredReports.length > 0 && (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div
                key={report._id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-[#292929]">
                        {report.reportedUser?.name || "Deleted User"}
                      </h3>
                      {getStatusBadge(report.status)}
                      {report.reportedUser?.isBanned && (
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                          Banned
                        </span>
                      )}
                      {report.reportedUser?.isPaused && (
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                          Paused
                        </span>
                      )}
                    </div>
                    {report.reportedUser && (
                      <div className="text-sm text-[#545454] space-y-1">
                        <p>
                          Username:{" "}
                          <Link
                            to={`/${report.reportedUser.username}`}
                            className="text-blue-600 hover:underline"
                          >
                            @{report.reportedUser.username || "N/A"}
                          </Link>
                        </p>
                        <p>Email: {report.reportedUser.email || "N/A"}</p>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[#545454]">
                    {formatDistanceToNow(report._creationTime)} ago
                  </span>
                </div>

                <div className="mb-3 p-3 bg-white rounded-md border border-gray-200">
                  <p className="text-sm text-[#525252] font-medium mb-1">
                    Reason for Report:
                  </p>
                  <p className="text-sm text-[#545454]">{report.reason}</p>
                </div>

                <div className="mb-3 text-sm text-[#545454]">
                  <p>
                    Reported by:{" "}
                    {report.reporter ? (
                      <Link
                        to={`/${report.reporter.username}`}
                        className="text-blue-600 hover:underline"
                      >
                        {report.reporter.name} (@{report.reporter.username})
                      </Link>
                    ) : (
                      "Deleted User"
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                  {report.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStatusChange(report._id, "resolved_warned")
                        }
                        className="text-xs"
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        Warn User
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStatusChange(report._id, "resolved_paused")
                        }
                        className="text-xs"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Pause User
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStatusChange(report._id, "resolved_banned")
                        }
                        className="text-xs"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Ban User
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStatusChange(report._id, "dismissed")
                        }
                        className="text-xs"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Dismiss
                      </Button>
                    </>
                  )}
                  {report.status !== "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(report._id, "pending")}
                      className="text-xs"
                    >
                      Reopen Report
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
