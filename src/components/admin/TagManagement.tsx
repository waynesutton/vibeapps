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
      setEditableTags(
        allTags.map((tag) => ({
          ...tag,
          isNew: false,
          isModified: false,
          isDeleted: false, // Reset local flags when data reloads
        }))
      );
      // Keep existing new/modified tags if saving failed previously?
      // This simple reset assumes save completes or user refreshes.
      // More complex state management could preserve unsaved changes.
      setError(null); // Clear errors on data refresh
    }
  }, [allTags]);

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
        _id: `new-${Date.now()}` as Id<"tags">,
        name,
        showInHeader: true,
        _creationTime: Date.now(),
        isNew: true,
        isModified: true,
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
      prevTags.map((tag) =>
        // Unmark deletion, setting isModified
        tag._id === tagId ? { ...tag, isDeleted: false, isModified: true } : tag
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    const changesToSave: Array<Promise<unknown>> = []; // Collect promises

    // Use the latest fetched tags for comparison to avoid race conditions
    const currentTagsMap = new Map(allTags?.map((t) => [t._id, t]));
    const currentTagsByName = new Map(allTags?.map((t) => [t.name.toLowerCase(), t]));

    for (const tag of editableTags) {
      if (!tag.isModified) continue; // Skip unmodified tags

      const originalTag = currentTagsMap.get(tag._id);

      if (tag.isDeleted) {
        if (!tag.isNew && originalTag) {
          // Only delete existing tags that haven't already been deleted
          changesToSave.push(deleteTag({ tagId: tag._id }));
        }
        // If it was new and marked for deletion, it simply won't be created.
      } else if (tag.isNew) {
        // Double-check for name collisions just before saving
        if (currentTagsByName.has(tag.name.toLowerCase())) {
          setError(`Tag name "${tag.name}" already exists.`);
          setIsSaving(false);
          return; // Stop save process
        }
        changesToSave.push(createTag({ name: tag.name, showInHeader: tag.showInHeader }));
      } else if (originalTag) {
        // It's an existing tag being updated
        // Prepare updates, only send if changed from original
        const updates: { name?: string; showInHeader?: boolean } = {};
        if (tag.name !== originalTag.name) updates.name = tag.name;
        if (tag.showInHeader !== originalTag.showInHeader) updates.showInHeader = tag.showInHeader;

        if (Object.keys(updates).length > 0) {
          // Check for name collision if name changed
          if (updates.name) {
            const existingByName = currentTagsByName.get(updates.name.toLowerCase());
            if (existingByName && existingByName._id !== tag._id) {
              setError(`Tag name "${updates.name}" is already in use.`);
              setIsSaving(false);
              return; // Stop save process
            }
          }
          changesToSave.push(updateTag({ tagId: tag._id, ...updates }));
        }
      }
    }

    if (changesToSave.length === 0) {
      // No actual changes detected that need persistence
      setEditableTags((prev) =>
        prev.map((t) => ({ ...t, isModified: false, isNew: false, isDeleted: false }))
      );
      setIsSaving(false);
      return;
    }

    try {
      await Promise.all(changesToSave);
      console.log("Tag changes saved successfully");
      // State will update via useEffect when useQuery refetches, resetting flags
    } catch (err) {
      console.error("Failed to save tag changes:", err);
      // Log the full error object for more details
      console.error("Full error object:", JSON.stringify(err, null, 2));
      setError(err instanceof Error ? err.message : "An unknown error occurred during save.");
      // Let user retry, state retains modified flags until success or refresh
    } finally {
      // Only stop saving indicator, let useEffect handle state refresh
      setIsSaving(false);
    }
  };

  const hasPendingChanges = editableTags.some((tag) => tag.isModified);
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
              key={tag._id}
              className={`flex items-center justify-between bg-[#F8F7F7] px-3 py-2 rounded-md border ${tag.isNew ? "border-green-300" : "border-transparent"}`}>
              <span
                className={`text-sm ${tag.isModified ? "italic text-blue-600" : "text-[#525252]"}`}>
                {tag.name}
              </span>
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
            </div>
          ))}
        </div>

        {editableTags.some((t) => t.isDeleted) && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Deleted Tags (Pending Save)</h3>
            <div className="space-y-2">
              {editableTags
                .filter((t) => t.isDeleted)
                .map((tag) => (
                  <div
                    key={tag._id}
                    className="flex items-center justify-between bg-red-50 px-3 py-2 rounded-md border border-red-200">
                    <span className="text-sm text-red-700 line-through">{tag.name}</span>
                    <button
                      onClick={() => handleUndeleteTag(tag._id)}
                      className="text-xs text-gray-600 hover:text-black disabled:opacity-50"
                      disabled={isSaving}>
                      Undo
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-[#787672]">
          <p>Click the eye icon to toggle visibility in the header. Changes require saving.</p>
        </div>
      </div>
    </div>
  );
}
