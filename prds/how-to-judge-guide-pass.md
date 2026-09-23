# How to judge guide, second pass

Created: 2026-09-23 17:21 UTC
Last Updated: 2026-09-23 17:30 UTC
Status: Done

## Problem

The public How to judge page (`/judging/{slug}/howtojudge`) mentioned the shortlist in one callout and never explained how scores are read. Judges asked what the below the cut rows mean, why score buttons are missing, what the AI badge numbers are, and how the results pages rank apps.

## Solution

Two new sections, both built from pure helpers in `src/lib/howToJudgeMarkdown.ts` so the page and the Markdown export match:

- Shortlist round (`shortlistBlocks`), shortlist mode only. How the cut was made, what counts toward progress, and either the below the cut workflow (round filter, pill, banner, no scoring, notes for a second look, Nothing shortlisted yet) or a note that the rest are hidden.
- Reading scores (`readingScoresBlocks`). Your scores, the AI badge and AI review card (only when judges can see AI data), the results page (only when shareable), and the AI results page (only when shareable).

Plus a shortlist TL;DR step, `navigationTips` and `troubleshootingRows` that add shortlist and AI rows when they apply.

## Files

- `src/lib/howToJudgeMarkdown.ts`
- `src/pages/HowToJudgePage.tsx`

## Edge cases

- AI judge off: no AI badge block, shortlist copy says hand picked.
- Results links hidden or not shareable: those blocks do not render.
- Score scale 5: AI block warns the AI scores out of 10.

## Public results Progress fix (resolved 2026-09-23 17:30 UTC)

Root cause: `getPublicGroupScores` and `getValidatedGroupScores` computed Progress and Submissions against every valid submission, while admin `getGroupScores` used `isInJudgeQueue`. In a shortlist round the public Progress card could not reach 100%.

Fix in `convex/judgeScores.ts`: both public queries filter submissions with `isInJudgeQueue`. All three queries count only completed statuses whose story is still in the queue, so un-shortlisting or hiding a completed app cannot push Progress past 100%. The guide's results block now says what the Submissions card counts in shortlist mode.

## Verification

- `bunx tsc --noEmit -p tsconfig.app.json` passes
- eslint clean on both files
- Not browser checked (dev servers stopped)
