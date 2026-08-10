# Judging group emails with templates

Created: 2026-08-10 19:45 UTC
Last Updated: 2026-08-10 20:25 UTC
Status: Done

## Problem

Organizers running a judging group have no way to email their judges from inside the app. Judge emails are already collected at registration but never used. Admins also have no reusable email templates: every broadcast is raw HTML typed by hand, with no variables, no markdown, and no signatures.

## Proposed solution

Add a judging group email sender plus a reusable template system.

1. New Emails section inside each judging group workspace at `/admin/judging/:slug?section=emails`. Full admins and delegated users with the new `judging.emails` permission (scoped to their groups) can send there.
2. Recipients are the group judges who registered with an email address, deduplicated by address. Sender picks all or a subset.
3. Sender picks a saved template (or writes from scratch), edits subject and body, picks a reply to address, previews, sends a test to themselves, then sends.
4. New Templates sub tab in the admin Email Management section. Templates have a name, subject, markdown body, and an optional markdown signature. Anyone with `emails.send` manages templates.
5. Template bodies and subjects support variables: `{{firstname}}`, `{{name}}`, `{{email}}`, `{{groupname}}`. Bodies support markdown lite: bold, italic, links, unordered lists, paragraphs. Rendering escapes HTML first so judge supplied names cannot inject markup.
6. New per type toggle `judging_group` in Email Send Options (default off) under a new Judging group. The global `emailsEnabled` master switch still wins. Both are enforced server side in `emails/resend.sendEmail`; the group UI also surfaces the state so senders know why sends are blocked.
7. Every send is logged in `emailLogs` with `emailType: "judging_group"` and metadata (groupId, templateId, sender). The group section shows recent sends for that group.

## Schema changes

- `emailLogs.emailType` union gains `v.literal("judging_group")` (also in `EMAIL_TYPES`, `emailTypeValidator`, `EMAIL_TYPE_DEFAULTS` with default `false`).
- New `emailTemplates` table: `name`, `subject`, `body` (markdown), `signature` (optional markdown), `updatedAt`, `createdBy`, index `by_name`.

## Access control

- New permission key `judging.emails` in `PERMISSION_KEYS`, scoped by `judgingGroupIds` / `allJudgingGroups` like other judging keys via `requireJudgingGroupPermission`.
- Template CRUD requires `emails.send`. Template list is readable with `emails.send` or `judging.emails` so group senders can pick one.
- Send mutation requires `judging.emails` on the specific group.

## Files to change

Backend:

- `convex/emails/emailTypes.ts` add `judging_group` type, validator literal, default off
- `convex/schema.ts` add log literal and `emailTemplates` table
- `convex/adminAccess.ts` add `judging.emails` permission key
- `convex/emails/render.ts` (new) shared pure helpers: escape, markdown lite render, variable substitution, branded email shell
- `convex/emailTemplates.ts` (new) template CRUD
- `convex/emails/judgingGroupEmails.ts` (new) status query, recipients query, recent log query, send mutation, test send mutation, internal delivery action

Frontend:

- `src/components/admin/EmailManagement.tsx` sub tabs (Send and settings / Templates), new toggle row
- `src/components/admin/EmailTemplatesManager.tsx` (new) template list, editor, preview
- `src/components/admin/judging/GroupEmailsSection.tsx` (new) compose and send UI
- `src/pages/AdminJudgingGroupPage.tsx` add Emails sidebar section gated by `judging.emails`
- `src/components/admin/AccessManagement.tsx` add the new key to the Judging card

## Edge cases

- Master email switch off or `judging_group` type off: send mutation throws a clear error; UI shows a banner and disables send.
- Group has no judges with emails: UI shows empty state; mutation rejects empty recipient lists.
- Duplicate judge emails: deduplicated by lowercased address, first name wins.
- Reply to must look like an email when provided; blank means no reply to header.
- Judge names with HTML characters are escaped before markdown rendering.
- Unknown `{{variables}}` are left as typed so typos are visible in the test send.
- Delegated users only see and send for groups in their grant scope.

## Verification steps

1. `npx tsc -p tsconfig.app.json --noEmit` and `npx convex dev --once` typecheck pass.
2. Admin: Email Management shows Send and settings / Templates sub tabs; create, edit, delete a template.
3. Email Send Options shows Judging group emails toggle, default off.
4. Group workspace shows Emails section for full admin; sending while the toggle is off is blocked with a clear message.
5. With the toggle on, test send to self works, then a real send to selected judges logs `judging_group` rows in `emailLogs` and appears in the recent sends list.
6. Delegated user with `judging.emails` scoped to one group sees the section only for that group; users without the key never see it.

## Round two: scheduling, cap, stats, real preview

Added 2026-08-10 20:25 UTC, extending the shipped feature:

- Scheduled sends: optional send time on sendGroupEmail (min one minute out, max 30 days) via ctx.scheduler.runAt, persisted in a new `groupScheduledEmails` table (pending / sent / cancelled) with the scheduled function id stored for cancellation. Scheduled sends card in the compose UI with confirm-gated cancel.
- Daily cap: 200 recipients per group per rolling 24 hours (GROUP_DAILY_RECIPIENT_CAP), counting non-test emailLogs plus pending scheduled recipients, enforced in the send mutation and surfaced as a usage line; send disabled when the selection exceeds what remains.
- Per-send delivery stats: every delivery stamps a sendId in log metadata; listGroupSends groups logs per send with delivered / opened / bounced / failed counts. The Resend webhook now records first opens as metadata.openedAt (status union unchanged).
- Preview as a real judge: picker over selected recipients, defaults to the first.

Round two edge cases:

- Cancelling an already-sent or already-cancelled schedule returns without error (idempotent).
- Scheduled recipients are resolved at schedule time; judges added later are not included.
- Toggles are re-checked at delivery time by the core send action, so turning emails off after scheduling still blocks the send.
- Old log rows without a sendId show as single-recipient sends.

## Task completion log

- 2026-08-10 19:45 UTC PRD created, implementation started.
- 2026-08-10 20:10 UTC All backend and frontend pieces implemented. Convex codegen and push green, app tsc clean on touched files, zero lints, prettier applied. Docs synced (TASK.MD, changelog.MD, files.MD).
- 2026-08-10 20:25 UTC Round two shipped: scheduled sends with cancel, 200/24h per-group cap, per-send delivery stats with webhook open tracking, preview-as-judge picker. Convex push green, tsc and eslint clean, prettier applied, docs synced.
