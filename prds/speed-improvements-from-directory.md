# Speed improvements from the components directory

Created: 2026-10-25 08:40 UTC
Last Updated: 2026-10-25 08:55 UTC
Status: Done (Netlify deploy preview check pending)

## Problem

- The entry JS bundle is about 2.2 MB because every route (admin, judging, tables, drag and drop, markdown) is imported eagerly in `src/App.tsx`.
- Hashed assets are served with `max-age=0, must-revalidate`, so returning visitors re-check every file.
- Home page cards load full size PNG screenshots (several MB) for 80 to 380px wide slots.
- The home feed query runs twice: once at 20 items, then again at the `itemsPerPage` setting once settings load.
- `/favicon-128.png` in `index.html` points at a file that does not exist.

## Root cause

- No route level code splitting.
- No cache rules for `/assets/*` in Netlify config.
- Convex storage URLs are used directly as `<img src>` with no resize step.
- `usePaginatedQuery` resets when `initialNumItems` changes, and `HomePage` starts it before `settings` arrives.

## Proposed solution

1. Cache rules in `netlify.toml` (kept next to the security headers, one source of truth): immutable `/assets/*`, one day plus stale while revalidate for icons. `/assets/*` misses return a real 404. Favicon link fixed.
2. `HomePage` skips `listApproved` until settings load.
3. `React.lazy` for every route except `Layout`, `HomePage`, `StoryList`, `ProtectedLayout`, and `NotFoundPage`. `Suspense` plus a route error boundary around the `Outlet` and around the top level routes. Idle preload of `StoryDetail`. Reload once on `vite:preloadError`.
4. Netlify Image CDN for the three `StoryList` thumbnails through `/_img/{width}/{uuid}`, sourced from a hardened `/_src/{uuid}` edge function.

## Security notes

- No Convex code changes, so the 2026-10-25 security fixes are untouched.
- `/_src` only accepts a storage UUID, only proxies the fixed prod storage host, and only returns PNG, JPEG, WebP, GIF, or AVIF with `nosniff` and a sandbox CSP. Anything else is a 404.
- Only five resize widths (160, 320, 400, 720, 1080) have rewrite rules, so random widths cannot burn transform credits.
- The `netlify.toml` cache rules set only `Cache-Control`, so they never replace the security headers.

## Files to change

- `netlify.toml`, `public/_redirects`, `public/404.html` (new), `index.html`
- `netlify/edge-functions/imageSource.ts` (new), `src/lib/images.ts` (new)
- `src/App.tsx`, `src/components/Layout.tsx`, `src/main.tsx`, `src/components/RouteErrorBoundary.tsx` (new), `src/components/StoryList.tsx`

## Edge cases

- Dev builds and non prod storage URLs keep the original `src`.
- If the Image CDN fails, the image falls back to the original URL once.
- A stale chunk after a deploy reloads the page once per build, then shows the error card.
- A route error card clears when the user navigates to another path.

## Verification

- `tsc` for the app, eslint on touched files, `npm run build`, entry chunk size before and after.
- On a Netlify deploy preview: `/assets/*.js` returns `immutable`, `/assets/nope.js` returns 404, `/_img/400/{uuid}` returns WebP or AVIF, `/_src/{uuid}` for a non image returns 404.
- Click through home (three views), story, tag, search, admin, judging, a form, a profile, and sign in.

## Task completion log

- 2026-10-25 08:40 UTC - PRD created after checking the plan against the security fixes.
- 2026-10-25 08:55 UTC - All four phases shipped. Entry JS 2,278 kB to 636 kB (191 kB gzip). App `tsc`, eslint on touched files, and build pass. Local prod preview: home feed, client nav to a story, and direct loads of 18 routes render with no error card; the story chunk preloads on idle; dev storage URLs pass through unchanged. Deviations from the plan: cache rules live in `netlify.toml` instead of a new `_headers` file, `public/404.html` added as the 404 target, `/_img` limited to five fixed widths, `/_src` checks the UUID before fetching.
