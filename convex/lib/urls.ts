// Link safety shared by Convex (write checks) and the UI (render checks).
// Pure helpers only, so the frontend can import this file.

import { ConvexError } from "convex/values";

// Browsers drop ASCII whitespace and control characters inside a scheme, so
// "java\tscript:" still runs. Compare against the compacted form.
function compactScheme(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0020\u007f]/g, "");
}

// True when a link is empty, has no scheme (a bare handle or host), or uses
// http or https. Anything else (javascript:, data:, vbscript:) is unsafe.
export function isSafeLink(value: string | undefined | null): boolean {
  if (!value) return true;
  const compact = compactScheme(value);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(compact)) return true;
  return /^https?:/i.test(compact);
}

// Throws a user facing error when a stored link would be unsafe to render
export function assertSafeUrl(
  value: string | undefined | null,
  field: string,
): void {
  if (!isSafeLink(value)) {
    throw new ConvexError(`${field} must be an http or https link`);
  }
}

// Story link columns checked on every story write
const STORY_LINK_FIELDS = [
  "url",
  "videoUrl",
  "githubUrl",
  "linkedinUrl",
  "twitterUrl",
  "chefShowUrl",
  "chefAppUrl",
] as const;

// Checks every story link column present on an insert or patch object
export function assertSafeStoryLinks(fields: {
  url?: string;
  videoUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  chefShowUrl?: string;
  chefAppUrl?: string;
}): void {
  for (const key of STORY_LINK_FIELDS) {
    assertSafeUrl(fields[key], key);
  }
}
