import React, { useState, useEffect } from "react";
import { Save, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { SiteSettings } from "../../types";

export function Settings() {
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
      setLocalSettings(editableSettings);
    }
  }, [currentSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | boolean = value;

    if (type === "checkbox") {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === "number") {
      processedValue = value === "" ? 0 : parseInt(value, 10); // Handle empty input for numbers
    }

    setLocalSettings((prev) => ({ ...prev, [name]: processedValue }));
    setShowSuccess(false); // Hide success message on new change
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
      if (localSettings.siteTitle !== undefined) updates.siteTitle = localSettings.siteTitle;
      // Add other fields here...

      await updateSettings(updates);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000); // Hide after 3 seconds
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
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
      currentSettings ? (({ _id, _creationTime, ...rest }) => rest)(currentSettings) : {}
    );

  // Check if settings need initialization (i.e., _id is missing)
  const needsInitialization = currentSettings !== undefined && !("_id" in currentSettings);

  if (needsInitialization) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-sm text-yellow-800 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-medium">Site Settings Not Initialized</h3>
        </div>
        <p>Initial site settings need to be created in the database.</p>
        <button
          onClick={handleInitialize}
          className="px-3 py-1 bg-yellow-200 text-yellow-900 rounded hover:bg-yellow-300 transition-colors text-xs font-medium">
          Initialize Default Settings
        </button>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  if (currentSettings === undefined) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-medium text-[#525252]">Site Settings</h2>
          {(hasChanges || showSuccess) && (
            <div className="flex items-center gap-4">
              {showSuccess && <span className="text-sm text-green-600">Saved!</span>}
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm">
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>
        )}

        <div className="space-y-4 max-w-md">
          {/* Site Title Setting */}
          <div>
            <label htmlFor="siteTitle" className="block text-sm font-medium text-[#525252] mb-1">
              Site Title
            </label>
            <input
              id="siteTitle"
              name="siteTitle"
              type="text"
              value={localSettings.siteTitle ?? ""}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
              disabled={isSaving}
            />
          </div>

          {/* Items Per Page Setting */}
          <div>
            <label htmlFor="itemsPerPage" className="block text-sm font-medium text-[#525252] mb-1">
              Submissions Per Page (Load More quantity)
            </label>
            <input
              id="itemsPerPage"
              name="itemsPerPage"
              type="number"
              min="5" // Example min value
              max="100" // Example max value
              value={localSettings.itemsPerPage ?? ""}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
              disabled={isSaving}
            />
          </div>

          {/* Add other settings fields here based on convex/settings.ts args */}
          {/* Example Checkbox: 
          <div>
            <label className="flex items-center gap-2">
              <input
                name="someBooleanSetting" // Matches arg name in update mutation
                type="checkbox"
                checked={localSettings.someBooleanSetting ?? false}
                onChange={handleChange}
                className="rounded border-[#D5D3D0] text-[#2A2825] focus:ring-[#2A2825]"
                disabled={isSaving}
              />
              <span className="text-sm text-[#525252]">Enable Some Feature</span>
            </label>
          </div>
          */}
        </div>
      </div>
    </div>
  );
}
