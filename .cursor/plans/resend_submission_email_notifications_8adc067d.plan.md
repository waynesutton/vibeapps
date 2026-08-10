---
name: Resend submission email notifications
overview: "Separate, later plan: add Resend-powered submission emails (submitter confirmation, per-group admin alert, results-live) controlled by toggles in the admin Email dashboard, plus per-email-type toggles for every existing email send option. All toggles are subordinate to the global email master switch: when it is off, nothing sends. Not to be built yet."
todos: []
isProject: false
---

# Resend updates and email on submit (deferred)

Do not build yet. This is the follow-up to the hackathon skill plan and is fully independent of it. Everything reuses the existing `@convex-dev/resend` component setup in `convex/sendEmails.ts` and `convex/emails/resend.ts` (from address `alerts@updates.vibeapps.dev`).

## Current state (verified across the app)

- Every email in the app funnels through one action: `convex/emails/resend.ts` `sendEmail`. It already enforces a global kill switch by reading the `appSettings` key `emailsEnabled` via `internal.settings.getBooleanInternal` and returning early when `false`.
- The admin Email dashboard (`src/components/admin/EmailManagement.tsx`) has exactly one control today: the "Global Email System" master toggle (`api.settings.toggleEmails`, permission `emails.send`, reads via `api.settings.getBoolean` with key `emailsEnabled`). There are no per-type toggles.
- The `emailType` union in `sendEmail` covers 10 types and their triggers are:
  - `daily_admin` — cron 9:00 AM PST (`convex/emails/daily.ts`, `convex/crons.ts`)
  - `daily_engagement` — crons 5:30/6:00 PM PST (`convex/emails/daily.ts`)
  - `weekly_digest` — cron Monday 9:00 AM PST (`convex/emails/weekly.ts`)
  - `welcome` — on user creation (`convex/users.ts` → `convex/emails/welcome.ts`)
  - `mention_notification` — on mentions (`convex/emails/mentions.ts`)
  - `message_notification` — DM notifications (declared in the union)
  - `admin_broadcast` — manual admin sends (`convex/emails/broadcast.ts`)
  - `admin_report_notification` — content reports (`convex/alerts.ts` → `convex/emails/reports.ts`)
  - `admin_user_report_notification` — user reports (`convex/alerts.ts`, `convex/dm.ts` → `convex/emails/reports.ts`)
  - `spam_notification` — AI spam marks (`convex/spamCheck.ts` → `convex/emails/spam.ts`)
- Per-user preferences live in `convex/emailSettings.ts` (`emailSettings` table) and unsubscribe handling in `convex/emails/unsubscribe.ts`. Those are user-level and stay unchanged; this plan is about admin-level send controls.
- No email is sent when a story is submitted today. New submissions only appear as a count in the daily admin email. `stories.submit` already collects an optional `email` on the story, so the recipient exists for most judging group submissions.
- Existing template helpers live in `convex/emails/templates.ts`; the spam-mark email in `convex/emails/spam.ts` is a good pattern to copy (internalAction scheduled from a mutation).

## 1. Per-email-type toggles (backend)

Give every email send option its own on/off switch, stored in the existing `appSettings` table and enforced in one place.

- Key convention: `emailTypeEnabled:{emailType}` with `valueBoolean` (e.g. `emailTypeEnabled:welcome`, `emailTypeEnabled:admin_broadcast`). Reuses the existing `by_key` index; no schema change needed for toggles.
- Defaults defined in a single `EMAIL_TYPE_DEFAULTS` map in `convex/emails/resend.ts` (or a small shared module): all 10 existing types default `true` (no behavior change on ship); the 3 new submission types (section 3) default `false`.
- Central enforcement in `sendEmail` (`convex/emails/resend.ts`), immediately after the existing global check:
  1. If `emailsEnabled === false` → skip (unchanged; master switch always wins).
  2. Else read `emailTypeEnabled:{args.emailType}`; `null` falls back to the default map; `false` → skip and return `{ success: false, error: "Email type disabled" }` without logging a send.
- Because every sender already routes through `sendEmail`, no per-trigger changes are needed for existing types. Crons still run, but their sends no-op when their type is toggled off.
- New settings functions in `convex/settings.ts`:
  - `getEmailTypeSettings` (public query, permission `emails.view` or `settings.view`): returns a record of all email types → effective boolean (stored value or default), so the dashboard renders in one query.
  - `setEmailTypeEnabled` (public mutation, permission `emails.send`): args `{ emailType, enabled }` validated against the union; writes the `appSettings` row and logs via `logActivity` (`settings.emailTypeToggled`).

## 2. Admin Email dashboard UI

Extend `src/components/admin/EmailManagement.tsx` with a new "Email Send Options" card directly under the existing "Email System Control" card.

- One toggle row per email type, grouped: Automated (daily admin, daily engagement, weekly digest), User (welcome, mentions, messages), Admin (broadcast, report notifications, user report notifications, spam notifications), Submissions (the 3 new types from section 3). Each row shows the type name, a one-line description of when it sends, and the same green/red toggle style as the master switch.
- Master-switch dependency: when `emailsEnabled` is off, all per-type toggles render disabled (greyed out, not interactive) with a notice that the global email system is off. Toggle states are preserved, only ineffective. Backend enforcement in section 1 guarantees this even if the UI is bypassed.
- Uses the new `getEmailTypeSettings` query and `setEmailTypeEnabled` mutation; optimistic-feeling UX matches the existing toggle (spinner while pending, success flash, site dialog components for errors — never browser defaults).
- Update the static "Automated Email Types" info card to reflect toggle state instead of implying everything always sends.

## 3. Submission confirmation email (submitter)

- New `convex/emails/submissions.ts` with `sendSubmissionConfirmationEmail` internalAction: story title, event/group name, status ("received, pending review"), link to the story or group page, and what happens next. New `emailType: "submission_confirmation"` added to the union, default toggle `false`.
- Trigger: schedule from `stories.submit` (after successful insert) only when `args.email` is present. Gating happens centrally in `sendEmail` (master switch + `emailTypeEnabled:submission_confirmation`), so the trigger itself stays simple.
- Idempotency: schedule once per story insert; no retries that could double-send.

## 4. Per-group admin alert (optional)

- `sendNewSubmissionAdminAlert` in the same file, `emailType: "submission_admin_alert"`, default toggle `false`: notify group organizers when a submission lands in their group.
- Recipients: a `notificationEmails: v.optional(v.array(v.string()))` field on `judgingGroups`, editable in the admin group settings UI (`src/components/admin/judging/GroupSettingsSection.tsx`). The per-group list defines who receives it; the dashboard toggle defines whether the type sends at all. No per-group on/off toggle needed — dashboard toggle plus an empty recipient list both mean nothing sends.
- Keep it off by default to avoid noise; the daily digest remains the default channel.

## 5. Results-live email

- `sendResultsLiveEmail`, `emailType: "results_live"`, default toggle `false`: when an admin flips `resultsIsPublic` on a group (in `convex/judgingGroups.ts` `updateGroup`), offer a one-click "email all submitters" action (explicit admin button, not automatic) that emails every story in the group that has an `email`, with the public results URL.
- The admin button is disabled in the UI when the master switch or the `results_live` toggle is off, with a hint linking to the Email dashboard.
- De-dupe recipients across multiple submissions and record sends in the existing email log tables so the Resend webhook status tracking applies.

## 6. Schema changes

- `emailType` union in `convex/emails/resend.ts` and `emailLogs` schema: add `submission_confirmation`, `submission_admin_alert`, `results_live`.
- `judgingGroups`: add `notificationEmails: v.optional(v.array(v.string()))` (recipients for admin alerts). The previously planned `submissionEmailsEnabled` per-group boolean is dropped — replaced by the dashboard toggle.
- `appSettings`: no schema change; new `emailTypeEnabled:*` keys use the existing `key`/`valueBoolean` shape.

## 7. Hardening that should ride along

- Add Svix signature verification to `POST /resend-webhook` in `convex/http.ts` (it currently accepts unauthenticated posts that mutate email log status). Same pattern as the `/clerk` webhook handler.
- Respect existing unsubscribe: include the standard unsubscribe footer/token used by other emails so `/api/unsubscribe` covers these new types.

## Out of scope

- Changing per-user preferences (`convex/emailSettings.ts`) or the unsubscribe flow beyond footer reuse.
- Mention/report/digest email content changes, broadcast changes, MCP, account linking.
