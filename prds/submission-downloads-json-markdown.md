# Submission downloads in CSV, JSON, and Markdown

Created: 2026-09-22 03:11 UTC
Last Updated: 2026-09-22 03:25 UTC
Status: Done

## Problem

Admins could only export a judging group's submissions as CSV, and the button
lived in the manage-only Submissions card, away from the roster it exports.
Agents and docs tools want JSON or Markdown, and the CSV was open to
spreadsheet formula injection on cells that start with `=`, `+`, `-`, or `@`.

[PR #17](https://github.com/waynesutton/vibeapps/pull/17) by cuevaio solves
most of this. It is frontend only: no Convex API, schema, or auth changes.

## Root cause of the one defect in the PR

`escapeMarkdown` in `src/lib/submissionDownloads.ts` is applied to every
field, including `longDescription`. That field is already Markdown (rendered
with `<Markdown>` in `src/components/StoryDetail.tsx`), so every `#`, `*`,
`-`, `.`, `(`, `)` gets a backslash. The exported file loses the author's
formatting and reads worse for agents than the original.

## Proposed solution

Merge PR #17 with a true merge commit so cuevaio keeps attribution, then land
one follow-up commit:

1. `src/lib/submissionDownloads.ts`
   - Replace the blanket escape with a light `escapeInline` for single line
     fields only. Escape `\`, backtick, `*`, `_`, `[`, `]`, `<`, `>`, `|`.
     Collapse newlines to spaces. Leave `.`, `-`, `(`, `)`, `#`, `!` alone.
   - Write `longDescription` raw under a `## Description` heading.
   - Add YAML frontmatter to each file (`title`, `slug`, `url`, `tags`,
     `votes`, `teamName`, `submitter`), values JSON quoted so any string is
     safe.
   - Add a `README.md` index to the ZIP: group name, export time, count, and
     a link list to each file.
2. `src/components/admin/judging/SubmissionDownloadControl.tsx`
   - Swap the inline status span for `sonner` toasts, matching
     `GroupActivitySection.tsx`. Keep `aria-busy` and the Preparing state.
3. Docs: `changelog.md`, `files.md`, `TASK.MD`, `README.md`.

Keep `jszip` as the contributor chose. It is lazy loaded so the main bundle
does not grow.

## Files to change

- `src/lib/submissionDownloads.ts` (from PR, then polished)
- `src/components/admin/judging/SubmissionDownloadControl.tsx` (from PR, then
  toasts)
- `src/components/admin/judging/GroupSubmissionsTableSection.tsx` (from PR)
- `src/components/admin/judging/GroupSubmissionsSection.tsx` (from PR, Export
  card removed)
- `src/components/admin/AdminDocs.tsx` (from PR)
- `package.json`, `package-lock.json` (jszip)
- `changelog.md`, `files.md`, `TASK.MD`, `README.md`, this PRD

## Edge cases

- Group with zero valid submissions: toast, no empty file.
- Titles or taglines with `|`, `*`, `_`, `[`, `<` render literally in
  Markdown headings and list items.
- `longDescription` with headings, lists, links, and code blocks survives the
  export as written.
- Frontmatter values with quotes, colons, or newlines stay valid YAML because
  every string is JSON quoted.
- Main moved past the PR base (`ef76e8d`, `5551dbe`, `64301c5`), so
  `package-lock.json` may conflict. Resolve by keeping main's lockfile and
  running `npm install` to add jszip.
- Netlify installs with `.npmrc` `legacy-peer-deps=true`; jszip has no peer
  deps so the install path stays the same.
- Permission gating: Download shows only for `judging.results`, matching the
  `requireJudgingGroupPermission` check in `exportGroupSubmissions`.

## Verification steps

1. `npx tsc --noEmit -p tsconfig.app.json` reports no new errors in touched
   files.
2. `npx eslint` on the touched files is clean.
3. `npm run build` passes and `jszip` lands in its own chunk.
4. Unit check of the builders with a temp script: heading escape, raw
   description, frontmatter, README index.
5. Manual: open a group, View submissions, download all three formats.

## Task completion log

- 2026-09-22 03:11 UTC: PRD created. PR #17 reviewed: mergeable, CLEAN, seven
  files, frontend only.
- 2026-09-22 03:14 UTC: `git fetch origin pull/17/head:pr-17` and
  `git merge --no-ff pr-17`. Auto-merged clean including `package-lock.json`
  even though main had moved past the PR base. `npm install` normalized the
  lockfile under `.npmrc` (`legacy-peer-deps`): dev flags added, the
  never-installed `zod` peer entry dropped. Kept, since that is how Netlify
  resolves it.
- 2026-09-22 03:18 UTC: Follow-up in `src/lib/submissionDownloads.ts`:
  `escapeInline` for headings and list items, raw `longDescription` under
  `## Description`, JSON-quoted YAML frontmatter with an added `page` field
  (`{origin}/s/{slug}`), `buildSubmissionMarkdownIndex` for the ZIP
  `README.md`, `buildSubmissionMarkdownZip(group, rows, options)`.
  `SubmissionDownloadControl.tsx` now uses `sonner` toasts and passes
  `window.location.origin` and one shared `exportedAt`.
- 2026-09-22 03:22 UTC: Verified. App tsc: zero errors in touched files (95
  pre-existing elsewhere). ESLint clean on the five touched source files.
  `npm run build` green, `jszip.min-*.js` is its own 97 kB chunk (30 kB gzip).
  Clean `npm ci` from the lockfile plus `.npmrc` in a temp dir: 588 packages,
  jszip present. Builder check script (outside the repo) confirmed frontmatter,
  heading escapes, raw description with intact code block, non-http URL printed
  as text, CSV `'=SUM(A1)` prefix and BOM, ZIP with `README.md` and numbered
  files. Not run: signed-in browser click through. No Convex deploy needed.
