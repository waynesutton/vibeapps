import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Settings,
  Eye,
  EyeOff,
  ExternalLink,
  Trash2,
  BarChart2,
  Lock,
  Unlock,
  Users,
  Award,
  PlayCircle,
  PauseCircle,
  Edit,
  FileText,
} from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { CreateJudgingGroupModal } from "./CreateJudgingGroupModal";
import { EditJudgingGroupModal } from "./EditJudgingGroupModal";
import { JudgingCriteriaEditor } from "./JudgingCriteriaEditor";
import { JudgingResultsDashboard } from "./JudgingResultsDashboard";

export function Judging() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const groups = useQuery(
    api.judgingGroups.listGroups,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const deleteGroup = useMutation(api.judgingGroups.deleteGroup);

  const [deleteConfirmId, setDeleteConfirmId] =
    useState<Id<"judgingGroups"> | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editGroupId, setEditGroupId] = useState<Id<"judgingGroups"> | null>(
    null,
  );
  const [currentView, setCurrentView] = useState<
    "list" | "criteria" | "results"
  >("list");
  const [selectedGroup, setSelectedGroup] = useState<{
    id: Id<"judgingGroups">;
    name: string;
  } | null>(null);

  const toggleGroupVisibility = (group: any) => {
    updateGroup({ groupId: group._id, isPublic: !group.isPublic });
  };

  const toggleGroupStatus = (group: any) => {
    updateGroup({ groupId: group._id, isActive: !group.isActive });
  };

  const handleDelete = (groupId: Id<"judgingGroups">) => {
    if (deleteConfirmId === groupId) {
      deleteGroup({ groupId });
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(groupId);
      setTimeout(() => setDeleteConfirmId(null), 5000);
    }
  };

  const handleEditCriteria = (
    groupId: Id<"judgingGroups">,
    groupName: string,
  ) => {
    setSelectedGroup({ id: groupId, name: groupName });
    setCurrentView("criteria");
  };

  const handleViewResults = (
    groupId: Id<"judgingGroups">,
    groupName: string,
  ) => {
    setSelectedGroup({ id: groupId, name: groupName });
    setCurrentView("results");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedGroup(null);
  };

  const getStatusBadge = (group: any) => {
    if (group.isActive) {
      return (
        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
          Active
        </span>
      );
    }

    return (
      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
        Inactive
      </span>
    );
  };

  if (authIsLoading) {
    return (
      <div className="space-y-6 text-center">Loading authentication...</div>
    );
  }

  // Show criteria editor if selected
  if (currentView === "criteria" && selectedGroup) {
    return (
      <JudgingCriteriaEditor
        groupId={selectedGroup.id}
        groupName={selectedGroup.name}
        onBack={handleBackToList}
      />
    );
  }

  // Show results dashboard if selected
  if (currentView === "results" && selectedGroup) {
    return (
      <JudgingResultsDashboard
        groupId={selectedGroup.id}
        groupName={selectedGroup.name}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl font-medium text-[#525252]">Judging System</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Judging Group
        </button>
      </div>

      {groups === undefined && <div>Loading judging groups...</div>}
      {groups && groups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Award className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">No judging groups yet</p>
          <p className="text-sm">
            Create your first judging group to get started with scoring
            submissions.
          </p>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left p-2 px-3 text-[#525252] font-medium">
                    Group Name
                  </th>
                  <th className="text-left p-2 px-2 text-[#525252] font-medium">
                    Status
                  </th>
                  <th className="text-left p-2 px-2 text-[#525252] font-medium">
                    Access
                  </th>
                  <th className="text-left p-2 px-2 text-[#525252] font-medium">
                    Subs
                  </th>
                  <th className="text-left p-2 px-2 text-[#525252] font-medium">
                    Judges
                  </th>
                  <th className="text-left p-2 px-2 text-[#525252] font-medium">
                    Created
                  </th>
                  <th className="text-left p-2 px-3 text-[#525252] font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr
                    key={group._id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="p-2 px-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#525252]">
                          {group.name}
                        </span>
                        {group.description && (
                          <span className="text-xs text-gray-500 mt-1">
                            {group.description}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 mt-1">
                          /{group.slug}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 px-2">
                      <div className="flex items-center gap-1">
                        {getStatusBadge(group)}
                        <button
                          onClick={() => toggleGroupStatus(group)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title={
                            group.isActive
                              ? "Pause judging"
                              : "Activate judging"
                          }
                        >
                          {group.isActive ? (
                            <PauseCircle className="w-4 h-4" />
                          ) : (
                            <PlayCircle className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="p-2 px-2">
                      <div className="flex items-center gap-1">
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          {group.isPublic ? (
                            <>
                              <Unlock className="w-3 h-3" />
                              Pub
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              Priv
                            </>
                          )}
                        </span>
                        <button
                          onClick={() => toggleGroupVisibility(group)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title={
                            group.isPublic ? "Make private" : "Make public"
                          }
                        >
                          {group.isPublic ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="p-2 px-2 text-center">
                      <span className="text-[#525252] font-medium">
                        {group.submissionCount}
                      </span>
                    </td>
                    <td className="p-2 px-2 text-center">
                      <span className="text-[#525252] font-medium">
                        {group.judgeCount}
                      </span>
                    </td>
                    <td className="p-2 px-2 text-gray-500 text-sm">
                      {formatDistanceToNow(group._creationTime)} ago
                    </td>
                    <td className="p-2 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setEditGroupId(group._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                          title="Edit group settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Settings</span>
                        </button>

                        <a
                          href={`/judging/${group.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                          title="Open judging page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Page</span>
                        </a>

                        <button
                          onClick={() =>
                            handleEditCriteria(group._id, group.name)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                          title="Edit judging criteria"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Criteria</span>
                        </button>

                        {group.hasCustomSubmissionPage && (
                          <a
                            href={`/judging/${group.slug}/submit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                            title="Open custom submission page"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Submit Page</span>
                          </a>
                        )}

                        <a
                          href={`/judging/${group.slug}/results`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                          title={
                            group.resultsIsPublic
                              ? "View public results page"
                              : "View password-protected results page"
                          }
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          <span>
                            {group.resultsIsPublic
                              ? "Public Results"
                              : "Results Page"}
                          </span>
                        </a>

                        {!group.resultsIsPublic && (
                          <button
                            onClick={() =>
                              handleViewResults(group._id, group.name)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                            title="View admin results dashboard"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Admin Results</span>
                          </button>
                        )}

                        <Link
                          to={`/admin/judging/${group.slug}/tracking`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
                          title="Track judges"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Judge Tracking</span>
                        </Link>

                        <button
                          onClick={() => handleDelete(group._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 bg-white hover:bg-red-50 rounded-lg border border-gray-200 hover:border-red-300 transition-all font-medium"
                          title={
                            deleteConfirmId === group._id
                              ? "Click again to confirm"
                              : "Delete group"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            {deleteConfirmId === group._id
                              ? "Confirm"
                              : "Delete"}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {groups && groups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Groups</p>
                <p className="text-2xl font-semibold text-[#525252]">
                  {groups.length}
                </p>
              </div>
              <Award className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Groups</p>
                <p className="text-2xl font-semibold text-green-600">
                  {groups.filter((g) => g.isActive).length}
                </p>
              </div>
              <PlayCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Submissions</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {groups.reduce((sum, g) => sum + g.submissionCount, 0)}
                </p>
              </div>
              <Settings className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Judges</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {groups.reduce((sum, g) => sum + g.judgeCount, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      <CreateJudgingGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          // Groups will automatically refresh due to Convex reactivity
        }}
      />

      {/* Edit Group Modal */}
      {editGroupId && (
        <EditJudgingGroupModal
          isOpen={!!editGroupId}
          onClose={() => setEditGroupId(null)}
          onSuccess={() => {
            setEditGroupId(null);
            // Groups will automatically refresh due to Convex reactivity
          }}
          groupId={editGroupId}
        />
      )}
    </div>
  );
}
