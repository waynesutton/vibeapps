# Dynamic form fields flow to judging groups with per-group overrides

Created: 2026-08-13 06:20 UTC
Last Updated: 2026-08-13 07:00 UTC
Status: Done

## Problem

Fields created in Admin, Forms, Manage Form Fields (`storyFormFields`) only worked when their key matched a hardcoded column on `stories` (linkedinUrl, twitterUrl, chefShowUrl, chefAppUrl, selfReportedHarness, selfReportedModel, hackathonLog). A brand new field an admin added:

- was silently dropped by `stories.submit` and `submitForms.submitFormData`,
- did not appear on public dynamic submit forms created before the field existed,
- had no per-group controls on judging group custom submission pages,
- never reached judges.

Also: the legacy Custom Forms builder still had a visible sub-tab in the admin Forms section, form sections (team info, additional images, additional links) could only be shown or hidden but never required, and per-group custom questions could not be hidden without deleting them.

## Root cause

Submission mutations mapped form data to explicit `stories` columns by name. Any field without a dedicated column had nowhere to be stored, and judging groups had no storage for per-field overrides.

## Solution

1. **Generic persistence.** New `stories.dynamicFormValues` array (`{key, label, value}`) stores values for admin-added fields with no dedicated column. A shared resolver in `convex/storyFormFields.ts` (`resolveDynamicFieldValues`, `resolveDynamicFieldRecord`) maps incoming entries: known keys fill their `stories` column (hackathonLog sanitized), everything else lands in `dynamicFormValues`.
2. **All submission paths use the resolver.** `stories.submit` (new optional `dynamicFieldValues` arg), `stories.submitDynamic`, and `submitForms.submitFormData`.
3. **New fields flow everywhere.** `getPublicSubmitForm` and `getSubmitFormWithFields` auto-append enabled `storyFormFields` not already linked to the form. `StoryForm` and `JudgingGroupSubmitPage` send every enabled field's value as `dynamicFieldValues`.
4. **Per-group overrides.** New `judgingGroups.submissionDynamicFieldOverrides` record (`{required?, visible?}` per field key) with an "Additional form fields" list in the group Submit page section. Unset entries fall back to the field's own defaults.
5. **Section requirements.** `submissionFieldRequirements` extended with `teamInfo`, `additionalImages`, `additionalLinks`; the Form sections list in the admin gets Required/Optional pills next to Shown/Hidden, and the public form validates required sections.
6. **Custom question visibility.** `visible` flag added to `submissionCustomQuestions`; Shown/Hidden pill in the admin; hidden questions are removed from the form and excluded from `customFormAnswers`.
7. **Judge display.** `getGroupSubmissions` returns `dynamicFormValues`; the judging interface shows them in an "Additional Form Fields" card next to the existing "Additional Answers" (custom questions) card.
8. **Custom Forms hidden.** The legacy Custom Forms sub-tab and content in `AdminDashboard.tsx` are commented out with re-enable instructions; the subtab URL param coerces back to form-fields.

## Files changed

- `convex/schema.ts`: stories.dynamicFormValues; judgingGroups.submissionDynamicFieldOverrides, section keys in submissionFieldRequirements, visible on submissionCustomQuestions
- `convex/validators.ts`: dynamicFormValues on story validator and type
- `convex/storyFormFields.ts`: STORY_DYNAMIC_COLUMNS, resolveDynamicFieldValues, resolveDynamicFieldRecord
- `convex/stories.ts`: submit (dynamicFieldValues arg + resolver), submitDynamic (resolver)
- `convex/submitForms.ts`: auto-include enabled fields in both form queries; submitFormData uses the resolver
- `convex/judgingGroups.ts`: new validators, updateGroup arg, getGroupWithDetails/getSubmissionPage return overrides
- `convex/judgingGroupSubmissions.ts`: getGroupSubmissions returns dynamicFormValues
- `src/components/StoryForm.tsx`: sends dynamicFieldValues
- `src/pages/JudgingGroupSubmitPage.tsx`: applies overrides (visibility, required), section requirement validation, hidden custom questions excluded
- `src/components/admin/judging/groupSection.tsx`: SubmissionRequirementKey, DynamicFieldOverrides, section defaults in requirements
- `src/components/admin/judging/GroupSubmitPageSection.tsx`: Additional form fields override list, section Required pills, custom question Shown/Hidden pill
- `src/pages/JudgingInterfacePage.tsx`: Additional Form Fields card for judges
- `src/components/admin/AdminDashboard.tsx`: Custom Forms sub-tab commented out
- `src/components/admin/AdminDocs.tsx`: custom submission page docs rewritten

## Edge cases

- Field key collides with a dedicated stories column: the resolver routes it to the column, never duplicated into dynamicFormValues.
- Overrides for deleted/disabled fields: ignored at render time (list is driven by enabled fields).
- Hiding the Additional link fields section hides all dynamic fields regardless of per-field settings; the admin UI warns about this.
- Hidden custom questions submitted by stale clients: answers filtered client-side; label denormalization unchanged.
- Old stories without dynamicFormValues: field is optional everywhere.

## Verification

- convex dev push green after every change ("Convex functions ready").
- Zero linter errors across all touched files.
- Manual flow: new field added in Manage Form Fields appears on /submit, on dynamic public forms, and in the group Submit page override list; required section blocks submit; hidden custom question disappears from the public form.

## Task completion log

- 2026-08-13 06:20 UTC: backend schema, resolver, mutation wiring
- 2026-08-13 06:40 UTC: frontend form flow, admin override UI, custom question visibility
- 2026-08-13 07:00 UTC: judge display of dynamicFormValues, admin docs update, project docs sync
