# Unified email footer, unsubscribe fix, and spam review alerts

## Problem

Three related email issues shipped together:

1. Production unsubscribe links land on the "Unsubscribe Link Expired" page. The Netlify proxy for `/api/unsubscribe` in `public/_redirects` points at the dev Convex deployment (`acoustic-goldfinch-461.convex.site`), while production emails write tokens to the prod deployment (`whimsical-dalmatian-205.convex.site`). Token lookup misses, so every click looks expired. A Gmail one-click POST consuming a token before a user GET also renders the expired page even when the user is already unsubscribed.
2. The legal footer is copy-pasted across `convex/emails/templates.ts` (14 times), submission emails hardcode a `/profile` link that is not a real SPA route, and the judging group and spam email shells have no preferences or unsubscribe links at all.
3. When a submitter uses Request review on a spam mark, admins only find out by checking the Activity log or the spam tab. No email, no in-app alert, no tab-level count.

## Solution

### 1. Unsubscribe works in production

- `public/_redirects`: point `/api/unsubscribe` at `https://whimsical-dalmatian-205.convex.site/api/unsubscribe`, matching the robots/sitemap proxies in the same file.
- `convex/emails/unsubscribe.ts` `handleUnsubscribeToken` becomes idempotent: a consumed token whose owner already turned off the emails that token covers returns `{ success: true }`. Unknown tokens and truly expired (never consumed) tokens still fail.
- GET and POST routes in `convex/http.ts` stay as they are (Resend requires GET to show a page and POST to return 200).

### 2. One shared footer for every send path

New helpers in `convex/emails/render.ts` (shared by backend sends and the admin preview):

- `emailPreferencesUrl({ userId, username })`: `https://vibeapps.dev/{username}#email-preferences` when the username is known, `/set-username` for account holders without one, and `/sign-in?redirect_url=` with a relative path for recipients with no account context. Never `/profile`.
- `standardEmailFooter({ userId, username, unsubscribeToken })`: contact link (GitHub issues), clickable Manage email preferences and Unsubscribe links, "VibeApps is an open-source project maintained by WayneSutton.ai" linking to `https://waynesutton.ai/`, the Convex CAN-SPAM address, and the existing social line.

Wired into:

- Every generator in `convex/emails/templates.ts`
- `templateEmailShell` in `convex/emails/render.ts` (judging group sends plus both admin previews)
- `convex/emails/submissions.ts` (confirmation, organizer alert, results-live)
- `convex/emails/spam.ts` (spam notification now carries a token and List-Unsubscribe header)
- `convex/emails/judgingGroupEmails.ts`: recipients are `{ name, email }`, so the delivery action looks the user up by email (new `by_email` index on `users`), generates a token when found, and passes it through to `sendEmail`.

### 3. Preferences link lands on the right card

- `id="email-preferences"` on the Email Preferences card in `src/pages/UserProfilePage.tsx`, with a hash-driven scroll (and section auto-open) when the URL contains `#email-preferences`.
- No `/profile` SPA route. `/:username` stays the last Layout child in `App.tsx`, so profile links, story OG images, and crawler meta are untouched.

### 4. Spam review requests reach admins

- New email type `spam_review_request` in `convex/emails/emailTypes.ts`, the `emailLogs` schema union, and the admin Email Send Options card ("Spam review requests", default on, behind the global master switch).
- New alert type `spam_review` in the `alerts` schema union, `convex/alerts.ts`, the header dropdown, and the notifications page. Links go to `/admin?tab=spam`.
- `requestSpamReview` in `convex/spamCheck.ts` (first request only, still idempotent): creates in-app alerts for the admin/manager IDs from `getAdminUserIds`, then schedules `internal.emails.spam.sendSpamReviewRequestEmails`.
- The email includes story title, submitter, spam reason, auto-mark flag, and a CTA to `/admin?tab=spam`, with the unified footer and an unsubscribe token. Admins with `emailSettings.unsubscribedAt` are skipped.
- Spam tab: a "review requested" count chip on the marked-spam section filters the list to disputed rows, reusing the existing CountPill pattern and amber styling.

## Out of scope

- Granular per-type toggles on the profile Email Preferences card
- Resend Audiences / `{{{RESEND_UNSUBSCRIBE_URL}}}`
- CSPRNG token rewrite (security backlog)
- Site `Footer.tsx` changes (already links WayneSutton.ai)
- A `/profile` SPA route (would collide with `/:username`)

## Verification

1. Deploy Netlify (`public/_redirects`) and Convex prod code.
2. Click an old prod unsubscribe URL: it should succeed (the prod token was never consumed while the proxy pointed at dev).
3. Send one fresh test email from admin; click Unsubscribe and Manage email preferences.
4. Confirm the profile Email Preferences card shows "Currently unsubscribed from all emails".
5. Mark a test submission as spam, request a review as the submitter, and confirm the admin alert, email, and spam tab count chip.
