# Admin judging UI redesign

Created: 2026-08-08 08:43 UTC
Last Updated: 2026-08-08 09:00 UTC
Status: Done

## Problem

The Judging tab in the admin dashboard packs every action for every group into one wide table row (settings modal, criteria, results, AI results, tracking, export, delete). The edit modal is a single 2,000 line form covering ten unrelated concerns. Spacing across the admin shell is loose. Managing one judging group means hunting through a modal instead of working in a dedicated space.

## Proposed solution

Split the judging admin into two levels, inspired by the Vercel docs layout and Linear-style lists:

1. Judging tab (`/admin?tab=judging`): a compact list of judging groups. Each row is one click into the group workspace. A slim stat line replaces the four stat cards. Create Judging Group stays as a modal.
2. Group workspace (`/admin/judging/:slug`): a full-page docs-style UI with a sticky left sidebar and a `?section=` query param for deep links. Sections:
   - Overview: stats, quick links with copy buttons, status at a glance
   - Settings: name, description, active status, judges per submission, danger zone (delete)
   - Access: judge access, submission page access, results visibility (password handling identical to the old modal: blank keeps the existing password)
   - Criteria: embeds `JudgingCriteriaEditor`
   - Submissions: auto-include tags/date range config, sync actions, CSV export
   - Submit page: custom submission page toggle, branding, links, required tag plus sync, required fields, header image upload
   - Results: embeds `JudgingResultsDashboard` (permission `judging.results`)
   - Judge tracking: embeds `JudgeTracking` (permission `judging.tracking`)
   - AI judge: enable toggle, AI results visibility, event window, rubric weights, agent keys
   - AI results: embeds `AIJudgeResults` (permission `judging.ai`, only when AI enabled)

Each settings section saves independently through the existing `updateGroup` partial-update mutation. Sidebar items are hidden when the caller lacks the mapped permission; the backend guards remain the source of truth.

`EditJudgingGroupModal` stays in the repo but is no longer referenced (the standalone tracking route also stays for backward compatibility).

## Files to change

- New `src/components/admin/judging/groupSection.tsx`: shared helpers (field defs, rubric defs, date helpers, SectionShell/SaveBar UI, GroupDetails type)
- New `src/components/admin/judging/GroupOverviewSection.tsx`
- New `src/components/admin/judging/GroupSettingsSection.tsx`
- New `src/components/admin/judging/GroupAccessSection.tsx`
- New `src/components/admin/judging/GroupSubmissionsSection.tsx`
- New `src/components/admin/judging/GroupSubmitPageSection.tsx`
- New `src/components/admin/judging/GroupAiSection.tsx`
- New `src/pages/AdminJudgingGroupPage.tsx`
- Edit `src/App.tsx`: add `/admin/judging/:slug` route
- Edit `src/components/admin/Judging.tsx`: compact list linking to group pages
- Edit `src/components/admin/AdminDashboard.tsx`: tighter spacing
- Docs: `TASK.MD`, `changelog.MD`, `files.MD`

## Edge cases

- Delegated admins scoped to specific groups: backend returns null for out-of-scope groups; page shows 404
- Delegated admins with `judging.view` only: sidebar shows Overview only; no save controls
- Passwords are never displayed; blank input keeps the stored password; making the submit page public clears its password (matches the visible toggle semantics)
- Private results require a password (existing or new) before saving, same rule as the old modal
- Deleting a group returns the user to `/admin?tab=judging`
- Unknown or unauthorized `?section=` values fall back to Overview

## Verification steps

- `npx tsc --noEmit` passes for the app config
- Lint clean on all touched files
- Judging tab lists groups, create modal works, row click opens `/admin/judging/:slug`
- Each section saves and reflects Convex state reactively
- Deep links `/admin/judging/:slug?section=criteria` land on the right panel

## Task completion log

- 2026-08-08 08:43 UTC: PRD created, implementation started
- 2026-08-08 08:50 UTC: Shared section utilities and all six group section panels built (overview, settings, access, submissions, submit page, AI)
- 2026-08-08 08:53 UTC: AdminJudgingGroupPage with permission-gated sticky sidebar and `?section=` deep links; `/admin/judging/:slug` route added; Judging.tsx rewritten as compact list
- 2026-08-08 08:57 UTC: AdminDashboard spacing tightened (page padding, header, tab bar, sub-tabs)
- 2026-08-08 09:00 UTC: Verified. tsc clean for all touched files (remaining project errors pre-existing), no linter errors. Docs synced: TASK.MD, changelog.md, files.md
