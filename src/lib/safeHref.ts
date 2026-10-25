import { isSafeLink } from "../../convex/lib/urls";

// Returns a user supplied link only when it is safe to put in an href.
// javascript:, data: and other non http(s) schemes come back undefined,
// so the anchor renders without a target instead of running script.
export function safeHref(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  return isSafeLink(value) ? value : undefined;
}
