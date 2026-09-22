# Judging group event window with time and late submission labels

Created: 2026-09-22 18:05 UTC
Last Updated: 2026-09-22 18:35 UTC
Status: Done

## Problem

The judging group event window (start and end) is captured with `<input type="date">`, so the stored `startDate` is midnight and `endDate` is 23:59:59.999 in the admin's local zone. Hackathon deadlines land at a specific hour (submissions close at 5:00 PM, not at midnight). The AI judge only compares the repo's first commit against `startDate`; nothing anywhere compares the submission timestamp against `endDate`, so a late submission looks identical to an on time one for the AI judge, human judges, and organizers.

## Root cause

- The event window inputs were built for the build timeline check only (first commit vs start date), so day granularity was enough at the time.
- `endDate` is passed into `computeGitFacts` and discarded (`void eventEndDate`).
- No query exposes "submitted after the deadline" for a story, so no UI can label it.

## Proposed solution

Keep the stored fields (`judgingGroups.startDate` and `endDate`, epoch ms) and add time on the input side plus one read time computed fact on the output side.

1. **Time on the event window.** The AI judge settings card switches to `datetime-local` inputs using the existing `tsToDateTimeInput` and `dateTimeInputToTs` helpers (already used by the countdown and the How to judge deadline). A "Saves as ..." line under each field shows the absolute instant in the admin's zone. End must be after start. Unchanged fields are not resent, so a stored `23:59:59.999` deadline is not silently moved to `23:59:00` on an unrelated save.

2. **Submission timing as a computed fact.** New pure helper `convex/lib/submissionTiming.ts` with `computeSubmissionTiming(submittedAt, deadlineAt)` returning `{ status: "on_time" | "late" | "no_deadline_set", submittedAt, deadlineAt? }`. `submittedAt` is the story `_creationTime` (when the team submitted the app). It is computed at read time from the group's current `endDate`, never stored, so changing the deadline relabels every row live and there is no backfill.

3. **AI judge.** `getSubmissionForAnalysis` returns `submittedAt`. The user message gains a `SUBMISSION TIMING` facts section (submitted at, deadline, status, how late). The system prompt gains a fixed rule: score every criterion normally, never change a score because of timing, and open `overallReasoning` with a late submission note when the status is late. A server side fallback appends the note when the model forgets, mirroring the `started_before` handling.

4. **Humans see it.** A shared `LateSubmissionBadge` renders a red "Late submission" chip with a tooltip (submitted at, deadline, eligibility is the organizer's call) in:
   - the judging interface (search list rows and the submission title row),
   - the admin View submissions table (Submitted column),
   - AI results (admin chips row, eligibility filter, brief and report lines) and the public AI results page.

5. **Docs.** How to judge page and its Markdown export explain the label when the group has a deadline. Admin docs cover the event window time, the late label, and what the AI does with it. The judge login page shows the window with time.

Wording: the label is "Late submission", not "Disqualified". The platform flags; organizers decide eligibility. That is the same stance the build timeline check takes.

## Files to change

- `convex/lib/submissionTiming.ts` (new)
- `convex/judgingGroupSubmissions.ts`: `getGroupSubmissions`, `listSubmissionsTable`
- `convex/aiJudge.ts`: `aiResultValidator`, `enrichResults`, `getGroupAiResults`, `getCompletedResultsForGroup`, `getGroupAiReportData`, `getSubmissionForAnalysis`
- `convex/aiJudgeAnalysis.ts`: `buildSystemPrompt`, `buildUserMessage`, `analyzeSubmission`
- `src/components/LateSubmissionBadge.tsx` (new)
- `src/components/admin/judging/GroupAiSection.tsx`
- `src/components/admin/judging/GroupSubmissionsTableSection.tsx`
- `src/components/admin/AIJudgeResults.tsx`
- `src/pages/AIJudgeResultsPage.tsx`
- `src/pages/JudgingInterfacePage.tsx`
- `src/pages/JudgingGroupPage.tsx`
- `src/pages/HowToJudgePage.tsx`, `src/lib/howToJudgeMarkdown.ts`
- `src/components/admin/AdminDocs.tsx`
- `TASK.MD`, `changelog.MD`, `files.MD`

## Edge cases

- No `endDate` set: status `no_deadline_set`, no badge, no prompt section line about lateness (the section still states no deadline is configured so the model does not guess).
- Story submitted to the site long before the event and added to the group by hand: `on_time` (build timeline covers "started before").
- Deadline changed after an AI run: badges update live; the AI reasoning keeps the note from its run until the next run. Documented.
- Existing groups with day only values keep working: `tsToDateTimeInput` shows `23:59` and the value is only rewritten when the admin edits that field.
- `EditJudgingGroupModal.tsx` is not mounted anywhere (replaced by the group workspace); left unchanged.
- Jev second opinion state is built from the same user message; the timing section sits before the repository section so truncation never drops it.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit` and `npx convex codegen` / typecheck pass
- `npm run build` (Netlify command) passes
- ESLint clean on touched files
- Manual: set an end time earlier than a test submission, confirm the badge in the judge interface, admin table, AI results, and public AI results; run the AI judge and confirm the late note in `overallReasoning`

## Task completion log

- 2026-09-22 18:05 UTC: PRD written, implementation started.
- 2026-09-22 18:35 UTC: Implemented and verified. `submissionTiming` helper plus validator; returned from `getGroupSubmissions`, `listSubmissionsTable`, `enrichResults`, `getGroupAiReportData`; `submittedAt` on `getSubmissionForAnalysis`; `SUBMISSION TIMING` prompt section, fixed rule, and server fallback note; `LateSubmissionBadge` wired into the judging interface, admin table, admin and public AI results (Eligibility filter gains Submitted on time / Late; brief and report carry the line); `datetime-local` event window with validation and Saves as hints; `JudgingGroupPage` shows time and Ends / Ended; How to judge page and Markdown export Late submissions section; AdminDocs updated. Checks: app `tsc -b` 0 errors, convex `tsc` 0 errors, eslint 0 errors on touched files, `npm run build` passes, `npx convex dev --once` pushed, helper smoke test (5 cases) passed, browser check of the settings card and the public guide section on dev. Not exercised live: an AI run on a late story (no dev story is past the test group's deadline); the fallback note path is covered by the same pattern as `started_before`.
