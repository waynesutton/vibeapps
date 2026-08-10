---
name: AI Judge hackathon upgrade
overview: "Implement the 8-phase AI Judge PRD: deterministic scoring facts, git timeline, harness attribution, weighted scores, an authenticated agent judging API, and reliability fixes, with four codebase-specific corrections discovered during review."
todos:
  - id: phase0-rename
    content: "Phase 0: add judgeProvider/judgeModel, backfill migration, update all readers/writers, then remove provider/model (two deploys)"
    status: completed
  - id: phase1-facts
    content: "Phase 1: extractConvexFacts, componentsInstalled vs componentsUsed split, prompt sections, server-side clamps, repoFacts storage and UI panels"
    status: completed
  - id: phase2-truncation
    content: "Phase 2: raise budgets to 40 files / 180k chars, two-tier fetch (60 for facts, 40 for prompt) with priority ordering"
    status: completed
  - id: phase3-git
    content: "Phase 3: fetchCommitHistory, gitFacts with builtDuringEvent (group window from getSubmissionForAnalysis), fork/timeline badges and filter"
    status: completed
  - id: phase4-harness
    content: "Phase 4: detectHarnessSignals with confidence tiers, harnessSignals storage, selfReportedHarness/Model on stories + form fields, UI separation"
    status: completed
  - id: phase5-weights
    content: "Phase 5: aiRubricWeights on judgingGroups, derive weightedScore in queries (not stored), weights editor, ranking with tiebreaks"
    status: completed
  - id: phase6-agent-api
    content: "Phase 6: agentJudgeKeys with SHA-256 hashing, judges type/agentMetadata, pathPrefix HTTP dispatcher, rate-limiter component, advisory toggle, admin UI"
    status: completed
  - id: phase7-reliability
    content: "Phase 7: required GITHUB_TOKEN, GitHub rate-limit backoff, workpool parallelism, repoAccess field and submit-form warning"
    status: completed
isProject: false
---

# AI Judge: hackathon scoring upgrade and agent judging

## PRD validation result

The PRD is accurate against this codebase. Every file, field, constant, and pattern it cites exists and behaves as described. Four corrections and three additions are needed, listed first because they change how phases get implemented.

## Corrections found in codebase review

1. **Do not reuse `hashPassword` for agent API keys (Phase 6a).** The PRD says "hash with the same helper `judgingGroups.ts` already uses." That helper is base64 encoding (`btoa`), reversible, not a hash:

```46:51:convex/judgingGroups.ts
export function hashPassword(password: string): string {
  // Use TextEncoder for browser-compatible base64 encoding
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  return btoa(String.fromCharCode(...data));
}
```

Fine for a shared results-page password, wrong for a bearer credential. Use SHA-256 via `crypto.subtle.digest` instead. Generate and hash the key inside the HTTP action or an action (where `crypto.subtle` is available), store only the hex digest in `agentJudgeKeys.keyHash`, and pass the digest to internal mutations/queries.

2. **Convex `httpRouter` has no `:slug` path params (Phase 6b).** Routes like `/api/judging/:slug/criteria.json` must be registered with `pathPrefix: "/api/judging/"` and one dispatcher handler that parses the remaining path segments manually. Plan one GET dispatcher and one POST route, not six literal routes.

3. **`getSubmissionForAnalysis` must return the group window (Phase 3).** It currently returns only `groupName`. Add `startDate` and `endDate` from the group so `builtDuringEvent` can be computed inside the action without an extra query.

4. **Admin score edits must recompute `weightedScore` (Phase 5).** The PRD covers recomputing weights in queries, but `updateResultScore` in [convex/aiJudge.ts](convex/aiJudge.ts) also writes `totalScore`/`averageScore` directly and would leave a stale stored `weightedScore`. Simplest fix: never store `weightedScore`; always derive it in `getGroupAiResults` / `getGroupAiReportData` from stored `criteriaScores` plus current group weights. Drop the stored field from the data model.

## Additions the PRD should include

- **`@convex-dev/rate-limiter` is not installed** (deps today: crons, resend, workpool, agent-ready). Phase 6c needs `npm install @convex-dev/rate-limiter` plus `app.use(rateLimiter)` in [convex/convex.config.ts](convex/convex.config.ts).
- **`stories` needs explicit schema fields** for `selfReportedHarness` / `selfReportedModel` (Phase 4). The `storyFormFields` system maps dynamic fields via `storyPropertyName`, but the stories table validates every property, so the two optional strings must be added to [convex/schema.ts](convex/schema.ts) and threaded through the submit mutations in `convex/stories.ts` and `convex/submitForms.ts`.
- **The repo-visibility warning (Phase 7) belongs in the judging-group submission form**, which is the hackathon path, not just `StoryForm.tsx`. Implement a small public query (HEAD-style check via action) or do the check client-side against the GitHub API from the form.

## Phase-by-phase implementation

### Phase 0: rename model collision (two deploys)

- Deploy A: add optional `judgeProvider`/`judgeModel` to `aiJudgeResults` in [convex/schema.ts](convex/schema.ts); `saveResult` in [convex/aiJudge.ts](convex/aiJudge.ts) writes both old and new fields; add `backfillJudgeModelFields` internalMutation to [convex/migrations.ts](convex/migrations.ts) (batches of 200, self-scheduling continuation, admin trigger following `triggerYCHackFormMigration`).
- Update readers: `aiResultValidator`, `enrichResults`, `getGroupAiReportData`, `getPublicAiResults`, `getValidatedAiResults`, [src/components/admin/AIJudgeResults.tsx](src/components/admin/AIJudgeResults.tsx), [src/pages/AIJudgeResultsPage.tsx](src/pages/AIJudgeResultsPage.tsx).
- Deploy B (after backfill verified): remove `provider`/`model` from schema and validator.

### Phase 1: deterministic Convex facts

- Add `extractConvexFacts(filePaths, fileContentsByPath)` to [convex/aiJudgeAnalysis.ts](convex/aiJudgeAnalysis.ts): path-based facts (`convexFileCount`, `hasSchema`, `hasHttpRouter`, `hasCrons`, `hasConvexConfig`) plus regex counts (`tableCount`, `indexCount`, `queryCount`, `mutationCount`, `actionCount`, `httpActionCount`, `usesScheduler`, `usesStorage`, `usesVectorSearch`, `usesAuth`, `usesPagination`, `returnsValidatorCount`) with comment stripping before counting.
- Split component detection: `componentsInstalled` (current `extractComponents` output) vs `componentsUsed` (requires `components.<name>` reference in fetched source). Score only on `componentsUsed`.
- Prompt: add `=== VERIFIED CONVEX FACTS ===` section in `buildUserMessage`; rewrite `buildSystemPrompt` so facts are authoritative and the component rule requires usage. Repopulate `convexFeaturesDetected` deterministically from facts.
- Server-side clamps after parse, mirroring the existing liveness clamp: repo not fetched caps 5 criteria at 4; zero tables and zero convex files caps `schema`/`functions` at 2; empty `componentsUsed` caps `advanced` at 6.
- Store `repoFacts` and `componentsUsed` as optional fields on `aiJudgeResults`; thread through `saveResult`, validators, both admin/public UIs (facts panel, installed vs used split).

### Phase 2: fix truncation bias

- Raise `MAX_CONVEX_FILES` 10 to 40, `MAX_TOTAL_REPO_CHARS` 60000 to 180000 in [convex/aiJudgeAnalysis.ts](convex/aiJudgeAnalysis.ts).
- Two-tier fetch: up to 60 Convex files fetched for fact extraction, top 40 by priority (schema, convex.config, http, crons, then size desc) included in the prompt. Facts computed from the wider set.
- Skip the tarball option; contents API is the safe default per the PRD.

### Phase 3: git history and build timeline

- Add `fetchCommitHistory(owner, repo, branch)` (up to 3 pages of 100 commits, committer dates) to the existing `Promise.all` in `analyzeSubmission`.
- Store `gitFacts` on `aiJudgeResults`: `firstCommitAt`, `lastCommitAt`, `commitCount`, `commitCountCapped`, `activeDayCount`, `contributorCount`, `builtDuringEvent` ("in_window" | "started_before" | "no_window_set"), `repoCreatedAt`, `isFork`, `parentRepo` (last three free from the existing repo metadata call).
- Extend `getSubmissionForAnalysis` to return group `startDate`/`endDate` (correction 3).
- No new rubric criterion. Admin UI: timeline badges, fork badge, `builtDuringEvent` filter, force-push limitation tooltip.

### Phase 4: harness and model attribution

- `detectHarnessSignals(filePaths, commits)` in [convex/aiJudgeAnalysis.ts](convex/aiJudgeAnalysis.ts) using the PRD's confidence table (commit trailers high, config dirs medium, lone `AGENTS.md`/`CLAUDE.md` low). Store `harnessSignals` array on `aiJudgeResults`, never collapsed to one string, never fed into scoring (enforced by code comment and by keeping it out of the prompt).
- Add `selfReportedHarness`/`selfReportedModel` to `stories` schema, submit mutations, and `storyFormFields` seed data (addition 2). Label "self-reported, unverified" in UI.

### Phase 5: weighted scoring

- `aiRubricWeights` optional array on `judgingGroups`; weights editor in [src/components/admin/EditJudgingGroupModal.tsx](src/components/admin/EditJudgingGroupModal.tsx) validated against `AI_JUDGE_RUBRIC` keys.
- Derive `weightedScore` in queries from stored `criteriaScores` plus current weights (correction 4); rank on it with tiebreaks `componentsUsed.length`, `depth` score, `_creationTime`. No stored field, no re-run needed on weight change.

### Phase 6: agent judging API

- Schema: `type` and `agentMetadata` on `judges`; new `agentJudgeKeys` table with `by_keyHash` index; `agentScoresAdvisory` on `judgingGroups` (default true).
- New [convex/agentJudges.ts](convex/agentJudges.ts): key create/revoke (SHA-256, raw key shown once, per correction 1), key verification internal query, agent queue query respecting `judgesPerSubmission` and existing completions.
- HTTP: `pathPrefix`-based dispatcher in [convex/http.ts](convex/http.ts) (correction 2) serving criteria.json, submissions.json, submission detail, scores POST, results.json, openapi.json. Auth via `x-judge-key`. Score writes are idempotent through the existing `by_judge_story_criteria` unique index and write completions to `submissionJudgeCompletions`.
- Rate limiting: install `@convex-dev/rate-limiter` (addition 1), sliding window per key on writes, lower ceiling on list reads. 429 with retry-after, 403 on revoked keys.
- Agent discovery: extend the agent-ready content already registered via `registerRoutes` so `/agents.md` documents the judging API.
- UI: key management and advisory toggle in `EditJudgingGroupModal.tsx`; agent badges/filters in [src/components/admin/JudgeTracking.tsx](src/components/admin/JudgeTracking.tsx) and [src/components/admin/JudgingResultsDashboard.tsx](src/components/admin/JudgingResultsDashboard.tsx); advisory scores excluded from ranking until promoted.

### Phase 7: reliability

- `GITHUB_TOKEN` required: fail the run with a named error instead of silent unauthenticated fallback in `fetchGithubContext`.
- Read `x-ratelimit-remaining`/`retry-after` on GitHub responses, back off and retry once, then fail with a named message.
- Replace the sequential scheduler chain in `startReview`/`saveResult` with the already-installed workpool at `maxParallelism: 4`.
- Store `repoAccess: "public" | "private_or_missing"` on results; private-repo warning in the judging-group submission form (addition 3) and badge in admin results.

## Rollout order

Ship Phases 0 through 3 as one release (two deploys for the Phase 0 rename), then re-run every existing group so results share one methodology. Phases 4 through 7 ship independently after.

## Verification per release

- `npx convex codegen` and `tsc --noEmit` clean; ESLint clean on touched files
- Same repo analyzed twice yields identical `repoFacts` and `convexFeaturesDetected`
- Installed-but-unused component caps `advanced` at 6
- Pre-window first commit shows `started_before` badge
- Agent key round trip: fetch criteria, fetch queue, POST scores twice (one row per criterion), revoke key returns 403
- With `agentScoresAdvisory: true`, ranking unchanged by agent scores
- Unset `GITHUB_TOKEN` fails loudly rather than scoring everyone 1 to 4
