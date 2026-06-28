# Judging: Required-Tag Submissions

Created: 2026-06-28 22:40 UTC
Last Updated: 2026-06-28 22:40 UTC
Status: Done

## Problem

A judging group could only count and judge submissions that were explicitly added to the group: either added by an admin or submitted through the group's custom submission page (which auto-adds the story). Stories that carried the group's required tag but were created another way (normal submit form, imported, or edited later to add the tag) never appeared in the judging interface and were not counted. Admins wanted: any submission carrying the required tag should be judged and counted, regardless of how it was created.

## Root Cause

The judging interface, scoring, status tracking, multi-judge completion, and submission counts all read from the `judgingGroupSubmissions` join table plus the `submissionStatuses` table. Only the custom submission page and the admin "add submissions" flow wrote rows there. Nothing connected the group's `submissionFormRequiredTagId` to story tags outside the custom form, so tag-matched stories were invisible to judging.

## Solution

Materialize any valid story that carries a group's `submissionFormRequiredTagId` into the same `judgingGroupSubmissions` + `submissionStatuses` tables the custom form uses. This makes tag-matched submissions behave identically to form submissions and work with every existing judging feature.

Three entry points keep the data in sync:

1. Reverse sync on story tag edits. When a story's tags change (user edit, admin edit, or admin bulk tag add), the story is auto-included in any group whose required tag is now present.
2. Forward sync on group change. When an admin sets or changes a group's required tag, existing stories that already carry that tag are backfilled.
3. Manual sync button. An admin "Sync existing submissions with this tag" button on the group settings modal backfills on demand (e.g. right after deploy).

All inclusion goes through one idempotent helper so duplicates are never created and existing scores/statuses are preserved.

## Files Changed

- `convex/judgingGroupSubmissions.ts`
  - `ensureStoryInGroup` helper: idempotent insert of the join row + pending status.
  - `syncStoryToTaggedGroups` helper: include a story in every group whose required tag it now carries.
  - `syncRequiredTagSubmissions` admin mutation: scan stories and backfill by the group's saved required tag.
  - `addSubmissions` refactored to reuse `ensureStoryInGroup`.
- `convex/stories.ts`
  - `updateOwnStory`, `updateStoryAdmin`, `addTagsToStory` call `syncStoryToTaggedGroups` after tag changes.
- `convex/judgingGroups.ts`
  - `updateGroup` backfills tag-matched stories when the required tag is newly set or changed.
- `src/components/admin/EditJudgingGroupModal.tsx`
  - "Sync existing submissions with this tag" button + result message; clarifying helper text.

## Edge Cases

- Idempotent: re-running any sync never duplicates rows; already-present submissions are skipped.
- Removing the tag later does not auto-remove the submission (preserves scores/statuses); admins remove manually.
- Invalid stories (deleted, hidden, archived, rejected) are excluded, consistent with all other judging queries.
- Single-judge and multi-judge groups behave the same; included submissions start as `pending` and flow through the normal scoring/completion path.
- The manual sync uses the group's saved tag, so the admin must save a new tag selection before syncing (auto-sync in `updateGroup` already covers the change-on-save case).

## Verification

- Set a required tag on a group, save: existing tag-matched stories appear in judging and the submission count increases.
- Edit a story (as owner or admin) to add the required tag: it appears in the judging interface as pending.
- Admin bulk-adds the tag via Content Moderation: same result.
- Re-run the sync button: reports 0 added, N already included (idempotent).
- `npx convex codegen` typecheck clean (exit 0); no new lint errors in changed files.

## Task Log

- 2026-06-28 22:40 UTC: Backend helpers + mutation (judgingGroupSubmissions.ts), story tag-edit hooks (stories.ts), updateGroup backfill (judgingGroups.ts), modal sync button (EditJudgingGroupModal.tsx). Codegen typecheck clean.
