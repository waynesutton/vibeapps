# Admin form fields flow through to all submit paths

Created: 2026-08-13 06:40 UTC
Last Updated: 2026-08-13 06:40 UTC
Status: In Progress

## Problem

1. The admin dashboard Forms tab shows a Custom Forms sub section (the old survey system) that should be hidden.
2. When an admin adds a new field in Manage Form Fields (storyFormFields), the field renders on forms but its value is dropped on submit. Every submit path (stories.submit, stories.submitDynamic, submitForms.submitFormData) only persists a hardcoded allowlist of keys (linkedinUrl, twitterUrl, githubUrl, chefShowUrl, chefAppUrl, hackathonLog, and sometimes selfReported fields).
3. Existing dynamic submit forms (/submit/:slug via convex/submitForms.ts) never pick up newly added fields because fields are only linked at form creation time.
4. Judging group custom submission pages lump all dynamic fields into one Additional links section. Admins cannot mark an individual dynamic field required/optional or shown/hidden per group.
5. Form sections (team info, additional images, additional links) can only be shown or hidden, not marked required.
6. selfReportedHarness and selfReportedModel render when enabled but are never passed to stories.submit from StoryForm or JudgingGroupSubmitPage.

## Root cause

Field persistence was built as a fixed column mapping (storyPropertyName -> stories column) with no generic fallback, and judging group overrides were built as a fixed key object that cannot grow with admin-added fields.

## Proposed solution

1. Comment out the Custom Forms sub tab in AdminDashboard.tsx (component and import kept, just not rendered).
2. Add stories.dynamicFormValues: array of { key, label, value } for admin-added fields with no dedicated column. Known columns keep mapping to their columns.
3. Shared resolver in convex/storyFormFields.ts that maps submitted dynamic values: field key -> storyPropertyName column when known, otherwise into dynamicFormValues (label denormalized from the field definition). Used by stories.submit, stories.submitDynamic, and submitForms.submitFormData.
4. submitForms.getPublicSubmitForm and getSubmitFormWithFields append any enabled storyFormFields not already linked to the form, so new fields appear on every dynamic submit form automatically.
5. judgingGroups.submissionDynamicFieldOverrides: record keyed by field key with { required?, visible? }. Admin UI lists every enabled dynamic field in the group Form fields card with Required/Optional and Shown/Hidden pills. Public page respects overrides.
6. Section required toggles: submissionFieldRequirements gains teamInfo, additionalImages, additionalLinks keys. Semantics: teamInfo required = team name required; additionalImages required = at least one additional image; additionalLinks required = at least one link field filled.
7. Custom questions gain an optional visible flag (Shown/Hidden pill) and stay stored on the group document, scoped to that group.
8. Judges see dynamicFormValues in the judging interface Additional Answers card alongside customFormAnswers.
9. StoryForm and JudgingGroupSubmitPage pass selfReportedHarness/selfReportedModel and all unknown dynamic field values on submit.

## Files to change

- src/components/admin/AdminDashboard.tsx (hide Custom Forms sub tab)
- convex/schema.ts (stories.dynamicFormValues, judgingGroups.submissionDynamicFieldOverrides, section requirement keys, custom question visible flag)
- convex/validators.ts (story validator + type)
- convex/storyFormFields.ts (shared dynamic value resolver)
- convex/stories.ts (submit + submitDynamic)
- convex/submitForms.ts (getPublicSubmitForm, getSubmitFormWithFields, submitFormData)
- convex/judgingGroups.ts (validators, updateGroup, getGroupWithDetails, getSubmissionPage)
- convex/judgingGroupSubmissions.ts (getGroupSubmissions returns dynamicFormValues)
- src/components/admin/judging/groupSection.tsx (types, defaults, merge helpers)
- src/components/admin/judging/GroupSubmitPageSection.tsx (per-field pills, section required pills, question visibility)
- src/pages/JudgingGroupSubmitPage.tsx (overrides, section requirements, submit mapping)
- src/components/StoryForm.tsx (submit mapping)
- src/pages/JudgingInterfacePage.tsx (show dynamicFormValues)
- src/components/admin/AdminDocs.tsx (docs updates)
- TASK.MD, changelog.md, files.md

## Edge cases

- Existing groups with no overrides render unchanged (all defaults preserve current behavior).
- Hidden dynamic fields never submit values (filtered client side, values only stored for enabled fields server side).
- hackathonLog submitted through the generic path still runs through sanitizeHackathonLog.
- Unknown keys without a matching storyFormFields definition are dropped server side (no arbitrary storage).
- Tags-hidden guard and title-always-visible guard unchanged.
- additionalLinks required only enforced when the section is visible and at least one link field is shown.

## Verification steps

- npx convex dev deploys schema and functions without errors (terminal 1 already running).
- tsc/eslint clean on touched files.
- Admin Forms tab shows only Story Form Fields.
- Add a new field in Manage Form Fields, confirm it appears on /submit, /submit/:slug, and judging group submit pages, and its value persists (dynamicFormValues) and shows to judges.
- Per-group pills save and the public group form respects them.

## Task completion log

- 2026-08-13 06:40 UTC: PRD created, implementation started.
