import { format } from "date-fns";

export function formatLumaDateRange(
  startAt?: number,
  endAt?: number,
): string | null {
  if (!startAt) return null;
  const start = new Date(startAt);
  if (!endAt || endAt <= startAt) {
    return format(start, "EEE, MMM d");
  }
  const end = new Date(endAt);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    if (start.getDate() === end.getDate()) {
      return format(start, "EEE, MMM d");
    }
    return `${format(start, "MMM d")} – ${format(end, "d")}`;
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}
