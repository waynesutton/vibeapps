import React from "react";
import { playVibeSound } from "../../lib/vibeSound";

interface VibeButtonProps {
  /** Vote count as stored, i.e. including this user's vote when they have one. */
  count: number;
  /** Whether the signed-in user has already vibed this story. */
  vibed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Drop the rolling counter when the count is already shown alongside. */
  hideCount?: boolean;
  /** Smaller icon and padding, for the narrow stacked column. */
  compact?: boolean;
}

/**
 * The vibe control: a spring-loaded thumb that fills the pill on press.
 *
 * The count rolls between two stacked values, so the baseline is the count
 * *without* this user's vote and the second line is one higher — which is why
 * `count` is adjusted here rather than in the caller.
 */
export function VibeButton({
  count,
  vibed,
  onToggle,
  disabled,
  title,
  className = "",
  hideCount = false,
  compact = false,
}: VibeButtonProps) {
  // Replays the keyframes on each press without leaving the attribute set.
  const [state, setState] = React.useState<"vibed" | "unvibed" | undefined>();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const base = vibed ? count - 1 : count;

  const handleClick = () => {
    if (disabled) return;
    playVibeSound(!vibed);
    setState(vibed ? "unvibed" : "vibed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(undefined), 800);
    onToggle();
  };

  return (
    <button
      type="button"
      className={`vb-spring ${compact ? "vb-spring--compact" : ""} ${className}`}
      aria-pressed={vibed}
      aria-label={`${vibed ? "Remove your vibe from" : "Vibe"} this app, ${count} ${count === 1 ? "vibe" : "vibes"}`}
      data-state={state}
      disabled={disabled}
      title={title}
      onClick={handleClick}
    >
      <span className="vb-spring__thumb">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 10.5 11.4 3.8C11.8 3 12.7 2.8 13.4 3.2 14.5 3.9 15 5.2 14.6 6.5L13.7 9.5H19C20.3 9.5 21.3 10.7 21 12L19.5 18.9C19.3 19.8 18.5 20.5 17.5 20.5H8Z" />
          <path d="M2.6 10.5H4.8V20.5H2.6Z" />
        </svg>
        <span className="vb-spring__lines">
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="vb-spring__label">
        Vibe<span>d</span>
      </span>
      {!hideCount && (
        <span className="vb-spring__count">
          <span>
            <b>{base.toLocaleString()}</b>
            <b>{(base + 1).toLocaleString()}</b>
          </span>
        </span>
      )}
    </button>
  );
}
