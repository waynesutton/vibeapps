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
- **Results**: live score dashboards, public results pages, submission downloads, and judge tracking.
- **AI judge**: an optional automated reviewer that reads each submission (including its GitHub repo) and scores it against a fixed rubric. Its ranking can seed a **shortlist** for human judges, and its review can be shown to judges as an advisory card.
- **How to judge page**: a public per group guide at \`/judging/your-slug/howtojudge\` that judges read before they start, built from the group's live settings.

**Where things live in this dashboard:**

- The **Judging** tab lists all groups. Open a group to manage it; submission downloads are in **View submissions**.
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

- **Left**: submission details, media, filters, status
- **Right**: scoring criteria, optional comments per criterion, your progress, complete action, then collaboration notes

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
- **Social proof** card with the team's launch post and engagement counts, when they shared one
- **AI review** card, only when the organizer turned it on for this group: a collapsed card with the AI judge's scores and reasoning. It is advisory. Score on your own first, then open it to compare.
- A red **Late submission** chip next to the title when the entry came in after the group's submission deadline. Hover it for the submitted time and the deadline. Scoring stays on: judge it like any other entry and mention the label in a note if you think it should affect eligibility. Organizers make that call.

Open the live app and repo when they exist. Scores should reflect what you can verify, not only the writeup.

## Shortlist rounds

Some groups run the AI judge over every submission first and then hand human judges a shortlist. When that is the case your queue only contains the shortlisted submissions, your progress bar counts against that shorter list, and the group's How to judge page says how many made the cut. You do not need to do anything different.

Organizers can also keep the rest of the field visible. When they do, a **Shortlist / Below the cut / All** filter appears in the toolbar and a pill under it says how many are below the cut. Those submissions are grayed out and read only: you can open them, read everything, see the AI judge's rank and score (\`AI #12/40 7.2/10\`) and its full review, and leave notes, but there are no score buttons and no Skip or Mark Complete. If you think one deserves a second look, say so in a note and the organizer can star it into the shortlist. A **Hide AI scores** button hides the AI badges and card for you alone if you prefer to score blind; the choice is remembered per group in your browser.

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

Organizers: open **Admin → Docs → External Judging Process**, then **Copy Markdown** or **Download .md**. Paste into Notion or Google Docs, add your real \`/judging/{slug}\` link and access code in a short cover note, and send to every judge.

For a per group version that already has the right links, criteria, and scale filled in, use the **How to judge page** (next in this sidebar).`,
  },
  {
    id: "how-to-judge",
    title: "How to judge page",
    icon: BookOpen,
    content: `# How to judge page

Every judging group has a public one sheet for its judges at \`/judging/your-slug/howtojudge\`. It is the External Judging Process guide with the blanks filled in from the group itself, so judges read the real criteria, scale, links, and queue size for the event they are scoring.

## What judges see

A Notion style document with a sticky section nav (left rail on desktop, scrolling tabs on mobile):

- **TL;DR**: five numbered steps (open the judging link, enter the access code, enter your first name, score every criterion then Mark Complete or Judged & Next, finish by the deadline).
- **Links you need** at the top and again at the bottom: the judging link, the results page when it is shareable, the AI results page when the AI judge is on and the page is public or passcode protected, tag pages for the required and auto include tags, and any extra links you add.
- **Getting in**: the access code screen (private groups only), the lowercase first name rule, and how to come back later.
- **Your queue**: how many submissions the judge will see, whether the group is in shortlist mode, and how many judges each submission needs.
- **Scoring criteria**: the live criteria list with descriptions, the scale sentence, and a rating guide adapted to 1 to 5 or 1 to 10.
- **Status and finishing**, **What you will see**, **Finding your way around**, and a short **Troubleshooting** table.
- **Late submissions**: only when the group's event window has an end. States the submission deadline in the judge's time zone, explains the red Late submission label, and tells judges to score the entry normally and leave eligibility to organizers.
- **AI review**: only when the AI judge is enabled. Explains what the AI reads, that it is advisory and scores 1 to 10 on its own rubric (the enabled rubric labels are listed), how judges see it (the AI review card when that toggle is on, the AI results link when shareable), and that judges should score independently first.
- **Organizer blocks**: private repos, judge assignments, notes, and contact, shown only when you fill them in.

The screenshots on the page are generic captures from a demo group. They never show real judges, codes, or teams.

## What updates on its own

The page reads live group data on every load. Renaming the group, changing the slug, editing criteria, switching the scale, toggling the AI judge, changing results visibility, switching the Judge queue, setting or moving the event window end, or shortlisting more submissions all show up without touching the page. Pausing the group keeps the page readable behind a **Judging is paused** banner so judges can prepare early.

## The access code convention

The page is public and holds no secrets. Where the access code belongs it prints the literal placeholder **passcodegoeshere** in a chip with the line "your organizer sends the real code by Slack or email". Send the real judge password separately with the page link. You can change the placeholder text in the section's **Access code note** field; whatever you type there is public, so never paste the real code.

## Editing it

Open the group workspace and pick **How to judge** in the sidebar (needs **judging.manage**). The section has:

- a **Public guide** toggle (Live or Off): Off returns 404 for judges, and the row disappears from the Links ledger,
- the public URL with copy and open,
- **Copy Markdown** and **Download .md**: the same content as the live page with real URLs and the placeholder code, for a one paste Google Doc, Notion page, or email. Works even while the page is off,
- **Preview** opens the live page in a new tab,
- organizer fields: **Access code note**, **Judging deadline** (a local date and time; the page shows it in each judge's own time zone), **Contact**, **Private repositories** (markdown), **Judge assignments** (markdown), **Notes from the organizer** (markdown), **Extra links** (label plus URL), and a **Results link** Shown/Hidden pill.

Markdown fields render with the same Markdown component used elsewhere in the app. Save with the footer button; the page updates immediately.

## Suggested flow before an event

1. Finish criteria, scale, access, and the AI judge settings for the group.
2. Fill in the deadline, contact, and any assignments or private repo notes.
3. Open the page signed out, on desktop and on a phone, and read it once as a judge would.
4. Copy the link into your judge email or Slack message and add the real access code next to it.
5. Optional: Copy Markdown into a Google Doc if your judges expect a document.`,
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

Two separate date windows live on a group, and they do different jobs:

- **Auto-include window** (Submissions section): a date range that decides which tagged stories get pulled into the group automatically. Day granularity is enough here.
- **Event window** (AI judge section): a start and end **with time of day**, saved in your time zone. Start feeds the AI judge's build timeline check (first commit vs event start). End is the **submission deadline**: any submission whose site creation time is after it is labeled **Late submission** for the AI judge, human judges, and admins. The judge login page shows both with the time.

The late label is computed every time a page loads from the group's current event end, so moving the deadline relabels every row live with no re-run. Leave the end empty and nothing is ever labeled late. See **Late submissions** under AI judge for what the label does and does not do.

## Multi-judge scoring

**Judges per submission** (\`judgesPerSubmission\`) controls how many judges must complete a submission before it drops out of other judges' queues. Leave it empty for every judge to score everything.

## Judge queue

**Judge queue** in Settings decides which submissions human and agent judges see: **All submissions** (default) or **Shortlist only**, which limits the queue to submissions flagged as shortlisted. The setting shows the live shortlist count and warns in red when Shortlist only is on with nothing shortlisted, because judges would see an empty queue. See **Shortlist** under Submissions for the full workflow.

**Show submissions below the cut to judges** (\`showBelowCutToJudges\`) appears under Judge queue only when Shortlist only is selected. Off (default) hides the rest of the field from judges, exactly as before. On keeps every submission visible in the judging interface, but rows outside the shortlist are grayed out and read only with their AI rank and score and the AI review. Judges cannot score them, skip them, or mark them complete; the server rejects those calls too. Notes stay open so judges can flag one for a second look. Agent judges, progress bars, and results are unchanged because below-cut rows never count toward completion.

## The group workspace

Opening a group takes you to \`/admin/judging/your-slug\`, a workspace with a section sidebar. What you see depends on your permissions (see Delegated access):

| Section | What it does | Permission |
| --- | --- | --- |
| Overview | Live stats, active and public toggles, quick links | judging.view |
| Links | Real-time ledger of every shareable link with lock status | judging.view |
| How to judge | Public per group judge guide: on/off, organizer fields, Copy Markdown and Download .md | judging.manage |
| Settings | Name, slug (judging.slug to change), description, dates, scale, judges per submission, Judge queue, deletion | judging.manage |
| Access | Who can manage this group | judging.manage |
| Criteria | Scoring questions and weights for human judges | judging.manage |
| Submissions | Add, sync, and remove submissions | judging.manage |
| Submit page | Custom public submission form | judging.manage |
| AI judge | Enable AI judging, event window with submission deadline, rubric weights, custom criteria, system prompt, agent keys | judging.manage or judging.ai |
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
- the **How to judge page** (\`/judging/your-slug/howtojudge\`) is listed while that page is on; it is always public and never carries a password,
- the **AI results page** and **agent API** endpoints are listed only while the AI judge is enabled; disabling the AI judge removes every AI judge link from the ledger and the export,
- the **agent API** endpoints appear with their key requirement, or a notice when the agent API is disabled for the group.

The AI judge section shows the same **AI judge links** (AI results page and agent API endpoints) under its settings card once the AI judge is enabled, so you can copy them where you configure them.

Use it as the single place to copy links for judges, participants, and results viewers before an event. The **Copy all** button copies the full list as markdown with each link's access state, and the **.md** button downloads the same list as a markdown file you can drop into event docs. Both include the password for each locked link, so one paste gives an external organizer everything they need. Treat the export like a credential: only share it with people who should have those access codes.

## How access connects

Every page a group exposes has its own gate:

- **Judging interface** (\`/judging/your-slug\`): open when the group is public, otherwise asks for the judge password.
- **How to judge page** (\`/howtojudge\`): public whenever it is switched on. It prints a placeholder where the access code goes and never exposes any password.
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
- Human criteria are **not weighted**. Every criterion counts the same, and results dashboards show plain totals and averages of the 1 to 5 or 1 to 10 scores judges enter.
- Reordering is drag friendly and saves immediately.
- Deleting a criterion removes its scores, so prefer editing text over deleting once judging has started.
- These criteria can also be **mirrored into the AI judge** with the "Human judging criteria" toggle in the AI judge section. Weights apply to the AI judge only: each mirrored criterion gets its own AI weight in Rubric weights, and the AI scores it 1 to 10 while humans keep scoring on the group scale.
- A human **Social proof** criterion works best with the social proof snapshot: judges see the captured post text and engagement counts in a card on the judging page, and a mirrored copy of the criterion makes the AI score from the same snapshot.

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

## Submission deadline countdown

The Submit page section has a **Countdown timer** block (Shown/Hidden) for a live timer on the custom submission page. Turn it on, pick the deadline in the local time picker (stored as one absolute instant, so a PT organizer and an ET visitor see the same moment in their own zones), choose **Large** (stacked days, hours, minutes, seconds) or **Compact** (one line), place it at the top of the page or above the Submit Your App form, and override the heading (default "Submissions close in"). A live preview in the card renders exactly what visitors see.

The timer is display only. After the deadline it reads "Deadline passed" and nothing else changes; the submission page **Open/Closed** switch is still the gate. Screen readers get a summary label and the ticking digits are hidden from them.

## Shortlist

Hand human judges only part of the field. Everything stays in one group, so links, passcode, criteria, and results do not change. The shortlist is a star flag on each submission (\`shortlisted\` on \`judgingGroupSubmissions\`); the AI judge is one way to set those stars, not a requirement.

**Without the AI judge.** Open **View submissions** and star the rows you want judged. The **Shortlist for human judges** bar at the top of that table shows the starred count, the current Judge queue mode, and links to the setting. Then do step 4 below.

**With the AI judge.**

1. Enable the AI judge and run a review. AI runs always cover every submission in the group, so the shortlist is picked from the full field.
2. In **AI results**, pick **5**, **10**, or **20** or type a number next to **Shortlist top N** and click it. A confirm explains that it replaces the current shortlist with the top N completed results by weighted score and what judges will see of the rest. Ties at position N are all included so sort order never cuts a team.
3. Fine tune with the star toggle on any AI result row, or in **View submissions**, which has a **Shortlist** column with the same toggle and a **Shortlist only** filter. This is how you add a submission the AI ranked outside the top N: star it and it joins the shortlist immediately, and judges see it in their queue on the next refresh. Unstar to drop one. Shortlist top N replaces the whole set, so run it first and hand pick after.
4. In **Settings**, switch **Judge queue** to **Shortlist only**. Human judges, the judge progress bar, agent judge queues (\`submissions.json\`), and the results completion percentage all use the shortlist from that moment. Switch back to **All submissions** to restore the full queue; the flags stay so you can flip again.
5. Optional: turn on **Show submissions below the cut to judges** (same Settings card). See **Below the cut** below. With the AI judge off, below-cut rows are still grayed out and read only; they just have no AI badge or review card.
6. To start over or turn the shortlist off, click **Clear shortlist** on the Shortlist for human judges bar in AI results or View submissions. It unstars every submission and, if the Judge queue is Shortlist only, switches it back to All submissions so judges never see an empty queue. Judge scores and AI results are kept.

### Below the cut

By default shortlist mode hides everything that did not make the cut. **Show submissions below the cut to judges** keeps those rows visible in the judging interface as read only context:

- Judges get a **Shortlist / Below the cut / All** filter with counts, and a "N below the cut, read only" pill under the toolbar. The default view is still the shortlist.
- Below-cut rows are grayed out in search results and carry a **Below the cut** chip. Opening one shows a banner ("Not in this judging round. The AI judge ranked it #12 of 40 (7.2/10).") and the **AI review** card expanded, even when Show AI review to judges is off for the shortlist. There are no score buttons, no Skip, no Mark Complete or Judged & Next, and \`submitScore\`, \`updateSubmissionStatus\`, and \`markJudgeCompleted\` throw "This submission is not in the judge queue" if anything tries.
- Notes stay open, so a judge can write "give this one a second look" and you can star it from AI results or View submissions.
- Shortlisted rows show an **AI #rank/total score** badge next to the title only when **Show AI review to judges** is on. Judges can hide all AI badges and cards for themselves with **Hide AI scores** in the toolbar (stored per group in their browser).
- AI results shows a **Below the cut** status line under the Shortlist bar so you can see which way the toggle is set without leaving the page. The How to judge page and its Markdown export explain the same thing to judges.

Ranking is computed at read time from the same comparator everywhere (weighted score, then components used, then depth, then earliest submission), so the rank judges see matches the AI results order.

Every shortlist change is written to the group Activity log. Removing a submission from the group drops its flag with it. AI results and AI runs are never filtered by the shortlist.

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

**Shortlist queues.** When the group's Judge queue is **Shortlist only**, judges see only the shortlisted submissions and their progress bar counts against that number. Nothing about login or scoring changes; the queue is just shorter. Point judges at the group's **How to judge page**, which explains the shortlist round in plain words.

**Below the cut.** With **Show submissions below the cut to judges** on, judges also see the rest of the field grayed out and read only, with a Shortlist / Below the cut / All filter, the AI rank and score badge, and the AI review card expanded. Scoring, Skip, and Mark Complete are hidden for those rows and rejected server side; notes still work. Progress and completion math ignore them.

**AI review card.** When **Show AI review to judges** is on in the AI judge section, every submission with a completed AI review shows a collapsed **AI review** card under Project Links with the AI's per criterion scores and reasoning. It is advisory. Judges are told to score first and compare after. Pending or failed reviews show nothing.

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
- When the group's Judge queue is **Shortlist only**, the completion percentage uses the shortlist size as its denominator so progress reflects what judges were actually asked to score. Below-cut rows shown to judges as read only never count: they cannot be completed, so they are excluded from both the numerator and the denominator.

## Submission downloads

- The **Download** dropdown in a group's View submissions toolbar exports the same submission details as the existing CSV in CSV, JSON, or Markdown format. Markdown downloads are a ZIP with one file per submission (YAML frontmatter, then the description as the author wrote it) plus a README.md index. Visible to anyone with the judging.results permission.
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
- a **live app screenshot**: the same Firecrawl request captures the rendered first screen and the image is attached to the model, so UI and frontend criteria are judged from what renders, not just page text. Convex facts are never inferred from a screenshot. If the image fails, the review retries text only, so a screenshot can never fail a run,
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

## Human criteria in the AI rubric

The **Human judging criteria** block at the top of Custom AI criteria mirrors the questions human judges score (from the Criteria editor) into the AI rubric. Flip **In AI rubric** and:

- each human criterion appears in Rubric weights tagged **human**, with its own AI weight and on/off toggle,
- the AI reads the question and description and scores it **1 to 10** using the live app, screenshot, video transcript, description, and repo. The prompt tells the model the human scale (1 to 5 or 1 to 10) so intent matches,
- product or UI questions are judged from what the app does and shows, never from Convex feature counts alone.

Human criteria stay editable only in the Criteria section, so there is one source of truth. Edits apply on the next AI run; results already saved keep the label and score from their run. Deleting a human criterion prunes its AI weight and toggle automatically, and older results keep their history. These weights affect the AI ranking only; human results stay unweighted plain totals of the 1 to 5 or 1 to 10 scores.

## Social proof

Submissions can include a LinkedIn link and an X or Bluesky link. Before each review the judge takes one **snapshot** per link and stores it, so the AI prompt and every human judge read the same numbers captured at the same moment:

- **X posts** are read through Firecrawl's X engine (post text, author, date, likes, retweets, replies), with a text only oEmbed fallback when metrics are not returned.
- **Bluesky posts** are read through Bluesky's public API (text, author, date, likes, reposts, replies). No key needed.
- **LinkedIn** blocks automated reads and answers even nonexistent posts with a login wall, so the judge records the link as **unverified** (post and engagement) and tells the model to give at most partial credit. Human judges open the post to check it.
- A **profile URL** (x.com/name, linkedin.com/in/name) is recorded as a profile, not a launch post, and the model is told a profile alone is not a launch.
- **Views are never collected**: only the paid X API exposes them and LinkedIn never does, so scoring on views would be unfair across platforms.

The AI judge gets a fixed rule it cannot be prompted out of: never invent or estimate engagement numbers, only cite the ones in the snapshot. Add the **Social proof** preset from Rubric weights to score launch posts as their own criterion, or mirror your human "Social proof" criterion with the toggle above; both read the same snapshot. Human judges see a **Social proof** card under Project Links with the post text, metric pills, and the capture time. AI Results shows a **social** chip when a readable post was included.

Snapshots refresh on their own during an AI run once they are older than a day. The **Social proof snapshots** card in the AI judge section has a **Refresh social proof** button that re captures every submission in the group right now; run it once when submissions close so all teams are measured at the same moment.

## Sponsor stack detection

When the repo is fetched, the judge also records which sponsor tools the team really integrated and how: **AgentMail**, **Firecrawl**, and **OpenAI**, each tagged as a Convex component used in code, an npm SDK dependency or import, an API key env var referenced in \`convex/\` source, a direct HTTP call to the sponsor API, or (for OpenAI) a model routed through the Convex AI gateway. It also names every **model provider** it can see (OpenAI, Anthropic, Google, Mistral, Groq, xAI, OpenRouter, Meta, DeepSeek) from SDK deps, API key env vars, and model id families.

These are recorded facts, not scores. The prompt gets a \`SPONSOR STACK EVIDENCE\` section and a providers line, plus a fixed rule that the model must describe what those sections show, never claim an integration they do not show, and never move a rubric score because of sponsor usage. The sponsor stack stays a human criterion. Results show green sponsor chips (with the matched signals in the tooltip) and a neutral \`models:\` chip on each card, in the compare view, and on the public results page; the brief, recap, and report exports carry the same lines, and the Stats tab rolls them up. An empty list means the repo was scanned and nothing was found; no list means the repo was not fetched.

## Event window and late submissions

The **Event window** in the AI judge settings card takes a start and an end **with time of day** (saved in your time zone; the card shows exactly what will be stored under each field). They do two jobs:

- **Event start** feeds the build timeline check: the first commit in the repo is compared with the start and the result shows as **built in window** or **started before** chips on AI results. Commit dates can be rewritten, so treat it as a signal, not proof.
- **Event end** is the **submission deadline**. A submission whose site creation time is after the end is labeled **Late submission**.

What the late label does:

- The AI judge gets a \`SUBMISSION TIMING\` section with the exact submitted time, the deadline, and how late the entry was. A fixed rule (not editable from the system prompt) says: score every criterion normally, never change a score because of timing, and open the overall note with a "Late submission: received N hours after the deadline; organizers decide eligibility" sentence. If the model skips it, the server adds it.
- Human judges see a red **Late submission** chip next to the title in the judging interface and a short **Late** flag in the search list. Scoring stays on. The How to judge page and its Markdown export gain a Late submissions section explaining the label while an end is set.
- Admins see the chip on AI results (admin and public pages), a **Late** flag in the Submitted column of View submissions, an **Eligibility** filter on AI results with **Submitted on time** and **Late submissions** options, and a Submission timing line in the brief, recap, and hackathon report.

What it does not do: it never removes a submission, hides it, blocks scoring, or lowers a score. "Late" is a flag for organizers, the same stance as the build timeline check. It is computed on every read from the group's current event end, so changing the deadline updates every badge live; AI notes already written keep the sentence from their run until the next one. Leave the end empty and nothing is labeled late.

## Show AI review to judges

The **Show AI review to judges** block under Custom AI criteria is a single Visible/Hidden toggle (Hidden by default). When Visible, every submission with a completed AI review shows a collapsed **AI review** card in the human judging interface, under Project Links: the weighted score in the header, per criterion score and reasoning, the overall note, the model, and whether the live app answered. Harness signals, git facts, discrepancies, and second opinion data never reach judges. Pending or failed reviews render nothing, so a broken run cannot leak an error. Switching the toggle updates open judge sessions immediately, and the group's How to judge page describes the card in its AI review section while the toggle is on.

## Second opinion (Jev)

The **Second opinion** block under Custom AI criteria turns on a per group advisory pass by **Jev**, the Convex AI gateway's decisions model (alpha). When on, each review also asks Jev to score the same rubric from the text context (repo, verified facts, scraped page, transcript; no screenshot, and very large repos are truncated to fit its window). Jev returns a score plus how sure it was, and AI Results shows it beside the judge's score with a **disagrees** flag when the two sit 3 or more points apart. It is advisory only: totals, weighted scores, and ranking never change. If the Jev call fails, the review still completes without it.

## Editable system prompt

The AI judge section shows the full prompt body the model runs with. You can edit it, paste a replacement, or **reset to default** at any time. The \`{{rubric}}\` placeholder expands to the criteria list, and the JSON response format is always enforced server side, so a custom prompt cannot break score parsing.

## Models and environment variables

Model calls go through the **Convex AI gateway**, which authenticates with the deployment's own service token. No Anthropic, OpenAI, or OpenRouter key is read by this deployment. The judge model defaults to \`anthropic/claude-fable-5\` and can be switched from the Convex dashboard by setting \`AI_JUDGE_MODEL\` to any id from the gateway model list; the AI judge, group summary, and spam check all move together, and each saved result records the model that produced it. Jev (\`typesafe/jev-1.13\`) is fixed and only used by the second opinion and the spam classifier toggles. Set these in the Convex deployment environment:

| Variable | Required | Purpose |
| --- | --- | --- |
| \`AI_JUDGE_MODEL\` | Optional | Gateway model id for the judge, summary, and spam check (default \`anthropic/claude-fable-5\`) |
| \`GITHUB_TOKEN\` | Yes | Authenticated GitHub API access for repo reading |
| \`FIRECRAWL_API_KEY\` | Optional | Website content fetching and the live app screenshot |
| \`CONTEXT_DEV_API_KEY\` | Optional | Video transcript fetching (YouTube captions and video host pages) |

## Running and reviewing

- **AI Results** on a group row opens the AI dashboard: start a review run, watch per-submission status, retry failures, and read full reasoning per criterion.
- Failed submissions can be **retried** individually.
- **Shortlist top N**: once results are complete, pick a **5**, **10**, or **20** preset or type a number and click Shortlist top N to flag the top N by weighted score for human judges (ties at N included). Each result row has a star toggle to add or remove it by hand, and a Shortlisted badge. Judges only see the shortlist after the group's **Judge queue** setting is switched to Shortlist only; a **Below the cut** status line under the bar says whether the rest stay visible read only (**Show submissions below the cut to judges** in Settings) or are hidden. See Shortlist under Submissions.
- Admins can **edit AI scores** and reasoning; edits are stamped with the editor and time.
- The **Eligibility** filter narrows the list to built in window, started before, submitted on time, or late submissions (the timing options appear once the group has an event end). Rank numbers stay fixed while filtering.
- **Rubric weights** are editable per group and re-rank existing results instantly since weighted totals are computed at read time. Per-criterion on/off toggles take effect on the next AI run.
- AI results can be exposed at \`/api/judging/your-slug/results.json\` (public, password protected, or key protected depending on group settings).`,
  },
  {
    id: "agent-judges",
    title: "Agent judges",
    icon: Bot,
    content: `# Agent judges (external AI judges over HTTP)

Beyond the built-in AI judge, any external AI agent can judge a group through an authenticated HTTP API. The agent reads the criteria, works through its submission queue, and posts scores that land next to human judges in results and tracking.

## AI judge vs agent judges

These are two different features. The **AI judge** runs inside this app: you enable it per group, it reviews every submission against the AI rubric, and its results live on the AI Results page. **Agent judges** are outside programs (someone running Claude Code, Codex, or a custom script as a judge) that call this API with a key and post scores on the group's **human criteria**, landing in the human results as an \`agent\` judge identity, advisory by default. You do not need agent keys for the built-in AI judge; leave the Agent API toggle off unless an external agent will be judging.

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
- **Use Jev for the verdict** (default off): ask Jev, the gateway's decisions model (alpha), for the spam / suspicious / clean call. Its confidence is the real probability Jev assigned to the chosen verdict, which makes the confidence threshold above a calibrated cutoff instead of a model's self estimate. Reasons come from fixed yes/no checks (dead or placeholder URL, empty repo, gibberish or template text, unrelated promotion, links pointing elsewhere), and the AI spam review prompt becomes Jev's verdict instructions. If Jev fails, the scan falls back to the chat model, then the heuristic.

Auto-marked rows show an **Auto-marked spam** badge with a robot icon in both the scan results and the Marked spam review. **Unmark** reverses an auto-mark exactly like a human mark.

## What a scan checks

Each scan combines measured facts with an AI verdict:

- **Live URL check**: a direct request to the app URL with the status code recorded.
- **Page content**: a Firecrawl scrape of the app URL so the AI reads the real page.
- **GitHub repo**: reachable or not, file count, and empty-repo detection (fewer than three files).
- **Duplicates**: how many other submissions share the same URL.
- **Extra links**: video, LinkedIn, and X liveness, treated as weak signals since social sites block bots.
- **AI verdict**: spam, suspicious, or clean, with a confidence score and short reasons. Uses the same Convex AI gateway model as the AI judge, or Jev when **Use Jev for the verdict** is on. If the model call fails, a deterministic heuristic scores the hard signals instead. Each result footer names the provider and model that produced the verdict.

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
| \`FIRECRAWL_API_KEY\` | AI judge, spam check | Website content fetching plus the AI judge's live app screenshot. Optional for the AI judge; the spam check scans still complete without it. |
| \`CONTEXT_DEV_API_KEY\` | AI judge | Video demo transcript fetching via Context.dev (YouTube captions plus video host pages). Optional; reviews run without it. |
| \`ADMIN_EMAIL\` | Spam check | Optional. Reply-to address on spam notification emails so submitters can reach the admins. |
| \`LUMA_API_KEY\` | Luma events | Calendar-scoped key from luma.com/calendar/manage/api-keys. Set with \`npx convex env set LUMA_API_KEY your-key\` (add \`--prod\` for production). The admin Settings tab stores the calendar URL and event placements; the key never goes in the database. |

Model calls for the AI judge and spam check go through the Convex AI gateway using the deployment's own service token, so no provider API keys are needed. The spam check falls back to a deterministic heuristic if the model call fails. Everything else in the judging system (groups, criteria, human judges, agent keys, results) works without any environment variables. Luma listings stay hidden until the key is set and an admin syncs events.`,
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
