import { useState } from "react";
import {
  Award,
  BookOpen,
  Bot,
  Check,
  ClipboardCopy,
  Download,
  KeyRound,
  ListChecks,
  Scale,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
  BarChart2,
  FileText,
} from "lucide-react";
import { Markdown } from "../Markdown";
import { Button } from "../ui/button";

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
    id: "external-judging",
    title: "External Judging Process",
    icon: Scale,
    content: `# External judging process

This guide is for human judges scoring a judging group. It covers login, passwords, criteria, comments, notes, status, filters, and how to finish each submission. It does not cover the AI judge or agent API.

Use **Copy Markdown** or **Download .md** above this page to paste into Notion, Google Docs, email, or Slack.

## Who this is for

You are an invited judge for a competition, hackathon, or demo day. You do not need a site account to judge. Organizers give you a link and, when the group is private, an access code.

## What you need before you start

- The judging link from your organizer, shaped like \`https://yoursite.com/judging/your-slug\`
- The access code, only if the group is private (organizers call this the judge password)
- A modern browser (Chrome, Firefox, Safari, or Edge)
- Enough time to open live demos, repos, and videos when they exist

Bookmark the link. Use the same browser when you come back so your session continues.

## How login works

Judging does not use Clerk sign in. There is no username and password account for judges.

1. Open the group URL: \`/judging/{slug}\`
2. If the group is **private**, enter the **Access Code** and click **Continue**
3. Enter your **name** (required) and **email** (optional)
4. Click **Start Judging**
5. The app stores a session id in your browser and sends you to \`/judging/{slug}/judge\`

That is the full login. No email verification step. No account creation.

## Password and access code

| Group setting | What you see |
| --- | --- |
| **Public** group | No access code screen. You go straight to the name form. |
| **Private** group | Lock screen asks for **Access Code**. Wrong code shows an error. Correct code unlocks the name form. |

Details that matter:

- The access code is the group's **judge password**, set by the organizer. It is separate from the submission page password and the results page password.
- You only need the judge access code to enter judging. Submission and results passwords are for other links.
- If judging is **paused** (group inactive), the group page is unavailable to judges until an organizer turns it back on.
- Public groups with no password are reachable by anyone who has the URL. Treat the link as shared credentials when the event is invitation only; organizers should use a private group with an access code in that case.

## Entering your name

The name field is how the system identifies your scores.

**Rules enforced by the form:**

- Name is required (at least 2 characters after cleanup)
- The field keeps **lowercase letters only** (a to z). Spaces, numbers, and punctuation are stripped as you type.
- Example: typing \`Wayne Sutton\` becomes \`waynesutton\`
- Pick one stable name and reuse it every time you return

**Email** is optional. Organizers may use it to reach you about judging.

**Returning later:**

- Same browser: your session in local storage usually resumes when you open \`/judging/{slug}/judge\`
- New browser or cleared storage: open the group link again, enter the access code if needed, and enter the **exact same name** to reconnect to your existing judge record and scores
- Using a different name creates a different judge identity. Do not do that mid event.

## Opening the judging interface

After **Start Judging** you land on the two column judging UI:

- **Left**: submission details, media, filters, status, collaboration notes
- **Right**: scoring criteria, optional comments per criterion, your progress, complete action

Header shows the group name, your judge name, and a progress bar for how many submissions in the group have been completed by any judge.

If your session expires or the judging period ended, you see **Session Expired** with a link back to the group page. Register again with the same name.

If the group has no submissions yet, you see **No Submissions**.

## What you see on each submission

For the current submission the interface can show:

- Title and short description (tagline)
- Current **status** (Pending, Completed, or Skip) and who completed it when relevant
- **Project links**: Live App, GitHub, LinkedIn, X/Twitter, Chef links when present
- **Tags**
- **Visit Submission** (full public story page) and **View Change Log**
- Originally submitted date and last modified when a change log exists
- **Detailed description** (markdown)
- **Video demo** (YouTube, Vimeo, Loom, Google Drive, or direct video when embeddable)
- **Screenshot** and additional images
- **Team info** (team name, size, member names when provided)
- **Additional Answers** from the group's custom submit questions
- **Additional Form Fields** from site wide dynamic form fields

Open the live app and repo when they exist. Scores should reflect what you can verify, not only the writeup.

## Scoring criteria

Criteria are set by organizers for that group. Each criterion has a question and often a short description telling you what to look for.

**Scale:**

- Default is **1 to 10**
- Some groups use **1 to 5** (set in group Settings)
- Click a number button to save that score immediately
- Scores must be whole numbers in range
- Changing a score later updates the saved value

**Completion rule:**

A submission is not finished for you until you have scored **every** criterion with a value greater than 0. The complete button blocks you until that is true.

Criteria text and weights are controlled by organizers. You score; you do not edit the criteria list.

## Comments on criteria

Under each criterion there is an optional **Comments** box.

- Use it for short rationale tied to that score
- Comments save when you leave the field (blur) if a score already exists
- Comments are optional and do not replace scoring
- When a submission is locked or completed by another judge (single judge mode), comments are read only

These per criterion comments are different from collaboration notes (see below).

## Submission status

Each submission has a status for judging:

| Status | Meaning |
| --- | --- |
| **Pending** | Ready to judge or in progress |
| **Completed** | Judging finished for the required judge count |
| **Skip** | Marked skipped so you can move on without scoring it |

**Single judge groups** (default, one judge per submission):

- **Skip** marks it skipped; **Resume** returns it to pending
- **Mark Submission Complete** finishes it after all criteria are scored
- After you complete it, **Edit Scores** reopens it as pending so you can change scores
- If another judge already completed it, you can view their scores but cannot edit

**Multi judge groups** (organizer set "judges per submission" above 1):

- Several judges can score the same submission until the required count is reached
- You see a counter like \`2 of 3 judges\`
- Your action button is **Judged & Next** (saves your completion and advances)
- After you submit, you wait for remaining judges; scores may show as locked for further edits
- When the required number of judges finish, the submission locks for everyone
- After you have submitted (or when locked), you can see an overall average and per judge score breakdown

## How to finish a submission

Recommended loop:

1. Filter or search to the next open submission
2. Read the writeup, open Live App and GitHub, watch the video when present
3. Score every criterion
4. Add optional criterion comments where useful
5. Optionally leave a collaboration note
6. Click **Mark Submission Complete** (single judge) or **Judged & Next** (multi judge)
7. Move to the next pending submission

Scores save as you click numbers. Completing is still required so progress and queue logic stay correct.

## Judge collaboration notes

**Judge Collaboration Notes** is a shared thread on the submission.

- Notes are visible to other judges and to organizers in Judge Tracking
- Notes **do not** change scores or rankings
- Use \`@username\` to mention a site user (when that person has an account)
- You can reply to an existing note
- Good uses: conflict of interest flag, broken demo, repo access request, disagreement worth documenting

Do not put private access credentials in notes.

## Filters and navigation

Tools above the submission help you move through large queues:

- **Search submissions**: type a title; pick from the dropdown (shows completion state)
- **Filter by tag**: limit to apps with a visible tag
- **All Submissions / Not Judged**: Not Judged shows only submissions nobody has completed yet
- **Filter by judge**: show submissions completed by a specific judge name
- **Filter by answer**: when the group used radio, dropdown, or multi select fields, filter by a specific answer (for example track or category)
- **Jump to #**: type a position number and click **Go**
- **Previous / Next** chevrons move one submission at a time in the current filtered list

Active filters show a count like \`Submission 3 of 12 (filtered from 40 total)\`. Clear filters if the list looks empty.

## Progress and results

- Header progress counts submissions completed by any judge against the group total
- **Your Progress** on the right repeats that bar and the complete action
- **View Results** opens \`/judging/{slug}/results\` (may ask for a results password if results are private)
- **Back to Group Page** returns to \`/judging/{slug}\`

Final rankings can use weighted criteria. Organizers control weights. Your job is consistent scoring on the published questions.

## What organizers control (for context)

You cannot change these from the judge UI. Knowing them avoids confusion:

- Group public vs private and the judge access code
- Whether judging is active
- Criteria questions, descriptions, order, and weights
- Score scale 1 to 5 or 1 to 10
- How many judges must complete each submission
- Which apps are in the group
- Whether results are public or password protected

If criteria look wrong or a submission is missing, contact the organizer. Do not invent your own rubric.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Incorrect access code | Confirm you have the **judge** password, not the submit or results password. Ask the organizer to resend it. |
| Name keeps changing as you type | Expected: only lowercase letters stay. Plan a single word or combined name. |
| Session expired | Return to the group URL, unlock if private, enter the same name again. |
| Cannot mark complete | Score every criterion first. Zero or blank criteria block completion. |
| Cannot edit scores | Another judge finished it (single judge), or the multi judge quota is full / you already submitted. Use Edit Scores only when the UI offers it on your own completion. |
| No submissions match filters | Clear tag, Not Judged, judge, and answer filters. |
| Demo or repo broken | Note it in collaboration notes and score based on what you can verify. Tell the organizer if access is required. |
| Progress lost after new device | Re enter the **same** name. A new name starts a new judge. |

Refresh the page if the UI stalls. Saved scores persist on the server once each click succeeds.

## Best practices for judges

- Use the full scale. Do not cluster everything at 7 or 8.
- Be consistent across the queue. Score similar quality similarly.
- Prefer evidence from the live app and repo over marketing copy alone.
- Keep criterion comments short and specific.
- Use collaboration notes for issues other judges should see.
- Finish with Mark Complete or Judged & Next so organizers see real progress.
- Recheck early scores after you have seen more of the field if time allows.

## Checklist for your first session

1. Open the judging link from the organizer
2. Enter the access code if asked
3. Enter your stable lowercase name and optional email
4. Confirm criteria and scale match what the organizer described
5. Score one test submission end to end including Mark Complete or Judged & Next
6. Confirm it shows as completed in search or filters
7. Continue through the queue

## Sharing this guide

Organizers: open **Admin → Docs → External Judging Process**, then **Copy Markdown** or **Download .md**. Paste into Notion or Google Docs, add your real \`/judging/{slug}\` link and access code in a short cover note, and send to every judge.`,
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

Judges do not need site accounts. Sessions can later be linked to real user accounts from Judge Tracking.

For the full external facing guide (login, passwords, criteria, notes, filters, multi judge, troubleshooting), see **External Judging Process** in this Docs sidebar. Use Copy Markdown or Download .md to send it to judges.`,
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
  const [copied, setCopied] = useState(false);
  const active =
    DOC_SECTIONS.find((s) => s.id === activeId) ?? DOC_SECTIONS[0];

  // Copy the active section's markdown for Notion, Google Docs, or email
  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(active.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; download still works
    }
  };

  // Download the active section as a .md file judges can open anywhere
  const handleDownloadMarkdown = () => {
    const blob = new Blob([active.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${active.id}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

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
          <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopyMarkdown()}
              title="Copy this page as markdown"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <ClipboardCopy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {copied ? "Copied" : "Copy Markdown"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadMarkdown}
              title="Download this page as a .md file"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download .md
            </Button>
          </div>
          <article className="prose prose-sm max-w-none prose-headings:text-ink prose-h1:text-xl prose-h1:font-medium prose-h2:text-base prose-h2:font-medium prose-p:text-copy prose-li:text-copy prose-strong:text-ink prose-a:text-ink prose-code:text-ink prose-code:bg-surface-alt prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:text-xs">
            <Markdown>{active.content}</Markdown>
          </article>
        </div>
      </div>
    </div>
  );
}
