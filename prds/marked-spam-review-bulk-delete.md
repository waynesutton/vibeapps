# Marked spam review and bulk delete

Created: 2026-08-13 18:05 UTC
Last Updated: 2026-08-13 18:15 UTC
Status: Done

## Problem

The AI Spam tab can filter scan results to "marked", but that view is derived from `spamCheckResults` rows. A story marked as spam whose scan row is missing (deleted, or marked before scans existed) never shows up. There is also no single place to review everything currently marked as spam and permanently delete it in bulk.

## Root cause

`listSpamResults` iterates the `spamCheckResults` table and enriches each row with its story. Marked spam is a property of the `stories` table (`isSpam: true`), so the review view must query stories directly. The `stories` table has no index on `isSpam`, so a direct query would be a full table scan.

## Proposed solution

1. Schema: add `.index("by_isSpam", ["isSpam"])` to `stories`.
2. Backend: new `listMarkedSpam` query in `convex/spamCheck.ts` that reads `stories` via the new index (`isSpam === true`), newest marked first, enriched with author username, admin who marked it, and reason. Gated by `moderation.view`.
3. Frontend: new "Marked spam" review section on the AI Spam tab (`SpamCheck.tsx`) with:
   - its own selection state, select all, per row checkbox
   - bulk permanent delete using the existing `bulkDelete` mutation, chunked into batches of 50 to respect `MAX_BULK_ACTION`
   - per row unmark using the existing `unmarkSpam` mutation
   - collapsed by default behind a toggle showing the marked count

## Files to change

- `convex/schema.ts`: add `by_isSpam` index on stories
- `convex/spamCheck.ts`: add `listMarkedSpam` query
- `src/components/admin/SpamCheck.tsx`: add Marked spam review section

## Edge cases

- More than 50 selected: chunk `bulkDelete` calls sequentially so the mutation cap is respected.
- Story marked with no scan row: appears here (that is the point).
- Anonymous submissions: show submitter name or "anonymous".
- Delete permission: section actions require `moderation.delete`; view requires `moderation.view`.
- Deleting from this list also deletes the story's scan row (existing `bulkDelete` behavior), so the scan results list stays consistent.

## Verification steps

- `npx convex dev` picks up the schema index without errors
- TypeScript check passes (`npx tsc --noEmit` project config)
- Admin UI: marked spam section lists marked stories, select all works, bulk delete removes them, unmark returns a story to visible

## Task completion log

- 2026-08-13 18:05 UTC: PRD created, implementation started
- 2026-08-13 18:15 UTC: Shipped. `by_isSpam` index added, `listMarkedSpam` query live, Marked spam review section with select all, chunked bulk delete, and per-row unmark on the AI Spam tab. Existing scan-results bulk delete switched to the chunked helper. Convex codegen green, tsc clean on touched files, zero lints. Docs synced (task.md, changelog.md, files.md).
