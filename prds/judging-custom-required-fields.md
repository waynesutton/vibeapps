# Judging custom submission page: admin-selectable required fields

Created: 2026-06-28 02:52 UTC
Last Updated: 2026-06-28 02:55 UTC
Status: Done

## Problem

The Judging System Custom Submission Page (`/judging/:slug/submit`) renders a fixed
submission form in `src/pages/JudgingGroupSubmitPage.tsx`. The required state of each
field is hardcoded (App Title, Tagline, URL, Screenshot, Your Name, Tags are required,
the rest optional). Admins cannot control which fields are required per judging group.

## Proposed solution

Add a per-group `submissionFieldRequirements` object to the `judgingGroups` table that
stores an optional boolean for each configurable submission field. Admins toggle these in
`EditJudgingGroupModal.tsx` under the Custom Submission Page section. The public submission
page reads the value and applies `required` dynamically, falling back to the existing
defaults when unset (so existing groups keep current behavior).

Configurable fields and current defaults:

- title (App Title): required
- tagline (App/Project Tagline): required
- longDescription (Description): optional
- url (App Website Link): required
- githubUrl (GitHub Repo URL): optional
- videoUrl (Video Demo): optional
- screenshot (Screenshot or Image): required
- submitterName (Your Name): required
- email (Email): optional
- tags (Tags): required

## Files to change

- `convex/schema.ts`: add `submissionFieldRequirements` to `judgingGroups`.
- `convex/judgingGroups.ts`: accept it in `updateGroup`, return it in
  `getGroupWithDetails` and `getSubmissionPage`.
- `src/components/admin/EditJudgingGroupModal.tsx`: add checkbox controls + state + save.
- `src/pages/JudgingGroupSubmitPage.tsx`: apply dynamic required + asterisks + tags guard.

## Edge cases

- Existing groups have no value: use defaults.
- Backend `stories.submit` keeps `title`/`tagline`/`url` as `v.string()`; empty strings
  still validate, so making them optional in UI does not break the mutation.
- Tags requirement is enforced in UI via a JS guard (HTML required cannot target the
  custom tag selector).

## Verification steps

- `npx tsc --noEmit` passes.
- Admin can toggle field requirements and save.
- Public page reflects required/optional state (asterisks + validation).

## Task completion log

- 2026-06-28 02:52 UTC: PRD created, implementation started.
- 2026-06-28 02:55 UTC: Schema, backend (updateGroup/getGroupWithDetails/getSubmissionPage),
  EditJudgingGroupModal checkboxes, and JudgingGroupSubmitPage dynamic required state
  implemented. `npx tsc --noEmit` passes; Convex dev server healthy.
