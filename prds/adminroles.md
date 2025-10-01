# Admin roles PRD

## Objective
- Introduce two additional roles managed in-app via Clerk: manager and organizer.
- Admin role remains unchanged.
- Managers moderate content, tags, and users.
- Organizers manage only their assigned judging group within the Admin Dashboard Judging surface, with no destructive actions and no visibility into other groups.

## Non-goals
- No migration to Convex Auth; continue using Clerk as the identity source.
- No redesign of existing pages beyond role-gated visibility and scoping.
- No cross-group visibility for organizers.

## Roles and permissions
- Admin: full Admin Dashboard access (existing behavior).
- Manager: access to Content Moderation, Tags, and User Moderation tabs only.
- Organizer: Admin Dashboard shows only a Judging surface scoped to organizer’s assigned group(s). Organizer permissions per assigned group:
  - Edit criteria (questions) for that group
  - Toggle group public/private
  - View public results for that group
  - Use judge tracking for that group
  - Open/copy the judge interface link for that group
  - No delete group capability

## Source of truth (Clerk)
- Use Clerk user `public_metadata` (and forwarded JWT claims) as the single source of truth:
  - `public_metadata.role`: one of `"admin" | "manager" | "organizer"` (omit or different value -> treated as standard user)
  - `public_metadata.organizerGroupIds`: `string[]` of Convex `Id<"judgingGroups">` for organizer’s access scope (typically one id)
- Configure a Clerk JWT template that forwards the above metadata to tokens so Convex functions can authorize using `ctx.auth.getUserIdentity()`.

## Chronological plan (implementation order)
1) Clerk JWT template & claims
   - Create a custom JWT template in Clerk to include:
     - `role: {{ user.public_metadata.role }}`
     - `organizerGroupIds: {{ user.public_metadata.organizerGroupIds }}`
   - Default role is omitted/"user" for regular users.

2) In-app role management UX (primary flow)
   - Add an Admin-only screen in the Admin Dashboard to search users and set:
     - `role` to `admin | manager | organizer`
     - If `organizer`, select one group to assign (writes that group id into `organizerGroupIds`).
   - Provide a button to refresh Clerk sessions/tokens after update so new claims are effective immediately on the client.
   - Add organizer assignment to the Judging Group create/edit flow:
     - Optional organizer selector to assign the group during creation or while editing.
   - All writes use Clerk Backend API to update `public_metadata`.

3) Convex authorization helpers (read Clerk claims only)
   - Centralize helpers in `convex/utils.ts`:
     - `getIdentityOrThrow(ctx)`
     - `requireAdmin(identity)`
     - `requireAdminOrManager(identity)`
     - `requireAdminOrOrganizerForGroup(identity, groupId)` checks `role` and membership in `organizerGroupIds`.
   - Apply guards to relevant queries/mutations:
     - Content moderation, tags, users: admin or manager.
     - Judging group updates and operations: admin or organizer-for-that-group.
     - Destructive group operations: admin only.

4) Organizer visibility constraints
   - Group listing queries:
     - Admin/manager: unrestricted list (as needed for their tabs).
     - Organizer: return only groups where `_id ∈ organizerGroupIds`.
   - All group-targeted mutations verify the caller’s organizer scope for the specific `groupId`.

5) Admin Dashboard scoping (frontend)
   - `AdminDashboard` shows tabs by role:
     - Admin: all tabs.
     - Manager: Moderation, Tags, Users.
     - Organizer: Judging tab only.
   - Judging tab components read the allowed group list for organizer and only mount views for the permitted group(s). Hide delete controls.

6) Auth loading behavior (frontend)
   - Maintain the existing `useConvexAuth` + conditional "skip" query pattern from `clerk-admin-fix.MD` to avoid premature protected calls and "No identity found" errors.

## Files to change (at a high level)
Backend (Convex)
- `convex/utils.ts`: add identity/role helpers.
- `convex/users.ts`: add lightweight role checks, e.g., `checkIsUserManager`, `getMyRole`.
- `convex/judgingGroups.ts`: add `listMineAsOrganizer`, enforce guards on updates/toggles.
- `convex/judgingCriteria.ts`: guard edits with admin or organizer-for-group.
- `convex/judgingGroupSubmissions.ts`: ensure reads are scoped for organizer; tracking reads limited to organizer’s groups.
- `convex/judges.ts`, `convex/judgeScores.ts`: verify organizer-scoped reads where used by organizer UI.

Frontend (React)
- `src/components/admin/AdminDashboard.tsx`: role-based tab visibility; organizer -> Judging only.
- `src/components/admin/Judging.tsx`, `JudgeTracking.tsx`, `JudgingCriteriaEditor.tsx`, `JudgingResultsDashboard.tsx`:
  - Scope to organizer’s allowed group(s).
  - Hide delete actions for organizer.
- New Admin screen for roles (or extend `UserModeration.tsx`): `UserRoles.tsx` to set Clerk `role` and `organizerGroupIds` and trigger token refresh.
- Group create/edit UI: add optional organizer selector.

Docs & ops
- `README.md`: document roles and JWT template setup.
- `clerk-admin-fix.MD`: link the loading/skip guidance to these new guarded views.
- `files.MD` and `changelog.MD`: document new files and role system.

## Acceptance criteria
- Manager can load Admin Dashboard and see only Moderation, Tags, Users tabs; can perform those tasks.
- Organizer can load Admin Dashboard and see only Judging tab scoped to their group; can edit criteria, toggle public/private, view results, track judges, open/copy judge link; cannot delete the group or see other groups.
- Admin can assign roles and organizer group from within the app; claims take effect without requiring manual sign out.

## Testing plan
- Unit tests for Convex guards with mocked identities for admin, manager, organizer, user.
- Integration tests for organizer access to only assigned group.
- UI smoke tests for tab visibility by role.
- Token refresh test after role change to confirm new claims apply to subsequent requests.

## Risks & mitigations
- Large `organizerGroupIds` arrays could bloat JWTs if organizers manage many groups.
  - Mitigation: keep one group per organizer; if needed later, store mapping in Convex and only include `role` in JWT, filtering in queries.
- Stale claims post-update.
  - Mitigation: call Clerk session refresh after updating `public_metadata`.

## Better way (recommendation adopted)
- Primary flow is in-app role assignment using Clerk Backend API. This keeps Clerk as the single source of truth and avoids switching dashboards. Add organizer assignment to judging group create/edit for streamlined ops.

## References
- Clerk docs: https://docs.clerk.com/
- Local guidance: `clerk-admin-fix.MD` (auth loading and query skip pattern)
- Convex TS & validation best practices: https://docs.convex.dev/understanding/best-practices/typescript , https://docs.convex.dev/functions/validation


