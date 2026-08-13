# Editable judging group URL slug

Created: 2026-08-13 08:03 UTC
Last Updated: 2026-08-13 08:10 UTC
Status: Done

## Problem

Once a judging group exists, its URL slug is frozen. Admins can rename the
group but cannot change `/judging/{slug}`. The slug drives every public page,
the custom submit form, results, AI results, the admin workspace, and the
Agent API. A typo or a rebrand means creating a new group or living with a
bad URL.

## Root cause

`createGroup` generates a unique slug from the name. `updateGroup` never
accepts `slug`. The workspace header shows `/judging/{slug}` as read-only
text. Admin Docs mention slug under Settings, but Settings has no slug field.

## Proposed solution

1. Dedicated `updateGroupSlug` mutation. It sanitizes the input the same way
   create does (lowercase, letters, numbers, hyphens), enforces uniqueness
   via `by_slug`, is a no-op when the slug is unchanged, patches the group,
   and logs `judgingGroup.slugChanged` with old and new values.
2. No stored redirects. Lookups are by current slug, so public pages, submit
   links, results, AI results, admin URLs, and Agent API follow the new slug
   immediately. Old URLs 404. That is the reason for the warning.
3. New delegated permission `judging.slug` (destructive). Full Clerk admins
   bypass it. Delegated users with `judging.manage` do not get slug edits
   unless this key is granted. Shown in Access Management next to
   `judging.delete`.
4. Pencil icon next to the header slug on `/admin/judging/:slug`. Opens a
   site-design dialog (not a browser confirm) with a slug input, live
   preview, and a warning that old judging, submit, results, AI results,
   admin, and Agent API links stop working, including emails already sent.
   After save, replace-navigate to `/admin/judging/{newSlug}` keeping
   `?section=`.
5. Settings shows the current slug and the same editor when the caller has
   `judging.slug`.

## Files to change

- `convex/adminAccess.ts`: add `judging.slug` to `PERMISSION_KEYS`
- `convex/judgingGroups.ts`: add `updateGroupSlug`
- `src/components/admin/AccessManagement.tsx`: Judging key + destructive
- `src/components/admin/judging/GroupSlugEditor.tsx`: new dialog + pencil
- `src/pages/AdminJudgingGroupPage.tsx`: header edit icon
- `src/components/admin/judging/GroupSettingsSection.tsx`: slug row
- `src/components/admin/AdminDocs.tsx`: Settings, Access, Delegated access

## Edge cases

- Collision with another group's slug: mutation throws a clear error.
- Empty or invalid input after sanitize: reject (min 2, max 80 chars).
- Same slug as current: early return, no patch.
- Delegated user with `judging.manage` but not `judging.slug`: no icon,
  mutation throws `Permission required: judging.slug`.
- Emails already sent still contain the old URL. Warning copy covers this.
  New emails use `judgingGroupUrls(group.slug)` so they pick up the new one.
- Links ledger is reactive on `group.slug`; no extra wiring.
- Admin page would 404 if we did not navigate after save.

## Verification steps

1. Full admin: pencil appears next to `/judging/{slug}`. Change slug.
   Confirm `/judging/{new}`, `/submit`, `/results`, `/ai-results`, Links
   ledger, and Agent API paths use the new slug. Old slug 404s.
2. Uniqueness: trying another group's slug shows an error and does not save.
3. Delegated user with `judging.manage` only: no pencil, mutation denied.
4. Grant `judging.slug` in Access: pencil appears, change works, workspace
   stays on the same section.
5. Dialog warning is visible before confirm. Escape and overlay click cancel.
6. `npx convex tsc` and lints on touched files.

## Task completion log

- 2026-08-13 08:03 UTC: PRD drafted.
- 2026-08-13 08:10 UTC: Shipped. `judging.slug` permission, `updateGroupSlug` mutation, header pencil + Settings editor with warning dialog, Access Management key, Admin Docs. Verified: convex codegen TypeScript green, convex tsc via codegen exit 0, eslint 0 errors on touched files (6 pre-existing warnings in judgingGroups.ts).
