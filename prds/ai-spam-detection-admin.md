# AI spam detection for admin

Automatic and on-demand spam scanning for submissions, with an admin tab to review verdicts and act on them in bulk.

## Problem

Spam submissions (dead URLs, link farms, empty repos passed off as apps, duplicate mass submissions) land on the site looking like real apps. Admins find them by hand, one at a time, with no evidence trail and no way to tell the submitter why their post was removed.

## Solution

Every new submission gets an AI spam scan automatically. Admins can also batch scan recent submissions from a new AI Spam tab. Each scan combines deterministic checks with an AI verdict:

1. Live URL check: direct HTTP request with timeout, status code recorded
2. Page content: Firecrawl component scrape of the app URL (markdown, main content only, cached one hour)
3. GitHub repo check: reachable, file count, effectively-empty detection (uses GITHUB_TOKEN when set, works unauthenticated otherwise)
4. Duplicate detection: other submissions sharing the same URL (by_url index)
5. Extra links: video, LinkedIn, X liveness (flagged as weak signals since social sites block bots)
6. AI verdict: spam, suspicious, or clean with confidence 0 to 100 and short reasons, using the same provider chain as the AI judge (Anthropic, then OpenAI, then OpenRouter). With no key configured, a deterministic heuristic scores the hard signals instead.

The verdict never punishes low quality. Only deception and irrelevance: dead sites, empty repos, unrelated promo content, duplicates.

## Marking as spam

Marking a flagged submission as spam (single or bulk):

- Hides the story and labels it with isSpam, spamReason, spamMarkedAt, spamMarkedBy
- Sends the submitter an in-app alert (type spam): the dropdown and notifications page say the post was marked as spam and removed, with a check-your-email pointer and a link to the repo GitHub issues page for appeals
- Emails the submitter the reason with a reply-to pointing at ADMIN_EMAIL when that env var is set, plus the same GitHub issues link; the email goes through the shared sendEmail action so the global emailsEnabled kill switch in admin email settings applies
- The reason defaults to the AI scan's reasons; admins can type a custom one in the bulk bar
- Unmark reverses everything: label cleared, story visible again
- Deletion stays a separate explicit action (bulk delete cascades comments, votes, ratings, bookmarks, scan rows, and stored images)

## Admin tab

New AI Spam tab in the admin dashboard (visible with moderation.view):

- Counts strip: scanned, spam, suspicious, clean, marked, in progress, failed
- Filter by verdict (all, spam, suspicious, clean, marked, failed) and sort (newest, oldest, highest confidence)
- Date range filter on submission time (start and end date inputs, end date inclusive through end of day, Clear dates link); the range filters the results list server-side and also scopes the scan buttons
- Select all plus per-row checkboxes; bulk bar with mark as spam (optional custom reason), hide, delete (moderation.delete)
- Each row: title link, verdict badge with confidence, submitter, URL and repo status inline, duplicate count, AI reasons
- Expandable details: full AI reasoning, reason sent to the submitter, signal breakdown, provider and model, scan time
- Per-row actions: mark or unmark spam, re-scan
- Scan recent (unscanned only) and Re-scan all recent buttons queue up to 100 submissions; with a date range set they pull from that window (built-in by_creation_time index) instead of the most recent
- AI prompt button opens an editor for the spam verdict system prompt: shows the active prompt with a custom badge when overridden, saves a custom version (moderation.moderate), and resets to the built-in default behind a confirm dialog. The override lives in appSettings under spamCheckSystemPrompt; saving empty text or the exact default clears it. Future scans use the active prompt

Moderation tab rows show a red Spam badge on confirmed submissions.

## Architecture

- `spamCheckResults` table: one row per story, status pending/running/completed/failed, verdict, confidence, reasons, llmReasoning, signals object, provider, model, triggeredBy auto or manual
- Dedicated workpool (`spamWorkpool`, parallelism 3) so batch scans never compete with the AI judge pool
- `convex/spamCheck.ts`: admin query (listSpamResults with server-side filter/date range/sort and counts), startBatchScan (optional date range), scanStory, markAsSpam, unmarkSpam, bulkMarkAsSpam, bulkHide, bulkDelete, plus internal upsert/enqueue, markRunning, getStoryForAnalysis, saveResult
- `convex/spamCheckAnalysis.ts`: analyzeSubmission internal action running the checks and verdict; failures are written to the row, never thrown upstream
- `convex/emails/spam.ts`: sendSpamNotificationEmail with getSpamEmailContext (prefers account email, falls back to form email, skips silently when neither exists)
- Auto scan scheduled fire-and-forget from stories.submit and stories.submitAnonymous
- Firecrawl runs through the `@firecrawl/firecrawl-convex` component wired in convex.config.ts with FIRECRAWL_API_KEY bound by typed component env

## Environment variables

- `FIRECRAWL_API_KEY` (already set, shared with the AI judge): page scraping; scans still complete without content when scraping fails
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` (any one, already used by the AI judge): AI verdict; heuristic fallback otherwise
- `GITHUB_TOKEN` (optional): higher GitHub rate limits for repo checks
- `ADMIN_EMAIL` (optional): reply-to on spam notification emails

## Permissions

- View tab and results: moderation.view
- Scan, mark, unmark, hide: moderation.moderate
- Bulk delete: moderation.delete

## Out of scope

- Auto-marking without human confirmation (scans only flag; an admin always confirms)
- Scanning comments or users (submissions only)
- Appeal workflow beyond email reply-to
