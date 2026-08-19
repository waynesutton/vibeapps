# AI judge Convex team recap

Created: 2026-08-19 19:53 UTC
Last Updated: 2026-08-19 19:58 UTC
Status: Done

## Problem

The AI judge stores detailed evidence for every submission, but an organizer cannot copy one concise submission brief or generate a privacy-safe group recap for the Convex team. The existing hackathon report is aimed at event organizers and includes participation details that are not needed for this handoff.

## Proposed solution

Add two score-neutral exports to the existing admin AI Judge results view:

- A Copy brief action on each completed submission. The brief uses the saved score, AI note, verified repository facts, components used in code, live URL status, repository access, Git timeline notes, and hackathon log discrepancies.
- A Convex Recap tab that generates one markdown document for the full judging group after the review run finishes. It includes cohort counts, verified component and feature totals, and a concise section for every completed submission.

Both exports are assembled locally from existing stored review results. They do not call another model, rescan repositories, change scores, or include submitter emails and team member details.

## Files to change

- `src/components/admin/AIJudgeResults.tsx`
- `TASK.MD`
- `changelog.md`
- `files.md`

## Edge cases

- The recap stays disabled until at least one review is complete and no review is pending or running.
- Older review rows without `componentsUsed` fall back to installed component data only for aggregate display, with no change to scoring.
- Missing repositories, live URLs, notes, and repository facts produce clear fallback text.
- Clipboard access falls back to a temporary textarea.
- Failed reviews remain in the existing organizer report and are counted in recap overview totals, but do not receive a completed submission brief.

## Verification steps

- Run ESLint on `src/components/admin/AIJudgeResults.tsx`.
- Run the app TypeScript check.
- Run the production build.
- Confirm generated recap markdown contains no email fields or team member details.
- Confirm existing Results, Stats, and Hackathon Report behavior remains available.

## Task completion log

- 2026-08-19 19:53 UTC: PRD created and implementation started.
- 2026-08-19 19:58 UTC: Added per-submission Copy brief actions, a gated Convex Recap tab with copy and markdown download, privacy-safe recap generation from existing result data, and used-in-code component totals. Focused ESLint and the production build passed. The full app TypeScript check still reports existing unrelated errors, with none in `AIJudgeResults.tsx`.
