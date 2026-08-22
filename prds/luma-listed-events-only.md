# Luma listed events only

Created: 2026-08-22 09:15 UTC
Last Updated: 2026-08-22 09:25 UTC
Status: Done

## Problem

Production Admin Settings shows every event from the connected Luma calendar under Calendar events. The admin only wants events added with Add a Luma event URL. Pasting `https://luma.com/abstract-convex-26` (Abstract Conference by Convex, Sep 2 2026) did not put that event in the list.

## Root cause

Hourly `syncFromApi` and Sync calendar insert up to 80 calendar rows with `isListed: false`. `getAdminState` returns all of them, so the UI is a calendar dump. Add-by-URL calls `/v1/calendars/events/lookup`, which returns `{ id, status }` with no name. `parseLumaEvent` requires a name, so lookup is dropped. The fallback lists calendar events oldest first and can miss a future event. Abstract is on the Convex.dev calendar (`evt-04ACgEKf52voPEj`) but never made it into the listed set.

## Proposed solution

- Admin Calendar events shows only `isListed` rows (events added by URL).
- Sync refreshes titles, dates, and covers for listed events. It does not import the rest of the calendar. Unlisted leftover rows are deleted.
- Add-by-URL: lookup id, then `GET /v1/events/get`. If that fails, parse the public Luma page `__NEXT_DATA__`. Then match upcoming calendar events by slug.
- Remove listed events from the admin list instead of using a show/hide checkbox on a calendar dump.

## Files to change

- `convex/luma.ts` - listed-only admin query, refresh-only sync, lookup then get, public page fallback, remove mutation
- `src/components/admin/LumaEventsSettings.tsx` - listed list, add copy, refresh button, remove
- `task.md`, `changelog.MD`, `files.MD`

## Edge cases

- Lookup `event: null` still works via the public page parse.
- `GET /v1/events/get` needs manage access. View-only listed events use the public page or calendar list with `access=view`.
- Relative Luma `url` slugs become `https://luma.com/{slug}`.
- Unchecking is gone. Remove deletes the row. Public cards disappear immediately.
- Hourly cron keeps refreshing listed events only.
- Show listed Luma events still gates the public site.

## Verification

- [x] Admin list query is listed-only; empty until an event URL is added
- [x] Add-by-URL uses lookup id then GET event, public page, then upcoming calendar match
- [x] Refresh listed events does not insert calendar dump rows and deletes unlisted leftovers
- [x] Remove deletes the listed row
- [ ] Production: deploy, then add `https://luma.com/abstract-convex-26` and confirm Abstract Conference by Convex appears
