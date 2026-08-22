import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatLumaDateRange } from "../../lib/lumaDates";
import {
  mergeSidebarWidgets,
  type LumaWidgetSurface,
} from "../../lib/sidebarWidgets";

const PLACEMENTS: Array<{
  value:
    | "list_view"
    | "grid_view"
    | "vibe_view"
    | "submit_page"
    | "story_detail"
    | "tag_page"
    | "events_page";
  label: string;
}> = [
  { value: "list_view", label: "List sidebar" },
  { value: "grid_view", label: "Grid sidebar" },
  { value: "vibe_view", label: "Vibe sidebar" },
  { value: "submit_page", label: "Submit page" },
  { value: "story_detail", label: "App detail" },
  { value: "tag_page", label: "Categories" },
  { value: "events_page", label: "/events page" },
];

export function LumaEventsSettings() {
  const state = useQuery(api.luma.getAdminState);
  const siteSettings = useQuery(api.settings.get);
  const updateConfig = useMutation(api.luma.updateConfig);
  const updateSettings = useMutation(api.settings.update);
  const updateEvent = useMutation(api.luma.updateEvent);
  const removeEvent = useMutation(api.luma.removeEvent);
  const testConnection = useAction(api.luma.testConnection);
  const syncNow = useAction(api.luma.syncNow);
  const addByUrl = useAction(api.luma.addByUrl);

  const [calendarUrl, setCalendarUrl] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"test" | "sync" | "add" | "save" | null>(
    null,
  );
  const [openId, setOpenId] = useState<Id<"lumaEvents"> | null>(null);

  const config = state?.config;
  const hydratedUrl = calendarUrl || config?.calendarUrl || "";

  const run = async (
    kind: "test" | "sync" | "add" | "save",
    fn: () => Promise<void>,
  ) => {
    setBusy(kind);
    setError(null);
    setStatus(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  if (state === undefined) {
    return <p className="text-sm text-soft">Loading Luma settings...</p>;
  }

  return (
    <div className="bg-surface rounded-lg p-6 border border-hairline space-y-5">
      <div>
        <h3 className="text-lg font-medium text-copy">Luma events</h3>
        <p className="text-xs text-soft mt-1">
          Showcase upcoming Luma events in the catalog sidebar, on app pages,
          and at /events. The API key stays on the Convex deployment.
        </p>
      </div>

      <div className="rounded-md border border-hairline bg-surface-alt p-3 text-xs text-copy space-y-1">
        <p className="font-medium text-ink">Set the API key</p>
        <p className="font-mono text-[11px] text-soft break-all">
          npx convex env set LUMA_API_KEY your-key
        </p>
        <p className="font-mono text-[11px] text-soft break-all">
          npx convex env set LUMA_API_KEY your-key --prod
        </p>
        <p className="text-soft">
          Paste the secret key value, not the name you gave it. Create the key
          while that calendar is selected at luma.com/calendar/manage/api-keys.
          A key from your personal calendar cannot read luma.com/convex events.
        </p>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config?.enabled ?? false}
          onChange={(e) => {
            void run("save", async () => {
              await updateConfig({ enabled: e.target.checked });
              setStatus(
                e.target.checked
                  ? "Luma events are visible on the site"
                  : "Luma events are hidden",
              );
            });
          }}
          className="rounded border-hairline-strong text-ink focus:ring-ink"
          disabled={busy !== null}
        />
        <span className="text-sm font-medium text-copy">
          Show listed Luma events on the site
        </span>
      </label>
      <p className="text-xs text-soft -mt-3 ml-6">
        Matches Entire app on the Luma row in Sidebar widgets above.
      </p>

      {(() => {
        const lumaRow = mergeSidebarWidgets(siteSettings?.sidebarWidgets)
          .lumaEvents;
        const locked = !lumaRow.entireApp;
        const surfaces: Array<{ key: LumaWidgetSurface; label: string }> = [
          { key: "listView", label: "List sidebar" },
          { key: "gridView", label: "Grid sidebar" },
          { key: "vibeView", label: "Vibe sidebar" },
          { key: "submitPage", label: "Submit page" },
          { key: "tagPage", label: "Categories" },
          { key: "storyDetail", label: "App page (below View Change Log)" },
        ];
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-2 ml-6">
            {surfaces.map((surface) => (
              <label
                key={surface.key}
                className="flex items-center gap-2 text-sm text-copy"
              >
                <input
                  type="checkbox"
                  checked={lumaRow[surface.key]}
                  disabled={busy !== null || locked || siteSettings === undefined}
                  onChange={(e) => {
                    void run("save", async () => {
                      const next = mergeSidebarWidgets(
                        siteSettings?.sidebarWidgets,
                      );
                      next.lumaEvents[surface.key] = e.target.checked;
                      await updateSettings({ sidebarWidgets: next });
                      setStatus(`Updated ${surface.label}`);
                    });
                  }}
                  className="rounded border-hairline-strong text-ink focus:ring-ink disabled:opacity-40"
                />
                {surface.label}
              </label>
            ))}
          </div>
        );
      })()}

      <div>
        <label
          htmlFor="lumaCalendarUrl"
          className="block text-sm font-medium text-copy mb-1"
        >
          Luma calendar URL
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="lumaCalendarUrl"
            type="url"
            value={hydratedUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
            placeholder="https://lu.ma/your-calendar"
            className="flex-1 px-3 py-2 bg-surface border border-hairline rounded-md text-copy text-sm focus:outline-none focus:ring-1 focus:ring-ink"
          />
          <button
            type="button"
            onClick={() =>
              void run("save", async () => {
                await updateConfig({
                  calendarUrl: hydratedUrl.trim() || null,
                });
                setStatus("Calendar URL saved");
              })
            }
            className="px-3 py-2 text-sm bg-surface-alt border border-hairline rounded-md text-copy hover:bg-surface-hover"
            disabled={busy !== null}
          >
            Save URL
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-copy mb-2">Default card fields</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {(
            [
              ["showThumbnail", "Thumbnail"],
              ["showName", "Event name"],
              ["showDates", "Dates"],
              ["showDescription", "One-line description"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-copy">
              <input
                type="checkbox"
                checked={config?.[key] ?? true}
                onChange={(e) => {
                  void updateConfig({ [key]: e.target.checked });
                }}
                className="rounded border-hairline-strong text-ink focus:ring-ink"
                disabled={busy !== null}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            void run("test", async () => {
              const result = await testConnection({});
              if (result.ok) {
                setStatus(
                  result.calendarName
                    ? `Connected to ${result.calendarName}`
                    : "API key is valid",
                );
              } else {
                setError(result.error ?? "Connection failed");
              }
            })
          }
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-cta text-on-cta rounded-md hover:bg-cta-hover disabled:opacity-50"
          disabled={busy !== null}
        >
          {busy === "test" && <Loader2 className="size-3.5 animate-spin" />}
          Test API key
        </button>
        <button
          type="button"
          onClick={() =>
            void run("sync", async () => {
              const result = await syncNow({});
              if (result.ok) {
                setStatus(
                  `Refreshed ${result.count} listed event${result.count === 1 ? "" : "s"}${
                    result.calendarName ? ` from ${result.calendarName}` : ""
                  }`,
                );
              } else {
                setError(result.error ?? "Sync failed");
              }
            })
          }
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-surface-alt border border-hairline rounded-md text-copy hover:bg-surface-hover disabled:opacity-50"
          disabled={busy !== null}
        >
          {busy === "sync" && <Loader2 className="size-3.5 animate-spin" />}
          Refresh listed events
        </button>
      </div>

      {config?.lastSyncedAt && (
        <p className="text-xs text-soft">
          Last sync {new Date(config.lastSyncedAt).toLocaleString()}
          {config.lastSyncError ? ` · ${config.lastSyncError}` : ""}
        </p>
      )}

      <div>
        <label
          htmlFor="lumaEventUrl"
          className="block text-sm font-medium text-copy mb-1"
        >
          Add a Luma event URL
        </label>
        <p className="text-xs text-soft mb-1">
          Only events you add here show in the list below and on the site.
          Refresh updates their titles and dates. It does not import the rest of
          the calendar.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="lumaEventUrl"
            type="url"
            value={eventUrl}
            onChange={(e) => setEventUrl(e.target.value)}
            placeholder="https://luma.com/abstract-convex-26"
            className="flex-1 px-3 py-2 bg-surface border border-hairline rounded-md text-copy text-sm focus:outline-none focus:ring-1 focus:ring-ink"
          />
          <button
            type="button"
            onClick={() =>
              void run("add", async () => {
                const result = await addByUrl({ url: eventUrl.trim() });
                if (result.ok) {
                  setEventUrl("");
                  setStatus("Event listed");
                } else {
                  setError(result.error ?? "Could not add that URL");
                }
              })
            }
            className="px-3 py-2 text-sm bg-surface-alt border border-hairline rounded-md text-copy hover:bg-surface-hover disabled:opacity-50"
            disabled={busy !== null || eventUrl.trim().length === 0}
          >
            {busy === "add" ? "Adding..." : "Add event"}
          </button>
        </div>
      </div>

      {status && <p className="text-sm text-copy">{status}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-ink">Listed events</h4>
        {state.events.length === 0 ? (
          <p className="text-sm text-soft">
            Paste a Luma event URL above. The rest of the calendar stays out of
            this list.
          </p>
        ) : (
          state.events.map((event, index) => {
            const open = openId === event._id;
            return (
              <div
                key={event._id}
                className="rounded-md border border-hairline bg-surface p-3"
              >
                <div className="flex items-start gap-3">
                  {event.coverUrl && (
                    <img
                      src={event.coverUrl}
                      alt=""
                      width={48}
                      height={27}
                      className="w-12 h-[27px] rounded-sm object-cover border border-hairline"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {event.name}
                    </p>
                    <p className="text-xs text-soft">
                      {formatLumaDateRange(event.startAt, event.endAt) ??
                        "Date not set"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => {
                        const prev = state.events[index - 1];
                        if (!prev) return;
                        void Promise.all([
                          updateEvent({ eventId: event._id, order: prev.order }),
                          updateEvent({ eventId: prev._id, order: event.order }),
                        ]);
                      }}
                      className="size-8 rounded-md text-soft hover:bg-surface-hover disabled:opacity-30"
                    >
                      <ChevronUp className="size-4 mx-auto" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === state.events.length - 1}
                      onClick={() => {
                        const next = state.events[index + 1];
                        if (!next) return;
                        void Promise.all([
                          updateEvent({ eventId: event._id, order: next.order }),
                          updateEvent({ eventId: next._id, order: event.order }),
                        ]);
                      }}
                      className="size-8 rounded-md text-soft hover:bg-surface-hover disabled:opacity-30"
                    >
                      <ChevronDown className="size-4 mx-auto" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : event._id)}
                      className="text-xs text-soft hover:text-ink px-2 py-1"
                    >
                      {open ? "Hide" : "Places"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void run("save", async () => {
                          await removeEvent({ eventId: event._id });
                          if (openId === event._id) setOpenId(null);
                          setStatus("Event removed");
                        });
                      }}
                      className="text-xs text-soft hover:text-ink px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="mt-3 pt-3 border-t border-hairline space-y-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {PLACEMENTS.map((place) => (
                        <label
                          key={place.value}
                          className="flex items-center gap-2 text-xs text-copy"
                        >
                          <input
                            type="checkbox"
                            checked={event.placements.includes(place.value)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...event.placements, place.value]
                                : event.placements.filter(
                                    (item) => item !== place.value,
                                  );
                              void updateEvent({
                                eventId: event._id,
                                placements: next,
                              });
                            }}
                            className="rounded border-hairline-strong text-ink focus:ring-ink"
                          />
                          {place.label}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-soft">
                      Card fields inherit the defaults above unless you change
                      them here later. Open the event on Luma from the public
                      cards.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
