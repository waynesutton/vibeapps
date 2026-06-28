# Multi-Judge Submissions

## Problem

The judging system only supports a single judge per submission. Hackathons and review panels often need multiple independent judges scoring the same submission to reduce bias and improve scoring quality. There was no way for an admin to require more than one judge per submission.

## Design

Admins can now set a "Judges per submission" value (default 1, unchanged behavior) on each judging group via `EditJudgingGroupModal`. When set to N > 1:

- Any judge can open and score any submission until N distinct judges have completed it.
- The action button changes from "Mark Submission Complete" to "Judged & Next", which records the judge's completion and advances to the next unjudged submission.
- After a judge submits their scores (or when the submission is locked), the interface reveals an overall average score plus each judge's individual scores.
- Once N judges have completed a submission, it locks and becomes read-only for all further judges.
- Each judge writes their own completion row in `submissionJudgeCompletions`, avoiding OCC write conflicts on the shared `submissionStatuses` row.

## Data Model Changes

`judgingGroups` table: added `judgesPerSubmission: v.optional(v.number())` (defaults to 1 when unset).

New `submissionJudgeCompletions` table:

| Field       | Type                    | Purpose                              |
|-------------|-------------------------|--------------------------------------|
| groupId     | `v.id("judgingGroups")` | Parent group                         |
| storyId     | `v.id("stories")`      | Submission being judged              |
| judgeId     | `v.id("judges")`       | Judge who completed                  |
| completedAt | `v.number()`            | Timestamp of completion              |

Indexes: `by_groupId_storyId`, `by_group_story_judge` (unique per judge), `by_judgeId`.

## Backend Changes

- `convex/judgingGroups.ts`: `createGroup` defaults field to 1; `updateGroup` accepts and clamps it; all group queries expose it.
- `convex/judges.ts`: `getJudgeSession` returns the value on the group object; `getJudgeProgress` counts completions from the new table when multi-judge.
- `convex/judgingGroupSubmissions.ts`: new `markJudgeCompleted` mutation (idempotent insert + threshold flip); `getSubmissionStatusForJudge` returns `completionCount`, `thisJudgeCompleted`, `judgesPerSubmission`; `removeSubmission` and `deleteGroup` cascade-delete completion rows.
- `convex/judgeScores.ts`: new `getSubmissionJudgeBreakdown` query with after-self reveal rule.
- `convex/adminJudgeTracking.ts`: `getGroupJudgeTracking` exposes `judgesPerSubmission` on the group object.

## Frontend Changes

- `EditJudgingGroupModal.tsx`: numeric input for "Judges per submission" with helper text.
- `JudgingInterfacePage.tsx`: branches on `judgesPerSubmission > 1` for "Judged & Next" button, completion counter, per-judge score breakdown, and read-only locking.
- `JudgeTracking.tsx`: shows a multi-judge indicator banner when enabled.

## Edge Cases

- Reducing N after some judges completed: existing completions are preserved; if count already meets the new threshold, the submission locks immediately.
- Single-judge groups are completely unaffected (default behavior).
- Re-clicking "Judged & Next" is idempotent; existing completion rows are detected and not duplicated.

## Verification

- Create a group with `judgesPerSubmission = 1`. Confirm behavior is identical to before.
- Create a group with `judgesPerSubmission = 3`. Register 3 judges. Have each score and click "Judged & Next". After the 3rd judge, confirm the submission locks. Confirm score breakdown appears for all judges who have completed. Confirm judges who have not yet completed cannot see other judges' scores.

## Task Log

- 2026-06-28 22:00 UTC: Schema + backend (schema.ts, judgingGroups.ts, judges.ts, judgingGroupSubmissions.ts, judgeScores.ts, adminJudgeTracking.ts)
- 2026-06-28 22:15 UTC: Frontend (EditJudgingGroupModal.tsx, JudgingInterfacePage.tsx, JudgeTracking.tsx)
- 2026-06-28 22:17 UTC: Documentation (PRD, files.md, changelog.md, TASK.MD)
