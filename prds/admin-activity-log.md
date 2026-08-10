# Admin activity log

Created: 2026-08-10 06:05 UTC
Last Updated: 2026-08-10 06:20 UTC
Status: Done

## Problem

Admins have no single place to see what is happening across the app. Email sends live in emailLogs, spam actions in spamCheckResults, moderation and judging changes are invisible after the fact. The ask: one Activity tab in the admin dashboard that tracks emails, submissions, spam, judging, scoring, access grants, settings changes, and admin moderation actions, with pause, clear, select all, sort by date, archive, delete, and CSV export, gated through the existing delegated access system.

## Proposed solution

### Data

New `activityLog` table:

- `category`: union of email, submission, spam, judging, scoring, moderation, access, settings
- `action`: short key like `story.submitted`, `email.sent`, `spam.marked`
- `message`: human readable one liner
- `actorUserId` (optional), `actorName` (denormalized, "System" for background jobs)
- `targetType`, `targetId`, `targetLabel` (optional pointers to the affected record)
- `metadata` (optional v.any() detail payload)
- `isArchived`: always written as false on insert so indexes stay dense

Indexes: `by_archived ["isArchived"]`, `by_archived_category ["isArchived", "category"]`.

### Logging

`logActivity(ctx, entry)` helper in `convex/activityLog.ts`:

- Reads appSettings key `activityLogPaused` first; no-ops while paused (the pause feature)
- Resolves actor from `ctx.auth` (name from JWT claims, users row by clerkId) unless the caller passes `actorName`
- Never throws; logging failure cannot break the host mutation

Instrumented choke points (all V8 mutations, direct helper call):

- `emails/queries.insertEmailLog`: every email send attempt (covers broadcasts, welcome, digests, reports, spam notifications, test emails that log)
- `stories.submit` / `stories.submitAnonymous`: new submissions
- `stories.updateStatus`, `hideStory`, `showStory`, `deleteStory`: moderation
- `spamCheck.markAsSpam`, `unmarkSpam`, `bulkMarkAsSpam`, `bulkHide`, `bulkDelete`, `startBatchScan`: spam
- `judgingGroups.createGroup`, `updateGroup`, `deleteGroup`: judging
- `judgeScores.submitScore`: scoring (actor is the judge name from the session)
- `adminAccess.grantAccess`, `revokeAccess`: access
- `settings.update`, `settings.toggleEmails`: settings

### Access

Two new permission keys in `PERMISSION_KEYS`: `activity.view`, `activity.manage`. Full admins get both automatically via `getMyAdminAccess`. AccessManagement gets an Activity section card so the keys are grantable. Tab renders for `activity.view`; pause, clear, archive, delete need `activity.manage`.

### API (convex/activityLog.ts)

- `listActivity`: paginated, filters by category and archived view, asc or desc by creation time (activity.view)
- `getStatus`: paused flag (activity.view)
- `setPaused`: toggle pause (activity.manage)
- `bulkArchive` / `bulkUnarchive` / `bulkDelete`: selected ids (activity.manage)
- `clearLog`: batched delete of the current view, 500 per call, frontend loops until done (activity.manage)
- `exportActivity`: up to 5000 rows for client side CSV download (activity.view)

### UI (src/components/admin/ActivityLog.tsx)

New Activity tab in AdminDashboard. Toolbar: category pills, Active or Archived view toggle, newest or oldest sort, pause or resume button with paused banner, Export CSV, Clear log (two step confirm). Rows: checkbox, category icon badge, message, actor, relative time, expandable detail (action key, target, metadata JSON). Select all over loaded rows, bulk bar with Archive or Unarchive and Delete (confirm). Load more pagination. Site design system, no browser dialogs.

## Files to change

- `convex/schema.ts`: activityLog table
- `convex/activityLog.ts` (new): helper plus API
- `convex/adminAccess.ts`: new permission keys, grant and revoke logging
- `convex/emails/queries.ts`, `convex/stories.ts`, `convex/spamCheck.ts`, `convex/judgingGroups.ts`, `convex/judgeScores.ts`, `convex/settings.ts`: logging calls
- `src/components/admin/ActivityLog.tsx` (new)
- `src/components/admin/AdminDashboard.tsx`: tab
- `src/components/admin/AccessManagement.tsx`: Activity section

## Edge cases

- Paused: inserts skipped entirely; UI shows a paused banner so admins know why entries stop
- Background actions (email sends from crons, spam auto scans) have no auth identity: actorName "System"
- Judge scoring uses session based judges, not Clerk auth: actor comes from the judge record name
- Bulk ops log one entry with a count, not one per row
- clearLog only touches the current view (active or archived) so archived history survives a clear unless cleared from the archived view
- logActivity is wrapped in try catch so a logging failure can never fail a submission or email send

## Verification

- convex tsc clean, convex dev push green
- Frontend tsc clean on touched files, zero lints
- Manual: submit a story, send a test email, mark spam, grant access, confirm rows appear; pause and confirm rows stop; archive, delete, clear, export CSV

## Task completion log

- 2026-08-10 06:05 UTC: PRD created, implementation started.
- 2026-08-10 06:20 UTC: Shipped. Schema table + activityLog module + 8 instrumented backend files + Activity tab + Access section. Verified: convex codegen and tsc clean, convex dev push green, app tsc clean on touched files, zero lints.
