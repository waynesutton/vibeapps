import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BackToAppsLink } from "../components/BackToAppsLink";
import { LumaEventCard } from "../components/LumaEventCard";

export function EventsPage() {
  const config = useQuery(api.luma.getPublicConfig);
  const events = useQuery(api.luma.listForPlacement, {
    placement: "events_page",
  });

  return (
    <div className="pt-1 pb-2">
      <header className="flex items-center gap-1.5 sm:gap-2 mb-4 min-h-11">
        <BackToAppsLink />
        <h1 className="text-[15px] font-medium text-ink">Upcoming events</h1>
      </header>

      {config?.calendarUrl && (
        <p className="text-sm text-soft mb-4">
          Events from{" "}
          <a
            href={config.calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-copy hover:text-ink hover:underline"
          >
            {config.calendarName || "Luma"}
          </a>
          .
        </p>
      )}

      {events === undefined ? (
        <p className="text-sm text-soft">Loading events...</p>
      ) : events.length === 0 ? (
        <div className="p-6 bg-surface rounded-lg border border-hairline">
          <p className="text-sm text-copy">No upcoming events listed yet.</p>
          <p className="text-sm text-soft mt-1">
            Check back soon, or browse{" "}
            <Link to="/" className="hover:text-ink hover:underline">
              the app catalog
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-0 bg-surface rounded-lg border border-hairline divide-y divide-hairline">
          {events.map((event) => (
            <div key={event._id} className="p-4">
              <LumaEventCard event={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
