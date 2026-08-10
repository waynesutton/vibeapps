# Components check keeps coming back and AI judge links hide when disabled

Created: 2026-08-09 10:15 UTC
Last Updated: 2026-08-09 10:25 UTC
Status: Done

## Problem

1. Deleting the "Components check" custom AI criterion from the Custom AI criteria card works, but the criterion keeps coming back.
2. With the AI judge disabled, AI judge links (AI results page, agent API endpoints) were still visible in the Links ledger as a dimmed "Disabled" row. The user wants no AI judge links anywhere while the AI judge is off.

## Root cause

1. Not a persistence bug. `updateAiCustomCriteria` clears the field correctly (patching `undefined` removes it) and nothing in the backend re-adds the preset. The trap is in the UI: after deletion, the Rubric weights card shows the "Components check (preset)" row again, rendered as an On/Off toggle pill in the Off state. It reads like an existing criterion that is switched off, so clicking the pill (to confirm it is off, or by accident) instantly re-adds the criterion via `updateAiCustomCriteria`.
2. The previous iteration deliberately kept the AI results row always visible with a "Disabled" badge for discoverability. User feedback reversed that decision.

## Proposed solution

1. Replace the preset row's toggle pill with an explicit "Add to rubric" button and label the row "preset, not in rubric". Adding now requires a deliberate click that cannot be mistaken for an off state.
2. Links ledger: include the AI results row only when `aiJudgeEnabled` is true. Gate the agent API links on `aiJudgeEnabled` as well (the agent keys card is already hidden when the AI judge is off), with a message explaining that no AI judge links exist while the AI judge is off. Remove the now-unused `disabled` state from `LinkEntry`, `LinkLedgerRow`, and the markdown export. The AI judge settings card links block, group Overview row, and edit modal URL box were already gated on `aiJudgeEnabled`.

## Files to change

- `src/components/admin/judging/GroupAiSection.tsx` (preset Add button)
- `src/components/admin/judging/GroupLinksSection.tsx` (gate AI rows, drop disabled state)
- `src/components/admin/AdminDocs.tsx` (links ledger and rubric weights copy)

## Edge cases

- Custom criteria at the 10 cap: the Add button disables, same as the old toggle.
- Agent keys on but AI judge off: agent API links hidden in the UI; the HTTP endpoints themselves are still gated only by `agentKeysEnabled` (unchanged behavior, keys cannot be managed while the AI judge is off).
- Markdown export follows the same arrays, so hidden links never appear in Copy all or the .md download.

## Verification steps

- App tsc: only pre-existing errors in unrelated files; zero lints on edited files.
- Delete Components check, save: the Rubric weights card shows the preset row with an Add button, and nothing re-adds without clicking it.
- Disable AI judge: Links section shows no AI results row and no agent API links; the Agent API card explains the AI judge is off. Enable it: rows return.

## Task completion log

- 2026-08-09 10:15 UTC: PRD created after tracing the re-add path to the preset toggle pill and confirming the mutation clears correctly.
- 2026-08-09 10:25 UTC: Implemented and verified. Preset row now uses an explicit "Add to rubric" button with "preset, not in rubric" labeling. AI results and agent API links render only while aiJudgeEnabled is true; disabled-state rendering removed from the ledger row and markdown export. AdminDocs updated. App tsc clean on touched files, zero lints.
