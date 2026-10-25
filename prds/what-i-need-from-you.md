# What I need from you

Running list of actions only you can take. Reply with the id (for example "A2 done" or "yes A2").

## Open

| Id | Kind | Action | Where | Send back | Steps | Asked |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | do | Post the Best Use of Convex tips (short version plus the agent prompt) before the 9:00 AM PDT deadline | Cal Hacks Slack or Devpost update | "A1 done" | `prds/calhacks-convex-submitter-prompt.md` | 2026-10-25 |
| A2 | approve | Deploy this work to prod (Convex functions plus frontend). Schema changes are optional fields and one new index, so existing data is untouched | Reply here | "yes A2" or "no A2" | Commit first, then I run the deploy | 2026-10-25 |
| A3 | do | Confirm `GITHUB_TOKEN`, `CONTEXT_DEV_API_KEY`, and `FIRECRAWL_API_KEY` are set on the prod deployment. A classic GitHub token with no scopes is the safest choice because some orgs block fine grained tokens | Convex dashboard, prod deployment, Settings, Environment Variables | "A3 done" (never the values) | After A2, press Run check on the group AI judge Readiness card | 2026-10-25 |
| A4 | do | Paste the prize brief and set the rubric weights | Group workspace, AI judge section | "A4 done" | `prds/calhacks-convex-submitter-prompt.md`, sections Recommended rubric weights and Prize brief | 2026-10-25 |
| A6 | do | Delete the commented `CONVEX_DEPLOY_KEY` line from `.env.local`. If that key was ever pasted anywhere, regenerate it | `.env.local`, then Convex dashboard, prod, Settings, Deploy keys | "A6 done" | Local file only, it was never committed | 2026-10-25 |
| A7 | do | Set usage limits on the prod deployment plus spend caps for Firecrawl and Context.dev | Convex team Settings, Usage; Firecrawl and Context.dev billing pages | "A7 set" | Pick a warning threshold first; a disable threshold turns prod off when hit | 2026-10-25 |
| A9 | do | Turn the Convex Claude plugin back on after the security fixes are committed, so the convex-lint hook guards new code again. Expect it to block edits to the six files with old `.filter()` queries until the cleanup PR lands | `~/.claude/settings.json` line 79, `"convex@claude-plugins-official": true`, then restart Cursor | "A9 done" | Do it after committing the security work | 2026-10-25 |
| A10 | do | Check that the Netlify plan covers Image CDN transforms and how they are billed (credits or free). Five fixed widths per screenshot, cached after the first request | Netlify dashboard, team Billing and Usage, Image CDN | Plan name and whether transforms cost credits | If it costs too much, I remove the `/_img` rules and images fall back to the originals | 2026-10-25 |
| A11 | do | Push the speed work to a branch so Netlify builds a deploy preview, then send me the preview URL | GitHub branch, then the Netlify deploy preview link | The deploy preview URL | I then curl the headers, `/assets` 404, `/_img`, and `/_src` checks and click through the routes | 2026-10-25 |
| A5 | do | After the deadline, export the Devpost Projects CSV with personal info (team emails), then import it with Show in public directory off | Devpost hackathon manager, then group Submissions, Import from CSV | "A5 done" plus the import result counts | `prds/calhacks-convex-submitter-prompt.md`, Judging day run order | 2026-10-25 |

## Done

| Id | Kind | Action | Closed | Result |
| --- | --- | --- | --- | --- |
| A8 | approve | Prod deploy of the security fixes | 2026-10-25 | Owner deploys and commits it themselves |

## Session log

### 2026-10-25 9:01 AM: Keep security details out of the repo

* Asked: none new
* Closed: A8 (owner deploys and commits it themselves)
* Changed: Gitignored the security plan and PRD, trimmed the security details from changelog, TASK.MD, files.md, and this log, and moved the full text into the PRD.

### 2026-10-25 1:55 AM: Speed plan from the components directory

* Asked: A10 (Netlify Image CDN plan and cost), A11 (deploy preview URL)
* Closed: none
* Changed: Checked the speed plan against the security fixes (nothing undone, the image proxy hardened beyond the plan), then shipped code splitting, a single home feed fetch, asset caching, and Image CDN thumbnails. Entry JS 2,278 kB to 636 kB. Verified with tsc, lint, build, and a local prod click through.

### 2026-10-25 1:28 AM: Security fixes finished on dev

* Asked: A9 (turn the Convex plugin back on after committing)
* Closed: none. A8 (prod deploy) is now ready to answer
* Changed: Finished the security fixes and verified them on dev.

### 2026-10-25 12:41 AM: CSV import tag, private option

* Asked: none new
* Closed: none
* Changed: Added a tag picker to the CSV import card (existing or new tag, private by default, private only for judging only rows), kept private tags out of related apps, verified on dev. A2 now also covers this change.

### 2026-10-25 12:33 AM: Cal Hacks CSV import, submitter prompt, and Convex rubric

* Asked: A1, A2, A3, A4, A5
* Closed: none
* Changed: Built CSV import, judging only visibility, AI judge prize brief, form answers, GitHub quota and rate limit fixes, readiness card, and video coverage with retry. Verified end to end on dev.
