import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { logActivity } from "./activityLog";

// Permission keys for delegated admin access. Full admins (Clerk JWT
// role === "admin") bypass all of these checks.
export const PERMISSION_KEYS = [
  // Content moderation
  "moderation.view",
  "moderation.moderate",
  "moderation.delete",
  // Tags
  "tags.view",
  "tags.manage",
  "tags.delete",
  // Forms (story form fields + custom forms)
  "forms.view",
  "forms.manage",
  "forms.results",
  "forms.delete",
  // Judging (scoped by judgingGroupIds / allJudgingGroups)
  "judging.view",
  "judging.manage",
  "judging.results",
  "judging.tracking",
  "judging.ai",
  "judging.emails",
  "judging.slug",
  "judging.delete",
  // Numbers (read-only metrics)
  "numbers.view",
  // User moderation and reports
  "users.view",
  "users.moderate",
  "users.reports",
  "users.delete",
  // Emails
  "emails.view",
  "emails.send",
  // Site settings
  "settings.view",
  "settings.manage",
  // Activity log
  "activity.view",
  "activity.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const permissionKeySet: Set<string> = new Set(PERMISSION_KEYS);

export type AccessContext =
  | { isAdmin: true; grant: null }
  | { isAdmin: false; grant: Doc<"adminPermissions"> | null };

/**
 * Checks the Clerk JWT top-level role claim without touching the database.
 * Kept local (instead of importing users.isUserAdmin) to avoid a circular
 * import, since users.ts imports permission helpers from this file.
 */
async function isJwtAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    return (identity as { role?: string }).role === "admin";
  } catch {
    return false;
  }
}

/**
 * Resolves the caller's access: full admin via JWT, or a delegated grant
 * row looked up by Clerk ID. Grants take effect and revoke instantly.
 */
export async function getAccessContext(
  ctx: QueryCtx | MutationCtx,
): Promise<AccessContext> {
  if (await isJwtAdmin(ctx)) {
    return { isAdmin: true, grant: null };
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return { isAdmin: false, grant: null };
  }
  const grant = await ctx.db
    .query("adminPermissions")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return { isAdmin: false, grant };
}

/**
 * Non-throwing permission check. Full admins always pass.
 */
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  key: PermissionKey,
): Promise<boolean> {
  const access = await getAccessContext(ctx);
  if (access.isAdmin) return true;
  return access.grant?.permissions.includes(key) ?? false;
}

/**
 * Throws unless the caller is a full admin or holds the permission key.
 * Drop-in replacement for requireAdminRole on delegated surfaces.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  key: PermissionKey,
): Promise<void> {
  if (await hasPermission(ctx, key)) return;
  throw new Error(`Permission required: ${key}`);
}

/**
 * Throws unless the caller is a full admin, or holds the permission key AND
 * has access to the specific judging group (directly or via allJudgingGroups).
 */
export async function requireJudgingGroupPermission(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"judgingGroups">,
  key: PermissionKey,
): Promise<void> {
  const access = await getAccessContext(ctx);
  if (access.isAdmin) return;
  const grant = access.grant;
  if (!grant || !grant.permissions.includes(key)) {
    throw new Error(`Permission required: ${key}`);
  }
  if (grant.allJudgingGroups) return;
  if (grant.judgingGroupIds.includes(groupId)) return;
  throw new Error("No access to this judging group.");
}

/**
 * Returns "all" for full admins (or allJudgingGroups grants), otherwise the
 * explicit list of allowed group ids. Used to filter group list queries.
 */
export async function getAllowedJudgingGroupIds(
  ctx: QueryCtx | MutationCtx,
): Promise<"all" | Array<Id<"judgingGroups">>> {
  const access = await getAccessContext(ctx);
  if (access.isAdmin) return "all";
  const grant = access.grant;
  if (!grant || !grant.permissions.includes("judging.view")) return [];
  if (grant.allJudgingGroups) return "all";
  return grant.judgingGroupIds;
}

/**
 * Throws unless the caller is a full admin (JWT role). Used to protect the
 * access management CRUD itself, which is never delegatable.
 */
async function requireFullAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  if (!(await isJwtAdmin(ctx))) {
    throw new Error("Admin privileges required.");
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }
  const adminUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!adminUser) {
    throw new Error("Admin user record not found.");
  }
  return adminUser;
}

const myAccessValidator = v.union(
  v.null(),
  v.object({
    isAdmin: v.boolean(),
    permissions: v.array(v.string()),
    judgingGroupIds: v.array(v.id("judgingGroups")),
    allJudgingGroups: v.boolean(),
  }),
);

/**
 * Frontend gate: returns the caller's effective admin access.
 * Full admins get every permission key. Users with no grant get null.
 */
export const getMyAdminAccess = query({
  args: {},
  returns: myAccessValidator,
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (access.isAdmin) {
      return {
        isAdmin: true,
        permissions: [...PERMISSION_KEYS],
        judgingGroupIds: [],
        allJudgingGroups: true,
      };
    }
    const grant = access.grant;
    if (!grant || grant.permissions.length === 0) {
      return null;
    }
    return {
      isAdmin: false,
      permissions: grant.permissions,
      judgingGroupIds: grant.judgingGroupIds,
      allJudgingGroups: grant.allJudgingGroups ?? false,
    };
  },
});

function validatePermissionKeys(permissions: Array<string>): void {
  for (const key of permissions) {
    if (!permissionKeySet.has(key)) {
      throw new Error(`Unknown permission key: ${key}`);
    }
  }
}

/**
 * Grant or replace delegated access for a user. Upserts by userId.
 * Full admin only.
 */
export const grantAccess = mutation({
  args: {
    userId: v.id("users"),
    permissions: v.array(v.string()),
    judgingGroupIds: v.array(v.id("judgingGroups")),
    allJudgingGroups: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminUser = await requireFullAdmin(ctx);
    validatePermissionKeys(args.permissions);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found.");
    }

    // Verify all judging group ids resolve
    await Promise.all(
      args.judgingGroupIds.map(async (groupId) => {
        const group = await ctx.db.get(groupId);
        if (!group) throw new Error("Judging group not found.");
      }),
    );

    const existing = await ctx.db
      .query("adminPermissions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        permissions: args.permissions,
        judgingGroupIds: args.judgingGroupIds,
        allJudgingGroups: args.allJudgingGroups ?? false,
        grantedBy: adminUser._id,
        notes: args.notes,
      });
    } else {
      await ctx.db.insert("adminPermissions", {
        userId: args.userId,
        clerkId: targetUser.clerkId,
        permissions: args.permissions,
        judgingGroupIds: args.judgingGroupIds,
        allJudgingGroups: args.allJudgingGroups ?? false,
        grantedBy: adminUser._id,
        notes: args.notes,
      });
    }
    await logActivity(ctx, {
      category: "access",
      action: existing ? "access.updated" : "access.granted",
      message: `${existing ? "Updated" : "Granted"} delegated access for ${targetUser.name} (${args.permissions.length} permissions)`,
      targetType: "user",
      targetId: args.userId,
      targetLabel: targetUser.name,
      metadata: { permissions: args.permissions },
    });
    return null;
  },
});

/**
 * Remove a user's delegated access entirely. Full admin only.
 */
export const revokeAccess = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireFullAdmin(ctx);
    const existing = await ctx.db
      .query("adminPermissions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const targetUser = await ctx.db.get(args.userId);
      await logActivity(ctx, {
        category: "access",
        action: "access.revoked",
        message: `Revoked delegated access for ${targetUser?.name ?? "unknown user"}`,
        targetType: "user",
        targetId: args.userId,
        targetLabel: targetUser?.name,
      });
    }
    return null;
  },
});

const grantWithUserValidator = v.object({
  _id: v.id("adminPermissions"),
  _creationTime: v.number(),
  userId: v.id("users"),
  permissions: v.array(v.string()),
  judgingGroupIds: v.array(v.id("judgingGroups")),
  allJudgingGroups: v.boolean(),
  notes: v.optional(v.string()),
  user: v.union(
    v.null(),
    v.object({
      name: v.string(),
      username: v.optional(v.string()),
      email: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
    }),
  ),
  grantedByUser: v.union(
    v.null(),
    v.object({
      name: v.string(),
      username: v.optional(v.string()),
    }),
  ),
  judgingGroups: v.array(
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
    }),
  ),
});

/**
 * List all delegated access grants with user and group details.
 * Full admin only.
 */
export const listGrants = query({
  args: {},
  returns: v.array(grantWithUserValidator),
  handler: async (ctx) => {
    await requireFullAdmin(ctx);
    const grants = await ctx.db.query("adminPermissions").collect();

    return await Promise.all(
      grants.map(async (grant) => {
        const [user, grantedByUser, groups] = await Promise.all([
          ctx.db.get(grant.userId),
          ctx.db.get(grant.grantedBy),
          Promise.all(grant.judgingGroupIds.map((id) => ctx.db.get(id))),
        ]);
        return {
          _id: grant._id,
          _creationTime: grant._creationTime,
          userId: grant.userId,
          permissions: grant.permissions,
          judgingGroupIds: grant.judgingGroupIds,
          allJudgingGroups: grant.allJudgingGroups ?? false,
          notes: grant.notes,
          user: user
            ? {
                name: user.name,
                username: user.username,
                email: user.email,
                imageUrl: user.imageUrl,
              }
            : null,
          grantedByUser: grantedByUser
            ? { name: grantedByUser.name, username: grantedByUser.username }
            : null,
          judgingGroups: groups
            .filter((g): g is Doc<"judgingGroups"> => g !== null)
            .map((g) => ({ _id: g._id, name: g.name, slug: g.slug })),
        };
      }),
    );
  },
});

/**
 * Search users by name for the access grant picker. Full admin only.
 */
export const searchUsersForAccess = query({
  args: { searchTerm: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      username: v.optional(v.string()),
      email: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      hasGrant: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFullAdmin(ctx);
    const term = args.searchTerm.trim();
    if (term.length === 0) return [];

    const matches = await ctx.db
      .query("users")
      .withSearchIndex("search_users", (q) => q.search("name", term))
      .take(10);

    return await Promise.all(
      matches.map(async (user) => {
        const grant = await ctx.db
          .query("adminPermissions")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();
        return {
          _id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          imageUrl: user.imageUrl,
          hasGrant: grant !== null,
        };
      }),
    );
  },
});

/**
 * Minimal judging group list for the access grant picker. Full admin only.
 */
export const listGroupsForAccess = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      isActive: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireFullAdmin(ctx);
    const groups = await ctx.db.query("judgingGroups").collect();
    return groups.map((g) => ({
      _id: g._id,
      name: g.name,
      slug: g.slug,
      isActive: g.isActive,
    }));
  },
});
