import React, { useState, useMemo, useCallback, useEffect } from "react";
import { usePaginatedQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Ban, CheckCircle, Trash2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { debounce } from "lodash-es";
import { toast } from "sonner";

// Define the user type as returned by listAllUsersAdmin
type AdminUserView = {
  _id: Id<"users">;
  _creationTime: number;
  name: string;
  email?: string;
  username?: string;
  imageUrl?: string;
  isBanned: boolean;
};

type BanFilter = "all" | "banned" | "not_banned";

export function UserModeration() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [banFilter, setBanFilter] = useState<BanFilter>("all");
  const [confirmingAction, setConfirmingAction] = useState<{
    userId: Id<"users">;
    userName: string;
    action: "ban" | "unban" | "delete";
  } | null>(null);

  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSetSearch(value);
  };

  const queryArgs = useMemo(() => {
    const args: any = {}; // paginationOpts will be added by usePaginatedQuery
    if (debouncedSearchTerm) {
      // The backend listAllUsersAdmin currently doesn't implement search.
      // This will be a client-side filter for now, or backend needs update.
      // args.searchQuery = debouncedSearchTerm;
    }
    if (banFilter === "banned") {
      args.filterBanned = true;
    } else if (banFilter === "not_banned") {
      args.filterBanned = false;
    }
    return args;
  }, [debouncedSearchTerm, banFilter]);

  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.users.listAllUsersAdmin,
    authIsLoading || !isAuthenticated ? "skip" : queryArgs,
    { initialNumItems: 15 }
  );

  const banUserMutation = useMutation(api.users.banUserByAdmin);
  const unbanUserMutation = useMutation(api.users.unbanUserByAdmin);
  const deleteUserMutation = useMutation(api.users.deleteUserByAdmin);

  // Client-side search filtering because backend search is not yet implemented for users.ts
  const filteredResults = useMemo(() => {
    if (!results) return [];
    if (!debouncedSearchTerm) return results;
    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    return results.filter(
      (user) =>
        user.name?.toLowerCase().includes(lowerSearchTerm) ||
        user.email?.toLowerCase().includes(lowerSearchTerm) ||
        user.username?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [results, debouncedSearchTerm]);

  const handleAction = async () => {
    if (!confirmingAction) return;

    const { userId, action, userName } = confirmingAction;
    try {
      if (action === "ban") {
        await banUserMutation({ userId });
        toast.success(`User "${userName}" has been banned.`);
      } else if (action === "unban") {
        await unbanUserMutation({ userId });
        toast.success(`User "${userName}" has been unbanned.`);
      } else if (action === "delete") {
        await deleteUserMutation({ userId });
        toast.success(`User "${userName}" has been deleted.`);
      }
    } catch (error: any) {
      console.error(`Failed to ${action} user:`, error);
      toast.error(`Failed to ${action} user: ${error.data?.message || error.message}`);
    }
    setConfirmingAction(null);
  };

  const openConfirmModal = (
    userId: Id<"users">,
    userName: string,
    action: "ban" | "unban" | "delete"
  ) => {
    setConfirmingAction({ userId, userName, action });
  };

  if (authIsLoading) {
    return <div className="text-center py-10">Loading authentication...</div>;
  }

  if (status === "LoadingFirstPage" && isLoading && isAuthenticated) {
    return <div className="text-center py-10">Loading users...</div>;
  }

  // Basic styling for HTML table
  const thClass =
    "text-left p-3 px-4 text-gray-600 font-medium border-b border-gray-200 bg-gray-50";
  const tdClass = "p-3 px-4 border-b border-gray-100 text-gray-700";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-medium text-[#525252] mb-6">User Moderation</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search by name, email, username..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
          <Select value={banFilter} onValueChange={(v) => setBanFilter(v as BanFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by ban status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="banned">Banned Users</SelectItem>
              <SelectItem value="not_banned">Not Banned Users</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredResults.length === 0 && !isLoading && (
          <div className="text-center py-10 text-[#545454]">
            No users found matching your criteria.
          </div>
        )}

        {filteredResults.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Username</th>
                  <th className={thClass}>Joined</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((user: AdminUserView) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        {user.imageUrl && (
                          <img
                            src={user.imageUrl}
                            alt={user.name}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td className={tdClass}>{user.email || "N/A"}</td>
                    <td className={tdClass}>{user.username || "N/A"}</td>
                    <td className={tdClass}>
                      {formatDistanceToNow(user._creationTime, { addSuffix: true })}
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isBanned ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                        {user.isBanned ? "Banned" : "Active"}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right space-x-2`}>
                      {user.isBanned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openConfirmModal(user._id, user.name, "unban")}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Unban
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={() => openConfirmModal(user._id, user.name, "ban")}>
                          <Ban className="w-4 h-4 mr-1" /> Ban
                        </Button>
                      )}
                      <Button
                        variant="destructive_outline"
                        size="sm"
                        onClick={() => openConfirmModal(user._id, user.name, "delete")}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {status === "CanLoadMore" && (
          <div className="text-center mt-6">
            <Button variant="outline" onClick={() => loadMore(15)} disabled={isLoading}>
              {isLoading ? "Loading..." : "Load More Users"}
            </Button>
          </div>
        )}
      </div>

      {confirmingAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center mb-4">
              <AlertTriangle
                className={`w-6 h-6 mr-3 ${confirmingAction.action === "delete" ? "text-red-500" : "text-orange-500"}`}
              />
              <h3 className="text-lg font-semibold text-gray-800">
                Confirm{" "}
                {confirmingAction.action.charAt(0).toUpperCase() + confirmingAction.action.slice(1)}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to {confirmingAction.action} the user "
              <strong>{confirmingAction.userName}</strong>"?
              {confirmingAction.action === "delete" && " This action cannot be undone."}
              {confirmingAction.action === "ban" &&
                " This will prevent them from posting, voting, commenting, etc."}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmingAction(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmingAction.action === "delete" ? "destructive" : "default"}
                onClick={handleAction}
                className={
                  confirmingAction.action === "ban"
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : ""
                }>
                Confirm{" "}
                {confirmingAction.action.charAt(0).toUpperCase() + confirmingAction.action.slice(1)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
