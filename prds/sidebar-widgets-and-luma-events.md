# Sidebar widgets, Luma events, compact back nav

Created: 2026-08-22 07:33 UTC
Last Updated: 2026-08-22 07:55 UTC
Status: Done

## Summary

Site admins get a Settings matrix to hide Most Vibes This Week, Recent Vibers, and Top Categories This Week per surface (entire app, list, grid, vibe, submit, categories). Entire-app hide wins over judging groups. Admins can also connect a Luma calendar, pick events, and place them in sidebars plus a public `/events` page. Back links collapse to the tag-page chevron pattern so headers waste less space.

## Problem

The three catalog sidebar blocks always render whenever the sidebar is on. There is no site-wide hide, no per-view control, and grid never gets a sidebar even if an admin wants it. Judging groups cannot be blocked from showing those blocks later. Upcoming Luma hackathons have no first-class slot. Text "Back to Apps" links sit on their own row above titles on submit and admin.

## Proposed solution

- Nested `sidebarWidgets` on the settings singleton. `entireApp: false` hides that widget everywhere and greys out per-surface checkboxes. `hideSubmitPageSidebar` still hides the whole `/submit` aside.
- Luma API key stays a Convex env var (`LUMA_API_KEY`). Admin stores a calendar URL, syncs events, lists selected ones, and sets per-event display + placement. Public queries never return the key.
- Shared `BackToAppsLink` (44px chevron) on submit, admin, search, events, and story detail. Admin title and back sit on one row.
- Layout sidebar also hides on `/admin`, `/notifications`, `/inbox`, `/leaderboard`, `/events`.

## Files to change

- `convex/schema.ts` - `sidebarWidgets` on settings; `lumaConfig` and `lumaEvents` tables
- `convex/settings.ts` - defaults, get, update
- `convex/luma.ts` - config, list, sync, add-by-url (queries/mutations/actions)
- `convex/crons.ts` - hourly Luma sync
- `convex/siteDirectory.ts` - `/events` in sitemap and directory
- `src/lib/sidebarWidgets.ts` - visibility helper
- `src/components/BackToAppsLink.tsx` - shared chevron back
- `src/components/LumaEventCard.tsx` - public event card
- `src/components/LumaEventList.tsx` - stacked events with hairline dividers
- `src/components/admin/LumaEventsSettings.tsx` - admin manager
- `src/components/admin/Settings.tsx` - widget matrix + Luma section
- `src/components/admin/AdminDashboard.tsx` - one-row header
- `src/components/Layout.tsx` - per-widget and Luma placement
- `src/components/StoryForm.tsx`, `SearchResults.tsx`, `StoryDetail.tsx`, `TagPage.tsx`
- `src/pages/EventsPage.tsx` - public events list
- `src/App.tsx`, `src/components/Footer.tsx`
- `src/components/admin/AdminDocs.tsx` - env + sidebar docs
- `task.md`, `changelog.md`, `files.md`

## Edge cases and gotchas

- API key is calendar-scoped. One deployment, one calendar.
- Queries stay deterministic: do not filter Luma events by `Date.now()` in Convex queries.
- If `entireApp` is off, judging group pages cannot show that widget even if a group setting is added later.
- Grid sidebar stays off by default so existing sites do not suddenly grow a column.

## Verification

- [x] Entire-app off hides a widget on list, vibe, submit, and tag pages
- [x] Per-surface checkboxes disable when entire-app is off
- [x] Hide submit sidebar still widens `/submit` and removes the aside
- [x] Grid can show the sidebar when a widget or Luma placement is on
- [x] Luma sync lists calendar events; listing one shows it in chosen slots and on `/events`
- [x] Submit and admin headers are one row with a 44px back control
- [x] Admin dashboard has no catalog sidebar

## Related

- [Luma API getting started](https://docs.luma.com/reference/getting-started-with-your-api)
- [List calendar events](https://docs.luma.com/reference/get_v1-calendars-events-list.md)
- `prds/submit-page-sidebar-setting.md`
- `prds/tag-page-header.md`
