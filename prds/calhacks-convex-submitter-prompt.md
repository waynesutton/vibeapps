# Cal Hacks 13.0 Best Use of Convex: submitter prompt

Created: 2026-10-25 07:00 UTC
Last Updated: 2026-10-25 07:00 UTC
Status: Done

Copy for Cal Hacks teams going for the Best Use of Convex prize. Teams were never told about the Convex hackathon skill and do not need it. The agent prompt borrows the skill's `hackathon.md` header format so the AI judge can parse and cross check it. Teams that skip it are still judged fully from the repo, live URL, and video. A missing `hackathon.md` is never a penalty.

## Short version (Slack or Devpost update)

> Best Use of Convex tips: our AI judge reads your public GitHub repo, your live URL, and your demo video transcript.
>
> 1. Make the repo public and commit the `convex/` folder.
> 2. Put your GitHub and live app links in the Devpost "Try it out" links.
> 3. Upload your demo to YouTube and leave captions on, so the judge can read what you say.
> 4. Add a `hackathon.md` at the repo root that says what you built and which Convex features run it, with file paths. The agent prompt below writes it for you.
> 5. Opt in to the Convex prize.

## Longer intro

> Going for Best Use of Convex? Our AI judge reads your public GitHub repo first. Before you submit, paste the prompt below into your coding agent (Claude Code, Cursor, or Codex) from your project folder, then commit and push. Nothing to install.
>
> Checklist: make the repo public, keep the `convex/` folder committed, put your GitHub URL and live app URL in the Devpost "Try it out" links, add your demo video, and opt in to the Convex prize.

## Agent prompt

```
Create hackathon.md in the root of this repo for the Cal Hacks 13.0 Best Use of Convex prize. Use only evidence from this codebase and its git history. Never include secrets, API keys, env values, emails, or phone numbers.

Start with this header in this order:

# Hackathon log

- **Project:** product name
- **Event:** Cal Hacks 13.0
- **What it does:** one factual sentence
- **Live app:** public URL, or not deployed
- **Repo:** public GitHub URL
- **Frontend:** Codex Sites, Convex static hosting, Vercel, Netlify, Other, or not deployed
- **Convex deployment:** public *.convex.cloud URL, or not deployed
- **Components:** @convex-dev packages registered with app.use in convex/convex.config.ts, or none
- **Convex features:** only what the code shows (schema, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, file storage, full text search, vector search, realtime useQuery, paginated queries)
- **Auth:** Convex Auth, WorkOS, Clerk, Other, or none
- **AI models:** model ids found in code, or none
- **Started:** first commit time, UTC ISO 8601
- **Last updated:** latest commit time, UTC ISO 8601

Next add "## How we use Convex" with 3 to 6 bullets. Each bullet names a user facing feature, the Convex feature behind it, and the file that proves it (for example convex/schema.ts). Say which screens update live without a refresh.

Then add "## Log" with one short dated entry per meaningful commit, oldest first, each with the short SHA and the main files touched.

Keep the file under 4,000 characters. Do not claim any feature, component, or deployment you cannot point to in code.

Last, add a 5 line "How we use Convex" section near the top of README.md that links to hackathon.md.
```

Why the README line: the judge reads only the first 8,000 characters of README.md, and each root log file is capped at 5,000 characters.

## Recommended rubric weights (admin settings)

- Schema and data modeling: 1
- Queries, mutations, and actions: 1
- Real-time reactivity: 2
- Advanced Convex features: 1.5
- Overall depth and correctness: 2
- Live app status: 0.5
- Components check: 1.5
- Frontend checker: 0 (hosting still reported, no ranking effect)
- Mirrored human criteria (Application, Intentionality, Functionality, Creativity, Technical Complexity): 0 each
- Social proof preset: off
- Show AI review to judges: on after the first batch is checked

No separate "Best use of Convex overall" criterion. The weighted total is the overall score and `depth` already covers how central Convex is.

## Prize brief (paste into the AI section Prize brief field)

```
Cal Hacks 13.0, Best Use of Convex ($5,000, 1 winner). Teams of 2 to 4 college students built this during the hackathon weekend. The prize asks for an agent, healthtech, fintech, hardware, or full stack project built on Convex: database, functions, workflows, sync, search, and file storage in one TypeScript backend that updates live. Reward real Convex features like live queries and components that run the core product, not a side store. Calibrate to a weekend build: a focused app with central, idiomatic Convex usage beats a broad app with shallow usage.
```

## Judging day run order

1. Import the Devpost CSV in the group Submissions section.
2. Confirm the AI judge readiness card is all green.
3. Dry run 3 submissions and check github, live URL, video transcript, and screenshot sources.
4. Run the full group about 2 hours after the deadline so YouTube captions exist.
5. Use Retry transcripts for any stragglers.
