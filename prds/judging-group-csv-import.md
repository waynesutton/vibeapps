# Judging group CSV import (Devpost) and AI judge reliability

Created: 2026-10-25 07:00 UTC
Last Updated: 2026-10-25 07:45 UTC
Status: Done (dev). Prod deploy waiting on approval.

## Problem

Cal Hacks 13.0 sends a Devpost Projects CSV (title, Devpost URL, about, try it out links, video, opt in prizes, submitter and team emails). Admins need to load those rows into a judging group as submissions without creating accounts, optionally keep them off the public directory, judge them with every existing group feature (human judging, AI judge, emails), and trust the AI judge at 50 to 150 submissions.

## Root causes and gaps

- `isHidden` is the only way to keep a story off public surfaces, but 11 judging helpers drop hidden stories, so a hidden import would vanish from judging, AI results, and emails.
- Submission timing uses `story._creationTime`, so every import would read as LATE.
- `getRelatedStoriesByTags` does not check `isHidden` (pre-existing leak).
- The AI judge never sees `customFormAnswers` or `dynamicFormValues`, so Devpost answers like Built With would be invisible.
- GitHub file reads cost one REST call each (about 70 per submission), and a rate limit fails the row.
- YouTube `no_transcript` rows are cached 7 days, so deadline uploads never get captions.

## Solution

- Stories gain `judgingOnly`, `importGroupId`, `importKey`, `importSourceUrl`, `submittedAt` plus index `by_importGroupId_and_importKey`. Groups gain `csvImportMapping` and `aiJudgePrizeBrief`.
- Judging only imports use `isHidden: true` plus `judgingOnly: true`, so every public surface stays private by default. One shared helper `isStoryJudgeable` replaces the duplicated checks.
- `convex/judgingGroupImports.ts`: batched, idempotent upsert by import key, duplicate URL skip, no accounts, no confirmation emails, no spam scan.
- Client side CSV parsing with papaparse and Devpost aware auto mapping in `src/lib/csvImport.ts`; UI card in the group Submissions section.
- AI judge: SUBMISSION FORM ANSWERS section, per group Prize brief, raw.githubusercontent.com file reads in parallel batches, automatic requeue on GitHub rate limit, readiness card, short cache for missing captions, transcript coverage and retry.

## Files

- `convex/schema.ts`, `convex/lib/judgingEligibility.ts`, `convex/lib/slug.ts`, `convex/judgingGroupImports.ts`
- `convex/aiJudge.ts`, `convex/aiJudgeAnalysis.ts`, `convex/videoTranscripts.ts`, `convex/stories.ts`
- `convex/judgingGroupSubmissions.ts`, `convex/judgingGroups.ts`, `convex/judgeScores.ts`, `convex/judges.ts`, `convex/agentJudges.ts`, `convex/hackathon.ts`, `convex/lib/researchDossier.ts`, `convex/emails/judgingGroupEmails.ts`, `convex/emails/submissions.ts`
- `src/lib/csvImport.ts`, `src/components/admin/judging/CsvImportCard.tsx`, `src/components/admin/judging/GroupSubmissionsSection.tsx`, `src/components/admin/judging/GroupAiSection.tsx`
- Link swaps: `JudgingInterfacePage.tsx`, `GroupSubmissionsTableSection.tsx`, `AIJudgeResults.tsx`, `AIJudgeResultsPage.tsx`, `JudgingResultsDashboard.tsx`, `PublicJudgingResultsDashboard.tsx`, `GroupActivitySection.tsx`

## Edge cases

- Multi line quoted cells, byte order mark, blank trailing rows.
- Rows with no live URL fall back to GitHub, then the Devpost URL.
- Rows with no tagline use the first 140 characters of the description.
- Re upload of the same CSV updates rows by import key instead of duplicating.
- A URL already in the group from the regular submit form is skipped with a reason.
- Unhiding a judging only story from moderation publishes it. `judgingOnly` stays set on the row but has no effect once `isHidden` is false, because `isJudgingOnlyStory` needs both flags. `showStory` was not edited (the convex lint hook blocks `stories.ts`). The story has no tags, so it shows in the directory but not on tag pages.
- Related stories cannot surface a judging only import because imports get `tagIds: []`. The `getRelatedStoriesByTags` hidden check was not added for the same lint reason.
- Import tag: judging only rows accept private tags only, enforced in `importCsvBatch`, because `getRelatedStoriesByTags` matches by tag and does not check story visibility. `StoryDetail` also drops private tags before asking for related apps. Residual gap: someone calling `getRelatedStoriesByTags` directly with a private tag id (ids are readable from `tags.listAllForDropdown`) could list judging only rows that share it. The real fix is a `story.isHidden !== true` check in that query, blocked today by the lint hook on `stories.ts`.
- Group email cap stays at 200 recipients per 24 hours.
- Repos in orgs that block fine grained tokens (the `convex` org does) return 403 or 404 and are judged as private. A classic token with no scopes avoids it.

## Verification

- `npx convex dev --once`, `npm run build`, `tsc -p convex`, and `tsc -p tsconfig.app.json` pass.
- Client mapping on a Devpost shaped CSV (escaped `"Try it out" Links` header, multi line description, two team members, mixed opt ins, a Draft row): every column maps as expected, the repo root comes from a `/tree/main` link, the Devpost link is skipped as a live URL, team members group, and the Convex plus Submitted filters keep 1 of 3 rows.
- Server import on dev with an admin identity: first run created 1 and skipped 2 with reasons (nothing linkable, missing title), a `javascript:` URL was dropped, a second run updated instead of duplicating, the row returned `judgingOnly: true` with its Devpost source URL, and `getBySlug` returned null.
- AI judge on dev for that row: completed with github, liveUrl, screenshot, and videoTranscript all true, 93 Convex files read, weighted score 58. Video coverage reported 1 of 1 transcribed. The readiness check reported the gateway healthy after the ping budget was raised.
- Test group and story deleted afterward.

## Not shipped

- Gemini YouTube fallback: the Convex AI gateway rejects video file parts ("file part media type video/mp4 not supported"), so videos without captions still score without a transcript. Retry transcripts covers captions that arrive late.

## Task completion log

- 2026-10-25 07:00 UTC: PRD and submitter prompt written.
- 2026-10-25 07:45 UTC: Import, AI judge changes, readiness card, video coverage and retry built and verified on dev. Fixed a pre-existing false positive where a local `components` array counted as Convex components (`length`, `filter`).
