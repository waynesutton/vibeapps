# Judging group emails to submission owners

Created: 2026-08-12 04:28 UTC
Last Updated: 2026-08-12 04:32 UTC
Status: Done

## Problem

The judging group Emails section can only email judges. Organizers with `judging.emails` access also need to email the submission owners in that group (deadline reminders, results notes, clarifications) from the same compose UI.

## Root cause

`GroupEmailsSection` and `judgingGroupEmails` only resolve recipients from the `judges` table. Submission owners already exist via `judgingGroupSubmissions` → `stories` (account email preferred), but that path is only used by the fixed results-live blast.

## Proposed solution

1. Add a recipient audience control at the top of the Emails compose card: Judges or Submission owners (SimpleSelect, matches existing UI).
2. Backend: collect unique submission owners for the group (same rules as results-live: skip hidden/rejected, prefer author account email, dedupe by lowercased email). Expose them via a new list query keyed by `storyId`.
3. Extend `sendGroupEmail` with `recipientType` (`judges` | `submission_owners`) and optional `storyIds`. Judges path stays unchanged (`judgeIds` required when type is judges).
4. Reuse email type `judging_group`, daily cap, scheduling, templates, preview, and test send. Stamp `recipientType` in send metadata for recent-send context.
5. UI copy updates with the selected audience (title, recipient labels, confirm dialog, send button).

## Files to change

- `convex/emails/judgingGroupEmails.ts`
- `src/components/admin/judging/GroupEmailsSection.tsx`
- `prds/judging-group-email-submission-owners.md`
- `TASK.MD`, `changelog.MD`, `files.MD`

## Edge cases

- No owners with email: empty state, send disabled.
- Same person owns multiple submissions: one recipient row (first storyId wins for selection).
- Switching audience clears exclusion set and preview selection.
- Spam-hidden / rejected stories stay excluded.
- Delegated users still gated by `judging.emails` on the group.
- Scheduled sends resolve recipients at schedule time (unchanged).

## Verification steps

1. Convex push / typecheck and app tsc on touched files.
2. Emails section: switch to Submission owners, see owners from group submissions with emails.
3. Preview / test send still work; real send queues `judging_group` logs with metadata.recipientType.
4. Judges path unchanged when audience is Judges.

## Task completion log

- 2026-08-12 04:28 UTC PRD created, implementation started.
- 2026-08-12 04:32 UTC Implemented. Convex codegen green, touched-file tsc clean, zero lints. Docs synced.
