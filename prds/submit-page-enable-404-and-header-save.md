# Custom submission page 404 on enable, plus header save buttons

Created: 2026-08-08 19:30 UTC
Last Updated: 2026-08-08 19:45 UTC
Status: Done

## Problem

Enabling the custom submission page in the group workspace showed the public URL right away, but opening it returned the Page Not Found state.

## Root cause

The Enabled toggle in `GroupSubmitPageSection` only flipped local React state. The card immediately rendered "The public submit page is available" and the URL row with copy and open buttons, but `hasCustomSubmissionPage` was not written to the database until the Save button at the bottom of the card (about 400 lines below) was clicked. `judgingGroups.getSubmissionPage` returns null when the flag is unset, so the public page rendered its 404 state.

A second friction point: the long cards (Submit page, AI judge) keep their only save button in the card footer, below the fold, so it is easy to change settings and never see the save.

## Proposed solution

1. Persist the enable flag immediately when the toggle is clicked, using the existing `updateGroup` partial-update mutation (same pattern as the Overview status toggles). Roll back local state and show an inline error if the write fails. The rest of the page settings still apply on save.
2. Add an optional `headerAction` slot to `SectionCard` and a compact `HeaderSaveButton` component. Render it in the header of the two long cards (Custom submission page, AI judge) whenever they are expanded, so a save is always visible without scrolling. Footer saves stay in place.

## Files changed

- `src/components/admin/judging/groupSection.tsx`: `SectionCard` gains `headerAction`; new `HeaderSaveButton` component.
- `src/components/admin/judging/GroupSubmitPageSection.tsx`: toggle persists immediately with rollback; header save button when enabled.
- `src/components/admin/judging/GroupAiSection.tsx`: header save button on the AI settings card when enabled.

## Edge cases

- Toggle write fails: local state rolls back and the footer error line explains.
- The full save still includes `hasCustomSubmissionPage: enabled`; writing the same value twice is a harmless idempotent patch.
- The AI judge enable toggle stays save-gated on purpose: its save handler validates that private AI results have a password before enabling.
- Header save button only renders when the card is expanded (enabled), since collapsed cards are short and the footer is visible.

## Verification

- Lints clean on all three touched files.
- Flow: flip Enabled on the Submit page section, open the URL from the URL row without clicking Save, page loads instead of 404.

## Follow-up bug: save failed with schema validation error

Saving the Submit page section with no required tag selected threw on the server:
`Path: .submissionFormRequiredTagId, Value: null, Validator: v.id("tags")`. The whole save aborted, so layout changes did not apply.

Root cause: `updateGroup` accepts null to mean "clear this optional field", and converts null to undefined for passwords, dates, and auto-include fields, but the generic copy loop passed null through for every other nullable field (`submissionFormRequiredTagId`, `submissionPageTitle`, `submissionPageDescription`, `submissionFormTitle`, `submissionFormSubtitle`, `description`, `submissionPageImageId`). Convex schema fields are `v.optional(...)`, which rejects null; patching undefined unsets the field.

Fix: the copy loop now maps null to undefined for all fields. One line in `convex/judgingGroups.ts`.

## Task completion log

- 2026-08-08 19:40 UTC: Implemented toggle persistence, header save slot, and header save buttons. Lints clean.
- 2026-08-08 19:45 UTC: Fixed updateGroup null handling so clearing optional fields (required tag, titles, image) no longer fails schema validation and blocks the whole save. Convex dev push clean.
- 2026-08-08 19:55 UTC: Audited every admin and judging mutation for the same null-into-patch class. Checked all mutations accepting `v.union(..., v.null())` args (tags.create, tags.update, convexBoxConfig.update, users.syncUserFromClerkWebhook, judgingGroups.updateGroup) and every spread-into-patch site (forms.updateForm, submitForms.updateSubmitForm, storyFormFields.update, settings.update, tags.updateTagLimits). All except updateGroup already convert null to undefined or accept no nullable args. All other patch calls in judging files use literal objects. Schema contains no stored-null fields, so the blanket null-to-undefined conversion is safe. No further fixes needed.
