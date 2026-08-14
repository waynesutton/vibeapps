import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, ToggleLeft, ToggleRight } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";

// Full group detail shape returned by judgingGroups.getGroupWithDetails
export type GroupDetails = NonNullable<
  FunctionReturnType<typeof api.judgingGroups.getGroupWithDetails>
>;

// Configurable submission form fields and their default required state.
// These map to the fields rendered on the public custom submission page.
export const SUBMISSION_FIELD_DEFS = [
  { key: "title", label: "App Title", default: true },
  { key: "tagline", label: "App/Project Tagline", default: true },
  { key: "longDescription", label: "Description", default: false },
  { key: "url", label: "App Website Link", default: true },
  { key: "githubUrl", label: "GitHub Repo URL", default: false },
  { key: "videoUrl", label: "Video Demo", default: false },
  { key: "screenshot", label: "Screenshot or Image", default: true },
  { key: "submitterName", label: "Your Name", default: true },
  { key: "email", label: "Email", default: false },
  { key: "tags", label: "Tags", default: true },
] as const;

export type SubmissionFieldKey = (typeof SUBMISSION_FIELD_DEFS)[number]["key"];

// Whole form sections that can be shown/hidden and marked required.
// additionalLinks covers the global optional link fields (LinkedIn, X,
// Chef links) managed in Form Fields settings.
export const SUBMISSION_SECTION_DEFS = [
  { key: "teamInfo", label: "Hackathon Team Info section" },
  { key: "additionalImages", label: "Additional Images (up to 4)" },
  { key: "additionalLinks", label: "Additional link fields (LinkedIn, X, Chef...)" },
] as const;

export type SubmissionSectionKey =
  (typeof SUBMISSION_SECTION_DEFS)[number]["key"];
// Requirements cover core fields plus form sections (sections default optional)
export type SubmissionRequirementKey = SubmissionFieldKey | SubmissionSectionKey;
export type SubmissionFieldRequirements = Record<
  SubmissionRequirementKey,
  boolean
>;
export type SubmissionVisibilityKey = SubmissionFieldKey | SubmissionSectionKey;
export type SubmissionFieldVisibility = Record<
  SubmissionVisibilityKey,
  boolean
>;

// Per-group overrides for admin-managed form fields (Manage Form Fields),
// keyed by the field's key. Unset entries fall back to the field defaults.
export type DynamicFieldOverrides = Record<
  string,
  { required?: boolean; visible?: boolean }
>;

// Title can never be hidden: judging lists, results, and the AI judge all
// key off the story title.
export const ALWAYS_VISIBLE_FIELD_KEYS: ReadonlyArray<SubmissionFieldKey> = [
  "title",
];

// Admin-defined custom question appended to the group submission form.
export type CustomQuestion = {
  key: string;
  label: string;
  placeholder?: string;
  description?: string;
  fieldType:
    | "text"
    | "url"
    | "email"
    | "textarea"
    | "radio"
    | "multiselect"
    | "select";
  options?: string[]; // Choices for radio/multiselect/select questions
  required: boolean;
  visible?: boolean; // Unset = shown
};

// Merge stored (partial) visibility over the default (everything visible).
export function mergeVisibility(
  stored?: Partial<SubmissionFieldVisibility> | null,
): SubmissionFieldVisibility {
  const result = {} as SubmissionFieldVisibility;
  for (const def of SUBMISSION_FIELD_DEFS) {
    result[def.key] = true;
  }
  for (const def of SUBMISSION_SECTION_DEFS) {
    result[def.key] = true;
  }
  if (stored) {
    (Object.keys(result) as SubmissionVisibilityKey[]).forEach((key) => {
      if (typeof stored[key] === "boolean") {
        result[key] = stored[key] as boolean;
      }
    });
  }
  // Enforce always-visible fields regardless of stored data
  for (const key of ALWAYS_VISIBLE_FIELD_KEYS) {
    result[key] = true;
  }
  return result;
}

// Build a stable slug key for a custom question label, unique among existing keys.
export function makeQuestionKey(label: string, existingKeys: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "question";
  let key = base;
  let counter = 2;
  while (existingKeys.includes(key)) {
    key = `${base}-${counter}`;
    counter++;
  }
  return key;
}

// AI rubric criteria for the weights editor. Keys must match AI_JUDGE_RUBRIC
// in convex/aiJudge.ts; the mutation validates against the server list.
export const AI_RUBRIC_DEFS = [
  { key: "schema", label: "Schema and data modeling" },
  { key: "functions", label: "Queries, mutations, and actions" },
  { key: "realtime", label: "Real-time reactivity" },
  { key: "advanced", label: "Advanced Convex features" },
  { key: "depth", label: "Overall depth and correctness" },
  { key: "liveness", label: "Live app status" },
] as const;

export const DEFAULT_RUBRIC_WEIGHTS: Record<string, number> =
  AI_RUBRIC_DEFS.reduce(
    (acc, def) => {
      acc[def.key] = 1;
      return acc;
    },
    {} as Record<string, number>,
  );

// Frontend checker hosting platforms and their default sub-weights. Keys must
// match AI_FRONTEND_PLATFORMS in convex/aiJudge.ts; the mutation validates
// against the server list. The detected platform's weight multiplies the
// frontend-checker criterion weight in the weighted ranking.
export const FRONTEND_CHECKER_KEY = "frontend-checker";
export const AI_FRONTEND_PLATFORM_DEFS = [
  { key: "codex-sites", label: "Codex Sites" },
  { key: "convex-hosting", label: "Convex static hosting" },
  { key: "vercel", label: "Vercel" },
  { key: "netlify", label: "Netlify" },
  { key: "other", label: "Other" },
] as const;

export const DEFAULT_FRONTEND_PLATFORM_WEIGHTS: Record<string, number> =
  AI_FRONTEND_PLATFORM_DEFS.reduce(
    (acc, def) => {
      acc[def.key] = 1;
      return acc;
    },
    {} as Record<string, number>,
  );

export const DEFAULT_FIELD_REQUIREMENTS: SubmissionFieldRequirements = (() => {
  const result = {} as SubmissionFieldRequirements;
  for (const field of SUBMISSION_FIELD_DEFS) {
    result[field.key] = field.default;
  }
  // Sections default to optional
  for (const section of SUBMISSION_SECTION_DEFS) {
    result[section.key] = false;
  }
  return result;
})();

// Merge stored (partial) requirements over the defaults so unset keys keep defaults.
export function mergeRequirements(
  stored?: Partial<SubmissionFieldRequirements> | null,
): SubmissionFieldRequirements {
  const result = { ...DEFAULT_FIELD_REQUIREMENTS };
  if (stored) {
    (Object.keys(result) as SubmissionRequirementKey[]).forEach((key) => {
      if (typeof stored[key] === "boolean") {
        result[key] = stored[key] as boolean;
      }
    });
  }
  return result;
}

// Format a ms timestamp into a yyyy-mm-dd string for <input type="date"> using
// local date parts (avoids UTC day-shift from toISOString).
export function tsToDateInput(ts?: number | null): string {
  if (ts === undefined || ts === null) return "";
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Convert a yyyy-mm-dd input into an inclusive start-of-day timestamp, or null.
export function dateInputToStartTs(value: string): number | null {
  if (!value) return null;
  const ts = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(ts) ? null : ts;
}

// Convert a yyyy-mm-dd input into an inclusive end-of-day timestamp, or null.
export function dateInputToEndTs(value: string): number | null {
  if (!value) return null;
  const ts = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isNaN(ts) ? null : ts;
}

// Track a save button's lifecycle so every panel gives the same feedback.
export function useSaveState() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await fn();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
              .replace(/^\[.*?\]\s*/, "")
              .replace(/^Uncaught Error:\s*/, "")
          : "Failed to save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return { saving, saved, error, setError, run };
}

// Bordered panel with a header, body, and optional footer (docs-style card).
// headerAction renders on the right side of the header, e.g. a save button
// for long cards where the footer save is below the fold.
export function SectionCard({
  title,
  description,
  children,
  footer,
  headerAction,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <div className="px-5 pt-4 pb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && (
            <p className="text-[13px] text-soft mt-0.5">{description}</p>
          )}
        </div>
        {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-hairline bg-surface-alt rounded-b-lg flex items-center justify-between gap-3">
          {footer}
        </div>
      )}
    </div>
  );
}

// Standard footer contents: inline error/success on the left, save on the right.
export function SaveFooter({
  saving,
  saved,
  error,
  onSave,
  disabled,
  label = "Save",
}: {
  saving: boolean;
  saved: boolean;
  error: string;
  onSave: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <>
      <div className="min-w-0 text-[13px]">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : saved ? (
          <span className="text-green-700 inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        ) : (
          <span className="text-faint">Changes apply on save</span>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      >
        {saving ? "Saving..." : label}
      </button>
    </>
  );
}

// Compact save button for card headers on long sections, so a save is
// always visible without scrolling to the footer.
export function HeaderSaveButton({
  saving,
  saved,
  onSave,
  disabled,
}: {
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving || disabled}
      className="px-3 py-1 text-xs font-medium rounded-md bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
    >
      {saved && <Check className="w-3 h-3" />}
      {saving ? "Saving..." : saved ? "Saved" : "Save"}
    </button>
  );
}

// One public URL with copy and open-in-new-tab actions.
export function UrlRow({ label, path, hint }: { label: string; path: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the path stays visible for manual copy
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-hairline bg-surface">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="text-xs text-soft truncate font-mono">{path}</p>
        {hint && <p className="text-xs text-faint mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 text-faint hover:text-copy hover:bg-surface-hover rounded transition-colors"
          title="Copy full URL"
          aria-label={`Copy ${label} URL`}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-faint hover:text-copy hover:bg-surface-hover rounded transition-colors"
          title="Open in new tab"
          aria-label={`Open ${label} in new tab`}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// Green/gray pill toggle used for on/off group features.
export function TogglePill({
  enabled,
  onToggle,
  onLabel,
  offLabel,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  onLabel: string;
  offLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[13px] font-medium transition-colors flex-shrink-0 disabled:opacity-50 ${
        enabled
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-surface-alt border-hairline text-copy"
      }`}
    >
      {enabled ? (
        <ToggleRight className="w-4 h-4" />
      ) : (
        <ToggleLeft className="w-4 h-4" />
      )}
      {enabled ? onLabel : offLabel}
    </button>
  );
}
