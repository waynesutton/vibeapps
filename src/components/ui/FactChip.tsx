import type { ReactNode } from "react";

// Small status pill for recorded facts (URL live, hosting, sponsors, fork).
// Tone carries meaning; neutral is the default. Chips never wrap their text:
// long labels truncate and keep the full text in the tooltip.
export type FactChipTone = "neutral" | "good" | "warn" | "bad" | "info";

const TONE_STYLES: Record<FactChipTone, string> = {
  neutral: "bg-surface-alt text-soft border-hairline",
  good: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30",
  warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  bad: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
};

type FactChipProps = {
  tone?: FactChipTone;
  title?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function FactChip({
  tone = "neutral",
  title,
  icon,
  className = "",
  children,
}: FactChipProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs leading-4 ${TONE_STYLES[tone]} ${className}`}
      title={title}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
