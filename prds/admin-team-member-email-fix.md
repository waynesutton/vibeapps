# Admin team member email fix and component upgrade

Created: 2026-09-21 04:50 UTC
Last Updated: 2026-09-21 04:50 UTC
Status: In Progress

## Problem

Saving a hackathon submission from the admin Content Moderation edit form
wiped the stored team member emails, even when the admin only changed the
title or a tag. On the public story page, the edit path also crashed on
`member.email.trim()` when a member arrived without an email.

Separately, the Resend and Workpool components were bumped locally on
2026-08-30 (`@convex-dev/resend` 0.2.6 to 0.2.7, `@convex-dev/workpool` 0.3.2
to 0.4.10) to pick up the Workpool snapshot-query change that cuts OCC retries
on `pendingCompletion` and `pendingStart`, but the bump was never committed or
deployed. Production still runs the old components.

## Root cause

`listAllStoriesAdmin` runs every story through `omitPublicStoryPii`, which
maps `teamMembers` down to `{ name }` so member emails never reach the client.
The Content Moderation form then sent that stripped list straight back to
`updateStoryAdmin` on every save, and the mutation patched `teamMembers`
verbatim. Result: stored emails replaced with nothing.

The admin mutation validator also required `email: v.string()` on each member,
so once the form started sending `{ name }` only, Convex arg validation would
reject the save outright.

## Proposed solution

Keep stripping on read (PII stays out of the client). Fix the write side so it
merges instead of overwrites.

Frontend, `src/components/admin/ContentModeration.tsx` (already on disk):

- `teamMembers` state uses `email?: string`.
- A `teamMembersDirty` flag is set only when the admin edits the member count,
  a name, or an email. When it is false the save omits `teamMembers` entirely.
- When dirty, members whose email is `undefined` are sent as `{ name }` so the
  backend keeps the stored address. The email input shows "Email hidden, leave
  blank to keep" for those members.

Frontend, `src/components/StoryDetail.tsx` (already on disk):

- `member.email?.trim()` so a member with no email does not crash the filter.

Backend, `convex/stories.ts`, `updateStoryAdmin` only:

- Validator: `email: v.optional(v.string())` inside the `teamMembers` array.
- Handler: merge by position against `story.teamMembers`. A member with no
  `email` keeps the stored address; a member with no stored address gets `""`
  so the `stories` schema (which still requires `email: v.string()`) stays
  satisfied. An explicit `email: ""` from the admin still clears on purpose.

```ts
if (args.teamMembers !== undefined) {
  const existingMembers = story.teamMembers ?? [];
  updateData.teamMembers = args.teamMembers.map((member, index) => ({
    name: member.name,
    email: member.email ?? existingMembers[index]?.email ?? "",
  }));
}
```

No schema change. The public `submit` mutations and the user-facing
`updateStory` keep requiring email. `omitPublicStoryPii` is unchanged.

## Files to change

- `convex/stories.ts` (`updateStoryAdmin` validator and handler)
- `src/components/admin/ContentModeration.tsx` (already changed)
- `src/components/StoryDetail.tsx` (already changed)
- `package.json`, `package-lock.json` (component bump, already changed)

## Edge cases

- Member count shrinks: the frontend splices the array, the backend maps only
  the members it receives, so trailing members are dropped as intended.
- Member count grows: new members arrive with `email: ""` typed by the admin
  or `undefined` if untouched; `undefined` with no stored member at that index
  falls through to `""`.
- Admin clears an email on purpose: the input sends `""`, which is not
  `undefined`, so it clears.
- Reordering is not supported by the form, so index merge matches the UI.
- `mutationArgs` in the form is typed `any`, so TypeScript never catches a
  validator mismatch. Convex arg validation at runtime is the only guard.

## Verification steps

- `npx tsc --noEmit -p convex/tsconfig.json` clean.
- `npx eslint convex/stories.ts src/components/admin/ContentModeration.tsx src/components/StoryDetail.tsx` with zero errors.
- `npm run build` passes.
- With `npx convex dev` running: edit a hackathon story in Content
  Moderation, change only the title, save, confirm `teamMembers[].email` is
  unchanged in the dashboard data view. Then edit one member email, save,
  confirm it persists. Confirm screenshot and additional image edits still
  work.
- After `npx convex deploy`: send a test email from the admin Email dashboard,
  submit one story so `autoScanStory` runs, edit a hackathon story in prod
  admin and confirm team emails survive. A few hours later run
  `npx convex insights --prod` and confirm OCC retries stay in the low tens
  with zero `OCC Failed Permanently`.

## Blocker

The `convex-lint` agent guard rejects any agent write to `convex/stories.ts`
because the file contains `.filter((q) =>` calls elsewhere. The backend
change above (about 15 lines) has to be pasted in by hand. Tracked in
`prds/convex-filter-query-refactor.md`, which is paused.

## Task completion log

- 2026-08-30 - `@convex-dev/resend` and `@convex-dev/workpool` bumped locally
  via `npm install`. Not committed.
- 2026-08-31 - Frontend half of the fix written in `ContentModeration.tsx` and
  `StoryDetail.tsx`. Backend half blocked by the lint guard.
- 2026-09-21 04:50 UTC - PRD written. Verified convex tsc clean and eslint
  zero errors on the touched frontend files with the current disk state.
  Backend patch handed to the user to apply by hand. Deploy and post-deploy
  checks pending.
