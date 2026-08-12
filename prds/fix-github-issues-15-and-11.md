# Fix GitHub issues 15 and 11

Created: 2026-08-12 18:44 UTC
Last Updated: 2026-08-12 18:44 UTC
Status: Done

## Problem

Two open GitHub issues reported bugs that were still live in the codebase.

**Issue 15: getUserProfileByUsername leaks moderation data and shows rejected stories**

The reported ReturnsValidationError crash was already patched (the spam fields fix on 2026-08-11 added `rejectionReason` to `baseStoryValidator`), but the underlying problems remained:

- `updateStatus` in `convex/stories.ts` set `status: "rejected"` without clearing the denormalized `isApproved` flag. The public profile query reads the `by_userId_isApproved` index with `isApproved: true` and never checked `status` or `isHidden`, so approved-then-rejected and hidden stories still appeared on public profiles.
- The handler spread the raw story doc (`...storyDoc`) into a public, unauthenticated query response, sending the submitter's `email`, `rejectionReason`, `customMessage`, spam moderation fields, team member emails, and the edit `changeLog` to any client.

**Issue 11: removing the last name from a profile reverts on refresh**

A prior workaround omitted `lastName` from the Clerk update when empty, which made the failure silent instead of fixing it. Clerk kept the stale last name, and two sync paths rebuilt `name` from Clerk data and overwrote the user's edit:

- `ensureUser` (runs on every page load via `UserSyncer`) rebuilds `name` from `identity.givenName + identity.familyName`.
- `syncUserFromClerkWebhook` does the same on any Clerk `user.updated` webhook.

## Root cause

- Issue 15: `isApproved` is a denormalized flag set at insert and never kept in sync by moderation, and the profile query trusted it alone while also spreading the full document.
- Issue 11: Clerk was treated as the source of truth for `name`, so any in-app name edit that Clerk did not accept (empty last name) was clobbered on the next sync.

## Solution

**Issue 15** (`convex/users.ts`, `convex/stories.ts`):

- Filter fetched profile stories to `status === "approved" && !isHidden` in TypeScript after the index read; `status` is the source of truth.
- Destructure the story doc and drop `rejectionReason`, `email`, `customMessage`, `spamReason`, `spamMarkedAt`, `spamMarkedBy`, `changeLog`, and `teamMembers` before returning. All are optional in `storyWithDetailsValidator`, so validation passes, and the profile UI uses none of them.
- `updateStatus` now sets `isApproved: args.status === "approved"` so the index stays truthful going forward. No data migration needed; the read-time filter covers old rows.

**Issue 11** (`convex/schema.ts`, `convex/users.ts`, `src/pages/UserProfilePage.tsx`):

- New optional `nameCustomized` boolean on the users table.
- `updateProfileDetails` sets `nameCustomized: true` when the saved name differs from the stored one.
- `ensureUser` and `syncUserFromClerkWebhook` skip the Clerk name sync when `nameCustomized` is true. Email, image, username, and role sync are unchanged.
- The profile page sends `lastName` to Clerk even when empty so Clerk clears it when the instance allows optional last names. If Clerk rejects it, the Convex name still wins because sync no longer overwrites it.

## Files changed

- `convex/users.ts`: profile story filter + sensitive field strip, `nameCustomized` guards in `ensureUser` and `syncUserFromClerkWebhook`, flag set in `updateProfileDetails`.
- `convex/stories.ts`: `updateStatus` keeps `isApproved` in sync with `status`.
- `convex/schema.ts`: `nameCustomized: v.optional(v.boolean())` on users.
- `src/pages/UserProfilePage.tsx`: always send `lastName` (including empty) in the Clerk update.

## Edge cases

- Old rejected stories with `isApproved: true`: handled by the read-time status filter.
- Users who never edit their name in-app: `nameCustomized` stays unset, Clerk sync behaves exactly as before.
- Saving the profile without changing the name: flag not set, since the frontend sends `name` on any field change.
- Clerk instances that require a last name: the Clerk update fails and is caught; the in-app name persists regardless.
- `teamName` and `teamMemberCount` stay public; only `teamMembers` (contains emails) is stripped.

## Verification

- `npx eslint` on the four changed files: 0 errors (66 pre-existing warnings, none from new code).
- `npx tsc --noEmit`: no new errors (all reported errors pre-existing unused-import issues in untouched lines).
- `npm run build`: passes.
- `npx convex dev --once`: schema and functions deployed green.
- Live dev check: `users:getUserProfileByUsername` returns only approved, non-hidden stories with none of the eight sensitive fields present.

## Task completion log

- 2026-08-12 18:20 UTC: Impact check across app; confirmed only `UserProfilePage` consumes the profile query and only `convex/users.ts` writes `users.name`.
- 2026-08-12 18:30 UTC: Issue 15 fixes implemented and issue 11 fixes implemented.
- 2026-08-12 18:43 UTC: Lint, typecheck, build, Convex dev push, and live query verification all green.
