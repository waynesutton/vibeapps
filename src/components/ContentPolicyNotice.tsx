import { ShieldAlert, ArrowUpRight } from "lucide-react";

type ContentPolicyNoticeProps = {
  enabled?: boolean;
  text?: string;
  url?: string;
  variant?: "form" | "modal";
  className?: string;
};

// Admin editable content policy (Settings > Content policy). Plain text only;
// renders nothing when turned off, empty, or while settings are loading.
export function ContentPolicyNotice({
  enabled,
  text,
  url,
  variant = "form",
  className = "",
}: ContentPolicyNoticeProps) {
  const body = text?.trim();
  if (!enabled || !body) return null;
  const link = url?.trim();

  const policyLink = link ? (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-ink"
    >
      Read the full policy
      <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
    </a>
  ) : null;

  // About modal: section inside the prose block
  if (variant === "modal") {
    return (
      <div role="note" aria-label="Content policy" className={className}>
        <p className="font-medium text-ink !mb-1">Content policy</p>
        <p className="whitespace-pre-line !mt-0">{body}</p>
        {policyLink && <p className="!mt-1">{policyLink}</p>}
      </div>
    );
  }

  // Submit forms: muted inset note right above the submit button
  return (
    <div
      role="note"
      aria-label="Content policy"
      className={`flex gap-2.5 rounded-md border border-hairline bg-surface-alt px-3 py-2.5 text-xs leading-relaxed text-soft ${className}`}
    >
      <ShieldAlert
        className="w-4 h-4 mt-px shrink-0 text-faint"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <p className="whitespace-pre-line text-pretty">{body}</p>
        {policyLink && <p className="text-copy">{policyLink}</p>}
      </div>
    </div>
  );
}
