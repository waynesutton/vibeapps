# Judging group activity log and realtime review counts

Created: 2026-08-13 07:05 UTC
Last Updated: 2026-08-13 07:25 UTC
Status: Done

## Problem

Two related gaps in the judging group workspace:

1. When an admin removes a submission from a judging group, its human judge
   scores are deleted but its `aiJudgeResults` row is not. AI results pages,
   counts, and rankings keep showing a submission that is no longer in the
   group. Human numbers stay correct only because scores are deleted.
2. There is no per-group audit trail. Nothing records when a submission was
   added or removed, when an AI review ran or completed, or that a removed
   submission had already been reviewed. The site-wide Activity Log exists
   but cannot be filtered to one judging group.

## Root cause

- `judgingGroupSubmissions.removeSubmission` cleans up scores, statuses,
  notes, and completions but never touches `aiJudgeResults`.
- The `activityLog` table has no `groupId` field or index, so group-scoped
  events cannot be queried per group. Group events (submission add/remove,
  AI run lifecycle) are not logged at all.

## Proposed solution

Realtime counts need no polling. Convex queries are reactive, so the fix is
to make removal delete the stale rows. Every dashboard that subscribes to
`getGroupAiResults`, results queries, or `getGroupWithDetails` updates the
moment the mutation commits.

1. Removal cleanup: `removeSubmission` also deletes `aiJudgeResults` rows
   for the (groupId, storyId) pair using the existing `by_groupId_storyId`
   index. `saveResult` already early-returns when the row is gone, so
   deleting mid-run is safe.
2. Shared log, group scoped: add optional `groupId` to `activityLog` plus a
   `by_groupId` index. Per-group entries live in the same table as the
   site-wide Activity Log, so the two stay in sync by construction.
3. New log events (all carry `groupId`, story title, story slug metadata):
   - `judging.submissionAdded` in `ensureStoryInGroup` (covers manual add,
     tag sync, auto-include, and group submit page) and the inline auto-add
     path in `stories.submit` (swapped to use `ensureStoryInGroup`).
   - `judging.submissionRemoved` in `removeSubmission`, recording how many
     human scores were deleted and whether an AI review existed (and its
     status) at removal time.
   - `judging.aiRunStarted` in `aiJudge.startReview` with the queued count.
   - `judging.aiRetryQueued` in `aiJudge.retrySubmission`.
   - `judging.aiReviewCompleted` / `judging.aiReviewFailed` in
     `aiJudge.saveResult` with actor "AI Judge".
   - Existing group create/update/delete and score.submitted calls gain the
     top-level `groupId` so they appear in the per-group view too.
4. Backend queries in `convex/activityLog.ts`:
   - `listGroupActivity` paginated by `by_groupId`, newest first, gated by
     `requireJudgingGroupPermission(ctx, groupId, "judging.view")`.
   - `exportGroupActivity` capped rows for CSV and markdown export, same
     view permission.
   - `clearGroupActivity` batched delete, gated by `judging.manage`.
5. Frontend `GroupActivitySection.tsx`, new sidebar item "Activity" below
   Judge tracking in the group workspace:
   - Most recent entries with actor, category badge, message, timestamp,
     and a link to the submission when the entry has a story slug.
   - Page size dropdown 30 / 60 / 100 plus a Load more button.
   - Export CSV and Save as .md buttons building an audit file client side.
   - Clear log with an in-design two-step confirm (judging.manage only),
     noting entries are also removed from the site-wide activity log.

## Files to change

- `convex/schema.ts`: `groupId` field + `by_groupId` index on `activityLog`.
- `convex/activityLog.ts`: input type, insert, validator, three new
  group-scoped functions.
- `convex/judgingGroupSubmissions.ts`: logging in `ensureStoryInGroup`,
  AI-results cleanup + logging in `removeSubmission`.
- `convex/stories.ts`: auto-add path swapped to `ensureStoryInGroup`.
- `convex/aiJudge.ts`: run start, retry, and completion logging.
- `convex/judgingGroups.ts`, `convex/judgeScores.ts`: pass `groupId`.
- `src/components/admin/judging/GroupActivitySection.tsx`: new section.
- `src/pages/AdminJudgingGroupPage.tsx`: sidebar entry + render.
- `src/components/admin/AdminDocs.tsx`: document the section.
- `task.md`, `changelog.md`, `files.md`.

## Edge cases

- Removal while an AI review is running: result row deleted; the workpool
  action later calls `saveResult`, which finds no row and returns null.
- Re-adding a removed submission: it returns with no AI result; the next
  run re-reviews it (documented behavior).
- Activity log paused from the admin toolbar: group events are dropped too
  (same `logActivity` path); acceptable and documented.
- Bulk tag sync adds many stories: one entry per newly added story; syncs
  that add nothing log nothing.
- Clearing a group log deletes those rows from the site-wide log as well;
  the confirm text says so and export buttons sit next to Clear.
- Older global entries without `groupId` never show in the group view.

## Verification steps

1. `npx convex dev` pushes schema + functions cleanly (watch terminal 1).
2. Remove a reviewed submission from a group: AI results counts drop
   immediately, results dashboards re-rank, log shows the removal entry
   with score/AI context.
3. Add a submission (manual and via tag sync): entries appear in both the
   group Activity section and the admin Activity tab.
4. Run AI review: run-started entry plus one completed/failed entry per
   submission, actor "AI Judge".
5. Page size dropdown and Load more paginate; export downloads CSV and md;
   Clear requires confirm and empties the group view.
6. A delegated user with judging.view sees the log; without judging.manage
   the Clear button is hidden.

## Task completion log

- 2026-08-13 07:05 UTC: PRD written after code exploration.
- 2026-08-13 07:15 UTC: Backend done: schema groupId + by_groupId index, logActivity groupId, submission add/remove logging, AI results cleanup on removal, AI run lifecycle logging, three group-scoped log functions. Convex push green with index added.
- 2026-08-13 07:25 UTC: Frontend GroupActivitySection wired into the workspace sidebar, Admin Docs and project docs updated. Zero lints; app tsc errors all pre-existing.
