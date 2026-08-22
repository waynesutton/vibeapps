import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export function BackToAppsLink({
  to = "/",
  label = "Back to all apps",
}: {
  to?: string;
  label?: string;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="inline-flex items-center justify-center size-11 -ml-2 shrink-0 rounded-md text-soft hover:text-ink hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
    </Link>
  );
}
