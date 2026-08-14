import { useState } from "react";
import {
  Award,
  BookOpen,
  Bot,
  KeyRound,
  ListChecks,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
  BarChart2,
  FileText,
} from "lucide-react";
import { Markdown } from "../Markdown";

// In-admin documentation for the judging system, agent judging API,
// AI spam check, and delegated access.
// Content lives here as markdown so it renders with the existing
// react-markdown setup and stays versioned with the code it describes.

type DocSection = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  content: string;
};

const DOC_SECTIONS: Array<DocSection> = [
  {
    id: "overview",
    title: "Overview",
    icon: BookOpen,
    content: `# Judging system overview

The judging system lets you run scored competitions (hackathons, demo days, contests) on top of app submissions.

**The building blocks:**

- **Judging groups**: a named event with its own URL slug, settings, and passwords. Each group has its own submissions, criteria, judges, and results.
- **Criteria**: the questions judges score, each on a 1 to 5 or 1 to 10 scale (set per group in Settings), with optional weights.
- **Submissions**: apps pulled into the group manually, by tag sync, or through a custom submission page.
- **Judges**: humans who sign in with a name (and optional password), or AI agents using API keys.
- **Results**: live score dashboards, public results pages, CSV exports, and judge tracking.
- **AI judge**: an optional automated reviewer that reads each submission (including its GitHub repo) and scores it against a fixed rubric.

**Where things live in this dashboard:**

- The **Judging** tab lists all groups with actions for settings, criteria, results, tracking, AI results, exports, and deletion.
- **Judge Tracking** opens from a group row and shows per-judge activity with score editing.
- The **Access** tab (full admins only) delegates judging management to organizers without making them full admins.`,
  },
  {
    id: "groups",
    title: "Judging groups",
    icon: Award,
    content: `# Judging groups

Create a group from the Judging tab with **Create Judging Group**. Each group has:

## Basics

- **Name, description, slug**: the slug drives every URL (\`/judging/your-slug\`, \`/judging/your-slug/submit\`, \`/judging/your-slug/results\`). After create, change it with the pencil next to the slug in the workspace header (or Settings). Changing the slug needs the **judging.slug** permission.
- **Active toggle**: pausing a group blocks new judge scoring without deleting anything. Use the pause and play icons in the group list.
- **Public or private**: public groups appear in listings; private groups are reachable only by URL.

## Passwords

Each group can set independent passwords for:

- **Judges**: required to enter the judging interface.
- **Submissions**: required to use the custom submission page.
- **Results**: protects the public results page. If results are public, no password is asked.
- **AI results**: protects the AI results JSON endpoint when AI judging is enabled.

## Event dates

Optional start and end dates control the auto-include tag window (see Submissions) and display on the group page.

## Multi-judge scoring

**Judges per submission** (\`judgesPerSubmission\`) controls how many judges must complete a submission before it drops out of other judges' queues. Leave it empty for every judge to score everything.

## The group workspace

Opening a group takes you to \`/admin/judging/your-slug\`, a workspace with a section sidebar. What you see depends on your permissions (see Delegated access):

| Section | What it does | Permission |
| --- | --- | --- |
| Overview | Live stats, active and public toggles, quick links | judging.view |
| Links | Real-time ledger of every shareable link with lock status | judging.view |
| Settings | Name, slug (judging.slug to change), description, dates, deletion | judging.manage |
| Access | Who can manage this group | judging.manage |
| Criteria | Scoring questions and weights for human judges | judging.manage |
| Submissions | Add, sync, and remove submissions | judging.manage |
| Submit page | Custom public submission form | judging.manage |
| AI judge | Enable AI judging, rubric weights, custom criteria, system prompt, agent keys | judging.manage or judging.ai |
| Results | Human judging rankings and exports | judging.results |
| AI results | AI run dashboard with per-criterion reasoning | judging.ai |
| Judge tracking | Per-judge activity, score edits, notes | judging.tracking |
| Activity | Per-group audit log with exports | judging.view |

## The group Activity log

The **Activity** section below Judge tracking is a realtime audit trail scoped to this group. It records:

- submissions **added** (manual add, tag sync, auto-include, and the custom submit page) and **removed**, with a note when the removed submission already had judge scores or an AI review,
- **AI review runs**: run started with the queued count, one entry per completed or failed review (actor "AI Judge"), and retries,
- **judge scores** as they come in, plus group setting changes.

Entries link to the submission where one applies. The dropdown switches between showing 30, 60, or 100 entries, and **Load more** pages further back. **Export CSV** and **Save as .md** download the full log (newest first) as an audit file. **Clear** (judging.manage) permanently deletes the group's entries after a confirm; because per-group entries live in the same table as the site-wide Activity Log, clearing removes them there too, so export first if you need a record.

Removing a submission also deletes its judge scores and its AI review result, so overview stats, results rankings, and AI counts update in realtime the moment it happens. A submission added back later starts clean and is picked up by the next AI run.

## The Links ledger

The **Links** section lists every URL the group exposes in one place and updates in real time as settings change:

- a **lock icon** means the link asks for a password, with a live "Password set" or "No password set" status,
- a **globe icon** means the link is open to anyone who has it,
- the **AI results page** and **agent API** endpoints are listed only while the AI judge is enabled; disabling the AI judge removes every AI judge link from the ledger and the export,
- the **agent API** endpoints appear with their key requirement, or a notice when the agent API is disabled for the group.

The AI judge section shows the same **AI judge links** (AI results page and agent API endpoints) under its settings card once the AI judge is enabled, so you can copy them where you configure them.

Use it as the single place to copy links for judges, participants, and results viewers before an event. The **Copy all** button copies the full list as markdown with each link's access state, and the **.md** button downloads the same list as a markdown file you can drop into event docs. Both include the password for each locked link, so one paste gives an external organizer everything they need. Treat the export like a credential: only share it with people who should have those access codes.

## How access connects

Every page a group exposes has its own gate:

- **Judging interface** (\`/judging/your-slug\`): open when the group is public, otherwise asks for the judge password.
- **Results page** (\`/results\`): open when results are public, otherwise asks for the results password.
- **Custom submission page** (\`/submit\`): asks for the submission password when one is set.
- **AI results page** (\`/ai-results\`): open when AI results are public, otherwise asks for the AI results password.
- **Agent API** (\`/api/judging/your-slug/*\`): needs a valid agent key, and the group's agent API toggle must be on.
- **Admin workspace**: needs a full admin account or a delegated grant scoped to this group.

## Changing the URL slug

The pencil next to \`/judging/your-slug\` in the workspace header (and the Change slug button in Settings) lets an admin with **judging.slug** pick a new slug. Public pages, the submit form, results, AI results, the admin workspace, and the Agent API all look up the current slug, so they switch immediately. Old URLs 404. Emails already sent still contain the old links. The dialog warns before saving. Full Clerk admins always can; delegated users need the Access tab grant.

## Deleting a group

Deleting a group removes its criteria, judge sessions, scores, and submission links. The apps themselves are not deleted. The delete button asks for a second click to confirm.`,
  },
  {
    id: "criteria",
    title: "Criteria and weights",
    icon: ListChecks,
    content: `# Criteria and weights

Open **Criteria** on a group row to edit its scoring questions.

- Each criterion has a **question**, an optional **description**, and an **order**.
- Judges score every criterion on the group's **scoring scale**: 1 to 10 by default, or 1 to 5 when selected in group Settings. Changing the scale later keeps existing scores as entered.
- Criteria can have **weights** that multiply into the weighted totals shown on results dashboards. Equal weights mean a plain average.
- Reordering is drag friendly and saves immediately.
- Deleting a criterion removes its scores, so prefer editing text over deleting once judging has started.

A submission counts as **complete** for a judge once that judge has scored every criterion for it.`,
  },
  {
    id: "submissions",
    title: "Submissions",
    icon: FileText,
    content: `# Getting submissions into a group

There are four ways apps end up in a judging group:

## 1. Manual add

In the group workspace, the **Submissions section** opens with an "Add submissions" search: type any part of a title, and add matching apps to the group one click at a time. Results flag apps already in the group, and hidden, archived, or rejected apps never appear. Added apps go straight into judge queues and are included in the next AI judge run.

From **Moderation**, you can also use the judging group control on any story to add or remove it from groups.

## 2. Required tag sync

Set a **required tag** on the group. The sync action pulls in every approved app carrying that tag. Run it again any time to pick up new matches.

The required tag picker in the Submit page section lists every tag including hidden ones, and you can **create a new tag inline** by typing a name that does not exist yet. New tags default to hidden so they stay off story cards and never count toward the tag limit; they are managed in Tag Management like any other tag. Creating a tag needs the tags.manage permission.

## 3. Auto-include tags with a date window

Configure **auto-include tags** plus the group's event dates. Apps submitted with those tags inside the window are automatically linked to the group when they are created.

## 4. Custom submission page

Enable **custom submission page** to get a dedicated form at \`/judging/your-slug/submit\`. It can:

- require a **submission password**,
- create the app and link it to the group in one step.

The page supports three layouts (two column, one third, single column). The single column layout is as wide as the main submit page and works with a **header image shape** setting: **Square (1:1)** with an adjustable pixel size, or **Wide (16:9)** which fills the page width, good for banner art.

The **Submit page** section in the group workspace controls exactly what the form asks for:

- **Form fields**: every core field (title, tagline, description, links, screenshot, name, email, tags) can be marked **Required** or **Optional** and **Shown** or **Hidden**. Hidden fields are removed from the form entirely.
- **Required tag visibility**: when a required tag is set, a **Shown/Hidden** pill controls whether submitters see the locked tag on the form. Hidden only affects the form display; the tag is still applied to every submission so entries land in the group, and the tag's own hidden flag in Tag Management keeps controlling story cards and tag limits, so the two settings never conflict.
- **Form sections**: the Hackathon Team Info, Additional Images, and Additional link fields sections each get the same Required/Optional and Shown/Hidden pills. A required section must be filled in before the form submits.
- **Additional form fields**: fields created in **Admin, Forms, Manage Form Fields** appear here automatically. Each one can be overridden per group as Required/Optional and Shown/Hidden. Unset overrides fall back to the field's own defaults. These fields render inside the Additional link fields section, so hiding that section hides all of them.
- **Custom questions**: extra questions that belong to this group only. Each has a type (text, url, email, textarea) plus Required/Optional and Shown/Hidden pills. Answers are stored with the submission and shown to judges under **Additional Answers**.

Fields added in Manage Form Fields also flow to the main public submit forms, and values without a dedicated column are stored with the submission and shown to judges under **Additional Form Fields**.

Removing a submission from a group also removes its scores in that group. The app itself is untouched.`,
  },
  {
    id: "judges",
    title: "Judge flow",
    icon: Users,
    content: `# How judges score

1. A judge opens \`/judging/your-slug\`.
2. If the group has a **judge password**, they enter it.
3. They enter their **name** (and email if asked). This creates a judge session stored in the browser, so returning judges continue where they left off.
4. The judging interface shows the submission queue. For each submission the judge:
   - reviews the app details, links, video, and description,
   - scores each criterion on the group's scoring scale (1 to 5 or 1 to 10) with optional comments,
   - can leave **notes** on the submission thread visible to admins,
   - marks it complete and moves on.
5. When **judges per submission** is set, submissions completed by enough judges leave the remaining queues automatically.

Judges do not need site accounts. Sessions can later be linked to real user accounts from Judge Tracking.`,
  },
  {
    id: "results",
    title: "Results and tracking",
    icon: BarChart2,
    content: `# Results, exports, and judge tracking

## Results dashboards

- **Public results page**: \`/judging/your-slug/results\`. Public when the group marks results public, otherwise protected by the results password.
- **Admin results**: the same dashboard inside the admin (visible when results are not public), showing rankings, weighted totals, per-criterion averages, and per-judge detail.

## CSV exports

- **Export CSV** on a group row downloads every submission with tags, links, team info, submitter, and vote counts.
- Judge Tracking has its own export with per-judge scores.

## Judge Tracking

Open **Judge Tracking** from a group row (\`/admin/judging/your-slug/tracking\`). It shows:

- every judge with score counts, completion, and last activity,
- per-judge detailed scores that you can **edit**, **hide from results**, or **delete**,
- submission **notes** left by judges,
- **link or unlink** a judge session to a real user account,
- delete a judge entirely (removes their scores).

Hidden scores stay stored but drop out of every results calculation.`,
  },
  {
    id: "ai-judge",
    title: "AI judge",
    icon: Sparkles,
    content: `# AI judge

The AI judge automatically reviews each submission in a group and scores it against a rubric. The built-in rubric targets "Best use of Convex" style judging, and each group can extend it with **custom criteria** and its own **system prompt**. Enable it per group in the AI judge section.

## What it reads

For each submission the AI judge collects:

- the submission's title, tagline, description, and links,
- the app website (fetched with Firecrawl when \`FIRECRAWL_API_KEY\` is set) plus a direct liveness check,
- the **demo video transcript** (fetched with Context.dev when \`CONTEXT_DEV_API_KEY\` is set): YouTube videos return their caption transcript; other video host pages get a best effort page scrape with a Firecrawl fallback. Transcripts are treated as unverified builder narrative and a missing video never lowers a score,
- the **GitHub repository**, when a GitHub URL is on the submission,
- **project log files** at the repo root: \`hackathon.md\`, \`changelog.md\`, \`task.md\`, and \`files.md\` (self-reported build context, cross-checked against verified facts),
- **agent skills** in the repo (\`.agents/skills/*/SKILL.md\` and the \`.claude\`, \`.codex\`, \`.cursor\` variants) as workflow evidence,
- a published **\`/hackathon.json\` manifest** on the live app origin, the structured fallback for teams with private or missing repos.

## GitHub repo analysis (verified working)

Using the authenticated GitHub REST API, it fetches:

- repository metadata and the **full file tree**,
- \`package.json\`, the README, and the hackathon log files above,
- up to **60 Convex source files** selected Convex-first (about 40 make it into the prompt),
- up to **300 commits**, which are also scanned for AI tool fingerprints (Claude Code, Cursor, and similar) to describe how the project was built.

**Limits to know about:**

- Public repositories only. Private repos should publish \`/hackathon.json\` on their live app so the judge still gets structured context.
- File selection is Convex-centric; a project with no \`convex/\` folder gets less code into the prompt.
- Each file is capped at about 8,000 characters and the whole prompt around 180,000 characters. Log files are capped at 5,000 characters each.
- GitHub rate limits are handled with automatic retry.
- Self-reported sources (log files, manifest) never override the deterministic repo scan: claims that the code does not back up are called out in the reasoning.

## Custom criteria

Each group can add up to **10 custom criteria** on top of the built-in six. Each has a key (lowercase slug), a label, and a description telling the agent exactly what to check. Custom criteria get their own rubric weights and appear in AI results like built-in ones.

Every criterion in the **Rubric weights** card has an **on/off toggle**. Criteria switched off are excluded from the AI prompt, scoring, and rankings on the next run; at least one criterion must stay on. The **components check** preset lives in the same card behind an **Add to rubric** button: clicking it adds a repo-verified Convex components criterion (installed vs referenced in code) that then behaves like any other custom criterion. Deleting it from Custom AI criteria removes it until you click Add again.

## Editable system prompt

The AI judge section shows the full prompt body the model runs with. You can edit it, paste a replacement, or **reset to default** at any time. The \`{{rubric}}\` placeholder expands to the criteria list, and the JSON response format is always enforced server side, so a custom prompt cannot break score parsing.

## Models and environment variables

Set these in the Convex deployment environment:

| Variable | Required | Purpose |
| --- | --- | --- |
| \`GITHUB_TOKEN\` | Yes | Authenticated GitHub API access for repo reading |
| \`ANTHROPIC_API_KEY\` | One model key required | Primary model (Claude Sonnet) |
| \`OPENAI_API_KEY\` | Fallback | Used when Anthropic is unavailable |
| \`OPENROUTER_API_KEY\` | Fallback | Second fallback provider |
| \`FIRECRAWL_API_KEY\` | Optional | Website content fetching |
| \`CONTEXT_DEV_API_KEY\` | Optional | Video transcript fetching (YouTube captions and video host pages) |

## Running and reviewing

- **AI Results** on a group row opens the AI dashboard: start a review run, watch per-submission status, retry failures, and read full reasoning per criterion.
- Failed submissions can be **retried** individually.
- Admins can **edit AI scores** and reasoning; edits are stamped with the editor and time.
- **Rubric weights** are editable per group and re-rank existing results instantly since weighted totals are computed at read time. Per-criterion on/off toggles take effect on the next AI run.
- AI results can be exposed at \`/api/judging/your-slug/results.json\` (public, password protected, or key protected depending on group settings).`,
  },
  {
    id: "agent-judges",
    title: "Agent judges",
    icon: Bot,
    content: `# Agent judges (external AI judges over HTTP)

Beyond the built-in AI judge, any external AI agent can judge a group through an authenticated HTTP API. The agent reads the criteria, works through its submission queue, and posts scores that land next to human judges in results and tracking.

## Setup in three steps

1. **Turn on the Agent API** for the group in its AI judge section. When the toggle is off, every agent call returns 403 and new keys cannot be created. Existing keys are kept (not revoked) and work again the moment the toggle is back on.
2. **Create an agent key** in the same section. The raw key (\`vjk_...\`) is shown **exactly once**; only its SHA-256 hash is stored, so copy it right away. Each key creates a judge identity of type \`agent\` with the name you give it.
3. **Copy the API URLs** from the group's Links section. It lists the public OpenAPI document and the API base URL, and both appear there only while the toggle is on. Hand the base URL and the key to whoever runs the agent.

Keys can be **revoked** at any time from the same card. Revoked keys get 403 on every call while their historical scores stay for the audit trail.

## Authentication

Every endpoint except \`openapi.json\` needs the key, sent either way:

\`\`\`
x-judge-key: vjk_yourkey
Authorization: Bearer vjk_yourkey
\`\`\`

## Endpoints

All live under \`/api/judging/{slug}/\` on the Convex site URL (the Links section shows the full URL):

| Endpoint | Method | What it returns |
| --- | --- | --- |
| \`openapi.json\` | GET | Machine-readable API spec. No auth. Point an agent here first. |
| \`criteria.json\` | GET | Group info, the criteria list with ids and descriptions, and \`scoreScale\` (5 or 10). |
| \`submissions.json\` | GET | The agent's remaining queue. Submissions completed by enough judges drop out when judges per submission is set. |
| \`submissions/{storyId}.json\` | GET | Full detail for one submission: description, links, tags, team info. |
| \`scores\` | POST | Accepts the agent's scores for one submission. |
| \`results.json\` | GET | Completed AI results. Also opens with the results password (\`?password=\`) or when AI results are public. |

## Posting scores

\`\`\`
POST /api/judging/{slug}/scores
x-judge-key: vjk_yourkey
Content-Type: application/json

{
  "storyId": "...",
  "scores": [
    { "criteriaId": "...", "score": 8, "comments": "optional note" }
  ],
  "complete": true
}
\`\`\`

- \`score\` is an integer from 1 to the group's \`scoreScale\`.
- Posting the same criteria again **updates** the existing scores, so agents can safely retry.
- \`complete: true\` marks the submission finished for this judge, which advances queue logic and completion counts.

## Rate limits

Per key: **120 reads per minute** and **30 writes per minute**. Agents that exceed a limit get 429 and should back off and retry.

## Quick error reference

| Status | Meaning |
| --- | --- |
| 401 | Missing key header |
| 403 | Bad or revoked key, or the group's Agent API toggle is off |
| 429 | Rate limit hit; retry after a pause |

## Advisory mode

Toggle **agent scores advisory** per group to collect agent scores without letting them move official rankings. Advisory scores show separately on dashboards with a badge. Turn advisory off when agent scores should count like any human judge's.`,
  },
  {
    id: "spam-check",
    title: "AI spam check",
    icon: ShieldAlert,
    content: `# AI spam check

The **AI Spam** tab reviews submissions for spam: dead or parked URLs, link farms, empty repos passed off as products, duplicate mass submissions, and promo pages with no relation to a real app. By default it only flags and a human confirms; the optional **automation agent** can also mark and hide high-confidence spam on its own.

## When scans run

- **Automatically**: every new submission is scanned right after it is created, while the **Auto-scan new submissions** toggle in the Automation card is on (it is on by default).
- **Manually**: **Scan recent** queues up to 100 submissions that have not been scanned yet; **Re-scan all recent** re-runs everything. With a **date range** set in the filters row, both buttons pull from that window instead of the most recent.

Scans run in their own background pool, so a batch scan never slows down the AI judge.

## Automation

The **Automation** card controls what happens to new submissions with no admin involved. Changing any toggle needs **moderation.moderate** and every change lands in the **Activity** tab.

- **Auto-scan new submissions** (default on): run the spam scan on every new submission. Turn it off to pause scanning without losing any settings.
- **Agent auto-mark spam** (default off): when an automatic scan returns a **spam** verdict at or above the **confidence threshold**, the agent marks the submission as spam and hides it immediately. Only automatic scans on fresh submissions qualify; batch and manual re-scans never auto-mark, so re-checking old content can never mass-hide it. Every auto-mark is logged in the Activity tab by the **AI Spam Agent** actor with the confidence and reasons.
- **Confidence threshold** (default 85, range 50 to 100): higher means fewer, safer auto-marks.
- **Notify submitter on auto-mark** (default on): send the same in-app alert and reason email a human mark sends. Turned off, the agent marks silently so you can review first and notify (or unmark) after.

Auto-marked rows show an **Auto-marked spam** badge with a robot icon in both the scan results and the Marked spam review. **Unmark** reverses an auto-mark exactly like a human mark.

## What a scan checks

Each scan combines measured facts with an AI verdict:

- **Live URL check**: a direct request to the app URL with the status code recorded.
- **Page content**: a Firecrawl scrape of the app URL so the AI reads the real page.
- **GitHub repo**: reachable or not, file count, and empty-repo detection (fewer than three files).
- **Duplicates**: how many other submissions share the same URL.
- **Extra links**: video, LinkedIn, and X liveness, treated as weak signals since social sites block bots.
- **AI verdict**: spam, suspicious, or clean, with a confidence score and short reasons. Uses the same provider chain as the AI judge (Anthropic, then OpenAI, then OpenRouter). With no model key set, a deterministic heuristic scores the hard signals instead.

Low quality is never the reason for a spam verdict. Only deception and irrelevance.

## The editable AI prompt

The **AI prompt** button opens the exact system prompt behind the verdict. Edit and save a custom version (the button shows a **custom** badge while one is active), or **Reset to default** to restore the built-in text. Changes apply to future scans. Saving empty text or the unchanged default also restores the default.

## Reviewing results

Each row shows the verdict badge with confidence, submitter, URL and repo status, duplicate count, and the AI's reasons. Expanding a row shows the full reasoning, every measured signal, and which provider produced the verdict. Filter by verdict, sort by date or confidence, and narrow by date range. Failed scans can be re-run per row.

## Marking as spam

Marking a flagged submission (single or bulk, with an optional custom reason):

- **hides** the submission and labels it with the reason,
- sends the submitter an **in-app alert** saying the post was marked as spam and removed, with a **Request review** button and a link to the GitHub issues page for appeals,
- **emails** the submitter the reason. The email has a reply-to pointing at \`ADMIN_EMAIL\`, mentions the in-app Request review button, and links the same GitHub issues page.

**Unmark** reverses everything: label cleared, submission visible again. Deletion stays a separate explicit action; bulk delete removes the submissions with their comments, votes, ratings, bookmarks, and scan history.

Confirmed spam also shows a red **Spam** badge on the row in the Moderation tab.

## Reviewing marked spam

The **Marked spam** card at the bottom of the tab lists every submission currently marked as spam, read straight from the stories table, so marked submissions without a scan row still show up. Each row shows the title, live URL, author, when it was submitted and marked, who (or which agent) marked it, and the reason sent to the submitter.

- **Filter by marked date** narrows the list to a period (the range persists across visits).
- **Select all** plus **Delete selected** permanently removes the chosen submissions with their comments, votes, ratings, bookmarks, scan rows, and images. Large selections delete in chunks of 50 automatically.
- **Unmark** on any row restores the submission, whether a human or the agent marked it.

## Disputes and review requests

Signed-in submitters can push back without email: the spam alert on their notifications page has a **Request review** button. Clicking it logs a **spam.reviewRequested** entry in the **Activity** tab with the submitter as the actor, so disputes show up even if the email bounces. One request per mark; repeat clicks do nothing.

Disputed rows get an amber **Review requested** badge in the scan results and the Marked spam review, and they sort to the top of the review list so they never get buried. Two ways to resolve:

- **Unmark** restores the submission and clears the request (the submitter wins).
- **Dismiss** keeps the spam mark and clears the request, logging **spam.reviewDismissed** (the mark stands).

Anonymous submissions have no account to alert, so their path stays email reply or GitHub issue.

## Emails and the kill switch

Spam emails go through the same send pipeline as every other email, so the global **email toggle** in Email settings applies: when emails are disabled, marking as spam still hides, labels, and sends the in-app alert, but no email goes out.

## Permissions

- View the tab and results: **moderation.view**
- Scan, mark, unmark, edit the AI prompt: **moderation.moderate**
- Bulk delete: **moderation.delete**`,
  },
  {
    id: "access",
    title: "Delegated access",
    icon: Shield,
    content: `# Delegated admin access

The **Access** tab (full admins only) grants existing users access to specific admin sections without making them full admins in Clerk.

## How it works

- Full admins keep the Clerk role and bypass every check; nothing changes for them.
- Delegated grants are stored in Convex, so they **take effect immediately** and can be **revoked instantly**. No sign-out or token refresh needed.
- A delegated user visiting /admin sees only the tabs they were granted, with destructive actions hidden unless explicitly granted.

## Granting access

1. Open **Access** and search for the user by name.
2. Toggle the sections and actions they should have. Enabling an action automatically includes that section's view permission.
3. For **Judging**, pick the judging groups they can manage, or grant all groups. Every judging permission is scoped to those groups only.
4. Optionally add a note for your own audit trail, then save.

## What organizers can do with judging access

A user granted the full judging set for one group can manage that event end to end: group settings and passwords, criteria, submissions, judge tracking, results, exports, AI runs, and agent keys, all without seeing any other group or admin section.

## Permission reference

- **Moderation**: view, moderate (approve, reject, hide, archive, pin, edit, tags), delete
- **Tags**: view, manage, delete
- **Forms**: view, manage, results, delete
- **Judging** (group scoped): view, manage, results, tracking, ai, emails, slug, delete
- **Numbers**: view
- **Users**: view, moderate, reports, delete
- **Emails**: view, send
- **Settings**: view, manage

The Access tab itself is never delegatable.`,
  },
  {
    id: "env",
    title: "Environment variables",
    icon: KeyRound,
    content: `# Environment variables

Set these on the Convex deployment (Dashboard, Settings, Environment Variables), not in the frontend:

| Variable | Needed for | Notes |
| --- | --- | --- |
| \`GITHUB_TOKEN\` | AI judge, spam check | Required for AI judge repo reading; the spam check uses it for higher GitHub rate limits and works without it. A classic token with public repo read scope is enough. |
| \`ANTHROPIC_API_KEY\` | AI judge, spam check | Primary model provider. At least one model key must be set for AI verdicts. |
| \`OPENAI_API_KEY\` | AI judge, spam check | First fallback provider. |
| \`OPENROUTER_API_KEY\` | AI judge, spam check | Second fallback provider. |
| \`FIRECRAWL_API_KEY\` | AI judge, spam check | Website content fetching. Optional for the AI judge; the spam check scans still complete without it. |
| \`CONTEXT_DEV_API_KEY\` | AI judge | Video demo transcript fetching via Context.dev (YouTube captions plus video host pages). Optional; reviews run without it. |
| \`ADMIN_EMAIL\` | Spam check | Optional. Reply-to address on spam notification emails so submitters can reach the admins. |

The spam check falls back to a deterministic heuristic when no model key is set. Everything else in the judging system (groups, criteria, human judges, agent keys, results) works without any environment variables.`,
  },
];

export function AdminDocs() {
  const [activeId, setActiveId] = useState<string>(DOC_SECTIONS[0].id);
  const active =
    DOC_SECTIONS.find((s) => s.id === activeId) ?? DOC_SECTIONS[0];

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar nav */}
      <nav
        className="md:w-56 flex-shrink-0"
        aria-label="Documentation sections"
      >
        <div className="bg-surface rounded-lg border border-hairline p-2 md:sticky md:top-4">
          {DOC_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeId;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  isActive
                    ? "bg-surface-alt text-ink font-medium"
                    : "text-copy hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? "text-ink" : "text-faint"
                  }`}
                />
                {section.title}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-surface rounded-lg border border-hairline p-6 md:p-8">
          <article className="prose prose-sm max-w-none prose-headings:text-ink prose-h1:text-xl prose-h1:font-medium prose-h2:text-base prose-h2:font-medium prose-p:text-copy prose-li:text-copy prose-strong:text-ink prose-a:text-ink prose-code:text-ink prose-code:bg-surface-alt prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:text-xs">
            <Markdown>{active.content}</Markdown>
          </article>
        </div>
      </div>
    </div>
  );
}
