# themss.md

## Theming Plan: Dark Mode & Neobrutalism Theme

### Overview

This document outlines the steps and codebase touchpoints required to:

1. Add a user-facing dark mode switcher (per-user preference, persisted).
2. Enable a global "Neobrutalism" theme, settable from the admin dashboard, which overrides user preferences for the entire site.

---

## 1. Dark Mode Switcher (User Preference)

### Requirements

- Users can toggle between light and dark mode.
- Preference is persisted (ideally in Convex DB, fallback to localStorage for guests).
- Theme is applied instantly and on subsequent visits.
- Should work with Tailwind CSS (likely using `dark:` variants).

### Codebase Touchpoints

#### a. Frontend State & UI

- **src/components/ui/**
  - Add a `ThemeSwitcher.tsx` component (toggle button).
  - Update `Layout.tsx` to include the switcher and apply the theme class to the root element.
- **src/lib/**
  - Add utility for reading/writing theme preference (Convex mutation/query for logged-in users, localStorage for guests).
- **src/pages/**
  - Ensure all pages/components use the theme context or class.

#### b. User Model & Persistence

- **convex/users.ts** (or similar)
  - Add a `theme` field to the user table in Convex schema (e.g., `"theme": v.optional(v.string())`).
  - Add mutations/queries to get/set user theme preference.
- **src/components/UserSyncer.tsx**
  - Sync Clerk user data with Convex, including theme preference.

#### c. Tailwind CSS

- **tailwind.config.js**
  - Ensure `darkMode: 'class'` is set.
  - Add custom colors for dark mode if needed.

---

## 2. Neobrutalism Theme (Global, Admin-Set)

### Requirements

- Admin can enable a "Neobrutalism" theme for the entire site.
- When enabled, this theme overrides all user preferences.
- Theme settings are stored in Convex (likely in the `settings` table).
- All users see the Neobrutalism theme instantly.

### Codebase Touchpoints

#### a. Admin Dashboard

- **src/components/admin/Settings.tsx**
  - Add UI for toggling the Neobrutalism theme (radio/select/switch).
  - Call a Convex mutation to update the global theme setting.

#### b. Convex Schema & Mutations

- **convex/schema.ts**
  - Ensure `settings` table has a `theme` field (e.g., `"theme": v.optional(v.string())`).
- **convex/settings.ts** (or similar)
  - Add mutation/query to get/set the global theme.
- **src/lib/constants.ts**
  - Define available themes: `["light", "dark", "neobrutalism"]`.

#### c. Theme Application Logic

- **src/components/Layout.tsx**
  - On load, check for global theme override (via Convex query).
  - If set, apply the global theme; otherwise, use user preference.
  - Use React context or a custom hook for theme state.

#### d. Tailwind & Custom Styles

- **tailwind.config.js**
  - Add custom color palette and styles for Neobrutalism.
- **src/index.css**
  - Add any global CSS for Neobrutalism (borders, shadows, etc.).

---

## 3. Additional Considerations

- **SSR/SEO**: Ensure theme is applied on first paint to avoid FOUC (Flash of Unstyled Content).
- **Accessibility**: Ensure all themes meet contrast and accessibility standards.
- **Testing**: Add tests for theme switching and persistence.
- **Documentation**: Update `README.md` with theme usage instructions.

---

## 4. Files to Update or Add

- `convex/schema.ts` (add theme fields)
- `convex/settings.ts` and/or `convex/users.ts` (mutations/queries)
- `src/components/ui/ThemeSwitcher.tsx` (new)
- `src/components/Layout.tsx` (theme logic)
- `src/components/admin/Settings.tsx` (admin UI)
- `src/lib/utils.ts` (theme helpers)
- `src/lib/constants.ts` (theme constants)
- `src/index.css` and `tailwind.config.js` (styles)
- `README.md` (docs)

---

## 5. Migration Steps

1. Update Convex schema and deploy.
2. Implement backend mutations/queries for theme settings.
3. Build frontend theme context/provider and switcher.
4. Add admin UI for global theme.
5. Style Neobrutalism theme in Tailwind/CSS.
6. Test thoroughly across all pages and user states.

---

## 6. Future Enhancements

- Allow users to pick from more themes.
- Support per-page or per-component theming.
- Add animation for theme transitions.

---

**Summary:**  
This plan enables both user and admin control over site theming, with a modern, production-worthy approach leveraging Convex, React, and Tailwind. All major codebase touchpoints are identified for a smooth implementation.
