# List view ranked rows

Created: 2026-08-22 05:57 UTC
Last Updated: 2026-08-22 07:00 UTC
Status: Done

## Summary

Restyle the homepage list view to match the ranked editorial mockup: two-digit rank, 16:9 screenshot, title plus one tag pill, one-line description, compact byline, comment count, and a pill "Vibe it" vote button. Grid and vibe views stay as they are.

## Problem

The current list row is a Product Hunt sketch with a square 48px thumb, tags under the title, a chevron upvote box, and a comment icon in the byline. The mockup is airier and easier to scan. The vote control should read as "Vibe it" with the count inside a pill, and screenshots should show at 16:9.

## Proposed solution

Change only `renderListRow` in `src/components/StoryList.tsx`. Use existing story fields. No schema or query changes.

Row, left to right, vertically centered:

1. Two-digit rank (`01`) in `text-faint` light weight, tabular nums
2. 16:9 screenshot (`aspect-video`) with a letter fallback when there is no image
3. Title (`.app-title`, truncates) plus the first visible tag pill on the same line
4. Description, one line (`.app-desc line-clamp-1`)
5. Byline: `by {name} · {compact time}` plus bookmark and repo icons so those actions are not lost
6. Compact comment count (`4c`) linking to `#comments`
7. Pill vote button: `Vibe it {votes}`, `rounded-full`, `border-ink`, 32px tall (`h-8`)

Smart choices that are not in the mockup but keep the product intact:

- Pin and admin `customMessage` stay
- Hidden and legacy tags stay filtered
- Only the first visible tag sits next to the title so the row does not wrap into tag soup
- Compact relative time (`14h ago`) in list only; grid and vibe keep the existing byline
- First three screenshots load eagerly to cut LCP, the rest stay lazy
- Mobile: smaller thumb and rank so the title still has room; comments stay in the byline under `sm` and move to `4c` from `sm` up
- Tokens only. Borders-only depth. Grid and vibe renderers untouched
- The whole list lives in one sidebar-matching plate (`bg-surface rounded-lg border border-hairline overflow-hidden`) so it lifts off canvas in every theme. Hairline dividers stay inside. Row hover is `surface-hover` clipped to the plate corners.

## Files to change

- `src/components/StoryList.tsx` - list row layout only
- `.interface-design/system.md` - document the new list row pattern
- `task.md`, `changelog.md`, `files.md` - project docs

## Edge cases and gotchas

- No `hasVoted` on the public story payload, so the pill cannot show a filled voted state without N extra queries. Press and hover states only.
- Pagination rank uses the accumulated `stories` index, so Load More keeps counting (`01` ... `21`).
- Search results reuse `StoryList`, so they pick up the new row automatically.
- Tag chip colors stay DB-driven in every theme.
- Thumbnail radius stays on the shared `0.25rem` scale. Vote control is the pill (`rounded-full`).

## Verification

- [x] List view matches the mockup structure in light, classic, and dark
- [x] Grid and vibe views are visually unchanged
- [x] Vote, bookmark, comments, repo, and story links still work
- [x] 375px: no horizontal scroll, vote pill still tappable
- [x] Missing screenshot shows a 16:9 letter block
- [x] ESLint clean on `StoryList.tsx`

## Task completion log

- 2026-08-22 05:57 UTC - PRD drafted. Implementation in `StoryList.tsx`.
- 2026-08-22 06:10 UTC - List row shipped and verified in the browser at 861px. Title-to-tag gap fixed so the pill sits next to the title instead of the vote cluster.
- 2026-08-22 06:12 UTC - Rank type dropped from 20/26px to 15px so it sits under the 18px title. Vote pill dropped from 44px (`h-11`) to 32px (`h-8`).
- 2026-08-22 06:20 UTC - Full-row hover wash via `hover:bg-surface-hover` so light, classic, and dark each supply their own tint. Vote pill stays `bg-surface` so it does not dissolve into the row.
- 2026-08-22 07:00 UTC - List wrapped in a sidebar-matching surface plate so rows sit on white (light/classic) or charcoal (dark) instead of canvas. Hover wash still uses `surface-hover`.
