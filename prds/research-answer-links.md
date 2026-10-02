# Research chat: copy a link to an answer

Created: 2026-10-02 07:36 UTC
Last Updated: 2026-10-02 07:38 UTC
Status: Done

## Problem

Admins want to share one specific research answer with a teammate who has access to the judging group. Today the URL only carries the thread (`?section=research&thread=`), so the teammate lands at the bottom of a long thread and has to hunt for the answer. Threads older than the 50 newest also fall out of the list, so a thread link to an old chat opens an empty new thread instead.

## Proposed solution

- Answer deep link: `/admin/judging/{slug}?section=research&thread={threadId}&message={messageId}`. Message ids already exist, and retry reuses the same id, so links work for every past answer with no migration.
- "Copy link" button in each answer's action row (beside Copy, Download, Retry). It copies the absolute URL from `window.location.origin`, so it works on dev, preview, and production. It then shows a check and a toast saying who can open the link.
- Opening a link: the workspace picks the thread and the chat scrolls to the question above the answer (so the context reads first) and briefly outlines the answer. Auto follow to the bottom is paused so streaming does not pull the reader away.
- Older threads: new `research.getThread` query (same research permissions) resolves a thread outside the 50 item list. It takes the raw URL string and uses `ctx.db.normalizeId`, so a mangled link returns null instead of throwing.
- Missing thread or answer: a toast explains it ("deleted or not in this group" or "no longer in this thread") and the stale params are cleared, so the page never breaks.
- Selecting another thread clears `message` from the URL.

## Files to change

- `convex/research.ts`: `getThread`.
- `src/components/admin/research/researchExport.ts`: `researchAnswerUrl`.
- `src/components/admin/research/GroupResearchSection.tsx`: resolve linked thread, pass the focus id, clean params.
- `src/components/admin/research/ResearchChat.tsx`: scroll to and highlight the linked answer.
- `src/components/admin/research/ResearchMessageView.tsx`: Copy link action and highlight state.

## Edge cases

- Recipient without research access: the existing section permission gate applies; no data leaks.
- Research turned off: settings card shows, threads are hidden until it is on again (unchanged).
- Answer still streaming: Copy link appears once it settles, same as other actions.
- Retried answer: same id, link still works.
- Deleted thread or answer, malformed id: toast plus param cleanup.
- Reduced motion: no highlight transition.

## Verification

- `npm run typecheck:convex`, `npm run typecheck`, `npm run lint`, `npx convex dev --once`.
- CLI: `research:getThread` with a real id, a malformed id, and an id from another group.

## Task completion log

- 2026-10-02 07:36 UTC: PRD created.
- 2026-10-02 07:38 UTC: Implemented. Typecheck, lint, and `convex dev --once` pass. `getThread` returns null for a malformed id and for an id from another table. A real link has not been clicked in the browser yet because the dev group has no threads. Also moved the thread switch ahead of `deleteThread` so your own delete never triggers the missing thread toast.
