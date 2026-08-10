# Admin access permissions, judging delegation, and docs

Created: 2026-08-07 16:00 UTC
Last Updated: 2026-08-07 16:00 UTC
Status: In Progress

## Problem

Admin access is all or nothing. The only role is Clerk JWT `role === "admin"` checked by `requireAdminRole` in `convex/users.ts`. There is no way to give an existing user access to a subset of admin sections (moderation, tags, forms, etc.) or to delegate the judging features for one or more judging groups to an organizer. There is also no in-app documentation for how the judging system works.

## Root cause

Every admin function calls `requireAdminRole(ctx)` which only reads the Clerk token claim. No permission storage exists in Convex, and the frontend gates the whole dashboard on `checkIsUserAdmin`.

## Proposed solution

1. New `adminPermissions` table in Convex storing per-user grants:
   - `permissions`: array of permission keys (section plus action, e.g. `tags.manage`)
   - `judgingGroupIds` plus optional `allJudgingGroups` for scoped judging access
   - `grantedBy`, `notes` for audit trail
2. New `convex/adminAccess.ts` module:
   - `getAccessContext(ctx)`: full admins (JWT role) bypass everything; otherwise loads grant by clerkId
   - `requirePermission(ctx, key)` and `requireJudgingGroupPermission(ctx, groupId, key)`
   - `getMyAdminAccess` public query for frontend gating
   - Admin-only CRUD: `grantAccess`, `updateAccess`, `revokeAccess`, `listGrants`
3. Swap `requireAdminRole` for permission-aware guards across delegated surfaces (tags, moderation, forms, users, reports, settings, emails, numbers, and all judging files). Judging list queries filter to allowed groups for non-admins.
4. Frontend: `AdminDashboard` gates on `getMyAdminAccess`, renders only permitted tabs, and provides an access context so components hide actions the user lacks. New Access tab (full admins only) with user search, section permission cards, judging group multi-select, and a grants list. New Docs tab documenting all judging features.

## Permission keys

- Moderation: `moderation.view`, `moderation.moderate`, `moderation.delete`
- Tags: `tags.view`, `tags.manage`, `tags.delete`
- Forms: `forms.view`, `forms.manage`, `forms.results`, `forms.delete`
- Judging (group scoped): `judging.view`, `judging.manage`, `judging.results`, `judging.tracking`, `judging.ai`, `judging.delete`
- Numbers: `numbers.view`
- Users: `users.view`, `users.moderate`, `users.reports`, `users.delete`
- Emails: `emails.view`, `emails.send`
- Settings: `settings.view`, `settings.manage`
- Access management: full admin only, never delegatable

## Files to change

Backend
- `convex/schema.ts`: add `adminPermissions` table
- `convex/adminAccess.ts`: new module (helpers, query, CRUD)
- `convex/tags.ts`, `convex/stories.ts`, `convex/comments.ts`, `convex/storyFormFields.ts`, `convex/forms.ts`, `convex/users.ts`, `convex/reports.ts`, `convex/userReports.ts`, `convex/settings.ts`, `convex/emails/*`, `convex/adminQueries.ts`: permission guards
- `convex/judgingGroups.ts`, `convex/judgingCriteria.ts`, `convex/judgingGroupSubmissions.ts`, `convex/judgeScores.ts`, `convex/adminJudgeTracking.ts`, `convex/aiJudge.ts`, `convex/agentJudges.ts`: group-scoped guards plus list filtering

Frontend
- `src/components/admin/AdminDashboard.tsx`: new gate, tab visibility, access context
- `src/components/admin/AccessManagement.tsx`: new Access tab
- `src/components/admin/AdminDocs.tsx`: new Docs tab
- `src/components/admin/Judging.tsx` and children: group scoping, hide actions per permission
- `src/pages/JudgeTrackingPage.tsx`, `src/components/admin/FormBuilder.tsx`, `src/components/admin/FormResults.tsx`: updated gates

## Edge cases

- Full admins keep the JWT check first; zero behavior change for them
- Revocation is instant since checks read the DB per request
- A user with a grant but zero permissions is treated as no access
- Judging group deletion removes the group id from grants lazily (ids that no longer resolve are ignored)
- Public judge/results/session functions remain untouched
- Access tab, Emails, and Settings are never visible unless granted; Access management itself is admin-only

## AI judge GitHub verification (no code change)

Verified `convex/aiJudgeAnalysis.ts` reads GitHub repos via the authenticated REST API: repo metadata, full file tree, package.json, README, up to 60 Convex source files (40 into the prompt), up to 300 commits, `GITHUB_TOKEN` required, rate limit retry. Limits documented in the new Docs tab: public GitHub repos only, Convex-centric file selection, 8k chars per file, 180k total prompt cap.

## Verification steps

1. `npx convex dev --once` compiles and pushes schema plus functions
2. `npx tsc --noEmit` (app tsconfig) passes
3. Admin user sees all tabs including Access and Docs
4. Grant a test user `tags.view` plus `tags.manage`: they see only Tags (and Docs is hidden without judging access), can create and edit tags but the delete flow is denied
5. Grant a test user `judging.view/manage/results/tracking` for one group: they see only that group, cannot delete it, cannot run AI review
6. Revoke the grant: the user gets a 404 on /admin immediately

## Task completion log

- 2026-08-07 16:00 UTC: PRD created, implementation started
