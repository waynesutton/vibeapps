# Shortlist below the cut

Created: 2026-09-22 09:40 UTC
Last Updated: 2026-09-22 10:30 UTC
Status: Done

## Problem

Shortlist mode (`judgeQueueMode = "shortlist"`) hides every submission that did not make the cut from human judges. That is the right default, but organizers asked for a second option: run the AI judge, shortlist the top 5, 10, or 20 (plus any hand picked rows), and still let judges see the rest of the field so they understand what was cut and why. Judges should be able to read those submissions, see the AI rank and score, read the AI review, and leave a note if one deserves a second look. They should not be able to score them.

The alternative, a separate "human review after AI" judging interface, would duplicate login, filters, notes, multi judge locking, and progress for a view that differs only by which rows are scorable. Rejected.

## Decision

One new per group toggle, `showBelowCutToJudges` (default off). Only meaningful in shortlist mode. Off is exactly today's behavior.

When on:

- `getGroupSubmissions` returns every valid submission with `inJudgeQueue: boolean` and, where allowed, `ai: { rank, total, averageScore, weightedScore }`. Queue rows keep their order; below-cut rows follow, best AI rank first.
- Below-cut rows are read only. `canJudge` is false, `belowCut` is true, and `submitScore`, `updateSubmissionStatus`, and `markJudgeCompleted` throw `"This submission is not in the judge queue"`. `addSubmissionNote` stays open.
- Below-cut rows always show the AI rank and score badge and the AI review card expanded. Shortlisted rows show the badge only when `aiReviewVisibleToJudges` is on. A judge side Show/Hide AI scores button (localStorage, per group) hides badges and the card locally.
- Agent judges (`submissions.json`), progress bars, completion percentages, and results are unchanged because below-cut rows can never reach `completed`.

## Data flow

```
Run AI review -> Shortlist top 5/10/20/N (+ star rows)
  -> Judge queue = Shortlist only
     -> showBelowCutToJudges off: judges see the shortlist only (unchanged)
     -> showBelowCutToJudges on:  judges see shortlist + grayed below-cut rows
          below cut: AI rank + score + review, notes, no scoring
          shortlist: scoring as today
```

Ranking is never stored. `convex/lib/aiRank.ts` owns `computeWeightedScore`, `compareAiResults` (weighted score, then components used, then depth, then earliest submission), and `rankCompletedAiResults`. `enrichResults` in `aiJudge.ts`, the judge queue query, and `getAiReviewForJudge` all use it, so the admin AI results order and the judge badges always agree. Ranks are computed over one population everywhere: stories that are current members of the group (`judgingGroupSubmissions` row exists) and still valid for judging (not hidden, archived, or rejected). `aiJudgeResults` rows for stories removed from a group before `removeSubmission` started deleting them are ignored at read time instead of pushing real submissions down a rank.

## Files changed

Backend

- `convex/schema.ts`: `judgingGroups.showBelowCutToJudges` (optional boolean) with a comment.
- `convex/lib/judgeQueue.ts`: new `showsBelowCut(group)` next to `isInJudgeQueue`.
- `convex/lib/aiRank.ts`: new. `FRONTEND_CHECKER_KEY`, `computeWeightedScore`, `compareAiResults`, `rankCompletedAiResults`, `AiRankEntry`.
- `convex/aiJudge.ts`: re exports the rank helpers; `enrichResults` takes `groupId`, skips AI rows whose story is no longer a group member (callers can pass preloaded `memberStoryIds`), and sorts with `compareAiResults`; `getAiReviewForJudge` also serves below-cut rows when the toggle is on, ranks over current members, and returns `rank` and `rankTotal`; `getGroupAiResults` returns `showBelowCutToJudges`.
- `convex/judgingGroups.ts`: `updateGroup` accepts the field; `getGroupWithDetails` and `getHowToJudgePage` return it.
- `convex/judges.ts`: `getJudgeSession.group.showBelowCutToJudges`.
- `convex/judgingGroupSubmissions.ts`: `getGroupSubmissions` returns `inJudgeQueue` and `ai`; `getSubmissionStatusForJudge` returns `canJudge: false, belowCut: true` for below-cut rows; guards in `updateSubmissionStatus` and `markJudgeCompleted`.
- `convex/judgeScores.ts`: guard in `submitScore`.

Frontend

- `src/pages/JudgingInterfacePage.tsx`: `queueFilter` (Shortlist / Below the cut / All with counts), "N below the cut, read only" pill, `AiRankBadge` in search results and next to the title, Show/Hide AI scores button (per group localStorage), grayed dropdown rows with a Below the cut chip, read only banner, status section hidden, scoring column replaced by a read only notice, Below the cut legend item, and an empty state for shortlist mode with nothing starred yet.
- `src/components/judging/AiReviewCard.tsx`: `defaultOpen` prop and `#rank of total` in the headline.
- `src/components/admin/judging/GroupSettingsSection.tsx`: Show submissions below the cut to judges switch under Judge queue (shortlist mode only) and updated zero shortlist warning.
- `src/components/admin/AIJudgeResults.tsx`: 5 / 10 / 20 presets next to Shortlist top N, a Below the cut status line, and confirm and success copy that says what judges will see of the rest.
- `src/lib/howToJudgeMarkdown.ts` and `src/pages/HowToJudgePage.tsx`: queue summary, AI review paragraph, and the shortlist banner mention read only below-cut rows when the toggle is on.
- `src/components/admin/AdminDocs.tsx`: Shortlist rounds (judge doc), Judge queue, Shortlist with a new Below the cut subsection, Judge flow, Results denominator note, and Shortlist top N under AI judge.

## Out of scope

- A "Suggest for shortlist" button on below-cut rows that writes a tagged note and shows a count in the admin View submissions table. Notes cover this today.
- Weight UI for human criteria.
- Showing below-cut rows to agent judges. They keep the narrowed queue.

## Verification

- `npx tsc --noEmit -p convex/tsconfig.json` and `npx tsc --noEmit -p tsconfig.app.json` pass.
- Shortlist mode with the toggle off returns the same `getGroupSubmissions` rows as before with `inJudgeQueue: true` and no `ai` field unless Show AI review to judges is on.
- Toggle on: filter, pill, grayed rows, banner, expanded AI review, no scoring controls on below-cut rows; `submitScore` on a below-cut story throws; progress totals unchanged; admin AI results order matches judge badges.

## Completion log

- 2026-09-22 10:10 UTC: All plan items shipped and verified on the dev deployment (group in `all` mode unchanged; shortlist off unchanged; shortlist on shows read only below-cut rows; the three guards throw; progress stays 4/4; AI toggle persists per group).
- 2026-09-22 10:30 UTC: Fixed a rank mismatch found during verification. `getAiReviewForJudge` said `#1 of 6` while the list badge said `of 4` because stale `aiJudgeResults` rows (stories removed from the group) were counted. `enrichResults` and `getAiReviewForJudge` now rank over current group members only; admin AI results went from `4 of 6 flagged` to `4 of 4 flagged` with the same order as the judge badges. Also hid the empty `(by )` label on below-cut rows in the judge search dropdown.
- 2026-09-22 10:35 UTC: Follow up so the shortlist reads as a feature on its own, not an AI judge add on. `GroupSubmissionsTableSection` gained the same Shortlist for human judges status bar as AI results (minus Top N) with links to `?section=settings` and, when `aiJudgeEnabled`, `?section=ai-results`. Settings, How to judge page, and Markdown export only mention AI rank when `aiJudgeEnabled`. Admin docs Shortlist section now has a Without the AI judge path and explains hand adding a submission outside the AI top N by starring it (Shortlist top N replaces the set, so run it first and hand pick after). No schema or backend change: `setShortlisted` and `judgeQueueMode` already worked without an AI run.
