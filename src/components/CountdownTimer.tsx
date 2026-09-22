import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  CountdownSize,
  describeRemaining,
  formatDeadline,
  splitRemaining,
} from "../lib/countdown";

// Live countdown to an absolute deadline. The deadline is an epoch ms
// timestamp, so every visitor sees the same instant rendered in their own
// time zone. Display only: callers decide what happens after the deadline.

// Tick once a second while mounted. A timer is an external system, so an
// effect is the right tool here; the interval is cleared on unmount.
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function CountdownTimer({
  endsAt,
  size = "large",
  label,
  className = "",
}: {
  endsAt: number;
  size?: CountdownSize;
  label?: string;
  className?: string;
}) {
  const now = useNow(1000);
  const remaining = splitRemaining(endsAt, now);
  const heading = label?.trim() || "Submissions close in";
  const deadlineText = formatDeadline(endsAt, now);

  const units: Array<{ value: number; unit: string }> = [
    { value: remaining.days, unit: "days" },
    { value: remaining.hours, unit: "hours" },
    { value: remaining.minutes, unit: "minutes" },
    { value: remaining.seconds, unit: "seconds" },
  ];

  if (size === "compact") {
    return (
      <div
        role="timer"
        aria-label={`${heading}: ${describeRemaining(remaining)}. Deadline ${deadlineText}.`}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-hairline bg-surface px-4 py-2.5 text-sm ${className}`}
      >
        <span className="inline-flex items-center gap-1.5 text-copy">
          <Clock className="w-4 h-4 text-faint" aria-hidden="true" />
          <span className="font-medium text-ink">
            {remaining.expired ? "Deadline passed" : heading}
          </span>
        </span>
        {!remaining.expired && (
          <span
            aria-hidden="true"
            className="inline-flex items-baseline gap-2 font-medium text-ink tabular-nums"
          >
            <span>
              {remaining.days}
              <span className="text-faint text-xs ml-0.5">d</span>
            </span>
            <span>
              {pad(remaining.hours)}
              <span className="text-faint text-xs ml-0.5">h</span>
            </span>
            <span>
              {pad(remaining.minutes)}
              <span className="text-faint text-xs ml-0.5">m</span>
            </span>
            <span>
              {pad(remaining.seconds)}
              <span className="text-faint text-xs ml-0.5">s</span>
            </span>
          </span>
        )}
        {/* Labelled so it still reads correctly when it wraps to its own line */}
        <span className="text-soft">
          <span className="text-faint">Deadline</span> {deadlineText}
        </span>
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-label={`${heading}: ${describeRemaining(remaining)}. Deadline ${deadlineText}.`}
      className={`rounded-xl border border-hairline bg-surface px-6 py-5 sm:px-8 sm:py-6 text-center ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-faint">
        {remaining.expired ? "Deadline passed" : heading}
      </p>
      {!remaining.expired && (
        <div
          aria-hidden="true"
          className="mt-3 flex items-start justify-center gap-4 sm:gap-8"
        >
          {units.map(({ value, unit }, index) => (
            <div key={unit} className="flex items-start gap-4 sm:gap-8">
              <div className="min-w-[2.5ch] sm:min-w-[3ch]">
                <div className="text-4xl sm:text-5xl font-medium tracking-tight text-ink tabular-nums leading-none">
                  {unit === "days" ? value : pad(value)}
                </div>
                <div className="mt-2 text-[11px] sm:text-xs font-medium uppercase tracking-wider text-faint">
                  {unit}
                </div>
              </div>
              {index < units.length - 1 && (
                <div className="text-3xl sm:text-4xl font-light text-hairline-strong leading-none pt-0.5 select-none">
                  :
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-sm text-soft">
        <span className="text-copy">Deadline</span> {deadlineText}
        <span className="text-faint"> (your local time)</span>
      </p>
    </div>
  );
}
