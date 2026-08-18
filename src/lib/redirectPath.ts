// Post-auth return destinations arrive as a `redirect_url` query param, which
// means an attacker can put anything there. Only same-origin relative paths are
// allowed, so a crafted link can never bounce a freshly signed-in user to an
// external site.
export function sanitizeRedirectPath(raw: string | null): string | undefined {
  if (!raw) return undefined;

  const value = raw.trim();
  // Must be a rooted path. Reject protocol-relative ("//evil.com"), absolute
  // ("https://evil.com"), and backslash variants browsers treat as slashes.
  if (!value.startsWith("/")) return undefined;
  if (value.startsWith("//") || value.startsWith("/\\")) return undefined;
  // Control characters can be used to smuggle a scheme past naive checks
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return undefined;
  }

  return value;
}

// Build a sign-in or sign-up URL that returns the user to `destination`.
export function authUrlWithReturn(
  authPath: "/sign-in" | "/sign-up",
  destination: string,
): string {
  return `${authPath}?redirect_url=${encodeURIComponent(destination)}`;
}
