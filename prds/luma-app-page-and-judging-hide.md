# Luma on app pages and per-group hide

Created: 2026-08-22 08:24 UTC
Last Updated: 2026-08-22 08:35 UTC
Status: Done

## Problem

Upcoming Luma events sit next to the back chevron on story detail instead of below View Change Log. There is no site-wide App page toggle in Sidebar widgets, and the Luma section does not share that gate. Judging groups cannot hide Luma on their submit and public pages. Other sidebar widgets stay site-wide only.

## Root cause

`story_detail` is a per-event placement only. Layout never uses it (story pages have no catalog sidebar). StoryDetail rendered the list in the sticky back column. `sidebarWidgets` has no Luma row. Judging groups have no `hideLumaEvents` field.

## Proposed solution

- Add optional `sidebarWidgets.lumaEvents` with the same surfaces as the other widgets plus `storyDetail`. Entire app stays in sync with `lumaConfig.enabled`.
- Move Upcoming events on `/s/:slug` to a section under View Change Log, gated by `lumaEvents.storyDetail`.
- Keep the same Luma row in Sidebar widgets and matching checkboxes in the Luma section (one settings object).
- Add `judgingGroups.hideLumaEvents`. Default off (show). Each group can hide Luma on its submit, join, and judging landing pages even when site Luma is on. Site catalog surfaces do not apply to those group pages. Other widgets stay site-wide with no per-group hide.

## Files to change

- `convex/schema.ts` - lumaEvents widget row; hideLumaEvents on judging groups
- `convex/settings.ts` - defaults, merge, sync enabled with lumaConfig
- `convex/luma.ts` - sync entireApp when enabled changes; default story_detail placement
- `convex/judgingGroups.ts` - field on update/get queries
- `src/lib/sidebarWidgets.ts` - luma visibility helper
- `src/components/admin/Settings.tsx` - Luma row plus App page column
- `src/components/admin/LumaEventsSettings.tsx` - matching surface checkboxes
- `src/components/admin/judging/GroupOverviewSection.tsx` - hide toggle
- `src/components/Layout.tsx` - gate catalog Luma with the widget row
- `src/components/StoryDetail.tsx` - section below View Change Log
- `src/components/LumaEventList.tsx` - optional enabled skip
- `src/pages/JudgingGroupSubmitPage.tsx`, `JudgingGroupJoinPage.tsx`, `JudgingGroupPage.tsx`
- `task.md`, `changelog.MD`, `files.MD`

## Edge cases

- Missing `lumaEvents` on old settings docs merges to defaults (on, grid off, storyDetail on).
- Per-event placements still required. App page widget on with no `story_detail` placement shows nothing.
- `hideSubmitPageSidebar` still hides the whole /submit aside including Luma.
- Judging hide does not affect `/submit`, catalog, `/events`, or story detail.
- Other widgets still have no judging-group override.

## Verification

- [x] App page widget off hides Luma under View Change Log
- [x] App page widget on plus event `story_detail` shows the section below the changelog link
- [x] Toggling Entire app in the matrix flips Show listed Luma events and the reverse
- [x] Judging group hide removes Luma on submit, join, and judging landing only
- [x] Catalog Luma still follows list/grid/vibe/submit/categories
- [x] Most Vibes / Recent Vibers / Top Categories unchanged
