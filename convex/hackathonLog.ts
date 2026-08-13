// Shared helpers for the pasted hackathon.md submission log.
// Used by the submission mutations (cap + secret redaction) and by the
// AI judge analysis action (deterministic header parsing + cross-checks).
// Plain functions only; no Convex function registrations here.

// Server-side cap for pasted hackathon.md content
export const HACKATHON_LOG_MAX_CHARS = 20000;

// Known secret shapes replaced with [redacted] before storing. The pasted
// text later lands in an LLM prompt, so it is treated as untrusted input.
const SECRET_PATTERNS: Array<RegExp> = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g, // OpenAI/Anthropic style secret keys
  /\bpk_[A-Za-z0-9_-]{8,}\b/g, // publishable/private key prefixes (Stripe, Clerk)
  /\bghp_[A-Za-z0-9]{8,}\b/g, // GitHub personal access tokens
  /\bgho_[A-Za-z0-9]{8,}\b/g, // GitHub OAuth tokens
  /\bgithub_pat_[A-Za-z0-9_]{8,}\b/g, // GitHub fine-grained PATs
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, // Slack tokens
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key IDs
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // three-segment JWTs
  /\b(?:prod|dev|preview):[A-Za-z0-9-]+\|[A-Za-z0-9+/=_-]{16,}/g, // Convex deploy keys
];

// Replace known secret shapes with [redacted], keeping surrounding text.
export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[redacted]");
  }
  return result;
}

/**
 * Validate and sanitize a pasted hackathon.md for storage.
 * Returns the redacted string, undefined when empty, and throws a readable
 * error when over the cap so every submission path fails the same way.
 */
export function sanitizeHackathonLog(
  raw: string | undefined,
): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > HACKATHON_LOG_MAX_CHARS) {
    throw new Error(
      `Hackathon log is too long (${trimmed.length} characters). ` +
        `Maximum is ${HACKATHON_LOG_MAX_CHARS} characters; trim your hackathon.md and try again.`,
    );
  }
  return redactSecrets(trimmed);
}

// Parsed fields from the fixed hackathon.md header block
export type HackathonLogHeader = {
  event?: string;
  project?: string;
  whatItDoes?: string;
  liveApp?: string;
  repo?: string;
  frontend?: string;
  convexDeployment?: string;
  components?: Array<string>;
  features?: Array<string>;
  auth?: string;
  aiModels?: Array<string>;
  started?: string;
  lastUpdated?: string;
};

// Maps normalized header labels to header keys. Unknown labels are ignored
// so future skill versions can add fields without a parser change.
const HEADER_LABEL_MAP: Record<string, keyof HackathonLogHeader> = {
  event: "event",
  project: "project",
  "what it does": "whatItDoes",
  "live app": "liveApp",
  repo: "repo",
  frontend: "frontend",
  "convex deployment": "convexDeployment",
  components: "components",
  features: "features",
  "convex features": "features",
  auth: "auth",
  "ai models": "aiModels",
  started: "started",
  "last updated": "lastUpdated",
};

const LIST_FIELDS: ReadonlySet<keyof HackathonLogHeader> = new Set([
  "components",
  "features",
  "aiModels",
]);

/**
 * Deterministically parse the hackathon.md header from lines shaped like
 * "- **Field:** value". Participant-written markdown, so malformed input
 * never throws; absent fields stay undefined.
 */
export function parseHackathonLogHeader(md: string): HackathonLogHeader {
  const header: HackathonLogHeader = {};
  if (!md) return header;

  for (const rawLine of md.split("\n")) {
    // Match "- **Label:** value" and "- **Label**: value" variants
    const match = /^\s*[-*]\s*\*\*([^*:]+):?\*\*:?\s*(.*)$/.exec(rawLine);
    if (!match) continue;
    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();
    const key = HEADER_LABEL_MAP[label];
    if (!key || !value) continue;
    if (LIST_FIELDS.has(key)) {
      const items = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length > 0) {
        (header[key] as Array<string>) = items;
      }
    } else {
      (header[key] as string) = value;
    }
  }
  return header;
}
