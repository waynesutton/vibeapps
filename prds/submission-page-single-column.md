# Custom submission page single column layout

Created: 2026-08-08 19:05 UTC
Last Updated: 2026-08-08 19:05 UTC
Status: Done

## Problem

The judging group custom submission page (`/judging/:slug/submit`) only supports two side-by-side layouts: two column (50/50) and one third (33/67). There was no focused single column option, and the long submission form read as one flat wall of fields with no visual grouping.

## Proposed solution

Add a third admin-selectable layout, "single", and render it as a centered single column page:

- Centered hero at the top: header image (square, capped at the configured size, full width on small screens), page title, description, and page links rendered as pill buttons.
- The submission form card sits directly below the hero in a `max-w-2xl` column with generous vertical padding.
- The form card is extracted into a shared `formCard` JSX value so all three layouts render identical form behavior (success state, sign-in notice, form).
- Form polish that applies to every layout: hairline section headings (Project details, Links and media, About you, Tags), slightly looser field rhythm (`space-y-5`), the Selected Tags summary matches the muted card style of the team block, and a taller submit button.

Existing two-column and one-third layouts are untouched. Groups without a saved layout keep defaulting to two-column.

## Files changed

- `convex/schema.ts`: added `single` literal to `submissionPageLayout` union
- `convex/judgingGroups.ts`: added `single` to the three layout validators (updateGroup args, getGroupDetails return, getSubmissionPage return)
- `src/components/admin/judging/GroupSubmitPageSection.tsx`: "Single column" option in the layout picker
- `src/components/admin/EditJudgingGroupModal.tsx`: "Single Column" option in the legacy layout select
- `src/pages/JudgingGroupSubmitPage.tsx`: single column layout branch, shared form card, section headings, form rhythm polish, `-readonly` fix on the requirements mapped type

## Edge cases

- Groups saved before this change have no `single` value stored; the frontend default remains two-column.
- Header image in single column scales down on narrow screens (`width: 100%`, `maxWidth: imageSize`, square aspect) instead of the fixed pixel square used in side-by-side layouts.
- No image, no description, or no links: the hero collapses gracefully since each piece renders conditionally.
- Password gate, sign-in gate, and success redirect are shared by all layouts through the extracted form card.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`: no errors in any touched file (remaining repo errors pre-existing).
- No linter errors in touched files.
- Convex dev push succeeded ("Convex functions ready!") with the widened schema union.

## Task completion log

- 2026-08-08 19:05 UTC: Schema + validators widened, admin pickers updated, single column layout and form section polish shipped, docs synced.
