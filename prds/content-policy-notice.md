# Content policy notice

Created: 2026-09-23 16:47 UTC
Last Updated: 2026-09-23 17:05 UTC
Status: Done

## Problem

Users have no visible rule about what content is allowed. Admins want one editable notice ("admins and moderators can hide or remove content, no NSFW or adult content") shown in the About modal and right above every submit button, so people see it before they post.

## Proposed solution

- Three optional fields on the `settings` doc: `showContentPolicy`, `contentPolicyText`, `contentPolicyUrl`.
- Defaults in `DEFAULT_SETTINGS` (enabled, default text) so the notice shows after deploy with no migration.
- `settings.update` trims the text, caps it at 1000 characters, and only accepts `http://` or `https://` URLs.
- Shared `ContentPolicyNotice` component (plain text, `whitespace-pre-line`, `role="note"`, optional "Read the full policy" link) with `form` and `modal` variants.
- Admin Settings gets a Content policy section: toggle, textarea with counter, URL input, live preview.
- Placements: Footer About modal, `StoryForm` (/submit), `JudgingGroupSubmitPage` (/judging/:slug/submit), `DynamicSubmitForm` (/submit/:slug).
- `llms.txt` gets the same rule for agents.

Default text: "Share what you built. Keep it clean. Admins and moderators can hide or remove any app, comment, or profile at any time. NSFW, adult, hateful, or illegal content is not allowed. Neither is spam, malware, or anything that collects user data without consent."

## Files to change

- convex/schema.ts
- convex/settings.ts
- src/components/ContentPolicyNotice.tsx (new)
- src/components/admin/Settings.tsx
- src/components/Footer.tsx
- src/components/StoryForm.tsx
- src/pages/JudgingGroupSubmitPage.tsx
- src/components/DynamicSubmitForm.tsx
- llms.txt

## Edge cases

- Empty text or toggle off: component renders nothing, no empty box.
- Admin clears the text: saved as empty string, notice hidden.
- Clearing the URL: saved as empty string, link hidden.
- Old settings docs without the fields: `get` merges defaults.
- Settings still loading: component renders nothing until data arrives.

## Verification

- `tsc` for app and convex, `npx convex dev --once`.
- Notice renders on all four surfaces; toggling off hides it everywhere live; bad URL is rejected.

## Task completion log

- 2026-09-23 16:47 UTC - PRD written.
- 2026-09-23 17:05 UTC - Shipped. Deviation: instead of editing the static GitHub `llms.txt` pointer, the live `/llms.txt` and `/vibeapps.md` builders read the policy from settings via `listPublicDirectory`, so agents always see the current text. Also added a max height and scroll to the About modal. Verified typecheck, lint, dev push, queries, and browser on `/submit`, About modal, judging submit, and admin validation and save.
