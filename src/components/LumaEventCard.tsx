import { ExternalLink } from "lucide-react";
import { formatLumaDateRange } from "../lib/lumaDates";

export type LumaPublicEvent = {
  _id: string;
  name: string;
  url: string;
  coverUrl?: string;
  description?: string;
  startAt?: number;
  endAt?: number;
  showThumbnail: boolean;
  showName: boolean;
  showDates: boolean;
  showDescription: boolean;
};

export function LumaEventCard({
  event,
  compact = false,
}: {
  event: LumaPublicEvent;
  compact?: boolean;
}) {
  const dates = event.showDates
    ? formatLumaDateRange(event.startAt, event.endAt)
    : null;

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-md p-1 -m-1 hover:bg-surface-hover transition-colors"
    >
      {event.showThumbnail && event.coverUrl && (
        <img
          src={event.coverUrl}
          alt=""
          width={compact ? 64 : 88}
          height={compact ? 36 : 50}
          className={`${compact ? "w-16 h-9" : "w-[5.5rem] h-[3.125rem]"} shrink-0 rounded-md object-cover border border-hairline bg-surface-alt`}
        />
      )}
      <div className="min-w-0 flex-1">
        {event.showName && (
          <p className="app-title-sm text-ink group-hover:underline line-clamp-2">
            {event.name}
          </p>
        )}
        {dates && (
          <p className="text-[13px] text-soft mt-0.5 tabular-nums">{dates}</p>
        )}
        {event.showDescription && event.description && (
          <p className="text-[13px] text-copy mt-0.5 line-clamp-1">
            {event.description}
          </p>
        )}
        <span className="sr-only">View on Luma</span>
      </div>
      <ExternalLink
        className="size-3.5 text-faint shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </a>
  );
}
