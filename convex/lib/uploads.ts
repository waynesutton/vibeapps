// Server side checks for files uploaded through Convex storage upload URLs.
// The client picks the file, so type, size, and freshness are verified here.

import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Uploads must be attached soon after upload, so old ids cannot be reused
const MAX_UPLOAD_AGE_MS = 60 * 60 * 1000;

// Verifies a freshly uploaded image. Ids in `alreadyAttached` belong to the
// record being edited and skip the checks. A rejected file is not deleted
// here: the throw rolls back any storage delete made in the same mutation.
export async function assertValidImageUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  alreadyAttached: ReadonlyArray<Id<"_storage">> = [],
): Promise<void> {
  if (alreadyAttached.includes(storageId)) return;

  const meta = await ctx.db.system.get(storageId);
  if (!meta) {
    throw new ConvexError("Uploaded image was not found. Please upload it again.");
  }

  if (!meta.contentType || !ALLOWED_IMAGE_TYPES.has(meta.contentType)) {
    throw new ConvexError("Images must be PNG, JPEG, WebP, GIF, or AVIF.");
  }
  if (meta.size > MAX_IMAGE_BYTES) {
    throw new ConvexError("Images must be 5 MB or smaller.");
  }
  if (Date.now() - meta._creationTime > MAX_UPLOAD_AGE_MS) {
    throw new ConvexError("This upload expired. Please upload the image again.");
  }
}

// Checks every new image id in one pass
export async function assertValidImageUploads(
  ctx: MutationCtx,
  storageIds: ReadonlyArray<Id<"_storage">> | undefined,
  alreadyAttached: ReadonlyArray<Id<"_storage">> = [],
): Promise<void> {
  if (!storageIds) return;
  for (const id of storageIds) {
    await assertValidImageUpload(ctx, id, alreadyAttached);
  }
}
