# AI Judge: Convex Components Detection and Scoring

Created: 2026-07-05 21:49 UTC
Last Updated: 2026-07-05 21:55 UTC
Status: Done

## Problem

The AI review treats Convex components as one keyword among many. Admins want the stats view to list exactly which components each hackathon used and how many apps used them, and they want the review to reward component usage with higher scores.

## Proposed solution

1. Deterministic detection in `aiJudgeAnalysis.ts`: while fetching the repo, extract component names from `package.json` dependencies matching `@convex-dev/*` (excluding the eslint plugin) and from `convex.config.ts` imports of `*/convex.config`. Store the deduped list as a new `componentsDetected` field on the result row.
2. Prompt changes: the advanced criterion description now calls out components explicitly, the system prompt tells the model that detected components are a strong signal that should raise the advanced score, and the user message includes a "CONVEX COMPONENTS DETECTED" section listing them (or "none detected").
3. Stats panel: new "Using Convex components" card (apps count plus distinct component count) and a "Components used" list with per-component app counts, alongside the existing top features and score distribution panels.
4. Hackathon report: overview row for apps using components and a per-submission components line.

## Files to change

- `convex/schema.ts`: `componentsDetected` optional array on `aiJudgeResults`
- `convex/aiJudge.ts`: validators, enrichment, saveResult args, report data
- `convex/aiJudgeAnalysis.ts`: component extraction, prompt updates, save
- `src/components/admin/AIJudgeResults.tsx`: stats card, components list, report rows

## Edge cases

- Repo inaccessible: components list empty, everything renders as before
- Old results without `componentsDetected`: stats fall back to feature strings containing "component" for the apps-using count; the components list only shows data from new runs
- convex.config.ts in a nested folder: detection uses the fetched file regardless of path
- Self-referencing imports in convex.config.ts (local components): captured by the import regex as their folder name

## Verification steps

- convex codegen and frontend tsc clean for touched files
- A repo with @convex-dev/resend in package.json shows "resend" in stats after a run
- Advanced criterion reasoning references components when present

## Task completion log

- 2026-07-05 21:49 UTC: PRD created, implementation started
- 2026-07-05 21:55 UTC: Backend detection, prompt scoring, stats card and components list, report rows shipped. convex codegen and tsc clean, no new frontend errors, docs synced.
