import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requirePermission } from "./adminAccess";
import { logActivity } from "./activityLog";
import { patchLumaWidgetEntireApp } from "./settings";

const CONFIG_ID = "global";
const LUMA_BASE = "https://public-api.luma.com";
const MAX_EVENTS = 80;

export const lumaPlacementValidator = v.union(
  v.literal("list_view"),
  v.literal("grid_view"),
  v.literal("vibe_view"),
  v.literal("submit_page"),
  v.literal("story_detail"),
  v.literal("tag_page"),
  v.literal("events_page"),
);

const DEFAULT_PLACEMENTS: Array<
  | "list_view"
  | "grid_view"
      | "vibe_view"
      | "submit_page"
      | "story_detail"
      | "tag_page"
      | "events_page"
  > = ["list_view", "vibe_view", "events_page", "story_detail"];

const publicEventValidator = v.object({
  _id: v.id("lumaEvents"),
  lumaEventId: v.string(),
  name: v.string(),
  url: v.string(),
  coverUrl: v.optional(v.string()),
  description: v.optional(v.string()),
  startAt: v.optional(v.number()),
  endAt: v.optional(v.number()),
  timezone: v.optional(v.string()),
  order: v.number(),
  showThumbnail: v.boolean(),
  showName: v.boolean(),
  showDates: v.boolean(),
  showDescription: v.boolean(),
  placements: v.array(lumaPlacementValidator),
});

const adminEventValidator = v.object({
  _id: v.id("lumaEvents"),
  lumaEventId: v.string(),
  name: v.string(),
  url: v.string(),
  coverUrl: v.optional(v.string()),
  description: v.optional(v.string()),
  startAt: v.optional(v.number()),
  endAt: v.optional(v.number()),
  timezone: v.optional(v.string()),
  isListed: v.boolean(),
  order: v.number(),
  showThumbnail: v.optional(v.boolean()),
  showName: v.optional(v.boolean()),
  showDates: v.optional(v.boolean()),
  showDescription: v.optional(v.boolean()),
  placements: v.array(lumaPlacementValidator),
});

function lumaApiKey(): string | null {
  const key = process.env.LUMA_API_KEY;
  if (!key || key.trim().length === 0) return null;
  return key.trim();
}

function oneLineDescription(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function parseIsoMs(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return ms;
}

type ParsedLumaEvent = {
  lumaEventId: string;
  name: string;
  url: string;
  coverUrl?: string;
  description?: string;
  startAt?: number;
  endAt?: number;
  timezone?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: Array<string>): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function parseLumaEvent(entry: unknown): ParsedLumaEvent | null {
  const row = asRecord(entry);
  if (!row) return null;
  const nested = asRecord(row.event) ?? row;
  const lumaEventId =
    pickString(nested, ["api_id", "id"]) ?? pickString(row, ["api_id", "id"]);
  const name = pickString(nested, ["name", "title"]);
  if (!lumaEventId || !name) return null;
  const url =
    pickString(nested, ["url", "event_url"]) ??
    `https://lu.ma/${lumaEventId.replace(/^evt-/, "")}`;
  return {
    lumaEventId,
    name,
    url,
    coverUrl: pickString(nested, ["cover_url", "coverUrl", "thumbnail_url"]),
    description: oneLineDescription(
      pickString(nested, ["description", "description_short", "one_liner"]),
    ),
    startAt: parseIsoMs(nested.start_at ?? nested.startAt),
    endAt: parseIsoMs(nested.end_at ?? nested.endAt),
    timezone: pickString(nested, ["timezone", "time_zone"]),
  };
}

function lumaErrorMessage(status: number, bodyText: string): string {
  if (status === 401) {
    return "LUMA_API_KEY is invalid. Paste the secret key value, not the name you gave it, then run npx convex env set LUMA_API_KEY.";
  }
  if (status === 403) {
    return "This API key cannot read that event. Create the key on the same calendar that lists it (select that calendar at luma.com/calendar/manage/api-keys), then click Sync calendar. Keys only see events on the calendar they were created for, including events listed there but hosted by someone else.";
  }
  return `Luma API ${status}: ${bodyText.slice(0, 280)}`;
}

async function lumaGet(
  path: string,
  params?: Record<string, string | Array<string>>,
): Promise<unknown> {
  const key = lumaApiKey();
  if (!key) {
    throw new Error("LUMA_API_KEY is not set on this Convex deployment");
  }
  const url = new URL(`${LUMA_BASE}${path}`);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        url.searchParams.append(name, item);
      }
    }
  }
  const response = await fetch(url.toString(), {
    headers: { "x-luma-api-key": key },
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(lumaErrorMessage(response.status, bodyText));
  }
  if (!bodyText) return {};
  return JSON.parse(bodyText) as unknown;
}

function eventUrlVariants(raw: string): Array<string> {
  const trimmed = raw.trim();
  const variants = [trimmed];
  if (trimmed.includes("luma.com")) {
    variants.push(trimmed.replace("luma.com", "lu.ma"));
  }
  if (trimmed.includes("lu.ma")) {
    variants.push(trimmed.replace("lu.ma", "luma.com"));
  }
  return [...new Set(variants)];
}

function eventSlug(raw: string): string {
  return raw.replace(/\/$/, "").split("/").pop()?.toLowerCase() ?? "";
}

async function listCalendarEvents(): Promise<Array<ParsedLumaEvent>> {
  const events: Array<ParsedLumaEvent> = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    const params: Record<string, string | Array<string>> = {
      pagination_limit: "50",
      sort_column: "start_at",
      sort_direction: "asc",
      status: "approved",
      // Include events listed on this calendar but hosted by another calendar
      access: ["manage", "view"],
    };
    if (cursor) params.pagination_cursor = cursor;
    const body = asRecord(await lumaGet("/v1/calendars/events/list", params));
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    for (const entry of entries) {
      const parsed = parseLumaEvent(entry);
      if (parsed) events.push(parsed);
    }
    const hasMore = body?.has_more === true;
    const next =
      typeof body?.next_cursor === "string" ? body.next_cursor : undefined;
    if (!hasMore || !next) break;
    cursor = next;
  }
  return events;
}

export const getPublicConfig = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    calendarUrl: v.optional(v.string()),
    calendarName: v.optional(v.string()),
    showThumbnail: v.boolean(),
    showName: v.boolean(),
    showDates: v.boolean(),
    showDescription: v.boolean(),
  }),
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("lumaConfig")
      .withIndex("by_identifier", (q) => q.eq("identifier", CONFIG_ID))
      .unique();
    if (!doc) {
      return {
        enabled: false,
        showThumbnail: true,
        showName: true,
        showDates: true,
        showDescription: true,
      };
    }
    return {
      enabled: doc.enabled,
      calendarUrl: doc.calendarUrl,
      calendarName: doc.calendarName,
      showThumbnail: doc.showThumbnail,
      showName: doc.showName,
      showDates: doc.showDates,
      showDescription: doc.showDescription,
    };
  },
});

export const listForPlacement = query({
  args: { placement: lumaPlacementValidator },
  returns: v.array(publicEventValidator),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("lumaConfig")
      .withIndex("by_identifier", (q) => q.eq("identifier", CONFIG_ID))
      .unique();
    if (!config?.enabled) return [];

    const listed = await ctx.db
      .query("lumaEvents")
      .withIndex("by_isListed_and_order", (q) => q.eq("isListed", true))
      .take(MAX_EVENTS);

    const events = listed
      .filter((event) => event.placements.includes(args.placement))
      .sort((a, b) => a.order - b.order);

    return events.map((event) => ({
      _id: event._id,
      lumaEventId: event.lumaEventId,
      name: event.name,
      url: event.url,
      coverUrl: event.coverUrl,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      timezone: event.timezone,
      order: event.order,
      showThumbnail: event.showThumbnail ?? config.showThumbnail,
      showName: event.showName ?? config.showName,
      showDates: event.showDates ?? config.showDates,
      showDescription: event.showDescription ?? config.showDescription,
      placements: event.placements,
    }));
  },
});

export const getAdminState = query({
  args: {},
  returns: v.object({
    config: v.object({
      enabled: v.boolean(),
      calendarUrl: v.optional(v.string()),
      calendarName: v.optional(v.string()),
      showThumbnail: v.boolean(),
      showName: v.boolean(),
      showDates: v.boolean(),
      showDescription: v.boolean(),
      lastSyncedAt: v.optional(v.number()),
      lastSyncError: v.optional(v.string()),
    }),
    events: v.array(adminEventValidator),
  }),
  handler: async (ctx) => {
    await requirePermission(ctx, "settings.view");
    const doc = await ctx.db
      .query("lumaConfig")
      .withIndex("by_identifier", (q) => q.eq("identifier", CONFIG_ID))
      .unique();
    const events = await ctx.db.query("lumaEvents").take(MAX_EVENTS);
    events.sort((a, b) => a.order - b.order);
    return {
      config: {
        enabled: doc?.enabled ?? false,
        calendarUrl: doc?.calendarUrl,
        calendarName: doc?.calendarName,
        showThumbnail: doc?.showThumbnail ?? true,
        showName: doc?.showName ?? true,
        showDates: doc?.showDates ?? true,
        showDescription: doc?.showDescription ?? true,
        lastSyncedAt: doc?.lastSyncedAt,
        lastSyncError: doc?.lastSyncError,
      },
      events: events.map((event) => ({
        _id: event._id,
        lumaEventId: event.lumaEventId,
        name: event.name,
        url: event.url,
        coverUrl: event.coverUrl,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        timezone: event.timezone,
        isListed: event.isListed,
        order: event.order,
        showThumbnail: event.showThumbnail,
        showName: event.showName,
        showDates: event.showDates,
        showDescription: event.showDescription,
        placements: event.placements,
      })),
    };
  },
});

export const updateConfig = mutation({
  args: {
    enabled: v.optional(v.boolean()),
    calendarUrl: v.optional(v.union(v.string(), v.null())),
    showThumbnail: v.optional(v.boolean()),
    showName: v.optional(v.boolean()),
    showDates: v.optional(v.boolean()),
    showDescription: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "settings.manage");
    const existing = await ctx.db
      .query("lumaConfig")
      .withIndex("by_identifier", (q) => q.eq("identifier", CONFIG_ID))
      .unique();
    const patch = {
      enabled: args.enabled,
      calendarUrl:
        args.calendarUrl === null ? undefined : args.calendarUrl,
      showThumbnail: args.showThumbnail,
      showName: args.showName,
      showDates: args.showDates,
      showDescription: args.showDescription,
    };
    const cleaned: Record<string, boolean | string | undefined> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) cleaned[key] = value;
    }
    if (existing) {
      await ctx.db.patch(existing._id, cleaned);
    } else {
      await ctx.db.insert("lumaConfig", {
        identifier: CONFIG_ID,
        enabled: args.enabled ?? false,
        calendarUrl: args.calendarUrl ?? undefined,
        showThumbnail: args.showThumbnail ?? true,
        showName: args.showName ?? true,
        showDates: args.showDates ?? true,
        showDescription: args.showDescription ?? true,
      });
    }
    if (args.enabled !== undefined) {
      await patchLumaWidgetEntireApp(ctx, args.enabled);
    }
    await logActivity(ctx, {
      category: "settings",
      action: "settings.lumaConfigUpdated",
      message: "Updated Luma event settings",
      metadata: { fields: Object.keys(cleaned) },
    });
    return null;
  },
});

export const updateEvent = mutation({
  args: {
    eventId: v.id("lumaEvents"),
    isListed: v.optional(v.boolean()),
    order: v.optional(v.number()),
    showThumbnail: v.optional(v.union(v.boolean(), v.null())),
    showName: v.optional(v.union(v.boolean(), v.null())),
    showDates: v.optional(v.union(v.boolean(), v.null())),
    showDescription: v.optional(v.union(v.boolean(), v.null())),
    placements: v.optional(v.array(lumaPlacementValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "settings.manage");
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    const patch: {
      isListed?: boolean;
      order?: number;
      showThumbnail?: boolean;
      showName?: boolean;
      showDates?: boolean;
      showDescription?: boolean;
      placements?: Array<
        | "list_view"
        | "grid_view"
        | "vibe_view"
        | "submit_page"
        | "story_detail"
        | "tag_page"
        | "events_page"
      >;
    } = {};
    if (args.isListed !== undefined) patch.isListed = args.isListed;
    if (args.order !== undefined) patch.order = args.order;
    if (args.showThumbnail !== undefined) {
      patch.showThumbnail = args.showThumbnail ?? undefined;
    }
    if (args.showName !== undefined) patch.showName = args.showName ?? undefined;
    if (args.showDates !== undefined) {
      patch.showDates = args.showDates ?? undefined;
    }
    if (args.showDescription !== undefined) {
      patch.showDescription = args.showDescription ?? undefined;
    }
    if (args.placements !== undefined) patch.placements = args.placements;
    await ctx.db.patch(args.eventId, patch);
    return null;
  },
});

export const upsertSyncedEvents = internalMutation({
  args: {
    calendarName: v.optional(v.string()),
    error: v.optional(v.string()),
    events: v.array(
      v.object({
        lumaEventId: v.string(),
        name: v.string(),
        url: v.string(),
        coverUrl: v.optional(v.string()),
        description: v.optional(v.string()),
        startAt: v.optional(v.number()),
        endAt: v.optional(v.number()),
        timezone: v.optional(v.string()),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let config = await ctx.db
      .query("lumaConfig")
      .withIndex("by_identifier", (q) => q.eq("identifier", CONFIG_ID))
      .unique();
    if (!config) {
      const id = await ctx.db.insert("lumaConfig", {
        identifier: CONFIG_ID,
        enabled: false,
        showThumbnail: true,
        showName: true,
        showDates: true,
        showDescription: true,
      });
      config = await ctx.db.get(id);
    }
    if (!config) throw new Error("Luma config missing");

    await ctx.db.patch(config._id, {
      calendarName: args.calendarName,
      lastSyncedAt: Date.now(),
      lastSyncError: args.error,
    });

    if (args.error) return 0;

    const existing = await ctx.db.query("lumaEvents").take(MAX_EVENTS);
    const byId = new Map(existing.map((row) => [row.lumaEventId, row]));
    let nextOrder =
      existing.reduce((max, row) => Math.max(max, row.order), -1) + 1;

    for (const incoming of args.events) {
      const current = byId.get(incoming.lumaEventId);
      if (current) {
        await ctx.db.patch(current._id, {
          name: incoming.name,
          url: incoming.url,
          coverUrl: incoming.coverUrl,
          description: incoming.description,
          startAt: incoming.startAt,
          endAt: incoming.endAt,
          timezone: incoming.timezone,
        });
      } else {
        await ctx.db.insert("lumaEvents", {
          ...incoming,
          isListed: false,
          order: nextOrder,
          placements: DEFAULT_PLACEMENTS,
        });
        nextOrder += 1;
      }
    }
    return args.events.length;
  },
});

export const insertLookedUpEvent = internalMutation({
  args: {
    event: v.object({
      lumaEventId: v.string(),
      name: v.string(),
      url: v.string(),
      coverUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      startAt: v.optional(v.number()),
      endAt: v.optional(v.number()),
      timezone: v.optional(v.string()),
    }),
  },
  returns: v.id("lumaEvents"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lumaEvents")
      .withIndex("by_lumaEventId", (q) =>
        q.eq("lumaEventId", args.event.lumaEventId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.event,
        isListed: true,
      });
      return existing._id;
    }
    const listed = await ctx.db
      .query("lumaEvents")
      .withIndex("by_isListed_and_order", (q) => q.eq("isListed", true))
      .take(MAX_EVENTS);
    const maxOrder = listed.reduce((max, row) => Math.max(max, row.order), -1);
    return await ctx.db.insert("lumaEvents", {
      ...args.event,
      isListed: true,
      order: maxOrder + 1,
      placements: DEFAULT_PLACEMENTS,
    });
  },
});

export const assertCanManage = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requirePermission(ctx, "settings.manage");
    return null;
  },
});

export const testConnection = action({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    calendarName: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const allowed: null = await ctx.runQuery(internal.luma.assertCanManage, {});
    void allowed;
    try {
      const calendar = asRecord(await lumaGet("/v1/calendars/get"));
      const name = calendar
        ? pickString(calendar, ["name"]) ??
          pickString(asRecord(calendar.calendar) ?? {}, ["name"])
        : undefined;
      return { ok: true, calendarName: name };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
});

export const syncNow = action({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    count: v.number(),
    calendarName: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const allowed: null = await ctx.runQuery(internal.luma.assertCanManage, {});
    void allowed;
    const result: {
      ok: boolean;
      count: number;
      calendarName?: string;
      error?: string;
    } = await ctx.runAction(internal.luma.syncFromApi, {});
    return result;
  },
});

export const addByUrl = action({
  args: { url: v.string() },
  returns: v.object({
    ok: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const allowed: null = await ctx.runQuery(internal.luma.assertCanManage, {});
    void allowed;
    const url = args.url.trim();
    if (!/^https?:\/\/(lu\.ma|luma\.com)\//i.test(url)) {
      return { ok: false, error: "Paste a lu.ma or luma.com event URL" };
    }
    try {
      let parsed: ParsedLumaEvent | null = null;
      for (const candidate of eventUrlVariants(url)) {
        try {
          const payload = await lumaGet("/v1/calendars/events/lookup", {
            platform: "luma",
            url: candidate,
          });
          parsed =
            parseLumaEvent(payload) ??
            parseLumaEvent(asRecord(payload)?.event) ??
            parseLumaEvent(asRecord(payload)?.entry);
          if (parsed) break;
        } catch {
          // Lookup is calendar-scoped; listed-but-hosted-elsewhere events 403.
        }
      }
      if (!parsed) {
        const slug = eventSlug(url);
        const listed = await listCalendarEvents();
        parsed =
          listed.find((event) => eventSlug(event.url) === slug) ??
          listed.find((event) => event.url.toLowerCase().includes(slug)) ??
          null;
      }
      if (!parsed) {
        return {
          ok: false,
          error:
            "That event is not on the calendar this API key belongs to. Create the key on the calendar that lists the event, then Sync calendar.",
        };
      }
      if (!parsed.url.startsWith("http")) parsed.url = url;
      await ctx.runMutation(internal.luma.insertLookedUpEvent, {
        event: parsed,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Lookup failed",
      };
    }
  },
});

export const syncFromApi = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    count: v.number(),
    calendarName: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    if (!lumaApiKey()) {
      const count: number = await ctx.runMutation(
        internal.luma.upsertSyncedEvents,
        {
          error: "LUMA_API_KEY is not set",
          events: [],
        },
      );
      return { ok: false, count, error: "LUMA_API_KEY is not set" };
    }
    try {
      const calendar = asRecord(await lumaGet("/v1/calendars/get"));
      const calendarName = calendar
        ? pickString(calendar, ["name"]) ??
          pickString(asRecord(calendar.calendar) ?? {}, ["name"])
        : undefined;

      const events = await listCalendarEvents();

      const count: number = await ctx.runMutation(
        internal.luma.upsertSyncedEvents,
        { calendarName, events: events.slice(0, MAX_EVENTS) },
      );
      return { ok: true, count, calendarName };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Luma sync failed";
      await ctx.runMutation(internal.luma.upsertSyncedEvents, {
        error: message,
        events: [],
      });
      return { ok: false, count: 0, error: message };
    }
  },
});
