# AI judge live URL and taglines for Devpost CSV imports

Created: 2026-10-25 18:00 UTC
Last Updated: 2026-10-25 18:10 UTC
Status: Done (dev). Needs Convex deploy.

## Problem

The real Cal Hacks "Best use of Convex" export (`sample/`, gitignored) has 9 columns: Table Number, Project Title, Submission Url, Project Status, About The Project, "Try it out" Links, Video Demo Link, Built With, Opt-In Prizes. No tagline, email, team, or submitted at columns.

6 of the 10 sample rows have no live app link:

- 4 rows list only a GitHub repo in Try it out (Pickje, WattWise, Cadence, Hold)
- 2 rows have an empty Try it out cell and no repo link in the description (Gus, DoseDay)

## Root cause

`stories.url` is required, so the import falls back to `githubUrl`, then the Devpost `sourceUrl`. The AI judge passed `story.url` straight into the Firecrawl scrape, the screenshot, the liveness check, the hosting detection, and the `hackathon.json` / `hackathon.md` fetches. A GitHub or Devpost page was reported as `Live URL ... LIVE`, screenshotted as the app UI, and could inflate product and UI criteria.

Second issue: the tagline fallback took the first 140 characters of raw Markdown, so 9 of 10 taglines started with `## Inspiration` and one with `![Image](...)`.

## Solution

- `convex/aiJudge.ts`: `liveAppUrlForJudging` drops the story URL from the analysis payload when it matches `importSourceUrl` or its host is `github.com` / `devpost.com`. The prompt then says `Live URL: not provided`, liveness says `no URL provided`, and no scrape or screenshot runs. The GitHub repo is still analyzed from `githubUrl`.
- `convex/judgingGroupImports.ts`: `taglineFrom` strips images, links, heading lines, list markers, Markdown escapes, and bold markers before truncating.

## Not changed (checked and fine)

- Video links (`youtu.be` and `youtube.com/watch`) match the transcript regex.
- Issue links like `github.com/owner/repo/issues/236` are trimmed to the repo root.
- Form answers (Table Number, Built With, Opt-In Prizes) stay under the 3000 character prompt cap; the largest row is about 1450.
- The Opt-In Prizes and Project Status filters still find their headers.

## Edge cases

- Row 2c has a 30,203 character About section; the import keeps the first 20,000 (`CAP.longDescription`). Left as is.
- Regular form submissions whose live URL is a GitHub page now also get `Live URL: not provided`, which is the accurate reading.
- Rows already imported keep the old tagline until the CSV is re-uploaded (re-upload refreshes imported fields by `importKey`).

## Verification

- `npx tsc --noEmit -p convex` passes; no lint errors in the two files.
- Tagline function run against all 10 sample rows: no `##`, image, or escape characters remain.

## Task log

- 2026-10-25 18:10 UTC: both fixes shipped to the working tree, docs synced.
