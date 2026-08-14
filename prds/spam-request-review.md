# In-app spam review request

Created: 2026-08-14 01:05 UTC
Last Updated: 2026-08-14 01:15 UTC
Status: Done

## Problem

When a submission is marked as spam the author gets an in-app alert and an email. Disputing the mark depends on email deliverability (reply-to ADMIN_EMAIL) or a GitHub issue. There is no in-app path, so a dispute can silently go nowhere if the email bounces or the author never sees it.

## Proposed solution

Add a "Request review" button to the spam alert on the notifications page. Clicking it stamps the story with `spamReviewRequestedAt` and writes a `spam.reviewRequested` entry to the Activity log with the submitter as actor, so admins see the dispute inside the app. Admin spam views show a "Review requested" badge on disputed rows, and admins can dismiss a request (keep the mark) or unmark the story (which clears the request).

## Behavior

- Button only works for the story owner while the story is still marked as spam.
- Idempotent: requesting twice does nothing new; the button flips to "Review requested" and stays that way.
- `unmarkSpam` clears `spamReviewRequestedAt` (dispute resolved in the author's favor).
- `dismissSpamReviewRequest` (moderation.moderate) clears the flag while keeping the spam mark, and logs the dismissal.
- Deleting the story removes the request with it.

## Files to change

- `convex/schema.ts`: `spamReviewRequestedAt` optional number on stories.
- `convex/spamCheck.ts`: `requestSpamReview` mutation (owner), `getMySpamStatus` query (owner button state), `dismissSpamReviewRequest` mutation (admin), clear flag in `unmarkSpam`, expose `reviewRequestedAt` from `listSpamResults` and `listMarkedSpam`.
- `src/pages/NotificationsPage.tsx`: Request review button and copy on spam alerts.
- `src/components/admin/SpamCheck.tsx`: Review requested badge in scan results and marked review, dismiss action.
- `convex/emails/spam.ts`: email copy mentions the in-app button.
- `src/components/admin/AdminDocs.tsx`: dispute flow docs.

## Edge cases

- Anonymous submissions have no owner account, so no alert and no button; email plus GitHub stays their path.
- Story unmarked before the author clicks: mutation returns without stamping and the UI reports the post was restored.
- Story deleted before the author clicks: mutation reports the submission is gone.
- Silent auto-mark (notify off) sends no alert, so no button appears until an admin notifies; unchanged behavior.

## Verification

- `npx convex codegen` and `npx tsc -p tsconfig.app.json --noEmit` pass.
- Manual: mark a story as spam, open notifications as the author, click Request review, confirm Activity log entry and admin badge, then dismiss and unmark.

## Task completion log

- 2026-08-14 01:05 UTC: PRD created.
- 2026-08-14 01:15 UTC: Shipped. Schema field, three backend functions, unmark clears the request, disputed rows sort first in the review list, notifications button with persistent requested chip, admin badges plus Dismiss, email and docs copy. Codegen green, zero new tsc errors, zero lints. Docs synced.
