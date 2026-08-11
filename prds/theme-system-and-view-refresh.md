# Theme system and view refresh

Created: 2026-08-11 07:55 UTC
Last Updated: 2026-08-11 20:05 UTC
Status: Done

## Problem

The app has a single hardcoded palette spread across ~79 files (~1,700 arbitrary hex Tailwind classes). There is no theme switcher. The user wants:

1. Three themes:
   - Light (new default): cream canvas, near black ink, single orange accent, white cards, hairline borders.
   - Classic: the exact current look preserved as a selectable theme.
   - Dark: deep black canvas, charcoal surfaces, white opacity text ramp, single blue accent, hairline borders, no shadows.
2. A theme switcher using a Phosphor icon, placed next to the profile icon in the header, working on mobile.
3. A modern refresh of the list view (Product Hunt / new Digg style rows) and vibe view. Grid view stays as is.
4. Nothing breaks: admin dashboard, judging, forms, Clerk auth, dialogs, toasts all must render correctly in every theme.

## Root cause

Colors are hardcoded per component (`bg-[#292929]`, `text-[#525252]`, `border-[#D8E1EC]`, `bg-white`, `text-gray-600`...). The shadcn CSS variables exist but are barely consumed, so flipping `.dark` does nothing.

## Proposed solution

1. Semantic token layer: CSS variables per theme on `html[data-theme=...]`, exposed in `tailwind.config.js` as color names:
   - `canvas`, `surface`, `surface-alt`, `surface-hover`, `ink`, `copy`, `soft`, `faint`, `hairline`, `hairline-strong`, `cta`, `cta-hover`, `on-cta`, `accent`, `accent-soft`.
2. Codemod (`scripts/apply-theme-tokens.mjs`, run once): prefix-aware replacement of hex utility classes and admin gray classes with token classes across `src/`.
3. `ThemeProvider` (`src/lib/ThemeContext.tsx`) + `ThemeToggle` dropdown with Phosphor icons (`@phosphor-icons/react`), stored in localStorage (`vibeapps-theme`), default `light`. Pre-paint script in `index.html` prevents theme flash. `.dark` class toggled for shadcn vars and Clerk dark appearance.
4. StoryList redesign:
   - List: Product Hunt style rows inside a surface panel, thumbnail left, title + tagline + meta middle, comment and upvote controls right.
   - Vibe: modernized card with restyled vote module, cleaner spacing and typography.
   - Grid: unchanged structure, token colors only.
5. Tag chip fallback colors become CSS variables so default chips adapt per theme (DB-set tag colors stay as designed).

## Files to change

- `tailwind.config.js`, `src/index.css`, `index.html`
- New: `src/lib/ThemeContext.tsx`, `src/components/ThemeToggle.tsx`, `scripts/apply-theme-tokens.mjs`
- `src/components/Layout.tsx` (switcher placement, view toggle styling)
- `src/components/StoryList.tsx` (list + vibe redesign)
- All files under `src/` touched mechanically by the codemod (admin included)
- `src/main.tsx` (provider + Clerk appearance)

## Theme palettes

| Token | Classic | Light (default) | Dark |
|---|---|---|---|
| canvas | #F4F2EE | #f4f3ec | #0f0f0f |
| surface | #ffffff | #ffffff | #1a1a1a |
| surface-alt | #F4F0ED | #ece9df | #1e1e1e |
| surface-hover | #E5E1DE | #e7e4d8 | #2a2a2a |
| ink | #292929 | #111111 | #ffffff |
| copy | #525252 | #333333 | rgba(255,255,255,0.75) |
| soft | #545454 | #666666 | rgba(255,255,255,0.6) |
| faint | #787672 | #77716b | rgba(255,255,255,0.45) |
| hairline | #D8E1EC | #e5e5e5 | rgba(255,255,255,0.12) |
| hairline-strong | #D5D3D0 | #d8d8d8 | rgba(255,255,255,0.25) |
| cta | #292929 | #111111 | #f6f6f6 |
| cta-hover | #525252 | #333333 | #d4d4d4 |
| on-cta | #ffffff | #ffffff | #0f0f0f |
| accent | #292929 | #ff5600 | #51a2ff |
| accent-soft | #F3ECE1 | #ffe9dd | rgba(81,162,255,0.14) |

## Edge cases

- `text-white` on dark buttons must flip to `on-cta` in dark theme (codemod handles co-occurrence with `bg-[#292929]`).
- Clerk modals: dark baseTheme when theme is dark; `.cl-cardBox` override uses a variable.
- Sonner toasts: theme prop follows current theme.
- Tag chips with DB colors keep their stored colors in all themes.
- Semantic reds/greens/yellows kept as is (checked for dark readability).
- Admin default view mode logic in Layout untouched.

## Verification steps

- `npx tsc --noEmit` and `npm run lint` clean for touched files.
- Browser check: home in all three themes x list/grid/vibe, story detail, admin dashboard tabs, sign in modal, mobile width (375px).
- Confirm classic theme renders identical to current production look.

## Task completion log

- 2026-08-11 07:55 UTC: PRD created, exploration complete.
- 2026-08-11 08:05 UTC: Shipped. Three-theme token system live: CSS variables per `html[data-theme]` in `src/index.css`, semantic Tailwind color names in `tailwind.config.js`, pre-paint script in `index.html`. ThemeProvider + useTheme (`src/lib/ThemeContext.tsx`), Phosphor icon ThemeToggle in the header next to the profile icon (`src/components/ThemeToggle.tsx`, works on mobile), Clerk gets dark baseTheme in dark mode via `src/main.tsx`. One-off codemod converted ~1,700 hex utility classes across 79 files to token classes, then was deleted. StoryList list view redesigned as ranked Product Hunt / Digg style rows (rank, thumbnail, title, tagline, tags, meta, upvote box); vibe view refreshed with modern card styling; grid view structure unchanged. Contrast polish pass: tag chip fallbacks now CSS variables, text-white to text-on-cta on themed CTAs, filter pills use ring-offset-canvas, moderation buttons themed, dark hairline opacity bumped to 0.14, themed sonner Toaster mounted in App.tsx. Verified: tsc clean on all touched files (remaining errors pre-existing), eslint 0 errors, browser check of all three themes x list/grid/vibe + admin + mobile 375px passed.
- 2026-08-11 19:20 UTC: Default Light theme replaced with a pure white mono palette (white canvas and cards, black ink and CTAs, #f3f3f3 inset fills, #e2e2e2 hairlines, no accent hue, no shadows). Selected controls flip polarity (view mode buttons and the "All" pill go black with white icons/text) so nothing disappears white-on-white; hover states moved to surface-hover; borderless cards (RecentVibers, UserProfilePage, DynamicSubmitForm) gained hairline borders. Classic and Dark untouched. Verified via typecheck, lint, and browser screenshots of light homepage (bordered cards, themed sort dropdown) and dark homepage. `.interface-design/system.md` palette table and component patterns updated.
- 2026-08-11 20:05 UTC: Light canvas softened from #ffffff to #f7f7f7 per user feedback; white cards now read as raised surfaces. Docs synced.
