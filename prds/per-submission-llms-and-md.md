# Per-submission llms.txt and markdown files

Created: 2026-08-13 08:34 UTC
Last Updated: 2026-08-13 09:00 UTC
Status: Done

## Problem

The site has live `/llms.txt` and `/vibeapps.md` for the whole directory.
Each public app has no machine-readable file of its own. Agents that land
on a story page cannot fetch a slug-scoped index, and the story sidebar
has no discovery links above View Change Log.

## Root cause

Discovery builders only emit site-wide files. HTTP routes stop at
`/llms.txt` and `/vibeapps.md`. Story pages only link to the HTML app page.

## Proposed solution

After a submission is approved and public, serve two live files from its slug:

1. `/s/{slug}/llms.txt` in llmstxt.org style for that app.
2. `/s/{slug}.md` as the full markdown page for that app.

Both are built from the same public-story rules as the site directory
(approved, not hidden, not spam, not archived). Unpublished rows 404.

The site-wide `/llms.txt` and `/vibeapps.md` (footer links) list those
per-app URLs next to each app. The story sidebar shows `llms.txt` and
`{slug}.md` above View Change Log. Production Netlify proxies the two
paths to the Convex site host, ahead of the SPA catch-all.

## Files to change

- `prds/per-submission-llms-and-md.md` (this file)
- `convex/siteDirectory.ts` (per-app builders + site-wide listings)
- `convex/siteFiles.ts` (`getPublicStoryBySlug`)
- `convex/http.ts` (pathPrefix `/s/` for the two files)
- `public/_redirects`
- `src/components/StoryDetail.tsx`
- `TASK.MD`, `changelog.md`, `files.md`

## Edge cases

- Hidden, spam, archived, pending, and rejected stories 404 and hide sidebar links.
- Convex HTTP has no `:slug` params; parse `/s/{slug}/llms.txt` and `/s/{slug}.md`.
- Netlify `/s/:slug.md` is unreliable as a segment, so also proxy `/s/*.md`.
- Cap longDescription in the markdown file so payloads stay small.
- Do not change existing Open Graph tag values. Additive alternate links only.

## Verification steps

1. Convex codegen TypeScript green.
2. `curl` `/s/{public-slug}/llms.txt` and `/s/{public-slug}.md` on the Convex
   site URL: 200, correct content types, title present.
3. Hidden or missing slug returns 404.
4. Site `/llms.txt` and `/vibeapps.md` mention the per-app files.
5. Story sidebar shows both links above View Change Log.
6. Zero lint errors on touched files.

## Task completion log

- 2026-08-13 08:34 UTC: PRD drafted.
- 2026-08-13 08:41 UTC: Shipped. Live `/s/{slug}/llms.txt` and `/s/{slug}.md` return 200 for public apps and 404 for missing slugs. Site `/llms.txt` and `/vibeapps.md` list the per-app files. Story sidebar links sit above View Change Log. convex codegen TypeScript green, eslint 0 errors on touched files.
- 2026-08-13 09:00 UTC: Fixed prod regression: story pages 404ed on refresh because the `/s/:slug.md` and `/s/*.md` Netlify rules over-matched (placeholders/splats must be whole segments) and proxied plain `/s/{slug}` URLs to Convex. Markdown URL moved to `/md/{slug}.md` behind a `/md/*` rule; Convex serves `/md/` plus legacy `/s/{slug}.md`; botMeta edge function limited to single-segment `/s/{slug}` so bots can fetch `/s/{slug}/llms.txt`. Verified on dev .site (200/404 matrix and `/md/` links in `/llms.txt`). Prod needs git push (Netlify) and convex deploy.
