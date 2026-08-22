import React, { useState, useEffect } from "react";
import { Save, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { SiteSettings } from "../../types";
import { ConvexBoxSettingsForm } from "./ConvexBoxSettingsForm";
import { LumaEventsSettings } from "./LumaEventsSettings";
import { SimpleSelect } from "../ui/SimpleSelect";
import {
  DEFAULT_SIDEBAR_WIDGETS,
  mergeSidebarWidgets,
  type LumaWidgetSurface,
  type SidebarWidgetKey,
  type SidebarWidgetSurface,
  type SidebarWidgets,
} from "../../lib/sidebarWidgets";

// Define SortPeriod locally for type casting, mirroring Layout.tsx
type SortPeriod =
  | "today"
  | "week"
  | "month"
  | "year"
  | "all"
  | "votes_today"
  | "votes_week"
  | "votes_month"
  | "votes_year"
  | "votes_all";

// Define ViewMode locally for type casting
type ViewMode = "list" | "grid" | "vibe";

// Define DEFAULT_SETTINGS at the top of the file, for example:
const DEFAULT_SETTINGS_FRONTEND = {
  itemsPerPage: 20,
  siteTitle: "Vibe Apps",
  defaultSortPeriod: "all" as SortPeriod,
  showListView: true,
  showGridView: true,
  showVibeView: true,
  siteDefaultViewMode: "vibe" as ViewMode | "none",
  profilePageDefaultViewMode: "list" as ViewMode | "none",
  adminDashboardDefaultViewMode: "list" as ViewMode | "none",
  showSubmissionLimit: true,
  submissionLimitCount: 10,
  hideSubmitPageSidebar: false,
  sidebarWidgets: DEFAULT_SIDEBAR_WIDGETS,
};

export function Settings() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const currentSettings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);
  const initializeSettings = useMutation(api.settings.initialize); // For first-time setup

  const [localSettings, setLocalSettings] = useState<Partial<SiteSettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      // Initialize local state with fetched settings, excluding system fields
      const { _id, _creationTime, ...editableSettings } = currentSettings;
      // Ensure all new fields are initialized in localSettings, even if not in currentSettings initially
      setLocalSettings({
        ...DEFAULT_SETTINGS_FRONTEND,
        ...editableSettings,
      });
    }
  }, [currentSettings]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | boolean = value;

    if (type === "checkbox") {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === "number") {
      processedValue = value === "" ? 0 : parseInt(value, 10); // Handle empty input for numbers
    } else if (name === "defaultSortPeriod") {
      processedValue = value as SortPeriod; // Ensure it's treated as SortPeriod type
    } else if (name === "siteDefaultViewMode") {
      processedValue = value as ViewMode | "none";
    } else if (
      name === "profilePageDefaultViewMode" ||
      name === "adminDashboardDefaultViewMode"
    ) {
      processedValue = value as ViewMode | "none";
    }

    setLocalSettings((prev: any) => ({ ...prev, [name]: processedValue }));
    setShowSuccess(false); // Hide success message on new change
    setError(null);
  };

  // Handler for themed SimpleSelect dropdowns (value comes in directly)
  const handleSelectValueChange = (name: string, value: string) => {
    setLocalSettings((prev: any) => ({ ...prev, [name]: value }));
    setShowSuccess(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!currentSettings) {
      setError("Cannot save, current settings not loaded.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setShowSuccess(false);
    try {
      // Only send fields that exist in the mutation args
      const updates: Partial<SiteSettings> = {};
      if (localSettings.itemsPerPage !== undefined)
        updates.itemsPerPage = localSettings.itemsPerPage;
      if (localSettings.siteTitle !== undefined)
        updates.siteTitle = localSettings.siteTitle;
      if (localSettings.defaultSortPeriod !== undefined) {
        updates.defaultSortPeriod = localSettings.defaultSortPeriod;
      }
      // Add new settings to updates
      if (localSettings.showListView !== undefined)
        updates.showListView = localSettings.showListView;
      if (localSettings.showGridView !== undefined)
        updates.showGridView = localSettings.showGridView;
      if (localSettings.showVibeView !== undefined)
        updates.showVibeView = localSettings.showVibeView;
      if (localSettings.siteDefaultViewMode !== undefined) {
        updates.siteDefaultViewMode = localSettings.siteDefaultViewMode;
      }
      if (localSettings.profilePageDefaultViewMode !== undefined) {
        updates.profilePageDefaultViewMode =
          localSettings.profilePageDefaultViewMode;
      }
      if (localSettings.adminDashboardDefaultViewMode !== undefined) {
        updates.adminDashboardDefaultViewMode =
          localSettings.adminDashboardDefaultViewMode;
      }
      // Add new submission limit settings to updates
      if (localSettings.showSubmissionLimit !== undefined)
        updates.showSubmissionLimit = localSettings.showSubmissionLimit;
      if (localSettings.submissionLimitCount !== undefined)
        updates.submissionLimitCount = localSettings.submissionLimitCount;
      // Submit page layout setting
      if (localSettings.hideSubmitPageSidebar !== undefined)
        updates.hideSubmitPageSidebar = localSettings.hideSubmitPageSidebar;
      if (localSettings.sidebarWidgets !== undefined)
        updates.sidebarWidgets = mergeSidebarWidgets(
          localSettings.sidebarWidgets,
        );

      await updateSettings(updates);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000); // Hide after 3 seconds
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitialize = async () => {
    setError(null);
    try {
      await initializeSettings({});
      // Settings will refetch via useQuery
    } catch (err) {
      console.error("Failed to initialize settings:", err);
      setError(err instanceof Error ? err.message : "Initialization failed.");
    }
  };

  const hasChanges =
    JSON.stringify(localSettings) !==
    JSON.stringify(
      currentSettings
        ? (({ _id, _creationTime, ...rest }) => rest)(currentSettings)
        : {},
    );

  // Check if settings need initialization (i.e., _id is missing)
  const needsInitialization =
    currentSettings !== undefined && !("_id" in currentSettings);

  // Handle auth loading state globally for the component if desired,
  // though individual query loading is handled below.
  if (authIsLoading) {
    return (
      <div className="space-y-8 text-center">Loading authentication...</div>
    );
  }

  // If settings data itself is loading (and auth is done)
  if (!authIsLoading && currentSettings === undefined) {
    return <div className="text-center">Loading settings...</div>;
  }

  // If settings need initialization (and auth is done)
  if (!authIsLoading && needsInitialization) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-sm text-yellow-800 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-medium">Site Settings Not Initialized</h3>
        </div>
        <p>Initial site settings need to be created in the database.</p>
        <button
          onClick={handleInitialize}
          className="px-3 py-1 bg-yellow-200 text-yellow-900 rounded hover:bg-yellow-300 transition-colors text-xs font-medium"
        >
          Initialize Default Settings
        </button>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  if (!authIsLoading && currentSettings === undefined) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-surface rounded-lg p-6 border border-hairline">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-medium text-copy">Site Settings</h2>
          {(hasChanges || showSuccess) && (
            <div className="flex items-center gap-4">
              {showSuccess && (
                <span className="text-sm text-green-600">Saved!</span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="px-4 py-2 bg-surface-alt text-copy rounded-md hover:bg-surface-hover transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 max-w-md">
          {/* Site Title Setting */}
          <div>
            <label
              htmlFor="siteTitle"
              className="block text-sm font-medium text-copy mb-1"
            >
              Site Title
            </label>
            <input
              id="siteTitle"
              name="siteTitle"
              type="text"
              value={localSettings.siteTitle ?? ""}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink"
              disabled={isSaving}
            />
          </div>

          {/* Items Per Page Setting */}
          <div>
            <label
              htmlFor="itemsPerPage"
              className="block text-sm font-medium text-copy mb-1"
            >
              Submissions Per Page (Load More quantity)
            </label>
            <input
              id="itemsPerPage"
              name="itemsPerPage"
              type="number"
              min="5" // Example min value
              max="100" // Example max value
              value={
                localSettings.itemsPerPage ??
                DEFAULT_SETTINGS_FRONTEND.itemsPerPage
              }
              onChange={handleChange}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink"
              disabled={isSaving}
            />
          </div>

          {/* Default Sort Period Setting */}
          <div>
            <label
              htmlFor="defaultSortPeriod"
              className="block text-sm font-medium text-copy mb-1"
            >
              Default Homepage Sort
            </label>
            <SimpleSelect
              id="defaultSortPeriod"
              value={localSettings.defaultSortPeriod || "all"} // Default to 'all' if not set
              onChange={(value) =>
                handleSelectValueChange("defaultSortPeriod", value)
              }
              disabled={isSaving}
              className="w-full h-auto py-2"
              options={[
                { value: "today", label: "Today" },
                { value: "week", label: "This Week" },
                { value: "month", label: "This Month" },
                { value: "year", label: "This Year" },
                { value: "all", label: "Most Recent" },
                { value: "votes_today", label: "Most Vibes (Today)" },
                { value: "votes_week", label: "Most Vibes (Week)" },
                { value: "votes_month", label: "Most Vibes (Month)" },
                { value: "votes_year", label: "Most Vibes (Year)" },
                { value: "votes_all", label: "Most Vibes (All Time)" },
              ]}
            />
          </div>

          {/* --- New View Mode Settings --- */}
          <div className="pt-6 mt-6 border-t border-hairline">
            <h3 className="text-lg font-medium text-copy mb-4">
              View Mode Configuration
            </h3>

            {/* View Mode Visibility */}
            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium text-copy">
                Show View Mode Icons:
              </p>
              {["showListView", "showGridView", "showVibeView"].map((key) => {
                const typedKey = key as keyof Pick<
                  SiteSettings,
                  "showListView" | "showGridView" | "showVibeView"
                >;
                return (
                  <label key={typedKey} className="flex items-center gap-2">
                    <input
                      name={typedKey}
                      type="checkbox"
                      checked={localSettings[typedKey] ?? true} // Default to true if undefined
                      onChange={handleChange}
                      className="rounded border-hairline-strong text-ink focus:ring-ink"
                      disabled={isSaving}
                    />
                    <span className="text-sm text-copy">
                      {typedKey.replace("show", "").replace("View", " View")}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Site Default View Mode Setting */}
            <div>
              <label
                htmlFor="siteDefaultViewMode"
                className="block text-sm font-medium text-copy mb-1"
              >
                Site Default View Mode (Homepage, etc.)
              </label>
              <SimpleSelect
                id="siteDefaultViewMode"
                value={localSettings.siteDefaultViewMode || "none"}
                onChange={(value) =>
                  handleSelectValueChange("siteDefaultViewMode", value)
                }
                disabled={isSaving}
                className="w-full h-auto py-2"
                options={[
                  {
                    value: "none",
                    label: "None (User selection or first available)",
                  },
                  ...(localSettings.showListView
                    ? [{ value: "list", label: "List View" }]
                    : []),
                  ...(localSettings.showGridView
                    ? [{ value: "grid", label: "Grid View" }]
                    : []),
                  ...(localSettings.showVibeView
                    ? [{ value: "vibe", label: "Vibe View" }]
                    : []),
                ]}
              />
              <p className="text-xs text-soft mt-1">
                If a view mode is hidden, it cannot be set as default. 'None'
                means no view mode is pre-selected.
              </p>
            </div>

            {/* Profile Page Default View Mode */}
            <div className="mt-4">
              <label
                htmlFor="profilePageDefaultViewMode"
                className="block text-sm font-medium text-copy mb-1"
              >
                Profile Page Default View Mode
              </label>
              {/* Profile page can always choose, not tied to show...View settings for header icons */}
              <SimpleSelect
                id="profilePageDefaultViewMode"
                value={localSettings.profilePageDefaultViewMode || "list"}
                onChange={(value) =>
                  handleSelectValueChange("profilePageDefaultViewMode", value)
                }
                disabled={isSaving}
                className="w-full h-auto py-2"
                options={[
                  {
                    value: "none",
                    label: "None (User selection or first available)",
                  },
                  { value: "list", label: "List View" },
                  { value: "grid", label: "Grid View" },
                  { value: "vibe", label: "Vibe View" },
                ]}
              />
            </div>

            {/* Admin Dashboard Default View Mode */}
            <div className="mt-4">
              <label
                htmlFor="adminDashboardDefaultViewMode"
                className="block text-sm font-medium text-copy mb-1"
              >
                Admin Dashboard Default View Mode
              </label>
              {/* Admin page can always choose */}
              <SimpleSelect
                id="adminDashboardDefaultViewMode"
                value={localSettings.adminDashboardDefaultViewMode || "list"}
                onChange={(value) =>
                  handleSelectValueChange(
                    "adminDashboardDefaultViewMode",
                    value,
                  )
                }
                disabled={isSaving}
                className="w-full h-auto py-2"
                options={[
                  {
                    value: "none",
                    label: "None (User selection or first available)",
                  },
                  { value: "list", label: "List View" },
                  { value: "grid", label: "Grid View" },
                  { value: "vibe", label: "Vibe View" },
                ]}
              />
            </div>
          </div>

          {/* --- Submission Limit Settings --- */}
          <div className="pt-6 mt-6 border-t border-hairline">
            <h3 className="text-lg font-medium text-copy mb-4">
              Submission Limit Settings
            </h3>

            {/* Show Submission Limit */}
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  name="showSubmissionLimit"
                  type="checkbox"
                  checked={localSettings.showSubmissionLimit ?? true}
                  onChange={handleChange}
                  className="rounded border-hairline-strong text-ink focus:ring-ink"
                  disabled={isSaving}
                />
                <span className="text-sm font-medium text-copy">
                  Show submission limit message on forms
                </span>
              </label>
              <p className="text-xs text-soft mt-1 ml-6">
                When enabled, displays the daily submission limit message on
                story submission forms
              </p>
            </div>

            {/* Submission Limit Count */}
            {localSettings.showSubmissionLimit && (
              <div>
                <label
                  htmlFor="submissionLimitCount"
                  className="block text-sm font-medium text-copy mb-1"
                >
                  Daily Submission Limit
                </label>
                <input
                  id="submissionLimitCount"
                  name="submissionLimitCount"
                  type="number"
                  min="1"
                  max="100"
                  value={localSettings.submissionLimitCount ?? 10}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink max-w-[200px]"
                  disabled={isSaving}
                />
                <p className="text-xs text-soft mt-1">
                  Maximum number of projects users can submit per day
                </p>
              </div>
            )}
          </div>
        </div>

          {/* Sidebar widgets + submit layout */}
          <div className="pt-6 mt-6 border-t border-hairline">
            <h3 className="text-lg font-medium text-copy mb-1">
              Sidebar widgets
            </h3>
            <p className="text-xs text-soft mb-4">
              Entire app off hides Most Vibes, Recent Vibers, and Top Categories
              everywhere. Luma is different: judging groups can hide events on
              their own submit, join, and judging pages even when Luma is on
              here. App page only applies to Luma (below View Change Log). Grid
              stays off by default.
            </p>

            <SidebarWidgetMatrix
              widgets={mergeSidebarWidgets(localSettings.sidebarWidgets)}
              disabled={isSaving}
              onChange={(key, surface, value) => {
                setLocalSettings((prev) => {
                  const current = mergeSidebarWidgets(prev.sidebarWidgets);
                  if (key === "lumaEvents") {
                    return {
                      ...prev,
                      sidebarWidgets: {
                        ...current,
                        lumaEvents: {
                          ...current.lumaEvents,
                          [surface]: value,
                        },
                      },
                    };
                  }
                  return {
                    ...prev,
                    sidebarWidgets: {
                      ...current,
                      [key]: { ...current[key], [surface]: value },
                    },
                  };
                });
                setShowSuccess(false);
                setError(null);
              }}
            />

            <div className="mt-5">
              <label className="flex items-center gap-2">
                <input
                  name="hideSubmitPageSidebar"
                  type="checkbox"
                  checked={localSettings.hideSubmitPageSidebar ?? false}
                  onChange={handleChange}
                  className="rounded border-hairline-strong text-ink focus:ring-ink"
                  disabled={isSaving}
                />
                <span className="text-sm font-medium text-copy">
                  Hide the entire right sidebar on /submit
                </span>
              </label>
              <p className="text-xs text-soft mt-1 ml-6">
                Turns off Most Vibes, Recent Vibers, Top Categories, and Luma
                events on the default submit page and widens the form. This
                still wins even if a widget is on for Submit. Judging group
                submit pages are separate and use that group's Luma hide
                toggle.
              </p>
            </div>
          </div>
      </div>

      <LumaEventsSettings />
      <ConvexBoxSettingsForm />
    </div>
  );
}

const WIDGET_ROWS: Array<{ key: SidebarWidgetKey; label: string }> = [
  { key: "mostVibes", label: "Most Vibes This Week" },
  { key: "recentVibers", label: "Recent Vibers" },
  { key: "topCategories", label: "Top Categories This Week" },
];

const SURFACES: Array<{
  key: SidebarWidgetSurface | "entireApp" | "storyDetail";
  label: string;
}> = [
  { key: "entireApp", label: "Entire app" },
  { key: "listView", label: "List" },
  { key: "gridView", label: "Grid" },
  { key: "vibeView", label: "Vibe" },
  { key: "submitPage", label: "Submit" },
  { key: "tagPage", label: "Categories" },
  { key: "storyDetail", label: "App page" },
];

function SidebarWidgetMatrix({
  widgets,
  disabled,
  onChange,
}: {
  widgets: SidebarWidgets;
  disabled: boolean;
  onChange: (
    key: SidebarWidgetKey | "lumaEvents",
    surface: SidebarWidgetSurface | "entireApp" | LumaWidgetSurface,
    value: boolean,
  ) => void;
}) {
  const luma = widgets.lumaEvents;
  const lumaLocked = !luma.entireApp;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-xs text-soft">
            <th className="py-2 pr-3 font-medium">Widget</th>
            {SURFACES.map((surface) => (
              <th key={surface.key} className="py-2 px-2 font-medium text-center">
                {surface.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WIDGET_ROWS.map((row) => {
            const values = widgets[row.key];
            const locked = !values.entireApp;
            return (
              <tr key={row.key} className="border-t border-hairline">
                <td className="py-2 pr-3 text-copy font-medium">{row.label}</td>
                {SURFACES.map((surface) => {
                  if (surface.key === "storyDetail") {
                    return (
                      <td
                        key={surface.key}
                        className="py-2 px-2 text-center text-faint"
                        title="App page is a Luma placement"
                      >
                        —
                      </td>
                    );
                  }
                  const isMaster = surface.key === "entireApp";
                  const greyed = !isMaster && locked;
                  return (
                    <td key={surface.key} className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={values[surface.key]}
                        disabled={disabled || greyed}
                        onChange={(e) =>
                          onChange(row.key, surface.key, e.target.checked)
                        }
                        className="rounded border-hairline-strong text-ink focus:ring-ink disabled:opacity-40"
                        aria-label={`${row.label} on ${surface.label}`}
                        title={
                          greyed
                            ? "Hidden site-wide. Turn Entire app on to change this surface."
                            : undefined
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-t border-hairline">
            <td className="py-2 pr-3 text-copy font-medium">Luma events</td>
            {SURFACES.map((surface) => {
              const isMaster = surface.key === "entireApp";
              const greyed = !isMaster && lumaLocked;
              return (
                <td key={surface.key} className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={luma[surface.key]}
                    disabled={disabled || greyed}
                    onChange={(e) =>
                      onChange("lumaEvents", surface.key, e.target.checked)
                    }
                    className="rounded border-hairline-strong text-ink focus:ring-ink disabled:opacity-40"
                    aria-label={`Luma events on ${surface.label}`}
                    title={
                      greyed
                        ? "Hidden site-wide. Turn Entire app on to change this surface."
                        : surface.key === "storyDetail"
                          ? "Shows listed events below View Change Log on app pages"
                          : undefined
                    }
                  />
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
