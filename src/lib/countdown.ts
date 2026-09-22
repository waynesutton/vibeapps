// Pure helpers for the submission deadline countdown. Kept out of the
// component file so admin screens can format deadlines without importing
// React, and so fast refresh keeps working on the component.

export type CountdownSize = "large" | "compact";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

// Split the gap between now and the deadline into whole units, never negative
export function splitRemaining(endsAt: number, now: number): Remaining {
  const diff = endsAt - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  return {
    days: Math.floor(diff / MS_PER_DAY),
    hours: Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((diff % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((diff % MS_PER_MINUTE) / MS_PER_SECOND),
    expired: false,
  };
}

// Deadline in the viewer's local time with a short zone name, for example
// "Tue, Sep 22, 12:00 PM PDT". Year is added when it is not the current one.
export function formatDeadline(endsAt: number, now: number = Date.now()) {
  const deadline = new Date(endsAt);
  const sameYear = deadline.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(deadline);
}

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

// Screen reader summary. The ticking digits are aria-hidden in the
// component, so this label is what assistive tech reads.
export function describeRemaining(remaining: Remaining) {
  if (remaining.expired) return "Deadline passed";
  return `${plural(remaining.days, "day")}, ${plural(remaining.hours, "hour")}, ${plural(remaining.minutes, "minute")} remaining`;
}
