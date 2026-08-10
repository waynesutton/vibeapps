# Judging group custom submit form field builder

Created: 2026-08-09 19:00 UTC
Last Updated: 2026-08-09 19:20 UTC
Status: Done

## Problem

The judging group custom submission page (`/judging/:slug/submit`) renders a fixed form. Admins can only toggle required vs optional on ten fixed fields (`submissionFieldRequirements`). They cannot:

- Hide or remove fields from the form (for a minimal form like name, email, repo, app link)
- Add new custom questions specific to their event
- Control the extra sections (team info, additional images, the global additional link fields like LinkedIn, X, Chef)

The separate `convex/submitForms.ts` system powers standalone `/form/:slug` pages and is not connected to judging groups. This PRD extends the judging group form config instead of merging the two systems, keeping every existing pipeline (auto add to group via `stories.submit` with `judgingGroupId`, required tag tracking, human judging, AI judge) unchanged.

## Root cause

`judgingGroups.submissionFieldRequirements` only stores required booleans for a fixed key set. There is no visibility config and no place to define or store custom question answers.

## Proposed solution

### Schema (convex/schema.ts)

- `judgingGroups.submissionFieldVisibility` (optional object): optional booleans for the ten existing field keys plus `teamInfo`, `additionalImages`, `additionalLinks`. Unset key = visible. Backward compatible: existing groups show everything as today.
- `judgingGroups.submissionCustomQuestions` (optional array): `{ key, label, placeholder?, description?, fieldType: "text" | "url" | "email" | "textarea", required }`.
- `stories.customFormAnswers` (optional array): `{ key, label, value }`. Label is denormalized so answers keep meaning even if the question is later edited or removed.

### Guard rails so nothing breaks

- `title` can never be hidden. Story slugs, judging lists, results dashboards, and the AI judge all key off it. The admin UI shows it as locked.
- Hiding `tags` requires a saved required tag (admin save validation). The public page also falls back to showing the tag picker when tags are hidden but no required tag exists (data drift guard).
- `stories.submit` backstop: when `judgingGroupId` is provided, the server fetches the group and auto adds `submissionFormRequiredTagId` to the story tags if missing. Guarantees group tracking even if the client skips the tag UI.
- Hidden `tagline` and `url` submit as empty strings, which the stories schema already allows.
- Admin UI warns (non blocking) when `githubUrl` is hidden while the AI judge is enabled, since the AI judge reads repos from that field.
- Requirements only apply to visible fields; the public form skips required validation for hidden fields.

### Backend

- `convex/judgingGroups.ts`: new validators, `updateGroup` accepts both new fields (custom question keys validated unique and labels non empty), `getGroupWithDetails` and public `getSubmissionPage` return both.
- `convex/stories.ts` `submit`: optional `customFormAnswers` arg (trimmed, empty values dropped) stored on the story; required tag backstop above.
- `convex/judgingGroupSubmissions.ts` `getGroupSubmissions`: returns `customFormAnswers` so judges see the answers.

### Frontend

- `src/components/admin/judging/groupSection.tsx`: `SUBMISSION_SECTION_DEFS`, `SubmissionFieldVisibility`, `mergeVisibility`, `CustomQuestion` type helpers.
- `src/components/admin/judging/GroupSubmitPageSection.tsx`: per field Show/Hide plus Required/Optional controls, section visibility rows, custom questions editor (add, edit, remove), save validation and AI judge warning.
- `src/pages/JudgingGroupSubmitPage.tsx`: renders only visible fields and sections, renders custom questions, includes answers in the submit call, skips tag validation when tags are hidden with a required tag.
- `src/pages/JudgingInterfacePage.tsx`: shows custom question answers to judges next to team info.

## Files to change

- convex/schema.ts
- convex/judgingGroups.ts
- convex/stories.ts
- convex/judgingGroupSubmissions.ts
- src/components/admin/judging/groupSection.tsx
- src/components/admin/judging/GroupSubmitPageSection.tsx
- src/pages/JudgingGroupSubmitPage.tsx
- src/pages/JudgingInterfacePage.tsx

## Edge cases

- Existing groups with only `submissionFieldRequirements` set: all fields stay visible, required flags unchanged.
- Tags hidden with a required tag: required tag auto selected client side and enforced server side.
- Custom question removed after submissions exist: stored answers keep their label and still display.
- Custom question answer left empty when optional: not stored.
- Duplicate custom question labels: keys are slugified with a numeric suffix to stay unique.
- Non judging group submissions (`StoryForm`, `/resend`, admin submit forms): untouched, no new args passed.

## Verification steps

- `npx tsc --noEmit` (app) and `npx convex dev` typecheck pass
- Existing group with no new config renders the form exactly as before
- Group with hidden fields renders a minimal form and submits successfully
- Custom question answers appear on the judging interface
- Story lands in the judging group with the required tag applied

## Task completion log

- 2026-08-09 19:00 UTC: PRD created, implementation started
- 2026-08-09 19:10 UTC: Schema + backend done: `submissionFieldVisibility` and `submissionCustomQuestions` on judgingGroups, `customFormAnswers` on stories, updateGroup validation (title always visible, unique keys, non-empty labels), getGroupWithDetails/getSubmissionPage return the config, stories.submit stores answers and applies the group required tag as a server-side backstop, getGroupSubmissions exposes answers to judges
- 2026-08-09 19:12 UTC: Frontend done: GroupSubmitPageSection show/hide + required toggles, section visibility, custom questions editor with guard-rail warnings; groupSection helpers (mergeVisibility, makeQuestionKey); JudgingGroupSubmitPage conditional rendering + custom question inputs; JudgingInterfacePage shows custom answers
- 2026-08-09 19:15 UTC: Fixed latent validator gap: added rejectionReason, selfReportedHarness, selfReportedModel, customFormAnswers to baseStoryValidator and StoryWithDetailsPublic so spread-based story queries keep passing return validation
- 2026-08-09 19:20 UTC: Verified: convex tsc clean, app tsc clean on all touched files (remaining errors pre-existing elsewhere), zero lints. Docs synced (TASK.MD, changelog.md, files.md). Status: Done
