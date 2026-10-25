import type { MutationCtx, QueryCtx } from "../_generated/server";

// URL friendly story slug; mirrors stories.ts so imported and submitted
// stories share one slug space.
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "submission";
}

// Unique story slug: appends -1, -2, ... until no story owns it
export async function generateUniqueStorySlug(
  ctx: QueryCtx | MutationCtx,
  title: string,
): Promise<string> {
  const baseSlug = slugifyTitle(title);
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}
