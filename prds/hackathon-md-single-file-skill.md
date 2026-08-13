# Single-file hackathon.md support and hackathon skill API removal

Created: 2026-08-12 21:12 UTC
Last Updated: 2026-08-13 06:35 UTC
Status: Done

## Problem

The hackathon agent skill was simplified. It now maintains exactly one file, `hackathon.md`, at the participant's project root. No manifest publish step, no registration codes, no skill API. Two gaps:

1. The old `/api/hackathon/{slug}` skill API (registration codes, rules.json, status, check) is no longer needed and should be removed, including the admin enable toggle.
2. Participants with a private repo or no repo have no way to hand the judge their `hackathon.md`. A paste path on the submission form does not exist yet.

## Proposed solution

### Remove the skill API

- `convex/http.ts`: delete the entire "Hackathon skill API" block (rate limiter, auth helper, OpenAPI builder, GET and POST dispatchers).
- `convex/hackathon.ts`: keep only `normalizeProjectUrl` and `groupHasDuplicateUrl` (used by `stories.submit`). Delete `validateCode`, `registerTeam`, `getRules`, `getStatusForUrl`, `updateHackathonSettings`, `listRegistrations`.
- `src/components/admin/judging/GroupHackathonSection.tsx`: delete; remove its usage from `AdminJudgingGroupPage.tsx`.
- `convex/judgingGroups.ts`: stop returning the hackathon skill fields from group details.
- `convex/schema.ts`: keep `hackathonSkillEnabled`, `hackathonRegistrationCodes`, `hackathonRules`, `hackathonRulesUpdatedAt`, and the `hackathonRegistrations` table as deprecated optional fields so existing production rows stay valid. No data migration.
- The `/hackathon.json` manifest fetch in `aiJudgeAnalysis.ts` stays untouched so existing prompts stay byte-identical.

### Pasted hackathon.md path

- Schema: `stories.hackathonLog: v.optional(v.string())`, `aiJudgeResults.logDiscrepancies: v.optional(v.array(v.string()))`, `storyFormFields.fieldType` gains `"textarea"`.
- Sanitizer (`convex/stories.ts`, exported): reject over 20,000 chars with a readable error; redact `sk-`, `pk_`, `ghp_`, `gho_`, `github_pat_`, `xox[baprs]-`, `AKIA`, three-segment JWTs, and Convex deploy keys with `[redacted]`.
- All four submission paths store the sanitized value: `stories.submit`, `stories.submitAnonymous`, `stories.submitDynamic`, `submitForms.submitFormData`.
- Built-in disabled `hackathonLog` textarea field in `storyFormFields.initializeDefaultFields` plus `ensureHackathonLogField` for existing deployments.
- Forms (`StoryForm.tsx`, `DynamicSubmitForm.tsx`, `JudgingGroupSubmitPage.tsx`): render textarea fields with a monospace font, character counter, and the warning line "This will be read by judges. Do not paste API keys, env values, or personal data."
- AI judge (`aiJudgeAnalysis.ts`):
  - When the story has `hackathonLog` and the repo returned no `hackathon.md`, inject it into the PROJECT LOG FILES section labeled `--- FILE: hackathon.md (pasted at submission; self-reported) ---`, truncated to `MAX_LOG_FILE_CHARS`. When the repo copy exists, it wins and a one-line note says the pasted copy was ignored. No `hackathonLog` means byte-identical prompt text.
  - `parseHackathonLogHeader(md)` parses `- **Field:** value` lines into event, project, liveApp, repo, frontend, convexDeployment, components, features, auth, aiModels, started, lastUpdated. Never throws.
  - Cross-checks (recorded in `logDiscrepancies`, never scored): frontend claim vs `detectFrontendHosting`; claimed components vs convex.config.ts scan; claimed auth vs package.json dependency map (Clerk, WorkOS, Convex Auth, Better Auth, none).
  - `buildSystemPrompt` gains two sentences about self-reported hackathon.md never raising a score.
- Admin results (`AIJudgeResults.tsx`): show the claimed event beside the row badges and an expandable log-mismatch indicator. Admin query only; public results unchanged.

## Files to change

`convex/schema.ts`, `convex/hackathon.ts`, `convex/http.ts`, `convex/stories.ts`, `convex/submitForms.ts`, `convex/storyFormFields.ts`, `convex/judgingGroups.ts`, `convex/aiJudge.ts`, `convex/aiJudgeAnalysis.ts`, `src/components/StoryForm.tsx`, `src/components/DynamicSubmitForm.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`, `src/pages/AdminJudgingGroupPage.tsx`, `src/components/admin/FormFieldManagement.tsx`, `src/components/admin/AIJudgeResults.tsx`. Deleted: `src/components/admin/judging/GroupHackathonSection.tsx`.

## Edge cases

- Old `aiJudgeResults` rows with `logDiscrepancies` undefined render fine (optional everywhere).
- Malformed pasted markdown never throws in the parser.
- Header auth values outside the provider map compare as written so future providers degrade to a readable string.
- Repo `hackathon.md` and pasted log both present: repo wins, one-line note, never both in full.
- Existing groups with the old hackathon fields keep their data; the admin card is simply gone.

## Verification

- `npx convex codegen` clean, `tsc` clean for touched files.
- No-log submission produces byte-identical judge prompt (code inspection: every new prompt branch is gated on `hackathonLog`).
- Pasted `sk-` string stores `[redacted]`.
- 25,000-char paste rejected with a readable error on all four paths.
- Log claiming Vercel against Netlify detection produces a discrepancy string and unchanged weights.

## Task completion log

- 2026-08-12 21:12 UTC: PRD created, implementation started.
- 2026-08-12 21:25 UTC: All work done and verified. Skill API removed (http.ts, hackathon.ts, GroupHackathonSection deleted); schema adds stories.hackathonLog + aiJudgeResults.logDiscrepancies + textarea fieldType with old hackathon fields deprecated in place; new convex/hackathonLog.ts (cap, redaction, header parser) wired through all four submission paths; built-in hackathonLog textarea field seeded on dev; AI judge injects pasted log (repo copy wins), parses the header, records the three cross-checks, and the system prompt carries the self-reported context sentences; admin results show event badge and discrepancy indicator. Convex dev push green, app tsc clean on touched files, zero lints, redaction and parser sanity test passed.
- 2026-08-13 06:35 UTC: Aligned to the public-repo-only event spec. Parser gains whatItDoes and the "Convex features" label; analyzeSubmission stores hackathonLogEvent on aiJudgeResults from the repo-fetched header so the admin event badge works without a pasted log (enrichResults prefers the stored value, pasted-log parsing kept as fallback for old rows). Paste path stays shipped but disabled for this event. Verified: full spec-sample header parses (13 fields), malformed input returns {} without throwing, convex tsc exit 0, dev push green.
