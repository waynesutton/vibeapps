import { useState } from "react";
import { Link } from "react-router-dom";
import { Award, ChevronRight, Lock, Plus, Unlock } from "lucide-react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatDistanceToNow } from "date-fns";
import { CreateJudgingGroupModal } from "./CreateJudgingGroupModal";
import { useAdminAccess } from "./useAdminAccess";

// Compact judging group list. Each row opens the full group workspace at
// /admin/judging/:slug where settings, criteria, results, AI, and tracking
// live as sidebar sections.
export function Judging() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { can } = useAdminAccess();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const groups = useQuery(
    api.judgingGroups.listGroups,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );

  if (authIsLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  const totalSubmissions = groups?.reduce(
    (sum, g) => sum + g.submissionCount,
    0,
  );
  const totalJudges = groups?.reduce((sum, g) => sum + g.judgeCount, 0);
  const activeCount = groups?.filter((g) => g.isActive).length;

  return (
    <div className="space-y-4">
      {/* Header: title, inline totals, create action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-[#292929]">Judging</h2>
          {groups && groups.length > 0 && (
            <p className="text-[13px] text-gray-500 mt-0.5 tabular-nums">
              {groups.length} group{groups.length === 1 ? "" : "s"} ·{" "}
              {activeCount} active · {totalSubmissions} submission
              {totalSubmissions === 1 ? "" : "s"} · {totalJudges} judge
              {totalJudges === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {can("judging.manage") && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors text-[13px] font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Create judging group
          </button>
        )}
      </div>

      {groups === undefined && (
        <div className="text-sm text-gray-500">Loading judging groups...</div>
      )}

      {groups && groups.length === 0 && (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-lg">
          <Award className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-[#292929] mb-1">
            No judging groups yet
          </p>
          <p className="text-[13px] text-gray-500">
            Create your first judging group to start scoring submissions.
          </p>
        </div>
      )}

      {/* Compact rows: the whole row navigates into the group workspace */}
      {groups && groups.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {groups.map((group) => (
            <Link
              key={group._id}
              to={`/admin/judging/${group.slug}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group"
            >
              {/* Status dot */}
              <span
                aria-hidden
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  group.isActive ? "bg-green-500" : "bg-gray-300"
                }`}
                title={group.isActive ? "Active" : "Inactive"}
              />

              {/* Name + slug */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#292929] truncate">
                    {group.name}
                  </span>
                  {group.isPublic ? (
                    <Unlock
                      className="w-3 h-3 text-gray-400 flex-shrink-0"
                      aria-label="Public judge access"
                    />
                  ) : (
                    <Lock
                      className="w-3 h-3 text-gray-400 flex-shrink-0"
                      aria-label="Private judge access"
                    />
                  )}
                </div>
                <span className="text-xs text-gray-400 font-mono truncate block">
                  /judging/{group.slug}
                </span>
              </div>

              {/* Counts */}
              <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 tabular-nums flex-shrink-0">
                <span title="Submissions">
                  {group.submissionCount} sub
                  {group.submissionCount === 1 ? "" : "s"}
                </span>
                <span title="Judges">
                  {group.judgeCount} judge{group.judgeCount === 1 ? "" : "s"}
                </span>
                <span
                  className="hidden md:inline text-gray-400"
                  title="Created"
                >
                  {formatDistanceToNow(group._creationTime)} ago
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <CreateJudgingGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          // Groups refresh automatically via Convex reactivity
        }}
      />
    </div>
  );
}
