# AI judge frontend checker with per-platform hosting weights

Created: 2026-08-12 18:50 UTC
Last Updated: 2026-08-12 18:50 UTC
Status: In Progress

## Problem

The AI judge rubric has no way to score the deployed frontend or to reward specific hosting platforms. Organizers want a frontend checker criterion in the Rubric weights section of the AI judging block, with sub weight options for Codex Sites, Convex static hosting, Vercel, Netlify, and Other. Each platform gets its own admin adjustable weight (default 1) so, for example, a submission on Codex Sites can count 5x while Convex static hosting counts 7x.

## Proposed solution

1. New preset custom criterion `frontend-checker` offered in the Rubric weights card behind an explicit Add button, exactly like the existing components check preset. The AI judge scores it 1 to 10 (deployed frontend quality and working deployment).
2. New group field `aiFrontendWeights`: per platform weights with fixed keys `codex-sites`, `convex-hosting`, `vercel`, `netlify`, `other`. Absent = 1 for every platform. Saved through the extended `updateAiRubricWeights` mutation, validated 0 to 10, all default clears storage.
3. Deterministic hosting detection during analysis, stored on the result as `frontendHosting: { platform, evidence }`:
   - URL host: `.chatgpt.site` = codex-sites, `.convex.site`/`.convex.app` = convex-hosting, `.vercel.app` = vercel, `.netlify.app` = netlify
   - Response headers from the liveness check: `x-vercel-id`/`server: vercel` = vercel, `x-nf-request-id`/`server: netlify` = netlify
   - Repo signals (covers custom domains): `.openai/hosting.json` = codex-sites, `@convex-dev/self-static-hosting` dependency = convex-hosting, `vercel.json` = vercel, `netlify.toml` = netlify
   - Live URL present but nothing matched = other
4. Weighted ranking: for the `frontend-checker` key, effective weight = criterion weight x detected platform weight (both default 1, so default behavior is unchanged). Derived at read time in `computeWeightedScore`, so weight edits re-rank instantly without re-running reviews.
5. Prompt gets a `FRONTEND HOSTING CHECK` facts section so the AI judge can reference the detected platform in its reasoning.
6. Server clamp: dead or missing live URL caps the frontend-checker score at 3.
7. Admin results UI shows a hosting platform badge per submission.

## Files to change

- `convex/schema.ts`: `aiFrontendWeights` on judgingGroups, `frontendHosting` on aiJudgeResults
- `convex/aiJudge.ts`: platform constants, `computeWeightedScore` platform multiplier, `updateAiRubricWeights` frontendWeights arg, result validator + enrichment, saveResult
- `convex/aiJudgeAnalysis.ts`: `detectFrontendHosting`, liveness check returns headers, prompt section, clamp, save
- `convex/judgingGroups.ts`: `getGroupWithDetails` returns `aiFrontendWeights`
- `src/components/admin/judging/groupSection.tsx`: platform defs shared with the weights card
- `src/components/admin/judging/GroupAiSection.tsx`: frontend checker preset row + platform sub weight inputs
- `src/components/admin/AIJudgeResults.tsx`: hosting badge

## Edge cases

- No live URL: no platform detected, frontendHosting stays undefined, weight multiplier stays 1
- Custom domains: repo signals still classify vercel/netlify/convex-hosting/codex-sites
- Removing the frontend-checker criterion prunes its rubric weight (existing prune logic); platform weights are cleared too
- Existing results without frontendHosting rank with multiplier 1 until re-run
- Groups without the criterion: detection still stored as metadata, no score impact

## Verification steps

- `npx tsc -p tsconfig.json --noEmit` and convex typecheck pass
- Rubric weights card shows the frontend checker preset Add button; after adding, five platform rows with default 1 appear
- Saving non default platform weights persists and re-ranks results
- All default weights clear stored fields

## Task completion log

- 2026-08-12 18:50 UTC: PRD created, implementation started
