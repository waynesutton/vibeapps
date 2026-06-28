# Judging group CSV export

Created: 2026-06-28 22:56 UTC
Last Updated: 2026-06-28 23:10 UTC
Status: Done

## Problem

Admins running a hackathon judging group can see submissions in the dashboard but
have no way to export the submission data for offline review, sponsor handoff, or
prize tracking. They want a per group export button that downloads a CSV of every
submission in that judging group with the custom submit form information.

## Proposed solution

Add an "Export CSV" action to each judging group row in the Judging System list
(`src/components/admin/Judging.tsx`). When clicked it fetches the group's
submissions on demand through a new admin only Convex query and builds a CSV in
the browser, then triggers a download.

The CSV includes the custom submit form fields surfaced on `StoryDetail.tsx`:

- App Title
- App/Project Tagline (short description)
- Description (long description)
- App Website Link (url)
- Video Demo URL
- GitHub, LinkedIn, Twitter/X, Chef Show, Chef App links (Project Links)
- Tags (comma separated names)
- Hackathon Team Info (team name, team member count, members as name/email)
- Submitter name and email
- Submission slug and votes for reference

Images (screenshot and additional images) are intentionally excluded.

## Files to change

- `convex/judgingGroupSubmissions.ts`: add `exportGroupSubmissions` admin query
  returning the flattened submission data (no image URLs) for a group.
- `src/components/admin/Judging.tsx`: add per group Export CSV button that calls
  the query imperatively via `useConvex`, builds the CSV, and downloads it.
- Docs: `changelog.md`, `files.md`, `TASK.MD`.

## Edge cases

- Group with zero valid submissions: show a notification, do not download an empty
  file.
- Stories that are hidden, archived, rejected, or deleted are excluded (reuse
  `isStoryValidForJudging`).
- CSV values containing commas, quotes, or newlines are escaped.
- Team members array serialized safely; missing optional fields render as empty.
- Export must remain admin only (requireAdminRole in the query).

## Verification steps

- `npx tsc -p convex` and app typecheck pass with no new errors.
- ESLint passes on changed files.
- Manual: open Admin > Judging, click Export CSV on a group, confirm the file
  downloads with the expected columns and no image data.

## Task completion log

- 2026-06-28: PRD created.
- 2026-06-28: Added `exportGroupSubmissions` admin query in
  `convex/judgingGroupSubmissions.ts` and per-group Export CSV button + client-side
  CSV builder in `src/components/admin/Judging.tsx`. Lint clean; new code passes
  typecheck (remaining tsc errors are pre-existing unused-import warnings in
  unrelated files). Docs updated (changelog, files.md, TASK.MD).
