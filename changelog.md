# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Change Log](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Latest Updates

### [Added] - 2026-08-17

**QR codes and a join page for judging group submission forms**

- Every judging group with a custom submission page now has its own QR code, shown inline in the group workspace under Shareable links. Admins can copy the join link, download a print-resolution PNG for signage, download a vector SVG, or preview the page (2026-08-17).
- New public join page at `/judging/{slug}/join`, the QR target. Signed-in scanners go straight to that group's submission form. Signed-out scanners see the group name, header image, and description, then sign in or sign up and land back on the form.
- Fixed a related dead end: the sign-in and sign-up links on `/judging/{slug}/submit` previously dropped users on the homepage after authenticating, because they carried no return URL. They now return to the group's form.
- `/sign-in` and `/sign-up` accept a `redirect_url` query param and pass it to Clerk as `forceRedirectUrl`, carrying it across the switch between the two. Only rooted same-origin paths are accepted, so a crafted link cannot redirect a freshly signed-in user off-site.
- QR codes render client side from the live join URL, so renaming a group slug updates them immediately and nothing is stored. Submission page passwords are unchanged: the gate still applies after authentication and no password is embedded in the code.
- **Files**: `src/pages/JudgingGroupJoinPage.tsx` (new), `src/components/admin/judging/GroupJoinQrCard.tsx` (new), `src/lib/redirectPath.ts` (new), `src/pages/JudgingGroupSubmitPage.tsx`, `src/pages/SignInPage.tsx`, `src/pages/SignUpPage.tsx`, `src/components/admin/judging/GroupLinksSection.tsx`, `src/App.tsx`, `package.json`. Tracked in `prds/judging-group-qr-join.md`.

### [Fixed] - 2026-08-14

**Security remediation batch 3: judging passwords, story PII, and session gates**

- Public story lists and detail no longer return submitter email, team emails, rejection/spam fields, customMessage, or changeLog. Pending-story and pending-comment admin queries require `moderation.view`. `listUserStories` is approved and visible only (2026-08-14).
- Password-protected judging and AI results queries re-check the password on the server. The results pages store the real password in sessionStorage instead of a `"true"` flag. Public judge details omit email.
- Judge APIs (`getGroupSubmissions`, `updateSubmissionStatus`, notes) require a judge `sessionId`. `registerJudge` re-checks the group password and issues session ids from `crypto.getRandomValues`.
- Judging group passwords are SHA-256 hex. Existing `btoa` hashes still verify until the password is saved again. The Links event kit can decode legacy hashes only.
- **Files**: `convex/stories.ts`, `convex/validators.ts`, `convex/users.ts`, `convex/comments.ts`, `convex/judgeScores.ts`, `convex/aiJudge.ts`, `convex/judgingGroupSubmissions.ts`, `convex/judges.ts`, `convex/judgingGroups.ts`, plus the public results, AI results, judging, and Judge Tracking pages. Tracked in `prds/security-review-2026-08-13.md`.

### [Fixed] - 2026-08-13

**Security remediation batch 2: strip email and clerkId from public profile queries**

- Public profile query no longer returns email or Clerk id. Own-profile UI uses a server-computed `isOwnProfile` flag instead of comparing Clerk ids on the client (2026-08-13).
- Follower and following lists return name, username, and avatar only.
- Admin Numbers follow rankings now require `numbers.view` and return name, username, and counts only (no email or clerkId).
- **Files**: `convex/users.ts`, `convex/validators.ts`, `convex/follows.ts`, `convex/adminFollowsQueries.ts`, `src/pages/UserProfilePage.tsx`, `src/components/admin/NumbersView.tsx`. Tracked in `prds/security-review-2026-08-13.md`.

### [Fixed] - 2026-08-13

**Security remediation batch 1: removed admin backdoors and restored an email gate**

- Deleted four leftover `[TEMPORARY]` debug functions from `convex/users.ts` that were callable by anyone with the deployment URL: two that set any user to admin, one that dumped every user's email/username/role, and one that let any signed-in user make themselves admin. None had any caller in the app (2026-08-13).
- Restored the permission check on `convex/emails/broadcast.ts` `debugUsers` and `searchUsers` (previously commented out, which let any signed-in user read every user's email and Clerk id) and removed the debug logging that wrote user emails into server logs (2026-08-13).
- **Files**: `convex/users.ts`, `convex/emails/broadcast.ts`. Tracked in `prds/security-review-2026-08-13.md`.

### [Security] - 2026-08-13

**Full-app security review and dependency cleanup**

- Ran a full `/sec-check` across all 341 public Convex functions (auth enforcement, data exposure, integrations). Documented 22 ungated findings, headlined by leftover `[TEMPORARY]` unauthenticated admin-escalation and user PII-dump functions in `convex/users.ts`, commented-out admin checks in `convex/emails/broadcast.ts`, email/clerkId exposure through public profile/follow queries, submitter PII on public story lists, and a client-trusted password bypass on the "validated" judging/AI results queries (2026-08-13).
- Verified sound: Clerk and Resend webhook signature verification, all schedulers and crons target internal functions, secrets are server-side only, the agent judging HTTP API, and migration gating.
- **Fixed**: removed the deprecated, unused `@clerk/clerk-sdk-node` dependency and bumped `@auth/core` to `^0.41.3`, reducing `npm audit` from 24 vulnerabilities (2 critical, 16 high) to 2 moderate. The 2 remaining are React Router advisories with no patched 6.x; clearing them needs a breaking React Router 7 upgrade (2026-08-13).
- **Docs**: `prds/security-review-2026-08-13.md` (findings, verified-OK list, and prioritized remediation plan). Backend findings are review-only; no security code changed yet.

### [Added] - 2026-08-13

**Dropdown field type, modern choice controls, answer counts, and judge answer filter**

- New Dropdown (select) choice field type alongside Radio and Multi-select, available in Admin, Forms, Manage Form Fields and in judging group custom questions; same options editor and the same server-side validation (single value must match the configured options, minimum two options) (2026-08-13).
- Radio buttons and checkboxes on all submit forms restyled as larger custom controls that follow the site themes (20px, tappable full-width rows with hover and selected states); dropdown fields render with the site's themed select instead of the browser default.
- Admin field rows for choice fields now show live answer counts: a mini bar per option with its count and a responses total, aggregated from submitted answers in `dynamicFormValues`.
- Judges can filter a group's submissions by a choice answer: a new "Filter by answer" dropdown in the judging interface lists every field/option pair from dynamic form fields and the group's custom questions, works with multi-select answers, and combines with the existing tag, status, and search filters.
- **Backend**: `convex/schema.ts`, `convex/storyFormFields.ts` (`getChoiceAnswerCounts`), `convex/judgingGroups.ts`, `convex/submitForms.ts`.
- **Frontend**: `src/components/ui/ChoiceFieldInput.tsx`, `src/pages/JudgingInterfacePage.tsx`, `src/components/admin/FormFieldManagement.tsx`, `src/components/admin/judging/GroupSubmitPageSection.tsx`, `src/components/admin/judging/groupSection.tsx`, plus placeholder pass-through in the five submit forms.
- **Docs**: `prds/story-form-choice-fields.md` (follow-up section).


### [Added] - 2026-08-13

**Radio and multi-select story form fields**

- Admins can now create Radio (single choice) and Multi-select (checkboxes) questions in Admin, Forms, Manage Form Fields, with an options editor (one option per line, minimum two) alongside the existing text, url, email, and textarea types (2026-08-13).
- Judging group custom questions gained the same two types with the same options editor, and the existing per-question Required and Shown/Hidden controls apply to them unchanged.
- Choice fields render everywhere submissions happen: the main submit form, dynamic submit forms, the judging group submit page (both dynamic fields and custom questions), and the YC Hack and Resend forms, via a shared `ChoiceFieldInput` component with native required validation and screen reader labeling.
- Answers stay plain strings (multi-select stores a comma-joined list in the configured option order), so judge views, CSV exports, and the AI judge keep working without changes. The server validates submitted values against the configured options before saving.
- Story pages now show answers for admin-added fields stored in `dynamicFormValues` (including choice answers) in the Project Links & Tags sidebar.
- **Backend**: `convex/schema.ts`, `convex/storyFormFields.ts`, `convex/judgingGroups.ts`, `convex/submitForms.ts`.
- **Frontend**: `src/components/ui/ChoiceFieldInput.tsx` (new), `src/components/StoryForm.tsx`, `src/components/DynamicSubmitForm.tsx`, `src/components/YCHackForm.tsx`, `src/components/ResendForm.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`, `src/components/admin/FormFieldManagement.tsx`, `src/components/admin/judging/GroupSubmitPageSection.tsx`, `src/components/admin/judging/groupSection.tsx`, `src/components/StoryDetail.tsx`.
- **Docs**: `prds/story-form-choice-fields.md` (new).


### [Added] - 2026-08-13

**In-app spam review requests**

- The spam alert on the notifications page now has a Request review button. Clicking it stamps the submission and logs a `spam.reviewRequested` entry in the admin Activity tab with the submitter as the actor, so disputes no longer depend on email deliverability (2026-08-13).
- One request per mark: the button flips to a persistent "Review requested" chip, and repeat clicks change nothing. Only the story owner sees the button, and only while the mark stands.
- Disputed rows show an amber "Review requested" badge in the scan results and the Marked spam review, and sort to the top of the review list. Admins resolve with Unmark (restores the post, clears the request) or a new Dismiss action that keeps the mark and logs `spam.reviewDismissed`.
- The spam reason email and the alert copy now point at the in-app button alongside the existing reply-to and GitHub issue paths.
- **Backend**: `convex/schema.ts` (`spamReviewRequestedAt`), `convex/spamCheck.ts` (`requestSpamReview`, `getMySpamStatus`, `dismissSpamReviewRequest`), `convex/emails/spam.ts`.
- **Frontend**: `src/pages/NotificationsPage.tsx`, `src/components/admin/SpamCheck.tsx`, `src/components/admin/AdminDocs.tsx`.
- **Docs**: `prds/spam-request-review.md` (new).


### [Added] - 2026-08-13

**Spam automation agent with auto-mark on submission**

- New Automation card on the AI Spam admin tab with three server-enforced toggles: auto-scan new submissions (default on, now pausable), agent auto-mark spam (default off), and notify submitter on auto-mark (default on), plus a confidence threshold input (default 85, range 50 to 100) (2026-08-13).
- With auto-mark on, a new submission whose automatic scan returns a spam verdict at or above the threshold is marked as spam and hidden immediately, in the same transaction that saves the scan. Manual and batch scans never auto-mark, so re-scanning old content cannot mass-hide it.
- Auto-marked submissions carry a new `spamMarkedByAgent` flag, show an "Auto-marked spam" robot badge in the scan results and the Marked spam review, and log to the Activity tab as "AI Spam Agent" with confidence and reasons. Unmark reverses an auto-mark exactly like a human mark.
- With notifications off the agent marks silently for later review; on, the usual in-app alert and reason email go out, still behind the global email kill switch and the spam notification type toggle.
- The Marked spam review gained a filter by marked date (persisted like the other ranges on the tab). Admin Docs AI spam check section rewritten to cover automation and the review flow.
- **Backend**: `convex/schema.ts` (`spamMarkedByAgent`), `convex/spamCheck.ts` (`getSpamAutomation`, `setSpamAutomation`, auto-mark hook in `saveResult`, auto-scan gate, date args on `listMarkedSpam`).
- **Frontend**: `src/components/admin/SpamCheck.tsx`, `src/components/admin/AdminDocs.tsx`.
- **Docs**: `prds/spam-automation-agent.md` (new).


### [Added] - 2026-08-13

**Marked spam review with bulk delete**

- New "Marked spam" section on the AI Spam admin tab lists every submission currently marked as spam, read straight from the stories table through a new `by_isSpam` index, so marked stories without a scan result row now show up too (2026-08-13).
- Each row shows the title, live URL, author, when it was submitted and marked, which admin marked it, and the reason sent to the submitter, with a per-row Unmark action.
- Select all plus Delete selected permanently removes the chosen submissions and their comments, votes, ratings, bookmarks, scan rows, and images. Deletes run in chunks of 50, so large selections no longer hit the bulk action cap; the scan-results bulk delete uses the same chunked path.
- **Backend**: `convex/schema.ts` (`by_isSpam` index), `convex/spamCheck.ts` (`listMarkedSpam`).
- **Frontend**: `src/components/admin/SpamCheck.tsx`.
- **Docs**: `prds/marked-spam-review-bulk-delete.md` (new).


### [Fixed] - 2026-08-13

**Story pages 404 on refresh after per-app markdown launch**

- Netlify redirect placeholders and splats only match whole path segments, so the `/s/:slug.md` and `/s/*.md` proxy rules over-matched and sent plain story URLs like `/s/socialnestapp` to Convex, which returned 404 on refresh (2026-08-13).
- Per-app markdown moved from `/s/{slug}.md` to `/md/{slug}.md` with a safe `/md/*` proxy rule; `/s/{slug}/llms.txt` is unchanged. Convex keeps the old `/s/{slug}.md` path working on its own host. Sidebar, site `/llms.txt`, `/vibeapps.md`, sitemap, and robots all point at `/md/{slug}.md` now.
- The `botMeta` edge function now only intercepts single-segment `/s/{slug}` paths for bots, so crawlers fetching `/s/{slug}/llms.txt` reach the file instead of meta HTML.
- **Files**: `public/_redirects`, `netlify/edge-functions/botMeta.ts`, `convex/siteDirectory.ts`, `convex/http.ts`, `src/components/StoryDetail.tsx`, `public/robots.txt`.


### [Added] - 2026-08-13

**Per-submission llms.txt and markdown files**

- Each public app now has live `/s/{slug}/llms.txt` and `/s/{slug}.md` generated from the same approved, visible, not-spam, not-archived rules as the site directory (2026-08-13).
- The story sidebar lists `llms.txt` and `{slug}.md` above View Change Log. Hidden or unpublished apps do not show the links and the HTTP routes 404.
- Footer `/llms.txt` and `/vibeapps.md` list those per-app URLs next to each app. The sitemap includes them. Production Netlify proxies `/s/:slug/llms.txt` and `/s/*.md` to Convex.
- **Backend**: `convex/siteDirectory.ts`, `convex/siteFiles.ts` (`getPublicStoryBySlug`), `convex/http.ts`.
- **Frontend**: `src/components/StoryDetail.tsx`, `public/_redirects`.
- **Docs**: `prds/per-submission-llms-and-md.md` (new).


### [Added] - 2026-08-13

**Editable judging group URL slug**

- After a judging group exists, admins can change its URL slug from the pencil next to `/judging/{slug}` in the workspace header, or from Settings (2026-08-13).
- A site-design warning dialog explains that judging, submit, results, AI results, admin, and Agent API links all follow the new slug and that old URLs (including emails already sent) stop working. Save replace-navigates the admin workspace to the new slug and keeps the current section.
- New delegated Access permission `judging.slug` (destructive, same family as delete). Full Clerk admins always can; delegated users with only `judging.manage` cannot. Uniqueness is enforced, invalid slugs are rejected, and unchanged slugs are a no-op.
- **Backend**: `convex/adminAccess.ts`, `convex/judgingGroups.ts` (`updateGroupSlug`).
- **Frontend**: `src/components/admin/judging/GroupSlugEditor.tsx` (new), `src/pages/AdminJudgingGroupPage.tsx`, `src/components/admin/judging/GroupSettingsSection.tsx`, `src/components/admin/AccessManagement.tsx`, `src/components/admin/AdminDocs.tsx`.
- **Docs**: `prds/judging-group-editable-slug.md` (new).


### [Added] - 2026-08-13

**Live llms.txt, vibeapps.md directory, and AEO/SEO extras**

- `/llms.txt` is now a live llmstxt.org index of the site plus every public app (approved, not hidden, not spam, not archived). `/vibeapps.md` is the full markdown directory with title, tagline, live URL, GitHub, tags, and vibes, same idea as the Convex components directory markdown catalog (2026-08-13).
- Footer links to both files. HTTP routes generate from an indexed query on each request (5 minute browser / 1 hour CDN cache) with a daily `siteFiles` fallback. Production Netlify proxies `/llms.txt`, `/vibeapps.md`, `/robots.txt`, and `/sitemap.xml` to the production Convex site host.
- Additive discovery only: existing `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, and Twitter card values are unchanged. New JSON-LD (WebSite + Organization on the homepage, SoftwareApplication on story crawler HTML), canonical URL, `og:locale` / image dimensions, AI crawler allow rules, and a sitemap that lists site pages plus every public app URL.
- **Backend**: `convex/siteDirectory.ts` (new), `convex/siteFiles.ts`, `convex/http.ts`, `convex/crons.ts`, `convex/stories.ts`.
- **Frontend**: `src/components/Footer.tsx`, `src/components/StoryDetail.tsx`, `index.html`, `public/_redirects`, `public/robots.txt`.
- **Docs**: `prds/public-directory-llms-and-aeo.md` (new).


### [Added] - 2026-08-13

**Wider judging submit page, 16:9 header images, and required tag visibility**

- The single column layout on judging group submit pages is now as wide as the main submit page with the sidebar hidden (max-w-4xl instead of max-w-2xl), so the form and hero get real room (2026-08-13).
- New header image shape setting per group: Square (1:1) keeps the adjustable pixel size, Wide (16:9) fills the layout width in both the single column hero and the two column sidebar, built for banner art. Existing groups keep the square crop.
- When a group sets a required tag, a new Shown/Hidden pill under the Required tag picker controls whether submitters see the locked tag on the form (pills, quick select, tag counter). Hidden is display only: the tag is still applied to every submission so entries land in the group, and Tag Management's own hidden flag keeps controlling story cards and tag limits, so the two settings never conflict.
- **Backend**: `convex/schema.ts`, `convex/judgingGroups.ts` (new `submissionPageImageAspect` and `submissionFormRequiredTagVisible` fields).
- **Frontend**: `src/pages/JudgingGroupSubmitPage.tsx`, `src/components/admin/judging/GroupSubmitPageSection.tsx`, `src/components/admin/AdminDocs.tsx`.
- **Docs**: `prds/judging-submit-page-width-and-required-tag-visibility.md` (new).

### [Added] - 2026-08-13

**Judging group activity log with realtime review counts on removal**

- New Activity section in the judging group workspace (below Judge tracking) with a realtime, group-scoped audit trail: submissions added (manual add, tag sync, auto-include, custom submit page) and removed, AI review runs (started, completed, failed, retried, actor "AI Judge"), judge scores, and group setting changes (2026-08-13).
- Removing a submission from a group now also deletes its AI review result alongside the existing score cleanup, so overview stats, human results rankings, and AI counts all update in realtime through Convex reactive queries; the removal log entry records how many scores were deleted and whether an AI review existed. A re-added submission starts clean and gets picked up by the next AI run.
- Log entries carry the story slug so rows link straight to the submission. A dropdown shows 30, 60, or 100 entries with a Load more button; Export CSV and Save as .md download the full audit trail (5000 row cap, newest first); Clear (judging.manage) batch-deletes the group's entries after an in-design confirm.
- Per-group entries live in the same `activityLog` table as the site-wide admin Activity Log (new optional `groupId` field plus `by_groupId` index), so the two views stay in sync automatically; clearing a group's log removes those rows from both. Viewing and exports follow the group's judging.view scope for delegated users.
- Admin Docs: judging groups section documents the Activity log, exports, clear behavior, and the realtime effect of removals.
- **Backend**: `convex/schema.ts`, `convex/activityLog.ts`, `convex/judgingGroupSubmissions.ts`, `convex/stories.ts`, `convex/aiJudge.ts`, `convex/judgingGroups.ts`, `convex/judgeScores.ts`.
- **Frontend**: `src/components/admin/judging/GroupActivitySection.tsx` (new), `src/pages/AdminJudgingGroupPage.tsx`, `src/components/admin/AdminDocs.tsx`.
- **Docs**: `prds/judging-group-activity-log.md` (new).

### [Added] - 2026-08-12

**Admin form fields flow to every submit form with per-group judging overrides**

- Fields created in Admin, Forms, Manage Form Fields now work everywhere. A new field is available on the main submit form, appears on public dynamic submit forms automatically (even forms created before the field existed), and shows up in every judging group's Submit page section as an override row (2026-08-12).
- Values for fields without a dedicated database column are no longer dropped: they persist on the submission in a new `dynamicFormValues` list and judges see them in an "Additional Form Fields" card in the judging interface. Known keys (LinkedIn, X, Chef links, harness, model, hackathon log) keep filling their existing columns through a shared resolver.
- Judging group Submit page controls grew three ways: each admin-managed field can be marked Required/Optional and Shown/Hidden per group (unset falls back to the field's own defaults), the form sections (Hackathon Team Info, Additional Images, Additional link fields) each get a Required pill next to Shown/Hidden with submit-time validation, and per-group custom questions get a Shown/Hidden pill so a question can be paused without deleting it. Custom questions stay scoped to their group and their answers still land in "Additional Answers" for judges.
- The legacy Custom Forms builder sub-tab in the admin Forms section is hidden (commented out with re-enable instructions); Manage Form Fields is the single field system going forward.
- Admin Docs: the custom submission page section now documents the field, section, additional-field, and custom-question controls.
- **Backend**: `convex/schema.ts`, `convex/validators.ts`, `convex/storyFormFields.ts`, `convex/stories.ts`, `convex/submitForms.ts`, `convex/judgingGroups.ts`, `convex/judgingGroupSubmissions.ts`.
- **Frontend**: `src/components/StoryForm.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`, `src/pages/JudgingInterfacePage.tsx`, `src/components/admin/judging/groupSection.tsx`, `src/components/admin/judging/GroupSubmitPageSection.tsx`, `src/components/admin/AdminDashboard.tsx`, `src/components/admin/AdminDocs.tsx`.
- **Docs**: `prds/dynamic-form-fields-judging-overrides.md` (new).

### [Changed] - 2026-08-12

**Hackathon.md judging aligned to public-repo-only events**

- The header parser now captures the skill's full fixed header: added the "What it does" field and the "Convex features" label (previously only "Features" was recognized) (2026-08-12).
- The event badge in admin AI results now works when nothing was pasted: the analysis action parses the repo-fetched hackathon.md header and stores the event on the result row (`aiJudgeResults.hackathonLogEvent`, new optional field). Older rows still fall back to parsing a pasted log.
- No submission form changes for a public-only event. The built-in hackathonLog paste field stays disabled; the only form setup is making the GitHub URL field required and stating the public-repo rule in the form description.
- **Backend**: `convex/hackathonLog.ts`, `convex/schema.ts`, `convex/aiJudge.ts`, `convex/aiJudgeAnalysis.ts`.

### [Added] - 2026-08-12

**Single-file hackathon skill: paste hackathon.md at submission**

- The hackathon agent skill now maintains one file, hackathon.md, at the participant's project root. Public repos need nothing new; the AI judge already reads the file from the repo. Private or no-repo teams can now paste the file's contents into the submission form (2026-08-12).
- New built-in `hackathonLog` textarea form field (ships disabled; an admin enables it per hackathon form) rendered with a monospace font, character counter, and a warning not to paste keys or personal data. Wired through all four submission paths: submit, submitAnonymous, submitDynamic, and submitFormData.
- Pasted logs are treated as untrusted input: capped at 20,000 characters server side with a readable error over the cap, and known secret shapes (sk-, pk*, ghp*, github_pat*, xox, AKIA, JWTs, Convex deploy keys) are replaced with `[redacted]` before storing. New shared module `convex/hackathonLog.ts` holds the cap, redaction, and header parser.
- The AI judge injects the pasted log into the same PROJECT LOG FILES prompt section the repo path uses, labeled as pasted and self-reported. When the repo already returned hackathon.md, the repo copy wins and the pasted one is noted as ignored. Submissions without a pasted log produce byte-identical prompts to before.
- `parseHackathonLogHeader` deterministically extracts the skill's fixed header (event, project, frontend, components, auth, AI models, and more) and powers three recorded-but-never-scored cross-checks stored on `aiJudgeResults.logDiscrepancies`: claimed frontend vs `detectFrontendHosting`, claimed components vs the `convex.config.ts` scan, and claimed auth vs `package.json` dependencies (Clerk, WorkOS, Convex Auth, Better Auth). Deterministic detection keeps driving the frontend weight.
- Admin AI results show an event badge from the header and an expandable amber discrepancy indicator; nothing new appears in public results. The system prompt now tells the model that hackathon.md is self-reported context and a claim contradicted by facts must never raise a score.
- **Backend**: `convex/schema.ts`, `convex/hackathonLog.ts` (new), `convex/stories.ts`, `convex/submitForms.ts`, `convex/storyFormFields.ts`, `convex/aiJudge.ts`, `convex/aiJudgeAnalysis.ts`.
- **Frontend**: `src/components/StoryForm.tsx`, `src/components/DynamicSubmitForm.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`, `src/components/admin/FormFieldManagement.tsx`, `src/components/admin/AIJudgeResults.tsx`.
- **Docs**: `prds/hackathon-md-single-file-skill.md` (new).

### [Removed] - 2026-08-12

**Hackathon skill API endpoints and admin section**

- Removed the `/api/hackathon/{slug}` HTTP API (openapi.json, rules.json, status, register, check), its registration-code auth and rate limiters, the backing queries and mutations in `convex/hackathon.ts`, and the Hackathon skill admin section in the judging group workspace. The single-file hackathon.md flow replaces all of it (2026-08-12).
- The `hackathonRegistrations` table and the hackathon fields on `judgingGroups` stay in the schema as deprecated optional fields so existing rows remain valid; nothing reads or writes them anymore. `normalizeProjectUrl` and the per-group duplicate URL guard in `stories.submit` are unchanged.
- **Backend**: `convex/http.ts`, `convex/hackathon.ts`, `convex/judgingGroups.ts`, `convex/schema.ts`.
- **Frontend**: `src/components/admin/judging/GroupHackathonSection.tsx` (deleted), `src/pages/AdminJudgingGroupPage.tsx`.

### [Added] - 2026-08-12

**AI judge frontend checker with per-platform hosting weights**

- New Frontend checker preset criterion in the Rubric weights card of the AI judging block, added with an explicit Add button like the components check. The AI judge scores the deployed frontend 1-10 (2026-08-12).
- Below the frontend checker row, five hosting platform sub-weights: Codex Sites, Convex static hosting, Vercel, Netlify, and Other, each defaulting to 1 and adjustable 0-10. The detected platform's weight multiplies the frontend checker weight in the weighted ranking, so for example Codex Sites can count 5x while Convex static hosting counts 7x.
- Hosting is detected deterministically during analysis from the live URL host (.chatgpt.site, .convex.site, .vercel.app, .netlify.app), response headers (x-vercel-id, x-nf-request-id, server), and repo signals (.openai/hosting.json, @convex-dev/self-static-hosting, vercel.json, netlify.toml) so custom domains still classify. The result stores platform plus evidence, and weight edits re-rank instantly without re-running reviews.
- The AI prompt gets a FRONTEND HOSTING CHECK facts section, a dead live URL caps the frontend checker score at 3, and the admin results list shows a hosting platform badge per submission.
- **Backend**: `convex/schema.ts`, `convex/aiJudge.ts`, `convex/aiJudgeAnalysis.ts`, `convex/judgingGroups.ts`.
- **Frontend**: `src/components/admin/judging/GroupAiSection.tsx`, `src/components/admin/judging/groupSection.tsx`, `src/components/admin/AIJudgeResults.tsx`.
- **Docs**: `prds/ai-judge-frontend-checker-hosting-weights.md` (new).

### [Fixed] - 2026-08-12

**Public profiles no longer expose moderation data or rejected stories (GitHub issue 15)**

- `getUserProfileByUsername` spread the raw story document into its public response, sending the submitter's email, rejection reason, spam moderation fields, team member emails, and edit history to any client. Those fields are now stripped before the response is returned (2026-08-12).
- Stories that were approved and later rejected still appeared on public profiles because moderation never cleared the denormalized `isApproved` flag. The profile query now filters to approved, non-hidden stories by `status`, and `updateStatus` keeps `isApproved` in sync going forward.
- **Backend**: `convex/users.ts`, `convex/stories.ts`.

### [Fixed] - 2026-08-12

**Removing your last name no longer reverts on refresh (GitHub issue 11)**

- Editing your profile name to a single name appeared to save but reverted on reload: Clerk kept the old last name and the sign-in sync overwrote the Convex name with Clerk's first and last name on every page load (2026-08-12).
- A new `nameCustomized` flag marks the name as user-managed once edited in-app; `ensureUser` and the Clerk webhook sync skip name overwrites when it is set. The profile page also sends an empty last name to Clerk so it clears when the Clerk instance allows optional last names.
- **Backend**: `convex/schema.ts`, `convex/users.ts`.
- **Frontend**: `src/pages/UserProfilePage.tsx`.
- **Docs**: `prds/fix-github-issues-15-and-11.md` (new).

### [Added] - 2026-08-12

**Judging group emails to submission owners**

- The judging group Emails section now has a Send to selector: Judges or Submission owners. Same compose flow (templates, markdown, variables, preview, test send, schedule, daily cap) for both audiences (2026-08-12).
- Submission owners are resolved from group submissions (hidden and rejected skipped), prefer the account email when present, and are deduplicated by address. Sends still use the `judging_group` email type and `judging.emails` permission.
- **Backend**: `convex/emails/judgingGroupEmails.ts` (`listGroupSubmissionOwnerRecipients`, `sendGroupEmail` recipientType / storyIds).
- **Frontend**: `src/components/admin/judging/GroupEmailsSection.tsx`.
- **Docs**: `prds/judging-group-email-submission-owners.md` (new).

### [Changed] - 2026-08-11

**New default Light theme with a soft grey and white mono palette**

- Replaced the warm cream Light theme with a flat monochrome design: soft grey canvas (`#f7f7f7`) with white cards, black text and CTAs, gray inset fills (`#f3f3f3`), and hairline borders (`#e2e2e2`). No accent hue and no shadows in light mode (2026-08-11).
- Selected controls flip polarity so they stay visible on the white canvas: active view mode buttons (list, grid, vibe) and the "All" category pill render black with white icons or text, and sidebar category selection uses a gray fill with a ring.
- Contrast audit for the white canvas: hover states now shift to a visible gray, cards that relied on shadows alone (Recent Vibers, user profile, dynamic submit form) gained hairline borders, and the faintest text tone was set to `#6b6b6b` for 4.9:1 contrast on white. Classic and Dark themes are unchanged.
- **Frontend**: `src/index.css`, `src/components/Layout.tsx`, `src/components/TopCategoriesOfWeek.tsx`, `src/components/RecentVibers.tsx`, `src/pages/UserProfilePage.tsx`, `src/components/DynamicSubmitForm.tsx`.
- **Docs**: `.interface-design/system.md` (palette table and component patterns updated).

### [Changed] - 2026-08-11

**Themed dropdown menus and keyboard-friendly confirm dialogs**

- Every dropdown menu in the app (header category and sort filters, admin settings, judging filters, form builders, email template pickers, and public custom forms) now opens a site-styled panel that follows the active theme in Light, Classic, and Dark, replacing the OS default popup (2026-08-11).
- Built on a new `SimpleSelect` component wrapping the rethemed Radix select primitives with the site's semantic tokens. Dropdowns support full keyboard interaction: open with Enter or Space, arrow keys to move, type-ahead search, Enter to select, Escape to close. The multi-select listbox on public custom forms stays native since it renders inline, not as a popup.
- Confirmation dialogs like "Mark as spam?" are now fully keyboard operable: focus lands on Cancel when the dialog opens, Tab and Shift+Tab move between Cancel and the confirm button, Enter activates the focused button, and Escape still closes. Dialogs also announce themselves correctly to screen readers via `aria-modal`.
- **Frontend**: `src/components/ui/select.tsx`, `src/components/ui/SimpleSelect.tsx` (new), `src/components/ui/AlertDialog.tsx`, `MessageDialog.tsx`, `PromptDialog.tsx`, `src/components/Layout.tsx`, `src/pages/NavTestPage.tsx`, `src/pages/JudgingInterfacePage.tsx`, `src/components/PublicForm.tsx`, and 8 admin components.
- **Docs**: `prds/themed-dropdowns-and-dialog-keyboard.md` (new).

### [Added] - 2026-08-11

**Admin option to hide the /submit sidebar and widen the form**

- New checkbox in Admin Settings ("Submit Page Layout"): when enabled, the default `/submit` page hides the right sidebar (Weekly Leaderboard, Recent Vibers, Top Categories) and the submission form widens from `max-w-2xl` to `max-w-4xl` for every user (2026-08-11).
- Backed by a new `hideSubmitPageSidebar` boolean on the settings singleton, default off so existing sites are unchanged. Only the exact `/submit` path is affected; dynamic `/submit/:slug` pages already hid the sidebar.
- **Backend**: `convex/schema.ts`, `convex/settings.ts`.
- **Frontend**: `src/components/Layout.tsx`, `src/components/StoryForm.tsx`, `src/components/admin/Settings.tsx`.
- **Docs**: `prds/submit-page-sidebar-setting.md` (new).

### [Fixed] - 2026-08-11

**User profiles crashed for accounts with spam-marked submissions**

- Profile pages threw a Convex ReturnsValidationError when the profile owner had a submission an admin confirmed as spam. The `stories` table gained `isSpam`, `spamReason`, `spamMarkedAt`, and `spamMarkedBy` when AI spam moderation shipped, but the shared story return validator was never updated, so any query spreading a spam-marked story doc failed validation (2026-08-11).
- Added the four optional spam fields to `baseStoryValidator` and the matching `StoryWithDetailsPublic` type, fixing `getUserProfileByUsername`, `listUserStories`, and every other query built on `storyWithDetailsValidator`.
- **Backend**: `convex/validators.ts`.

### [Added] - 2026-08-11

**Three-theme system with switcher, plus list and vibe view redesign**

- The app now ships three themes: a new warm Light theme as the default, Classic (the previous look, preserved exactly), and a new Dark theme with a deep black canvas, charcoal surfaces, and hairline borders (2026-08-11).
- A theme switcher with Phosphor icons sits in the header next to the profile icon on desktop and mobile, cycling light, classic, and dark. The choice persists in localStorage and a pre-paint script in `index.html` applies it before first render so there is no flash.
- Every color in the UI (admin dashboard included) now flows through semantic tokens (`canvas`, `surface`, `ink`, `copy`, `hairline`, `cta`, `brand`, and friends) defined as CSS variables per theme and exposed as Tailwind color names. Roughly 1,700 hardcoded hex classes across 79 files were converted.
- Clerk sign-in modals follow the active theme (dark baseTheme in dark mode) and toast notifications are themed through a global sonner Toaster.
- List view redesigned as ranked rows in the style of Product Hunt and the new Digg: rank number, app thumbnail, title, tagline, tag pills, meta row, and an upvote box on the right. Vibe view got a modern refresh in the same language; grid view is unchanged.
- Contrast and border audit across all three themes: tag chip fallback colors adapt per theme (custom tag colors from the database are untouched), CTA text uses an on-cta token so buttons stay readable in dark mode, and dark mode card borders were tuned for visibility.
- **Frontend**: `src/index.css`, `tailwind.config.js`, `index.html`, `src/lib/ThemeContext.tsx` (new), `src/components/ThemeToggle.tsx` (new), `src/main.tsx`, `src/App.tsx`, `src/components/Layout.tsx`, `src/components/StoryList.tsx`, plus 70+ token-converted files under `src/`.
- **Docs**: `prds/theme-system-and-view-refresh.md` (new).

### [Added] - 2026-08-10

**Video transcript enrichment for AI judging**

- The AI judge now reads the submission's demo video, not just its URL. When a review runs, the video is fetched as markdown through the new Context.dev Convex component: YouTube links (`/watch`, `youtu.be`, Shorts, embeds, live) return the title, description, and the caption transcript when the video has captions; other video host pages (Vimeo, Loom, Drive) get a best effort page scrape with a Firecrawl fallback; direct media files and caption-less videos are recorded as having no transcript (2026-08-10).
- Transcripts are persisted in a new `videoTranscripts` table (one row per submission, reused for 7 days per URL) and included in the judge prompt as a clearly labeled unverified builder narrative section. Prompt guardrails: the transcript may support scores for existing criteria but never overrides verified Convex facts, git history, or the live URL check, instructions inside it are ignored, and a missing video never lowers a score since videos are optional.
- The admin AI results dashboard shows a new video source badge next to the repo and site badges, plus an expandable Video Transcript viewer (lazy loaded, gated by the `judging.ai` permission) so organizers can see exactly what the judge read. `sourcesUsed.videoTranscript` is stored on each result.
- New optional `CONTEXT_DEV_API_KEY` deployment env var powers the transcript scraping; reviews run unchanged without it. Documented in the admin docs alongside `FIRECRAWL_API_KEY`.
- **Backend**: `convex/videoTranscripts.ts` (new), `convex/aiJudgeAnalysis.ts`, `convex/aiJudge.ts`, `convex/schema.ts` (new `videoTranscripts` table, `sourcesUsed.videoTranscript`), `convex/convex.config.ts` (Context.dev component).
- **Frontend**: `src/components/admin/AIJudgeResults.tsx`, `src/components/admin/AdminDocs.tsx`.

### [Added] - 2026-08-10

**Web Interface Guidelines UI audit**

- Audited all 103 frontend files against the Vercel Web Interface Guidelines and recorded every violation with file and line references in `prds/web-interface-guidelines-audit.md` (2026-08-10).
- Top findings: the shared Button removes focus outlines with no focus-visible replacement, the custom dialog is missing `role="dialog"`, `aria-modal`, focus trapping, and `overscroll-behavior: contain`, no form field in the app sets `autocomplete`, there is no `prefers-reduced-motion` handling, `...` appears instead of `…` in about 40 files, images never set `width`/`height`, and `transition-all` is used in about 10 files.
- Passing checks: site design system dialogs everywhere (no browser `confirm`/`alert`), zoom not disabled, paste not blocked, correct `type="email"`/`type="url"` on existing fields, and the newer `ui/input.tsx` and `ui/checkbox.tsx` primitives already use the correct `focus-visible` ring pattern.
- Review only, no UI changes shipped; the PRD includes a six step fix order starting with the shared primitives.
- **Docs**: `prds/web-interface-guidelines-audit.md` (new), `task.md`, `files.md`.

### [Fixed] - 2026-08-10

**Resend email system audit fixes**

- Full audit of the email system (global kill switch, 14 per type toggles, digests, broadcasts, judging group emails, unsubscribe, webhook status sync) before enabling email in admin. Four real bugs found and fixed (2026-08-10).
- Daily engagement cron no longer processes a frozen date: cron args are evaluated once at deploy time, so the engagement processor was pinned to the deploy date forever and the 6 PM send step found no summaries. The date is now computed at run time inside the action.
- Unsubscribe links now render in email footers. Six templates had a no op expression that printed a single space instead of the `https://vibeapps.dev/api/unsubscribe?token=...` link, so recipients never saw an unsubscribe link in the body.
- `vibeapps.dev/api/unsubscribe` now reaches Convex: added the missing Netlify `_redirects` proxy rule (it previously fell through to the SPA catch all and served the app instead of unsubscribing).
- One click unsubscribe completed: the List-Unsubscribe-Post header advertised RFC 8058 one click, but only a GET route existed. Added the POST `/api/unsubscribe` route mail providers actually call.
- **Backend**: `convex/crons.ts`, `convex/emails/daily.ts`, `convex/emails/templates.ts`, `convex/emails/unsubscribe.ts`, `convex/http.ts`.
- **Config**: `public/_redirects`. Audit notes and the prod enablement checklist (Resend env vars, webhook endpoint) live in `prds/resend-email-audit.md`.

### [Added] - 2026-08-10

**Group link variables in email templates**

- Email templates and judging group emails now support three link variables that resolve to the group's real share links at send time: `{{judgingurl}}` (judging page), `{{resultsurl}}` (results page), and `{{submissionurl}}` (submission page). They match the exact URLs from the group workspace Links section, built by one shared helper so the backend send and both admin previews never drift (2026-08-10).
- Bare URLs in bodies and signatures now render as clickable links, so `{{judgingurl}}` works on its own line without markdown syntax; `[Start judging]({{judgingurl}})` still works for custom link text. Trailing sentence punctuation stays outside the link.
- The group compose preview substitutes the group's real URLs; the Templates manager preview uses sample links. Both variable legends list the new keys automatically.
- **Backend**: `convex/emails/render.ts` (new variables, `judgingGroupUrls` helper, bare URL autolink), `convex/emails/judgingGroupEmails.ts` (passes the group slug through delivery).
- **Frontend**: `src/components/admin/judging/GroupEmailsSection.tsx`, `src/components/admin/EmailTemplatesManager.tsx`.

### [Changed] - 2026-08-10

**AI Spam counts strip doubles as quick filters**

- The count pills above the AI Spam scan results (scanned, spam, suspicious, clean, marked, failed) are now clickable: click one to filter the list to that verdict, click it again to go back to all results. The pills stay in sync with the existing filter dropdown, the active pill is highlighted with a ring, and the "in progress" pill stays informational (2026-08-10).
- **Frontend**: `src/components/admin/SpamCheck.tsx`.

### [Added] - 2026-08-10

**Judging group emails: scheduling, daily cap, delivery stats, real-judge preview**

- Scheduled sends: pick an optional send time when composing (at least one minute out, at most 30 days). Scheduled sends are queued with the Convex scheduler, listed in a new Scheduled sends card in the group Emails section, and can be cancelled any time before they fire. New `groupScheduledEmails` table tracks pending, sent, and cancelled sends (2026-08-10).
- Daily cap: each group can email at most 200 recipients per rolling 24 hours (test sends excluded, pending scheduled sends counted), enforced server side with a friendly error and shown as a usage line in the compose UI so a delegated organizer cannot blast judges repeatedly.
- Per-send delivery stats: every send now stamps a shared sendId on its emailLogs rows, and Recent sends shows one row per send with delivered, opened, and bounced or failed counts. The Resend webhook now records first-open timestamps into log metadata (status values are unchanged).
- Preview as a real judge: the compose preview substitutes a selected judge's actual name and email, with a picker when more than one recipient is selected.
- **Backend**: `convex/emails/judgingGroupEmails.ts`, `convex/emails/queries.ts` (webhook opens), `convex/schema.ts` (new `groupScheduledEmails` table).
- **Frontend**: `src/components/admin/judging/GroupEmailsSection.tsx`.

### [Added] - 2026-08-10

**Judging group emails with reusable templates**

- Judging groups can now email their judges from a new Emails section in the group workspace: pick a saved template or write from scratch, edit the subject and markdown body, add an optional signature, choose a reply-to address (group notification emails are suggested), select recipients from the group's judges who registered with an email (deduplicated, select all by default), preview the exact rendered email as the first recipient, send a test to yourself, then send with a confirm step. A recent sends list shows delivery status per recipient from emailLogs (2026-08-10).
- New Templates sub tab in admin Email Management (the existing page moved under a Send & Settings sub tab, unchanged). Templates have a name, subject, markdown-lite body, and optional signature, with a live preview. Bodies and subjects support per-recipient variables: `{{firstname}}`, `{{name}}`, `{{email}}`, `{{groupname}}`; markdown supports bold, italic, links, and lists. Rendering escapes HTML first so judge-supplied names cannot inject markup, and the admin preview uses the exact same renderer as the backend send.
- New `judging_group` email type with its own toggle in Email Send Options under a Judging group, off by default. The global master switch still wins, and both gates are enforced server side in the core send action; the group compose UI shows a banner and disables send when either is off.
- New delegated permission `judging.emails` ("Send template emails to a group's judges") grantable from the Access tab and scoped to specific judging groups like the other judging keys, so hackathon organizers can email their judges without full admin.
- **Backend**: `convex/emails/render.ts` (new), `convex/emails/judgingGroupEmails.ts` (new), `convex/emailTemplates.ts` (new), `convex/emails/emailTypes.ts`, `convex/schema.ts` (emailLogs union, new `emailTemplates` table), `convex/adminAccess.ts`.
- **Frontend**: `src/components/admin/EmailTemplatesManager.tsx` (new), `src/components/admin/judging/GroupEmailsSection.tsx` (new), `src/components/admin/EmailManagement.tsx`, `src/pages/AdminJudgingGroupPage.tsx`, `src/components/admin/AccessManagement.tsx`.

### [Changed] - 2026-08-10

**AI Spam Check date ranges are remembered**

- The two date ranges on the AI Spam tab (the "Run a scan" range and the "Scan results" filter range) now persist in the browser via localStorage, so switching admin tabs or reloading the page keeps the ranges you picked. Clearing a range also clears the saved value (2026-08-10).
- **Frontend**: `src/components/admin/SpamCheck.tsx`.

### [Changed] - 2026-08-10

**AI Spam Check date range picker**

- Replaced the two native date inputs on the AI Spam tab (which rendered unstyled OS calendar buttons) with a single site-styled date range picker: one trigger button showing the selected range, a popover with a two-month range calendar, and preset windows for last 7 days, last 30 days, this month, last month, and last 3 months, plus inline clear (2026-08-10).
- Reorganized the AI Spam tab into two clear steps: a "Run a scan" card at the top with its own date range picker and Scan / Re-scan buttons (labels switch to "Scan this range" when a range is picked, empty range scans the 100 most recent), and a separate "Scan results" section whose verdict, sort, and date filters only change the view and never start a scan. Inline copy explains each step and the empty state now suggests clearing filters or running a scan (2026-08-10).
- New reusable UI primitives: `popover.tsx` (Radix popover styled like the existing select), `calendar.tsx` (react-day-picker with the site palette), and `date-range-picker.tsx`. New dependencies: `react-day-picker`, `@radix-ui/react-popover`.
- **Frontend**: `src/components/ui/popover.tsx` (new), `src/components/ui/calendar.tsx` (new), `src/components/ui/date-range-picker.tsx` (new), `src/components/admin/SpamCheck.tsx`, `package.json`.

### [Added] - 2026-08-10

**Submission emails and per-type send toggles**

- Every email type now has its own on/off switch in a new Email Send Options card on the admin Email dashboard, grouped by Automated, User, Admin, and Submissions. Toggles are stored as `emailTypeEnabled:{type}` rows in `appSettings` and enforced centrally in the `sendEmail` action, so crons and triggers keep running but their sends no-op when a type is off. The global master switch always wins: when it is off, all per-type toggles render disabled with a notice (2026-08-10).
- Three new submission email types, all off by default: `submission_confirmation` emails the submitter a receipt with a link to their story right after `stories.submit` (only when they provided an email); `submission_admin_alert` notifies a judging group's organizer list when a submission lands in their group; `results_live` sends the public results URL to every de-duplicated submitter email in a group.
- Judging groups gained a Submission notifications card (group Settings section) for managing the organizer email list, and an explicit "Email all submitters" button in the Results visibility card that appears once results are public. The button shows the live recipient count, uses a two-step confirm, and is disabled with a hint when the master switch or the results_live toggle is off.
- Shared email type registry (`convex/emails/emailTypes.ts`) keeps the schema, send action, and settings unions in lockstep; `sendEmail` skips without logging when a type is disabled. New submitter emails include the standard preferences footer and List-Unsubscribe header for account holders. The `/resend-webhook` route already verifies svix signatures via the component handler.
- **Backend**: `convex/emails/emailTypes.ts` (new), `convex/emails/submissions.ts` (new), `convex/emails/resend.ts`, `convex/emails/queries.ts`, `convex/settings.ts`, `convex/stories.ts`, `convex/judgingGroups.ts`, `convex/schema.ts` (emailLogs union, `judgingGroups.notificationEmails`).
- **Frontend**: `src/components/admin/EmailManagement.tsx`, `src/components/admin/judging/GroupSettingsSection.tsx`, `src/components/admin/judging/GroupAccessSection.tsx`.

### [Added] - 2026-08-10

**Hackathon skill support for judging groups**

- Judging groups can now power the /hackathon agent skill: a new Hackathon skill section on the admin group page has an enable toggle, shared registration codes (stored uppercase, matched case-insensitively), a markdown rules editor, endpoint URLs for event docs, and a live list of teams that registered through the skill (2026-08-10).
- New HTTP API at `/api/hackathon/{slug}/...` authenticated by registration code (x-hackathon-code header, Bearer token, or ?code=): `openapi.json` (public discovery), `rules.json` (rules markdown, judging criteria, AI rubric, dates, score scale, submit page path, with ETag/If-None-Match support), `status?url=` (submission lifecycle for a project URL with admin-safe wording), `POST register` (idempotent team registration that returns the rules payload), and `POST check` (deterministic pre-submit check: event window, live URL, hackathon.json manifest fetch and parse, duplicate URL detection; nothing stored, no LLM). Reads are rate limited to 60/min per code and checks to 10/min.
- Duplicate submission guard: submitting the same project URL twice to one judging group is now rejected in `stories.submit` with a friendly message surfaced on the group submit form. URL comparison normalizes host casing and trailing slashes; hidden or rejected entries free the URL for resubmission.
- Group submit form supports one-click prefill via query params (`?url=&title=&tagline=&github=`) so the skill can hand developers a prefilled submit link. Convex error messages on the form are now shown clean without the server prefix.
- Rules staleness tracking: rules edits bump `hackathonRulesUpdatedAt`, and criteria changes are covered by criteria row creation times, so skills refetch only when something changed. AI judge and human judging needed no changes; agent scores stay advisory.
- **Backend**: `convex/hackathon.ts` (new), `convex/schema.ts` (hackathon fields on `judgingGroups`, new `hackathonRegistrations` table), `convex/http.ts`, `convex/stories.ts`, `convex/judgingGroups.ts`.
- **Frontend**: `src/components/admin/judging/GroupHackathonSection.tsx` (new), `src/pages/AdminJudgingGroupPage.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`.

### [Added] - 2026-08-10

**Admin activity log**

- New Activity tab in the admin dashboard tracks app activity in one feed: email sends and failures, new submissions (including anonymous), spam actions (mark, unmark, bulk hide, bulk delete, batch scans), judging group create/update/delete, judge scores, moderation actions (approve, reject, hide, show, delete), delegated access grants and revokes, and site settings changes (2026-08-10).
- Toolbar controls: category filter pills, Active or Archived view, newest or oldest sort, pause and resume logging (paused state shows a banner and drops new entries until resumed), CSV export of the current view (up to 5000 rows), and a confirm-gated clear that deletes the current view in batches.
- Row actions: select all over loaded entries, bulk archive or restore, bulk delete with confirm, and expandable detail rows showing the action key, target, exact time, and metadata.
- Works with delegated access: two new permission keys (`activity.view`, `activity.manage`) grantable from the Access tab; viewing needs view, while pause, clear, archive, and delete need manage. Full admins get both automatically.
- Logging is a single `logActivity` helper wired into existing mutations at choke points; it never throws, so a logging failure can never break a submission or an email send. Background sends log as "System"; judge scores log under the judge's name.
- **Backend**: `convex/activityLog.ts` (new), `convex/schema.ts`, `convex/adminAccess.ts`, `convex/emails/queries.ts`, `convex/stories.ts`, `convex/spamCheck.ts`, `convex/judgingGroups.ts`, `convex/judgeScores.ts`, `convex/settings.ts`.
- **Frontend**: `src/components/admin/ActivityLog.tsx` (new), `src/components/admin/AdminDashboard.tsx`, `src/components/admin/AccessManagement.tsx`.

### [Fixed] - 2026-08-10

**Resend component upgrade and email delivery status fix**

- Upgraded the Convex Resend component (`@convex-dev/resend`) from 0.2.5 to 0.2.6, which forwards Resend's message_id from webhook payloads to the onEmailEvent callback (2026-08-10).
- Fixed email delivery tracking: the custom `/resend-webhook` handler skipped signature verification and matched Resend's message_id against the component email id stored in emailLogs, so statuses never advanced past `sent`. The route now uses the component's `handleResendEventWebhook` (svix signature verified with `RESEND_WEBHOOK_SECRET`) plus a new `onEmailEvent` mutation that updates emailLogs to delivered, bounced, or complained by the matching component email id. Webhook URL unchanged, so no Resend dashboard changes needed.
- Typed the core send payload (replyTo is now an array per the component's `SendEmailOptions`); admin Email Management flows (test email, broadcast to all, selected users, or tag) confirmed to route through the logged component send path with the global kill switch intact.
- **Backend**: `convex/sendEmails.ts`, `convex/emails/queries.ts`, `convex/emails/resend.ts`, `convex/http.ts`, `package.json`.

### [Added] - 2026-08-10

**AI spam detection with admin review tab**

- Every new submission is scanned for spam automatically, and admins can batch scan the 100 most recent submissions from a new AI Spam tab in the admin dashboard (2026-08-10).
- Each scan combines deterministic checks with an AI verdict: live URL check, Firecrawl page scrape, GitHub repo reachability and file count (empty-repo detection), duplicate URL count across submissions, and extra link liveness. The AI (same Anthropic/OpenAI/OpenRouter fallback chain as the AI judge) returns spam, suspicious, or clean with confidence and short reasons; a deterministic heuristic takes over when no AI key is configured.
- Marking a submission as spam hides it, labels it with the reason, sends the submitter an in-app alert, and emails them the explanation with a reply-to back to the admins (`ADMIN_EMAIL` env var). Unmark reverses everything. Bulk actions: mark as spam with an optional custom reason, hide, and permanent delete (cascades comments, votes, ratings, bookmarks, scan rows, and images).
- The tab has verdict filters, sorting (newest, oldest, highest confidence), a submission date range filter, select all, live counts, per-row re-scan, and expandable detail rows showing the full AI reasoning and every measured signal. Confirmed spam shows a red badge in the Moderation tab.
- Setting a date range also scopes the batch scan buttons, so admins can scan or re-scan up to 100 submissions from a specific window instead of only the most recent ones (2026-08-10).
- The AI system prompt behind the spam verdict is now editable from the tab: an AI prompt button opens an editor showing the active prompt (default or custom badge), saves a custom version to app settings, and offers a confirm-gated reset back to the built-in default. Future scans pick up the change immediately (2026-08-10).
- Spam notifications now say what happened: the dropdown and notifications page read "Your post has been marked as spam and has been removed" with a check-your-email pointer, and the full page plus the email link to the GitHub issues page for appeals. Spam emails were already behind the global email kill switch in admin settings; only explicit admin test emails bypass it (2026-08-10).
- Admin Docs tab updated for the new features: the Agent judges page now walks through the full external-agent workflow (three-step setup, both auth header forms, an endpoint table, a POST /scores example payload, the 120 read / 30 write per-minute rate limits, and a 401/403/429 error reference), a new AI spam check page documents scans, signals, the editable prompt, marking flow, the email kill switch, and permissions, and the environment variables page covers spam check usage plus ADMIN_EMAIL (2026-08-10).
- Spam scans run in their own workpool so batch scans never queue behind the AI judge. Firecrawl now runs through the `@firecrawl/firecrawl-convex` component.
- **Backend**: `convex/spamCheck.ts` (new), `convex/spamCheckAnalysis.ts` (new), `convex/emails/spam.ts` (new), `convex/schema.ts`, `convex/convex.config.ts`, `convex/stories.ts`, `convex/alerts.ts`, `convex/emails/resend.ts`, `convex/emails/queries.ts`.
- **Frontend**: `src/components/admin/SpamCheck.tsx` (new), `src/components/admin/AdminDashboard.tsx`, `src/components/admin/ContentModeration.tsx`, `src/pages/NotificationsPage.tsx`.

### [Fixed] - 2026-08-10

**Submission page password bypass and links event kit**

- Fixed a password bypass on judging group submission pages: the page auto-unlocked whenever the group's judge access was public, even with a submission page password set. The password gate now always appears when a submission password exists; pages without one still open directly (2026-08-10).
- The Links section copy-all and .md download now work as a complete event kit for external organizers: each locked link includes its password inline (judge, submission, results, and AI results pages). Passwords stay out of the on-screen ledger rows; only the admin-gated export includes them.
- Added a hint in the Shareable links card and markdown export when the custom submission page is off, pointing to the Submit page section to get a shareable participant link.
- Added a score scale note when the AI judge is on: human judges score 1 to 5 or 1 to 10 per the group setting, while the AI judge always scores 1 to 10.
- **Backend**: `convex/judgingGroups.ts` (`getGroupWithDetails` now returns `aiResultsPassword`).
- **Frontend**: `src/pages/JudgingGroupSubmitPage.tsx`, `src/components/admin/judging/GroupLinksSection.tsx`.

### [Added] - 2026-08-09

**Per-group customizable submission forms**

- Judging group submit pages are now fully customizable per group from the Submit page section of the group workspace: show or hide any built-in field or section (tagline, description, website, GitHub, video, screenshot, name, email, tags, team info, additional images, additional links), set each visible field to required or optional, and add custom questions (text, URL, email, or textarea) with label, placeholder, description, and required flag (2026-08-09).
- The title field is always shown since stories require it. Hiding the tags picker requires a required tag on the group so submissions still route into the group; the server applies that tag as a backstop even if the client omits it. A warning appears when GitHub URL is hidden while the AI judge is enabled since the AI judge reads the repo.
- Custom question answers are stored on the story as `customFormAnswers` with the question label denormalized, so answers stay readable even if the question is later edited or removed. Judges see the answers in the judging interface next to team info.
- Existing groups are untouched: no stored visibility config means every field stays visible, and the existing required-field settings keep working exactly as before.
- Fixed a latent return-validation bug: `baseStoryValidator` was missing `rejectionReason`, `selfReportedHarness`, and `selfReportedModel`, so any story carrying those fields would have failed queries like `listUserStories` and `listApprovedStoriesWithDetails` that spread whole story docs into `storyWithDetailsValidator`.
- **Backend**: `convex/schema.ts`, `convex/judgingGroups.ts`, `convex/stories.ts`, `convex/judgingGroupSubmissions.ts`, `convex/validators.ts`.
- **Frontend**: `src/components/admin/judging/GroupSubmitPageSection.tsx`, `src/components/admin/judging/groupSection.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`, `src/pages/JudgingInterfacePage.tsx`.

### [Fixed] - 2026-08-09

**Components check no longer comes back after deletion**

- The Components check preset in the Rubric weights card was rendered as an On/Off toggle pill; after deleting the criterion the row returned in the Off state, and clicking the pill silently re-added it. It is now an explicit "Add to rubric" button labeled "preset, not in rubric", so nothing is added without a deliberate click (2026-08-09).
- **Frontend**: `src/components/admin/judging/GroupAiSection.tsx`, `src/components/admin/AdminDocs.tsx`.

### [Changed] - 2026-08-09

**AI judge links hide everywhere while the AI judge is disabled**

- The Links ledger lists the AI results page and agent API endpoints only while the AI judge is enabled; disabling it removes them from the ledger and the Copy all / .md export, and the Agent API card explains that no AI judge links exist while the AI judge is off (2026-08-09).
- The AI judge settings card keeps its "AI judge links" block (AI results page plus agent API OpenAPI document and base URL with copy and open actions), shown only once the AI judge is saved as enabled.
- **Frontend**: `src/components/admin/judging/GroupLinksSection.tsx`, `src/components/admin/judging/GroupAiSection.tsx`, `src/components/admin/AdminDocs.tsx`.

### [Added] - 2026-08-09

**Search and add submissions from the judging group workspace**

- The Submissions section now opens with an "Add submissions" card: search every site submission by title and add matches to the group one click at a time, the same flow Moderation offers but without needing moderation access (2026-08-09).
- Results flag apps already in the group, show a pending pill for unapproved apps, and never include hidden, archived, or rejected apps. Added apps go straight into judge queues and the next AI judge run.
- New `searchStoriesForGroup` query gated by the group's judging.manage permission; adding reuses the existing dedupe-safe `addSubmissions` mutation.
- **Backend**: `convex/judgingGroupSubmissions.ts`. **Frontend**: `src/components/admin/judging/GroupSubmissionsSection.tsx`, `src/components/admin/AdminDocs.tsx`.

### [Added] - 2026-08-09

**Per-group scoring scale (1-5 or 1-10)**

- Judging groups now have a Scoring scale setting (Settings section of the group workspace): pick 1 to 5 or 1 to 10. Existing groups stay on 1-10 with no migration (2026-08-09).
- The scale applies everywhere human scores flow: judge interface score buttons and /N labels, score submission validation (judges, admin edits, and external agents via the HTTP API), max possible score math, admin and public results dashboards, and the Judge Tracking edit modal.
- The AI judge keeps its own fixed 1-10 rubric since it is a separate scoring system.
- Criteria section cleanup: the embedded Judging Criteria editor no longer shows its own back button and page header; the workspace sidebar handles navigation. Its score preview follows the group scale.
- Fixed a multi-judge bug where "Judged & Next" never skipped already-completed submissions because it checked a field the progress query does not return.
- **Backend**: `convex/schema.ts`, `convex/judgingGroups.ts`, `convex/judges.ts`, `convex/judgeScores.ts`, `convex/judgingGroupSubmissions.ts`, `convex/adminJudgeTracking.ts`, `convex/agentJudges.ts`, `convex/http.ts`.
- **Frontend**: `src/components/admin/judging/GroupSettingsSection.tsx`, `src/pages/JudgingInterfacePage.tsx`, `src/components/admin/JudgingCriteriaEditor.tsx`, `src/pages/AdminJudgingGroupPage.tsx`, `src/components/admin/JudgeTracking.tsx`, `src/components/PublicJudgingResultsDashboard.tsx`, `src/components/admin/JudgingResultsDashboard.tsx`, `src/components/admin/AdminDocs.tsx`.

### [Changed] - 2026-08-09

**Judging group workspace layout polish**

- Collapsible workspace sidebar: a PanelLeft toggle in the group header collapses the sidebar to icon-only mode (labels become tooltips with aria labels) and expands the content area; the preference persists in localStorage across sessions (2026-08-09).
- Embedded sections dropped their legacy navigation: Judging Results, AI results, and Judge tracking no longer show back arrows or duplicate title headers inside the workspace since the sidebar handles navigation. Judge tracking keeps its header and breadcrumb only on the standalone `/admin/judging/:groupId/tracking` page.
- Judging Results overview stats are now a compact strip: icons shrunk to 3.5 (from large 8x8 blocks) and moved inline with their labels; empty-state and rankings icons reduced to match.
- Tighter workspace spacing: narrower sidebar (11rem expanded, 2.5rem collapsed) and reduced gaps between the sidebar and content column.
- **Frontend**: `src/pages/AdminJudgingGroupPage.tsx`, `src/components/admin/JudgingResultsDashboard.tsx`, `src/components/admin/AIJudgeResults.tsx`, `src/components/admin/JudgeTracking.tsx`.

### [Added] - 2026-08-09

**Judging group AI upgrades, links ledger, and per-group agent API toggle**

- Custom AI criteria per judging group: admins can add up to 10 extra rubric criteria (label, key, description) that the AI judge scores alongside the built-in seven, each with its own weight in the Rubric weights card. Custom criteria are validated for key format and uniqueness, and removing one prunes its saved weight and disabled flag.
- Per-criterion on/off toggles in the Rubric weights card: every criterion (built-in and custom) can be switched off per group. Off criteria are excluded from the AI prompt, scoring, and rankings on the next run; at least one criterion must stay on, and the weight input dims while a criterion is off (2026-08-09).
- Components check preset now lives in the Rubric weights card as a toggle row: switching it on immediately adds a repo-verified Convex components criterion (installed vs referenced in code) that then behaves like any other custom criterion (2026-08-09).
- Editable AI judge system prompt: the AI judge section now shows the effective prompt (default or custom) with edit, paste, save, and a reset-to-default button. Custom prompts support a `{{rubric}}` placeholder that expands to the group's full criterion list; the strict JSON response contract is always appended server side so a custom prompt can never break score parsing.
- Expanded AI judge context: repo analysis now also reads root-level hackathon log files (`hackathon.md`, `changelog.md`, `task.md`, `files.md`, capped at 5k chars each), detects agent skills under `.agents/skills/`, and fetches an optional `/hackathon.json` manifest from the live app origin, giving private-repo and no-repo teams a self-reported evidence path. The prompt tells the model these are self-reported and must never override verified repo or live-app facts.
- Per-group agent API toggle: each group can now switch the agent judging HTTP API off. While off, key creation is blocked, all keyed endpoints return 403 with a clear message, and existing keys are kept so re-enabling restores access without re-issuing keys.
- Inline tag creation in the Required tag picker: the Submit page section now lists all tags including hidden ones (marked "hidden"), and typing a new name shows a "Create tag" row backed by the standard tags.create mutation, so the tag lands in Tag Management with every existing tag feature. New tags default to hidden (kept off story cards, never counted toward the tag limit) via a checkbox and are auto-selected as the group's required tag; creating needs the tags.manage permission (2026-08-09).
- New Links section in the group workspace: a realtime ledger of every shareable URL (judging interface, results, custom submission page, AI results, agent API endpoints) with lock or globe icons, live "password set / no password set" status, copy and open actions, and notes explaining who can reach each link. Updates instantly when another admin changes a password or visibility toggle.
- Copy all and markdown export on the links ledger: a "Copy all" button in the Shareable links header copies every link as markdown with its access state (public, password protected, or key required), and a ".md" button downloads the same list as `slug-links.md` for event docs (2026-08-09).
- In-admin docs expanded: judging groups guide now documents each workspace section with its required permission, the links ledger, per-URL access gates, all AI judge context sources, custom criteria, prompt editing, and the agent API toggle.
- **Backend**: `convex/schema.ts`, `convex/aiJudge.ts`, `convex/aiJudgeAnalysis.ts`, `convex/agentJudges.ts`, `convex/http.ts`, `convex/judgingGroups.ts`.
- **Frontend**: `src/components/admin/judging/GroupAiSection.tsx`, `src/components/admin/judging/GroupLinksSection.tsx` (new), `src/pages/AdminJudgingGroupPage.tsx`, `src/components/admin/AdminDocs.tsx`.

### [Fixed] - 2026-08-08

**Custom submission page 404 after enabling, and save buttons in view on long judging cards**

- Enabling the custom submission page now takes effect immediately. Previously the toggle only changed local state while the card showed the live URL, so opening the link before clicking the footer Save returned a 404. The toggle now writes `hasCustomSubmissionPage` through the existing partial-update mutation the moment it is flipped, with rollback and an inline error if the write fails. All other page settings still apply on save.
- The two long group workspace cards (Custom submission page, AI judge) now show a compact Save button in the card header when expanded, so saving never requires scrolling to the footer. Footer saves are unchanged. Built on a new `headerAction` slot in `SectionCard` and a shared `HeaderSaveButton`.
- Saving the Submit page section no longer fails when optional fields are blank. `judgingGroups.updateGroup` treats null as "clear this field" but was passing null straight into the patch for the required tag, titles, description, and image, which failed schema validation (`v.optional` rejects null) and aborted the entire save, including layout changes. Null now unsets the field for every nullable arg, matching the existing password and date handling.
- **Backend**: `convex/judgingGroups.ts`.
- **Frontend**: `src/components/admin/judging/groupSection.tsx`, `src/components/admin/judging/GroupSubmitPageSection.tsx`, `src/components/admin/judging/GroupAiSection.tsx`.

### [Added] - 2026-08-08

**Custom submission page single column layout**

- Judging group submission pages now support a third layout: Single column. A centered hero (square header image, title, description, and page links as pill buttons) sits above the submission form in a focused, readable column. Selectable from the Submit page section of the group workspace and the legacy edit modal; existing groups keep their current layout.
- The submission form gained visual structure on every layout: hairline section headings (Project details, Links and media, About you, Tags), a slightly looser field rhythm, a Selected Tags summary card that matches the team info block, and a taller submit button.
- The header image in single column scales down on narrow screens instead of overflowing at its fixed pixel size.
- **Backend**: `convex/schema.ts`, `convex/judgingGroups.ts`.
- **Frontend**: `src/pages/JudgingGroupSubmitPage.tsx`, `src/components/admin/judging/GroupSubmitPageSection.tsx`, `src/components/admin/EditJudgingGroupModal.tsx`.

### [Changed] - 2026-08-08

**Admin judging UI redesign: docs-style group workspace**

- The Judging admin tab is now a compact Linear-style list: one row per judging group with active status dot, public/private lock, submission and judge counts, and creation time. Clicking a row opens a full-page group workspace instead of expanding controls inline. A slim inline stat line (groups, active, submissions, judges) replaces the old stat cards.
- New group workspace at `/admin/judging/:slug` with a sticky docs-style sidebar (Vercel docs inspired) and `?section=` deep links. Sections: Overview (stats, status toggles, copyable public URLs), Settings (name, description, active, judges per submission, danger zone delete), Access (judge/submission/results passwords with the same blank-keeps-password behavior as before), Criteria, Submissions (auto-include tags and date range, sync, CSV export), Submit page (custom submission page branding, links, required tag, field requirements, header image upload), AI judge (enable, AI results visibility, event window, rubric weights, agent keys), Results, AI results, and Judge tracking.
- Every section saves independently through the existing `judgingGroups.updateGroup` partial-update mutation, so a save in one panel never touches fields owned by another. Sidebar items are hidden when the caller lacks the mapped delegated permission (`judging.manage`, `judging.results`, `judging.tracking`, `judging.ai`, `judging.delete`); backend guards remain the source of truth.
- Existing components (`JudgingCriteriaEditor`, `JudgingResultsDashboard`, `AIJudgeResults`, `JudgeTracking`) are embedded unchanged as workspace sections. `EditJudgingGroupModal` is superseded and no longer referenced but stays in the repo; the standalone `/admin/judging/:slug/tracking` route keeps working.
- Tightened admin dashboard spacing: smaller page padding, tighter header and tab bar, 13px tab labels.
- **Frontend**: `src/pages/AdminJudgingGroupPage.tsx` (new), `src/components/admin/judging/groupSection.tsx` (new), `src/components/admin/judging/GroupOverviewSection.tsx` (new), `GroupSettingsSection.tsx` (new), `GroupAccessSection.tsx` (new), `GroupSubmissionsSection.tsx` (new), `GroupSubmitPageSection.tsx` (new), `GroupAiSection.tsx` (new), `src/components/admin/Judging.tsx`, `src/components/admin/AdminDashboard.tsx`, `src/App.tsx`.

### [Added] - 2026-08-08

**Tag limits and bulk tag cleanup**

- New configurable tag limits managed from the Tags admin section: max tags per submission (default 6) and max tag name length (default 20 characters). Stored on the settings document and editable by anyone with the `tags.manage` permission via a "Tag limits" card in Tag Management.
- Server-side enforcement in `stories.submit`, `stories.submitAnonymous`, and `stories.updateOwnStory`: submissions over the tag limit are rejected, and brand-new tag names longer than the length limit are rejected with a clear error. Hidden tags never count toward the limit, so custom forms that auto-attach a hidden tracking tag (resendhackathon, ychackathon, judging group tags) keep working at any limit. Names matching an existing tag skip the length check since no new tag is created.
- All submission forms (main submit, judging group submit, Resend and YC hackathon forms) now read the limit from settings instead of a hardcoded 10, show the live count against the configured max, disable tag inputs at the limit, and cap the new-tag input with `maxLength` so pasted tag dumps are cut off.
- Bulk tag cleanup in Tag Management: checkbox per tag row, a select-all-on-page control, and an action bar with Archive, Unarchive, and Delete for all selected tags. Delete uses an inline two-step confirm (site design system, no browser dialogs). Backed by new `bulkSetHidden` (`tags.manage`) and `bulkDeleteTags` (`tags.delete`) mutations that patch/delete in parallel.
- Existing over-length tags are flagged in Tag Management: any tag whose name exceeds the configured length limit shows a red "(Too long: N chars)" badge, and a "Select all N too-long tags" button selects them all (across pages) so they can be bulk archived, deleted, or renamed. Existing long tags keep working on stories; the limit only blocks new tag creation.
- **Backend**: `convex/schema.ts`, `convex/settings.ts`, `convex/tags.ts`, `convex/stories.ts`.
- **Frontend**: `src/components/admin/TagManagement.tsx`, `src/components/StoryForm.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`, `src/components/ResendForm.tsx`, `src/components/YCHackForm.tsx`.

### [Added] - 2026-08-07

**Admin access permissions, judging delegation, and in-admin docs**

- New delegated admin access system: full admins can grant existing users access to specific admin sections (Moderation, Tags, Forms, Judging, Numbers, User Moderation, Emails, Settings) with per-action toggles (view, manage, results, tracking, delete, and so on) without making them full admins in Clerk. Grants live in a new `adminPermissions` Convex table, take effect instantly, and revoke instantly.
- Judging access is group scoped: a grant lists specific judging groups (or all groups), and every judging backend function verifies the target group is in scope. Organizers can run one hackathon end to end (settings, criteria, submissions, tracking, results, exports, AI runs, agent keys) without seeing any other group or section.
- New Access tab in /admin (full admins only): user search with avatars, per-section permission cards with action checkboxes and destructive actions highlighted, judging group multi-select or all-groups toggle, summary chips, notes, and a grants list showing who has what, granted by whom and when, with edit and revoke (confirm dialog).
- Judging group picker in the Access tab has its own search box: filter groups by name or slug, selected groups show as removable chips above the list, active groups sort first, and a selected count keeps the scope visible while filtering.
- New Docs tab in /admin (full admins and anyone with judging view access): sidebar-nav documentation covering judging groups, criteria and weights, submissions, the judge flow, results and tracking, the AI judge (including its verified GitHub repo reading behavior, limits, and required env vars `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, fallbacks, optional `FIRECRAWL_API_KEY`), agent judges and their HTTP API, delegated access, and environment variables.
- The admin dashboard now renders only permitted tabs (delegated users see a "Delegated access" badge), and the Judging list hides create, settings, criteria, results, tracking, AI, export, and delete controls the caller was not granted. Secondary admin routes (Judge Tracking, Form Builder, Form Results) use the same access query.
- Backend guards migrated from all-or-nothing `requireAdminRole` to granular `requirePermission` / `requireJudgingGroupPermission` across tags, stories, comments, forms, story form fields, submit forms, users, reports, settings, emails, numbers, and every judging file. Full admins (Clerk JWT role) bypass all checks with zero behavior change; the Access management CRUD itself is never delegatable.
- **Backend**: `convex/schema.ts`, `convex/adminAccess.ts` (new), `convex/users.ts`, `convex/tags.ts`, `convex/stories.ts`, `convex/comments.ts`, `convex/forms.ts`, `convex/storyFormFields.ts`, `convex/submitForms.ts`, `convex/settings.ts`, `convex/reports.ts`, `convex/adminQueries.ts`, `convex/sendEmails.ts`, `convex/emails/broadcast.ts`, `convex/convexBoxConfig.ts`, `convex/judgingGroups.ts`, `convex/judgingCriteria.ts`, `convex/judges.ts`, `convex/judgingGroupSubmissions.ts`, `convex/judgeScores.ts`, `convex/adminJudgeTracking.ts`, `convex/aiJudge.ts`, `convex/agentJudges.ts`.
- **Frontend**: `src/components/admin/useAdminAccess.tsx` (new), `src/components/admin/AccessManagement.tsx` (new), `src/components/admin/AdminDocs.tsx` (new), `src/components/admin/AdminDashboard.tsx`, `src/components/admin/Judging.tsx`, `src/components/admin/FormBuilder.tsx`, `src/components/admin/FormResults.tsx`, `src/pages/JudgeTrackingPage.tsx`.

### [Added] - 2026-07-05

**Agent Ready component installed**

- Installed the `@waynesutton/agent-ready` Convex component along with `@convex-dev/crons` and `@convex-dev/workpool` in `convex/convex.config.ts`.
- Registered its HTTP routes in `convex/http.ts` (agents.md, llms-full.txt, llms-status); `/llms.txt` and `/robots.txt` are skipped because the app already serves them from the `siteFiles` table.
- Added admin-gated app-facing wrappers in `convex/agentReady/content.ts` (settings, generated files, pages) and `convex/agentReady/analytics.ts` (request summary and time series), plus `agent-ready.config.json` for component settings.
- **Backend**: `convex/convex.config.ts`, `convex/http.ts`, `convex/agentReady/content.ts` (new), `convex/agentReady/analytics.ts` (new), `agent-ready.config.json` (new), `package.json`.

### [Added] - 2026-07-05

**AI Judge: Convex components detection and scoring**

- The AI review now detects Convex components deterministically from each repo's `package.json` (any `@convex-dev/*` dependency except the eslint plugin) and `convex.config.ts` imports of `*/convex.config`, including local components. The deduped list is stored on the result as `componentsDetected`.
- Component usage now raises scores: the advanced criterion description and the system prompt tell the model that installed and wired-up components are a strong signal, that a submission using components well should generally score 7 or higher on "advanced", and each component is named in the reasoning and feature list as `component: <name>`.
- Stats tab: new "Using Convex components" card (apps count plus distinct component count) and a "Components used" list showing each component with how many apps used it. Older results without the new field fall back to feature strings mentioning "component" for the apps count.
- Hackathon report: overview row for apps using Convex components with the distinct component list, and a per-submission "Convex components" line. Re-run reviews (or individual submissions) to populate component data for existing groups.
- **Backend**: `convex/schema.ts`, `convex/aiJudge.ts`, `convex/aiJudgeAnalysis.ts`.
- **Frontend**: `src/components/admin/AIJudgeResults.tsx`.

### [Fixed] - 2026-07-05

**Tags: server error on tag and app pages after hiding a tag**

- Fixed a Convex return validation crash on `tags:getBySlug` and `stories:getBySlug`. The per-view tag visibility fields (`hideInStoryDetail`, `hideInStoryList`) introduced on 2026-06-28 were written to tag documents by Tag Management but missing from the query validators, so any tag carrying them failed validation and broke its tag page and every app detail page using it.
- Added both optional fields to the `getBySlug` return validator, the shared `tagDocValidator` (used by `storyWithDetailsValidator` for story list and detail queries), and the `StoryWithDetailsPublic` type.
- **Backend**: `convex/tags.ts`, `convex/validators.ts`.

### [Added] - 2026-07-05

**Judging: Opt-in AI Judge for Best Use of Convex**

- Admins can enable an "AI Judge: Best Use of Convex" option on any judging group (new or existing). When enabled, a "Run AI Review" action analyzes every submission in the group against a fixed five-criterion Convex rubric (schema and data modeling; queries, mutations, actions; real-time reactivity; advanced Convex features; overall depth and correctness), scoring each 1-10 with a written reasoning note per criterion plus an overall note and detected Convex features.
- Each review fetches the submission's GitHub repo as the primary signal (metadata, file tree, `convex/` files, README, using optional `GITHUB_TOKEN`) and scrapes the live demo URL with Firecrawl (optional `FIRECRAWL_API_KEY`). Missing or private repos are noted in the reasoning rather than failing the review, and a `sourcesUsed` badge shows admins which sources were available.
- LLM provider fallback via Convex environment variables: `ANTHROPIC_API_KEY` first, then `OPENAI_API_KEY`, then `OPENROUTER_API_KEY` as backup. Submissions are processed sequentially through the Convex scheduler so runs stay within action time limits and provider rate limits; individual failures are stored with their error and can be retried one at a time.
- Live app URL check: each review makes a direct HTTP request to the submission's live app URL (never social or video links) and records whether it is live, the status code, and a short note. A sixth "Live app status" rubric criterion scores it 1-10; a dead or 404 URL is capped server-side at 2 (3 when no URL was provided) no matter what the model says, and the broken status is flagged in the overall note. The other five Convex criteria are unaffected, so the ranking stays mostly about Convex usage. A successful Firecrawl scrape counts as live for hosts that block plain requests.
- Admin and public results show a URL status badge per submission (URL live / URL 404 / URL down / no URL) sourced from the deterministic check, independent of the AI text. Older results without the check render unchanged.
- Stats tab in the admin AI Review view (enabled once at least one review completes): screenshot-friendly rollup with apps reviewed, apps using Convex, apps using advanced Convex features (scheduler, crons, file storage, search, vector, HTTP actions, components, agents), live apps, repos analyzed, average score, top detected Convex features with counts, and a score distribution chart.
- Hackathon Report tab (grayed out until every submission has been reviewed): generates a markdown report with overview metrics, participation summary, team names and members, a rankings table with GitHub and live app links, per-submission details with scores and AI notes, and a section for reviews that could not complete. Viewable in the app, copyable for Notion or Google Docs, and downloadable as a .md file. Team member emails stay admin-only via a dedicated `getGroupAiReportData` query.
- New admin "AI Results" view per group with live progress counts (pending/running/completed/failed), ranked results, expandable per-criterion reasoning, inline score and note editing (tracked with `editedBy`/`editedAt`), and per-submission retry.
- New public AI results page at `/judging/:slug/ai-results` with the same public/password/admin-bypass gate as human results (separate `aiResultsIsPublic`/`aiResultsPassword` settings), clearly labeled as an AI review.
- AI results are stored in a new `aiJudgeResults` table completely separate from human `judgeScores` and `submissionStatuses`; no author notifications are ever sent by the AI flow, and existing judging workflows are unchanged. Deleting a group also removes its AI results.
- **Backend**: `convex/schema.ts`, `convex/judgingGroups.ts`, `convex/aiJudge.ts` (new), `convex/aiJudgeAnalysis.ts` (new).
- **Frontend**: `src/components/admin/CreateJudgingGroupModal.tsx`, `src/components/admin/EditJudgingGroupModal.tsx`, `src/components/admin/AIJudgeResults.tsx` (new), `src/components/admin/Judging.tsx`, `src/pages/AIJudgeResultsPage.tsx` (new), `src/App.tsx`.

### [Changed] - 2026-06-30

**Judging: Auto-jump to next submission after marking complete**

- In the single-judge flow, clicking "Mark Submission Complete" now automatically advances to the next submission, matching the existing multi-judge "Judged & Next" behavior.
- It prefers the next submission not yet completed by any judge; if none remain ahead, it moves forward by one.
- **Frontend**: `src/pages/JudgingInterfacePage.tsx` (`handleMarkCompleted`).

### [Added] - 2026-06-30

**Judging: Searchable auto-include tags + match-all mode**

- The auto-populate tag picker is now searchable (filters by tag name, capped to the first 50 matches) so admins can work with thousands of tags without scrolling a giant list. Selected tags show as removable chips that stay visible even when filtered out of the results.
- New "Tag match rule" option: **Match any** (a submission needs at least one selected tag, the original OR behavior) or **Match all** (a submission must carry every selected tag, e.g. require tag 1 AND tag 2 AND tag 3). The optional date range applies in both modes.
- New optional `autoIncludeMatchMode` field on `judgingGroups` (defaults to "any" so existing groups are unchanged). The match helper, `updateGroup` backfill, and `getGroupWithDetails` all honor the mode.
- **Backend**: `convex/schema.ts`, `convex/judgingGroups.ts`, `convex/judgingGroupSubmissions.ts`.
- **Frontend**: `src/components/admin/EditJudgingGroupModal.tsx`.
- **PRD**: `prds/judging-tag-daterange-groups.md`

### [Added] - 2026-06-29

**Accessibility: Press Escape to close any modal**

- Every modal, dialog, and popup overlay now closes when you press the Escape key, matching its existing Cancel/close button behavior.
- Added a small shared hook `src/hooks/useEscapeKey.ts` that subscribes to a window keydown listener only while a modal is open and reuses the modal's existing close handler.
- Fixed the shared `src/components/ui/dialog.tsx` once so all of its consumers inherit Escape support (Create/Edit submit form modals, report story modal, report user modal).
- Wired Escape into the remaining custom design-system overlays: `AlertDialog` (used app-wide via `useDialog`), Edit/Create Judging Group modals, Content Moderation delete-comment confirm, User Moderation confirm action, Judge Tracking (edit score, delete judge, delete score), and the Inbox block/report modals.
- Modals that already supported Escape were left unchanged (MessageDialog, PromptDialog, ImageGallery, StoryForm image lightbox, and the Radix-based AuthRequiredDialog and Footer about modal).
- No UI, layout, styling, or behavior changes beyond closing on Escape.
- **Frontend**: `src/hooks/useEscapeKey.ts`, `src/components/ui/dialog.tsx`, `src/components/ui/AlertDialog.tsx`, `src/components/admin/EditJudgingGroupModal.tsx`, `src/components/admin/CreateJudgingGroupModal.tsx`, `src/components/admin/ContentModeration.tsx`, `src/components/admin/UserModeration.tsx`, `src/components/admin/JudgeTracking.tsx`, `src/pages/InboxPage.tsx`.
- **PRD**: `prds/modal-esc-close.md`

### [Fixed] - 2026-06-29

**Judging: Permanently fix write conflicts in the judges table**

- Resolved the recurring Convex Insight warning "Retried due to write conflicts in table judges" caused by `judges.updateActivity` (retried ~1.6K times on a single hot judge row, conflicting with itself).
- Root cause: the activity heartbeat wrote `lastActiveAt` on essentially every 60s tick, so parallel heartbeats hitting the same document collided under optimistic concurrency control. See https://docs.convex.dev/error#1 (remediation #3: avoid many writes to the same document).
- Fix: added a 2-minute server-side staleness threshold so the vast majority of heartbeats are read-only no-ops. Concurrent calls now resolve to a single write, and any retry reads the fresh value and early-returns instead of conflicting.
- Also jittered the client heartbeat interval (60s + up to 15s) so heartbeats from multiple tabs/clients do not fire in lockstep.
- **Backend**: `convex/judges.ts` (`updateActivity` threshold gate).
- **Frontend**: `src/pages/JudgingInterfacePage.tsx` (jittered activity interval).
- **Skill**: `.agents/skills/convex-write-conflicts/SKILL.md` documents the diagnosis and canonical fix for any future heartbeat/counter write conflicts.

### [Added] - 2026-06-29

**Judging: Auto-populate groups by multiple tags and a date range**

- Admins can now build a judging group that automatically pulls in submissions matching one or more tags (OR logic, a submission needs one or both selected tags) and an optional submission date range, on top of the existing single required-tag option.
- The Edit Judging Group modal adds a multi-tag checkbox selector, Start Date and End Date inputs, and a "Sync matching submissions" button that backfills past and current submissions on demand.
- Matching submissions are materialized into `judgingGroupSubmissions`, so they flow into the existing Judging Interface and judging results pages with no extra wiring. Changing the filters only adds submissions, never removes them, so judge scores are never lost.
- New optional `autoIncludeTagIds`, `autoIncludeStartDate`, and `autoIncludeEndDate` fields on the `judgingGroups` table. Forward backfill runs when these are set or changed in `updateGroup`, and the reverse story-tag sync (`syncStoryToTaggedGroups`) now also honors the auto-include criteria so newly tagged stories land in the right groups.
- **Backend**: `convex/schema.ts`, `convex/judgingGroups.ts` (updateGroup backfill, getGroupWithDetails return), `convex/judgingGroupSubmissions.ts` (`storyMatchesAutoInclude` helper, extended `syncStoryToTaggedGroups`, new `syncAutoIncludeSubmissions` mutation).
- **Frontend**: `src/components/admin/EditJudgingGroupModal.tsx`.
- **PRD**: `prds/judging-tag-daterange-groups.md`

### [Added] - 2026-06-28

**Judging: Export submissions to CSV per group**

- Each judging group in the Admin Judging System now has an "Export CSV" action that downloads every submission in that group.
- The CSV includes the custom submit form info: App Title, App/Project Tagline, Description, App Website Link, Video Demo URL, GitHub, LinkedIn, Twitter/X, Chef Show, Chef App, Tags, Hackathon Team Info (team name, member count, members), submitter name, email, slug, and votes. Images are intentionally excluded.
- Hidden, archived, rejected, or deleted stories are skipped, and empty groups show a notification instead of downloading an empty file.
- The export is admin only and fetched on demand (no extra reactive load on the list view).
- **Backend**: `convex/judgingGroupSubmissions.ts` (new `exportGroupSubmissions` query).
- **Frontend**: `src/components/admin/Judging.tsx` (Export CSV button + client-side CSV builder).
- **PRD**: `prds/judging-group-csv-export.md`

### [Added] - 2026-06-28

**Per-view tag visibility controls**

- Admins can now hide a tag from the app detail page and the app card lists (home, category, grid, vibe) independently, on top of the existing header visibility and archive controls. This lets us hide custom submission tags (for example resendhackathon, ychackathon) from public surfaces without hardcoding names.
- Tag Management adds two new per-tag toggles: a document icon for the detail page and a list icon for app lists. Both persist on Save and are disabled while a tag is archived.
- New optional `hideInStoryDetail` and `hideInStoryList` fields on the tags table flow through story tag resolution so the client filters consistently.
- **Backend**: `convex/schema.ts` (tags fields), `convex/tags.ts` (create/update), `convex/stories.ts` (tag resolution).
- **Frontend**: `src/components/admin/TagManagement.tsx`, `src/components/StoryDetail.tsx`, `src/components/StoryList.tsx`.
- **PRD**: `prds/tag-per-view-visibility.md`

### [Added] - 2026-06-28

**Judge score breakdown on results page**

- When a submission has more than one judge, the Rankings section on the public judging results page now shows a collapsible toggle below each score.
- Expanding the toggle reveals each judge's name and their average score.
- Works on both public and password-protected results views.
- Backend: `convex/judgeScores.ts` (getPublicGroupScores, getValidatedGroupScores)
- Frontend: `src/components/PublicJudgingResultsDashboard.tsx`

### [Added] - 2026-06-28

**Judging: Submissions Counted by Required Tag**

- Any submission that carries a judging group's required tag is now judged and counted, even if it never used the group's custom submission form.
- Editing a submission to add the required tag (by the owner or an admin) automatically includes it in the matching judging group as a pending submission.
- Admin bulk tag-adds (Content Moderation) also auto-include the story in matching groups.
- Setting or changing a group's required tag in EditJudgingGroupModal backfills existing stories that already carry that tag.
- New "Sync existing submissions with this tag" button on the group settings modal backfills on demand (useful right after deploy), reporting how many were added vs. already included.
- All inclusion is idempotent and reuses the same `judgingGroupSubmissions` + `submissionStatuses` tables as the custom form, so it works with scoring, status tracking, and multi-judge completion. Existing scores and statuses are preserved; removing a tag never auto-deletes a submission.
- **Backend**: `ensureStoryInGroup` + `syncStoryToTaggedGroups` helpers and `syncRequiredTagSubmissions` mutation in `convex/judgingGroupSubmissions.ts`; tag-edit hooks in `convex/stories.ts`; required-tag backfill in `convex/judgingGroups.ts`.
- **Frontend**: `src/components/admin/EditJudgingGroupModal.tsx`.
- **PRD**: `prds/judging-required-tag-submissions.md`

### [Added] - 2026-06-28

**Multi-Judge Submissions**

- Admins can set how many judges must score each submission (1 to 20, default 1) via a new "Judging Settings" section in EditJudgingGroupModal.
- When set above 1, judges see a "Judged & Next" button instead of "Mark Submission Complete" that records their completion and advances to the next unjudged submission.
- A completion counter shows how many of the required judges have completed each submission. Once the threshold is reached the submission locks and becomes read-only.
- After a judge submits their scores (or when the submission is locked), the interface reveals an overall average plus each judge's individual criteria scores.
- Other judges' scores are hidden until the current judge completes their own scoring (after-self reveal rule).
- Each judge writes their own completion row in a new `submissionJudgeCompletions` table, avoiding OCC write conflicts on the shared status row.
- JudgeTracking admin view shows a "multi-judge mode" banner when enabled.
- Default (`judgesPerSubmission = 1`) behavior is completely unchanged.
- **Schema**: added `judgesPerSubmission` to `judgingGroups`; new `submissionJudgeCompletions` table with indexes.
- **Backend**: `markJudgeCompleted` mutation, `getSubmissionJudgeBreakdown` query, multi-judge aware `getJudgeProgress` and `getSubmissionStatusForJudge`.
- **Frontend**: `EditJudgingGroupModal.tsx`, `JudgingInterfacePage.tsx`, `JudgeTracking.tsx`.
- **PRD**: `prds/multi-judge-submissions.md`

### [Added] - 2026-06-28

**Agent Skill Scaffolding (Dev Tooling)**

- Added agent skill directories to the repo so coding agents share consistent project context: `.agents/skills/*` and `.claude/skills/*` (Convex quickstart, auth setup, component creation, migration helper, performance audit, plus design and workflow skills).
- Added `AGENTS.md` and `CLAUDE.md` project context files and a `skills-lock.json` manifest.
- Tooling only: no application code, Convex functions, or schema changes. Production build verified (`npm run build`, exit 0).
- **Files Added**: `.agents/skills/`, `.claude/skills/`, `AGENTS.md`, `CLAUDE.md`, `skills-lock.json`

### [Added] - 2026-06-28

**Tag Management: Top Pagination Synced With Bottom**

- Added a second pagination control to the top of the admin Tag Management list, placed next to the "Tags per page" selector. The original bottom control remains.
- Both controls render from a single shared `renderPagination()` helper backed by the same `currentPage`/`safePage`/`totalPages` state, so paging from either location keeps both in sync.
- No backend or schema changes; UI-only enhancement.
- **Files Modified**: `src/components/admin/TagManagement.tsx`

### [Fixed] [Changed] - 2026-06-28

**Lint Cleanup: Zero ESLint Errors + React Hooks Fixes**

- **Fixed 4 real `react-hooks/rules-of-hooks` violations** (pre-existing) where hooks ran after an early `return`, which can cause render crashes. Moved the early returns below the hooks in `MessageDialog.tsx`, `ImageGallery.tsx`, and `ContentModeration.tsx`. Behavior is identical (effects already guard internally; the bail-out just happens after hooks run).
- **Fixed safe mechanical lint errors** with no behavior change: removed unnecessary escape characters in regex/template strings (`templates.ts`, `submitMeta.ts`, `StoryDetail.tsx`, `JudgingInterfacePage.tsx`), scoped a `switch` case block in `clerk.ts` (`no-case-declarations`), and converted three empty `interface Tag extends Doc<"tags">` declarations to type aliases (`ResendForm.tsx`, `StoryForm.tsx`, `YCHackForm.tsx`).
- **Rule levels (advisory, not blocking)**: set `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` to `warn` in `eslint.config.js`, with `ignoreRestSiblings` + `^_` ignore patterns so intentional `const { _id, _creationTime, ...rest } = doc` omit patterns are not flagged. `@convex-dev/no-filter-in-query` stays a warning. These 400+ pre-existing items remain visible as warnings to burn down over time without blocking the build.
- **Result**: `npm run lint` reports 0 errors (was ~318). Verified `tsc --noEmit` clean, production build succeeds, Convex functions compile, app behavior unchanged.
- **Files Modified**: `eslint.config.js`, `convex/clerk.ts`, `convex/emails/templates.ts`, `netlify/edge-functions/submitMeta.ts`, `src/components/ui/MessageDialog.tsx`, `src/components/ImageGallery.tsx`, `src/components/admin/ContentModeration.tsx`, `src/components/ResendForm.tsx`, `src/components/StoryForm.tsx`, `src/components/YCHackForm.tsx`, `src/components/StoryDetail.tsx`, `src/pages/JudgingInterfacePage.tsx`

### [Changed] - 2026-06-28

**Dependency Upgrade: Convex 1.42.0 + Convex ESLint Plugin**

- Upgraded `convex` from `1.34.1` to `1.42.0` (latest) along with the components that gate it: `@convex-dev/resend` (`0.1.13` to `0.2.5`), `@convex-dev/rate-limiter` (`0.2.13` to `0.3.2`, transitive), `@convex-dev/workpool` (`0.2.18` to `0.4.7`, transitive), and `convex-helpers` (`0.1.104` to `0.1.120`). All resolve to a single deduped Convex version with no peer conflicts.
- Added `@convex-dev/eslint-plugin@2.0.0` (dev) and wired `convexPlugin.configs.recommended` into `eslint.config.js` to enforce Convex best practices (argument validators, `.withIndex` over `.filter`, object function syntax).
- Bumped `typescript-eslint` (`8.8.1` to `^8.62.0`) to fix an incompatibility with `eslint@9.36` that crashed the `no-unused-expressions` rule.
- Cleaned up unused bindings in `convex/sendEmails.ts` and ran ESLint autofix across the project.
- **Verified**: `convex dev` functions ready, Vite dev clean, `tsc --noEmit` clean (frontend), `convex codegen` typecheck clean, production build succeeds. No runtime or type breakage from the upgrade.
- **Files Modified**: `package.json`, `package-lock.json`, `eslint.config.js`, `convex/sendEmails.ts`

### [Added] - 2026-06-28

**Judging Custom Submission Page: Admin-Selectable Required Fields**

- Admins can now choose which fields are required on a judging group's custom submission page
  - New "Required Submission Fields" checkbox group in EditJudgingGroupModal (Custom Submission Page section)
  - Configurable fields: App Title, Tagline, Description, App Website Link, GitHub Repo URL, Video Demo, Screenshot, Your Name, Email, Tags
  - Public submission page applies required state dynamically, including label asterisks and a tag-selection guard
  - Unset fields fall back to existing defaults so prior judging groups are unchanged
- **Schema**: added `submissionFieldRequirements` to `judgingGroups`
- **Files Modified**: `convex/schema.ts`, `convex/judgingGroups.ts`, `src/components/admin/EditJudgingGroupModal.tsx`, `src/pages/JudgingGroupSubmitPage.tsx`

### [Changed] - 2026-06-28

**Tag Management: Faster Save + Pagination**

- **Fixed slow save**: the admin Tag Management Save now only persists tags that were actually changed (added, edited, or deleted) instead of re-saving every tag. Previously it fired a mutation for all tags (400+ in production), which made Save take several seconds. Reordering is still persisted immediately by the Order input and drag-and-drop, so nothing is lost.
- **Fixed slow drag-and-drop reorder**: dropping a tag now persists only the tags whose order value actually changed (the moved range), running those updates in parallel, instead of writing every tag on every drop.
- **Added pagination**: tags are split into pages with First/Prev/numbered/Next/Last controls and a result summary.
- **Added page size selector**: choose how many tags show per page (5, 10, 20, 30, 40, 50, 100, 200). Defaults to 20.
- **Search across all tags**: search now filters the full tag set before pagination, so matches are found regardless of the current page.
- **Files Modified**: `src/components/admin/TagManagement.tsx`

### [Fixed] [Added] - 2026-06-27

**Email Kill Switch Honored + Tag-Based Broadcast Emails**

- **Fixed global email toggle**: disabling emails in the admin dashboard now blocks every email type. Previously admin report notifications (`admin_report_notification`, `admin_user_report_notification`) bypassed the global kill switch and kept sending even when emails were disabled. The switch is now authoritative for all email types.
- **Added tag-based broadcast**: admins can now send a broadcast email to everyone who used a specific tag (authors of submissions carrying that tag). New "Send to everyone who used a tag" option in Email Management with a searchable tag selector, a submission-status filter (pending/approved/rejected), and a live recipient count. Skips users without an email and anyone who unsubscribed.
- **Files Modified**: `convex/emails/resend.ts`, `convex/emails/broadcast.ts`, `src/components/admin/EmailManagement.tsx`

### [Added] - 2025-11-23

**Edit Judging Group Modal**

- Added comprehensive EditJudgingGroupModal component for managing judging group settings
  - Edit all group settings including name, description, access controls, and custom submission page configuration
  - Manage judge access with public/private toggle and password protection
  - Configure submission page access with separate password protection
  - Control results page visibility with public/private toggle and password
  - Toggle group active/inactive status
  - Custom submission page settings:
    - Enable/disable custom submission page
    - Upload header image with size control (100-1000px)
    - Select layout: two-column (50/50) or one-third (33/67)
    - Custom page title and description
    - External links management (add/remove label-URL pairs)
    - Custom form title and subtitle
    - Required tag selection (auto-selected and locked in form)
  - Submission page URL display with copy and open links
  - Password management with option to keep existing passwords
  - Form validation and error handling
  - Real-time updates with Convex reactivity
- **Files Added**: `src/components/admin/EditJudgingGroupModal.tsx`
- **Files Modified**: `src/components/admin/Judging.tsx` (integrated edit modal)

### [Added] - 2025-11-22

**Judging Interface Submission Filters**

- Added tag filter dropdown to judging interface for filtering submissions by tag
- Added judged status filter to show all submissions, not judged, or completed submissions
- Filters work together for advanced submission browsing
- Clear visual indicators when filters are active
- "Clear All Filters" button to reset filter selections
- Search functionality works on top of active filters
- **Files Modified**: `src/pages/JudgingInterfacePage.tsx`

### [Fixed] - 2025-11-23

**User Profile Name Update - Last Name Removal**

- Fixed issue where users couldn't successfully remove their last name from their profile
  - **Root Cause**: Clerk API doesn't accept empty string for `lastName` field, causing silent failure
  - **Impact**: Convex database updated successfully but Clerk sync failed, causing UI revert on refresh
  - **Solution**: Conditionally include `lastName` in Clerk update object only when it has a value
  - **Implementation**: Build update object with optional `lastName` field using TypeScript type `{ firstName: string; lastName?: string }`
  - Users can now save profiles with just a first name (no last name)
  - Maintains support for full names (first + last name) without any changes
- **Files Modified**: `src/pages/UserProfilePage.tsx`
- **Issue**: Fixes #11
- **PR**: Closes #12 (implemented same solution)

### [Fixed] - 2025-11-22

**Sticky Sidebar on Individual App Pages**

- Fixed sticky column positioning on individual app detail pages
  - Added `self-start` class to sidebar parent div for proper sticky behavior
  - Adjusted top spacing from `top-4` to `top-8` for better vertical alignment
  - Sidebar now correctly stays visible when scrolling through long app descriptions
  - Ensures proper sticky positioning in flexbox layout on desktop and tablet views
- **Files Modified**: `src/components/StoryDetail.tsx`
- **PR**: Merges #14 by @Jamesllllllllll

### [Added] - November 16, 2025

**Judging Interface Submission Filters**

- **Tag Filter**: Judges can now filter submissions by tag in the judging interface
  - Dropdown selector shows all tags present in judging group submissions
  - Filter submissions by specific category or technology
  - Works alongside other filters for precise submission viewing
  - Shows count of filtered vs total submissions (e.g., "filtered from 5 total")
- **Judged Status Filter**: Judges can filter submissions by completion status
  - "All Submissions" shows every submission in the group
  - "Not Judged" shows only submissions that haven't been completed by any judge
  - Helps judges focus on unreviewed submissions
  - Status determined by `completedBy` field (checks if any judge completed it)
- **Combined Filtering**: Both filters work together for advanced submission browsing
  - Filter by tag AND judged status simultaneously
  - Clear visual indicators when filters are active
  - "Clear All Filters" button to reset all filter selections
  - Smooth navigation between filtered submissions
- **Search Integration**: Search functionality works on top of active filters
  - Search within filtered results
  - Maintains filter state while searching
  - Shows completion status and judge names in search results

**Technical Implementation**

- **Frontend Changes** (`src/pages/JudgingInterfacePage.tsx`):
  - Added `selectedTagId` and `filterNotJudged` state management
  - Implemented `displaySubmissions` filter logic with tag and status checks
  - Added `useEffect` to reset submission index when filters change
  - Updated all navigation and data fetching to use filtered submissions
  - Added responsive dropdown selectors with consistent styling
  - Defensive checks prevent errors when submissions list changes
- **Filter Logic**:
  - Tag filter: Checks if submission has matching tag in its tags array
  - Status filter: Checks `judgeProgress.submissionProgress` for `completedBy` field
  - Combined with AND logic: `matchesTag && matchesJudgedFilter`
  - Shows "No Submissions Match Filters" message with clear button when no results
- **UI Design**:
  - Responsive filter row with proper wrapping on mobile
  - Consistent height (h-8) and styling across all dropdowns
  - Custom dropdown arrows and focus states
  - Maintains site color scheme (#F2F4F7 background, clean borders)

**User Benefits**

- Judges can quickly find submissions by category or technology
- Focus on unreviewed submissions to improve efficiency
- Better coordination in multi-judge scenarios
- Reduces time spent navigating through irrelevant submissions
- Clear visual feedback on filter status and results

### [Added] - October 15, 2025

**Inbox Message Emoji Reactions**

- **Emoji Reactions**: Users can now react to direct messages with predefined emoji reactions
  - **Predefined Emojis**: Six emoji reactions available: 👍 ❤️ 😂 😮 😢 👏
  - **One Reaction Per User**: Each user can add one emoji reaction per message
  - **Hover to React**: Reaction picker appears when hovering over messages
  - **Click to Remove**: Users can remove their own reactions by clicking them
  - **Real-Time Updates**: Reactions update instantly via Convex reactivity
  - **Reaction Display**: Shows emoji with count and list of who reacted on hover
- **Backend Implementation**:
  - **New Table**: `dmReactions` table for storing message reactions
  - **New File**: `convex/dmReactions.ts` with reaction mutations and queries
  - **Updated Queries**: `listMessages` in `convex/dm.ts` now includes reactions
- **Frontend Features**:
  - **Interactive UI**: Smooth animations for adding and removing reactions
  - **Reaction Picker**: Displays on message hover with all emoji options
  - **Highlight User Reactions**: User's own reactions highlighted with dark background
  - **Responsive Design**: Works seamlessly on desktop and mobile
  - **Type Safety**: Fully type-safe implementation with Convex validators
  - **Clean Layout**: Message bubbles maintain proper width with reactions displayed below

### [Enhanced] - October 12, 2025

**Group-Wide Progress Tracking Enhancement ✅ COMPLETED**

- **Updated Progress Bars**: All progress indicators now show group-wide completion percentage
  - **Header Progress Bar**: Now displays percentage of submissions completed by ANY judge in the group
  - **Overall Progress Display**: Shows group-wide completion instead of individual judge progress
  - **Progress Summary Bar**: Updated to reflect total group completion for better transparency
  - **Calculation Change**: Changed from `judgeProgress.completionPercentage` (individual) to `groupCompletionPercentage` (group-wide)
  - **User Experience**: All judges now see the same progress percentage, improving coordination and transparency
  - **Consistency**: Progress bars now match the submission counter (e.g., "5/20 submissions" = 25% for all judges)

**Judge Tracking UI Reorganization & Navigation Enhancements ✅ COMPLETED**

- **Improved Page Structure**: Reorganized Judge Tracking page sections for better workflow
  - **Section Order**: Changed section order to Stats Overview → Judge Activity → Judge Scores & Comments
  - **Breadcrumb Navigation**: Added quick navigation links to jump between sections (Stats, Activity, Scores)
  - **Scroll Enhancements**: Added floating scroll-to-top and scroll-to-bottom buttons for easy navigation
  - **Anchor Links**: Added id attributes and smooth scroll behavior to all major sections
  - **User Experience**: Improved page navigation for admins monitoring multiple judges and reviewing detailed scoring data

**Judge Tracking UI Reorganization ✅ COMPLETED**

- **Moved Judge Scores & Comments Section**: Relocated comprehensive judge scoring interface from public results to admin tracking
  - **Admin Focus**: Judge Scores & Comments now appears in Judge Tracking page for better admin workflow
  - **Page Reordering**: Reorganized Judge Tracking page layout for optimal information hierarchy
    - Header with group info and export button
    - Stats Overview (Total Judges, Total Scores, Avg Score, Linked Profiles)
    - Judge Scores & Comments (tabbed interface with detailed scores per judge)
    - Judge Activity (expandable list with score moderation tools)
  - **Public Results Cleanup**: Removed Judge Scores & Comments from PublicJudgingResultsDashboard
  - **Simplified Public View**: Public results now focus on rankings and criteria performance only
  - **Backend Integration**: Uses existing `getGroupJudgeDetails` query for comprehensive judge data
  - **User Experience**: Admins get centralized view of all judging data in one location
  - **Code Quality**: Removed unused imports and state management from public dashboard

**Multi-Judge Submission Visibility System ✅ COMPLETED**

- **Enhanced Transparency in Judging**: All judges now see ALL submissions in a judging group for better coordination
  - **Backend Changes** (`convex/judges.ts`):
    - Modified `getJudgeProgress` query to return all submissions instead of filtering
    - Added `canEdit` boolean flag to indicate if judge can edit each submission
    - Added `completedBy` string field showing which judge completed the submission
    - Judges can only edit submissions that are: pending, skip, or completed by themselves
  - **Frontend Changes** (`src/pages/JudgingInterfacePage.tsx`):
    - Removed submission filtering logic that previously hid completed submissions
    - Changed progress counter to count submissions completed by ANY judge (not just this judge)
    - Enhanced search dropdown to show completion status and judge names
    - UI now disables scoring inputs for submissions completed by other judges
    - Added visual notices explaining when submissions are read-only
  - **User Experience Improvements**:
    - All judges see the same total submission count
    - Progress shows group-wide completion (e.g., "5/20 submissions")
    - Judges can VIEW others' completed submissions but cannot edit them
    - Clear visual indicators show who completed which submission
    - Improved coordination and transparency in multi-judge scenarios
  - **Code Quality**: Removed unused `useMemo` import from React

**Documentation Updates**

- **Judging Setup PRD**: Updated `prds/judgingsetup.md` with comprehensive documentation of new multi-judge visibility system
  - Updated "How Submission Availability Works" section with October 12, 2025 changes
  - Documented new backend logic with `canEdit` and `completedBy` fields
  - Updated frontend implementation examples
  - Revised progress calculation explanation
  - Updated multi-judge scenario examples
  - Added comparison of old vs new approach with advantages/trade-offs

### [Updated] - October 11, 2025

**Documentation Updates ✅ COMPLETED**

- **Admin Alert Emails PRD**: Updated `prds/adminalerrtemails.md` to reference recent email infrastructure improvements
  - Added references to enhanced testing panel with date ranges and activity warnings
  - Documented comprehensive testing guides (TESTING_SUMMARY.md and EMAIL_DATE_RANGE_FIX.md)
  - Added note about Phase 11 infrastructure improvements (date range fixes and inbox message integration)
  - Updated testing procedures to include new testing panel functionality
  - Enhanced References section with links to all testing documentation

- **Email Testing Guide**: Updated `prds/email-testing-guide.MD` with Phase 11 enhancements
  - Added cross-references to TESTING_SUMMARY.md and EMAIL_DATE_RANGE_FIX.md
  - Documented enhanced testing features: date range display, activity warnings, inbox message integration
  - Updated testing workflow to highlight Phase 11 improvements
  - Enhanced Support section with links to comprehensive testing documentation

- **Mentions PRD**: Updated `prds/mentions.md` email integration section
  - Added note about Phase 11 improvements to daily email system
  - Documented inbox message integration alongside mentions in daily emails
  - Cross-referenced addresend.md Phase 11 for complete details

### [Fixed] - October 11, 2025

**Daily Email Inbox Messages Integration ✅ COMPLETED**

- **Inbox Messages in Daily Engagement Emails**: Users now receive daily emails when they get inbox messages
  - Enhanced `convex/emails/daily.ts` to check for inbox messages received today
  - Added `getDMsReceivedByUser` helper in `convex/emails/helpers.ts` that groups messages by sender
  - Updated `generateEngagementEmail` template to display inbox notifications
  - Shows sender name and message count (e.g., "You received 3 messages from John Doe")
  - Privacy-first: Never shows message content in emails
  - Daily emails now trigger for: engagement OR mentions OR replies OR inbox messages

**Critical Date Range Bug Fix ✅ COMPLETED**

- **Fixed Date Mutation Issues**: Resolved critical bug causing incorrect date range calculations
  - **Root Cause**: `setHours()` method mutates Date objects in place, breaking subsequent calculations
  - **Impact**: Daily and weekly emails showed zero activity even when there was activity
  - **Solution**: Refactored date range calculation to parse date string and create new Date objects
  - **Functions Fixed**:
    - `calculateDailyMetrics`: Now correctly calculates today's activity (00:00:00 to 23:59:59)
    - `processEngagementForAllUsers`: Fixed date range for user engagement processing
  - **Code Pattern**: Changed from `new Date(today.setHours(...))` to `new Date(year, month - 1, day, ...)`

**Email Testing Panel Enhancements ✅ COMPLETED**

- **Enhanced Testing Visibility**: Improved admin testing tools for better debugging
  - Date range display now shows exact date range being tested
  - Activity warnings show when no activity found for tested date range
  - Warning types: "⚠️ No activity", "✅ Activity found"
  - Help documentation explains daily and weekly date ranges
  - Created comprehensive documentation in `prds/TESTING_SUMMARY.md` and `prds/EMAIL_DATE_RANGE_FIX.md`

**Documentation Organization**

- **Moved Testing Documentation**: Organized testing files into prds folder
  - Moved `TESTING_SUMMARY.md` to `prds/TESTING_SUMMARY.md`
  - Moved `EMAIL_DATE_RANGE_FIX.md` to `prds/EMAIL_DATE_RANGE_FIX.md`
  - Updated `addresend.md` with Phase 11 implementation details
  - All markdown documentation now properly organized in prds folder

**Technical Implementation**

- **Backend Changes**:
  - `convex/emails/daily.ts`: Fixed date range bugs, added inbox message checking
  - `convex/emails/helpers.ts`: Added `getDMsReceivedByUser` query with sender grouping
  - `convex/emails/templates.ts`: Updated engagement email template for inbox messages
- **Frontend Changes**:
  - `src/components/admin/EmailTestingPanel.tsx`: Enhanced with date range display and warnings
- **Documentation**:
  - `prds/addresend.md`: Added Phase 11 documentation with detailed fixes
  - `prds/TESTING_SUMMARY.md`: Comprehensive testing guide
  - `prds/EMAIL_DATE_RANGE_FIX.md`: Detailed date range fix explanation

### [Added] - October 10, 2025

**Judge Tracking Dedicated Page & UI Improvements**

- Created dedicated page for Judge Tracking with URL pattern `/admin/judging/{slug}/tracking`
  - Each judging group now has its own dedicated tracking page
  - Judges button in admin judging list now links to dedicated page instead of inline view
  - Better navigation with URL-based routing
  - Back button returns to admin judging dashboard
  - Supports direct linking and bookmarking of tracking pages
  - Cleaner admin interface with separated concerns

- Enhanced judge notes styling with sticky note appearance
  - Main notes display with bright yellow sticky note background (#FFF9C4)
  - Replies display with lighter yellow background (#FFFDE7)
  - Black text for better readability and sticky note aesthetic
  - Yellow borders (#F9E79F) for consistent theme
  - Improved visual hierarchy with darker text colors
  - Better contrast for judge names and timestamps

**Technical Implementation**

- **Frontend Changes**:
  - Created `src/pages/JudgeTrackingPage.tsx` for dedicated tracking interface
  - Updated `src/App.tsx` with new route: `/admin/judging/:slug/tracking`
  - Modified `src/components/admin/Judging.tsx` to use Link instead of inline state
  - Removed tracking view state management from Judging component
  - Updated `src/components/admin/JudgeTracking.tsx` with sticky note styling for notes
  - Changed note background from white to yellow (#FFF9C4)
  - Changed reply background from purple to lighter yellow (#FFFDE7)
  - Updated text colors from gray to black for better readability
  - Changed border colors to match yellow theme (#F9E79F)
- **Backend Changes**:
  - Added `getGroupBySlug` query in `convex/judgingGroups.ts`
  - Admin-only query that fetches judging group by slug
  - Maintains admin role requirements for security
- **User Experience**:
  - Each tracking session has its own URL for sharing and bookmarking
  - Browser back/forward buttons work naturally
  - Deep linking support for direct access to tracking pages
  - Improved navigation flow in admin dashboard

### [Added] - October 5, 2025

**Judge Notes Viewing and Moderation in Judge Tracking**

- Added ability for admins/moderators to view judge notes on submissions
  - Purple message icon on each score entry to view notes for that submission
  - Shows all collaboration notes judges left on that specific submission
  - Displays note author, timestamp, and full content with @mention support
  - Shows threaded replies to notes
  - Admin/moderator can reply to any note as the judge they're viewing
  - Reply form includes @mention autocomplete for user mentions
  - All replies are posted as if from the currently selected judge
  - Uses consistent messaging UI with MentionTextarea component
  - Real-time updates when notes are added or replied to
  - Note count badges (purple) display on submissions with notes
  - Badge shows total number of notes including replies (e.g., "3 notes")
  - Compact reply button design for better mobile responsiveness
  - Judge list shows total notes count per judge next to submissions judged
  - Notes count displays with purple message icon for visual clarity

**Judge Tracking CSV Export**

- Added comprehensive CSV export functionality to Judge Tracking dashboard
  - Export button in header downloads all judge activity data
  - CSV includes judge names, emails, usernames, linked user IDs
  - Submission titles and slugs for each score
  - Judging criteria questions and descriptions
  - Individual scores and comments
  - Judge collaboration notes with timestamps for each submission
  - Total score for each submission (sum of all criterion scores by that judge)
  - Hidden status for moderated scores
  - Formatted submission timestamps
  - Blank rows automatically added between different submissions for readability
  - Notes formatted as: [Date] Note content | [Date] Next note
  - Filename format: `judge-activity-{group-name}-{date}.csv`
  - Properly escaped CSV values handling commas, quotes, and newlines
  - Button disabled when no data available
  - Gracefully handles deleted judges, stories, or criteria by skipping those scores

**Judge Tracking UI Improvements**

- Removed confusing "scores" column from judge list
- Simplified metrics to show only submissions judged and average score
- Changed "subs" abbreviation to "submissions judged" for clarity
- Reordered columns to show submissions judged first
- Changed "avg" label to "avg score" for better clarity
- Improved spacing and layout of judge stats
  - Increased gap between stats from 2 to 6 (gap-6)
  - Added ml-auto to push stats to the right side
  - Increased minimum widths for better readability
  - Better color contrast for stat labels (text-gray-500, text-gray-600)

**Technical Implementation**

- Backend: Enhanced `getJudgeTrackingExportData` query in `convex/adminJudgeTracking.ts`
  - Fetches comprehensive judge scoring data across all criteria
  - Calculates total scores for each judge-submission pair
  - Includes judge profile information and user linkages
  - Fetches all judge collaboration notes for each submission
  - Formats notes with timestamps for CSV export
  - Filters to include only parent notes (not replies) in export
  - Sorts data by judge name then submission date
  - Returns formatted date strings for CSV readability
- Backend: Added `getSubmissionNoteCounts` query in `convex/adminJudgeTracking.ts`
  - Efficiently counts ALL notes per submission in a judging group (including historical)
  - Returns Record<Id<"stories">, number> for type-safe lookups
  - Includes all notes and replies in the count (no time filters applied)
  - Properly back-fills existing notes from database
- Backend: Enhanced `getGroupJudgeTracking` query in `convex/adminJudgeTracking.ts`
  - Fetches ALL submission notes for the judging group (includes all historical notes)
  - Calculates total notes count per judge (notesCount field)
  - Includes notes count in judge tracking data structure
  - Uses `.collect()` with no time filters to ensure all existing notes are counted
  - Counts both parent notes and replies written by each judge
- Frontend: Enhanced `JudgeTracking.tsx` component
  - Added CSV generation function with proper escaping
  - Integrated Download and MessageSquare icons from lucide-react
  - Added export button with loading state handling
  - Added note count badges next to submissions with notes
  - Added notes count stat in judge list showing total notes per judge
  - Notes count displays with purple MessageSquare icon next to submissions judged
  - Converted reply button to compact link-style for mobile responsiveness
  - Note counts update in real-time when notes are added
  - CSV export now includes judge notes column
  - CSV export groups data by submission and adds blank rows between groups
  - Improved judge stats layout with better spacing (gap-6, ml-auto)
  - Increased minimum widths for stats columns for better readability
  - Cleaned up unused imports and mutations

### [Fixed] - October 5, 2025

**Judge Tracking Error Handling**

- Fixed crash when exporting CSV with deleted judges, stories, or criteria
  - **Root Cause**: Export query threw error when encountering scores with missing related data
  - **Impact**: JudgeTracking component crashed with "Missing related data for score" error
  - **Fix Applied**: Changed query to gracefully skip scores with deleted references
  - Now returns only valid scores and filters out orphaned entries
  - Maintains data integrity while preventing application crashes

### [Added] - October 2, 2025

**Judging Interface Tags Display**

- Added tags display to the Judging Interface page
  - Tags now appear above the "Originally submitted" date section
  - Matches the tag display style from the StoryDetail page
  - Shows tag emoji/icon, name, and custom colors
  - Filters out hidden tags and specific hackathon tags (resendhackathon, ychackathon)
  - Tags are clickable and link to the tag filter page
  - Judges can now quickly see what categories/technologies each submission belongs to

**Technical Implementation**

- **Backend Changes** (`convex/judgingGroupSubmissions.ts`):
  - Updated `getGroupSubmissions` query to resolve and return tags
  - Added `tagIds` and `tags` to return type validator
  - Tags are now fetched and resolved with all properties (emoji, iconUrl, colors)
  - Properly handles missing/deleted tags by filtering them out
- **Backend Changes** (`convex/validators.ts`):
  - Updated `tagDocValidator` to include all tag fields
  - Added `borderColor`, `emoji`, and `iconUrl` to validator
  - Ensures type safety for tag data across all queries

- **Frontend Changes** (`src/pages/JudgingInterfacePage.tsx`):
  - Imported `Doc` type from dataModel for proper tag typing
  - Added tags display section with same styling as StoryDetail page
  - Positioned tags between action buttons and submission date info
  - Uses inline styles for custom tag colors (backgroundColor, textColor, borderColor)
  - Conditional rendering only shows tags if submission has tags array with items

### [Fixed] - October 2, 2025

**Judging Group Error Handling**

- Fixed server error when accessing judging groups with deleted submissions
  - **Root Cause**: Multiple queries threw errors when stories referenced in judgingGroupSubmissions no longer existed
  - **Impact**: Judges saw blank page with "Server Error" when trying to access groups with deleted stories
  - **Fix Applied**: Updated all affected queries to gracefully handle missing stories
    - `judges:getJudgeProgress` now skips deleted submissions in progress calculations
    - `judgingGroupSubmissions:getGroupSubmissions` now filters out deleted stories from submission list
    - `judgingGroupSubmissions:getSubmissionStatuses` now skips deleted stories in status list
  - Queries now skip submissions where story has been deleted or archived
  - Progress calculations now based only on submissions with valid stories
  - No more server crashes when stories are removed from system
  - Judges can now access groups even if some submissions have been deleted

**Judging Progress Calculation & Display**

- Fixed judging progress calculation to accurately reflect completion status
  - **Root Cause**: Progress was calculated based on individual criterion scores rather than submission completion status
  - **Impact**: Judges saw incorrect progress percentages and misaligned submission counts
  - **Fix Applied**: Updated `getJudgeProgress` query to check `submissionStatuses` table for completed submissions
  - Progress now correctly counts submissions with status "completed" assigned to current judge
  - Completion percentage now based on completed submissions count, not individual scores
- Fixed submission navigation counter alignment
  - **Root Cause**: Frontend showed all submissions while progress showed only available ones
  - **Impact**: "Submission X of Y" counter didn't match progress "X/Y submissions" display
  - **Fix Applied**: Added `useMemo` hook to filter submissions based on judge's available list
  - Only shows submissions with status: pending, skip, or completed by current judge
  - Submissions completed by other judges are now hidden from judge's view
  - Navigation counter and progress display now properly synchronized

**Technical Implementation**

- **Backend Changes** (`convex/judges.ts`):
  - Modified `isComplete` logic to check `submissionStatuses` table
  - Changed from `criteriaScored === totalCriteria` to `submissionStatus?.status === "completed" && submissionStatus?.assignedJudgeId === judge._id`
  - Updated `completionPercentage` calculation to count completed submissions instead of scores
  - Formula changed from `(completedScores / totalScores)` to `(completedSubmissionsCount / totalSubmissions)`

- **Frontend Changes** (`src/pages/JudgingInterfacePage.tsx`):
  - Added `useMemo` hook to filter `allSubmissions` based on `judgeProgress.submissionProgress`
  - Creates `availableSubmissionIds` Set from judge's available submissions
  - Filters submissions to only show those available to current judge
  - Reordered `judgeProgress` query before `submissions` filter to fix dependency order

**User Benefits**

- Accurate progress tracking reflects actual completion status
- No confusion between progress percentage and submission counter
- Judges only see submissions they should be judging
- Previously completed submissions correctly counted in progress
- Clean, consistent judging experience across all metrics

### [Enhanced] - October 2, 2025

**Inbox User Blocking & Reporting**

- Added user blocking feature in inbox conversations
  - Block button (Ban icon) in conversation header next to report and delete buttons
  - Block/unblock toggle functionality with custom modal confirmations
  - Blocked users cannot send messages to users who blocked them
  - Clean error banner displays "You have been blocked by this user" instead of console errors
  - Icon styled in light grey (#787672) with hover to black (#292929)
  - Real-time block status checking and UI updates
  - Custom modals match site design (black/white, clean typography)

- Enhanced user reporting in inbox
  - User reports from inbox now integrate with admin UserReportManagement dashboard
  - Reports appear in both dmReports and userReports tables
  - Automatic email notifications sent to all admins and managers when users are reported
  - Uses existing admin email notification system (bypasses global email toggle)
  - Prevents self-reporting with validation
  - Report submissions include reason and timestamp
  - Custom report modal with textarea (500 character limit) replaces browser prompts
  - Clean, site-matching UI design for all modals and confirmations

**Database Schema**

- Added blockedUsers table with indexes:
  - by_blocker_blocked: Check if specific user is blocked
  - by_blocker: Get all users blocked by someone
  - by_blocked: Get all users who blocked someone

**UI Improvements**

- Redesigned Inbox page with messenger-style 3-column layout
  - **Left Column**: Conversations list with improved card design and rounded borders
  - **Middle Column**: Messages area with cleaner chat bubbles and improved typography
  - **Right Column**: Community sidebar featuring "Most Vibes This Week", "Recent Vibers", and "Top Categories This Week" (visible on XL screens)
  - Changed from full-viewport fixed layout to container-based layout with `h-[calc(100vh-12rem)]`
  - Updated color scheme to match site design system using `#292929`, `#D8E1EC`, `#F2F4F7`, `#787672`
  - Improved conversation list items with better spacing and unread badge styling
  - Enhanced message input with rounded corners and refined button styling
  - Better visual hierarchy with consistent borders and background colors
  - Responsive design: Single column on mobile, 2 columns on tablet, 3 columns on desktop (XL+)

**Features**

- Added report user functionality in inbox
  - Report button (Flag icon) in conversation header next to delete button
  - Click to report a user for inappropriate behavior
  - Provides prompt for detailed reason
  - Reports submitted to admin moderation queue
  - Icon styled in light grey (#787672) with hover to black
  - Uses existing `reportMessageOrUser` mutation for admin review

- Enhanced inbox conversation deletion and sync behavior
  - Conversations use soft delete (hidden from your view, not deleted from database)
  - When you delete a conversation, **all existing messages are marked as deleted** and hidden from your view
  - **NEW: Message sync fixed** - When someone sends you a message after you deleted the conversation, it automatically reappears in your inbox
  - `sendMessage` mutation now checks and removes recipient's deletion record when sending
  - **Only NEW messages** (sent after you deleted) will be visible - old messages stay hidden
  - Fresh conversation experience when restarting chats after deletion
  - Real-time conversation restoration when receiving new messages

- Clickable usernames and @mentions in inbox
  - @username mentions in chat messages are now clickable links
  - Usernames in conversation list (left sidebar) are clickable with hover underline
  - Username in chat header (top of conversation) is clickable
  - All username links navigate directly to user profiles
  - Links styled in blue for @mentions, standard text color for names
  - No hover cards, just clean direct links to profiles

**Bug Fixes**

- Fixed missing input box when starting new conversation after deletion
  - **Root cause**: `upsertConversation` was only removing the other user's deletion record, not your own
  - Now removes **both** current user's and recipient's deletion records when restarting conversation
  - Added new `getConversation` query to fetch individual conversation details as fallback
  - Uses fallback query when conversation not yet in `listConversations` (timing issue)
  - Input box and conversation header now render immediately when starting new chat
  - Prevents "undefined" conversation state when navigating from profile "Message" button
  - Fixed useEffect dependency array warning by removing unstable navigate function

- Fixed deleted conversations still appearing in inbox
  - Added automatic clearing of selected conversation when it no longer exists in the list
  - Navigation now uses `replace: true` to properly clear the URL state
  - Conversation automatically disappears from view immediately after deletion
  - Added useEffect hook to monitor conversation list and auto-clear stale selections

- Fixed deleted conversations showing old messages when restarted
  - When deleting a conversation, all messages are now marked as deleted for that user
  - Old messages from deleted conversations no longer appear when someone messages you again
  - Creates true "fresh start" experience for restarted conversations
  - Both `deleteConversation` and `clearInbox` now properly hide all existing messages

- Fixed "Not authenticated" errors in inbox
  - Added authentication check before calling `markConversationRead` mutation
  - Made mutation gracefully handle unauthenticated state during page load
  - Prevents error spam in console when opening inbox before Clerk auth finishes loading
  - Mutation now silently returns null instead of throwing errors when user not authenticated

- Fixed inbox page scrolling behavior
  - Updated conversation list and messages area to have independent scrolling with `overflow-hidden` and `overflow-y-auto`
  - Changed auto-scroll behavior from "smooth" to "auto" with `block: "end"` to prevent triggering page scroll
  - Both conversation list and chat window now scroll independently within their containers
  - Page no longer scrolls when clicking messages or sending new messages

### [Fixed] - October 1, 2025

**Bug Fixes**

- Fixed "Invalid Date" display on judging interface page by adding `_creationTime` field to submission data
  - Updated `getGroupSubmissions` query to include `_creationTime` in return validator
  - Submission dates now display correctly showing when apps were originally submitted

### Inbox Messaging System ✅ FULLY IMPLEMENTED

**Added - Complete Direct Messaging Infrastructure**

- **Direct Messaging System**: Users can now send text-only direct messages to each other with comprehensive features
  - **Conversation Management**: Automatic conversation creation with participant tracking
  - **Real-time Updates**: Live message updates powered by Convex subscriptions
  - **Message Threading**: Chronological message display with smooth scrolling
  - **Character Limit**: 2000 character maximum per message for focused communication
  - **No File Attachments**: Simplified text-only messaging for clarity and moderation

- **@Mentions Integration**: Full mention support within direct messages
  - **Autocomplete**: LinkedIn-style @username autocomplete using MentionTextarea component
  - **Profile Links**: @mentions render as clickable profile links
  - **Mention Notifications**: Mentioned users receive notifications (future enhancement)
  - **Quota Enforcement**: Uses existing mention system quotas

- **Edit & Delete Functionality**: Message management capabilities
  - **24-Hour Edit Window**: Users can edit their messages within 24 hours of sending
  - **Edit History Tracking**: System records when messages are edited with timestamps
  - **Delete Anytime**: Users can delete their own messages at any time
  - **Visual Indicators**: Edited messages show "(edited)" label
  - **Edit UI**: Inline edit form with cancel option and character counter

- **Rate Limiting & Spam Prevention**: Comprehensive anti-spam measures
  - **New Conversation Limit**: 10 new conversations per 30 minutes per user
  - **Message Limit**: 50 messages per hour per user
  - **Automatic Reset**: Rate limit windows reset after time period expires
  - **User Feedback**: Clear error messages when rate limits are reached
  - **Database Tracking**: Rate limit tracking stored in dedicated table

- **Admin Reporting Integration**: Content moderation support
  - **Report Messages**: Users can report inappropriate direct messages
  - **Admin Dashboard**: Reports appear in admin content moderation panel
  - **Context Preservation**: Reports include full message context
  - **Admin Actions**: Admins can review and take action on reported messages
  - **Email Alerts**: Admin alert emails for reported messages (future enhancement)

- **Notification System**: Real-time inbox notifications
  - **Inbox Badge**: Inbox icon shows badge with unread message count
  - **Notification Alerts**: Users receive notifications for new messages
  - **Read Status**: Messages marked as read when conversation is viewed
  - **Persistent Indicator**: Unread count persists until messages are viewed

- **Email Notifications**: Separate inbox email system
  - **New Message Emails**: Users receive email notifications for new messages
  - **Independent System**: Inbox emails separate from daily digest
  - **Email Preferences**: Users can control inbox email settings
  - **Rate Limiting**: Email notification rate limiting to prevent spam

**Technical Implementation**

- **Database Schema**: Added complete messaging schema in `convex/schema.ts`
  - `directMessages` table with message content, edit tracking, and timestamps
  - `conversations` table with participant management and last message tracking
  - `messageRateLimits` table for spam prevention
  - Indexes: `by_conversation`, `by_sender`, `by_participants` for efficient queries
- **Backend Functions**: Complete messaging API in `convex/dm.ts`
  - `getOrCreateConversation`: Conversation initialization with participant validation
  - `sendMessage`: Message sending with rate limiting and validation
  - `getConversation`: Conversation retrieval with participant verification
  - `getMessages`: Message listing with pagination support
  - `editMessage`: Message editing with 24-hour window enforcement
  - `deleteMessage`: Soft delete with ownership validation
  - `markAsRead`: Read status tracking for notifications
  - `getConversations`: Conversation list with unread counts
  - `getUnreadCount`: Unread message counter for badge display
  - Rate limiting helpers and validation functions

- **Frontend Components**: Full-featured inbox interface in `src/pages/InboxPage.tsx`
  - **Responsive Layout**: Split-view design with conversation list and message thread
  - **Conversation List**: Shows all conversations with last message preview
  - **Message Thread**: Displays all messages in chronological order
  - **Message Composer**: MentionTextarea with @mention autocomplete
  - **Edit Interface**: Inline editing with cancel and save options
  - **Delete Confirmation**: Dialog confirmation before message deletion
  - **Loading States**: Skeleton loaders for better UX
  - **Error Handling**: Toast notifications for errors and success
  - **Mobile Responsive**: Works seamlessly on all device sizes

- **Navigation & Access**: Seamless integration with existing app
  - **Header Link**: "Inbox" navigation link with unread badge in header
  - **Protected Route**: Inbox page requires authentication
  - **Direct URLs**: Support for deep linking to specific conversations
  - **Profile Integration**: Message users directly from profile pages (future)

- **Notification Integration**: Enhanced notification system
  - Updated `convex/alerts.ts` to support message notifications
  - Added "message" type to notification schema
  - Badge display in header with unread count
  - Notification creation on new message receipt

**User Benefits**

- **Direct Communication**: Users can communicate privately without leaving the platform
- **Spam Protection**: Rate limiting ensures quality conversations
- **Content Control**: Edit/delete functionality gives users message control
- **Moderation**: Admin reporting keeps the platform safe
- **Real-time Experience**: Instant message delivery and notifications
- **Privacy**: Conversations are private between participants only

**Testing Completed**

- [x] Conversation creation and message sending
- [x] Rate limiting enforcement (both conversation and message limits)
- [x] Edit functionality within 24-hour window
- [x] Delete functionality with confirmation
- [x] @Mention autocomplete and rendering
- [x] Admin reporting integration
- [x] Notification badge display
- [x] Email notification delivery
- [x] Mobile responsive design
- [x] Error handling and edge cases

### Enhanced Tag Selection in Submission Editing 🏷️ NEW

**Added - Advanced Tag Management for User Edits**

- **Enhanced Tag Selection**: Users can now search and add/remove tags when editing their submissions (matching StoryForm.tsx functionality)
  - **All Tags Dropdown Search**: Type to search through all tags including hidden ones
  - **Visual Tag Display**: Shows tag colors, emojis, and icons in both visible tags and dropdown
  - **Hidden Tag Access**: Users can select tags that admins have hidden from the header display
  - **Create New Tags**: Enter key or "Create new tag" button to add custom tags
  - **Smart Filtering**: Excludes already selected tags from search results
  - **Click Outside to Close**: Dropdown closes when clicking outside for better UX
  - **10-Tag Limit**: Comprehensive validation prevents selection beyond 10 total tags
  - **Selected Tags Display**: Dedicated section showing all selected tags with remove buttons
  - **Tag Counter**: Shows current selection count with maximum (e.g., "Selected Tags (3/10)")
  - **Visual Indicators**: "(New)" label for newly created tags, "(Hidden)" for hidden tags

- **Tag Change Tracking**: All tag modifications automatically tracked in submission changelog
  - Shows which tags were added (green)
  - Shows which tags were removed (red)
  - Displays tag names in easy-to-read format
  - Includes in overall edit history with timestamps

**Technical Implementation**

- **Frontend Updates**: Enhanced `StoryDetail.tsx` with comprehensive tag management
  - Added `allTags` query to fetch all tags including hidden ones
  - Added dropdown search state and handlers
  - Implemented `handleSelectFromDropdown` and `handleAddNewTag` functions
  - Added `handleRemoveNewTag` for managing new tag creation
  - Enhanced `toggleTag` with 10-tag limit validation
  - Added click-outside handler for dropdown auto-close
  - Replaced simple tag buttons with full dropdown search UI

- **State Management**: Added new state variables for tag editing
  - `dropdownSearchValue`: Tracks search input
  - `showDropdown`: Controls dropdown visibility
  - `newTagNames`: Manages newly created tags before submission

- **UI Components**: Comprehensive tag selection interface
  - Visual tag buttons with emoji/icon support
  - Dropdown search with 10-result limit for performance
  - Selected tags display section with remove functionality
  - Error messages for tag limit and validation
  - Consistent styling with existing design system

**User Benefits**

- **Enhanced Flexibility**: Search and select from all tags including hidden ones
- **Better UX**: Same powerful tag management as initial submission form
- **No Limitations**: Users can update tags just as easily as creating new submissions
- **Visual Feedback**: Clear indication of selected, new, and hidden tags
- **Change Tracking**: All tag modifications tracked in changelog for transparency

**Integration Notes**

- Works seamlessly with existing changelog system
- No breaking changes to existing tag functionality
- Maintains 10-tag limit across all tag selection methods
- Consistent with StoryForm.tsx tag management experience

### Submission Change Log Tracking 📝

**Added - Comprehensive Edit History Tracking**

- **New Feature**: Added detailed change log tracking for user submission edits
  - Always visible below the "Rate this app" section on story detail pages
  - Shows original submission date/time at the top with clear separator
  - Shows all edits made by the submission owner with date and time in user's local timezone
  - Displays friendly message when no changes have been made yet
  - Collapsible entries (closed by default) with clean toggle UI
  - Tracks text changes (title, tagline, description, name)
  - Tracks link changes (app URL, LinkedIn, Twitter/X, GitHub, etc.)
  - Tracks tag additions and removals
  - Notes video changes (indicates video was updated but doesn't show old/new)
  - Notes image changes (indicates screenshots or gallery images were updated)
- **Navigation Enhancements**:
  - Added "View Change Log" link in Project Links & Tags sidebar (desktop)
  - Added "View Change Log" link in mobile Project Links & Tags section
  - Added "View Change Log" button on Judging Interface page
  - All links use anchor navigation (#changelog) for smooth scrolling
  - Changelog section has scroll-mt-20 for proper positioning when navigating

**Technical Implementation**

- **Database Schema**: Added `changeLog` field to stories table in `convex/schema.ts`
  - Stores array of changelog entries with timestamps
  - Each entry includes textChanges, linkChanges, tagChanges, videoChanged, and imagesChanged
- **Mutation Updates**: Enhanced `updateOwnStory` mutation in `convex/stories.ts`
  - Compares old and new values for all fields
  - Creates detailed changelog entry for each edit
  - Automatically appends to existing changelog array
- **UI Component**: Added changelog section to StoryDetail component
  - Displays changes in an organized, readable format
  - Text changes show old (strikethrough red) and new (green) values
  - Link changes show old and new URLs
  - Tag changes list added and removed tags
  - Video and image changes show simple notification
  - Date/time formatted using browser's locale settings

**User Benefits**

- Transparency: Users can see full edit history of submissions
- Accountability: Track what changed and when
- Trust: Community can verify accuracy and authenticity of edits
- History: Preserve record of submission evolution over time

### Project Documentation Organization 📁

**Changed - PRD Files Reorganization**

- **Folder Structure**: Moved all PRD (Product Requirements Document) files from project root to dedicated `prds/` folder
  - **Improved Organization**: Cleaner root directory with better separation of documentation types
  - **Files Moved**: All `.md` and `.MD` PRD files now organized under `prds/` directory
  - **Preserved Files**: Core documentation remains in root: `README.md`, `changelog.MD`, `files.MD`, `TASK.MD`
  - **Better Navigation**: Easier to find feature specifications and implementation plans

**Technical Details**

- Created new `prds/` directory for all Product Requirements Documents
- Moved 17 PRD files from root to `prds/` folder:
  - `addresend.md`, `adminalerrtemails.md`, `adminroles.md`, `alerts.md`
  - `clerk-admin-fix.MD`, `clerksubmit.md`, `codeblocksinsubmit.md`
  - `following-plan.MD`, `friendsonlyinbox.md`, `howtojudge.md`
  - `judgingsetup.md`, `mentions.md`, `metadataforsubs.md`
  - `moreimages.md`, `newsubmit.md`, `recentusers.md`, `themss.MD`
- Updated documentation references to point to new `prds/` folder location
- No impact on application functionality or codebase

### Email Testing Improvements 🧪

**Added - Clear Email Logs for Testing**

- **New Feature**: Added ability to clear today's email logs for testing purposes
  - New mutation: `clearTodaysEmailLogs` in `convex/testDailyEmail.ts`
  - Allows clearing all email logs or specific email type logs from today
  - Enables re-testing of daily/weekly emails without waiting for the next day
  - Admin-only access with proper authorization checks
- **UI Enhancement**: Added "Clear Today's Email Logs" button in Email Management dashboard
  - Located in the "Test Emails" section
  - Shows confirmation dialog before clearing logs
  - Displays count of cleared logs on success
  - Orange button design to distinguish from test buttons

**Production vs Development Behavior**

- **Production**: Email system works automatically with no manual intervention
  - Date-based duplicate prevention resets at midnight PST automatically
  - Users receive daily/weekly emails without manual log clearing
  - Cron jobs run on schedule (9 AM, 6 PM PST) without conflicts
  - System self-manages duplicate prevention
- **Development**: Clear logs utility enables multiple tests per day
  - Admins can test emails repeatedly during development
  - Only affects today's logs - historical data preserved
  - Optional email type filtering for targeted testing
  - Helps debug email issues without waiting 24 hours

### Email System Debugging & Fixes ✅ COMPLETED

**Fixed - Weekly Digest & Daily User Engagement Emails**

- **Root Cause Analysis**: Identified why weekly digest and daily user engagement emails weren't sending
  - **Weekly Digest Issue**: Function was returning early if no apps had vibes, sending NO emails to anyone
  - **Daily User Emails Issue**: Lacked visibility into processing status and data generation
  - **Test Functions Issue**: 5-second delay was insufficient for processing completion
- **Comprehensive Logging Added**:
  - Weekly digest now logs: app count, user count, emails sent, emails skipped
  - Daily engagement now logs: engagement summaries found, mentions found, unique users to process, processing progress
  - Processing function now logs: stories found, authors processed, summaries created
  - All email sending functions now report final counts
- **Fixed Weekly Digest Logic**:
  - Removed early return when no apps have vibes - emails now sent regardless
  - Added detailed console logging at every stage
  - Added counters for emails sent vs skipped
  - Better visibility into why emails might be skipped
- **Enhanced Daily User Engagement**:
  - Added comprehensive logging for debugging
  - Better tracking of processing pipeline
  - Clear visibility into data generation
  - Improved skip reason tracking
- **Improved Test Functions**:
  - Increased delay from 5 seconds to 30 seconds for daily user email test
  - Added helpful messages directing admins to check Convex logs
  - Better error handling and user feedback
- **Removed "Online/Active" Restrictions**:
  - Removed all references to not sending emails if user is "currently online/active"
  - Updated PRD documentation (`addresend.md`) to clarify emails are sent regardless of activity status
  - Ensures all eligible users receive their emails without activity-based filtering

**Technical Implementation**

- **Files Modified**:
  - `convex/emails/weekly.ts`: Added logging, removed early return, added counters
  - `convex/emails/daily.ts`: Added comprehensive logging throughout processing and sending
  - `convex/testDailyEmail.ts`: Improved test reliability with longer delays and better messaging
  - `addresend.md`: Removed online/active check references, clarified email sending behavior
- **Logging Strategy**: All email functions now log at key decision points:
  - Data fetching (how many records found)
  - User processing (how many users to email)
  - Skip reasons (why emails were skipped)
  - Final results (emails sent vs skipped)
- **No Linter Errors**: All changes verified with no TypeScript or linting issues

**Testing Instructions**

1. Check Convex logs when cron jobs run or when using admin test buttons
2. Look for log messages like:
   - "Weekly digest: Found X apps with vibes"
   - "Daily user emails: Found X engagement summaries"
   - "Processing engagement for X unique authors"
   - "Created X engagement summaries"
   - "Weekly digest complete: X emails sent, Y skipped"
   - "Daily user emails complete: X emails sent, Y skipped"

### Bulk Selection & Actions for Content Moderation ✅ COMPLETED

**Added - Bulk Operations for Submissions Management**

- **Bulk Selection System**: Admins can now select multiple submissions at once for batch operations
  - **Checkbox Selection**: Each submission has a checkbox for individual selection
  - **Select All/Deselect All**: Quick toggle for all visible submissions on current page
  - **Visual Feedback**: Selected items highlighted with blue background
  - **Selection Counter**: Shows count of currently selected submissions

- **Bulk Actions Bar**: Appears automatically when submissions are selected
  - **Add Tag**: Apply a tag to all selected submissions at once
  - **Remove Tag**: Remove a tag from all selected submissions at once (NEW)
  - **Add to Judging Group**: Add multiple submissions to a judging group in one action
  - **Delete Selected**: Bulk delete with confirmation dialog
  - **Clear Selection**: Quick button to deselect all items

- **Smart State Management**:
  - Selections automatically clear when switching between Submissions and Comments tabs
  - Selections clear after completing bulk actions
  - Cancel buttons to exit action modes without applying changes
  - Success toasts show number of affected items

**Technical Implementation**

- **Backend**: Added `removeTagsFromStory` mutation in `convex/stories.ts` for bulk tag removal
- **Frontend**: Enhanced `ContentModeration.tsx` with:
  - Set-based selection state for efficient tracking
  - Separate action modes (tag, removeTag, judging)
  - Promise.all for parallel bulk operations
  - Toast notifications for user feedback
- **UI/UX**: Maintains all existing individual actions, fully additive feature
- **Performance**: Optimized bulk operations with parallel promise execution

### Email Template Profile Link Fixes ✅ COMPLETED

**Fixed - Email Profile URL Issues**

- **Profile Link Format Fix**: Fixed all email templates to use correct username-based URLs instead of userId-based URLs
  - **Problem**: Email templates were generating links like `/user/ks71bgz29jgvx28xsgjtdhx8b97rgbjj` instead of `/username`
  - **Solution**: Updated all email templates in `convex/emails/templates.ts` to use `/${username}` format
  - **Impact**: All email profile links now work correctly and match the app's URL structure

- **Username Setup Flow Enhancement**: Fixed email fallback logic for new users without usernames
  - **Problem**: New users receive welcome emails before completing username setup, causing broken profile links
  - **Root Cause**: Users created via Clerk don't immediately have usernames set in Convex database
  - **Solution**: Updated email template logic with three-tier fallback system:
    - If user has username: `https://vibeapps.dev/username` (direct to profile)
    - If user exists but no username: `https://vibeapps.dev/set-username` (setup flow)
    - If no user data: Sign-in page with redirect
  - **Welcome Email Enhancement**: Updated welcome email content to guide users through profile setup

- **Mention Email Template Fix**: Fixed missing parameters in mention email template
  - **Added**: `userId` and `userUsername` parameters to mention email template calls
  - **Fixed**: Template parameter validation errors in mention notification system

**Technical Implementation**

- **Files Updated**: `convex/emails/templates.ts`, `convex/emails/mentions.ts`
- **Logic Enhancement**: `userUsername ? /username : userId ? /set-username : /sign-in`
- **Template Consistency**: All email templates now use consistent URL generation logic
- **User Experience**: New users get properly guided through username setup process via email links

### Admin Alert Email System & Inbox Messaging PRDs ✅ COMPLETED

**Added - Comprehensive Admin Alert & Messaging System PRDs**

- **Admin Alert Emails PRD**: Created `adminalerrtemails.md` with complete specification for immediate admin email notifications
  - **Story Report Alerts**: Instant email notifications to all admin/manager users when content is reported
  - **Message Report Integration**: Future-ready system for inbox message report notifications
  - **User Report System**: Extensible framework for user-to-user reporting with admin alerts
  - **Email Templates**: Professional HTML templates with VibeApps branding and actionable admin links
  - **Integration Points**: Seamless integration with existing `convex/reports.ts` and alert system
  - **Rate Limiting**: No rate limits for critical admin notifications to ensure immediate delivery
  - **Resend Integration**: Built on existing email infrastructure with proper logging and tracking

- **Enhanced Inbox Messaging PRD**: Updated `inboxforapp.md` with comprehensive messaging system specification
  - **Text-Only Messages**: Simplified messaging with 2000 character limit (no file attachments)
  - **@Username Mentions**: Full integration with existing mention system and autocomplete
  - **Message Edit/Delete**: Users can edit messages within 24 hours and delete their own messages anytime
  - **Rate Limiting**: Comprehensive spam prevention (10 new conversations per 30 min, 50 messages per hour)
  - **Admin Integration**: Message reporting with immediate admin email notifications
  - **Real-time Notifications**: Integration with existing notification system in header dropdown
  - **Email Notifications**: Separate inbox email system (not part of daily digest emails)

**Technical Implementation**

- **Database Schema**: Complete schema design with rate limiting tables and message edit tracking
- **Backend Functions**: Detailed function specifications with TypeScript validation
- **Frontend Components**: Component architecture using existing UI patterns and MentionTextarea
- **Admin Dashboard**: Message moderation panel integrated with existing admin interface
- **Email System**: Leverages existing Resend infrastructure with new template types

**Documentation Updates**

- **files.MD**: Updated with new PRD files and enhanced feature descriptions
- **Enhanced Descriptions**: Added admin alert email integration and inbox messaging capabilities
- **Implementation Pointers**: Clear guidance for developers on where to implement new features

## Previous Updates

### Mobile UI Improvements ✅ COMPLETED

**Enhanced Mobile Experience**

- **Mobile Project Links & Tags**: Added dedicated mobile section for Project Links & Tags that appears above video demo on mobile devices while preserving desktop sidebar layout
- **Comment Length Adjustment**: Reduced minimum comment character requirement from 50 to 10 characters for better user experience
- **Mobile ProfileHoverCard**: Disabled ProfileHoverCard hover functionality in notifications dropdown on mobile devices to prevent UI conflicts
- **Responsive Design**: Maintained desktop functionality while improving mobile usability across story detail pages

## Previous Updates

### Recent Vibers Sidebar Component ✅ COMPLETED

**Added - User Discovery Feature**

- **Recent Vibers Component**: New sidebar section displaying 25 most recently joined users as circular profile avatars
- **Backend Query**: `getRecentVibers` function in `convex/users.ts` with proper filtering for banned users and username requirements
- **ProfileHoverCard Integration**: Seamless hover functionality showing user details with 500ms delay
- **Grid Layout**: 5x5 responsive grid with loading states and empty state handling
- **User Navigation**: Direct profile linking via username routes
- **Visual Design**: Consistent styling with existing sidebar components, verified badges, and smooth hover transitions
- **Accessibility**: Proper alt text, keyboard navigation, and screen reader support

### Enhanced ProfileHoverCard Support ✅ COMPLETED

**Added - Comment @Mentions Hover Cards**

- **@Mentions Integration**: All @username mentions in comments now display ProfileHoverCard on hover
- **Enhanced Mentions Utility**: Updated `renderTextWithMentions` function in `src/utils/mentions.tsx` to wrap mention links with ProfileHoverCard
- **Consistent UX**: Users can now hover over any @mention in comments to see profile details, bio, social links, and verification status
- **Smart Positioning**: ProfileHoverCard automatically adjusts position to prevent overflow on screen edges

### Resend Email Infrastructure Implementation ✅ COMPLETED

**Added - Production Ready Email System**

- **Complete Email Infrastructure**: Production-ready Resend integration using Convex Resend Component with `testMode: false`
- **Email Templates**: `convex/emails/templates.ts` with admin reports, welcome, engagement, weekly digest, and mention templates
- **Core Email Sending**: `convex/emails/resend.ts` with logging, global kill switch, and proper error handling
- **Daily Processing**: `convex/emails/daily.ts` for metrics calculation and user engagement processing with fixed validators
- **Weekly Digest**: `convex/emails/weekly.ts` for "Most Vibes This Week" computation and sending
- **Welcome Integration**: `convex/emails/welcome.ts` for new user onboarding emails
- **Email Database**: Complete schema with `emailLogs`, `dailyEngagementSummary`, `dailyMetrics`, `emailUnsubscribeTokens`, `broadcastEmails`, `appSettings`
- **Automated Cron Jobs**: Daily admin reports (9 AM PST), engagement processing (5:30 PM PST), user emails (6 PM PST), weekly digest (Monday 9 AM PST)
- **Webhook Handler**: `/resend-webhook` endpoint for email delivery tracking and status updates
- **Email Preferences UI**: Complete user profile integration with unsubscribe/resubscribe modal confirmations
- **Admin Controls**: Global email toggle, broadcast system with user search, and test email functionality
- **Force Logout System**: Admin can force all users to re-login to sync missing email addresses from Clerk
- **Email Testing**: Admin test buttons for daily/weekly emails and individual email sending

**Technical Fixes Applied**

- **Validator Errors**: Fixed `storeDailyMetrics` validator to include `date` field and proper field mapping
- **Resend Configuration**: Disabled test mode (`testMode: false`) to send to real email addresses
- **Function Separation**: Split Node.js actions from V8 queries/mutations across proper files
- **Type Safety**: Fixed all TypeScript errors with proper validators and return types
- **Email Extraction**: Fixed Clerk identity email extraction to prioritize `identity.email` over `identity.emailAddress`
- **User Search**: Fixed broadcast email user search with proper email filtering and debugging tools
- **Template Literal**: Fixed syntax errors in admin UI template literals

**Modified Files**

- `convex/schema.ts`: Added all email-related tables with proper indexes and validators
- `convex/sendEmails.ts`: Enforced subject prefix and from address, disabled test mode
- `convex/settings.ts`: Added public/internal queries for admin controls and global kill switch
- `convex/users.ts`: Integrated welcome email triggers and email sync debugging
- `convex/crons.ts`: Added all email cron jobs with proper scheduling
- `convex/http.ts`: Added Resend webhook handler with proper routing
- `src/pages/UserProfilePage.tsx`: Added email preferences with modern modal UI
- `src/components/admin/EmailManagement.tsx`: Complete admin email management interface
- `addresend.md`: Updated to reflect completed implementation status

### Resend Email PRD Alignment and Mentions Fanout (Docs)

**Added**

- `addresend.md`: Chronological plan, schemas, cron specs for daily admin report, daily user engagement digest, weekly “Most Vibes,” unsubscribe tokens, admin broadcast, global kill-switch
- @Mentions email notifications PRD aligned with `mentions.md` (comments and judging notes), distinct quotas (30/day creation vs 10/day email fanout)
- Alerts cross-reference: admin report notification email type `admin_report_notification` documented

**Modified**

- `README.md`: Email integration section updated to reflect Resend PRD and mentions emails
- `files.MD`: Synced descriptions for `addresend.md`, `alerts.ts`, and `http.ts` unsubscribe endpoint outline

**Notes**

- No runtime code changes in this entry; documentation only to prepare for Resend integration

### Admin Report Notifications System

**Added**

- Admin report notifications: Admin and manager users now receive notifications when users report submissions
- Report notifications appear in both the header dropdown and notifications page for admins/managers
- Email integration specifications added to `addresend.md` for future implementation
- Internal function to get all admin/manager users for notification targeting

**Modified**

- `convex/schema.ts`: Added "report" type to alerts type union
- `convex/alerts.ts`: Added validators and functions for report notifications
- `convex/reports.ts`: Added notification creation when users report submissions
- `src/pages/NotificationsPage.tsx`: Added handling for report notification display
- `src/components/Layout.tsx`: Added report notification text in dropdown
- `addresend.md`: Added admin report notification email specifications

### Enhanced Notification System

**Added**

- Bookmark notifications: Users now receive notifications when someone bookmarks their apps
- Vote notifications: Users receive notifications when someone votes/vibes their apps (already existed, verified working)
- Updated notification text in both the dropdown and notifications page to include bookmark actions

**Modified**

- `convex/schema.ts`: Added "bookmark" type to alerts type union
- `convex/alerts.ts`: Updated validators to include bookmark type
- `convex/bookmarks.ts`: Added notification creation when users bookmark apps
- `src/pages/NotificationsPage.tsx`: Added handling for bookmark notification display
- `src/components/Layout.tsx`: Added bookmark notification text in dropdown

## Previous Updates

### Submit Forms, Public Results, and ConvexBox

**Added**

- Admin submit form tooling:
  - `CreateSubmitFormModal`, `EditSubmitFormModal`
  - `SubmitFormFieldManagement` for per-form fields
- Public-facing submit form renderer: `DynamicSubmitForm`
- Public judging artifacts:
  - `PublicJudgingResultsDashboard`
  - `PublicResultsViewer`
- ConvexBox configuration UI: `ConvexBoxSettingsForm` and `convex/convexBoxConfig.ts`
- Clerk ↔ Convex synchronization: `UserSyncer`
- Backend utilities: `convex/migrations.ts`

**Changed**

- Documentation refresh:
  - README: Added Recent Updates section
  - files.MD: Synced file inventory and new modules
- Standardized terminology in docs: Lightbox, `Vite`, `shadcn/ui`, `Netlify`, Node 18 wording

**Technical**

- No schema changes; added UI and docs, plus non-breaking backend utilities

### Enhanced Tag Management with Search & Numbered Ordering 🏷️

**Added**

- **Tag Search Functionality**: Added search input to quickly find tags in TagManagement
  - **Real-time Filtering**: Type to filter tags by name instantly
  - **Case-insensitive Search**: Works with any capitalization
  - **Maintains All Features**: Search works alongside all existing tag management features

- **Admin/User Tag Tracking**: Enhanced tag system to distinguish between admin and user-created tags
  - **Visual Indicators**: Green "(Admin)" and orange "(User)" labels for easy identification
  - **Smart Sorting**: Admin tags automatically appear first, then user tags
  - **Database Schema**: Added `createdByAdmin` field to track tag origin
  - **Automatic Detection**: Admin-created tags marked as admin, user submissions marked as user

- **Numbered Order System**: Replaced up/down arrow sorting with flexible number-based ordering
  - **0-999 Range**: Enter any number from 0-999 for precise ordering control
  - **Lower First**: Lower numbers appear first in display order
  - **Same Number Grouping**: Tags with same order number appear together
  - **Visual Input**: Clear order input field with validation
  - **Flexible Control**: Much more precise than simple up/down arrows

**Enhanced**

- **Tag Management Interface**: Improved admin tag management experience
  - **Better Layout**: Order input positioned prominently for easy access
  - **Clear Labels**: Visual indicators for admin/user origin and current order
  - **Comprehensive Help**: Updated legend with new ordering and indicator explanations
  - **Maintained Functionality**: All existing features (colors, icons, visibility) preserved

**Technical**

- Added `createdByAdmin` boolean field to tags schema
- Updated all tag mutations to handle admin/user tracking
- Enhanced `listAllAdmin` query with improved sorting logic
- Modified tag creation in user submissions to mark as user-created
- Added order validation (0-999) with input sanitization
- Updated TypeScript interfaces to include new field

## Previous Updates

### Enhanced Tag Selection with Search Dropdown 🔍

**Added**

- **All Tags Dropdown Search**: Added new search dropdown on `StoryForm.tsx` that includes ALL available tags (including hidden ones)
  - **Search Functionality**: Type to search and filter through all tags in the system
  - **Visual Tag Display**: Shows tag colors, emojis, and icons in both visible tags and dropdown
  - **Hidden Tag Access**: Users can now select tags that admins have hidden from the header display
  - **Smart Filtering**: Excludes already selected tags and new tags being created from search results
  - **Click Outside to Close**: Dropdown closes when clicking outside for better UX
  - **Performance Optimized**: Limited to 10 search results to maintain performance
  - **Consistent Styling**: Matches existing UI design patterns and color scheme

- **Selected Tags Display**: Added comprehensive tag selection management
  - **Visual Feedback**: Selected tags now appear in a dedicated "Selected Tags" section
  - **Tag Counter**: Shows current selection count with 10-tag maximum (e.g., "Selected Tags (3/10)")
  - **Remove Functionality**: Click X button on any selected tag to remove it
  - **Hidden Tag Indicators**: Shows "(Hidden)" label for tags not visible in header
  - **New Tag Indicators**: Shows "(New)" label for tags being created

- **10-Tag Selection Limit**: Implemented comprehensive tag limit enforcement
  - **Smart Validation**: Prevents selection beyond 10 total tags across all methods
  - **User Feedback**: Clear error messages when limit is reached
  - **UI Disabling**: Input fields and buttons disabled when at maximum
  - **Dynamic Placeholders**: Helpful placeholder text when limit reached

**Technical**

- Added new Convex query `listAllForDropdown` to fetch all tags including hidden ones
- Enhanced tag button styling to show custom colors, emojis, and icons when selected
- Added React state management for dropdown search and visibility
- Implemented click-outside handler to close dropdown automatically
- Added comprehensive tag limit validation across all selection methods
- Created unified selected tags display component with remove functionality

## Previous Updates

### Enhanced Admin Content Moderation Editing 🛠️

**Added**

- **Comprehensive Inline Editing**: Admins can now edit all submission data directly in Content Moderation without navigating away
  - **All Story Fields**: Title, URL, description, long description, submitter name, video URL, email
  - **Social Links**: LinkedIn, Twitter/X, GitHub, Chef Show URL, Chef App URL
  - **Tag Management**: Visual tag selector with ability to add new tags on the fly
  - **Screenshot Upload**: Full file upload functionality with preview, replace, and remove options
  - **Form Validation**: Required field validation with user-friendly error messages
  - **Organized Layout**: Grouped fields into logical sections (Basic Info, Social Links, Tags, Screenshot)
  - **Background Color**: Uses site standard `#F2F4F7` background for consistency

**Technical Implementation**

- Enhanced `src/components/admin/ContentModeration.tsx` with comprehensive edit form
- Added state management for tags, file uploads, and form data
- Integrated with existing `updateStoryAdmin` mutation and `generateUploadUrl` for file handling
- Added helper functions for tag management and file preview
- Maintained all existing moderation workflow functionality
- Removed admin edit functionality from `StoryDetail.tsx` component for cleaner separation of concerns

**User Experience Improvements**

- **Context Preservation**: Admins stay in moderation workflow without losing their place
- **Visual Feedback**: Real-time preview for screenshot uploads and tag selections
- **Error Handling**: Clear validation messages and upload status indicators
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### YC AI Hackathon Form 🚀

**Added**

- **New YC AI Hackathon Submission Form**: Created dedicated form at `/ychack` route for YC AI Hackathon submissions
  - Based on ResendForm component with updated branding and messaging
  - Removed "closed form" message and enabled active submissions
  - Updated all text references from "Resend" to "YC AI Hackathon"
  - Changed placeholder text to focus on AI usage instead of Resend integration
  - Auto-adds `ychackathon` tracking tag to submissions
  - Maintains all existing functionality (file uploads, dynamic fields, tag selection)
  - **Hidden Sidebar**: Removed WeeklyLeaderboard and TopCategoriesOfWeek sidebar components from YC Hackathon form page for focused submission experience

**Technical Details**

- Created `src/components/YCHackForm.tsx` component (TypeScript React file)
- Added `/ychack` route to `src/App.tsx` routing configuration
- Updated form submission to use `ychackathon` tracking tag
- Fixed TypeScript linter errors and maintained type safety
- Preserved all existing form validation and submission logic

### GitHub Repository Field Made Optional 🔧

**Changed**

- **GitHub Repository Field**: Removed mandatory requirement for GitHub repository URL in both YCHackForm and StoryForm
  - Updated backend `storyFormFields` to ensure GitHub field is set to `isRequired: false`
  - Added `ensureGitHubFieldOptional` mutation to prevent future issues
  - All dynamic form fields (LinkedIn, Twitter, GitHub, Chef links) are now properly optional
  - Forms now respect the backend `isRequired` setting for all dynamic fields

**Technical Details**

- Added `ensureGitHubFieldOptional` internal mutation in `convex/storyFormFields.ts`
- Verified all form components use `required={field.isRequired}` from backend configuration
- Confirmed GitHub field and all other dynamic fields are set to optional in database
- **Frontend Override**: Added explicit `required={field.key === "githubUrl" ? false : field.isRequired}` in both YCHackForm and StoryForm to ensure GitHub field is never required regardless of backend configuration
- Removed unused `Github` import from YCHackForm component

### Admin Tag Management for Content Moderation 🏷️

**Added**

- **Tag Management in Content Moderation**: Admins can now add existing tags to submissions directly from the Content Moderation interface
  - Added "Add Tag" button for each submission in the moderation view
  - Interactive tag selector showing available tags with emoji/icon support
  - Prevents duplicate tags by filtering out already assigned tags
  - Real-time UI updates after adding tags
  - Follows existing admin authentication patterns

**Technical Details**

- Added `addTagsToStory` mutation in `convex/stories.ts` with admin role validation
- Updated `ContentModeration.tsx` to include tag management UI and functionality
- Uses existing `api.tags.listAllAdmin` query for fetching available tags
- Maintains existing design patterns and responsive layout

### Navigation Submit Button Authentication 🚀

**Changed**

- **Header Submit Button**: Updated navigation submit button to show popup authentication dialog for logged-out users
  - Signed-in users: Button navigates directly to `/submit` page
  - Signed-out users: Button shows AuthRequiredDialog popup with sign-in prompt
  - Maintains consistent design and user experience across the app
  - Keeps `/resend` anonymous submission route unaffected

**Technical Details**

- Replaced `Link` component with `button` element with conditional logic
- Added `AuthRequiredDialog` component to Layout for authentication prompts
- Updated submit button behavior to check `isSignedIn` status before navigation
- Non-intrusive popup allows users to continue browsing without forced redirects

### Enhanced Submission Forms & User Identity 👤

**Form Improvements**

- **Updated Tagline Field**: Changed "App Project Tagline or Description" to "App/Project Tagline" (kept required)
- **New Description Field**: Added optional long-form description text area with structured placeholder:
  - What it does
  - Key Features
  - How you built it
  - How are you using Resend
- **New "Your Name" Field**: Added required name field above email in both StoryForm and ResendForm
  - Required for all submissions (authenticated and anonymous)
  - Improves user attribution and communication

**Display & Admin Improvements**

- **Better Author Attribution**: Stories now show submitter's name from "Your Name" field instead of "Anonymous User"
  - Authenticated users: Shows form name + links to profile
  - Anonymous users: Shows form name only
- **Enhanced Admin Panel**: ContentModeration now displays submitter name alongside email instead of "Unknown"
  - Shows both logged-in user data AND form input name for better identification

**Backend Changes**

- **Schema Updates**: Added `longDescription` and `submitterName` fields to stories table
- **Mutation Updates**: Both `submit` and `submitAnonymous` now handle the new fields
- **Type Safety**: Updated all validators and type definitions for new fields

### Anonymous Submission System 📝

**Added**

- **New Anonymous Submission Route**: `/resend` allows users to submit apps without creating an account
  - Dedicated ResendForm component for anonymous submissions
  - Email required for communication purposes
  - Same functionality as authenticated submissions (tags, screenshots, social links)
  - Submissions appear in main app feed and admin panel like regular submissions

**Backend Changes**

- **New `submitAnonymous` Mutation**: Handles submissions without authentication requirements
  - Rate limiting by email (10 submissions per day per email)
  - Auto-approval for anonymous submissions
  - Proper logging for anonymous submissions
- **Schema Update**: Made `userId` optional in stories table to support anonymous submissions
- **TypeScript Fixes**: Resolved type compatibility issues for optional userId in validators and queries

### Authentication UX Improvements 🔐

**Added**

- **New AuthRequiredDialog Component**: Beautiful popup modal for authentication prompts
  - Matches app's design system with consistent styling
  - Provides clear call-to-action for sign-in with Clerk modal integration
  - Includes "Maybe Later" option for non-intrusive UX

**Changed**

- **Submit Page Access**: Removed login requirement to access `/submit` page
  - All users can now view the submit form and see what's required
  - Authentication check happens at form submission instead of route protection
  - Shows popup dialog if user attempts to submit without signing in

- **User Action Authentication**: Replaced redirects with popup notifications
  - **Voting/Upvoting**: Now shows popup instead of redirecting to sign-in page
  - **Rating**: Shows popup dialog instead of redirect
  - **Commenting**: Shows popup dialog instead of redirect (in StoryDetail)
  - **Bookmarking**: Updated to use popup instead of alert messages

**Improved**

- **Better User Experience**: Users can explore the submit form before deciding to sign in
- **Consistent Authentication Flow**: All user actions now use the same popup pattern
- **Non-intrusive Prompts**: Users aren't forced to sign in immediately, can continue browsing

**Technical Details**

- Created `AuthRequiredDialog` component using Radix UI Dialog
- Updated authentication handling in `StoryDetail.tsx`, `StoryList.tsx`, and `StoryForm.tsx`
- Removed `ProtectedLayout` wrapper from `/submit` route in `App.tsx`
- Updated navigation submit button to show as link for all users
- Maintained all existing authentication requirements for backend mutations

### Email Field for Story Submissions ✨

- **Story Form**: Added optional email input field with description "Hidden and for hackathon notifications"
- **Database**: Added email field to stories table schema to store submission emails
- **Admin Panel**: Updated ContentModeration component to display submitter email addresses and author information
- **Backend**: Enhanced story submission mutation to handle email field storage
- **Type Safety**: Updated all validators and TypeScript types to include email field support

### Content Moderation Improvements 🔧

- **Author Display**: Fixed ContentModeration to properly show author names and usernames for both stories and comments
- **Comment Enhancement**: Updated comment admin queries to include author information (name and username)
- **Better Organization**: Improved display formatting to show submitter details before timestamps
- **Type Safety**: Fixed TypeScript issues with proper type assertions for author data

## Previous Updates

## [YYYY-MM-DD] - Update TopCategoriesOfWeek Navigation

- **Fixed**: Clicking tags in "Top Categories This Week" no longer leads to a 404 page.
- **Updated**: `TopCategoriesOfWeek.tsx` now uses a button-based interaction model similar to the header tags. Clicking a category updates a shared `selectedTagId` state and navigates to the home page to display filtered content.
- **Changed**: `TopCategoriesOfWeek.tsx` now requires `selectedTagId` and `setSelectedTagId` props to be passed from its parent component to manage the shared selection state.

## [Unreleased]

### Planned

- Clerk roles for hackathon organizers to access judges section only in admin
- Alerts when an admin pins or posts a message to their own app
- Fix links used in weekly digest emails
- Inbox feature with email notifications
- Post notification emails via Resend (update `convex/emails/templates.ts`)
- User toggle to turn off email notifications in profile

### Added

- **Follow/Following Feature**: Implemented a comprehensive follow and following system.
  - **Backend**:
    - Added `follows` table to `convex/schema.ts`.
    - Created `convex/follows.ts` with mutations (`followUser`, `unfollowUser`) and queries (`getFollowers`, `getFollowing`, `getFollowStats`, `isFollowing`).
    - Updated `convex/users.ts` to include follower/following counts and status in user profiles.
    - Created `convex/adminFollowsQueries.ts` with queries for admin dashboard statistics (`getTopUsersByFollowers`, `getTopUsersByFollowing`, `getTotalFollowRelationships`).
  - **Frontend**:
- Updated `src/pages/UserProfilePage.tsx` to display follow/unfollow buttons, follower/following counts, and new tabs for follower/following lists.
- Updated `src/components/admin/NumbersView.tsx` to display top followers/following users and total follow relationships.
- Updated `files.md` with comprehensive descriptions for all files and directories, aligning with `README.md` features.
- Initial project setup.
- Detailed file documentation in `files.md` for all components, including admin dashboard and utility files.
- Expanded admin dashboard components: `AdminDashboard.tsx`, `ContentModeration.tsx`, `FormBuilder.tsx`, `FormResults.tsx`, `Forms.tsx`, `Settings.tsx`, `TagManagement.tsx`.
- Improved descriptions for all frontend and backend files.
- Created a new blank page at `/navtest` for testing navigation components. This page includes the standard header and footer with an empty main content area.
- Created a 404 Not Found page (`src/pages/NotFoundPage.tsx`) with a design inspired by the provided example, featuring a search bar and a link to the homepage.
- Updated application routing in `src/App.tsx` to display the new 404 page for any undefined routes.
- ConvexBox logo now links to the specified URL if provided.
- Created `public/robots.txt` to guide search engine crawlers.
- Created `public/sitemap.xml` to help search engines understand site structure.

### Changed

## [2024-12-XX] - User Moderation Enhancements

### Changed

- **User Moderation Dashboard**: Updated `src/components/admin/UserModeration.tsx` to display the 20 most recent users by default (increased from 15).
- **Search Functionality**: Implemented backend search across all users in `convex/users.ts` - the `listAllUsersAdmin` function now supports searching through all users by name, email, or username instead of only client-side filtering on loaded results.
- **User Profile Navigation**: Added clickable user names in the User Moderation table that navigate to user profiles.

### Technical Details

- Updated `listAllUsersAdmin` query in `convex/users.ts` to handle search queries by collecting all users and filtering server-side when a search term is provided.
- Removed client-side filtering in favor of backend search to enable searching across all users.
- Added React Router navigation support to user moderation component.
- Enhanced user experience with hover effects on clickable user names.
- Fixed user profile navigation to use username-based URLs (`/{username}`) instead of ID-based URLs (`/profile/{id}`) to match the routing system.
- Added visual feedback for users without usernames (grayed out, non-clickable).

## [Unreleased] - YYYY-MM-DD
