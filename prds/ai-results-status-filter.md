# AI results status filter and failure reasons

Created: 2026-09-23 16:40 UTC
Last Updated: 2026-09-23 16:45 UTC
Status: Done

## Problem

Large groups (183 submissions, 26 failed) have no way to isolate failed AI reviews or see why they failed. Failed rows sit at the bottom of the ranked list, mixed with everything else, and the only filter is Eligibility (build timeline and submission timing).

## Solution

Frontend only. `getGroupAiResults` already returns `status` and `error` on every row.

- Status filter (All, Completed, Failed, Reviewing, Pending) with live counts, next to Eligibility.
- The four stat cards (Pending, Reviewing, Completed, Failed) become toggle buttons that set the status filter and switch to the Results tab.
- Sort: AI rank (default), Title A to Z, Failure reason. Rank numbers never change when sorting or filtering.
- When Status is Failed, a Why they failed panel groups failed rows by a normalized reason (first line of the error, URLs and long numbers collapsed so repeats group together) with counts. Picking a reason narrows the list; All reasons clears it.
- "Showing N of M" count and a Clear filters action on the empty state.
- Failed error text wraps (`break-words`, `whitespace-pre-wrap`).

## Files

- `src/components/admin/AIJudgeResults.tsx`

## Edge cases

- Failed row with no error message groups under "No error message recorded".
- Changing status resets the reason pick.
- Retrying a row moves it out of Failed live (reactive query); if its reason group empties, the reason pick resets to all.
- Eligibility and Status combine (AND).

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`
- Browser: click Failed card, see reasons panel, pick a reason, sort by title, clear filters.

## Task completion log

- 2026-09-23 16:40 UTC PRD created
- 2026-09-23 16:45 UTC Shipped. tsc and eslint clean; browser verified card toggles, Failed empty state, Clear filters. Reasons panel not visually checked (dev group has zero failures).
