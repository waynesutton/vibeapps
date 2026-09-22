# How to judge page, shortlist workflow, AI review for judges

Created: 2026-09-22 07:48 UTC
Last Updated: 2026-09-22 07:48 UTC
Status: In Progress

## Problem

Every hackathon so far has shipped a hand written Google Doc to judges (Modern Stack, TanStack Start). Each one repeats the same login steps, status system, and rating scale, then adds the event's real links, criteria, deadline, and contact. The docs go stale the moment a slug, criterion, or password changes, they leak access codes when forwarded, and there is nowhere in the app that explains the two newer pieces of the flow: the AI judge and the "AI reviews everything first, humans judge a top N" pattern.

Three gaps in the app itself:

- No judge facing page per group. `AdminDocs` has a generic External Judging Process, but judges do not have admin accounts and the text has no real links or criteria.
- No shortlist. Organizers who run the AI judge first have no way to hand only the top N to human judges without creating a second group and re entering criteria and passwords.
- Judges cannot see the AI review. `aiJudgeResults` is visible only in admin and on the optional `/ai-results` page.

## Decisions (confirmed with the user)

- Public route `/judging/{slug}/howtojudge`. Admin paths would 404 for judges. The page holds no secrets: the access code area shows the literal `passcodegoeshere` (editable) and tells judges the real code arrives by Slack or email.
- Shortlist inside the same group (`judgingGroupSubmissions.shortlisted`) with a group setting `judgeQueueMode` so the same link, passcode, criteria, and results carry the final round.
- Per group `aiReviewVisibleToJudges` toggle that renders a collapsed AI review card on each submission in the judging interface. Off by default.

## Proposed solution

### Data

`judgingGroups` gains three optional fields: `judgeQueueMode` (`all` | `shortlist`), `aiReviewVisibleToJudges`, and a `howToJudge` settings object (enabled, accessCodeNote, deadlineAt, contact, privateRepoNote, assignments, notes, links, showResultsLink). `judgingGroupSubmissions` gains `shortlisted` and `shortlistedAt`.

### Backend

- `convex/lib/judgeQueue.ts`: `isInJudgeQueue(group, submission)` so every reader of the human queue applies one rule. Used by `getGroupSubmissions`, `getJudgeProgress`, `getAgentQueue`, and `getGroupScores`. AI runs still cover every submission.
- `judgingGroupSubmissions.ts`: `setShortlisted` and `shortlistTopByAiScore` (both `judging.manage`, logged to the group Activity log); `listSubmissionsTable` returns `shortlisted`.
- `judgingGroups.ts`: `updateGroup` accepts `judgeQueueMode` and `howToJudge`; `getGroupWithDetails` returns them plus `shortlistCount`; new public `getHowToJudgePage({ slug })` that never returns a password field.
- `judges.ts`: `getJudgeSession` returns `judgeQueueMode` and `aiReviewVisibleToJudges`.
- `aiJudge.ts`: `updateAiReviewVisibleToJudges` (`judging.ai`) and `getAiReviewForJudge` (judge session plus toggle, completed results only, trimmed payload).

### Frontend

- `HowToJudgePage.tsx`: Notion style document with a TL;DR card, sticky section nav, live criteria and links, generic screenshots from `public/docs/judging/`, an AI review section only when the AI judge is on, and organizer blocks only when filled. Links repeat at the bottom.
- `GroupHowToJudgeSection.tsx`: admin editor for the organizer fields plus Copy Markdown and Download .md built by `src/lib/howToJudgeMarkdown.ts` for the Google Doc.
- Shortlist controls in `AIJudgeResults.tsx` (Shortlist top N, per row toggle), `GroupSubmissionsTableSection.tsx` (Shortlisted column, filter), and `GroupSettingsSection.tsx` (Judge queue setting with a zero shortlist warning).
- `AiReviewCard.tsx` rendered in `JudgingInterfacePage.tsx` after the Social proof card when the toggle is on; toggle lives in `GroupAiSection.tsx`.
- `GroupLinksSection.tsx` lists the How to judge page. `AdminDocs.tsx` documents everything here plus the countdown timer and sponsor stack detection.

## Files to change

- `convex/schema.ts`
- `convex/lib/judgeQueue.ts` (new)
- `convex/judgingGroupSubmissions.ts`, `convex/judges.ts`, `convex/agentJudges.ts`, `convex/judgeScores.ts`
- `convex/judgingGroups.ts`, `convex/aiJudge.ts`
- `src/App.tsx`, `src/pages/HowToJudgePage.tsx` (new), `src/lib/howToJudgeMarkdown.ts` (new)
- `src/components/admin/judging/GroupHowToJudgeSection.tsx` (new), `GroupLinksSection.tsx`, `GroupSettingsSection.tsx`, `GroupSubmissionsTableSection.tsx`, `GroupAiSection.tsx`, `src/pages/AdminJudgingGroupPage.tsx`
- `src/components/admin/AIJudgeResults.tsx`, `src/components/admin/AdminDocs.tsx`
- `src/components/judging/AiReviewCard.tsx` (new), `src/pages/JudgingInterfacePage.tsx`
- `public/docs/judging/*.png` (new screenshots)

## Edge cases

- Shortlist mode with zero shortlisted: judges get the existing No Submissions state; the setting warns in red first.
- Shortlist top N replaces the set; ties at position N are all kept.
- Removing a submission drops its flag with the row. AI runs and AI results always include every submission.
- Inactive group: the page renders with a paused banner. `howToJudge.enabled === false` returns null and the route 404s.
- The AI card shows only completed results; pending or failed reviews render nothing.
- `getAiReviewForJudge` throws without a valid judge session for the group and returns null when the toggle is off.

## Verification

1. `npm run typecheck`, `npm run typecheck:convex`, eslint on touched files, `npx convex dev --once`.
2. Dev group end to end: AI run, Shortlist top 3, Judge queue = shortlist, judge sees 3, agent `submissions.json` returns 3, results denominator is 3, back to All restores the full list.
3. AI review toggle on and off with the card appearing only for completed results; session check on the query.
4. `/judging/{slug}/howtojudge` signed out on desktop and mobile widths; AI section only when the AI judge is on; organizer blocks only when set; paused banner; 404 when disabled.
5. Copy Markdown renders headings, links, and criteria in a Google Doc.
6. Existing judging login, results, AI results, and Links export unchanged.

## Task completion log

- 2026-09-22 07:48 UTC: PRD written, plan confirmed with the user.
- 2026-09-22 08:58 UTC: Shipped. Schema, `isInJudgeQueue` helper, shortlist mutations, `getHowToJudgePage`, `getAiReviewForJudge`, the public page with generic screenshots, Markdown export, admin How to judge section, shortlist UI, Judge queue setting, AI review toggle and card, AdminDocs. Verified: app and convex `tsc` zero errors, eslint zero errors on touched files, convex dev push; on the dev group `github links` (6 memberships, one hidden story) Shortlist top 3 flagged 4 rows (both 1.4 ties kept, hidden story skipped after a fix to `shortlistTopByAiScore` that now checks `isStoryValidForJudging` like the AI results view and table do), Judge queue = Shortlist only gave the judge `Progress: 4/4` and `Submission 1 of 4`, back to All restored `1 of 5`, the AI review card vanished and returned live as the toggle flipped without a reload, and `/judging/{slug}/howtojudge` rendered every section with the AI section present and no passcode chip for a public group. Not run: a paste into a real Google Doc (Markdown builder output checked by eye), `submissions.json` through an agent key.
