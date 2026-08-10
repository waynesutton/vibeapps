import { createContext, useContext, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// Effective admin access for the signed-in user. Full admins get every
// permission key; delegated users get the keys and groups from their grant.
export type AdminAccess = {
  isAdmin: boolean;
  permissions: Array<string>;
  judgingGroupIds: Array<Id<"judgingGroups">>;
  allJudgingGroups: boolean;
};

/**
 * Top-level gate hook for admin routes. Returns loading state plus the
 * resolved access (null means no admin access at all, show 404).
 */
export function useAdminAccessQuery(): {
  isLoading: boolean;
  isAuthenticated: boolean;
  access: AdminAccess | null;
} {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const access = useQuery(
    api.adminAccess.getMyAdminAccess,
    isAuthenticated ? {} : "skip",
  );
  return {
    isLoading: authIsLoading || (isAuthenticated && access === undefined),
    isAuthenticated,
    access: access ?? null,
  };
}

const AdminAccessContext = createContext<AdminAccess | null>(null);

/** Provides the resolved access to all admin dashboard children. */
export function AdminAccessProvider({
  access,
  children,
}: {
  access: AdminAccess;
  children: ReactNode;
}) {
  return (
    <AdminAccessContext.Provider value={access}>
      {children}
    </AdminAccessContext.Provider>
  );
}

/**
 * Permission helper for admin components. Reads from the provider when
 * available; otherwise fetches directly (for standalone admin routes such
 * as FormBuilder or JudgeTrackingPage).
 */
export function useAdminAccess(): {
  access: AdminAccess | null;
  isAdmin: boolean;
  can: (key: string) => boolean;
  canAccessGroup: (groupId: Id<"judgingGroups">) => boolean;
} {
  const contextAccess = useContext(AdminAccessContext);
  const { isAuthenticated } = useConvexAuth();
  const queried = useQuery(
    api.adminAccess.getMyAdminAccess,
    contextAccess === null && isAuthenticated ? {} : "skip",
  );
  const access = contextAccess ?? queried ?? null;

  const can = (key: string): boolean =>
    access !== null && (access.isAdmin || access.permissions.includes(key));

  const canAccessGroup = (groupId: Id<"judgingGroups">): boolean =>
    access !== null &&
    (access.isAdmin ||
      access.allJudgingGroups ||
      access.judgingGroupIds.includes(groupId));

  return { access, isAdmin: access?.isAdmin ?? false, can, canAccessGroup };
}
