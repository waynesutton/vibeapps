# AI Judge: Stats Tab and Hackathon Report

Created: 2026-07-05 20:12 UTC
Last Updated: 2026-07-05 20:25 UTC
Status: Done

## Problem

The admin AI Review view shows a ranked list but no rollup. Admins want two things:

1. A quick stats section after a review completes: how many apps were reviewed, how many use Convex, how many use advanced Convex features, and similar counts, laid out cleanly enough to screenshot as a report.
2. A hackathon report they can generate once every submission has been run: submission counts, participation (team names and members), and per submission GitHub and live URL links, in a format that pastes well into Notion and Google Docs, viewable in the app and savable as markdown. Useful for the Convex team to evaluate hackathon impact.

## Proposed solution

Add a tab bar to the admin `AIJudgeResults` view: Results (existing list), Stats, and Hackathon Report.

Stats tab (enabled once at least one review is completed):

- Screenshot friendly header with group name and date
- Stat cards: apps reviewed, apps using Convex (features detected), apps using advanced Convex features (scheduler, crons, file storage, search, vector, HTTP actions, components, agents keywords or advanced criterion score of 6+), live apps, repos analyzed, average score
- Top Convex features detected with counts
- Score distribution bars (1-2 / 3-4 / 5-6 / 7-8 / 9-10 average bands)

Hackathon Report tab (grayed out until pending = 0 and running = 0 and completed > 0):

- New admin only query `getGroupAiReportData` in `convex/aiJudge.ts` returning group info plus per submission: title, slug, links, team name, team members (name and email), submitter, and the stored AI result fields. Kept separate from the shared enrichment so team emails never flow through public queries.
- "Generate Report" builds the markdown client side (deterministic, instant, no LLM cost): title, generated date, overview stats, participation summary (submissions, teams, listed members), rankings table with markdown links, teams and members list, and per submission detail sections with scores, features, URL status, and the AI overall note. Failed reviews are listed in their own short section.
- Preview shown in the app with Copy Markdown and Download .md buttons.

## Files to change

- `convex/aiJudge.ts`: add `getGroupAiReportData` admin query
- `src/components/admin/AIJudgeResults.tsx`: tab bar, Stats tab, Hackathon Report tab with generate, copy, download

## Edge cases

- No completed reviews: Stats and Report tabs disabled with tooltip
- Failed rows: report becomes available once nothing is pending or running; failures listed separately with their error
- Submissions without team info: shown as solo entries under the submitter name; members omitted
- Old results without `urlCheck`: URL status column shows "not checked"
- Clipboard API unavailable: falls back to a temporary textarea copy

## Verification steps

- `npx convex codegen` and frontend `tsc` clean for touched files
- Stats numbers match the visible results list
- Report tab disabled during a run, enabled after; markdown downloads and pastes into Notion with working links

## Task completion log

- 2026-07-05 20:12 UTC: PRD created, implementation started
- 2026-07-05 20:25 UTC: Implemented and verified. Tab bar with Results/Stats/Hackathon Report, computeStats rollup + StatsPanel with feature bars and score distribution, buildHackathonReport markdown generator with copy/download, gated report tab, and admin-only getGroupAiReportData query. convex codegen and tsc clean, no lint errors.
