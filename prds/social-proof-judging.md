# Social proof for the AI judge and human judges

Created: 2026-09-22 06:50 UTC
Last Updated: 2026-09-22 07:25 UTC
Status: Done

## Problem

Hackathon judging asks whether a team launched publicly on X, LinkedIn, or Bluesky and got engagement. The app already collects `linkedinUrl` and `twitterUrl` on every submission, but:

- The AI judge never sees them. `getSubmissionForAnalysis` in `convex/aiJudge.ts` passes only `githubUrl` and `videoUrl`.
- Human judges get two bare external links in `JudgingInterfacePage.tsx` and see different engagement numbers depending on when they click.
- The form fields accept "profile or announcement post URL" in one box, so a profile link has to be told apart from a launch post before anyone can score it.

## Decision

No X API. Firecrawl (already configured for the live site scrape) has a dedicated `x-twitter` engine that returns author, date, likes, retweets, the unrolled thread, and top replies for public x.com status URLs. Bluesky exposes like, repost, and reply counts through a free public endpoint. LinkedIn blocks every scraper, so it gets a liveness check and an explicit "metrics unavailable" note. Views are excluded on purpose: only the paid X API has them and LinkedIn never will, so a views based score would be unfair by construction.

## Proposed solution

One snapshot per submission per social field, written by the AI run (or an admin refresh) and read by both the AI prompt and the judge page, so humans and the AI look at the same numbers.

1. `socialProofSnapshots` table, one row per story per field (`linkedinUrl`, `twitterUrl`), upserted. Stores platform, post or profile kind, status, live flag, source, post text, author, posted date, likes, reposts, replies, error, and `fetchedAt`.
2. `convex/lib/socialLinks.ts`: pure `classifySocialUrl` for X, Bluesky, and LinkedIn post vs profile detection. Mirrored on the frontend for labels.
3. `convex/socialProof.ts`: fetcher with Firecrawl X engine, oEmbed fallback, Bluesky public API, LinkedIn HEAD; a judge or admin read query; an admin refresh mutation that re snapshots every submission in a group at once (fairness control for when submissions close).
4. `convex/aiJudgeAnalysis.ts`: fetch in the existing `Promise.all`, a `SOCIAL PROOF (verified by direct fetch)` block in the user message, one fixed system prompt rule (never invent engagement numbers, profile is not a launch), `sourcesUsed.socialProof`.
5. `social-proof` preset custom criterion in Rubric weights next to Components check and Frontend checker. Groups with a human "Social proof" criterion can also mirror it with the existing toggle.
6. `SocialProofCard` in the judge interface replacing the bare LinkedIn and X links when a snapshot exists; plain link stays when none exists yet.
7. Admin docs.

## Files to change

- `convex/schema.ts`: new table, `sourcesUsed.socialProof`
- `convex/lib/socialLinks.ts` (new)
- `convex/socialProof.ts` (new)
- `convex/aiJudge.ts`: `SOCIAL_PROOF_KEY`, pass social URLs, `sourcesUsed.socialProof` in validators
- `convex/aiJudgeAnalysis.ts`: fetch, prompt block, rule, sourcesUsed
- `src/components/admin/judging/groupSection.tsx`: `SOCIAL_PROOF_KEY`, classifier mirror
- `src/components/admin/judging/GroupAiSection.tsx`: preset row, refresh button
- `src/components/admin/AIJudgeResults.tsx`: `socialProof` chip and types
- `src/components/judging/SocialProofCard.tsx` (new)
- `src/pages/JudgingInterfacePage.tsx`: render the card
- `src/components/admin/AdminDocs.tsx`

## Edge cases

- Same URL in both fields: two snapshots, one per field, so card and prompt stay field aligned.
- Firecrawl markdown without `Likes:` lines: text only, metrics undefined, status `completed`.
- oEmbed 404: post deleted or private, `status: failed`, `live: false`.
- Bluesky handle resolution fails: `status: failed` with the message.
- `FIRECRAWL_API_KEY` missing: X falls straight to oEmbed. Nothing configured: classify and liveness still run so the prompt is never silent about a supplied link.
- Post text capped at 1500 chars in the prompt, 4000 stored.
- No delete path for snapshots yet; rows are small and bounded by stories times two.

## Verification

1. `npx convex dev --once` and `npx tsc -p tsconfig.app.json --noEmit` clean; eslint on touched files.
2. One-off internal action against a real public x.com status URL confirms the hosted Firecrawl plan returns `Likes:` and `Retweets:` lines, or the oEmbed fallback is exercised.
3. One-off against a real bsky.app post confirms counts.
4. AI run on the test group with an X post, a Bluesky post, and an X profile in `twitterUrl`: SOCIAL PROOF block present, `sourcesUsed.socialProof` set, profile only note.
5. Judge session page shows the card for a story with a snapshot and the plain link for one without.
6. Re run reuses the snapshot; refresh forces a new `fetchedAt`.
7. A group with no social links produces no SOCIAL PROOF section and saves as before.

## Task completion log

- 2026-09-22 06:50 UTC - PRD written, plan confirmed (snapshot card only, preset plus mirror).
