import React, { useState, useEffect } from "react";
import { Plus, X, Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { Tag } from "../../types";

// Make properties explicit to help TS
interface EditableTag extends Tag {
  _id: Id<"tags">;
  _creationTime: number;
  name: string;
  showInHeader: boolean;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export function TagManagement() {
  const allTags = useQuery(api.tags.list);
  const createTag = useMutation(api.tags.create);
  const updateTag = useMutation(api.tags.update);
  const deleteTag = useMutation(api.tags.deleteTag);

  const [editableTags, setEditableTags] = useState<EditableTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tags from Convex into editable state and reset local flags
  useEffect(() => {
    if (allTags) {
      // Preserve locally modified/new/deleted tags if saving is in progress
      // or if there was an error, otherwise refresh from source.
      if (!isSaving && !error) {
        setEditableTags(
          allTags.map((tag) => ({
            ...tag,
            isNew: false,
            isModified: false,
            isDeleted: false,
          }))
        );
      } else if (error) {
        // On error, maybe reconcile? For now, just keep local state
        // If a tag was successfully created/deleted but others failed,
        // the useQuery update might overwrite local changes.
        // A more robust solution would diff here too.
      }
      // If isSaving, do nothing, let handleSave complete.
    }
  }, [allTags, isSaving, error]); // Depend on isSaving and error

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) {
      setError("Tag name cannot be empty.");
      return;
    }
    if (
      editableTags.some((tag) => tag.name.toLowerCase() === name.toLowerCase() && !tag.isDeleted)
    ) {
      setError("Tag name already exists.");
      return;
    }
    // Add visually with isNew flag
    setEditableTags((prevTags) => [
      ...prevTags,
      {
        // Generate a temporary client-side ID for new tags
        // Note: This ID is temporary and will be replaced by the Convex ID upon successful save.
        _id: `new-${Date.now()}-${Math.random()}` as Id<"tags">,
        name,
        showInHeader: true, // Default for new tags
        _creationTime: Date.now(),
        isNew: true,
        isModified: true, // Mark as modified to be included in save
        isDeleted: false,
      },
    ]);
    setNewTagName("");
    setError(null);
  };

  const handleToggleHeader = (tagId: Id<"tags">) => {
    setEditableTags((prevTags) =>
      prevTags.map((tag) =>
        tag._id === tagId ? { ...tag, showInHeader: !tag.showInHeader, isModified: true } : tag
      )
    );
  };

  const handleDeleteTag = (tagId: Id<"tags">) => {
    setEditableTags((prevTags) =>
      prevTags.map((tag) =>
        // Mark for deletion, setting isModified
        tag._id === tagId ? { ...tag, isDeleted: true, isModified: true } : tag
      )
    );
  };

  const handleUndeleteTag = (tagId: Id<"tags">) => {
    setEditableTags((prevTags) =>
      prevTags.map(
        (tag) =>
          // Unmark deletion, ensuring isModified reflects whether it needs saving
          // If it was originally new, it just needs isNew=true, isModified=true
          // If it was existing, it needs isModified=true if state differs from original
          tag._id === tagId ? { ...tag, isDeleted: false, isModified: true } : tag // Simplified: always mark modified on undo for now
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    const changesToSave: Array<Promise<unknown>> = [];

    // Get a fresh snapshot of tags from Convex to avoid stale data issues
    // This requires fetching `allTags` at the point of save or trusting the cache
    const currentTagsMap = new Map(allTags?.map((t) => [t._id, t]));
    const currentTagsByName = new Map(allTags?.map((t) => [t.name.toLowerCase(), t]));

    const tagsToKeepLocally: EditableTag[] = [];
    const successfullySavedIds = new Set<Id<"tags">>(); // Track successful saves

    for (const tag of editableTags) {
      if (!tag.isModified) {
        tagsToKeepLocally.push(tag); // Keep unmodified tags
        continue;
      }

      const originalTag = currentTagsMap.get(tag._id);

      if (tag.isDeleted) {
        if (!tag.isNew && originalTag) {
          // Only attempt to delete existing tags
          changesToSave.push(
            deleteTag({ tagId: tag._id })
              .then(() => successfullySavedIds.add(tag._id))
              .catch((err) => {
                // Handle specific error for this tag
                console.error(`Failed to delete tag ${tag.name}:`, err);
                tagsToKeepLocally.push({ ...tag, isDeleted: true, isModified: true }); // Keep in UI as deleted but unsaved
                throw err; // Re-throw to fail Promise.all
              })
          );
        }
        // If it was new and marked for deletion, it simply vanishes, don't keep it locally
      } else if (tag.isNew) {
        // Check for name collisions just before saving
        if (currentTagsByName.has(tag.name.toLowerCase())) {
          setError(`Tag name "${tag.name}" already exists.`);
          tagsToKeepLocally.push({ ...tag }); // Keep the unsaved new tag in UI
          continue; // Skip this tag, let others proceed if possible
        }
        changesToSave.push(
          createTag({ name: tag.name, showInHeader: tag.showInHeader })
            .then((newId) => successfullySavedIds.add(newId)) // Track success by new ID
            .catch((err) => {
              console.error(`Failed to create tag ${tag.name}:`, err);
              tagsToKeepLocally.push({ ...tag, isNew: true, isModified: true }); // Keep in UI as new but unsaved
              throw err;
            })
        );
      } else if (originalTag) {
        // It's an existing tag being updated
        const updates: { name?: string; showInHeader?: boolean } = {};
        if (tag.name !== originalTag.name) updates.name = tag.name;
        if (tag.showInHeader !== originalTag.showInHeader) updates.showInHeader = tag.showInHeader;

        if (Object.keys(updates).length > 0) {
          // Check for name collision if name changed
          if (updates.name) {
            const existingByName = currentTagsByName.get(updates.name.toLowerCase());
            if (existingByName && existingByName._id !== tag._id) {
              setError(`Tag name "${updates.name}" is already in use by another tag.`);
              tagsToKeepLocally.push({ ...tag }); // Keep the unsaved modified tag
              continue; // Skip this tag
            }
          }
          changesToSave.push(
            updateTag({ tagId: tag._id, ...updates })
              .then(() => successfullySavedIds.add(tag._id))
              .catch((err) => {
                console.error(`Failed to update tag ${tag.name}:`, err);
                tagsToKeepLocally.push({ ...tag, isModified: true }); // Keep in UI as modified but unsaved
                throw err;
              })
          );
        } else {
          tagsToKeepLocally.push({ ...tag, isModified: false }); // No actual change, reset flag
        }
      } else {
        // Tag exists locally but not in original map (e.g., created and modified before save)
        // Treat as new, potentially redundant with isNew check but safer
        if (currentTagsByName.has(tag.name.toLowerCase())) {
          setError(`Tag name "${tag.name}" already exists.`);
          tagsToKeepLocally.push({ ...tag });
          continue;
        }
        changesToSave.push(
          createTag({ name: tag.name, showInHeader: tag.showInHeader })
            .then((newId) => successfullySavedIds.add(newId))
            .catch((err) => {
              console.error(`Failed to create tag ${tag.name}:`, err);
              tagsToKeepLocally.push({ ...tag, isNew: true, isModified: true });
              throw err;
            })
        );
      }
    }

    if (changesToSave.length === 0 && !error) {
      // No actual changes were attempted or needed persistence, and no validation errors occurred
      setEditableTags((prev) =>
        prev.map((t) => ({ ...t, isModified: false, isNew: false, isDeleted: false }))
      );
      setIsSaving(false);
      return;
    }

    try {
      await Promise.all(changesToSave);
      console.log(
        "Tag changes saved successfully (partial success possible if errors occurred). Waiting for data refresh."
      );
      // Successful operations are tracked in `successfullySavedIds`
      // The useEffect watching `allTags` should handle the state refresh.
      // We could manually update state here for faster feedback, but rely on useQuery for now.
      // Reset local error state only if all promises resolved
      setError(null);
    } catch (err: any) {
      console.error("One or more tag operations failed:", err);
      // Error message might already be set by specific catch blocks or name checks
      if (!error) {
        // Provide a more informative error message
        let message = "Failed to save some tag changes.";
        if (err?.data?.message?.includes("Unauthenticated")) {
          message = "Authentication failed. Please log in again.";
        } else if (err?.data?.message) {
          message = `Error: ${err.data.message}`;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
      }
      // Update local state to reflect which tags failed
      // This is partially handled by pushing to tagsToKeepLocally in individual catches
      setEditableTags(tagsToKeepLocally);
    } finally {
      setIsSaving(false);
    }
  };

  const hasPendingChanges = editableTags.some((tag) => tag.isModified);
  // Filter out tags marked for deletion for display, unless showing deleted section
  const visibleTags = editableTags.filter((tag) => !tag.isDeleted);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-medium text-[#525252]">Manage Tags</h2>
          {hasPendingChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>
        )}

        <form onSubmit={handleAddTag} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => {
              setNewTagName(e.target.value);
              setError(null);
            }}
            placeholder="Enter new tag name"
            className="flex-1 px-3 py-2 border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] focus:border-[#2A2825] text-sm"
          />
          <button
            type="submit"
            disabled={!newTagName.trim() || isSaving}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
            <Plus className="w-4 h-4" />
            Add Tag
          </button>
        </form>

        {allTags === undefined && <div>Loading tags...</div>}

        <div className="space-y-2">
          {visibleTags.map((tag) => (
            <div
              key={tag._id} // Use _id which is stable even for new tags (client-generated)
              className={`flex items-center justify-between bg-[#F8F7F7] px-3 py-2 rounded-md border ${tag.isNew && !tag.isDeleted ? "border-green-300" : "border-transparent"} ${tag.isModified && !tag.isDeleted ? "ring-1 ring-blue-300 ring-inset" : ""} ${tag.isDeleted ? "border-red-300 opacity-50" : ""}`}>
              <span
                className={`text-sm ${tag.isModified && !tag.isDeleted ? "italic text-blue-600" : "text-[#525252]"} ${tag.isDeleted ? "line-through" : ""}`}>
                {tag.name}
              </span>
              {!tag.isDeleted && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleHeader(tag._id)}
                    className="text-[#787672] hover:text-[#525252] disabled:opacity-50"
                    title={tag.showInHeader ? "Visible in header" : "Hidden from header"}
                    disabled={isSaving}>
                    {tag.showInHeader ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteTag(tag._id)}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    title="Delete tag"
                    disabled={isSaving}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {tag.isDeleted && (
                <button
                  onClick={() => handleUndeleteTag(tag._id)}
                  className="text-xs text-gray-600 hover:text-black disabled:opacity-50"
                  disabled={isSaving}>
                  Undo
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-[#787672]">
          <p>Click the eye icon to toggle visibility in the header. Save changes to persist.</p>
          {/* Clarify visual indicators */}
          <p className="mt-1">
            Green border = New | Blue outline = Modified | Strikethrough = Deleted (pending save)
          </p>
        </div>
      </div>
    </div>
  );
}
