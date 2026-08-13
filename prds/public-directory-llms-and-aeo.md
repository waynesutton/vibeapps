Created: 2026-08-13 07:43 UTC
Last Updated: 2026-08-13 07:57 UTC
Status: Done

# Public directory files and AEO/SEO/GEO

## Problem

Vibe Apps already serves `/llms.txt` from a cached `siteFiles` row rebuilt every 14 days. That file is a bare URL list. It does not follow the llmstxt.org format, does not exclude spam marked submissions, and is stale for two weeks. There is no markdown directory file for agents. The footer has no discovery links. The static `sitemap.xml` only lists `/`. Homepage JSON-LD is missing. Existing Open Graph tags for social crawlers must stay working.

## Root cause

Discovery files were added as a one-shot cache (`convex/siteFiles.ts` + biweekly cron). The Convex Components Directory and Agent Ready both generate live, structured files from public records. This app never adopted that pattern for submissions.

## Proposed solution

Serve live, auto updating discovery files from Convex HTTP actions, built from approved stories that are not hidden, not spam, and not archived.

1. `/llms.txt` in llmstxt.org format: site pages plus every public app as a titled link with tagline.
2. `/vibeapps.md` as the full markdown directory (same idea as `components.md` on the Convex components directory).
3. Dynamic `/sitemap.xml` listing site pages and every public app URL.
4. Richer `/robots.txt` that allows search and AI crawlers and points at sitemap, llms.txt, and vibeapps.md.
5. Footer links to `/llms.txt` and `/vibeapps.md`.
6. Additive AEO/SEO/GEO: JSON-LD on the homepage and crawler HTML, extra OG image metadata, canonical and alternate links. Do not change existing `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, or Twitter card values.

Files stay live via an indexed query on each request (1 hour CDN cache). `siteFiles.rebuild` remains as a fallback cache, run daily instead of every 14 days.

## Files to change

- `prds/public-directory-llms-and-aeo.md` (this file)
- `convex/siteFiles.ts`
- `convex/http.ts`
- `convex/crons.ts`
- `convex/stories.ts` (`getStoryMetadata` also skips spam/archived)
- `src/components/Footer.tsx`
- `index.html`
- `public/_redirects`
- `public/robots.txt`
- `public/sitemap.xml` (stub; Netlify proxies the live file)
- `agent-ready.config.json` comment via skipRoutes only
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Spam marked stories are also hidden today; still filter `isSpam === true` so a future unhide cannot leak them.
- Archived stories stay out of discovery files even if approved.
- Cap directory lists at 2000 apps, highest vibes first, so the HTTP action stays under Convex payload limits.
- Do not intercept Googlebot in `botMeta`. Social crawler HTML stays on `/meta/s` only.
- Keep Agent Ready skipping `/llms.txt` and `/robots.txt`. Also skip `/sitemap.xml` so this app owns the live sitemap.
- Production Netlify redirects for discovery files should hit the production Convex `.site` host, matching `botMeta.ts`.

## Verification steps

1. `npx convex dev` push is green.
2. `curl` `/llms.txt` and `/vibeapps.md` on the Convex site URL: 200, text/plain and text/markdown, public apps present, no hidden/spam titles.
3. `curl` `/sitemap.xml` includes `/` and `/s/{slug}` rows.
4. Footer shows llms.txt and vibeapps.md links.
5. Homepage source still has the same og:image URL and twitter:card.
6. Story meta HTML still has the same og:title / og:image tags plus new JSON-LD.
7. Zero lints on touched files.

## Task completion log

- 2026-08-13 07:43 UTC: PRD drafted.
- 2026-08-13 07:57 UTC: Shipped. Live `/llms.txt` (32 public apps on dev) and `/vibeapps.md` return 200 with correct content types. Sitemap and robots updated. Footer links added. Existing OG tag values unchanged. convex tsc exit 0, convex dev push green.
