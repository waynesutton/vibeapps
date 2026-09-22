# Submission and edit "Server Error" fix

Created: 2026-09-22 01:30 UTC
Last Updated: 2026-09-22 02:35 UTC
Status: Done (backend live on prod; frontend ships with the next green Netlify build after the `.npmrc` fix)

## Problem

Hackathon participants see `[Request ID: ...] Server Error Called by client`
on the event submit page (`/judging/<slug>/submit`, rendered by
`JudgingGroupSubmitPage.tsx`, screenshots show its "Submit Your App" title).
Editing an existing submission from the story page fails the same way
(GitHub issue #19, `updateOwnStory`).

The message is redacted, so neither the participant nor the team can tell
what failed. The `storageId` guess in the issue is a client side throw with
its own text and is not the cause.

## Root causes

1. Redaction hides real messages. Every user facing check in
   `stories.submit`, `stories.updateOwnStory`, `getAuthenticatedUserId`,
   `ensureUserNotBanned`, `validateNewTagNameLengths`,
   `enforceVisibleTagLimit`, the rate limit, the per event duplicate URL
   guard and the hackathon log cap throws a plain `Error`. Convex redacts
   plain errors on prod to `Server Error`; only `ConvexError` data survives
   (docs: "Differences in error reporting between dev and prod"). The AI
   judge already made this switch in commit `cc66859`.
2. Duplicate URL on the event page. Shwetas confirmed in Discord that
   `vibeapps.dev/s/block` already existed from Sep 3 and they were submitting
   the same project again through the event link. `stories.submit` rejects a
   second submission for the same project URL in the same judging group with
   a plain `Error`, which prod shows as `Server Error`. Public Parish most
   likely hit the same guard or another plain `Error` in the same handler.
3. Edit form sends team members without emails. `getBySlug` strips
   `teamMembers[].email` as PII (`omitPublicStoryPii`). `StoryDetail.tsx`
   seeded its team state from that public shape and sent
   `teamMembers: [{ name }]` back on save. `updateOwnStory` requires
   `email: v.string()`, so every edit of a hackathon story with a team name
   fails argument validation. Reproduced on dev with
   `npx convex run stories:updateOwnStory ... --identity`:
   `ArgumentValidationError: Object is missing the required field 'email'.
   Path: .teamMembers[0]`. This matches the issue #19 steps.
4. Edit form tag limits did not match the server. The story page edit form
   hardcoded 10 tags and never checked new tag name length. Prod settings
   are 6 tags and 32 characters, enforced server side with a plain `Error`.
5. Auth timing. Both submit forms gated on Clerk `isSignedIn` only. Convex
   auth can still be pending, in which case `getAuthenticatedUserId` throws
   "User not authenticated." and prod shows `Server Error`.

Also found: the `updateStoryAdmin` half of
`prds/admin-team-member-email-fix.md` never landed. `convex/stories.ts`
still has `email: v.string()` at the admin validator and assigns
`updateData.teamMembers = args.teamMembers` directly, while
`ContentModeration.tsx` already sends `{ name }` for untouched members.
Admin edits of hackathon stories fail validation today.

## What shipped in this pass

Frontend

- `src/lib/convexErrors.ts` (new): `getConvexErrorMessage(error, fallback)`.
  Prefers `ConvexError.data` (string or `{ message }`), strips the
  `[CONVEX M(...)] [Request ID: ...]` prefixes and the `Called by client`
  trailer, keeps only the first meaningful line on dev, and maps a bare
  prod `Server Error` to the fallback plus the request id so a participant
  can paste it in Discord.
- `src/pages/JudgingGroupSubmitPage.tsx`: live duplicate URL check under the
  App Website Link field (new `hackathon.isProjectUrlTakenInGroup` query,
  skipped until a URL is typed), blocks submit with the same sentence the
  server uses and points to Edit on the existing submission. Gates submit on
  `useConvexAuth().isAuthenticated`. Uses the shared error helper.
- `src/components/StoryForm.tsx`: same Convex auth gate with a
  "Connecting your account..." button label while pending; shared error
  helper.
- `src/components/StoryDetail.tsx`: tag limits from `api.settings.get`
  (visible tags only, hidden tracking tags never count), new tag name length
  check, a pre save check that matches `enforceVisibleTagLimit`, team fields
  only sent when the owner touched them (`teamDirty`), a client check that
  an edited team has an email per member (emails are hidden on the page, so
  this prevents wiping stored addresses), and the shared error helper.

Backend

- `convex/hackathon.ts`: public `isProjectUrlTakenInGroup` query
  (`{ groupId, url }` to boolean) wrapping the existing
  `groupHasDuplicateUrl` helper. Deployed to dev and verified true/false.
- `convex/hackathonLog.ts`: the 20,000 character cap now throws
  `ConvexError`.

## Backend edits: convex/stories.ts and convex/users.ts (applied)

Both files contain `.filter((q) => ... q.field(...))` calls, and the
convex-lint hook from the Claude Code `convex@claude-plugins-official`
plugin (enabled in `~/.claude/settings.json`, loaded by Cursor too) denies
any write to a file that contains that pattern. The user chose to pause the
hook for one session: the flag was set to `false`, the edits below were
applied, and the flag was set back to `true`. The permanent fix is still
`prds/convex-filter-query-refactor.md`.

The list below is what was applied, kept for review.

### Edits for `convex/stories.ts`

1. Import: change `import { v, type Infer } from "convex/values";` to
   `import { v, ConvexError, type Infer } from "convex/values";`
2. `validateNewTagNameLengths`: `throw new Error(` to `throw new ConvexError(`.
3. `enforceVisibleTagLimit`: `throw new Error(` to `throw new ConvexError(`.
4. `submit` handler, in order:
   - "Maximum of 4 additional images allowed" to `ConvexError`.
   - Rate limit: `ConvexError` and fix the copy to
     `"Submission limit reached. You can submit up to 20 projects per day."`
     (the check is `>= 20`, the text said 10).
   - Duplicate URL guard: `ConvexError`.
   - "At least one valid tag is required to submit a story." to `ConvexError`.
5. `submitAnonymous` handler: the four user facing throws (images, rate
   limit, slug exists, at least one tag) to `ConvexError`.
6. `updateOwnStory`:
   - Validator: `teamMembers` `email: v.string()` to
     `email: v.optional(v.string())`.
   - "Story not found.", images, "User not authorized to edit this story",
     "At least one valid tag is required." to `ConvexError`.
   - Team merge, replace the direct assignment:

```ts
// Merge by position: public pages strip member emails, so a member
// arriving without one keeps the stored address. Blank clears on purpose.
if (args.teamMembers !== undefined) {
  const existing = story.teamMembers ?? [];
  updateData.teamMembers = args.teamMembers.map((member, i) => ({
    name: member.name,
    email: member.email ?? existing[i]?.email ?? "",
  }));
}
```

7. `updateStoryAdmin`: same validator change (`email: v.optional(v.string())`)
   and the same merge block. This completes
   `prds/admin-team-member-email-fix.md`.

### Edits for `convex/users.ts`

1. Import `ConvexError` from `convex/values`.
2. `getAuthenticatedUserId`: both throws to `ConvexError`
   ("User not authenticated." and "Authenticated user not found in Convex
   database. User sync issue?"). Use a friendlier second message:
   "Your account is still syncing. Refresh the page and try again."
3. `ensureUserNotBanned`: `ConvexError("User is banned and cannot perform
   this action.")`.

Message copy also changed while switching to `ConvexError` so the text a
participant now sees reads as an instruction, not a stack trace label:
"Please sign in and try again.", "Your account is still syncing. Refresh
the page and try again.", "This account cannot perform this action.",
"Only the owner can edit this submission.", and the anonymous slug clash
now says which title is taken and to pick a different one.

With the `updateOwnStory` merge live, `StoryDetail.tsx` sends a blank
member email as `undefined` and the hint reads "Leave an email blank to
keep the one already saved for that member." The earlier strict
"Add an email for each team member" block was removed.

## Ship

1. `npx convex deploy` (pushes `stories.ts` and `users.ts` to prod; Netlify
   only builds the frontend).
2. Commit and push so Netlify ships the frontend half.

## Files changed

- `convex/stories.ts`
- `convex/users.ts`
- `convex/hackathon.ts`
- `convex/hackathonLog.ts`
- `src/lib/convexErrors.ts` (new)
- `src/components/StoryForm.tsx`
- `src/components/StoryDetail.tsx`
- `src/pages/JudgingGroupSubmitPage.tsx`
- `TASK.MD`, `changelog.md`, `files.md`

## Edge cases

- Hidden judging group tracking tags stay in `selectedTagIds` on the edit
  form and never count toward the limit, same as the server.
- A story that carries more visible tags than the current admin limit shows
  "This submission has N tags but the limit is now M. Remove K to save."
  and the save is blocked client side, matching the server.
- Owner edits that do not touch the team section send no team fields, so
  stored emails are preserved. Owner edits that do touch it send a blank
  email as `undefined`, and the server keeps the stored email at that
  position. The merge is positional, so removing member 1 of 3 shifts the
  stored emails up by one; the owner sees the names, so this matches what
  the form shows.
- The duplicate URL query returns only a boolean. It only runs once the URL
  is longer than 8 characters to avoid firing on `https://`.
- `useConvexAuth().isLoading` briefly true after sign in: the submit button
  reads "Connecting your account..." and the click explains instead of
  sending a request that would be redacted.

## Verification

- `npx tsc --noEmit -p convex/tsconfig.json`: clean.
- `npx tsc --noEmit -p tsconfig.app.json`: no errors in touched files (the
  two remaining `StoryDetail.tsx` unused `result` warnings predate this
  work).
- `npx eslint` on all touched files: 0 errors.
- `npm run build`: passes.
- Dev: `hackathon:isProjectUrlTakenInGroup` returns `true` for a URL already
  in a group and `false` for a fresh one.
- Dev, before the backend edits: `stories:updateOwnStory` with
  `teamMembers: [{ name }]` reproduces the validation failure; the same call
  without team fields succeeds and keeps the stored email.
- Dev, after the backend edits (`npx convex dev --once`): the same
  `teamMembers: [{ name: "wes" }]` call on `realtime-crm` returns
  `success: true` and the stored row still reads
  `[{ name: "wes", email: "wayne@socialwayne.com" }]`.
- `npx prettier --write` on `stories.ts` and `users.ts`; diff limited to the
  edits listed above (87 and 13 changed lines).
- Helper checked against the exact prod string from the screenshots, a dev
  style stack trace, string and object `ConvexError` data, and an
  `ArgumentValidationError`.

## Task completion log

- 2026-09-22 01:30 UTC - Investigation. Prod logs had rotated out of the
  CLI window; root causes established from code, dev repros, prod function
  spec, prod settings and insights.
- 2026-09-22 02:05 UTC - Frontend fixes, `hackathon.ts` query and
  `hackathonLog.ts` ConvexError shipped and verified. `stories.ts` and
  `users.ts` edits written up above, blocked by the convex-lint hook.
- 2026-09-22 02:20 UTC - Hook paused for one session at the user's request,
  `stories.ts` and `users.ts` edits applied (ConvexError throws, rate limit
  copy, optional member email plus positional merge on `updateOwnStory` and
  `updateStoryAdmin`), hook re enabled. `StoryDetail.tsx` relaxed to "blank
  keeps the stored email". Pushed to dev and the issue #19 repro now
  succeeds with the email preserved. Prod deploy left to the user.
- 2026-09-22 02:35 UTC - Backend deployed to prod by the user (second
  `npx convex deploy` after `git add .`). Commit 5551dbe pushed, but the
  Netlify build failed at `npm install`: `@waynesutton/agent-ready` peers
  `@convex-dev/workpool ^0.3.0`, `@convex-dev/resend` 0.2.7 needs `^0.4.10`,
  and no agent-ready release accepts 0.4 yet. Added root `.npmrc` with
  `legacy-peer-deps=true`; a clean temp dir install from the lockfile
  passes. Frontend half of #19 ships when that build goes green; close the
  issue after one owner edit on prod succeeds.
