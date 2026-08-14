# Radio and multi-select story form fields

Created: 2026-08-14 03:00 UTC
Last Updated: 2026-08-14 05:00 UTC
Status: Done

## Problem

Story Form Fields (Admin, Forms, Manage Form Fields) and judging group custom questions only supported free-form input types: text, url, email, and textarea. Admins had no way to ask a single-choice (radio) or multiple-choice (multi-select checkboxes) question on the submit form or on a judging group's custom submission page.

## Proposed solution

Add `radio` and `multiselect` as first-class field types with an `options` string array, threaded through every layer that already handles the other field types:

- Schema: extend the `fieldType` unions on `storyFormFields` and `judgingGroups.submissionCustomQuestions`, add optional `options: string[]` to both.
- Backend: shared `storyFormFieldTypeValidator` / `storyFormFieldDoc` in `convex/storyFormFields.ts`; `create`/`update` accept options; `resolveDynamicFieldValues` sanitizes choice answers server side (submitted values must match configured options; multiselect stores a comma-joined string via `MULTISELECT_SEPARATOR` so `value` stays a plain string everywhere). `judgingGroups.update` validates choice questions have at least 2 options.
- Storage: choice answers ride the existing paths unchanged. Fields without a dedicated stories column land in `stories.dynamicFormValues`; group custom question answers land in `stories.customFormAnswers`. No value type changes, so judging UI, CSV export, and the AI judge keep working on strings.
- Frontend: new reusable `src/components/ui/ChoiceFieldInput.tsx` (radio group / checkbox group, native required validation, aria-labelledby wiring, option order preserved on multiselect). Rendered from every submit surface: `StoryForm`, `DynamicSubmitForm`, `JudgingGroupSubmitPage` (dynamic fields and custom questions), `YCHackForm`, `ResendForm`.
- Admin UI: `FormFieldManagement` field-type dropdown gains Radio and Multi-select with an options textarea (one option per line, minimum 2 enforced); `GroupSubmitPageSection` custom questions editor gains the same types and options editor.
- Display: `StoryDetail` project links sidebar (desktop and mobile) falls back to `story.dynamicFormValues` for fields without a dedicated column, so choice answers show as `Label: value`. `JudgingInterfacePage` already renders both arrays as text.

## Files changed

- `convex/schema.ts`
- `convex/storyFormFields.ts`
- `convex/judgingGroups.ts`
- `convex/submitForms.ts`
- `src/components/ui/ChoiceFieldInput.tsx` (new)
- `src/components/StoryForm.tsx`
- `src/components/DynamicSubmitForm.tsx`
- `src/components/YCHackForm.tsx`
- `src/components/ResendForm.tsx`
- `src/pages/JudgingGroupSubmitPage.tsx`
- `src/components/admin/FormFieldManagement.tsx`
- `src/components/admin/judging/GroupSubmitPageSection.tsx`
- `src/components/admin/judging/groupSection.tsx`
- `src/components/StoryDetail.tsx`

## Edge cases

- Choice field with fewer than 2 options: blocked in both admin editors and in `judgingGroups.update` server side.
- Submitted value not in the configured options: stripped by `sanitizeChoiceValue` before storage.
- Multiselect required: native validation requires the first checkbox only while nothing is selected, then releases.
- Option renamed after submissions exist: old answers keep the stored string; they simply no longer match a current option (same trade-off as free text).
- Options containing the separator (", "): the parse splits on it, so admins should avoid commas followed by spaces inside a single option; values are still stored faithfully for radio.
- Existing text/url/email/textarea fields, judging group overrides (required/shown), and per-group custom question visibility are untouched.

## Verification steps

- `npx tsc -p tsconfig.app.json --noEmit`: zero errors in all touched files (remaining errors pre-existing elsewhere).
- Convex dev push green ("Convex functions ready") after the schema and validator changes.
- ReadLints clean on all touched files.

## Follow-up round (2026-08-14)

Second pass on top of the initial radio/multiselect release:

- Restyled controls: radio and checkbox inputs in `ChoiceFieldInput` are now 20px custom-styled controls (appearance-none, theme tokens, Lucide Check icon for checkboxes) inside full-width tappable label rows with hover and checked states, replacing the small native inputs.
- Dropdown (select) field type: added `select` to the `fieldType` unions in `convex/schema.ts`, `convex/storyFormFields.ts`, `convex/judgingGroups.ts`, and `convex/submitForms.ts`; server validation treats it like radio (single value must match options, minimum 2 options). `ChoiceFieldInput` renders it with the themed `SimpleSelect`, and both admin editors (`FormFieldManagement`, `GroupSubmitPageSection`) offer it in the type picker.
- Answer counts per option: new admin query `storyFormFields.getChoiceAnswerCounts` (forms.view) aggregates `stories.dynamicFormValues` per choice field; `FormFieldManagement` renders a mini bar per option with counts and a responses total on each choice field row.
- Choice-answer filter for judges: `JudgingInterfacePage` gained a "Filter by answer" SimpleSelect listing every "Field label: option" pair from enabled dynamic choice fields and the group's custom choice questions; filtering is client-side over `dynamicFormValues` and `customFormAnswers` (multiselect answers split before matching) and composes with the existing tag, status, and search filters.

## Task completion log

- 2026-08-14 03:10 UTC: schema, storyFormFields, judgingGroups, submitForms validators and sanitization done.
- 2026-08-14 03:30 UTC: FormFieldManagement and GroupSubmitPageSection options editors done.
- 2026-08-14 03:50 UTC: ChoiceFieldInput component; StoryForm, DynamicSubmitForm, JudgingGroupSubmitPage rendering done.
- 2026-08-14 04:05 UTC: YCHackForm and ResendForm rendering; StoryDetail dynamicFormValues fallback display done.
- 2026-08-14 04:15 UTC: typecheck, lint, docs sync done.
- 2026-08-14 04:45 UTC: follow-up round: restyled radio/checkbox controls, select field type end to end, per-option answer count bars in admin, choice-answer filter in the judging interface.
- 2026-08-14 05:00 UTC: follow-up verification: app and convex typechecks clean on touched files, zero lints, docs synced.
