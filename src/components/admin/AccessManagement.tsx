import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import AlertDialog from "../ui/AlertDialog";

// Sections and their permission keys, mirrored from convex/adminAccess.ts
type SectionDef = {
  id: string;
  title: string;
  description: string;
  keys: Array<{ key: string; label: string; destructive?: boolean }>;
};

const SECTIONS: Array<SectionDef> = [
  {
    id: "moderation",
    title: "Moderation",
    description: "Story and comment moderation queues",
    keys: [
      { key: "moderation.view", label: "View submissions and comments" },
      {
        key: "moderation.moderate",
        label: "Approve, reject, hide, archive, pin, edit, tags",
      },
      {
        key: "moderation.delete",
        label: "Delete stories and comments",
        destructive: true,
      },
    ],
  },
  {
    id: "tags",
    title: "Tags",
    description: "Site-wide tag management",
    keys: [
      { key: "tags.view", label: "View all tags" },
      { key: "tags.manage", label: "Create, edit, reorder, visibility" },
      { key: "tags.delete", label: "Delete tags", destructive: true },
    ],
  },
  {
    id: "forms",
    title: "Forms",
    description: "Story form fields and custom forms",
    keys: [
      { key: "forms.view", label: "View forms and fields" },
      { key: "forms.manage", label: "Create and edit forms and fields" },
      { key: "forms.results", label: "View form submissions and exports" },
      {
        key: "forms.delete",
        label: "Delete forms and fields",
        destructive: true,
      },
    ],
  },
  {
    id: "judging",
    title: "Judging",
    description: "Scoped to the judging groups selected below",
    keys: [
      { key: "judging.view", label: "View judging groups" },
      {
        key: "judging.manage",
        label: "Group settings, criteria, submissions, passwords",
      },
      { key: "judging.results", label: "View results and export CSVs" },
      {
        key: "judging.tracking",
        label: "Judge tracking: edit, hide, delete scores and notes",
      },
      { key: "judging.ai", label: "AI judge runs, AI score edits, agent keys" },
      {
        key: "judging.emails",
        label: "Send template emails to a group's judges",
      },
      {
        key: "judging.slug",
        label: "Change judging group URL slug",
        destructive: true,
      },
      {
        key: "judging.delete",
        label: "Delete judging groups",
        destructive: true,
      },
    ],
  },
  {
    id: "numbers",
    title: "Numbers",
    description: "Read-only site metrics",
    keys: [{ key: "numbers.view", label: "View metrics dashboard" }],
  },
  {
    id: "users",
    title: "User Moderation",
    description: "User accounts and reports",
    keys: [
      { key: "users.view", label: "View and search users" },
      { key: "users.moderate", label: "Ban, pause, verify users" },
      { key: "users.reports", label: "Handle content and user reports" },
      { key: "users.delete", label: "Delete users", destructive: true },
    ],
  },
  {
    id: "emails",
    title: "Emails",
    description: "Email management and broadcasts",
    keys: [
      { key: "emails.view", label: "View email settings and logs" },
      { key: "emails.send", label: "Send test and broadcast emails" },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    description: "Site-wide settings",
    keys: [
      { key: "settings.view", label: "View settings" },
      { key: "settings.manage", label: "Change settings" },
    ],
  },
  {
    id: "activity",
    title: "Activity",
    description: "Admin activity log across the whole app",
    keys: [
      { key: "activity.view", label: "View the activity log" },
      {
        key: "activity.manage",
        label: "Pause, clear, archive, delete, export",
        destructive: true,
      },
    ],
  },
];

const KEY_LABELS: Record<string, string> = Object.fromEntries(
  SECTIONS.flatMap((s) => s.keys.map((k) => [k.key, `${s.title}: ${k.label}`])),
);

// Short chip label, e.g. "moderation.moderate" -> "Moderation · moderate"
function chipLabel(key: string): string {
  const [section, action] = key.split(".");
  const sectionTitle = SECTIONS.find((s) => s.id === section)?.title ?? section;
  return `${sectionTitle} · ${action}`;
}

type EditorState = {
  userId: Id<"users">;
  userName: string;
  userUsername?: string;
  userImageUrl?: string;
  permissions: Set<string>;
  judgingGroupIds: Set<Id<"judgingGroups">>;
  allJudgingGroups: boolean;
  notes: string;
  isExisting: boolean;
};

export function AccessManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{
    userId: Id<"users">;
    name: string;
  } | null>(null);
  const [expandedGrantId, setExpandedGrantId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const searchResults = useQuery(
    api.adminAccess.searchUsersForAccess,
    searchTerm.trim().length > 0 ? { searchTerm: searchTerm.trim() } : "skip",
  );
  const grants = useQuery(api.adminAccess.listGrants, {});
  const groups = useQuery(api.adminAccess.listGroupsForAccess, {});

  const grantAccess = useMutation(api.adminAccess.grantAccess);
  const revokeAccess = useMutation(api.adminAccess.revokeAccess);

  const grantByUserId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof grants>[number]>();
    for (const grant of grants ?? []) {
      map.set(grant.userId, grant);
    }
    return map;
  }, [grants]);

  // Active groups first, then alphabetical; filtered by the group search box
  const filteredGroups = useMemo(() => {
    if (groups === undefined) return undefined;
    const term = groupSearch.trim().toLowerCase();
    const matched =
      term === ""
        ? groups
        : groups.filter(
            (g) =>
              g.name.toLowerCase().includes(term) ||
              g.slug.toLowerCase().includes(term),
          );
    return [...matched].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [groups, groupSearch]);

  const openEditorForUser = (user: {
    _id: Id<"users">;
    name: string;
    username?: string;
    imageUrl?: string;
  }) => {
    const existing = grantByUserId.get(user._id);
    setEditor({
      userId: user._id,
      userName: user.name,
      userUsername: user.username,
      userImageUrl: user.imageUrl,
      permissions: new Set(existing?.permissions ?? []),
      judgingGroupIds: new Set(existing?.judgingGroupIds ?? []),
      allJudgingGroups: existing?.allJudgingGroups ?? false,
      notes: existing?.notes ?? "",
      isExisting: existing !== undefined,
    });
    setSearchTerm("");
    setGroupSearch("");
  };

  const openEditorForGrant = (grant: NonNullable<typeof grants>[number]) => {
    setEditor({
      userId: grant.userId,
      userName: grant.user?.name ?? "Unknown user",
      userUsername: grant.user?.username,
      userImageUrl: grant.user?.imageUrl,
      permissions: new Set(grant.permissions),
      judgingGroupIds: new Set(grant.judgingGroupIds),
      allJudgingGroups: grant.allJudgingGroups,
      notes: grant.notes ?? "",
      isExisting: true,
    });
    setGroupSearch("");
  };

  const togglePermission = (key: string) => {
    if (!editor) return;
    const next = new Set(editor.permissions);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      // Enabling an action also enables that section's view key so the
      // matching admin tab renders for the user.
      const section = key.split(".")[0];
      const viewKey = `${section}.view`;
      if (key !== viewKey && KEY_LABELS[viewKey]) {
        next.add(viewKey);
      }
    }
    setEditor({ ...editor, permissions: next });
  };

  const toggleSection = (section: SectionDef) => {
    if (!editor) return;
    const next = new Set(editor.permissions);
    const allOn = section.keys.every((k) => next.has(k.key));
    for (const k of section.keys) {
      if (allOn) {
        next.delete(k.key);
      } else {
        next.add(k.key);
      }
    }
    setEditor({ ...editor, permissions: next });
  };

  const toggleGroup = (groupId: Id<"judgingGroups">) => {
    if (!editor) return;
    const next = new Set(editor.judgingGroupIds);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setEditor({ ...editor, judgingGroupIds: next });
  };

  const handleSave = async () => {
    if (!editor) return;
    if (editor.permissions.size === 0) {
      toast.error("Select at least one permission before saving.");
      return;
    }
    const hasJudging = [...editor.permissions].some((k) =>
      k.startsWith("judging."),
    );
    if (
      hasJudging &&
      !editor.allJudgingGroups &&
      editor.judgingGroupIds.size === 0
    ) {
      toast.error(
        "Judging permissions need at least one judging group (or all groups).",
      );
      return;
    }
    setIsSaving(true);
    try {
      await grantAccess({
        userId: editor.userId,
        permissions: [...editor.permissions],
        judgingGroupIds: hasJudging ? [...editor.judgingGroupIds] : [],
        allJudgingGroups: hasJudging ? editor.allJudgingGroups : false,
        notes: editor.notes.trim() === "" ? undefined : editor.notes.trim(),
      });
      toast.success(
        editor.isExisting
          ? `Access updated for ${editor.userName}`
          : `Access granted to ${editor.userName}`,
      );
      setEditor(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save access",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeAccess({ userId: revokeTarget.userId });
      toast.success(`Access revoked for ${revokeTarget.name}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke access",
      );
    } finally {
      setRevokeTarget(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-surface rounded-lg border border-hairline p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-copy" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-ink">
              Delegated admin access
            </h2>
            <p className="text-sm text-soft mt-1 max-w-2xl">
              Give existing users access to specific admin sections without
              making them full admins. Judging access can be scoped to one or
              more judging groups. Changes take effect immediately and can be
              revoked at any time. Full admins keep complete access and are
              managed in Clerk.
            </p>
          </div>
        </div>

        {/* User search */}
        <div className="mt-6 relative max-w-lg">
          <label
            htmlFor="access-user-search"
            className="block text-sm font-medium text-copy mb-1"
          >
            Find a user to grant access
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
            <input
              id="access-user-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent"
            />
          </div>
          {searchTerm.trim().length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-surface border border-hairline rounded-md shadow-lg overflow-hidden">
              {searchResults === undefined ? (
                <div className="px-4 py-3 text-sm text-soft">
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-soft">
                  No users found
                </div>
              ) : (
                searchResults.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => openEditorForUser(user)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover transition-colors"
                  >
                    {user.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-surface-alt flex items-center justify-center">
                        <Users className="w-4 h-4 text-faint" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink truncate">
                        {user.name}
                      </div>
                      <div className="text-xs text-soft truncate">
                        {user.username ? `@${user.username}` : user.email}
                      </div>
                    </div>
                    {user.hasGrant && (
                      <span className="text-xs font-medium text-copy bg-surface-alt border border-hairline rounded-full px-2 py-0.5 flex-shrink-0">
                        Has access
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grant editor */}
      {editor && (
        <div className="bg-surface rounded-lg border border-hairline p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {editor.userImageUrl ? (
                <img
                  src={editor.userImageUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center">
                  <Users className="w-5 h-5 text-faint" />
                </div>
              )}
              <div>
                <h3 className="text-base font-medium text-ink">
                  {editor.isExisting ? "Edit access for" : "Grant access to"}{" "}
                  {editor.userName}
                </h3>
                {editor.userUsername && (
                  <p className="text-xs text-soft">
                    @{editor.userUsername}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="text-faint hover:text-copy transition-colors"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECTIONS.map((section) => {
              const enabledCount = section.keys.filter((k) =>
                editor.permissions.has(k.key),
              ).length;
              const allOn = enabledCount === section.keys.length;
              return (
                <div
                  key={section.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    enabledCount > 0
                      ? "border-hairline-strong bg-surface-alt"
                      : "border-hairline bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-medium text-ink">
                        {section.title}
                      </h4>
                      <p className="text-xs text-soft mt-0.5">
                        {section.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border transition-colors flex-shrink-0 ${
                        allOn
                          ? "bg-cta text-on-cta border-ink hover:bg-cta-hover"
                          : "bg-surface text-copy border-hairline hover:bg-surface-hover"
                      }`}
                    >
                      {allOn ? "All on" : "Enable all"}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {section.keys.map((k) => {
                      const checked = editor.permissions.has(k.key);
                      return (
                        <label
                          key={k.key}
                          className="flex items-start gap-2 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(k.key)}
                            className="mt-0.5 h-4 w-4 rounded border-hairline-strong text-ink focus:ring-hairline-strong"
                          />
                          <span
                            className={`text-xs leading-5 ${
                              k.destructive
                                ? checked
                                  ? "text-red-700"
                                  : "text-red-600/70 group-hover:text-red-700"
                                : checked
                                  ? "text-ink"
                                  : "text-copy group-hover:text-ink"
                            }`}
                          >
                            {k.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Judging group scope */}
                  {section.id === "judging" &&
                    [...editor.permissions].some((k) =>
                      k.startsWith("judging."),
                    ) && (
                      <div className="mt-4 pt-3 border-t border-hairline">
                        <div className="text-xs font-medium text-copy mb-2">
                          Judging group scope
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={editor.allJudgingGroups}
                            onChange={() =>
                              setEditor({
                                ...editor,
                                allJudgingGroups: !editor.allJudgingGroups,
                              })
                            }
                            className="h-4 w-4 rounded border-hairline-strong text-ink focus:ring-hairline-strong"
                          />
                          <span className="text-xs text-ink font-medium">
                            All judging groups (current and future)
                          </span>
                        </label>
                        {!editor.allJudgingGroups && (
                          <div className="space-y-2">
                            {/* Selected group chips */}
                            {editor.judgingGroupIds.size > 0 &&
                              groups !== undefined && (
                                <div className="flex flex-wrap gap-1.5">
                                  {groups
                                    .filter((g) =>
                                      editor.judgingGroupIds.has(g._id),
                                    )
                                    .map((group) => (
                                      <span
                                        key={group._id}
                                        className="inline-flex items-center gap-1 text-xs text-ink bg-surface border border-hairline-strong rounded-full pl-2.5 pr-1 py-0.5"
                                      >
                                        {group.name}
                                        <button
                                          type="button"
                                          onClick={() => toggleGroup(group._id)}
                                          className="p-0.5 text-faint hover:text-copy transition-colors"
                                          aria-label={`Remove ${group.name}`}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                </div>
                              )}

                            {/* Group search */}
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                              <input
                                type="text"
                                value={groupSearch}
                                onChange={(e) => setGroupSearch(e.target.value)}
                                placeholder="Search judging groups..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent"
                              />
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                              {filteredGroups === undefined ? (
                                <div className="text-xs text-soft">
                                  Loading groups...
                                </div>
                              ) : filteredGroups.length === 0 ? (
                                <div className="text-xs text-soft">
                                  {groupSearch.trim() === ""
                                    ? "No judging groups exist yet"
                                    : `No groups match "${groupSearch.trim()}"`}
                                </div>
                              ) : (
                                filteredGroups.map((group) => (
                                  <label
                                    key={group._id}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editor.judgingGroupIds.has(
                                        group._id,
                                      )}
                                      onChange={() => toggleGroup(group._id)}
                                      className="h-4 w-4 rounded border-hairline-strong text-ink focus:ring-hairline-strong"
                                    />
                                    <span className="text-xs text-copy">
                                      {group.name}
                                    </span>
                                    {!group.isActive && (
                                      <span className="text-[10px] text-faint uppercase tracking-wide">
                                        inactive
                                      </span>
                                    )}
                                  </label>
                                ))
                              )}
                            </div>

                            {editor.judgingGroupIds.size > 0 && (
                              <div className="text-[11px] text-soft">
                                {editor.judgingGroupIds.size}{" "}
                                {editor.judgingGroupIds.size === 1
                                  ? "group selected"
                                  : "groups selected"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          {/* Summary chips */}
          {editor.permissions.size > 0 && (
            <div>
              <div className="text-xs font-medium text-copy mb-2">
                {editor.userName} will be able to:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...editor.permissions].sort().map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 text-xs text-copy bg-surface-alt border border-hairline rounded-full px-2.5 py-1"
                  >
                    <Check className="w-3 h-3 text-soft" />
                    {chipLabel(key)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label
              htmlFor="access-notes"
              className="block text-sm font-medium text-copy mb-1"
            >
              Notes (optional)
            </label>
            <input
              id="access-notes"
              type="text"
              value={editor.notes}
              onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
              placeholder="e.g. Hackathon organizer for the fall event"
              className="w-full max-w-lg px-3 py-2 text-sm border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="px-4 py-2 rounded-md text-sm font-medium bg-cta hover:bg-cta-hover text-on-cta transition-colors disabled:opacity-50"
            >
              {isSaving
                ? "Saving..."
                : editor.isExisting
                  ? "Update access"
                  : "Grant access"}
            </button>
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="px-4 py-2 rounded-md text-sm font-medium text-copy bg-surface-alt hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Grants list */}
      <div className="bg-surface rounded-lg border border-hairline">
        <div className="px-6 py-4 border-b border-hairline">
          <h3 className="text-base font-medium text-ink">
            Who has access
          </h3>
          <p className="text-xs text-soft mt-0.5">
            {grants === undefined
              ? "Loading..."
              : grants.length === 0
                ? "No delegated access has been granted yet."
                : `${grants.length} ${grants.length === 1 ? "user has" : "users have"} delegated access.`}
          </p>
        </div>
        {grants !== undefined && grants.length > 0 && (
          <ul className="divide-y divide-hairline">
            {grants.map((grant) => {
              const isExpanded = expandedGrantId === grant._id;
              return (
                <li key={grant._id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {grant.user?.imageUrl ? (
                      <img
                        src={grant.user.imageUrl}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center">
                        <Users className="w-4 h-4 text-faint" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink truncate">
                        {grant.user?.name ?? "Unknown user"}
                        {grant.user?.username && (
                          <span className="text-faint font-normal">
                            {" "}
                            @{grant.user.username}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-soft truncate">
                        {grant.permissions.length}{" "}
                        {grant.permissions.length === 1
                          ? "permission"
                          : "permissions"}
                        {grant.allJudgingGroups
                          ? " · all judging groups"
                          : grant.judgingGroups.length > 0
                            ? ` · ${grant.judgingGroups.length} judging ${grant.judgingGroups.length === 1 ? "group" : "groups"}`
                            : ""}
                        {grant.grantedByUser &&
                          ` · granted by ${grant.grantedByUser.name}`}
                        {" · "}
                        {new Date(grant._creationTime).toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGrantId(isExpanded ? null : grant._id)
                        }
                        className="p-2 text-faint hover:text-copy transition-colors"
                        aria-label={
                          isExpanded ? "Collapse details" : "Expand details"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditorForGrant(grant)}
                        className="p-2 text-faint hover:text-copy transition-colors"
                        aria-label="Edit access"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRevokeTarget({
                            userId: grant.userId,
                            name: grant.user?.name ?? "this user",
                          })
                        }
                        className="p-2 text-faint hover:text-red-600 transition-colors"
                        aria-label="Revoke access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 ml-12 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {grant.permissions.sort().map((key) => (
                          <span
                            key={key}
                            className="text-xs text-copy bg-surface-alt border border-hairline rounded-full px-2.5 py-1"
                          >
                            {chipLabel(key)}
                          </span>
                        ))}
                      </div>
                      {(grant.allJudgingGroups ||
                        grant.judgingGroups.length > 0) && (
                        <div className="text-xs text-copy">
                          <span className="font-medium">Judging groups:</span>{" "}
                          {grant.allJudgingGroups
                            ? "All groups (current and future)"
                            : grant.judgingGroups.map((g) => g.name).join(", ")}
                        </div>
                      )}
                      {grant.notes && (
                        <div className="text-xs text-copy">
                          <span className="font-medium">Notes:</span>{" "}
                          {grant.notes}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void handleRevoke()}
        title="Revoke access"
        description={`This removes all delegated admin access for ${revokeTarget?.name ?? ""}. They will lose access immediately. This does not affect their regular account.`}
        confirmButtonText="Revoke access"
        confirmButtonVariant="destructive"
      />
    </div>
  );
}
