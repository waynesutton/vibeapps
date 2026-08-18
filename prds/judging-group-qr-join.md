# Judging group QR join flow

Created: 2026-08-18 04:05 UTC
Last Updated: 2026-08-18 04:20 UTC
Status: Done

## Problem

Each judging group can enable its own custom submission page at
`/judging/:slug/submit`, configured in the admin workspace under the Submit page
section. Organizers share that page as a URL only. At a live event there is no
way to put a scannable code on a screen, badge, or printed sign so attendees can
join the group and submit.

Two gaps block that:

1. **No QR code anywhere in the app.** Admins can copy the submit URL from the
   Shareable links section, but they cannot produce a scannable image.
2. **Sign in loses the destination.** On the group submit page, a signed-out
   visitor sees links to `/sign-in` and `/sign-up` with no return URL. After
   authenticating, Clerk drops them on the homepage, so they never reach the
   form they scanned for. This makes a QR pointed at the submit page unreliable
   for anyone who is not already signed in, which is most attendees.

## Root cause

`src/pages/JudgingGroupSubmitPage.tsx` renders plain `<Link to="/sign-in">` and
`<Link to="/sign-up">`. Nothing carries the current group path through the auth
round trip. `src/pages/SignInPage.tsx` and `src/pages/SignUpPage.tsx` mount
Clerk's `<SignIn>` / `<SignUp>` with no redirect props, so Clerk falls back to
its default post-auth destination.

## Proposed solution

Add a dedicated join page per group plus an inline QR code in the admin links
ledger.

### Join page: `/judging/:slug/join`

A lightweight landing page that exists to survive a QR scan on a phone.

- Reads the existing public `api.judgingGroups.getSubmissionPage` query. No new
  Convex function and no new data exposure.
- Signed in: redirect straight to `/judging/:slug/submit`.
- Signed out: show group name, header image, and description, then Sign in and
  Sign up buttons that carry `redirect_url=/judging/:slug/submit`.
- Group with no custom submission page enabled, or unknown slug: not found
  state, matching the submit page.
- The submission page password gate is unchanged. It still lives on the submit
  page and still applies after auth.

### Safe redirect handling

`SignInPage` and `SignUpPage` read a `redirect_url` search param and pass it to
Clerk as `forceRedirectUrl` / `signUpForceRedirectUrl`.

Only same-origin relative paths are accepted. A shared `sanitizeRedirectPath`
helper rejects anything that is not a single-slash-prefixed path, which blocks
open redirects via `//evil.com`, `https://evil.com`, and backslash variants.
When the param is absent or rejected, the prop is `undefined` and Clerk keeps
its current default behavior.

### Admin QR in Shareable links

In `src/components/admin/judging/GroupLinksSection.tsx`:

- Add a "Participant join link" entry to the links ledger and the markdown /
  `.md` export, so Copy all includes it.
- Render an inline QR card below the ledger when the group has a custom
  submission page enabled. Card shows the QR, the join URL, and actions to copy
  the link, download PNG, and download SVG.
- QR renders client side from the slug with `qrcode.react`. Deterministic from
  the URL, so nothing is stored and it can never go stale.

## Files to change

| File | Change |
|------|--------|
| `package.json` | Add `qrcode.react` |
| `src/lib/redirectPath.ts` | New: `sanitizeRedirectPath` open-redirect guard |
| `src/pages/JudgingGroupJoinPage.tsx` | New: join landing page |
| `src/pages/SignInPage.tsx` | Honor sanitized `redirect_url` |
| `src/pages/SignUpPage.tsx` | Honor sanitized `redirect_url` |
| `src/pages/JudgingGroupSubmitPage.tsx` | Sign in / sign up links return to this form |
| `src/App.tsx` | Register `/judging/:slug/join` |
| `src/components/admin/judging/GroupLinksSection.tsx` | Join link entry plus inline QR card |

## Edge cases

- Unknown slug or disabled submission page: not found state, no QR shown in
  admin.
- Password-protected group: QR still works; scanner authenticates, then hits the
  existing password gate. No password is embedded in the QR.
- Clipboard blocked: the URL stays visible for manual copy and the download
  buttons still work.
- Open redirect: `redirect_url` is restricted to internal paths.
- Already signed in: join page redirects with `replace` so Back does not bounce
  the user through the join screen.
- Admin renames the group slug: QR is derived from the live slug, so it updates
  immediately. Codes printed against the old slug stop working, which matches
  how the existing share links behave.

## Verification steps

1. `npx tsc --noEmit -p tsconfig.app.json` clean.
2. `npm run lint` no new errors.
3. Signed out, open `/judging/<slug>/join`: group branding renders, Sign in
   goes to `/sign-in?redirect_url=/judging/<slug>/submit`, and completing sign
   in lands on the submit form.
4. Signed in, open `/judging/<slug>/join`: immediate redirect to the submit
   form.
5. Admin group workspace, Links section: QR renders, copy link copies the join
   URL, PNG and SVG download and scan correctly.
6. Group with the custom submission page disabled: no QR card, existing hint
   text still shown.

## Task completion log

- 2026-08-18 04:05 UTC: PRD written, scope confirmed with requester (judging
  groups only, dedicated join page, password gate unchanged, inline QR in the
  links section).
- 2026-08-18 04:20 UTC: Implemented. No Convex or schema change was needed; the
  join page reuses the existing public `getSubmissionPage` query.
  - Typecheck: zero errors in every touched file. Remaining project errors are
    pre-existing in files this work did not touch.
  - Lint: clean on all touched files.
  - Build: `npm run build` succeeds with `qrcode.react` bundled.
  - Browser: on the dev server, `/judging/<bogus>/join` renders the not-found
    state, `/judging/<bogus>/submit` is unchanged, and
    `/sign-in?redirect_url=...` mounts Clerk with no console errors.
  - Not verified locally, needs a real group plus admin auth: the admin QR card
    render and the full signed-out to submitted round trip.
