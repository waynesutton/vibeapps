# Search and add submissions inside the judging group workspace

Created: 2026-08-09 09:50 UTC
Last Updated: 2026-08-09 09:55 UTC
Status: Done

## Problem

Admins can only add a specific submission to a judging group from Content Moderation (select stories, pick a group). Inside the group workspace's Submissions section there is no way to search the whole site and add a single submission directly. Judging admins who have `judging.manage` for a group but not `moderation.view` cannot add one-off submissions at all.

## Root cause

The Submissions section only covers bulk sources: auto-include tags, required-tag sync, and CSV export. The `addSubmissions` mutation already exists and handles dedupe, but nothing in the workspace calls it with hand-picked stories, and there is no story search query gated by judging permissions.

## Proposed solution

Backend (`convex/judgingGroupSubmissions.ts`):

- New `searchStoriesForGroup` query: takes `groupId` + `searchTerm`, requires `requireJudgingGroupPermission(ctx, groupId, "judging.manage")`, searches the `stories.search_all` index on title (take 15), filters out stories invalid for judging (hidden, archived, rejected), and returns minimal fields (`_id`, `title`, `slug`, `status`, `_creationTime`) plus an `inGroup` flag from the `by_groupId_storyId` index.

Frontend (`src/components/admin/judging/GroupSubmissionsSection.tsx`):

- New "Add submissions" card above Auto-include: search input, live result list, per-row Add button calling the existing `addSubmissions` mutation with one story id. Rows already in the group show "In group" instead of a button. Copy explains added submissions flow into both regular judging and AI judge runs.

No new mutation needed; `addSubmissions` already dedupes, creates the pending status, and is permission gated.

## Files to change

- `convex/judgingGroupSubmissions.ts` (new query)
- `src/components/admin/judging/GroupSubmissionsSection.tsx` (new card)
- `src/components/admin/AdminDocs.tsx` (mention manual add)

## Edge cases

- Search term under 2 characters: skip the query, show hint text.
- Story already in group: flagged by the query and reflected instantly after adding (reactive).
- Hidden/archived/rejected stories: excluded by the same `isStoryValidForJudging` rules used everywhere else.
- Pending (unapproved) stories: allowed, same as the moderation flow, since judging is independent of public approval.

## Verification steps

- Convex typecheck and app tsc pass; zero lints on touched files.
- Searching shows matching stories; Add moves a row to "In group"; the submission then appears in judge queues and AI judge runs (both read `judgingGroupSubmissions`).

## Task completion log

- 2026-08-09 09:50 UTC: PRD created.
- 2026-08-09 09:55 UTC: Implemented and verified. New searchStoriesForGroup query (judging.manage gated, search_all title index, take 15, invalid-for-judging stories excluded, inGroup flag). New Add submissions card at the top of the workspace Submissions section with live search and per-row Add via the existing addSubmissions mutation. AdminDocs manual add section updated. Convex typecheck + app tsc clean, zero lints.
