# AI judge links visibility in the group workspace

Created: 2026-08-09 10:00 UTC
Last Updated: 2026-08-09 10:25 UTC
Status: Done (partially superseded)

> Follow-up: the always-visible dimmed AI results row was reversed by user feedback the same day. AI judge links now hide entirely while the AI judge is disabled. See `prds/ai-judge-components-check-persistence-and-links-hide.md`. The "AI judge links" block in the AI judge settings card stands.

## Problem

Admins with the AI judge enabled report they cannot find the AI judge links: nothing on the Links section and no link view inside the AI judge settings.

## Root cause

- The "AI results page" row in the links ledger only renders when `group.aiJudgeEnabled` is true; when the flag is off (or the save failed validation, e.g. missing AI results password), the row simply does not exist, so admins have no signal the link exists at all.
- The AI judge section configures everything but never shows the URLs it controls (AI results page, agent API endpoints), so there is no way to grab the links where they are configured.

Dev data check: two groups have `aiJudgeEnabled: true`, so the conditional row can work; the failure mode is discoverability, not a broken query. `getGroupWithDetails` returns `aiJudgeEnabled`, `aiResultsIsPublic`, `hasAiResultsPassword` correctly.

## Proposed solution

- `GroupLinksSection.tsx`: always list the AI results page row. When the AI judge is disabled, render it dimmed with an "AI judge disabled" badge and a note pointing to the AI judge section. Markdown export marks it "Disabled". Export `LinkLedgerRow` and `LinkEntry` for reuse.
- `GroupAiSection.tsx`: when the AI judge is enabled (saved server state), the settings card shows an "AI judge links" block: the AI results page plus the agent API base URL and OpenAPI document (when the agent API is on), using the same ledger row component with copy/open actions.

## Files to change

- `src/components/admin/judging/GroupLinksSection.tsx`
- `src/components/admin/judging/GroupAiSection.tsx`
- `src/components/admin/AdminDocs.tsx` (links ledger doc mention)

## Edge cases

- AI judge enabled but private with no password set: row already shows the red "No password set" state.
- Agent API toggled off: AI settings card omits the agent endpoints (ledger already shows the disabled message).
- Toggle flipped locally but not saved: links block keys off saved `group.aiJudgeEnabled`, so it appears only after a successful save.

## Verification steps

- App tsc + convex typecheck pass, zero lints.
- With AI judge off: Links section shows a dimmed AI results row with the disabled badge.
- With AI judge on: AI judge section shows the links block; ledger row is active.

## Task completion log

- 2026-08-09 10:00 UTC: PRD created after confirming code path and dev data.
- 2026-08-09 10:05 UTC: Implemented and verified. AI results row is now always in the ledger (dimmed, gray lock, "Disabled" badge, pointer note when the AI judge is off); markdown export marks it Disabled. LinkLedgerRow and LinkEntry exported and reused in a new "AI judge links" block at the bottom of the AI judge settings card (AI results page + agent API endpoints, shown only after aiJudgeEnabled is saved server side). AdminDocs Links ledger section updated. App tsc clean, zero lints.
