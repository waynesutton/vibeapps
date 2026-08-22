import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LumaEventCard } from "./LumaEventCard";

type Placement =
  | "list_view"
  | "grid_view"
  | "vibe_view"
  | "submit_page"
  | "story_detail"
  | "tag_page"
  | "events_page";

export function LumaEventList({
  placement,
  compact = false,
  enabled = true,
}: {
  placement: Placement;
  compact?: boolean;
  enabled?: boolean;
}) {
  const events = useQuery(
    api.luma.listForPlacement,
    enabled ? { placement } : "skip",
  );

  if (!enabled || events === undefined || events.length === 0) return null;

  return (
    <div className="p-4 bg-surface rounded-lg border border-hairline">
      <h3 className="text-md font-normal text-ink mb-3">Upcoming events</h3>
      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={event._id}>
            {index > 0 && <hr className="border-hairline mb-3" />}
            <LumaEventCard event={event} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  );
}
