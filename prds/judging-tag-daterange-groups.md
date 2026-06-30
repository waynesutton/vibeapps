# Judging Groups: multi-tag and date range auto-population

Created: 2026-06-30 00:11 UTC
Last Updated: 2026-06-30 17:40 UTC
Status: Done

## Problem

Admins can only auto-populate a judging group from a single required tag
(`submissionFormRequiredTagId`), which is tied to the custom submission form. There
is no way to build a group from multiple tags or to scope it to a date range so an
admin can judge past or new submissions that match any of several tags within a
window of time.

## Goal

Let an admin configure a judging group to auto-include submissions that:

- carry ANY of multiple selected tags (OR matching, so a submission with one or both
  tags qualifies), AND
- were originally submitted within an optional date range (based on the story
  creation time).

Matching submissions are materialized into the existing
`judgingGroupSubmissions` + `submissionStatuses` tables so the existing judging
interface, scoring, multi-judge flow, and results pages work unchanged.

## Design decisions

- Additive: keep the existing single required-tag form feature untouched. Add a new,
  separate "Auto-populate by tags and date range" configuration.
- New schema fields on `judgingGroups`:
  - `autoIncludeTagIds: optional array of tag ids` (OR match)
  - `autoIncludeStartDate: optional number` (ms epoch, inclusive)
  - `autoIncludeEndDate: optional number` (ms epoch, inclusive)
- Reuse the established materialization helpers (`ensureStoryInGroup`) so all data is
  idempotent and compatible with scoring, statuses, and multi-judge completion.
- Matching is AND between the tag filter and the date filter; OR within tags.
- Date range filters on `story._creationTime` (original submission time).
- No auto-removal. Narrowing tags or dates never deletes existing submissions or
  their scores, matching the existing required-tag behavior.
- Do not reuse the existing `startDate`/`endDate` group fields. Those represent the
  judging period shown on the public group page, a different concept.

## Files to change

- `convex/schema.ts`: add the three new optional fields to `judgingGroups`.
- `convex/judgingGroupSubmissions.ts`:
  - `storyMatchesAutoInclude` helper (tag OR + date range).
  - extend `syncStoryToTaggedGroups` to also include stories matching a group's
    auto-include config (so new and edited submissions auto-add).
  - `syncAutoIncludeSubmissions` admin mutation: scan stories and backfill matches.
- `convex/judgingGroups.ts`:
  - `updateGroup`: accept the new args (nullable to clear), and backfill matching
    stories when the auto-include config is set or changed.
  - `getGroupWithDetails`: return the new fields so the modal can load them.
- `src/components/admin/EditJudgingGroupModal.tsx`: new section with a multi-tag
  checkbox selector, start/end date inputs, and a "Sync matching submissions" button.

## Edge cases

- No tags selected: auto-include is inactive (nothing is added), even if dates set.
- Only start date or only end date set: open-ended range on the missing side.
- Past-only group: set end date in the past so new submissions do not match.
- Ongoing group: leave end date empty so new submissions keep auto-adding.
- Tag removed from a story later: existing inclusion and scores are preserved.

## Verification steps

- `npx tsc -p tsconfig.app.json --noEmit` passes.
- Convex typecheck via dev (or `npx convex dev` push) succeeds.
- Configure a group with two tags + date range, click sync, confirm matching
  submissions appear in the judging interface and counts update.
- Submit a new story carrying a selected tag within the range and confirm it
  auto-appears in the group.
- Results page shows completed submissions from the auto-included set.

## Follow-up: searchable tags + match-all mode (2026-06-30)

- Problem: tag list can have 1000s of tags, so a flat checkbox grid is unusable;
  admins also needed to require multiple specific tags, not just any.
- Added `autoIncludeMatchMode: "any" | "all"` on `judgingGroups` (defaults to "any"
  for backward compatibility). "all" requires every selected tag (AND); "any" keeps
  the original OR behavior.
- `storyMatchesAutoInclude` and the `updateGroup` inline backfill now branch on the
  mode (`.every()` vs `.some()`). Validators and `getGroupWithDetails` updated.
- Modal: replaced the full checkbox grid with a searchable selector (filter by name,
  capped to first 50 results), removable selected-tag chips that stay visible even
  when filtered out, and a "Tag match rule" dropdown for any/all.

## Task completion log

- 2026-06-30 00:11 UTC: PRD drafted, design confirmed against existing required-tag
  architecture.
- 2026-06-30 17:40 UTC: Added match-mode (any/all) and searchable tag selector with
  chips. Backend (`schema.ts`, `judgingGroups.ts`, `judgingGroupSubmissions.ts`) and
  frontend (`EditJudgingGroupModal.tsx`) updated. Verified: convex codegen + deploy
  TypeScript clean, frontend lints clean.
