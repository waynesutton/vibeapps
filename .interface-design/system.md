# VibeApps design system

Last updated: 2026-08-22 07:55 UTC
Source of truth for theming: `src/index.css` (CSS variables) + `tailwind.config.js` (semantic color names). This file documents the decisions so future sessions stay consistent.

## Direction and feel

Community app showcase (Product Hunt / new Digg energy) with a calm editorial surface. Content leads; chrome whispers. One accent color per theme used sparingly for status and emphasis, never decoration. No purple, no emojis, no gradients.

## Theme architecture

Three themes driven by `html[data-theme="light" | "classic" | "dark"]`:

- **Light** (default): soft grey canvas (#f7f7f7), white cards, black ink and CTAs, gray inset fills, hairline separation. Flat and mono; no accent hue, no shadows.
- **Classic**: the original VibeApps look, preserved exactly.
- **Dark**: deep black canvas, charcoal surfaces, white-opacity text ramp, blue accent.

Rules:

- Theme state lives in `src/lib/ThemeContext.tsx` (`useTheme`), persisted to localStorage key `vibeapps-theme`. A pre-paint script in `index.html` applies the saved theme before first render (no flash).
- The `dark` class is toggled on `html` alongside `data-theme="dark"` for shadcn variables and Clerk's dark `baseTheme` (wired in `src/main.tsx`).
- Sonner toasts follow the theme via the global `<Toaster />` in `src/App.tsx`, styled with the variables below.

## Token vocabulary

Always use these Tailwind color names. Never introduce raw hex utility classes (`bg-[#...]`, `text-gray-*`, `bg-white`, `text-black`) in components.

| Token | Role |
|---|---|
| `canvas` | Page background. Sidebars share it (border separation only). |
| `surface` | Cards, panels, dropdown triggers. |
| `surface-alt` | Inset areas: inputs, muted chips, secondary fills. |
| `surface-hover` | Hover state for surface elements. |
| `ink` | Primary text and highest-emphasis icons. |
| `copy` | Body/supporting text. |
| `soft` | Metadata, tertiary text. |
| `faint` | Placeholder, disabled, rank numbers. |
| `hairline` | Standard borders and dividers. |
| `hairline-strong` | Emphasis borders, focus/selected rings, expanded inputs. |
| `cta` | Primary button fill. |
| `cta-hover` | Primary button hover fill. |
| `on-cta` | Text/icons on `cta` fills. NEVER `text-white` on a cta background. |
| `brand` | Accent: links-on-hover, notification dots, active markers. |
| `brand-soft` | Accent tint fills (highlights, soft badges). |

For inline `style` attributes (dynamic values), use the CSS variables directly: `var(--th-surface-alt)`, `var(--th-copy)`, `var(--th-hairline-strong)`, etc.

## Palette table

| Token | Classic | Light (default) | Dark |
|---|---|---|---|
| canvas | #F4F2EE | #f7f7f7 | #0f0f0f |
| surface | #ffffff | #ffffff | #1a1a1a |
| surface-alt | #F4F0ED | #f3f3f3 | #1e1e1e |
| surface-hover | #E5E1DE | #e8e8e8 | #2a2a2a |
| ink | #292929 | #000000 | #ffffff |
| copy | #525252 | #1f1f1f | rgba(255,255,255,0.78) |
| soft | #545454 | #545454 | rgba(255,255,255,0.62) |
| faint | #787672 | #6b6b6b | rgba(255,255,255,0.45) |
| hairline | #D8E1EC | #e2e2e2 | rgba(255,255,255,0.14) |
| hairline-strong | #D5D3D0 | #cccccc | rgba(255,255,255,0.25) |
| cta | #292929 | #000000 | #f6f6f6 |
| cta-hover | #525252 | #333333 | #d4d4d4 |
| on-cta | #ffffff | #ffffff | #0f0f0f |
| brand | #292929 | #000000 | #51a2ff |
| brand-soft | #F3ECE1 | #ededed | rgba(81,162,255,0.14) |

Light theme notes: the soft grey canvas (#f7f7f7) lets white `surface` cards read as raised; `hairline` borders and `surface-alt`/`surface-hover` gray fills add structure. `faint` (#6b6b6b) keeps 4.9:1 contrast on white. Selected/active controls still flip polarity (`bg-cta text-on-cta`) since white-on-white remains possible inside cards.

Dark mode notes: no shadows (borders carry all definition), semantic reds/greens/yellows stay Tailwind defaults but pair with white text (`text-white bg-red-600` etc. is intentional and allowed on semantic action buttons). Dark hairline was tuned to 0.14 specifically so card borders survive the squint test.

## Depth strategy

**Borders-only.** No drop shadows on cards or panels in any theme. Hierarchy comes from:

1. Surface steps: `canvas` → `surface-alt` (inset) → `surface` (raised) → `surface-hover` (interactive).
2. Border progression: `hairline` for standard separation, `hairline-strong` for emphasis/focus/selected.
3. Scrims for modals stay black (`bg-black/50`-style overlays), not tokenized. Do not convert scrim blacks to `cta`.
4. Hover is color-only. Cards and rows wash with `surface-hover`. They never scale, lift, or grow a shadow. Taken from the Open Analytics hover rule; it fits our borders-only depth. Apply the same on admin tables and plates when those get a pass. Do not import OA squircles, springs, Inter Tight, or a 500 weight cap. Our radius and Geist scale stay.

## Spacing and radius

- Base unit 4px (Tailwind scale). Component gaps 8–12px, section separation 16–24px, page sections 32–48px.
- All non-pill radius utilities from `rounded-sm` through `rounded-3xl` resolve to `0.25rem`. This keeps cards, buttons, inputs, thumbnails, submit surfaces, dialogs, and admin panels compact and consistent.
- `rounded-full` remains reserved for tag pills, avatars, notification dots, and round profile-adjacent icon controls.
- The header notification and profile menus preserve their previous `0.375rem` radius as explicit local exceptions.

## Iconography

- App icons: lucide-react (existing set).
- Theme switcher only: `@phosphor-icons/react` (Sun, Moon, CircleHalf) in `src/components/ThemeToggle.tsx`.
- Do not mix a third icon set.

## Key component patterns

### Primary button
`bg-cta text-on-cta hover:bg-cta-hover` with `rounded-md`/`rounded-lg`. Focus ring uses `ring-ink` or `hairline-strong`.

### Filter pills (header tags, top categories)
- Active/selected: flip polarity with `bg-cta text-on-cta` (header "All" pill) or use `bg-surface-alt ring-1 ring-hairline-strong ring-offset-1 ring-offset-canvas` (sidebar categories). Never rely on `bg-surface` for the selected state; it is invisible on the white light canvas.
- Inactive: `bg-surface-alt text-copy border-hairline hover:bg-surface-hover`
- Always include `ring-offset-canvas` so the ring offset matches the page in every theme.

### View mode buttons (list / grid / vibe icons in header)
- Selected: `bg-cta border-cta` with `text-on-cta` icon.
- Unselected: `border-hairline hover:bg-surface-hover` with `text-soft` icon.

### List view row (StoryList, Product Hunt / Digg style)
The ranked list sits in one sidebar-matching plate: `bg-surface rounded-lg border border-hairline overflow-hidden`, hairline dividers between rows. That plate is white on light, white on classic, charcoal on dark, so it lifts off `canvas` the same way Most Vibes / Recent Vibers / Top Categories do. Rows use `px-4 py-5`. Hover is color-only (`hover:bg-surface-hover`) clipped to the plate. Two-digit rank (`01`, `text-[15px] text-faint` tabular nums) + 16:9 `aspect-video` screenshot (`w-20` mobile / `w-[8.5rem]` from `sm`, `rounded-md border-hairline bg-surface-alt` letter fallback) + title (`.app-title`) + first visible tag as a `rounded-full` pill + one-line description + byline + `Nc` comments + vote pill (`h-8 rounded-full border-ink bg-surface`). The vote pill stays `bg-surface` so it remains a discrete island on the tinted row. Vibe view stays its own pattern.

### Vibe view card
`bg-surface border border-hairline rounded-xl`, same vote module language as the list row, `text-soft` meta.

### Grid view (StoryList, catalog and `/tag/:slug`)
`rounded-lg` card, `rounded-md` 16:9 thumbnail. Do not change those radii. Stack: screenshot on top (letter fallback), `.app-title`, `.app-desc` two-line clamp, small tag pills, footer with compact time plus comment/bookmark/repo icons on the left and a `rounded-full bg-brand-soft` vote pill (`▲` plus tabular count) on the right. `h-full` plus `mt-auto` pins the footer. Hover is color-only (`hover:bg-surface-hover`), no scale or shadow. List and vibe stay their own patterns.

### Tag chips
DB-stored custom colors render as saved in ALL themes. Fallback (no stored color): `var(--th-surface-alt)` bg, `var(--th-copy)` text, `var(--th-hairline-strong)` border. Exception: `DEFAULT_TAG_*` constants in `TagManagement.tsx` stay hex because they feed `<input type="color">`.

### Tag page header (`/tag/:slug`)
One row, shared across list/grid/vibe. Use shared `BackToAppsLink` (44px hit target, `aria-label="Back to all apps"`) plus "Apps tagged with" plus the tag as a `rounded-full` pill, count as `text-soft tabular-nums` on the right. Same chevron pattern on submit, admin, search, leaderboard, events, and story detail. No stacked "Back to Apps" text.

### Catalog sidebar
Most Vibes, Recent Vibers, and Top Categories are gated by `settings.sidebarWidgets`. Entire-app off hides the widget everywhere. Luma events have their own row (including App page, below View Change Log). Judging groups can hide Luma on their pages without changing site widgets. Luma stacks above those widgets with hairline dividers. Hide the catalog sidebar on `/admin`, `/notifications`, `/inbox`, `/leaderboard`, and `/events`.

### Notification dot
`bg-brand` (never black; invisible in dark otherwise).

### Toasts
Global sonner Toaster in `App.tsx`: `background: var(--th-surface)`, `color: var(--th-ink)`, `border: 1px solid var(--th-hairline)`, theme prop follows `useTheme`.

### Dropdowns (selects)
Never use native `<select>` for single-value pickers; the OS popup cannot be themed. Use `SimpleSelect` (`src/components/ui/SimpleSelect.tsx`), which wraps the Radix primitives in `src/components/ui/select.tsx` rethemed to site tokens:

- Trigger: `bg-surface border-hairline text-ink rounded-md`, focus ring `hairline-strong`, chevron `text-soft`.
- Panel: `bg-surface border-hairline rounded-md` (one elevation step above its parent), items `text-copy`, highlighted item `bg-surface-hover text-ink`, check indicator on selected.
- API mirrors a native select: `value`, `onChange(value)`, `options: { value, label, disabled? }[]`, plus `placeholder`. An option with `value: ""` (e.g. "All Categories") is mapped through an internal sentinel; an empty `value` with no empty option renders the placeholder.
- Keyboard: Enter/Space opens, arrows navigate, Enter selects, Escape closes (Radix built-in).
- Known exception: the `multiple` select in `PublicForm.tsx` stays native (inline listbox, already themed; Radix Select has no multi-select).

### Confirm dialogs (AlertDialog)
Destructive confirms (`src/components/ui/AlertDialog.tsx`) follow this keyboard contract:

- Focus moves to Cancel on open (safe default for destructive actions).
- Tab / Shift+Tab cycle between Cancel and the confirm button (focus trapped in the dialog).
- Enter activates the focused button; Escape cancels.
- `aria-modal="true"` + `role="alertdialog"` on the panel. MessageDialog and PromptDialog carry `aria-modal` too.
- Confirm button for destructive actions: `bg-red-600 text-white hover:bg-red-700` (semantic red, allowed exception). Cancel: `bg-surface-alt text-copy hover:bg-surface-hover`.

## Consistency checks before shipping UI

1. No new raw hex utility classes or `text-white` on `cta` fills (use `on-cta`).
2. Test all three themes, not just the one you're looking at; check dark borders with the squint test.
3. Rings on selected states include `ring-offset-canvas`.
4. Modals/alerts use site dialogs (never browser defaults), scrims stay black.
5. Mobile 375px pass for anything in the header or with fixed positioning.
6. New dropdowns use `SimpleSelect`, never native `<select>` (except multi-select listboxes).
7. New confirm dialogs reuse `AlertDialog` so the keyboard contract (focus Cancel, Tab trap, Enter/Escape) comes for free.
