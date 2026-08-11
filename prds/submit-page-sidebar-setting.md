# Admin setting to hide the /submit right sidebar and widen the form

Created: 2026-08-11 08:35 UTC
Last Updated: 2026-08-11 08:35 UTC
Status: Done

## Problem

The default `/submit` page always renders the right sidebar (Weekly Leaderboard, Recent Vibers, Top Categories) and constrains the form to `max-w-2xl` inside the `lg:w-3/4` main column. Admins want an option in `admin?tab=settings` to remove that sidebar on `/submit` and let the form breathe wider for every user. Dynamic submit pages (`/submit/:slug`) already hide the sidebar; the default page had no control.

## Solution

One boolean site setting, `hideSubmitPageSidebar` (default false), stored on the existing `settings` singleton doc.

- Backend: field added to the `settings` table schema, `DEFAULT_SETTINGS`, the `get` query fallback, and the `update` mutation args in `convex/settings.ts`. Public read, `settings.manage` to change, logged through the existing settings activity log path.
- Layout: `Layout.tsx` computes `hideSubmitSidebar` when the path is exactly `/submit` and the setting is on, and folds it into the existing `showSidebar` gate, so the main column becomes `w-full`.
- Form width: `StoryForm.tsx` (already subscribed to `api.settings.get`) switches its container from `max-w-2xl` to `max-w-4xl` when the setting is on.
- Admin UI: new "Submit Page Layout" section in `src/components/admin/Settings.tsx` with a checkbox, saved through the same Save Changes flow as the other settings.

## Files changed

- `convex/schema.ts`: `hideSubmitPageSidebar` optional boolean on `settings`
- `convex/settings.ts`: default, get fallback, update arg
- `src/components/Layout.tsx`: sidebar gate for `/submit`
- `src/components/StoryForm.tsx`: conditional container width
- `src/components/admin/Settings.tsx`: checkbox section plus save wiring

## Edge cases

- Setting off (or missing on old settings docs): behavior identical to before, `get` falls back to false.
- Only the exact `/submit` path is affected; `/submit/:slug` dynamic forms already hide the sidebar via their own check, and no other route matches.
- Settings doc not initialized: `get` returns defaults, so the sidebar shows as before.
- `SiteSettings` is `Doc<"settings">`, so the admin form field is typed once the schema regenerates (convex dev push confirmed green).

## Verification

- Convex dev push green after schema and function changes ("Convex functions ready!", no schema errors).
- Zero linter errors on all five touched files.
- Manual check: toggle on in `admin?tab=settings`, save, load `/submit` as any user: no right sidebar, wider form. Toggle off restores the sidebar.

## Task completion log

- 2026-08-11 08:35 UTC: Implemented backend field, layout gate, form width, and admin toggle. Docs synced.
