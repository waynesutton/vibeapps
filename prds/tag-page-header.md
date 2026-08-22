# Tag page header

Created: 2026-08-22 06:20 UTC
Last Updated: 2026-08-22 06:28 UTC
Status: Done

## Problem

The `/tag/:slug` page stacks three rows of chrome before the first app: a "Back to Apps" link, an "Apps tagged with" heading plus the tag pill, and an "N apps found" line. That layout is the same in list, grid, and vibe. It wastes vertical space, duplicates the header "All" pill, and sits in a `max-w-4xl px-4 py-8` wrapper so the results column is narrower and more padded than the homepage.

## Root cause

TagPage treats the filter as a standalone article page (back link, large h1, subtitle) instead of a catalog filter state. The list, grid, and vibe renderers are already shared with the homepage via `StoryList`. Only the page chrome is wrong.

## Proposed solution

One identity row, then the same `StoryList` as the homepage.

Left: icon-only back chevron (44px hit target, `aria-label="Back to all apps"`) + "Apps tagged with" + the tag as a `rounded-full` pill matching header pills.
Right: tabular count (`17 apps`).

Drop the "Back to Apps" text. Persistent header nav plus the "All" pill already return to the catalog. Keep the chevron for deep-linked visits that have no in-app history. Drop the extra `max-w-4xl px-4 py-8` so list/grid/vibe match homepage column width.

## Files to change

- `src/pages/TagPage.tsx`
- `.interface-design/system.md` (tag page header pattern)
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Tag still loading: compact "Loading tag..." with no stacked chrome
- Unknown slug: same one-row back chevron plus "Tag not found"
- Zero apps: keep the empty state under the identity row
- Count undefined: hide the count rather than flash "Loading..."
- Long tag names: pill does not shrink; heading can wrap on 375px; chevron and count stay `shrink-0`
- Emoji vs iconUrl: same rules as header pills

## Verification

- Identity is one row in list, grid, and vibe
- No "Back to Apps" text
- Chevron returns to `/`
- Count reads `1 app` / `N apps`
- TagPage column width matches homepage StoryList
- Light, classic, dark: tokens only, pill uses stored tag colors
- 375px: phrase is `sr-only`, pill and count stay on one row, 44px chevron hit target
- eslint clean on TagPage

## Task completion log

- 2026-08-22 06:28 UTC: Shipped one-row tag header in `src/pages/TagPage.tsx`. Dropped stacked back text and extra padding. Pattern saved in `.interface-design/system.md`. eslint 0 errors.
