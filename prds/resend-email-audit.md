# Resend email system audit and fixes

Created: 2026-08-11 01:15 UTC
Last Updated: 2026-08-11 01:25 UTC
Status: Done

## Problem

Before enabling email in the admin dashboard, the full Resend email system (global toggle, 14 per type toggles, broadcasts, digests, judging group emails, unsubscribe flows, webhook status sync) needed a pass to confirm everything works end to end against the Resend docs and the @convex-dev/resend component docs.

## Audit summary

What works:

- All production sends route through one choke point, `internal.emails.resend.sendEmail`, which enforces the global `emailsEnabled` kill switch and per type `emailTypeEnabled:<type>` toggles, then logs to `emailLogs`.
- The Resend component is configured correctly in `convex/sendEmails.ts` (testMode false, `onEmailEvent` wired to `emails/queries.handleEmailEvent`) and the `/resend-webhook` POST route exists in `convex/http.ts`. Delivery, bounce, complaint, and open events sync back to `emailLogs`.
- Admin UI (`EmailManagement.tsx`) reads and writes the same `appSettings` keys the backend enforces. Per type defaults match `EMAIL_TYPE_DEFAULTS` (submission_confirmation, submission_admin_alert, results_live, judging_group default off).
- Daily engagement and weekly digest respect per user `unsubscribedAt` and granular prefs. Judging group emails double check toggles at queue time and send time, cap at 200 recipients per 24h, and cancel cleanly.
- `headers` array format for List-Unsubscribe matches the component's `SendEmailOptions` type.

## Root causes of the bugs found

1. Frozen cron date: `crons.cron("process daily engagement", ...)` passed `{ date: new Date().toISOString().split("T")[0] }`. Cron args are evaluated once at deploy time, so the engagement processor was pinned to the deploy date forever. `sendDailyUserEmails` computes today at run time, so the send step found no summaries.
2. Unsubscribe links never rendered: six templates in `convex/emails/templates.ts` contained `${args.unsubscribeToken ? ` ` : ""}`, which renders a single space instead of a link. Tokens were generated and passed but never visible to recipients.
3. `vibeapps.dev/api/unsubscribe` never reached Convex: `public/_redirects` had no proxy rule for `/api/unsubscribe`, so the SPA catch all served index.html. Both the email footer link and the List-Unsubscribe header point at this URL.
4. One click unsubscribe incomplete: the List-Unsubscribe-Post header advertises RFC 8058 one click, but `convex/http.ts` only had a GET handler. Mail providers send a POST.

## Fixes in this change

- `convex/crons.ts`: pass `{}` to `processUserEngagement`; the action now computes the date at run time.
- `convex/emails/daily.ts`: `processUserEngagement` takes `date: v.optional(v.string())` and defaults to the current UTC date inside the handler.
- `convex/emails/templates.ts`: the six no op token expressions now render a real `https://vibeapps.dev/api/unsubscribe?token=...` link.
- `public/_redirects`: proxy `/api/unsubscribe` to the Convex site domain ahead of the SPA catch all.
- `convex/http.ts`: added POST `/api/unsubscribe` for RFC 8058 one click unsubscribe.
- `convex/emails/unsubscribe.ts`: cleaned up the always false `marketingEmails` ternary.

## Must do before enabling email in prod (manual, not code)

1. Set `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` on the production Convex deployment. The dev deployment (acoustic-goldfinch-461) has both; the prod deployment checked (clean-robin-557) has neither.
2. Add the prod webhook endpoint `https://<prod>.convex.site/resend-webhook` in the Resend dashboard with events email.sent, delivered, bounced, complained, opened.
3. Confirm which Convex deployment production Netlify actually points at. `public/_redirects` proxies to `acoustic-goldfinch-461.convex.site` (the dev deployment in .env.local), while the commented deploy key references `whimsical-dalmatian-205`. Unsubscribe tokens live in the database of the deployment that sent the email, so the `_redirects` host must match the sending deployment.

## Known gaps left as is (documented, not bugs blocking enable)

- `api.sendEmails.sendTestEmail` bypasses the kill switch, type toggles, and emailLogs. Reasonable for a test button, but be aware it sends even when emails are disabled.
- `message_notification` and `mention_notification` toggles exist in the admin UI but no live sender uses them (mentions ride inside the daily engagement digest; `sendMentionNotifications` is deprecated and never called).
- Broadcasts skip users with `unsubscribedAt` but ignore the `marketingEmails` preference. The profile UI only exposes unsubscribe all / resubscribe, not granular prefs, so this matches the current product surface.
- Welcome, submission confirmation, spam notification, and results live emails do not check per user `unsubscribedAt` (transactional by design; global and per type toggles still apply).
- `emailSettings.timezone` is stored but crons run at fixed UTC offsets.
- Some template interpolations (story titles, spam reasons, broadcast content) are not HTML escaped; content is admin or platform controlled today.

## Files changed

- convex/crons.ts
- convex/emails/daily.ts
- convex/emails/templates.ts
- convex/emails/unsubscribe.ts
- convex/http.ts
- public/\_redirects

## Verification steps

- `npx tsc -p tsconfig.json --noEmit` and convex codegen/typecheck via `npx convex dev --once`
- Confirm cron arg validator accepts `{}` (optional date)
- Grep confirms no remaining `? \` \` : ""` no op token expressions
- Manual: send test email from admin, toggle a type off and confirm skip log, GET and POST the unsubscribe URL with a fresh token

## Task completion log

- 2026-08-11 01:15 UTC: audit complete, PRD created, fixes started
- 2026-08-11 01:25 UTC: all six fixes applied, convex push green, app tsc clean on touched files, zero lints, docs synced (TASK.MD, changelog.md, files.md)
- 2026-08-11 01:50 UTC: follow-up check. docs.convex.dev/llms.txt has no new Resend or email guidance; @convex-dev/resend 0.2.6 is latest. Insights OCC warnings are internal @convex-dev/workpool retries (pendingCompletion, runStatus, pendingStart) from parallel job completion, auto-retried, tiny counts, no app fix needed. Optional later: workpool 0.3.2 to 0.4.x upgrade.
