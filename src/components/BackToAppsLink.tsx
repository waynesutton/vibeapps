import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export function BackToAppsLink({
  to = "/",
  label = "Back to all apps",
  showLabel = false,
}: {
  to?: string;
  label?: string;
  /** Render the label next to the chevron. Without it this is an icon-only
   *  control, which reads as a stray "<" wherever it sits on its own. */
  showLabel?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={`inline-flex items-center shrink-0 rounded-md text-soft hover:text-ink hover:bg-surface-hover transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
        showLabel
          ? "gap-1 h-9 pl-1 pr-3 -ml-1 text-sm font-medium"
          : "justify-center size-11 -ml-2"
      }`}
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
      {showLabel && <span>{label}</span>}
    </Link>
  );
}
