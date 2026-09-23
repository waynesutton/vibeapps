// Content policy notice shared by settings (server) and the UI (client).
// Pure constants and helpers only, so the frontend can import this file.

export const CONTENT_POLICY_MAX_LENGTH = 1000;

export const DEFAULT_CONTENT_POLICY_TEXT =
  "Share what you built. Keep it clean. Admins and moderators can hide or remove any app, comment, or profile at any time. NSFW, adult, hateful, or illegal content is not allowed. Neither is spam, malware, or anything that collects user data without consent.";

// Only plain http(s) links are allowed so a javascript: URL never reaches public pages
export function isValidContentPolicyUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url);
}
