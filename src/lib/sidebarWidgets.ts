export type SidebarWidgetKey = "mostVibes" | "recentVibers" | "topCategories";

export type SidebarWidgetSurface =
  | "listView"
  | "gridView"
  | "vibeView"
  | "submitPage"
  | "tagPage";

export type LumaWidgetSurface = SidebarWidgetSurface | "storyDetail";

export type SidebarWidgetRow = {
  entireApp: boolean;
  listView: boolean;
  gridView: boolean;
  vibeView: boolean;
  submitPage: boolean;
  tagPage: boolean;
};

export type LumaWidgetRow = SidebarWidgetRow & {
  storyDetail: boolean;
};

export type SidebarWidgets = Record<SidebarWidgetKey, SidebarWidgetRow> & {
  lumaEvents: LumaWidgetRow;
};

export const DEFAULT_WIDGET_ROW: SidebarWidgetRow = {
  entireApp: true,
  listView: true,
  gridView: false,
  vibeView: true,
  submitPage: true,
  tagPage: true,
};

export const DEFAULT_LUMA_WIDGET_ROW: LumaWidgetRow = {
  ...DEFAULT_WIDGET_ROW,
  storyDetail: true,
};

export const DEFAULT_SIDEBAR_WIDGETS: SidebarWidgets = {
  mostVibes: { ...DEFAULT_WIDGET_ROW },
  recentVibers: { ...DEFAULT_WIDGET_ROW },
  topCategories: { ...DEFAULT_WIDGET_ROW },
  lumaEvents: { ...DEFAULT_LUMA_WIDGET_ROW },
};

export function mergeSidebarWidgets(
  widgets: Partial<SidebarWidgets> | undefined,
): SidebarWidgets {
  return {
    mostVibes: { ...DEFAULT_WIDGET_ROW, ...widgets?.mostVibes },
    recentVibers: { ...DEFAULT_WIDGET_ROW, ...widgets?.recentVibers },
    topCategories: { ...DEFAULT_WIDGET_ROW, ...widgets?.topCategories },
    lumaEvents: { ...DEFAULT_LUMA_WIDGET_ROW, ...widgets?.lumaEvents },
  };
}

export function resolveWidgetRow(
  widgets: Partial<SidebarWidgets> | undefined,
  key: SidebarWidgetKey,
): SidebarWidgetRow {
  return mergeSidebarWidgets(widgets)[key];
}

export function isSidebarWidgetVisible(
  widgets: Partial<SidebarWidgets> | undefined,
  key: SidebarWidgetKey,
  surface: SidebarWidgetSurface,
): boolean {
  const row = resolveWidgetRow(widgets, key);
  if (!row.entireApp) return false;
  return row[surface];
}

export function isLumaWidgetVisible(
  widgets: Partial<SidebarWidgets> | undefined,
  surface: LumaWidgetSurface,
): boolean {
  const row = mergeSidebarWidgets(widgets).lumaEvents;
  if (!row.entireApp) return false;
  return row[surface];
}
