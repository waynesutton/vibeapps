# AI judge single submission rerun

Created: 2026-10-02 20:45 UTC
Last Updated: 2026-10-02 21:05 UTC
Status: Done

## Problem

Admins can only rerun the whole AI review from the header. A rerun for one completed submission existed, but it sat at the bottom of the expanded Details panel, fired with no confirmation (overwriting scores and any admin edits), and gave no feedback.

## Root cause

- The per row toolbar only offered Retry for failed rows.
- `aiJudge.retrySubmission` re-enqueued pending rows (duplicate workpool jobs on double click), skipped the group's AI judge toggle check, and did not check that the story is still valid for judging.

## Solution

Backend (`convex/aiJudge.ts`, `retrySubmission`):

- Throw when the group's AI judge is off (same rule as `startReview`).
- Throw when the story is deleted, hidden, or otherwise invalid for judging.
- Idempotent: return early when the row is already pending (already queued).
- Return `{ queued, previousStatus }` so the UI can tell retry from rerun.
- Log `judging.aiRerunQueued` for completed rows and keep `judging.aiRetryQueued` for failed rows.

Frontend (`src/components/admin/AIJudgeResults.tsx`):

- Re-run button in each completed row's toolbar, Retry stays for failed rows.
- Site confirm dialog before rerunning a completed review; warns when admin edits will be lost.
- Spinner on the row while the mutation is in flight, toast on success.
- Previous score stays visible (dimmed, labeled "previous") while a rerun is pending or reviewing; rank badge stays.
- Header button shows how many submissions are in flight instead of a generic "Review in progress".
- Details panel button routes through the same confirm flow.

Activity log label added in `GroupActivitySection.tsx`.

## Edge cases

- Double click: second call hits the pending early return, no duplicate job.
- Row running: clear error.
- Full run in progress: all rows pending or running, so the per row button is hidden.
- AI judge turned off: button disabled with a tooltip.

## Verification

- `npx tsc --noEmit -p convex` and app typecheck pass.
- Lints clean on touched files.

## Task completion log

- 2026-10-02 21:05 UTC: Backend hardening, row toolbar Re-run, previous score display, docs synced.
