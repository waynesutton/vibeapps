# Judging links event kit and submit password fix

Created: 2026-08-10 00:40 UTC
Last Updated: 2026-08-10 00:45 UTC
Status: Done

## Problem

Handing a judging group to an external hackathon organizer needs two links (judge page and submit page) plus any passwords. Three gaps got in the way:

1. **Submit password bypass (bug).** `JudgingGroupSubmitPage` auto-unlocked whenever the group's judge access flag `isPublic` was true, even when a submission page password was set. A public-judge group with a submit password let anyone skip the password gate.
2. **Event kit incomplete.** The Links section copy-all and .md export listed URLs and lock states but not the passwords, so organizers needed a second message with the access codes.
3. **Discoverability.** The submit URL only appears in the Links ledger after the custom submission page is enabled, with no pointer for admins who have not enabled it. And the human score scale (1 to 5 or 1 to 10) differs from the AI rubric (always 1 to 10) with no note anywhere organizers would see.

## Root cause (bug 1)

The auto-unlock effect keyed off the wrong flag:

```tsx
if (submissionPage && submissionPage.isPublic) setIsAuthenticated(true);
```

`isPublic` governs judge access, not the submit page. The password gate condition (`!isAuthenticated && hasSubmissionPagePassword`) already lets password-free pages straight through, so the effect was both wrong and unnecessary.

## Solution

1. **Bypass fix**: removed the auto-unlock effect entirely. Pages without a submission password open directly (gate never renders); pages with one always show the gate until the password validates, regardless of judge visibility.
2. **Event kit**: stored passwords are base64 encoded (`hashPassword` in `convex/judgingGroups.ts`), and `getGroupWithDetails` is admin gated (`judging.view`), so the Links section now decodes them client side and includes a `Password: ...` line for each locked link in the copy-all markdown and .md download. Passwords are never rendered in the on-screen ledger rows. Added `aiResultsPassword` to the `getGroupWithDetails` return so the AI results link gets the same treatment as judge, submit, and results links.
3. **Hints**: when the custom submission page is off, the Shareable links card (and the markdown export) note how to get a shareable submission link. When the AI judge is on, both note that human judges score 1 to N while the AI judge always scores 1 to 10.

## Files changed

- `src/pages/JudgingGroupSubmitPage.tsx`: removed the `isPublic` auto-unlock effect.
- `convex/judgingGroups.ts`: `getGroupWithDetails` returns `aiResultsPassword` (admin gated query).
- `src/components/admin/judging/GroupLinksSection.tsx`: `LinkEntry.password`, `decodeStoredPassword` helper, passwords + hints in `buildMarkdown`, submit-link and score-scale notes in the Shareable links card.

## Edge cases

- Legacy groups using the deprecated `password` field: `getGroupWithDetails` only returns `judgePassword`, so the export shows "password set" without the inline code. Acceptable; setting a new judge password fixes it.
- Locked link with no password set yet: no password line is added; the export already says "no password set yet".
- Malformed stored value: `decodeStoredPassword` returns undefined instead of throwing.
- `LinkLedgerRow` is reused by the AI judge settings card; the new `password` field is optional and never rendered by the row, so nothing changes there.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`: no errors in touched files (all reported errors pre-existing elsewhere).
- Zero linter errors in the three touched files.
- Gate logic reviewed: no password → form renders directly; password set → gate always shown until validated.

## Task completion log

- 2026-08-10 00:45 UTC: All three changes implemented and verified. Docs synced.
