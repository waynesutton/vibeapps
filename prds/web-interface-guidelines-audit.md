# Web Interface Guidelines UI audit

Created: 2026-08-11 04:55 UTC
Last Updated: 2026-08-11 04:55 UTC
Status: Draft

## Problem

The app UI has not been checked against the Vercel Web Interface Guidelines (https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). This audit reviewed all 103 files under `src/` (pattern scans across every file plus full reads of the shared primitives, `index.html`, `Layout.tsx`, and `StoryList.tsx`) and recorded every violation found so fixes can land as focused follow up work without touching unrelated UI.

## Root cause

The shared primitives (`ui/button.tsx`, `ui/dialog.tsx`) and older page code predate the guidelines, and a few patterns (`transition-all`, `focus:outline-none`, `...` in copy, no `autocomplete`) were copied across files as the app grew.

## Findings

### App wide (highest impact, fix once in shared code)

- No `autoComplete` attribute exists anywhere in `src/`. Auth adjacent fields (email on StoryForm, ResendForm, YCHackForm, JudgingGroupSubmitPage, UserProfilePage socials) need real values (`email`, `url`, `name`); other fields need `autocomplete="off"` to avoid password manager triggers.
- No `prefers-reduced-motion` handling anywhere in `src/` or CSS. Add a global reduced motion block or Tailwind `motion-reduce:` variants for the dialog/hover/width animations.
- Ellipsis: `...` used instead of `…` in roughly 40 files (all `Loading...`, `Saving...`, `Submitting...` states and `Search...` placeholders). Global find and replace in JSX string literals.
- Images: no `<img>` in the app sets explicit `width`/`height` attributes (CLS risk). Avatars and tag icons are sized by classes so visual impact is low, but content images (story screenshots, gallery, submission page hero) should get dimensions. `loading="lazy"` present on some list thumbnails, missing on others.
- `transition-all` in about 10 files; list transitioned properties explicitly.

### src/components/ui/button.tsx

- button.tsx:13 - `focus:outline-none` with no `focus-visible:ring` replacement; the shared Button has no visible focus state at all
- button.tsx:37 - `asChild` renders a `span` that receives `onClick` with no `role`, `tabIndex`, or keyboard handler

### src/components/ui/dialog.tsx

- dialog.tsx:18 - dialog container missing `role="dialog"` and `aria-modal="true"`
- dialog.tsx:18 - no `overscroll-behavior: contain`; background scrolls behind modal
- dialog.tsx:18 - no focus trap or initial focus management; Escape handled, overlay click does not close

### src/components/ui/AlertDialog.tsx, MessageDialog.tsx, PromptDialog.tsx

- AlertDialog.tsx:58, MessageDialog.tsx:88, PromptDialog.tsx:67 - `transition-all` on modal panel
- MessageDialog.tsx:107, PromptDialog.tsx:88 - `autoFocus` (acceptable single primary control, but skip on mobile)
- Same dialogs: no `overscroll-behavior: contain`, no `aria-modal`

### index.html

- index.html - no `theme-color` meta matching page background (`#F4F2EE`)
- viewport correct (no `user-scalable=no`), font preconnects and `display=swap` present ✓

### src/components/Layout.tsx

- Layout.tsx:619 - mobile search input: no label or `aria-label`, `type="text"` instead of `type="search"`, placeholder `"Search..."` not `"Search…"`
- Layout.tsx:625 - `focus:outline-none` with no focus replacement on mobile search input
- Layout.tsx:635, 667 - Categories and Sort `<select>` lack `aria-label`
- Layout.tsx:708 - desktop search: `transition-all` animating `width`/`padding` (layout properties), `focus:outline-none` with no replacement, no `aria-label`
- Layout.tsx:750, 774 - tag pill button and links: `focus:outline-none` with no focus-visible replacement

### src/components/StoryList.tsx

- StoryList.tsx:171, 180, 236 - vote buttons: icon only ChevronUp variant has no `aria-label`; no visible focus ring
- StoryList.tsx:200, 268 - screenshots missing `width`/`height`; line 268 grid image also missing `loading="lazy"`
- min-w-0, truncate, line-clamp usage correct ✓

### src/pages/UserProfilePage.tsx

- UserProfilePage.tsx:1576-1649 - profile tab buttons: `focus:outline-none` with no focus-visible replacement
- UserProfilePage.tsx:1389-1489 - link cards: `transition-all` plus `hover:-translate-y-1` with no reduced motion variant
- UserProfilePage.tsx:1027-1134 - edit profile inputs lack `autocomplete` (`name`, `username`, `url`)

### src/components/RecentVibers.tsx

- RecentVibers.tsx:64 - avatar link `focus:outline-none` with no focus-visible replacement

### src/pages/JudgingInterfacePage.tsx

- JudgingInterfacePage.tsx:721, 2017 - progress bar `transition-all` animating `width`; prefer `transform: scaleX` or list `width` explicitly

### src/components/admin (ContentModeration, UserModeration, AIJudgeResults, TagManagement, FormFieldManagement, Settings, FormBuilder)

- `transition-all` on ~60 admin action buttons (color-only transitions; replace with `transition-colors`)
- TagManagement.tsx:819, 835 - pagination `...` should be `…`
- Admin search/filter inputs lack `aria-label` where placeholder is the only hint

### Passing

- `src/components/ui/input.tsx`, `checkbox.tsx` - correct `focus-visible:ring` pattern ✓
- No `window.confirm`/`alert` anywhere; site dialogs used ✓
- No `onPaste` blocking, no `user-scalable=no` ✓
- Email/url fields that exist use correct `type` ✓
- Destructive actions are confirm gated (existing dialog system) ✓

## Proposed solution (fix order)

1. Shared primitives first: Button focus-visible ring, dialog aria/overscroll/focus handling (fixes every consumer at once).
2. Global sweeps: `...` to `…`, `transition-all` to explicit properties, reduced motion CSS block.
3. Layout header: search input label/type, select aria-labels, focus states on pills.
4. StoryList vote button aria-labels and image dimensions.
5. Forms pass: `autocomplete` on public submit forms and profile edit.
6. Admin surfaces last (internal tooling, lower user impact).

## Files to change

`src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/AlertDialog.tsx`, `src/components/ui/MessageDialog.tsx`, `src/components/ui/PromptDialog.tsx`, `index.html`, `src/index.css`, `src/components/Layout.tsx`, `src/components/StoryList.tsx`, `src/pages/UserProfilePage.tsx`, `src/components/RecentVibers.tsx`, `src/pages/JudgingInterfacePage.tsx`, public form components, admin components (batch).

## Edge cases

- Focus ring additions must not change layout (use ring, not border).
- `type="search"` adds a native clear button in some browsers; verify header styling.
- Image `width`/`height` on `object-cover` thumbnails: keep CSS classes authoritative, attributes only set intrinsic ratio.
- Reduced motion must not disable opacity fades needed to hide/show content, only decorative motion.

## Verification steps

- Keyboard-tab through header, story list, story detail, submit form, profile page; every interactive element shows a visible focus ring.
- VoiceOver/axe pass on Layout header and a story list page (no unlabeled controls).
- `rg 'transition-all|outline-none' src` returns only lines with an explicit focus-visible replacement.
- `rg '\.\.\.' src --glob '*.tsx'` returns only spread operators.
- Lighthouse CLS check on home page after image dimensions land.

## Task completion log

- 2026-08-11 04:55 UTC: Audit completed and findings recorded. No code changes yet; fixes tracked as follow up work.
