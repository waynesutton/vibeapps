# Grid view cards

Created: 2026-08-22 06:45 UTC
Last Updated: 2026-08-22 06:45 UTC
Status: Done

## Summary

Restyle homepage and tag-page grid cards to match the screenshot: 16:9 thumbnail on top, title then description, compact time on the left, vote pill (`▲` plus count) in the bottom right. Card and thumbnail radii stay as they are. List and vibe views stay unchanged.

## Problem

The current grid card puts the upvote chevron, vote count, and title in one header row above the screenshot. That fights the scan path. The mockup reads image first, name, blurb, then a quiet footer with time and votes.

## Root cause

Grid layout was frozen during the list-view restyle. Vote and title still share the top row.

## Proposed solution

Change only `renderGridCard` in `src/components/StoryList.tsx`. Tag pages already pass `viewMode` into `StoryList`, so they pick this up with no page changes.

Card stack:

1. 16:9 screenshot (`aspect-video`, existing `rounded-md`, letter fallback)
2. Title (`.app-title`) with pin if needed
3. Description (`.app-desc`, two-line clamp)
4. Visible tags as small pills so category browsing still works
5. Footer pinned to the bottom: compact time plus comment/bookmark/repo icons on the left, vote pill on the right

Vote pill: `ChevronUp` plus tabular count, `rounded-full`, `bg-brand-soft` so the fill follows each theme. Click still calls `handleVote`. Clerk gate unchanged.

Hover is color-only (`hover:bg-surface-hover`), no scale or shadow. Taken from the Open Analytics hover rule: cards never lift.

Do not change `rounded-lg` on the card or `rounded-md` on the thumbnail. Do not restyle list, vibe, or admin.

## Files to change

- `src/components/StoryList.tsx` - grid card only
- `.interface-design/system.md` - grid pattern
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Missing screenshot still reserves 16:9 so the grid baseline does not jump
- `mt-auto` plus `h-full` keeps the vote pill on the bottom of short cards
- Search and `/tag/:slug` reuse `StoryList`, so they get the new card automatically
- Bookmark, comments, and repo stay as footer icons so those actions are not lost

## Verification

- [ ] Grid matches the mockup stack in light, classic, and dark (needs a visual pass)
- [x] Card `rounded-lg` and thumb `rounded-md` unchanged
- [x] List and vibe code paths untouched
- [x] Tag page grid uses the same `StoryList` card
- [x] Vote, bookmark, comments, and story links still wired
- [ ] 375px: one column, vote pill still tappable (needs a visual pass)
- [x] ESLint clean on `StoryList.tsx`

## Task completion log

- 2026-08-22 06:45 UTC - PRD drafted. Implementation in `StoryList.tsx`.
- 2026-08-22 06:45 UTC - Grid card shipped. Screenshot first, title, two-line description, footer with compact time and `▲` vote pill. Radii unchanged. ESLint clean.
