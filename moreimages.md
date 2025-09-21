# More images PRD

## Goal

Add support for up to 4 additional images per story. On the submit/edit form, users can upload 1–4 extra images below the existing Upload Screenshot (Optional). On the story detail page, display the current main image first and show thumbnails of the additional images underneath; clicking a thumbnail swaps it into the main viewer. Clicking the main image opens a modal/lightbox with arrows and keyboard support. All files are stored in Convex storage and fully manageable from the admin content moderation UI.

## Non‑goals

- Do not change existing voting, comments, rating, tags, or other story features.
- Do not change homepage layouts.

## UX requirements

- StoryForm.tsx
  - New "Additional images (up to 4)" section beneath the current Upload Screenshot input.
  - Accept images only (png, jpg, webp, gif) with a per‑file max 5MB. Reject oversize with clear error.
  - Show small previews and filename list; allow removing any before submission.
  - Clicking any preview or the main screenshot opens a modal/lightbox with left/right arrows and keyboard shortcuts (Esc to close, ←/→ to navigate). Focus is trapped inside the modal.
  - On submit, upload each selected file via existing `stories.generateUploadUrl` and pass the returned storage Ids with the story mutation.

- StoryDetail.tsx
  - Hero area shows the main image (current `screenshotUrl`).
  - If there are additional images, show a row of up to 4 thumbnails beneath the hero image (matching the provided sketch). The currently displayed image is highlighted.
  - Clicking a thumbnail swaps it into the hero display without page reload. Clicking the hero opens the modal/lightbox to cycle through all images (main + additional) with arrows and keyboard.
  - Lazy‑load thumbnails, preserve aspect ratio, and constrain heights to avoid layout shift.

- Accessibility & polish
  - Provide `alt` text using `${story.title} screenshot` and indexed labels for additional images.
  - Thumbnails are focusable buttons with visible focus rings.
  - Modal supports Esc to close; arrow keys to navigate; screen readers get descriptive labels.

## Data model

- Schema change in `convex/schema.ts` on `stories` table:
  - Add `additionalImageIds?: Id<"_storage">[]` (max length 4 enforced in code).

## API contract changes (Convex)

- Validators/types
  - Update `convex/validators.ts`:
    - `baseStoryValidator`: add `additionalImageIds: v.optional(v.array(v.id("_storage")))`.
    - `storyWithDetailsValidator`: add `additionalImageUrls: v.array(v.string())` (empty array when none).
    - Update exported TS type `StoryWithDetailsPublic` accordingly.
  - Update `src/types/index.ts` story type with `additionalImageUrls: string[]`.

- Queries
  - In `fetchTagsAndCountsForStories` (convex/stories.ts), resolve `additionalImageIds` to signed URLs via `ctx.storage.getUrl()`; include as `additionalImageUrls: string[]` in the returned objects.
  - Ensure all public queries that return stories (`getBySlug`, `listApproved`, `listAllStoriesAdmin`, `getWeeklyLeaderboardStories` if needed for cards) propagate `additionalImageUrls`.

- Mutations
  - `submit` and `submitAnonymous` (convex/stories.ts): accept optional `additionalImageIds?: Id<"_storage">[]` (length 1–4). Persist to `stories.additionalImageIds`.
  - `updateOwnStory`: accept optional `additionalImageIds?: Id<"_storage">[]`, plus a `removeAdditionalImageIds?: Id<"_storage">[]` helper or a full replace semantics. Simpler: full replace when provided; omit to keep existing. Validate max 4.
  - `updateStoryAdmin`: add same fields to allow moderation changes; also allow `removeAdditionalImages?: boolean` to wipe.
  - `generateUploadUrl`: unchanged, reused for each image.

- Deletes/cleanup
  - `deleteStory`: if `additionalImageIds` exists, delete each from storage.
  - When replacing additional images in updates, optionally delete removed storage blobs to avoid orphaned files (admin/owner path).

## Frontend changes

- StoryForm.tsx
  - State: `additionalImages: File[]` (max 4), validation, previews, and removal.
  - Upload flow: for each file, `POST` to generated upload URL; collect `storageId`s; pass in `submitStory` payload as `additionalImageIds`.
  - Modal/lightbox: local component that takes the array `[mainPreview, ...additionalPreviews]` while editing; arrow keys and Esc handlers; click overlay or "X" to close.
  - Edit mode in StoryDetail.tsx’s edit form mirrors the same UX. Keep current screenshot semantics; allow adding/removing/replacing additional images with previews.

- StoryDetail.tsx
  - Accept and render `additionalImageUrls`.
  - Build gallery state `images = [story.screenshotUrl, ...additionalImageUrls].filter(Boolean)`; `currentIndex` selects which is shown in the hero.
  - Thumbnail strip renders up to 4 items below hero. Click sets `currentIndex`.
  - Clicking hero opens the same modal/lightbox with the full set.

## Admin content moderation

- `src/components/admin/ContentModeration.tsx`
  - Extend item renderer to show additional thumbnails and counts.
  - Allow remove/reorder (optional v1: remove only) and upload replacement(s) using the same `generateUploadUrl` flow.
  - Patch stories via `api.stories.updateStoryAdmin` with `additionalImageIds` (full replace) or targeted remove.

## Validation & limits

- Per file max 5MB. Accept image mime types only.
- Max 4 additional images; enforce on client and server.
- De‑duplicate identical files on client by comparing `name+size+lastModified` or hashing (optional).

## Migration plan

1. Add `additionalImageIds` to `stories` in `convex/schema.ts` (optional field).
2. Regenerate Convex types; deploy dev.
3. No data backfill needed; existing stories default to `undefined` and render with zero thumbnails.
4. Update validators/types and all queries/mutations; ship backend first (feature‑flag UI until backend is live).

## Rollout sequence (chronological)

1. Backend
   - Schema change + types.
   - Update validators and return types.
   - Update queries to return `additionalImageUrls`.
   - Update mutations to accept/persist additional ids; extend delete logic.
2. Admin UI
   - Add thumbnails and controls to Content Moderation; wire `updateStoryAdmin`.
3. Frontend user UX
   - StoryDetail gallery and modal (read‑only; no submit changes yet).
   - StoryForm additional image picker with previews, modal, and upload on submit.
   - Edit mode in StoryDetail for owners to manage additional images.
4. QA
   - Cross‑browser checks, keyboard navigation, image limits, size errors, slow‑network uploads.
5. Launch
   - Remove feature flag.

## Test plan

- Unit
  - Server: validators reject >4 images; non‑image mime types; large files blocked at UI but server also safe.
  - Queries include `additionalImageUrls` for stories that have ids, empty array otherwise.
  - Delete story removes all related blobs.
- Integration
  - Submit story with 0, 1, and 4 additional images; verify detail page thumbnails and modal.
  - Edit story: add, remove, replace images; ensure URLs update; old images deleted if replaced.
  - Admin moderation: remove and replace images; verify on detail page.
- UI
  - Keyboard nav in modal; focus trap; Esc closes; thumbnails are accessible buttons.

## Performance

- Lazy‑load thumbnails, avoid layout shift; cap thumbnails to fixed height.
- Avoid fetching signed URLs on the client; server resolves once per query.
- Consider future sprite/cdn; current signed URLs are sufficient.

## Security

- Reuse authenticated upload URL flow; no direct storage writes without mutation‑generated URL.
- Validate all ids/ownership in `updateOwnStory`.

## Open questions

- Do we need reordering of additional images? v1 proposes no; order is selection order.
- Should admins be able to reorder? Optional future.
- Max size 5MB aligns with screenshot; confirm if we want 3MB instead.

## Acceptance criteria

- Users can submit a story with up to 4 additional images; uploads persist to Convex.
- Detail page shows hero + clickable thumbnails; modal works with keyboard.
- Admins can remove/replace additional images from moderation.
- Deleting a story removes all associated image blobs.

## Affected files (no edits in this PRD)

- `convex/schema.ts`
- `convex/validators.ts`
- `convex/stories.ts`
- `src/types/index.ts`
- `src/components/StoryForm.tsx`
- `src/components/StoryDetail.tsx`
- `src/components/admin/ContentModeration.tsx`
