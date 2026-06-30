# Modal Escape-to-close audit

Created: 2026-06-29 17:14 UTC
Last Updated: 2026-06-29 17:14 UTC
Status: Done

## Problem

Pressing the Escape key did not reliably close every modal/overlay in the app. Some
modals supported it (Radix dialogs, a couple of custom ones with their own keydown
effects) while many custom design-system overlays did not, leaving an inconsistent
keyboard-dismiss experience.

## Proposed solution

Add one small, reusable hook `src/hooks/useEscapeKey(enabled, onEscape)` that
subscribes to a window `keydown` listener only while the overlay is open and calls the
existing close handler on `Escape`. Wire it into every custom overlay that lacked ESC.
Fix the shared `ui/dialog.tsx` once so all of its consumers inherit ESC. Leave modals
that already close on ESC untouched. No UI/layout/style/behavior changes beyond
closing on Escape.

## Modal inventory and ESC status

Already supported ESC (no change):

- `src/components/ui/MessageDialog.tsx` — existing window keydown effect
- `src/components/ui/PromptDialog.tsx` — input `onKeyDown` handles Escape (autofocused)
- `src/components/ui/AuthRequiredDialog.tsx` — Radix Dialog native ESC
- `src/components/Footer.tsx` (About modal) — Radix Dialog native ESC
- `src/components/ImageGallery.tsx` — existing window keydown effect
- `src/components/StoryForm.tsx` (image lightbox) — existing window keydown effect

Added ESC via the shared hook:

- `src/components/ui/dialog.tsx` — central fix; covers consumers:
  - `src/components/admin/CreateSubmitFormModal.tsx`
  - `src/components/admin/EditSubmitFormModal.tsx`
  - `src/components/StoryDetail.tsx` (report story modal)
  - `src/pages/UserProfilePage.tsx` (report user modal)
- `src/components/ui/AlertDialog.tsx` — central confirm dialog used via `useDialog` across the app
- `src/components/admin/EditJudgingGroupModal.tsx`
- `src/components/admin/CreateJudgingGroupModal.tsx`
- `src/components/admin/ContentModeration.tsx` (delete-comment confirmation)
- `src/components/admin/UserModeration.tsx` (confirm ban/delete/verify/etc.)
- `src/components/admin/JudgeTracking.tsx` (edit score, delete judge, delete score)
- `src/pages/InboxPage.tsx` (block user, report user)

## Files changed

- `src/hooks/useEscapeKey.ts` (new)
- `src/components/ui/dialog.tsx`
- `src/components/ui/AlertDialog.tsx`
- `src/components/admin/EditJudgingGroupModal.tsx`
- `src/components/admin/CreateJudgingGroupModal.tsx`
- `src/components/admin/ContentModeration.tsx`
- `src/components/admin/UserModeration.tsx`
- `src/components/admin/JudgeTracking.tsx`
- `src/pages/InboxPage.tsx`
- `files.md`, `task.md`, `changelog.md` (docs)

## Edge cases

- Already-handled modals are not double-wired (no duplicate listeners).
- The hook only subscribes while `enabled` is true, so ESC never fires for a closed modal.
- Sibling modals within one component (JudgeTracking, InboxPage) are mutually exclusive, so only the open one reacts.
- The ESC handler reuses each modal's existing close handler, so any cleanup (form reset, clearing report text) behaves exactly like the Cancel/X button.

## Verification steps

- `npx tsc --noEmit` — exit 0, no type errors.
- `npx eslint` on all changed files — 0 errors (only pre-existing advisory warnings, none introduced by these changes).

## Task completion log

- 2026-06-29 17:14 UTC: Created `useEscapeKey` hook; wired ESC into all custom overlays missing it and the shared `ui/dialog.tsx`; verified typecheck (exit 0) and lint (0 errors). No UI/behavior changes beyond ESC-to-close.
