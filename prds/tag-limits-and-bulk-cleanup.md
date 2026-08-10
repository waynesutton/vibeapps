# Tag limits and bulk tag cleanup

Created: 2026-08-08 08:15 UTC
Last Updated: 2026-08-08 08:30 UTC
Status: Done

## Problem

Tags are getting out of control:

1. Users can attach up to 10 tags per submission (hardcoded in the frontend) and the backend never enforces a cap, so pasted tag dumps go straight into the database.
2. There is no limit on tag name length, so long pasted strings become tags.
3. Admins can only archive or delete tags one at a time in Tag Management, which makes cleanup slow with hundreds of tags.

## Proposed solution

### Configurable tag limit

- New settings fields: `maxTagsPerSubmission` (default 6) and `maxTagLength` (default 20 characters).
- Stored on the existing `settings` document, editable from the Tags admin section via a new `tags.updateTagLimits` mutation gated on the `tags.manage` permission.
- Server-side enforcement in `stories.submit`, `stories.submitAnonymous`, and `stories.updateOwnStory`:
  - Hidden tags (`isHidden: true`) do not count toward the limit. This keeps custom forms that auto-attach a hidden tracking tag (ResendForm `resendhackathon`, YCHackForm `ychackathon`, judging group forms) working no matter the limit.
  - New tag names longer than `maxTagLength` are rejected, unless the name matches an existing tag (existing tags are reused, not created).
- Frontend forms read the limit from `settings.get` instead of the hardcoded 10 and cap the new-tag input with `maxLength`.

### Bulk tag cleanup

- New mutations in `convex/tags.ts`:
  - `bulkSetHidden` (archive/unarchive many tags) gated on `tags.manage`.
  - `bulkDeleteTags` gated on `tags.delete`.
- Tag Management UI gets a checkbox per row, a select-all-on-page control, and an action bar with Archive, Unarchive, and Delete (inline confirm, site design system, no browser dialogs).

## Files to change

- `convex/schema.ts` - add settings fields
- `convex/settings.ts` - defaults, get merge, update args
- `convex/tags.ts` - `updateTagLimits`, `bulkSetHidden`, `bulkDeleteTags`
- `convex/stories.ts` - enforcement in submit, submitAnonymous, updateOwnStory
- `src/components/admin/TagManagement.tsx` - limits card + bulk select UI
- `src/components/StoryForm.tsx` - settings-based limit + input maxLength
- `src/pages/JudgingGroupSubmitPage.tsx` - same
- `src/components/ResendForm.tsx` - same
- `src/components/YCHackForm.tsx` - same

## Edge cases

- Custom form hidden tags passed through `newTagNames` already exist in the database as hidden tags, so they skip the length check and the count check.
- Lowering the limit does not retroactively change existing stories.
- Admin story edits (`updateStoryAdmin`) are not capped so admins can fix tags freely.
- Settings document missing: enforcement falls back to defaults (6 and 20); `updateTagLimits` creates the settings doc if needed.

## Verification steps

- `npx tsc --noEmit` passes for app and convex code.
- Submit form blocks the 7th visible tag with the default limit.
- New tag longer than 20 characters is rejected with a clear error.
- Resend form submission still gets the hidden `resendhackathon` tag when 6 visible tags are selected.
- Bulk archive marks all selected tags hidden; bulk delete removes them.

## Task completion log

- 2026-08-08 08:15 UTC - PRD created, implementation started.
- 2026-08-08 08:30 UTC - Backend (schema, settings, tags, stories) and frontend (TagManagement, StoryForm, JudgingGroupSubmitPage, ResendForm, YCHackForm) done. Convex dev push clean, no lint errors, frontend tsc shows only pre-existing errors. Docs synced (TASK.MD, changelog.md, files.md).
