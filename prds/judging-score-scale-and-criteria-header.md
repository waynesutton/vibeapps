# Judging score scale option and criteria section cleanup

Created: 2026-08-09 09:15 UTC
Last Updated: 2026-08-09 09:30 UTC
Status: Done

## Problem

1. Human judging scores are hardcoded to a 1-10 scale everywhere (schema comments, mutations, judging interface buttons, results displays, agent API). Admins want to pick a 1-5 or 1-10 scale per judging group.
2. The embedded Judging Criteria section inside the group workspace still renders its own "Back to Groups" button and page-level header, which duplicates the workspace navigation.
3. Judges per submission needs a sanity pass to confirm it still works with the new workspace layout.

## Root cause

- No `scoreScale` field exists on `judgingGroups`; every validator and display hardcodes 10.
- `JudgingCriteriaEditor` was built as a standalone page and kept its own header when embedded.

## Proposed solution

Add `scoreScale: v.optional(v.union(v.literal(5), v.literal(10)))` to `judgingGroups` (unset = 10, fully backward compatible). Thread it through:

Backend:
- `convex/schema.ts`: new optional field.
- `convex/judgingGroups.ts`: `updateGroup` accepts it; `getGroupWithDetails` returns it (default 10).
- `convex/judges.ts`: `getJudgeSession` returns `group.scoreScale` for the judge interface.
- `convex/judgeScores.ts`: `submitScore` validates 1..scale; `getGroupScores`, `getSubmissionScores`, `getPublicGroupScores`, `getValidatedGroupScores` return `scoreScale` and use it in `maxPossibleScore` math.
- `convex/judgingGroupSubmissions.ts`: scale-aware `maxPossibleScore`.
- `convex/adminJudgeTracking.ts`: `updateJudgeScore` validates against scale; `getGroupJudgeTracking` returns `scoreScale` in group.
- `convex/agentJudges.ts`: agent score submission validates against the group scale.
- `convex/http.ts`: API docs text mentions the per-group scale.

Frontend:
- `GroupSettingsSection.tsx`: scoring scale selector (1-5 / 1-10) saved via `updateGroup`.
- `JudgingInterfacePage.tsx`: score buttons render 1..scale, labels show `/scale`.
- `JudgingCriteriaEditor.tsx`: remove back button and page header (workspace provides navigation); scale-aware preview via prop.
- `JudgingResultsDashboard.tsx`, `PublicJudgingResultsDashboard.tsx`, `JudgeTracking.tsx`: `/10` labels and edit-modal max become scale-aware.
- `AdminJudgingGroupPage.tsx`: drop `onBack`, pass `scoreScale`.
- `AdminDocs.tsx`: mention the configurable scale.

AI judge (Best Use of Convex) intentionally stays on its fixed 1-10 rubric; it is a separate scoring system.

## Edge cases

- Existing groups with stored scores: default stays 10, no data migration needed.
- Switching 10 -> 5 after scores exist: old scores above 5 remain stored and display as-is; new scores are capped at 5. Settings copy warns about changing mid-judging.
- Agent API: JSON schema keeps max 10 as the superset; server enforces the group scale.

## Verification steps

- `npx tsc -p tsconfig.app.json --noEmit` and convex typecheck pass.
- Settings shows the scale selector and saves.
- Judge interface renders 5 buttons for a 1-5 group.
- Criteria section shows no back button/header in the workspace.
- Judges per submission still assigns and completes correctly (code audit).

## Task completion log

- 2026-08-09 09:15 UTC: PRD created, exploration complete.
- 2026-08-09 09:30 UTC: All backend and frontend changes implemented and verified. App tsc and convex typecheck clean (remaining app errors are pre-existing unused-import warnings in untouched files), zero lints on touched files. Also fixed a pre-existing multi-judge bug: JudgingInterfacePage "Judged & Next" referenced a nonexistent `thisJudgeCompleted` field; it now uses `isComplete` (which the backend sets from per-judge completions in multi-judge mode). Judges-per-submission audit confirmed: settings save (workspace + edit modal), session/progress queries, markJudgeCompleted threshold flip, score lock enforcement in judgeScores and agentJudges, and JudgeTracking multi-judge banner all consistent.
