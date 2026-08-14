# Security review — full app

Created: 2026-08-13 06:35 UTC
Last Updated: 2026-08-14 07:24 UTC
Status: In Progress (remediation batches 1-3 done)

## Problem

Run a security review (`/sec-check`) across the entire Convex + Clerk + Resend app: the full public function surface, data exposure through public queries, and integrations (webhooks, crons, schedulers, email, uploads, AI, dependencies). Convex functions registered with `query`/`mutation`/`action` are callable by anyone with the deployment URL, unauthenticated. Frontend gating and Clerk sign-in rules do not protect the function API.

## Method

Three parallel source audits plus direct verification of the headline findings and a dependency audit.

- Total public functions (query/mutation/action, excluding `internal*`): 341
- Gated in-handler (auth/admin/permission/session): ~230
- Intentionally public by design: ~89
- Ungated findings: 22

## Auth architecture (verified sound)

- `requireAuth` (`convex/auth.ts:6`) throws without identity, returns the Clerk user id. Correct for mutations.
- `requireAuth` (`convex/utils.ts:9`) returns `{ user: null }` in query context instead of throwing; only used by `alerts.ts`, `bookmarks.ts`, `emailSettings.ts`, all of which null-check. OK.
- `requireAdminRole` (`convex/users.ts:366`) checks the Clerk JWT claim `identity.role === "admin"`; does not read the DB `users.role` field.
- `adminAccess.ts` helpers (`requirePermission`, `requireJudgingGroupPermission`, `requireFullAdmin`, `getAccessContext`) are the primary correct gate: full admin via JWT, otherwise a delegated grant row in `adminPermissions`.
- Judging uses a session-token model: `registerJudge` issues a `sessionId`; score/read functions look up the judge by `sessionId` and derive the group from the judge record (they do not trust a client `groupId`).

Cross-cutting note: the DB `users.role` field is effectively unused for authorization (only `reports.ts:26` reads it and never consumes the result). This lowers the present-day impact of the "set as admin" backdoors, but they remain unauthenticated arbitrary writes and a latent escalation path if any future check keys off DB role.

## Findings

### Critical — unauthenticated privilege escalation and PII dump (leftover [TEMPORARY] debug code) — FIXED 2026-08-13

1. `convex/users.ts` `setUserAsAdminByUsername` — no auth; patched any user's `role` to `"admin"`. **Deleted.**
2. `convex/users.ts` `setUserAsAdminByEmail` — no auth; same by email. **Deleted.**
3. `convex/users.ts` `listAllUsersForDebug` — no auth; returned every user's name, email, username, role. **Deleted.**
4. `convex/emails/broadcast.ts` `debugUsers` and `searchUsers` — `requireAdminRole` was commented out; any signed-in user dumped/searched all users' email + clerkId. **Fixed:** restored `requirePermission(ctx, "emails.send")` on both and removed the PII `console.log`s. Functions kept because the admin `EmailManagement.tsx` recipient picker uses them.

### High — unauthenticated write / self-escalation — FIXED 2026-08-13

5. `convex/users.ts` `setCurrentUserAsAdminTemp` — any signed-in user set their own `role` to `"admin"`. **Deleted.**

### High — PII exposure through public queries (email / clerkId) — FIXED 2026-08-13

6. `convex/users.ts` `getUserProfileByUsername` — story-level fields were stripped, but the top-level user object still returned `email` and `clerkId`. **Fixed:** dropped those fields from `userInProfileValidator` and the handler projection. Own-profile UI now uses a server-computed `isOwnProfile` boolean instead of comparing Clerk ids on the client.
7. `convex/follows.ts` `getFollowers` and `getFollowing` — returned raw user docs (email, clerkId, role, ban/pause flags). **Fixed:** explicit public projection (`_id`, `name`, `username`, `imageUrl`, `isVerified`).
8. `convex/adminFollowsQueries.ts` `getTopUsersByFollowers` and `getTopUsersByFollowing` — named "admin" but ungated; returned raw user docs. **Fixed:** `requirePermission(ctx, "numbers.view")` plus a name/username/count projection. `getTotalFollowRelationships` gated the same way.

### High — content and results exposure — FIXED 2026-08-14

9. `convex/stories.ts` public lists/detail leak submitter PII and internal moderation fields. **Fixed:** `fetchTagsAndCountsForStories` strips email, authorEmail, team member emails, rejection/spam fields, customMessage, and changeLog by default. `listPending` keeps PII and now requires `moderation.view`. `getBySlug` and `_getStoryDetailsBatch` no longer map those fields. `dynamicFormValues` stay (shown on story pages).
10. `convex/stories.ts` `listPending` — no auth; paginates pending stories. **Fixed:** `requirePermission(ctx, "moderation.view")`.
11. `convex/users.ts` `listUserStories` — no status filter. **Fixed:** only `status === "approved"` and not hidden; PII stripped via the batch helper.
12. `convex/judgeScores.ts` `getValidatedGroupScores` and `convex/aiJudge.ts` `getValidatedAiResults` — client-trusted password bypass. **Fixed:** both take `password`, re-verify SHA-256 (or legacy btoa) server-side, admins still pass. Frontend stores the real password in sessionStorage (not `"true"`). `getPublicGroupJudgeDetails` no longer returns `judgeEmail`.
13. `convex/judgingGroupSubmissions.ts` `getGroupSubmissions` — no session check. **Fixed:** requires `sessionId` matching a judge in that group. `getSubmissionNotes` requires session or `judging.tracking`. Team emails stay for valid judge sessions.

### Medium — FIXED 2026-08-14 (14, 15, 17, 21)

14. `convex/judges.ts` `registerJudge` — did not enforce the group password; `sessionId` used `Math.random()`. **Fixed:** optional `password` arg is required when the group has `judgePassword` (or legacy `password`); session ids from `crypto.getRandomValues` (32 bytes hex).
15. `convex/judgingGroupSubmissions.ts` `updateSubmissionStatus` — trusted client `judgeId`. **Fixed:** takes `sessionId` and resolves the judge from it. `addSubmissionNote` uses `sessionId` for judges; admin Judge Tracking still passes `judgeId` behind `judging.tracking`.
17. `convex/comments.ts` `listPendingByStory` — no auth. **Fixed:** `requirePermission(ctx, "moderation.view")`.
21. `convex/judgingGroups.ts` `hashPassword` was reversible `btoa`. **Fixed:** SHA-256 hex via `crypto.subtle.digest`. `verifyPassword` still accepts legacy btoa hashes so existing groups keep working until the password is saved again. Event kit export can no longer decode SHA-256 hashes (legacy btoa rows still decode).

### Medium — deferred

16. Four ungated `generateUploadUrl` functions mint storage upload URLs with no auth: `convex/stories.ts:999`, `convex/submitForms.ts:679`, `convex/users.ts:1009`, `convex/convexBoxConfig.ts:134` (the last exists only for the admin logo). Anonymous storage-write / cost-abuse vector; no server-side content-type or size validation found. Contrast `convex/tags.ts:587`, which gates its upload URL with `requirePermission(ctx, "tags.manage")`. Anon submit needs upload URLs, so this stays until a dedicated submit-token design.
18. `convex/dmReactions.ts:132` `getMessageReactions` — no participant check; given a `messageId`, returns who reacted (id + name). Private DM metadata leak.
19. `convex/forms.ts:71` `getFormResultsBySlug` — when `resultsArePublic` is on, returns raw respondent `formSubmissions.data` (potential PII). Depends on the admin toggle and what the form collects.
20. `convex/emails/linkHelpers.ts:44` — unsubscribe token uses `Math.random()` and embeds the userId. Single-use and expiring (`unsubscribe.ts:23`), so impact is limited to unsubscribing others, but it is forgeable. Use `crypto.randomUUID()`/`crypto.getRandomValues`.
22. `convex/users.ts` `fixMissingEmails`, `convex/judgingCriteria.ts:228` `getCriterion` — minor: ungated counts / config disclosure. (`getTotalFollowRelationships` was listed here; now gated with `numbers.view`.)

### Intentionally public but abusable (rate-limit / add checks)

- `convex/stories.ts:846` `submitAnonymous` and `convex/submitForms.ts:536` `submitFormData` — unauthenticated, auto-approve, can create tags; the per-email 10/day rate limit is bypassable by changing the email. Spam/content-injection vector.
- The four `generateUploadUrl` functions above.

### Dependencies (npm audit)

- Started at 24 vulnerabilities (2 critical, 16 high). `@auth/core` bumped to `^0.41.3` (cleared the critical email-normalization advisory; the package is otherwise unused).
- Removed `@clerk/clerk-sdk-node` (deprecated EOL Jan 2025, unused beyond a commented import at `convex/users.ts:1109`); cleared the transitive `js-cookie` high and `@clerk/shared` critical. Down to 2 moderate.
- Remaining: `react-router` / `react-router-dom` (2 moderate — open redirect via backslash in `<Link>`/`useNavigate`, and constructor injection via `deserializeErrors()` in SSR hydration). Advisory range is `6.0.0 - 7.17.0`, so no patched 6.x exists; the only fix is React Router 7 (breaking). App is a Vite SPA (no SSR), so the hydration bug is not exercised; the open-redirect needs a user-controlled URL passed to navigation.

## Verified OK (not findings)

- Clerk webhook: svix `Webhook.verify` with `CLERK_WEBHOOK_SECRET` before processing (`convex/clerk.ts:46`); raw body passed correctly (`convex/http.ts:33`); handler is an `internalAction`.
- Resend webhook: handled by `@convex-dev/resend`, verifies svix signature with `RESEND_WEBHOOK_SECRET`; callback `handleEmailEvent` is an `internalMutation`.
- Schedulers/crons: every `ctx.scheduler.run*` (40+ sites) and all crons target `internal.*`; zero `api.*` scheduling.
- CORS `*` only on public discovery files (robots/llms/sitemap/markdown); none on webhooks/unsubscribe/judging API.
- Agent judging HTTP API: 256-bit UUID keys stored only as SHA-256 hashes, admin-gated creation, per-request auth with slug scoping, read/write rate limits.
- Secrets: zero `process.env` in `src/`; all API keys server-side in `convex/`; frontend uses only `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY`.
- Email sends: `sendTestEmail` and all broadcast senders require `emails.send`; bulk senders are `internalAction`s; all `test*` email files require admin.
- AI prompts contain only public submission content plus submitter display name; no emails/PII; entry-point analysis actions are `internal*`.
- `migrations.ts`: backfills are `internalMutation`s; both public triggers require `requireAdminRole`.
- `siteFiles.ts`: entirely `internal*`.
- Broad gated surfaces confirmed: `adminAccess.ts`, `adminQueries.ts`, `adminJudgeTracking.ts`, `activityLog.ts`, `spamCheck.ts` (incl. the new `requestSpamReview`/`getMySpamStatus`/`dismissSpamReviewRequest`), `tags.ts`, `storyFormFields.ts` (incl. new `getChoiceAnswerCounts`), `settings.ts`, `emailTemplates.ts`, `sendEmails.ts`, moderation mutations in `stories.ts`/`comments.ts`, `users.ts` `*ByAdmin`, `forms.ts`/`submitForms.ts` admin CRUD.

## Proposed remediation order

1. Delete the leftover `[TEMPORARY]` backdoors in `convex/users.ts`. **Done (batch 1).**
2. Restore the admin gate in `convex/emails/broadcast.ts` `debugUsers`/`searchUsers`. **Done (batch 1).**
3. Stop returning `email`/`clerkId` from `getUserProfileByUsername`, `follows.getFollowers`/`getFollowing`, `adminFollowsQueries.getTopUsersBy*`. **Done (batch 2).**
4. Project public story shapes in `stories.ts` and gate/limit `listPending`, `users.listUserStories` (findings 9-11). **Done (batch 3).**
5. Enforce `resultsIsPublic`/password server-side in `getValidatedGroupScores` and `getValidatedAiResults`; gate `getGroupSubmissions`; strip `judgeEmail` from public results (findings 12-13). **Done (batch 3).**
6. Enforce the group password in `registerJudge`, validate `sessionId` (not raw `judgeId`) in `updateSubmissionStatus`, switch session generation to `crypto` (findings 14-15). **Done (batch 3).** Finding 20 (unsubscribe tokens) still deferred.
7. Add auth + server-side type/size validation to the `generateUploadUrl` functions; gate the convexBoxConfig one behind `settings.manage` (finding 16). **Deferred** (anon submit needs upload URLs).
8. Gate `comments.listPendingByStory`, replace `btoa` password hashing with SHA-256 (findings 17, 21). **Done (batch 3).** Finding 18 (`dmReactions`) still deferred.
9. Plan a tested React Router 7 upgrade to clear the last 2 moderate CVEs.

## Edge cases / notes

- Removing/gating public functions can break frontend callers (profile pages, follower lists, judging results). Each fix needs a caller check plus a UI pass; this is why the review does not auto-apply them.
- Public projections should use explicit `returns` validators and derive frontend types via `FunctionReturnType` so stripped fields cannot silently return.

## Task completion log

- 2026-08-13 06:35 UTC — Review complete across auth surface (341 public fns), data exposure, and integrations. 22 ungated findings (4 critical, 4 high PII, several high content/results). Dependency count reduced from 24 to 2 (removed dead `@clerk/clerk-sdk-node`, bumped `@auth/core`). No security code changed yet; remediation plan above pending go-ahead.
- 2026-08-13 06:52 UTC — Remediation batch 1 (findings 1-5): deleted the four `[TEMPORARY]` backdoors from `convex/users.ts` (`setUserAsAdminByUsername`, `setUserAsAdminByEmail`, `listAllUsersForDebug`, `setCurrentUserAsAdminTemp`) after confirming zero callers; restored `requirePermission(ctx, "emails.send")` on `broadcast.debugUsers`/`searchUsers` and removed their PII `console.log`s. Convex `tsc` clean, zero lints. Remaining findings (6-22) pending.
- 2026-08-14 06:58 UTC — Remediation batch 2 (findings 6-8): stripped `email`/`clerkId` from `getUserProfileByUsername` (`userInProfileValidator` + handler), added server `isOwnProfile`; projected `getFollowers`/`getFollowing` to name/username/image; gated `adminFollowsQueries` with `numbers.view` and the same public projection. Profile page and NumbersView updated. Convex `tsc` exit 0, zero new frontend type errors. Remaining findings 9-22 pending.
- 2026-08-14 07:24 UTC — Remediation batch 3 (findings 9-15, 17, 21): public story queries strip submitter/moderation PII; `listPending` and `listPendingByStory` require `moderation.view`; `listUserStories` is approved-only; results/AI queries re-check the password server-side; `getGroupSubmissions`/`updateSubmissionStatus`/`getSubmissionNotes` use judge `sessionId`; `registerJudge` re-checks the group password and uses `crypto.getRandomValues`; judging passwords are SHA-256 with legacy btoa verify. Convex `tsc` exit 0. Remaining deferred: 16, 18, 19, 20, 22, React Router 7.
