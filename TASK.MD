# Feature Name Implementation

Brief description of the feature and its purpose.

## Completed Tasks

- [x] 2026-06-30 18:17 UTC: Judging auto-jump to next submission. In the single-judge flow, `handleMarkCompleted` now advances to the next submission after a successful "Mark Submission Complete", matching the multi-judge "Judged & Next" behavior. Prefers the next submission not completed by any judge (via `judgeProgress.submissionProgress[].completedBy`), otherwise moves forward by one. Verified: lint clean on changed file. Files: src/pages/JudgingInterfacePage.tsx
- [x] 2026-06-30 17:40 UTC: Judging auto-include UX upgrade.  Made the auto-populate tag picker searchable (filter by name, first 50 results) with removable selected-tag chips that persist when filtered out, so admins can handle 1000s of tags. Added a "Tag match rule" (any/all): "any" keeps OR behavior, "all" requires every selected tag (AND, e.g. tag 1 + tag 2 + tag 3). New optional `autoIncludeMatchMode` field (defaults "any"); `storyMatchesAutoInclude`, `updateGroup` backfill, validators, and `getGroupWithDetails` all honor it. Date range still applies in both modes. Verified: convex codegen + deploy TypeScript clean, frontend lints clean. PRD: prds/judging-tag-daterange-groups.md. Files: convex/schema.ts, convex/judgingGroups.ts, convex/judgingGroupSubmissions.ts, src/components/admin/EditJudgingGroupModal.tsx
- [x] 2026-06-29 17:14 UTC: Modal Escape-to-close audit. Audited every modal/overlay and ensured Escape closes the open one. Added a shared `src/hooks/useEscapeKey.ts` (window keydown subscription gated on open state) and wired it into the shared `ui/dialog.tsx` (covers Create/Edit submit form modals, StoryDetail report, UserProfilePage report), `AlertDialog`, EditJudgingGroupModal, CreateJudgingGroupModal, ContentModeration delete-comment confirm, UserModeration confirm action, JudgeTracking (edit score / delete judge / delete score), and InboxPage (block / report). Left already-working modals untouched (MessageDialog, PromptDialog, ImageGallery, StoryForm lightbox, Radix AuthRequiredDialog + Footer about). No UI/behavior changes beyond ESC. Verified: `tsc --noEmit` exit 0, eslint 0 errors on changed files. PRD: prds/modal-esc-close.md. Files: src/hooks/useEscapeKey.ts, src/components/ui/dialog.tsx, src/components/ui/AlertDialog.tsx, src/components/admin/EditJudgingGroupModal.tsx, src/components/admin/CreateJudgingGroupModal.tsx, src/components/admin/ContentModeration.tsx, src/components/admin/UserModeration.tsx, src/components/admin/JudgeTracking.tsx, src/pages/InboxPage.tsx
- [x] 2026-06-30 00:17 UTC: Permanently fixed Convex write conflicts in the `judges` table. The `judges.updateActivity` heartbeat was retrying ~1.6K times on a single hot row (conflicting with itself) because it wrote `lastActiveAt` on essentially every 60s tick, so parallel heartbeats collided under OCC (https://docs.convex.dev/error#1). Fix: gated the write behind a 2-minute server-side staleness threshold (`ACTIVITY_UPDATE_THRESHOLD_MS`) so most heartbeats are read-only no-ops and concurrent calls resolve to one write; added client jitter (60s + up to 15s) so heartbeats don't fire in lockstep. Created `.agents/skills/convex-write-conflicts/SKILL.md` to remember the diagnosis + canonical fix. Verified: lint clean on both files. Files: convex/judges.ts, src/pages/JudgingInterfacePage.tsx, .agents/skills/convex-write-conflicts/SKILL.md
- [x] 2026-06-30 00:11 UTC: Judging groups auto-populate by multiple tags + date range. Admins can configure a group with multiple tags (OR logic, one or both) and an optional submission creation date range; matching stories are materialized into `judgingGroupSubmissions` (idempotent via `ensureStoryInGroup`) so they appear in JudgingInterfacePage and judging results with no extra wiring. Added `autoIncludeTagIds`/`autoIncludeStartDate`/`autoIncludeEndDate` schema fields, `storyMatchesAutoInclude` helper, extended `syncStoryToTaggedGroups`, new `syncAutoIncludeSubmissions` mutation, forward backfill in `updateGroup`, and a multi-tag + date range + "Sync matching submissions" UI section. Filters only add submissions, never remove (preserves scores). Verified: convex codegen + deploy typecheck clean, frontend lints clean. PRD: prds/judging-tag-daterange-groups.md. Files: convex/schema.ts, convex/judgingGroups.ts, convex/judgingGroupSubmissions.ts, src/components/admin/EditJudgingGroupModal.tsx
- [x] 2026-06-28 23:10 UTC: Judging group CSV export. Each judging group in the Admin Judging System now has an "Export CSV" button that fetches the group's submissions on demand (admin-only `exportGroupSubmissions` query) and downloads custom submit form info: App Title, App/Project Tagline, Description, App Website Link, Video Demo URL, GitHub/LinkedIn/Twitter/Chef links, Tags, Hackathon Team Info, submitter name, email, slug, votes. Images excluded; hidden/archived/rejected stories skipped; empty groups show a notification. PRD: prds/judging-group-csv-export.md. Files: convex/judgingGroupSubmissions.ts, src/components/admin/Judging.tsx
- [x] 2026-06-28 23:00 UTC: Per-view tag visibility. Admins can hide a tag from the app detail page and from app card lists (home/category/grid/vibe) independently, alongside existing header and archive toggles, so custom submission tags can be hidden from public surfaces without hardcoding names. Added optional `hideInStoryDetail`/`hideInStoryList` tag fields, surfaced two new toggle buttons in Tag Management, threaded the fields through story tag resolution, and applied the filters in StoryDetail and StoryList. PRD: prds/tag-per-view-visibility.md. Files: convex/schema.ts, convex/tags.ts, convex/stories.ts, src/components/admin/TagManagement.tsx, src/components/StoryDetail.tsx, src/components/StoryList.tsx
- [x] 2026-06-28 22:48 UTC: Judge score breakdown on results page. Added collapsible per-judge name and average toggle to Rankings on the public judging results dashboard for multi-judge submissions. Backend returns judgeBreakdown when judgesCompleted > 1. Files: convex/judgeScores.ts, src/components/PublicJudgingResultsDashboard.tsx
- [x] 2026-06-28 22:40 UTC: Judging submissions counted by required tag. Any valid story carrying a group's required tag is now materialized into `judgingGroupSubmissions` + `submissionStatuses` so it is judged and counted like a custom-form submission. Reverse sync on story tag edits (`updateOwnStory`, `updateStoryAdmin`, `addTagsToStory`), forward backfill when a group's required tag is set/changed (`updateGroup`), and a manual "Sync existing submissions with this tag" admin button. Idempotent via shared `ensureStoryInGroup` helper; preserves existing scores/statuses. PRD: prds/judging-required-tag-submissions.md. Files: convex/judgingGroupSubmissions.ts, convex/stories.ts, convex/judgingGroups.ts, src/components/admin/EditJudgingGroupModal.tsx
- [x] 2026-06-28 22:17 UTC: Multi-judge submissions: admins can set judges per submission (1-20), "Judged & Next" flow with per-judge completion tracking (new submissionJudgeCompletions table), overall + per-judge score breakdown with after-self reveal, OCC-safe completion. PRD: prds/multi-judge-submissions.md. Files: convex/schema.ts, convex/judgingGroups.ts, convex/judges.ts, convex/judgingGroupSubmissions.ts, convex/judgeScores.ts, convex/adminJudgeTracking.ts, src/components/admin/EditJudgingGroupModal.tsx, src/pages/JudgingInterfacePage.tsx, src/components/admin/JudgeTracking.tsx
- [x] 2026-06-28 14:33 UTC: Installed agent skill scaffolding into the repo: `.agents/skills/*` and `.claude/skills/*` (convex-quickstart, convex-setup-auth, convex-create-component, convex-migration-helper, convex-performance-audit, plus design/workflow skills), with `AGENTS.md`, `CLAUDE.md`, and `skills-lock.json`. Dev tooling only, no app code or schema changes. Verified production build passes (`npm run build`, exit 0). Files: `.agents/skills/`, `.claude/skills/`, `AGENTS.md`, `CLAUDE.md`, `skills-lock.json`
- [x] 2026-06-28 07:00 UTC: Tag Management top pagination. Added a second pagination control next to the "Tags per page" selector at the top of the list; kept the existing bottom control. Both render from one shared `renderPagination()` helper driven by the same `currentPage`/`safePage`/`totalPages` state, so they always stay in sync. Files: `src/components/admin/TagManagement.tsx`
- [x] 2026-06-28 06:45 UTC: Lint cleanup to 0 ESLint errors. Fixed 4 pre-existing `react-hooks/rules-of-hooks` violations (moved early returns below hooks in MessageDialog, ImageGallery, ContentModeration); fixed no-useless-escape, no-case-declarations, and empty-interface errors; set `no-explicit-any` and `no-unused-vars` to `warn` (with ignoreRestSiblings + `^_`) so 400+ pre-existing items stay advisory. Verified: 0 lint errors, `tsc` clean, prod build OK, convex functions ready, behavior unchanged. Files: `eslint.config.js`, `convex/clerk.ts`, `convex/emails/templates.ts`, `netlify/edge-functions/submitMeta.ts`, `src/components/ui/MessageDialog.tsx`, `src/components/ImageGallery.tsx`, `src/components/admin/ContentModeration.tsx`, `src/components/ResendForm.tsx`, `src/components/StoryForm.tsx`, `src/components/YCHackForm.tsx`, `src/components/StoryDetail.tsx`, `src/pages/JudgingInterfacePage.tsx`
- [x] 2026-06-28 06:25 UTC: Upgraded Convex to 1.42.0 (latest) + gated components (`@convex-dev/resend` 0.2.5, `rate-limiter` 0.3.2, `workpool` 0.4.7, `convex-helpers` 0.1.120); added `@convex-dev/eslint-plugin@2.0.0` and bumped `typescript-eslint` to fix the eslint 9.36 crash; cleaned `convex/sendEmails.ts` unused bindings and ran autofix. Verified: convex dev ready, vite dev clean, `tsc --noEmit` clean, `convex codegen` typecheck clean, prod build OK. Files: `package.json`, `package-lock.json`, `eslint.config.js`, `convex/sendEmails.ts`
- [x] 2026-06-27: Fixed global email toggle so Disabled blocks all email types (admin report notifications no longer bypass the kill switch); added tag-based broadcast emails (send to everyone who used a tag) with a searchable tag selector, submission-status filter (pending/approved/rejected), and live recipient count in Email Management. Files: `convex/emails/resend.ts`, `convex/emails/broadcast.ts`, `src/components/admin/EmailManagement.tsx`
- [x] 2026-06-28 06:15 UTC: Tag Management performance + UX. Save now persists only changed tags (was re-saving all 400+); drag-and-drop reorder persists only the moved range in parallel; added pagination with selectable page size (5-200) and search across all tags. Files: `src/components/admin/TagManagement.tsx`
- [x] 2026-06-28 02:52 UTC: Judging custom submission page admin-selectable required fields (PRD: prds/judging-custom-required-fields.md)
- [x] updated bookmarks viewing
- [x] changed site fonts
- [x] change from /u/username to /username in url slugs
- [x] Add a ban member in /admin dashboard
- [x] add sidebar leaderboard to list view
- [x] update clerk admin role permissions in for mod view
- [x] create 404 page
- [x] remove state for profile and admin page to remove sidebar
- [x] add tag bar to header like https://www.ycombinator.com/launches
- [x] add follow profile features
- [x] update comments to have a 10 word minimum
- [x] fix username and name clerk sync
- [x] hide or show views in the dashboard
- [x] add show 3 related products by tags below comments
- [x] update category links in vibe view sidebar
- [x] add rabbit analytics https://app.rybbit.io/
- [x] Joined vibe apps date
- [x] setup clerk production and link
- [x] link to sections on profile page
- [x] download icons for all the apps
- [x] sort tags in dashboard
- [x] Setup hosting on Netlify
- [x] Setup domain name on Netlify
- [x] confirm https://www.cookieyes.com/ is setup
- [x] test forms
- [x] setup llms.txt, sitemap.xml and robots.txt
- [x] link image in setting popup box
- [x] fix name on story detailed page
- [x] hide resendhackathon on story detailed page
- [x] hide extra sign in to commit
- [x] add new tags url slugs for pages
- [x] put reports under user moderation in admin dashboard
- [x] judging scale from 1-10 vs 1-5
- [x] search for tags in admin
- [x] allow to number sort tags
- [x] search for submission name next to number in the judging form
- [x] add view judging results to the judging form
- [x] Add options to add team
- [x] add option for multiple image upload
- [x] added markdown support and preview for story details page
- [x] fix open graph image
- [x] add gallery images also show up in judging page with popup modal
- [x] added judges score moderations system
- [x] add @mentions for usernames in judging notes, comments for profiles and in the comments section.
- [x] add notification section like product hunt that works with sending emails too, move notification dot and background from page
- [x] update templates.ts
- [x] fix links for weekly emails
- [x] report a user option on profile page
- [x] update alert's if admin pins or adds a message to their app
- [x] setup resend for emails for notifications on post
- [x] add option to turn off email notifications on user profiles
- [x] add reporting users or post email option to admin from adminalerrtemails.md
- [x] add changelog tracking on story detail page that shows all user edits with date/time in user's timezone
- [x] always show changelog section with anchor links from sidebar and judging page
- [x] add inbox direct message and inbox email notification from friendsonlyinbox.md
- [x] test inbox direct message and inbox email notification from friendsonlyinbox.md
- [x] change notifications for inbox to be inbox check in
- [x] fix "Invalid Date" display on judging interface page submission timestamps
- [x] add inbox icon to header
- [x] fix inbox scrolling behavior to prevent whole page from scrolling, only chat window and conversation list scroll independently
- [x] redesign inbox page with messenger-style 3-column layout with right sidebar showing Most Vibes This Week, Recent Vibers, and Top Categories This Week
- [x] implement soft delete for inbox conversations with automatic undelete when receiving new messages
- [x] add clickable @username links in inbox chat messages that link to user profiles (without hover cards)
- [x] make usernames in conversation list and chat header clickable links to user profiles
- [x] fix "Not authenticated" errors in markConversationRead mutation
- [x] fix deleted conversations showing old messages when restarted - now marks all messages as deleted when deleting conversation
- [x] fix deleted conversation still appearing in inbox - added auto-clear when conversation no longer exists in list
- [x] fix missing input box when starting new conversation after deletion - added fallback query to fetch conversation details
- [x] fix upsertConversation to remove current user's deletion record when restarting conversation
- [x] fix message sync - when user deletes conversation and other user sends message, conversation reappears in recipient's inbox
- [x] add report user feature in inbox conversation header with Flag icon (light grey, hover black)
- [x] integrate inbox user reports with UserReportManagement admin dashboard
- [x] send email alerts to admins/managers when users are reported in inbox
- [x] add block user feature in inbox conversation header with Ban icon (light grey, hover black)
- [x] blocked users cannot send messages to users who blocked them
- [x] block button shows block/unblock state and allows toggling
- [x] replace browser alerts/prompts with custom modals matching site design
- [x] add error banner for blocked user messages instead of console errors
- [x] add custom report modal with textarea (500 char limit)
- [x] in judging interface keep the original date but ia user make changes add just the date and time the submission was modified and still link to change log
- [x] add an anchor link to change log and link to
- [x] in Content moderation add a show by date range submissions
- [x] Content moderation keep hide, add archive that hides from Content moderation but still able to see by dropdown selection
- [x] fixed judging progress
- [x] added edit add tags to submissions
- [x] added CSV export to Judge Tracking dashboard for comprehensive judge activity reports
- [x] updated Judge Tracking UI to show submissions judged and avg score instead of confusing scores column
- [x] fixed Judge Tracking crash when encountering deleted judges, stories, or criteria
- [x] added judge notes viewing and moderation in Judge Tracking dashboard
- [x] admins can view all judge collaboration notes on submissions and reply to them
- [x] added note count badges showing number of notes per submission in Judge Tracking
- [x] improved reply button design for better mobile responsiveness in judge notes
- [x] added total notes count per judge in judge list next to submissions judged stat
- [x] verified notes counts back-fill all existing/historical notes from database
- [x] improved Judge Tracking UI spacing and layout for better readability
- [x] enhanced CSV export to include judge collaboration notes with timestamps
- [x] added blank rows between submissions in CSV export for better organization
- [x] fixed Judge Tracking server error when scores reference deleted stories or criteria - now gracefully skips orphaned scores
- [x] fixed write conflicts in judges table by optimizing updateActivity and registerJudge mutations
- [x] reduced database queries in registerJudge from multiple filtered queries to single collect with in-memory filtering
- [x] added client-side throttling to updateActivity (60 seconds) and conditional updates (only if timestamp is newer)
- [x] added 1-minute threshold for lastActiveAt updates in registerJudge to prevent excessive writes
- [x] add dates to messages inbox
- [x] judge tracking now has its own dedicated page with URL pattern /admin/judging/{slug}/tracking for each judging group
- [x] made judge notes display with sticky note yellow background and black text for better visibility
- [x] inbox message from user on the right
- [x] rankings score don't show until judge has clicked on complete
- [x] add link to submission on judges score page
- [x] add inbox messages to daily engagement emails with sender name and count
- [x] fix critical date range bug causing incorrect email activity calculations
- [x] enhance email testing panel with date range display and activity warnings
- [x] move TESTING_SUMMARY.md and EMAIL_DATE_RANGE_FIX.md to prds folder
- [x] update addresend.md with Phase 11 implementation details
- [x] update adminalerrtemails.md to reference recent email infrastructure improvements and testing documentation
- [x] update email-testing-guide.MD with Phase 11 enhancements and cross-references to new testing documentation
- [x] update mentions.md to reference Phase 11 inbox message integration in daily email system
- [x] fix judging count for submission
- [x] enhanced multi-judge submission visibility to show ALL submissions to all judges for better transparency
- [x] added canEdit and completedBy fields to judge progress tracking in backend
- [x] removed submission filtering logic from frontend judging interface
- [x] updated progress counter to show group-wide completion (submissions completed by ANY judge)
- [x] enhanced search dropdown to show completion status and judge names
- [x] added UI controls to disable scoring for submissions completed by other judges
- [x] improved transparency and coordination in multi-judge scenarios
- [x] updated judgingsetup.md with comprehensive documentation of new multi-judge visibility system
- [x] updated changelog.MD with October 12, 2025 multi-judge visibility enhancement
- [x] moved Judge Scores & Comments section from PublicJudgingResultsDashboard to admin JudgeTracking page
- [x] reorganized JudgeTracking page layout: Stats Overview, Judge Scores & Comments, Judge Activity
- [x] simplified public results page to focus on rankings and criteria performance only
- [x] enhanced admin workflow with centralized judging data view in Judge Tracking
- [x] reorganized JudgeTracking page section order to Stats Overview → Judge Activity → Judge Scores & Comments
- [x] added breadcrumb navigation links to quickly jump between sections on JudgeTracking page
- [x] added floating scroll-to-top and scroll-to-bottom buttons on JudgeTracking page
- [x] added anchor IDs and smooth scroll behavior to all major sections for better navigation
- [x] updated JudgingInterfacePage progress bars to show group-wide completion percentage
- [x] changed progress calculation from individual judge completion to group-wide completion
- [x] synchronized all progress indicators (header bar, overall progress text, progress summary) to use groupCompletionPercentage
- [x] add emoji support in inbox
- [x] added EditJudgingGroupModal component for comprehensive judging group settings management
- [x] added tag filter and judged status filter to judging interface page
- [x] removed console.log statements from codebase for production readiness
- [x] fixed linter errors (unused imports and variables)

## In Progress Tasks

- [ ]

## Future Tasks - Roadmap

- [ ] clerk roles for hackathon organizers to see judges section in admin dashboard only from friendsonlyinbox.md
- [ ] add admin moderation to make app post by approval only

## Bugs

## Implementation Plan

Detailed description of how the feature will be implemented.

### Relevant Files

- search [files.MD](files.MD)
