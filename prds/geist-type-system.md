# Geist type system migration

Created: 2026-08-22 01:49 UTC
Last Updated: 2026-08-22 01:57 UTC
Status: Done

## Problem

Three separate issues in the current typography setup.

1. **Story titles and descriptions are too small.** List and vibe rows render titles at 15px and descriptions at 13px. Grid cards render 16px titles and 14px descriptions. The scale reads cramped and the sizes disagree across views, so the same submission looks different depending on how you browse.

2. **The font stack is fragmented.** Four families are loaded, three of them barely used:
   - Eudoxus Sans, from a third party CDN (`stijndv.com`), is the global default on `html`.
   - Inter is loaded twice (Google Fonts in `index.html`, and an `@import` in `index.css`) but only reaches the screen through 23 hardcoded `style={{ fontFamily: "Inter, sans-serif" }}` overrides on the profile and inbox pages.
   - Space Mono is imported and never referenced anywhere.
   - Alfa Slab One is loaded for exactly one element: the vibe view vote count.

3. **No shared type tokens.** Every call site hardcodes its own arbitrary values (`text-[15px] leading-[19px]`, `text-[13px] leading-[19px]`, `text-[14px] leading-[20px]`), so there is no way to adjust the scale without touching a dozen files.

## Root cause

Typography was added per component rather than as a system. The `html` font-family was swapped to Eudoxus at some point but the Inter loading and the inline Inter overrides were never cleaned up, leaving two competing defaults.

## Proposed solution

### Font families

Standardize on Geist (Google Fonts) for UI and Geist Mono for data and code. Both are variable fonts, weight axis 100 to 900, `display=swap`. This removes the third party CDN dependency, drops two unused families, and cuts the font requests from four families to two.

Expose them as theme tokens next to the existing `--th-*` palette so the namespace stays consistent:

```css
--th-font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
--th-font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

Wire them into Tailwind so `font-sans` and `font-mono` resolve to the tokens.

### Type scale

Fixed pixel sizes. No `clamp()` anywhere, per the explicit requirement. Four reusable classes in `src/index.css`, defined in `@layer components` so Tailwind utilities can still override them at individual call sites.

| Class | Size | Leading | Tracking | Weight | Used by |
|---|---|---|---|---|---|
| `.app-title` | 18px | 1.35 | -0.015em | 600 | List, grid, vibe rows, profile submissions, bookmarks, related apps, judging interface |
| `.app-desc` | 16px | 1.55 | 0 | 400 | Descriptions in the same views |
| `.app-title-sm` | 16px | 1.4 | -0.01em | 500 | Admin tables, compact search rows, leaderboards |
| `.app-desc-sm` | 15px | 1.5 | 0 | 400 | Admin description previews, dense cards |

Negative tracking on titles is what keeps Geist from looking like default browser type at display sizes. The 1.35 leading on an 18px title gives a 24px line, which keeps two-line titles tight. Body at 1.55 gives a 25px line, comfortable for a two or three line clamp.

### Related adjustments

Raising the title to 18px and the description to 16px makes 11px and 12px supporting text look broken next to it. Scale the surrounding metadata up one step so the hierarchy still reads:

- Meta rows (byline, date, comment count): 12px to 13px compact, 14px comfortable
- Tag pills: 11px to 12px compact, 12px to 13px comfortable
- Rank numbers and vote counts: 14px to 15px
- Vibe view vote count: was Alfa Slab One at 18px, becomes Geist at 22px semibold with tabular numerals and -0.02em tracking, to hold the same visual weight a slab face gave it
- Story detail `h1`: was `text-xl lg:text-1xl` (`text-1xl` is not a real Tailwind class, so this rendered at a flat 20px) becomes 26px on mobile and 30px from `sm` up

### From the Issuant reference, applied

- Keep grayscale antialiasing (`-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`). Already present.
- Drop `text-rendering: optimizeLegibility`. It enables discretionary ligatures and softens UI type at small sizes. The reference explicitly avoids it.
- Add `-webkit-text-size-adjust: 100%` and neutral `font-feature-settings` so mobile Safari does not inflate type.
- Negative tracking on display type, wider tracking reserved for uppercase mono labels.

### Explicitly not adopted

- `clamp()` fluid sizing. Ruled out by requirement.
- Georgia for headings. This app is a UI product, not editorial, and the existing design is a single sans family.
- The forced `input { font-size: 16px }` iOS zoom guard. It would override the intentional `font-mono text-xs` inputs throughout the admin dashboard.
- Border radius changes. The compact radius was set deliberately in the previous commit and stays as is.

## Files to change

**Foundation**

- `index.html` — remove Eudoxus CDN preconnect and stylesheet, replace the Google Fonts request with Geist and Geist Mono
- `src/index.css` — remove the Inter and Space Mono `@import`, add font tokens, swap the `html` family, drop `optimizeLegibility`, add the four type classes, repoint `.title-font`
- `tailwind.config.js` — `fontFamily.sans` and `fontFamily.mono` to the tokens, remove `alfa-slab-one`

**Public views**

- `src/components/StoryList.tsx` — all three view modes, meta row, tag pills, vote counts
- `src/components/StoryDetail.tsx` — `h1`, description, related app cards
- `src/pages/UserProfilePage.tsx` — submissions, bookmarks, votes, ratings tabs, plus 22 inline Inter overrides
- `src/pages/InboxPage.tsx` — 1 inline Inter override
- `src/components/WeeklyLeaderboard.tsx`, `src/pages/LeaderboardPage.tsx` — title sizes
- `src/pages/JudgingInterfacePage.tsx` — active submission title and description
- `src/components/PublicJudgingResultsDashboard.tsx`, `src/pages/AIJudgeResultsPage.tsx` — ranked rows
- `src/pages/NavTestPage.tsx` — `.title-font` consumer, no change needed beyond the CSS

**Admin dashboard**

- `src/components/admin/ContentModeration.tsx` — moderation row titles and description previews
- `src/components/admin/AIJudgeResults.tsx`, `JudgeTracking.tsx`, `JudgingResultsDashboard.tsx`, `SpamCheck.tsx`, `Judging.tsx`, `judging/GroupSubmissionsSection.tsx`, `ReportManagement.tsx` — submission title cells

## Edge cases

- **Cascade order.** The type classes live in `@layer components`. Tailwind's `utilities` layer is emitted after it, so any `text-*`, `leading-*`, or `font-*` utility left on a call site silently wins. Every conflicting size class has to be removed where a type class is applied, not just added alongside.
- **`line-clamp` interaction.** `line-clamp-2` and `line-clamp-3` compute from the resolved `line-height`. Raising the description leading from 19px to ~25px makes clamped blocks taller, so list rows grow roughly 12px. Acceptable for a feed, but the 48px and 56px thumbnails no longer match the copy block height, and the rank number's `pt-2` alignment needs to come down a step.
- **Vote count width.** Geist digits at 22px are narrower than Alfa Slab One at 18px. `tabular-nums` keeps three and four digit counts from shifting the layout.
- **Dark theme.** Geist at weight 400 on the dark canvas reads lighter than Eudoxus did. Grayscale antialiasing is already on, which is what keeps the stems even, so no per theme weight bump should be needed. Verify visually.
- **Font swap flash.** `display=swap` with no local metric-matched fallback means a reflow on first paint. Acceptable tradeoff versus self hosting; noted as possible future work.
- **`text-1xl` typo.** The story detail `h1` currently carries an invalid class. Removing it changes the rendered size, which is intended, but it means the detail page header shifts more than the diff suggests.

## Verification steps

1. `npx tsc --noEmit -p tsconfig.app.json` — no new type errors
2. `npm run lint` — no new lint errors
3. `npm run build` — production build succeeds
4. `rg -i "eudoxus|alfa.slab|space.mono" -g '!node_modules'` — returns nothing outside docs
5. `rg 'fontFamily: "Inter' src/` — returns nothing
6. Visual check on all three view modes (list, grid, vibe) in all three themes (light, classic, dark)
7. Visual check on story detail, user profile, and the admin content moderation table

## Task completion log

- 2026-08-22 01:49 UTC — PRD written, inventory of every font and story title/description call site complete
- 2026-08-22 01:57 UTC — Migration complete. Foundation swapped (`index.html`, `src/index.css`, `tailwind.config.js`): Eudoxus CDN, Inter, Space Mono, and Alfa Slab One removed; Geist plus Geist Mono loaded from Google Fonts and exposed as `--th-font-sans` / `--th-font-mono`; `text-rendering: optimizeLegibility` dropped; `-webkit-text-size-adjust: 100%` and neutral feature settings added; the four type classes added to `@layer components`. Applied across all three `StoryList` view modes (list, grid, vibe) with the vibe vote count moved from Alfa Slab One 18px to Geist 22px semibold `tabular-nums` at -0.02em, the rank number alignment stepped from `pt-2` to `pt-0.5` for the new baseline, and meta rows, tag pills, and pin icons scaled one step. Also `StoryDetail` (the invalid `text-1xl` replaced with 26px/30px), `UserProfilePage` (22 inline Inter overrides repointed to the token), `InboxPage`, `WeeklyLeaderboard`, `LeaderboardPage`, `JudgingInterfacePage`, `AIJudgeResultsPage`, `PublicJudgingResultsDashboard`, and the admin dashboard on the compact scale (`ContentModeration`, `AIJudgeResults`, `JudgeTracking`, `JudgingResultsDashboard`, `SpamCheck`, `judging/GroupSubmissionsSection`). A fifth Inter loading path turned up during verification: self-hosted `@fontsource/inter` was still imported by `UserProfilePage` and `InboxPage` and bundling 17 woff2 files, so both imports were deleted and the package uninstalled. Verified: `npm run build` succeeds with zero font files in `dist` (CSS 97.42 kB to 92.75 kB), the four type classes survive Tailwind's `@layer components` tree-shaking in the built CSS, `dist/index.html` requests only Geist and Geist Mono, `git grep` finds no remaining Eudoxus/Inter/Space Mono/Alfa Slab references in `src` or the configs, eslint reports 0 errors on all 15 touched components (127 pre-existing warnings), and `tsc -p tsconfig.app.json` holds at the same 94 pre-existing errors with none in changed files. Border radius left untouched per the requirement. Not verified locally: the visual pass across all three view modes in all three themes. Files: `index.html`, `src/index.css`, `tailwind.config.js`, `package.json`, `src/components/StoryList.tsx`, `src/components/StoryDetail.tsx`, `src/components/WeeklyLeaderboard.tsx`, `src/components/PublicJudgingResultsDashboard.tsx`, `src/pages/UserProfilePage.tsx`, `src/pages/InboxPage.tsx`, `src/pages/LeaderboardPage.tsx`, `src/pages/JudgingInterfacePage.tsx`, `src/pages/AIJudgeResultsPage.tsx`, `src/components/admin/ContentModeration.tsx`, `src/components/admin/AIJudgeResults.tsx`, `src/components/admin/JudgeTracking.tsx`, `src/components/admin/JudgingResultsDashboard.tsx`, `src/components/admin/SpamCheck.tsx`, `src/components/admin/judging/GroupSubmissionsSection.tsx`.
