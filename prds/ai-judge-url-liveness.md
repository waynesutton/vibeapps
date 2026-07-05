# AI Judge: Live App URL Check

Created: 2026-07-05 19:43 UTC
Last Updated: 2026-07-05 19:55 UTC
Status: Done

## Problem

The AI Judge scores submissions on Best Use of Convex from the GitHub repo and a Firecrawl scrape, but it never verifies the submission's live app URL actually works. A submission with a dead or 404 demo link can score the same as one with a working app. Admins also have no visible flag telling them a demo link is broken.

## Proposed solution

Add a deterministic liveness check of the submission's live app URL (the `story.url` field only, never social links) inside the existing `analyzeSubmission` action, and fold it into the review:

1. Direct HTTP check of `story.url` with a GET request (redirects followed). Record status code, live or not, and a short reason (`404 Not Found`, `network error`, `no URL provided`). Firecrawl scrape success is a secondary confirmation signal.
2. New sixth rubric criterion `liveness` ("Live app status") scored 1 to 10 like the others. The ranking stays mostly Convex focused since liveness is one of six criteria.
3. The liveness facts are injected into the LLM prompt with explicit scoring instructions (dead or 404 URL scores 1 to 2, working app scores from what is observable). After parsing, the action clamps the liveness score server side: if the URL check failed, liveness is capped at 2 regardless of what the model said, and the reasoning is prefixed with the observed status.
4. Store the raw check on the result row as `urlCheck` so admin and public views show a flag (URL live / URL 404 / URL unreachable / no URL) independent of the LLM text.
5. Prompt also instructs the model to mention the URL status in `overallReasoning` when the URL is broken.

## Files to change

- `convex/schema.ts`: add optional `urlCheck` object to `aiJudgeResults`
- `convex/aiJudge.ts`: add `liveness` rubric entry, `urlCheck` validator in result validator + `saveResult` args + `enrichResults`
- `convex/aiJudgeAnalysis.ts`: `checkUrlLiveness` helper, prompt additions, server-side clamp, pass `urlCheck` to save
- `src/components/admin/AIJudgeResults.tsx`: URL status badge in the row header
- `src/pages/AIJudgeResultsPage.tsx`: URL status badge in the public list

## Edge cases

- No live URL on the submission: `urlCheck` records `no URL provided`; liveness scored low (capped at 3) but not an error, review continues.
- URL is a non-http scheme or unparsable: treated as not live.
- Server rejects GET or times out: mark not live with `network error`; Firecrawl success can override to live (some hosts block plain fetch but allow crawlers).
- Old completed results without `urlCheck`: field is optional; UI hides the badge when absent. Old 5-criterion results still render since the UI maps over stored `criteriaScores`.
- Admin edits: `updateResultScore` already accepts arbitrary criteria arrays, so 6-criterion rows edit fine.

## Verification steps

- `npx convex codegen` passes and `tsc` shows no new errors in touched files
- Run a review on a group containing a submission with a dead URL: liveness score is 1 to 2, badge shows "URL 404" or "URL down", overall note mentions it
- Submission with working URL: badge shows "URL live", liveness scored normally
- Old results without `urlCheck` render unchanged

## Task completion log

- 2026-07-05 19:43 UTC: PRD created, implementation started
- 2026-07-05 19:55 UTC: Implemented and verified. Schema `urlCheck` field, `liveness` rubric criterion, `checkUrlLiveness` helper with Firecrawl-success override, prompt rules, server-side score clamp, overall note flag, and URL status badges in admin + public views. convex codegen and tsc clean, no lint errors in touched files.
