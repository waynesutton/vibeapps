# VibeApps Codebase Files

## Root Directory Structure

### Configuration Files

- `package.json`: Project dependencies and scripts configuration
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript configuration files
- `vite.config.ts`: `Vite` build tool configuration
- `tailwind.config.js`: Tailwind CSS styling configuration
- `postcss.config.js`: PostCSS configuration for CSS processing
- `eslint.config.js`: ESLint code quality and style configuration (flat config; includes `@convex-dev/eslint-plugin` recommended rules for Convex best practices)
- `components.json`: `shadcn/ui` components configuration
- `bun.lockb`: Bun package manager lock file

### Documentation Files

- `README.md`: Main project documentation and setup guide
- `changelog.MD`: Developer-friendly change log of new features
- `files.MD`: This file - comprehensive codebase documentation
- `TASK.MD`: Project task and feature requirements
- `AGENTS.md`: Project context and conventions for coding agents
- `CLAUDE.md`: Project context for Claude-based agents
- `skills-lock.json`: Manifest of installed agent skills and their versions
- `llms.txt`: Pointer to the live auto-updating `/llms.txt` on vibeapps.dev (generated from public submissions)
- `robots.txt`: Search and AI crawler allow list; live copy is served from Convex


### Agent Skills (.agents/, .claude/)

- `.agents/skills/`: Shared agent skills (Convex quickstart, auth setup, component creation, migration helper, performance audit, plus design and workflow skills) for consistent agent behavior
- `.agents/skills/convex-write-conflicts/SKILL.md`: How to diagnose and permanently fix Convex OCC "Retried due to write conflicts" errors (staleness-threshold gate for heartbeat/last-active writes, indexed reads, client jitter); references the `judges.updateActivity` fix as the canonical example
- `.claude/skills/`: Claude-specific copies of the same Convex and tooling skills

### Product Requirements Documents (prds/)

All PRD files are now organized in the `prds/` folder for better project structure:

- `prds/security-review-2026-08-13.md`: Full-app `/sec-check` security review across all 341 public Convex functions (auth enforcement, data exposure, integrations) with 22 ungated findings, a verified-OK list, dependency audit results, and a prioritized remediation plan
- `prds/per-submission-llms-and-md.md`: Per-app `/s/{slug}/llms.txt` and `/s/{slug}.md` files, story sidebar links, and listings in the site-wide directory files
- `prds/judging-group-editable-slug.md`: Editable judging group URL slug after create, warning dialog, judging.slug access permission, uniqueness, and public URL follow-through
- `prds/public-directory-llms-and-aeo.md`: Live llms.txt and vibeapps.md directory files plus additive AEO/SEO/GEO work that keeps existing Open Graph tags
- `prds/ai-judge-frontend-checker-hosting-weights.md`: AI judge frontend checker rubric preset with per-platform hosting sub-weights (Codex Sites, Convex static hosting, Vercel, Netlify, Other) and deterministic hosting detection
- `prds/fix-github-issues-15-and-11.md`: Fixes for GitHub issues 15 (public profile query leaked moderation data and showed rejected stories) and 11 (removing a last name reverted on refresh due to Clerk name sync)
- `prds/submit-page-sidebar-setting.md`: Admin setting to hide the /submit right sidebar and widen the form for all users
- `prds/web-interface-guidelines-audit.md`: Web Interface Guidelines UI audit with file:line findings across all src/ files and a prioritized fix order
- `prds/resend-email-audit.md`: Full Resend email system audit PRD (toggle enforcement map, bugs found and fixed, prod enablement checklist)
- `prds/mentions.md`: @Mentions system PRD and implementation documentation
- `prds/addresend.md`: Resend email integration PRD and requirements (daily admin/user digests, weekly digest, @mentions emails, unsubscribe, admin broadcast, alerts cross-ref)
- `prds/adminalerrtemails.md`: Admin alert email system PRD for immediate report notifications and moderation alerts
- `prds/metadataforsubs.md`: Server-side metadata generation PRD for social sharing
- `prds/friendsonlyinbox.md`: Inbox messaging system PRD with text-only messages, @mentions, rate limiting, edit/delete, and admin integration
- `prds/following-plan.MD`: User following system implementation plan
- `prds/judgingsetup.md`: Judging system setup and configuration guide
- `prds/multi-judge-submissions.md`: Multi-judge submissions feature (configurable N judges per submission, OCC-safe completion, per-judge score breakdown)
- `prds/clerk-admin-fix.MD`: Clerk authentication admin setup documentation
- `prds/clerksubmit.md`: Clerk submission integration documentation
- `prds/themss.MD`: Theme and styling documentation
- `prds/theme-system-and-view-refresh.md`: Three-theme token system (light/classic/dark), header theme switcher, and list/vibe view redesign PRD
- `.interface-design/system.md`: Saved design system reference: theme tokens, palette table, depth strategy, and component patterns for future design sessions
- `prds/adminroles.md`: Admin roles and permissions documentation
- `prds/alerts.md`: Notification system documentation
- `prds/codeblocksinsubmit.md`: Code block support in submissions
- `prds/howtojudge.md`: Judging system user guide
- `prds/moreimages.md`: Multi-image gallery implementation
- `prds/newsubmit.md`: Enhanced submission form documentation
- `prds/recentusers.md`: Recent users sidebar feature
- `prds/TESTING_SUMMARY.md`: Comprehensive email testing system documentation and guide
- `prds/EMAIL_DATE_RANGE_FIX.md`: Detailed explanation of date range bug fix and email testing improvements
- `prds/admin-access-permissions.md`: Delegated admin permissions PRD (adminPermissions table, permission keys, group-scoped judging access, Access tab UI)
- `prds/admin-judging-ui-redesign.md`: Judging tab redesign PRD (compact group list, full-page docs-style workspace at /admin/judging/:slug with sidebar sections)
- `prds/tag-limits-and-bulk-cleanup.md`: Tag limits (max per submission, max name length) and bulk archive/delete PRD
- `prds/submission-page-single-column.md`: Single-column layout option for judging group custom submission pages PRD
- `prds/submit-page-enable-404-and-header-save.md`: Custom submission page enable 404 fix and header save button PRD, plus the null-into-patch updateGroup fix
- `prds/judging-groups-ai-prompt-criteria-links-api-toggle.md`: AI judge upgrades PRD (custom criteria, editable system prompt, rubric toggles, links ledger, agent API toggle)
- `prds/judging-score-scale-and-criteria-header.md`: Per-group scoring scale (1-5 or 1-10) and criteria section header cleanup PRD
- `prds/judging-group-manual-add-submissions.md`: Search-and-add submissions inside the judging group workspace PRD
- `prds/judging-group-ai-judge-links-visibility.md`: AI judge links discoverability PRD (partially superseded by the components check and links hide PRD)
- `prds/ai-judge-components-check-persistence-and-links-hide.md`: Components check re-add fix and hiding AI judge links while the AI judge is disabled PRD
- `prds/judging-group-custom-submit-form-fields.md`: Per-group customizable submission form PRD (field visibility, required toggles, custom questions, customFormAnswers on stories)
- `prds/judging-group-activity-log.md`: Judging group activity log PRD (per-group audit trail on the shared activityLog table, AI result cleanup on submission removal for realtime counts, exports, clear, access scoping)
- `prds/judging-group-emails.md`: Judging group emails PRD (reusable templates with variables, markdown-lite rendering, judge recipient selection, judging.emails permission, judging_group email type toggle)

## Backend (Convex Directory)

### Core Backend Files

- `convex/_generated/`: Auto-generated Convex files (API definitions, data model types)
  - `api.d.ts` & `api.js`: Generated API definitions for all functions
  - `dataModel.d.ts`: Generated TypeScript types for database schema
  - `server.d.ts` & `server.js`: Generated server-side definitions
- `convex/schema.ts`: Database schema definition with all tables and indexes (includes `submissionJudgeCompletions` table for multi-judge OCC-safe completion tracking, `aiJudgeResults` table for AI Judge scores, reasoning, run status, and detected `frontendHosting` per group+story, `aiFrontendWeights` per-platform frontend checker weights on `judgingGroups`, `videoTranscripts` table for scraped video demo transcripts used by the AI judge, `stories.hackathonLog` for pasted hackathon.md content (capped and secret-redacted), `aiJudgeResults.logDiscrepancies` cross-check notes and `hackathonLogEvent` parsed from the repo or pasted hackathon.md header, and deprecated hackathon skill API fields on `judgingGroups` plus the deprecated `hackathonRegistrations` table kept only so existing rows stay valid)
- `convex/auth.config.js` & `convex/auth.ts`: Convex authentication configuration
- `convex/tsconfig.json`: TypeScript configuration for Convex functions
- `convex/README.md`: Convex-specific documentation
- `convex/migrations.ts`: Data/backfill helpers and migration utilities

### Authentication & User Management

- `convex/clerk.ts`: Clerk authentication integration with Convex
- `convex/users.ts`: User management functions (queries, mutations, admin functions, mention search, recent vibers discovery, emoji theme preferences)
- `convex/mentions.ts`: @Mentions system core utilities (extract, resolve, record, quota enforcement)
- `convex/dm.ts`: Direct messaging system with conversations, messages, @mentions, edit/delete, rate limiting, and admin reporting integration
- `convex/dmReactions.ts`: Direct message emoji reactions system with predefined emojis and user reaction management

### Core App Features

- `convex/stories.ts`: App submission functions (create, update, approve, search) with multi-image support, a per-group duplicate project URL guard on judging group submissions, pasted `hackathonLog` handling (20k cap, secret redaction), generic admin-added form field persistence via `dynamicFieldValues`, and public list/detail queries that strip submitter email, team emails, and moderation fields
- `convex/comments.ts`: Comment system queries and mutations with @mentions integration and validation; `listPendingByStory` requires `moderation.view`
- `convex/votes.ts`: Voting system for app submissions
- `convex/bookmarks.ts`: User bookmarking system functions with improved interface and notification creation
- `convex/storyRatings.ts`: 1-5 star rating system for apps
- `convex/follows.ts`: User following system functions; public follower/following lists return name, username, and avatar only
- `convex/tags.ts`: Tag management and categorization system with enhanced dropdown search support, including per-view visibility flags (header, app detail page, app lists, archive), bulk archive/unarchive and bulk delete mutations, and configurable tag limits (max tags per submission, max tag name length) stored on settings
- `convex/reports.ts`: User reporting system for content moderation with admin notification creation and immediate email alerts
- `convex/alerts.ts`: Comprehensive notification system for votes, comments, ratings, follows, bookmarks, admin reports, and future message notifications
  - Includes helper `getAdminUserIds` and `createReportNotifications` for admin/manager report alerts with email integration

### Admin & Moderation

- `convex/adminAccess.ts`: Delegated admin permissions module: permission keys (including `judging.slug` for changing a group's URL slug), `getAccessContext`/`hasPermission`/`requirePermission`/`requireJudgingGroupPermission`/`getAllowedJudgingGroupIds` helpers, the `getMyAdminAccess` frontend gate query, and full-admin-only grant/revoke/list/search CRUD backed by the `adminPermissions` table; grant and revoke actions write to the activity log
- `convex/activityLog.ts`: Admin activity log backend: `logActivity` helper (pause-aware, actor resolution from auth or explicit override, never throws) called from email, submission, spam, judging, scoring, access, and settings mutations, plus `listActivity` paginated query with category/archived/sort filters, `getStatus`/`setPaused` pause switch (appSettings key `activityLogPaused`), `bulkArchive`/`bulkUnarchive`/`bulkDelete`, batched `clearLog`, `exportActivity` for CSV export (activity.view / activity.manage permissions), and the per-judging-group log: entries carry an optional `groupId` (by_groupId index) with `listGroupActivity` (paginated, judging.view group scoped), `exportGroupActivity`, and batched `clearGroupActivity` (judging.manage)
- `convex/adminQueries.ts`: General admin dashboard queries for metrics and content
- `convex/adminFollowsQueries.ts`: Admin Numbers follow rankings gated by numbers.view, returning name/username/counts only
- `convex/reports.ts`: User reporting system for content moderation
- `convex/settings.ts`: Site-wide settings and configuration management

### Custom Forms System

- `convex/forms.ts`: Dynamic form builder backend functions
- `convex/storyFormFields.ts`: Configurable form fields for story submissions (text/email/url/textarea/radio/multiselect types with an `options` array for choice fields, includes the built-in disabled-by-default `hackathonLog` textarea field for pasting hackathon.md, seeded by `ensureHackathonLogField`); exports the shared dynamic field resolver (`resolveDynamicFieldValues`/`resolveDynamicFieldRecord`) that maps admin-added field values to a stories column or `dynamicFormValues` and sanitizes choice answers against the configured options (multiselect stored comma-joined)
- `convex/submitForms.ts`: Submit form management system for specialized forms (hackathons, etc.); public form queries auto-include enabled Manage Form Fields entries added after form creation, and `submitFormData` routes admin-added field values through the shared resolver (column or `dynamicFormValues`) with `hackathonLog` sanitized

### Comprehensive Judging System

- `convex/judgingGroups.ts`: Judging group management with public/private access, SHA-256 password hashing (legacy btoa hashes still verify), configurable `judgesPerSubmission` for multi-judge mode, `updateGroupSlug` (judging.slug, unique sanitized slug, activity log), required-tag backfill in `updateGroup` (stories carrying a newly set required tag are auto-included for judging), auto-include backfill by multiple tags + submission date range (`autoIncludeTagIds`/`autoIncludeMatchMode` any|all/`autoIncludeStartDate`/`autoIncludeEndDate`, also returned from `getGroupWithDetails` along with `aiFrontendWeights`), and AI Judge settings (`aiJudgeEnabled`/`aiResultsIsPublic`/`aiResultsPassword` on create/update, `aiJudgeResults` cascade delete in `deleteGroup`, exported `hashPassword`/`verifyPassword` helpers)
- `convex/judgingCriteria.ts`: Judging criteria and scoring questions management with 1-10 star ratings
- `convex/judgingGroupSubmissions.ts`: Submission assignment within judging groups with @mentions in notes, search functionality, status tracking, `markJudgeCompleted` mutation for multi-judge OCC-safe completion, required-tag inclusion (`ensureStoryInGroup`/`syncStoryToTaggedGroups` helpers + `syncRequiredTagSubmissions` admin mutation) so any story carrying a group's required tag is judged and counted, multi-tag + date-range auto-include (`storyMatchesAutoInclude` helper supporting any/all match modes, `syncStoryToTaggedGroups` honors auto-include criteria, `syncAutoIncludeSubmissions` admin mutation), and `exportGroupSubmissions` admin query that returns flattened submission rows (custom form info, links, tags, hackathon team info; no images) for CSV download; `getGroupSubmissions` requires a judge `sessionId` and returns `customFormAnswers` and `dynamicFormValues` so judges see per-group answers and admin-added field values; its "judged" author notification is only triggered by human judging and never by the AI Judge flow
- `convex/judges.ts`: Judge registration (group password re-checked server-side), session ids from crypto.getRandomValues, and group-wide progress tracking with canEdit/completedBy flags for multi-judge transparency and edit permission enforcement
- `convex/judgeScores.ts`: Score submission, calculation, results with CSV export, weighted scoring, and `getSubmissionJudgeBreakdown` query for per-judge score breakdown with after-self reveal rule
- `convex/adminJudgeTracking.ts`: Admin utilities for judge monitoring, submission status management, and comprehensive CSV export of judge activity including individual scores, total scores per submission, submissions, criteria, and comments
- `convex/aiJudge.ts`: AI Judge (Best Use of Convex) backend: built-in rubric (five Convex criteria plus a low-weight "Live app status" liveness criterion) extendable per group with custom criteria and per-criterion on/off toggles via `getRubricForGroup` (filters `aiDisabledCriteria`, never returns an empty rubric), `updateAiCustomCriteria` (up to 10 admin-defined criteria with key/label/description validation and stale weight/disabled-flag pruning), `updateAiSystemPrompt`/`getAiPromptConfig` for the editable system prompt with `DEFAULT_AI_JUDGE_PROMPT_BODY` and reset-to-default, `updateAiRubricWeights` accepting weights plus disabled keys (at least one criterion must stay enabled) and per-platform `frontendWeights` for the frontend checker (fixed keys `codex-sites`/`convex-hosting`/`vercel`/`netlify`/`other`, default 1, all-default clears storage; the detected platform's weight multiplies the `frontend-checker` criterion weight in `computeWeightedScore` at read time), `startReview`/`retrySubmission` admin mutations that queue submissions and schedule sequential analysis, `updateResultScore` for admin edits with recomputed totals, `getGroupAiResults` admin query with progress counts (admin rows also carry `logDiscrepancies` and the `event` parsed from a pasted hackathon.md header; both admin-only), `getGroupAiReportData` admin-only query for the hackathon report (submissions with team names/members and AI results; team emails never exposed publicly), and public results queries with the same password/public/admin-bypass gate pattern as human results (`getPublicAiResultsInfo`, `validateAiResultsPassword`, `verifyAiResultsPassword`, `getPublicAiResults`, `getValidatedAiResults`); never touches `submissionStatuses`, `judgeScores`, or alerts
- `convex/aiJudgeAnalysis.ts`: `analyzeSubmission` internal action for the AI Judge: fetches GitHub repo context (metadata, file tree, `convex/` files, README, root hackathon log files like hackathon.md/changelog.md/task.md/files.md capped at 5k chars each, and `.agents/skills/` skill paths via optional `GITHUB_TOKEN`), fetches an optional `/hackathon.json` manifest from the live app origin for self-reported context, scrapes the live URL with Firecrawl (optional `FIRECRAWL_API_KEY`), runs a deterministic liveness check of the live app URL (GET with 15s timeout; result stored as `urlCheck` and the liveness score is server-side capped at 2 when the URL is dead/404), detects the frontend hosting platform deterministically via `detectFrontendHosting` (URL host suffixes, `x-vercel-id`/`x-nf-request-id`/`server` response headers, and repo signals like `.openai/hosting.json`, `@convex-dev/self-static-hosting`, `vercel.json`, `netlify.toml`; stored as `frontendHosting` with evidence, surfaced to the model as a FRONTEND HOSTING CHECK section, and the frontend-checker score is capped at 3 when the live URL is dead), detects Convex components deterministically from the repo's `package.json` (`@convex-dev/*` deps) and `convex.config.ts` imports (stored as `componentsDetected` and rewarded with higher advanced scores in the prompt), builds the system prompt from the group's custom prompt (with `{{rubric}}` substitution) or the default, always appends the JSON response contract, fetches the submission's video demo transcript via `fetchVideoContext` (included in the prompt as an unverified builder narrative section that never overrides verified facts and never penalizes a missing video), prompts an LLM with the group's effective rubric (built-in plus custom criteria) using provider fallback Anthropic → OpenAI → OpenRouter, parses structured JSON scores/reasoning against that rubric, and saves results (including `sourcesUsed.videoTranscript`) or per-submission failures for retry; supports the single-file hackathon skill by injecting a pasted `stories.hackathonLog` into the PROJECT LOG FILES prompt section when the repo returned no hackathon.md (the repo copy always wins), and computes never-scored `logDiscrepancies` by comparing the parsed hackathon.md header against detected facts (frontend platform vs `detectFrontendHosting`, claimed components vs `convex.config.ts` scan, claimed auth vs `package.json` dependencies)
- `convex/spamCheck.ts`: AI spam check backend: `listSpamResults` admin query (story-enriched scan rows with server-side verdict filter, date range, sort, and live counts), `startBatchScan` (queues up to 100 submissions into the dedicated `spamWorkpool`, skip-or-rescan aware, optional date range via the built-in `by_creation_time` index), `scanStory` single re-scan, `listMarkedSpam` (every story with isSpam true straight from the stories `by_isSpam` index for the marked-spam review section, enriched with author, marking admin or agent, and reason, with an optional marked-date range), `markAsSpam`/`unmarkSpam` (hide + label + in-app alert + reason email, fully reversible), `bulkMarkAsSpam`/`bulkHide`/`bulkDelete` (delete cascades comments, votes, ratings, bookmarks, scan rows, and stored images), the admin-editable AI system prompt (`DEFAULT_SPAM_SYSTEM_PROMPT`, `getSpamPrompt`/`setSpamPrompt` with reset-to-default, `getSpamPromptInternal` stored under appSettings key `spamCheckSystemPrompt`), and internal plumbing (`autoScanStory` scheduled from submit mutations and gated by the auto-scan toggle, `markRunning`, `getStoryForAnalysis` with duplicate-URL count, `saveResult` which also runs the agent auto-mark when enabled), plus spam automation settings (`getSpamAutomation`/`setSpamAutomation`: auto-scan toggle, agent auto-mark with confidence threshold, notify-on-auto-mark, all stored in appSettings and enforced server side with activity logging) and the submitter dispute loop (`requestSpamReview` owner mutation stamping `spamReviewRequestedAt` and logging `spam.reviewRequested`, `getMySpamStatus` owner-scoped status query for the notifications button, `dismissSpamReviewRequest` admin mutation that clears a request while keeping the mark)
- `convex/spamCheckAnalysis.ts`: `analyzeSubmission` internal action for spam scans: deterministic checks in parallel (live URL GET with timeout, GitHub repo reachability and file count with empty-repo detection via optional `GITHUB_TOKEN`, video/LinkedIn/X link liveness), Firecrawl component scrape of the app URL, then an AI verdict (spam/suspicious/clean with confidence and reasons) using the Anthropic → OpenAI → OpenRouter fallback chain, or a deterministic heuristic when no AI key is configured; failures are recorded on the result row and never thrown upstream
- `convex/agentJudges.ts`: Agent judging API key backend: `storeAgentKey` (SHA-256 hashed keys, blocked when the group's agent API is disabled), `revokeAgentKey`, `listAgentKeys`, `updateAgentKeysEnabled` per-group agent API on/off toggle, and `getAgentContext` used by the HTTP endpoints for key authentication (returns null when the API is disabled so existing keys stop working without being deleted)
- `convex/videoTranscripts.ts`: Video demo transcript scraping for the AI judge: `classifyVideoUrl` (YouTube video vs other video host page vs direct media file), `fetchVideoContext` action helper (7-day per-URL cache in the `videoTranscripts` table, Context.dev component scrape for YouTube captions and page content with a Firecrawl REST fallback for non-YouTube pages, never throws), `getForStory`/`save` internal upsert plumbing, and `getTranscriptForStory` admin query (gated by the `judging.ai` permission) powering the transcript viewer in the AI results dashboard
- `convex/hackathon.ts`: Shared hackathon URL helpers `normalizeProjectUrl` and `groupHasDuplicateUrl` (per-group duplicate URL guard used by `stories.submit`; hidden or rejected entries free the URL); the old hackathon skill API endpoints were removed in favor of the single-file hackathon.md flow
- `convex/hackathonLog.ts`: Single-file hackathon skill utilities: `HACKATHON_LOG_MAX_CHARS` 20k cap, `redactSecrets` (replaces sk-/pk*/ghp*/github_pat_/xox/AKIA/JWT/Convex deploy key shapes with `[redacted]`), `sanitizeHackathonLog` used by all four submission paths, and `parseHackathonLogHeader` which deterministically extracts event/project/whatItDoes/liveApp/repo/frontend/convexDeployment/components/features (accepts both "Features" and "Convex features" labels)/auth/aiModels/started/lastUpdated from "- **Field:** value" markdown lines without ever throwing on malformed input

### Email System (Resend Integration) ✅ FULLY IMPLEMENTED

- `convex/emails/templates.ts`: Email templates for all email types (admin, welcome, engagement, weekly, mentions, admin reports)
- `convex/emails/resend.ts`: Core email sending with Resend API, logging, the global kill switch, and per-email-type toggle enforcement from the admin Email dashboard
- `convex/emails/emailTypes.ts`: Shared email type registry: the EMAIL_TYPES union, Convex validator, per-type toggle defaults, and the appSettings key helper used by sendEmail and the settings functions
- `convex/emails/render.ts`: Dependency-free template rendering shared by backend sends and the admin UI preview: {{variable}} substitution (firstname, name, email, groupname, plus judgingurl/resultsurl/submissionurl group links via the judgingGroupUrls helper), HTML escaping, markdown-lite to email HTML (bold, italic, links, bare URL autolinking, lists, paragraphs), the branded email shell with optional signature block, and reply-to email validation
- `convex/emails/judgingGroupEmails.ts`: Judging group emails to judges or submission owners: send-status query (master switch, judging_group toggle, recipient count, rolling 24h usage against the 200-recipient daily cap), deduplicated judge and submission-owner recipient lists, per-send delivery stats grouped by sendId (delivered, opened, bounced, failed), send and test-send mutations gated by the judging.emails permission with recipientType (judges or submission_owners), optional scheduled sends (runAt, cancellable, tracked in groupScheduledEmails), and the internal delivery action that renders per-recipient variables and routes through emails/resend.sendEmail with reply-to
- `convex/emailTemplates.ts`: Reusable email template CRUD (name, subject, markdown body, optional markdown signature) for the admin Templates sub tab; editing requires emails.send, reading also allows judging.emails so group organizers can pick templates when composing
- `convex/emails/submissions.ts`: Submission emails: submitter confirmation after submit, per-group organizer alert (judgingGroups.notificationEmails), and the admin-triggered results-live blast with de-duplicated recipients
- `convex/emails/daily.ts`: Daily metrics calculation and user engagement processing with fixed validators
- `convex/emails/weekly.ts`: Weekly digest computation and sending functionality
- `convex/emails/welcome.ts`: Welcome email integration for new user onboarding
- `convex/emails/reports.ts`: Admin report notification emails with immediate delivery for content moderation
- `convex/emails/spam.ts`: Spam notification email to submitters when their submission is marked as spam: includes the reason, prefers the account email over the form email, sets reply-to to `ADMIN_EMAIL` when configured, and skips silently for anonymous submissions without an email
- `convex/emails/queries.ts`: V8 runtime queries and mutations for email data, including the Resend onEmailEvent callback that syncs emailLogs delivery statuses and records first-open timestamps into log metadata (separated from Node.js actions)
- `convex/emails/helpers.ts`: Helper queries for email processing and data fetching
- `convex/emails/broadcast.ts`: Admin broadcast email system with user search, tag-based targeting (send to everyone who used a tag, filterable by submission status), recipient counts, and batch processing
- `convex/sendEmails.ts`: Convex Resend Component client (onEmailEvent callback registered) with subject prefix and from address enforcement
- `convex/emailSettings.ts`: User email preferences management with unsubscribe functionality
- `convex/testDailyEmail.ts`: Admin testing functions for daily/weekly email triggers with clear logs utility
- `convex/crons.ts`: Email cron jobs (daily admin, engagement processing, weekly digest) plus a daily rebuild of cached discovery files

### Utilities & Configuration

- `convex/utils.ts`: Shared utility functions for backend operations
- `convex/validators.ts`: Shared document and return validators (tag docs with per-view visibility flags, story-with-details including self-reported AI attribution, custom form answers, and `dynamicFormValues`) used across queries
- `convex/convexBoxConfig.ts`: Configuration for ConvexBox notification system
- `convex/convex.config.ts`: Convex app definition installing the Resend, crons, workpool (plus a separate spamWorkpool), Agent Ready, rate limiter, Firecrawl (bound to `FIRECRAWL_API_KEY`), and Context.dev (bound to `CONTEXT_DEV_API_KEY`, used for video transcript scraping) components
- `convex/siteDirectory.ts`: Pure builders for live `/llms.txt`, `/vibeapps.md`, `/robots.txt`, `/sitemap.xml`, and per-app `/s/{slug}/llms.txt` plus `/md/{slug}.md` from public submissions
- `convex/siteFiles.ts`: Indexed query of public apps, `getPublicStoryBySlug` for per-app discovery files, plus daily cache rebuild into the siteFiles table
- `convex/http.ts`: HTTP actions for external requests, Resend webhook handler, Agent Ready component routes (agents.md, llms-full.txt, llms-status; `/llms.txt`, `/robots.txt`, and `/sitemap.xml` skipped because this app serves live directory files from public submissions), live `/vibeapps.md`, per-app `/s/{slug}/llms.txt` and `/md/{slug}.md`, and the agent judging API under `/api/judging/:slug` (openapi.json discovery plus keyed criteria/submissions/results/scores endpoints with rate limiting and a 403 that distinguishes invalid keys from a group with the agent API turned off)
- `convex/agentReady/content.ts`: Admin-gated app-facing wrappers for the Agent Ready component (settings, generated files, pages)
- `convex/agentReady/analytics.ts`: App-facing analytics wrappers for the Agent Ready component (request summary and time series)
- `agent-ready.config.json`: Agent Ready component configuration (app name, widget, cron, and file generation settings)
- `convex/settings.ts`: Global app settings including the email kill switch, per-email-type toggles (getEmailTypeSettings, setEmailTypeEnabled), and admin controls

## Frontend (src Directory)

### Main Application Files

- `src/main.tsx`: React application entry point, wraps the app in ThemeProvider and themes Clerk per active theme
- `src/App.tsx`: Main app component with routing configuration and the global themed sonner Toaster
- `src/index.css`: Global CSS styles, Tailwind imports, and the three-theme CSS variable definitions (light, classic, dark)
- `src/vite-env.d.ts`: `Vite` environment type definitions
- `src/lib/ThemeContext.tsx`: Theme provider and useTheme hook (light/classic/dark, persisted to localStorage, syncs data-theme on html)
- `src/components/ThemeToggle.tsx`: Header theme switcher button cycling light, classic, dark with Phosphor icons

### Core Components

- `src/components/Layout.tsx`: Main layout wrapper with navigation and structure
- `src/components/ProtectedLayout.tsx`: Authentication-protected layout wrapper
- `src/components/Footer.tsx`: Site footer with About, Leaderboard, live `/llms.txt` and `/vibeapps.md` directory links
- `src/components/UserSyncer.tsx`: Clerk-Convex user synchronization component
- `src/components/DynamicSubmitForm.tsx`: Public dynamic submit form renderer

### Story/App Submission Features

- `src/components/StoryForm.tsx`: Main app submission form with validation, enhanced tag search dropdown, and multi-image upload support
- `src/components/ResendForm.tsx`: Resend integration form for email collection
- `src/components/YCHackForm.tsx`: YC AI Hackathon submission form with team information support
- `src/components/StoryDetail.tsx`: Detailed app view with comments, ratings, voting, image gallery, sticky sidebar for project links and tags, and per-app `llms.txt` plus `{slug}.md` links above View Change Log
- `src/components/StoryList.tsx`: Story rendering in three view modes: ranked Product Hunt style list rows, grid cards, and refreshed vibe cards
- `src/components/ImageGallery.tsx`: Multi-image gallery component with thumbnail navigation and modal Lightbox

### User Interaction Components

- `src/components/Comment.tsx`: Individual comment display component with @mention link rendering
- `src/components/CommentForm.tsx`: Comment creation and editing form with @mention autocomplete
- `src/components/ui/MentionTextarea.tsx`: LinkedIn-style @mention autocomplete textarea component

### Discovery & Navigation

- `src/components/SearchResults.tsx`: Search results display component
- `src/components/WeeklyLeaderboard.tsx`: Top users and trending content
- `src/components/TopCategoriesOfWeek.tsx`: Trending categories and tags
- `src/components/RecentVibers.tsx`: Recent user avatars sidebar with ProfileHoverCard integration

### Admin Dashboard Components

- `src/components/admin/AdminDashboard.tsx`: Main admin dashboard overview with permission-gated navigation: renders only the tabs the caller's access allows (via `getMyAdminAccess`), shows a "Delegated access" badge for non-full admins, and includes Access (full admins only) and Docs tabs; the legacy Custom Forms sub-tab under Forms is hidden (commented out)
- `src/components/admin/useAdminAccess.tsx`: Admin access hook and React context: `useAdminAccessQuery` route gate, `AdminAccessProvider`, and `useAdminAccess` with `can(key)` and `canAccessGroup(groupId)` helpers for hiding actions per permission
- `src/components/admin/AccessManagement.tsx`: Access tab UI for delegated admin permissions: user search with avatars, per-section permission cards with action toggles (including judging.slug), judging group multi-select or all-groups scope, summary chips, notes, and a grants list with edit and revoke
- `src/components/admin/AdminDocs.tsx`: In-admin Docs tab: sidebar-nav markdown documentation covering judging groups (workspace sections with required permissions, slug change warning, links ledger, per-URL access gates), criteria, submissions, judge flow, results and tracking, the AI judge (context sources including hackathon log files and /hackathon.json manifest, custom criteria, editable system prompt), the agent judges HTTP API as a full integration guide (setup steps, auth headers, endpoint table, POST /scores example, rate limits, error reference), the AI spam check (scan triggers, signals, editable prompt, mark flow, email kill switch, permissions), delegated access (including judging.slug), and environment variables for both AI features
- `src/components/admin/ContentModeration.tsx`: Content approval/rejection interface with image management; confirmed spam submissions show a red Spam badge with the reason on hover
- `src/components/admin/ActivityLog.tsx`: Activity admin tab: paginated feed of app activity (emails, submissions, spam, judging, scoring, moderation, access, settings) with category filter pills, Active/Archived view, newest/oldest sort, pause/resume logging with paused banner, select all with bulk archive/restore/delete, batched clear log with confirm, CSV export of the current view, and expandable rows with action key, target, and metadata
- `src/components/admin/SpamCheck.tsx`: AI Spam admin tab in two steps: a "Run a scan" card (own date range picker with presets, Scan and Re-scan buttons that scope to the picked range or the 100 most recent, inline help copy) and a "Scan results" section with view-only filters (verdict, sort, submission date range), live counts strip, editable AI system prompt panel with reset to default, select all with bulk mark-as-spam (optional custom reason sent to submitters), bulk hide and delete, per-row mark/unmark/re-scan, verdict badges with confidence, inline URL/repo/duplicate signals, and expandable rows with full AI reasoning and scan metadata; both date ranges persist in localStorage across tab switches and reloads, and the counts strip pills are clickable quick filters synced with the verdict dropdown; plus an Automation card (auto-scan toggle, confirm-gated agent auto-mark with confidence threshold input, notify-on-auto-mark toggle) and a collapsed "Marked spam" review section listing everything currently marked (even without a scan row) with a marked-date range filter, select all, chunked bulk delete (50 per call), per-row unmark, and Auto-marked robot badges on agent-marked rows
- `src/components/admin/UserModeration.tsx`: User management, verification, and ban/pause functionality
- `src/components/admin/TagManagement.tsx`: Tag creation and customization with colors, emojis, and ordering. Per-tag toggles control visibility in the header, on the app detail page, and on app card lists, plus archive. Save and drag-and-drop reorder persist only changed tags in parallel (fast with large tag sets); includes paginated list with selectable page size (5-200), synced top and bottom pagination controls, search across all tags, a Tag limits card (max tags per submission, max tag name length), and bulk selection with Archive/Unarchive/Delete actions and inline delete confirm
- `src/components/admin/Settings.tsx`: Site-wide settings configuration with view mode controls, submission limits, and submit page layout (hide /submit sidebar)
- `src/components/admin/NumbersView.tsx`: Analytics and metrics dashboard with detailed tracking
- `src/components/admin/ReportManagement.tsx`: User report review and resolution with status tracking and email notification integration
- `src/components/admin/EmailManagement.tsx`: Complete email system management with Send & Settings and Templates sub tabs: global toggle, per-type send options (including the judging group emails toggle), broadcast emails (all users, selected users, or everyone who used a tag), user search, testing tools, and admin alert configuration
- `src/components/admin/EmailTemplatesManager.tsx`: Templates sub tab of Email Management: create, edit, and delete reusable email templates (name, subject, markdown body, optional signature) with a supported-variables legend and a live iframe preview rendered by the same shared renderer the backend uses
- `src/components/admin/SubmitFormFieldManagement.tsx`: Manage fields for a specific submit form
- `src/components/admin/CreateSubmitFormModal.tsx`: Modal to create new submit forms
- `src/components/admin/EditSubmitFormModal.tsx`: Modal to edit existing submit forms

### Form Management Components

- `src/components/admin/Forms.tsx`: Dynamic form management interface
- `src/components/admin/FormBuilder.tsx`: Form creation and field configuration
- `src/components/admin/FormResults.tsx`: Form submission results and export
- `src/components/admin/FormFieldManagement.tsx`: Story form field configuration
- `src/components/admin/SubmitFormManagement.tsx`: Submit form management for specialized forms
- `src/components/admin/SubmitFormBuilder.tsx`: Submit form creation and configuration
- `src/components/PublicForm.tsx`: Public-facing form display

### Judging System Components

- `src/components/admin/Judging.tsx`: Compact Linear-style list of judging groups (active status dot, public/private lock, submission and judge counts, created time) with inline totals and the Create Judging Group button; each row links into the group workspace at `/admin/judging/:slug`
- `src/pages/AdminJudgingGroupPage.tsx`: Full-page docs-style workspace for one judging group with a collapsible sticky sidebar (icon-only mode via a PanelLeft toggle, persisted in localStorage) and `?section=` deep links (Overview, Links, Settings, Access, Criteria, Submissions, Submit page, AI judge, Results, AI results, Judge tracking); header slug shows a pencil (judging.slug) to change the URL; sections are hidden when the caller lacks the mapped delegated permission and embed the existing criteria/results/AI/tracking components without their standalone headers
- `src/components/admin/judging/groupSection.tsx`: Shared utilities for group workspace sections: `GroupDetails` type, submission field/section/visibility definitions, custom question types and key generation (`makeQuestionKey`, `mergeVisibility`), AI rubric definitions, date input helpers, and UI primitives (`SectionCard` with optional `headerAction` slot, `SaveFooter`, `HeaderSaveButton`, `UrlRow`, `TogglePill`, `useSaveState`)
- `src/components/admin/judging/GroupSlugEditor.tsx`: Pencil and Settings button that open a warning dialog to change a judging group's URL slug, then replace-navigate to the new admin path
- `src/components/admin/judging/GroupOverviewSection.tsx`: Group stats, active/public status toggles, and copyable public URLs (judging, results, submit page)
- `src/components/admin/judging/GroupSettingsSection.tsx`: Name, URL slug (read-only plus Change slug when judging.slug is granted), description, active status, judges per submission, scoring scale (1-5 or 1-10), and permission-gated danger zone delete
- `src/components/admin/judging/GroupAccessSection.tsx`: Judge access, submission page access, and results visibility passwords (blank input keeps the existing password)
- `src/components/admin/judging/GroupSubmissionsSection.tsx`: Search-and-add any site submission to the group, auto-include tags/date range/match rule config, sync matching submissions action, and CSV export
- `src/components/admin/judging/GroupSubmitPageSection.tsx`: Custom submission page toggle (persists immediately so the public URL works right away), branding (title, description, layout, header image upload, links), required tag picker with hidden tags listed, inline tag creation (defaults to hidden, standard tags.create mutation) and backfill sync, per-field show/hide and required/optional toggles, section visibility (team info, additional images/links), custom questions editor (text/url/email/textarea) with per-question Shown/Hidden pills, section Required/Optional pills, an Additional form fields list with per-group Required/Shown overrides for Manage Form Fields entries, guard-rail warnings (hidden tags need a required tag, hidden GitHub URL with AI judge on), and a header save button when expanded
- `src/components/admin/judging/GroupAiSection.tsx`: AI judge enable toggle, results visibility, and an AI judge links block once enabled (judging.manage), plus rubric weights with per-criterion on/off toggles, components check and frontend checker presets behind explicit Add to rubric buttons (the frontend checker row expands with per-platform hosting sub-weights for Codex Sites, Convex static hosting, Vercel, Netlify, and Other, default 1), a custom criteria editor, an editable system prompt with reset to default, agent API on/off toggle, and agent API key management (judging.ai)
- `src/components/admin/judging/GroupEmailsSection.tsx`: Emails section of the judging group workspace (judging.emails): Send to selector for Judges or Submission owners, template picker, editable subject, markdown body and signature, reply-to address with group notification email suggestions, recipient checklist with select all, preview as any selected recipient with their real data, optional scheduled send time with a cancellable Scheduled sends list, daily cap usage line, send test to self, confirm-gated send, toggle-state banner, and per-send delivery stats (delivered, opened, bounced) from emailLogs
- `src/components/admin/judging/GroupActivitySection.tsx`: Per-group realtime audit trail in the group workspace: submission adds/removes, AI review lifecycle, judge scores, and setting changes with submission links, Show 30/60/100 dropdown with load more, Export CSV, Save as .md audit file, and confirm-gated Clear (judging.manage)
- `src/components/admin/judging/GroupLinksSection.tsx`: Realtime links ledger for one judging group: every shareable URL (judging interface, results, custom submission page, plus AI results and agent API endpoints only while the AI judge is enabled) with lock/globe/key icons, live password-set status, copy and open actions, access notes, submit-page and score-scale hints, plus copy-all-as-markdown and .md file download that include each locked link's password as a one-paste event kit
- `src/components/admin/CreateJudgingGroupModal.tsx`: Judging group creation modal with password protection
- `src/components/admin/EditJudgingGroupModal.tsx`: Legacy comprehensive editing modal, superseded by the group workspace sections above; no longer referenced but kept in the repo
- `src/components/admin/AIJudgeResults.tsx`: Admin AI Judge results view with Results/Stats/Hackathon Report tabs: Run AI Review button with live progress counts (pending/running/completed/failed), ranked results with per-criterion scores and reasoning, detected Convex features, sources used and URL liveness badges (URL live / URL 404 / URL down / no URL) plus a detected frontend hosting platform badge, an event badge from a pasted hackathon.md header, and an expandable amber log-discrepancy indicator when the pasted log's claims disagree with detected facts (admin-only, never scored), inline score/reasoning editing via `updateResultScore`, per-submission retry for failures, a screenshot-friendly Stats tab (apps reviewed, Convex usage, advanced features, Convex components used with per-component app counts, live apps, repos, average score, top features, score distribution), and a Hackathon Report tab (gated until the full run completes) that generates a markdown report with rankings, links, teams, and participation, with copy and .md download
- `src/components/admin/JudgingCriteriaEditor.tsx`: Scoring criteria management embedded in the group workspace; score preview follows the group scoring scale
- `src/components/admin/JudgingResultsDashboard.tsx`: Admin results and analytics with CSV export, rendered headerless inside the group workspace with a compact inline-icon stats strip
- `src/components/admin/JudgeTracking.tsx`: Comprehensive judge tracking dashboard (breadcrumb and back header only on the standalone page; hidden when embedded in the group workspace) with Stats Overview, Judge Activity section with expandable judge details and score moderation tools, Judge Scores & Comments tabbed interface showing detailed scoring per judge with submission grouping, floating scroll buttons, notes viewing, and CSV export of comprehensive judge activity data
- `src/components/PublicJudgingResultsDashboard.tsx`: Public-facing results display showing overall stats, rankings, and criteria performance (Judge Scores & Comments section moved to admin JudgeTracking)
- `src/components/PublicResultsViewer.tsx`: Public results viewer component
- `src/pages/JudgingInterfacePage.tsx`: Individual submission judging interface with comprehensive filtering (tag dropdown, judged status filter, choice-answer filter over dynamic form fields and custom questions), search functionality, group-wide progress tracking, edit permissions based on completion status, read-only views of others' completed submissions, @mention autocomplete in notes, and cards showing per-group custom question answers (Additional Answers) and admin-added form field values (Additional Form Fields). Filters work together to help judges find specific submissions efficiently.

### Notification & Configuration

- `src/components/ConvexBox.tsx`: Dismissible notification banner system with custom styling
- `src/components/admin/ConvexBoxSettingsForm.tsx`: ConvexBox configuration with image upload support

### UI Components (src/components/ui/)

- `src/components/ui/button.tsx`: Reusable button component
- `src/components/ui/input.tsx`: Form input component
- `src/components/ui/textarea.tsx`: Multi-line text input
- `src/components/ui/select.tsx`: Radix select primitives themed with site tokens (used by SimpleSelect)
- `src/components/ui/SimpleSelect.tsx`: Themed dropdown with native-select ergonomics (value/onChange/options), replaces all native selects so open menus match the active theme with full keyboard support
- `src/components/ui/ChoiceFieldInput.tsx`: Reusable input for admin-configured choice form fields: custom-styled radio group, multi-select checkbox group, or themed dropdown (SimpleSelect) depending on fieldType; values stay strings (multiselect comma-joined in configured option order) with native required validation and aria labeling
- `src/components/ui/checkbox.tsx`: Checkbox input component
- `src/components/ui/label.tsx`: Form label component
- `src/components/ui/dialog.tsx`: Modal dialog component
- `src/components/ui/popover.tsx`: Radix popover surface styled to match the site design system
- `src/components/ui/calendar.tsx`: Site-styled calendar built on react-day-picker (replaces native date inputs)
- `src/components/ui/date-range-picker.tsx`: Date range picker with preset windows (last 7/30 days, this/last month, last 3 months) and a two-month range calendar
- `src/components/ui/AlertDialog.tsx`: Alert and confirmation dialogs with keyboard support (autofocus Cancel, Tab trap between buttons, Enter activates, aria-modal)
- `src/components/ui/AuthRequiredDialog.tsx`: Authentication requirement modal

### Hooks (src/hooks/)

- `src/hooks/useDialog.tsx`: Imperative message/confirm dialog helper backed by MessageDialog and AlertDialog
- `src/hooks/useEscapeKey.ts`: Shared hook that closes an open overlay when the Escape key is pressed (window keydown subscription gated on open state)

### Page Components (src/pages/)

- `src/pages/SignInPage.tsx`: User sign-in page
- `src/pages/SignUpPage.tsx`: User registration page
- `src/pages/SignOutPage.tsx`: User sign-out confirmation
- `src/pages/SetUsernamePage.tsx`: Username setup for new users
- `src/pages/UserProfilePage.tsx`: User profile display and management with email preferences and unsubscribe functionality
- `src/pages/TagPage.tsx`: Tag-specific app listings
- `src/pages/JudgingGroupPage.tsx`: Judge interface for scoring submissions with session management
- `src/pages/JudgingGroupSubmitPage.tsx`: Public custom submission page for a judging group with password gating, three admin-selectable layouts (two column, one third, single column with centered hero), sectioned form, locked required tag, admin-selectable field visibility and required status (including required form sections and per-group overrides for admin-added form fields), and per-group custom questions (hidden ones removed) whose answers save to the story; supports query-param prefill (`?url=&title=&tagline=&github=`) for skill-generated submit links and shows Convex errors (like the duplicate project URL guard) without the server prefix
- `src/pages/JudgingInterfacePage.tsx`: Individual submission judging interface with comprehensive filtering (tag dropdown, judged status filter, choice-answer filter over dynamic form fields and custom questions), search functionality, group-wide progress tracking, edit permissions based on completion status, read-only views of others' completed submissions, @mention autocomplete in notes, and cards showing per-group custom question answers (Additional Answers) and admin-added form field values (Additional Form Fields). Filters work together to help judges find specific submissions efficiently.
- `src/pages/PublicJudgingResultsPage.tsx`: Public judging results page with password protection
- `src/pages/AIJudgeResultsPage.tsx`: Public "Best Use of Convex — AI Review" results page at `/judging/:slug/ai-results` with the same public/password/admin-bypass gate as human results, ranked AI scores with expandable per-criterion reasoning, detected Convex features, a live app URL status badge per submission, and clear AI-generated labeling
- `src/pages/NotificationsPage.tsx`: User notifications page with comprehensive alert system for all interaction types, including the Request review button on spam alerts that files an in-app dispute with admins
- `src/pages/InboxPage.tsx`: Direct messaging inbox with conversation view, message threads, @mentions, edit/delete, and real-time updates
- `src/pages/NotFoundPage.tsx`: 404 error page
- `src/pages/NavTestPage.tsx`: Navigation testing page

### Utilities & Types

- `src/lib/utils.ts`: Shared utility functions and helpers
- `src/utils/mentions.tsx`: @Mention link rendering utility for converting @username to profile links
- `src/types/index.ts`: TypeScript type definitions for the frontend

## Static Assets (public Directory)

### Icons & Favicon

- Various favicon sizes and formats for different devices
- Apple touch icons for iOS devices
- Microsoft tile icons for Windows
- `favicon.svg`: SVG favicon for modern browsers

### Configuration Files

- `_redirects`: `Netlify` routing configuration for SPA, plus production proxies for `/robots.txt`, `/llms.txt`, `/vibeapps.md`, `/sitemap.xml`, `/s/:slug/llms.txt`, `/md/*`, `/meta/s/*`, and `/api/unsubscribe` to the Convex site domain
- `robots.txt`: Search and AI crawler allow list (live copy served from Convex)
- `sitemap.xml`: Static stub; the live sitemap of public apps is served from Convex

### Graphics

- `vibe-apps-open-graphi-image.png`: Social media preview image
- `vibe-apps-open-graphi-image-v1.png`: Alternative social preview

## Build & Development Files

- `index.html`: Main HTML template for the SPA
- Various TypeScript path configurations for different environments

## What's needed (pointers)

- Clerk organizer role access to judges section:
  - Backend: `convex/auth.ts`, `convex/auth.config.js`, role checks in admin queries
  - Frontend: gating in `src/components/admin/Judging.tsx`, `src/components/admin/AdminDashboard.tsx`
- Admin moderation to make app post by approval only:
  - Backend: `convex/stories.ts`, add auto-approval toggle in `convex/settings.ts`
  - Frontend: `src/components/admin/Settings.tsx` to add toggle control
