# AI review briefs, tighter radius, and admin cleanup

Created: 2026-08-21 17:20 UTC
Last Updated: 2026-08-21 17:31 UTC
Status: Done

## Problem

AI review briefs currently copy immediately from each result row, so organizers cannot inspect the generated brief before sharing it or save one submission as markdown. The group recap has a deterministic evidence export but no optional AI-written cohort summary. Across the app, cards and controls use several larger corner radii that no longer match the requested compact editorial style. The Numbers admin view also contains a User Growth Over Time chart that is no longer needed.

## Proposed solution

- Replace the per-submission Copy brief action with a closed Brief toggle on each completed result. Opening it reveals the exact markdown plus Copy Markdown and Save .md actions.
- Keep the privacy-safe deterministic Convex Recap for all submissions and add an admin-only Generate AI Summary action. Generate the summary from stored completed AI result evidence only, persist it on the judging group with provider, model, timestamp, and a result fingerprint, and mark it stale when review evidence changes. Never rescan repositories or change scores.
- Set shared non-pill Tailwind radii to `0.25rem` for cards, buttons, inputs, thumbnails, submit surfaces, and admin panels. Keep `rounded-full` tag pills, avatars, notification dots, and profile-adjacent icon controls unchanged. Preserve the header notification and profile menus as explicit local exceptions.
- Remove the User Growth Over Time query, formatting logic, and chart from the Numbers admin view.

## Files to change

- `convex/schema.ts`
- `convex/adminQueries.ts`
- `convex/aiJudge.ts`
- `convex/aiJudgeAnalysis.ts`
- `src/components/admin/AIJudgeResults.tsx`
- `src/components/admin/NumbersView.tsx`
- `src/components/Layout.tsx`
- `src/index.css`
- `tailwind.config.js`
- `.interface-design/system.md`
- `TASK.MD`
- `changelog.md`
- `files.md`

## Edge cases

- Brief panels are closed by default and independent from the existing score-detail expansion.
- Clipboard failure falls back to a temporary textarea.
- Filenames are sanitized from the submission or group slug.
- Group summary generation is disabled until the review run has no pending or running rows.
- Missing AI provider configuration produces an in-app error and leaves the existing summary untouched.
- A saved AI summary is marked stale when a result is retried, edited, added, removed, completed, or failed.
- Large groups send a bounded evidence payload to the model and disclose truncation in the prompt.
- `rounded-full` remains untouched, so tags, avatars, dots, and round header controls keep their shape.

## Verification steps

- Run Convex code generation and Convex TypeScript checks.
- Run focused ESLint on all changed TypeScript and TSX files.
- Run the app TypeScript check and separate new errors from existing errors.
- Run the production build.
- Verify brief panels are closed initially and both export actions work.
- Verify the group recap includes the saved AI summary and stale state.
- Verify list, grid, vibe, submit, admin, inputs, and buttons use `0.25rem` corners while pills and header icons remain round.
- Verify User Growth Over Time no longer renders or queries data.

## Task completion log

- 2026-08-21 17:20 UTC: PRD created and implementation started.
- 2026-08-21 17:31 UTC: Added closed submission brief panels with copy and `.md` save, the full group recap export with an optional persisted AI cohort summary and stale-result detection, the global `0.25rem` non-pill radius scale with preserved round pills and header controls, and removed the User Growth Over Time chart and query.
- 2026-08-21 17:31 UTC: Convex TypeScript and focused ESLint passed. The production build passed. The full app TypeScript check still reports existing unrelated errors and no errors in changed files. Browser verification confirmed buttons and cards compute to `4px` while `rounded-full` pills and round controls remain `9999px`. Admin-only interaction testing requires an authenticated browser session.
