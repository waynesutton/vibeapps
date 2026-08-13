# Spam automation agent and marked spam date filter

Created: 2026-08-13 19:00 UTC
Last Updated: 2026-08-13 19:15 UTC
Status: Done

## Problem

Admins must confirm every AI spam verdict by hand, even obvious high-confidence hits, so spam can sit visible on the site until someone opens the admin tab. The auto-scan on new submissions also cannot be turned off. And the new Marked spam review list has no date filter, so cleaning out a specific period means scrolling.

## Proposed solution

### Automation toggles (new card on the AI Spam tab, moderation.moderate to change)

Stored in `appSettings`, enforced server side:

- `spamAutoScanEnabled` (default true): gate inside `autoScanStory` so new-submission scans can be paused without touching the submit mutations.
- `spamAutoMarkEnabled` (default false): when an automatic scan (triggeredBy "auto" only, never manual or batch scans) completes with a spam verdict at or above the threshold, the agent marks the story as spam and hides it in the same transaction.
- `spamAutoMarkConfidence` (default 85, clamped 50 to 100): the threshold.
- `spamAutoMarkNotify` (default true): whether auto-mark sends the in-app alert and reason email, or marks silently for later human review.

New `getSpamAutomation` query (moderation.view) and `setSpamAutomation` mutation (moderation.moderate, logs a settings change to the activity log).

### Auto-mark trail

- New `stories.spamMarkedByAgent` optional boolean, set on auto-mark, cleared on unmark.
- Auto-marks log `spam.autoMarked` activity entries with actor "AI Spam Agent", confidence, and reasons.
- Both the scan results list and the Marked spam review show an AI badge on agent-marked rows. Unmark works exactly the same as for human marks.

### Marked spam date filter

`listMarkedSpam` takes optional `startDate`/`endDate` (ms, inclusive) filtering on `spamMarkedAt` (submission time fallback). The review section gets a DateRangePicker persisted to localStorage like the other two ranges on the tab.

## Files to change

- `convex/schema.ts`: `spamMarkedByAgent` on stories
- `convex/spamCheck.ts`: settings helpers, `getSpamAutomation`, `setSpamAutomation`, gate in `autoScanStory`, auto-mark hook in `saveResult`, `markStoryAsSpam` options (agent actor, notify), date args on `listMarkedSpam`, `spamMarkedByAgent` in both list queries, cleared in `unmarkSpam`
- `src/components/admin/SpamCheck.tsx`: Automation card with three toggles + threshold input, marked date filter, AI badges
- `src/components/admin/AdminDocs.tsx`: AI spam check section rewrite

## Edge cases

- Manual and batch scans never auto-mark, only auto-triggered scans on new submissions, so an admin re-scanning old content cannot mass-hide it by accident.
- Already-marked stories are skipped (markStoryAsSpam is idempotent, no duplicate emails).
- Auto-mark emails still respect the global email kill switch and the spam_notification type toggle.
- Threshold outside 50 to 100 is rejected server side.
- With no AI model key the heuristic scorer still produces verdicts; the same threshold applies.
- Unmark clears the agent flag so a re-marked story reflects who marked it last.

## Verification steps

- convex codegen + tsc green, zero lints
- Toggles persist and are enforced server side (settings read at scan/save time, not cached)
- Auto-mark fires only on auto scans at/above threshold; activity log entry appears
- Marked review date filter narrows list; AI badge shows on agent-marked rows

## Task completion log

- 2026-08-13 19:00 UTC: PRD created, implementation started
- 2026-08-13 19:15 UTC: Shipped. Automation card with three toggles + threshold live on the AI Spam tab, auto-mark hook in saveResult (auto scans only), spamMarkedByAgent trail with badges, marked-date filter on the review list, Admin Docs rewritten. Convex codegen green, app tsc zero errors in touched files, zero lints. Docs synced.
