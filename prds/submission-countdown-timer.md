# Submission page countdown timer

Created: 2026-09-22 04:30 UTC
Last Updated: 2026-09-22 04:50 UTC
Status: Done

## Problem

Hackathon organizers have no way to show participants when submissions
close. The Convex All Gas Hackathon (sponsored by OpenAI, Firecrawl, and
AgentMail) ends September 22 at 12:00 PM PT, and participants around the
world read that deadline in different time zones. The custom submission
page (`/judging/<slug>/submit`) should show a live countdown plus the
deadline rendered in each visitor's own local time.

## Proposed solution

Add a per-group countdown to the Custom submission page settings in the
judging group admin. Admins pick a deadline (entered in their own local
time, stored as an absolute timestamp), a size (large or compact), a
placement (top of page or above the form card), and an optional label.

The public page renders a `CountdownTimer` that ticks every second and
shows days, hours, minutes, and seconds remaining plus the deadline
formatted with `Intl.DateTimeFormat` in the visitor's time zone with a
short zone name (for example `Tue, Sep 22, 12:00 PM PDT`). After the
deadline it shows "Deadline passed" with the same deadline text. The form
stays usable either way; this feature is display only.

No new dependency. The flip clock package the request linked is heavier
than needed and does not match the site theme; the timer uses the theme
tokens (`text-ink`, `text-faint`, `border-hairline`) and `tabular-nums`.

## Files to change

- `convex/schema.ts`: five optional fields on `judgingGroups`
- `convex/judgingGroups.ts`: `updateGroup` args, `getGroupWithDetails` and
  `getSubmissionPage` return validators and handlers
- `src/components/CountdownTimer.tsx`: new shared component
- `src/components/admin/judging/groupSection.tsx`: `datetime-local`
  helpers next to the existing date helpers
- `src/components/admin/judging/GroupSubmitPageSection.tsx`: Countdown
  timer block with live preview, saved with the rest of the page
- `src/pages/JudgingGroupSubmitPage.tsx`: render at top or above the form
  for every layout

## Edge cases

- Deadline in the past: render the "Deadline passed" state, never negative
  numbers
- Admin enables the timer without a deadline: save is blocked with an
  inline error
- Admin in one time zone, visitor in another: the stored value is an
  absolute epoch ms so both see the same instant in their own zone
- Password gated pages: timer renders only after the gate, like the rest
  of the page
- Success state after submit: the form placement timer hides with the
  form title; the top placement stays
- Screen readers: the container uses `role="timer"` with a summary
  `aria-label`, and the ticking digits are `aria-hidden` so nothing is
  announced every second

## Verification

- `npx tsc -p convex` clean
- `npm run typecheck` clean
- `npm run build` (the Netlify command) passes
- `npx convex dev --once` deploys the schema to dev
- Manual: enable on a dev group, set Sep 22 12:00 PM local, confirm the
  public page shows the countdown and deadline, toggle size and placement

## Task completion log

- 2026-09-22 04:30 UTC - PRD written, implementation started
- 2026-09-22 04:50 UTC - Done. Schema, `updateGroup`, `getGroupWithDetails`,
  and `getSubmissionPage` carry the five `submissionCountdown*` fields.
  `src/lib/countdown.ts` holds the pure helpers, `CountdownTimer.tsx` renders
  large and compact variants, admin controls plus live preview live in
  `GroupSubmitPageSection.tsx`, and `JudgingGroupSubmitPage.tsx` renders top
  or above-form placement. Verified: app and convex tsc zero errors, eslint 0
  errors on touched files, `npm run build` green, dev deploy pushed, both
  variants checked in the browser against a seeded Sep 22 12:00 PM PDT
  deadline. Compact variant wrap fixed so the deadline line carries its own
  "Deadline" label instead of an orphaned separator. Temporary seed mutation
  deleted and dev test data cleared.
