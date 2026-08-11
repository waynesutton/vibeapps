# Themed dropdowns and confirm dialog keyboard support

Created: 2026-08-11 08:31 UTC
Last Updated: 2026-08-11 08:47 UTC
Status: Done

## Problem

1. All dropdown menus in the app use native `<select>` elements. The trigger is styled with theme tokens, but the open menu is the OS default popup (white, blue highlight) which ignores the site theme in all three modes (Light, Classic, Dark).
2. Confirmation dialogs (AlertDialog, used for "Mark as spam?" and similar destructive confirms) have no focus management. When the dialog opens, focus stays on the page behind it, so pressing Enter or Tab does nothing useful. Keyboard users cannot confirm or move to Cancel without clicking first.

## Root cause

- Native `<select>` popups cannot be styled by CSS. A custom dropdown (Radix Select) is required. The repo already ships `@radix-ui/react-select` and a shadcn `ui/select.tsx`, but it references shadcn tokens (`bg-popover`, `border-input`, `bg-accent`) that do not exist in this Tailwind config, so it was never adopted.
- `AlertDialog.tsx` renders buttons but never moves focus into the dialog, has no `aria-modal`, and no Tab trap.

## Proposed solution

1. Retheme `src/components/ui/select.tsx` with site tokens (`surface`, `hairline`, `ink`, `copy`, `surface-hover`) matching `PopoverContent` styling.
2. Add `src/components/ui/SimpleSelect.tsx`: a compact wrapper (value, onChange(value), options[], placeholder) with native-select ergonomics. Maps empty-string option values to an internal sentinel because Radix items cannot use "".
3. Replace all single-value native `<select>` elements (18 across 12 files) with `SimpleSelect`. The `multiple` select in `PublicForm.tsx` stays native: it renders an inline listbox, not an OS popup, and Radix Select has no multi-select.
4. `AlertDialog.tsx`: add `aria-modal`, autofocus the Cancel button on open (safe default for destructive confirms), trap Tab/Shift+Tab between Cancel and Confirm, Enter activates the focused button (native behavior once focus is inside). Add `aria-modal` to `MessageDialog.tsx` as well.

## Files to change

- src/components/ui/select.tsx (retheme)
- src/components/ui/SimpleSelect.tsx (new)
- src/components/ui/AlertDialog.tsx, MessageDialog.tsx (keyboard/aria)
- src/components/Layout.tsx, src/pages/NavTestPage.tsx, src/pages/JudgingInterfacePage.tsx
- src/components/PublicForm.tsx (yesNo + dropdown only)
- src/components/admin/: Settings.tsx, AIJudgeResults.tsx, TagManagement.tsx, FormBuilder.tsx, FormFieldManagement.tsx, EditJudgingGroupModal.tsx, judging/GroupEmailsSection.tsx, judging/GroupSubmitPageSection.tsx

## Edge cases

- Empty-string sentinel values ("All Categories", "None", "Write from scratch") map through the sentinel.
- Numeric values (TagManagement page size) round-trip as strings.
- Disabled states (isSaving, isSubmitting, isSending) pass through to the Radix trigger.
- Long option labels in EditJudgingGroupModal wrap inside the content panel.
- Dropdown content renders in a portal above modals (z-50).

## Verification

- Typecheck and lint pass with no new errors.
- Browser check: header category and sort dropdowns themed in all three themes; admin settings selects; judging filters; spam confirm dialog reachable and operable with keyboard only (Tab, Shift+Tab, Enter, Escape).

## Task completion log

- 2026-08-11 08:31 UTC: PRD created, audit of 19 selects and dialog focus behavior complete.
- 2026-08-11 08:40 UTC: Rethemed ui/select.tsx, added SimpleSelect wrapper, added AlertDialog focus trap (autofocus Cancel, Tab toggles between Cancel and Confirm, Enter activates), aria-modal on AlertDialog, MessageDialog, PromptDialog.
- 2026-08-11 08:45 UTC: Replaced all 18 single-value native selects across 12 files (Layout, NavTestPage, JudgingInterfacePage, PublicForm, Settings, AIJudgeResults, TagManagement, FormBuilder, FormFieldManagement, EditJudgingGroupModal, GroupEmailsSection, GroupSubmitPageSection). Multi-select in PublicForm stays native by design. SimpleSelect updated so an empty value with no empty option shows the placeholder.
- 2026-08-11 08:47 UTC: Verified. Typecheck and lints show no new errors (remaining warnings pre-existing). Browser check confirmed themed dropdown panels in Light and Dark, keyboard open/navigate/select/Escape all work.
