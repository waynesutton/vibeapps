# Judging submit page: wider single column, 16:9 header image, required tag visibility

Created: 2026-08-13 07:15 UTC
Last Updated: 2026-08-13 07:40 UTC
Status: Done

## Problem

1. The single column layout on the judging group custom submit page (`/judging/:slug/submit`) is capped at `max-w-2xl` (672px). The main submit page with the sidebar hidden uses `max-w-4xl` (896px), so the judging page feels cramped by comparison. The header image is also forced into a 1:1 square crop, so wide hero art gets cropped badly.
2. When a judging group sets a required tag, the tag always renders on the public form: as a locked pill in Selected Tags and as a disabled quick select button when it is a header tag. Organizers who use tracking tags want the option to hide that tag from submitters entirely. The tag's own hidden flag in Tag Management controls story cards and tag limits, so the two settings must not fight each other.

## Proposed solution

### Wider layout and 16:9 header image

- Widen the single column judging submit layout from `max-w-2xl` to `max-w-4xl`, matching the no sidebar submit page.
- New optional field `submissionPageImageAspect` on `judgingGroups`: `"square"` (1:1, default, current behavior) or `"wide"` (16:9).
- Wide images span the full layout width with `aspect-ratio: 16 / 9` in both the single column hero and the two column sidebar. The pixel size slider only applies to the square crop, so it is hidden when wide is selected.
- Admin picker (Square 1:1 / Wide 16:9) in the Header image block of the Custom submission page section.

### Required tag show or hide on the form

- New optional field `submissionFormRequiredTagVisible` on `judgingGroups`. Unset or `true` keeps today's behavior (tag pill shown with a lock). `false` removes the tag from everything the submitter sees: the Selected Tags pills, the quick select header buttons, and the tag counter.
- The tag is still auto selected and submitted either way, so submissions always land in the group. Hiding is display only.
- No conflict with Tag Management: the tag's `isHidden` flag keeps controlling story cards, header, and tag limit counting site wide. The admin UI notes the selected tag's hidden state so the two settings read as one story.

## Files to change

- `convex/schema.ts`: two new optional fields on `judgingGroups`.
- `convex/judgingGroups.ts`: `updateGroup` args, `getGroupWithDetails` validator and return, `getSubmissionPage` validator and return.
- `src/pages/JudgingGroupSubmitPage.tsx`: wider single column, aspect aware image rendering, `showRequiredTag` prop through `SubmissionFormContent` (pills, quick select, counter).
- `src/components/admin/judging/GroupSubmitPageSection.tsx`: aspect picker, required tag visibility toggle, save payload.
- `src/components/admin/AdminDocs.tsx`: doc updates.

## Edge cases

- Groups with no aspect saved keep the square crop and current sizes (field optional, default square).
- Groups with no visibility flag saved keep showing the required tag (default shown).
- Hiding the required tag while the Tags section itself is hidden is a no-op (section already gone); the drift guard that forces the tags picker visible when no required tag exists is untouched.
- The hidden required tag must never count toward the tag limit display since submitters cannot see or remove it.
- Required tag still locked (cannot be toggled off) when shown.

## Verification

- Lints clean on all touched files.
- `npx convex dev` push succeeds (schema + function changes).
- Frontend typecheck introduces no new errors.
- Manual: single column page renders at 896px with a 16:9 image; hiding the required tag removes it from pills, quick select, and count while the submission still lands in the group.

## Task completion log

- 2026-08-13 07:15 UTC: PRD created.
- 2026-08-13 07:40 UTC: Implemented and verified. Schema fields added, both queries and updateGroup carry them, single column widened to max-w-4xl, wide 16:9 rendering in both public layouts, admin image shape picker (slider square-only), required tag Shown/Hidden pill with Tag Management sync hint, form hides the tag from pills/quick select/counter while still applying it. Convex dev push green, zero lints, no new tsc errors. Admin Docs, task.md, changelog.md, files.md synced.
