import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Eye, EyeOff, Save, Trash2, Archive, ArchiveRestore, Palette } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";

// Interface matching the updated Convex schema for tags
// Use string | null for colors locally to represent clearing, but handle conversion for mutation
interface EditableTag extends Omit<Doc<"tags">, "backgroundColor" | "textColor"> {
  // Omit to redefine
  _id: Id<"tags">; // Existing or temporary client-side
  _creationTime: number;
  name: string;
  showInHeader: boolean;
  isHidden?: boolean;
  backgroundColor?: string | null;
  textColor?: string | null;

  // UI State Flags
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export function TagManagement() {
  // Use the admin query to fetch all tags, including hidden ones
  const allTagsAdmin = useQuery(api.tags.listAllAdmin);
  const createTag = useMutation(api.tags.create);
  const updateTag = useMutation(api.tags.update);
  const deleteTagMutation = useMutation(api.tags.deleteTag);

  const [editableTags, setEditableTags] = useState<EditableTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // Generic processing state
  const [error, setError] = useState<string | null>(null);
  const [editColorsTagId, setEditColorsTagId] = useState<Id<"tags"> | null>(null);

  // Sync Convex data to local editable state
  useEffect(() => {
    if (allTagsAdmin) {
      // Only update local state if not currently processing to avoid overwriting pending changes
      if (!isProcessing) {
        setEditableTags(
          // Ensure incoming data conforms to EditableTag, handling potentially undefined colors
          allTagsAdmin.map(
            (tag): EditableTag => ({
              ...tag,
              backgroundColor: tag.backgroundColor ?? null,
              textColor: tag.textColor ?? null,
              isNew: false,
              isModified: false,
              isDeleted: false,
            })
          )
        );
      }
    }
    // Keep dependency on isProcessing to prevent refresh during saves
  }, [allTagsAdmin, isProcessing]);

  // --- Local State Update Handlers ---

  const handleFieldChange = (tagId: Id<"tags">, field: keyof EditableTag, value: any) => {
    setEditableTags((prevTags) =>
      prevTags.map((tag) =>
        tag._id === tagId ? { ...tag, [field]: value, isModified: true } : tag
      )
    );
    setError(null); // Clear error on modification
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = newTagName.trim();
    if (!name) {
      setError("Tag name cannot be empty.");
      return;
    }
    // Check against current editable tags (including non-persisted new ones)
    if (
      editableTags.some((tag) => !tag.isDeleted && tag.name.toLowerCase() === name.toLowerCase())
    ) {
      setError("Tag name already exists.");
      return;
    }

    const newClientTag: EditableTag = {
      _id: `new-${Date.now()}-${Math.random()}` as Id<"tags">,
      name,
      showInHeader: true, // Default
      isHidden: false, // Default
      backgroundColor: null,
      textColor: null,
      _creationTime: Date.now(),
      isNew: true,
      isModified: true, // Mark as modified to be included in save
      isDeleted: false,
    };

    setEditableTags((prevTags) => [...prevTags, newClientTag]);
    setNewTagName("");
  };

  const handleDeleteTag = (tagId: Id<"tags">) => {
    handleFieldChange(tagId, "isDeleted", true);
  };

  const handleUndeleteTag = (tagId: Id<"tags">) => {
    // If it was new and deleted, just remove it from the list
    const tag = editableTags.find((t) => t._id === tagId);
    if (tag?.isNew && tag?.isDeleted) {
      setEditableTags((prev) => prev.filter((t) => t._id !== tagId));
    } else {
      handleFieldChange(tagId, "isDeleted", false);
      // If it was *not* new, ensure isModified is true to trigger update
      setEditableTags((prevTags) =>
        prevTags.map((t) => (t._id === tagId ? { ...t, isModified: true } : t))
      );
    }
  };

  const handleToggleHeader = (tagId: Id<"tags">) => {
    const currentTag = editableTags.find((t) => t._id === tagId);
    if (currentTag) {
      handleFieldChange(tagId, "showInHeader", !currentTag.showInHeader);
    }
  };

  const handleToggleHidden = (tagId: Id<"tags">) => {
    const currentTag = editableTags.find((t) => t._id === tagId);
    if (currentTag) {
      handleFieldChange(tagId, "isHidden", !currentTag.isHidden);
    }
  };

  // --- Save Logic ---

  const handleSave = async () => {
    setIsProcessing(true);
    setError(null);
    let success = true;
    let encounteredError: string | null = null;

    const tagsToProcess = editableTags.filter((tag) => tag.isModified);

    for (const tag of tagsToProcess) {
      try {
        if (tag.isDeleted) {
          if (!tag.isNew) {
            // Only delete if it exists on the server
            await deleteTagMutation({ tagId: tag._id });
          }
          // If new and deleted, it just disappears locally (will be filtered out)
        } else if (tag.isNew) {
          await createTag({
            name: tag.name,
            showInHeader: tag.showInHeader,
            isHidden: tag.isHidden ?? false,
            // Pass null as undefined for creation if needed, or let backend handle default
            backgroundColor: tag.backgroundColor ?? undefined,
            textColor: tag.textColor ?? undefined,
          });
        } else {
          // Existing tag update
          const updatePayload: Parameters<typeof updateTag>[0] = { tagId: tag._id };

          // Explicitly include fields that might change
          updatePayload.name = tag.name;
          updatePayload.showInHeader = tag.showInHeader;
          updatePayload.isHidden = tag.isHidden;
          // Convert null to undefined when calling mutation for optional fields
          updatePayload.backgroundColor = tag.backgroundColor ?? undefined;
          updatePayload.textColor = tag.textColor ?? undefined;

          await updateTag(updatePayload);
        }
        // If successful, mark the tag as no longer modified in the local state immediately
        // This assumes the mutation succeeded
        setEditableTags(
          (prev) =>
            prev
              .map((t) =>
                t._id === tag._id
                  ? { ...t, isModified: false, isNew: false, isDeleted: tag.isDeleted } // Keep isDeleted if it was deleted
                  : t
              )
              .filter((t) => !(t.isNew && t.isDeleted)) // Remove tags that were new and then deleted
        );
      } catch (err: any) {
        console.error(`Failed operation for tag ${tag.name} (${tag._id}):`, err);
        success = false;
        encounteredError = err?.data?.message || err.message || "An error occurred.";
        // Keep the tag marked as modified so the user can retry
        setError(`Error saving tag "${tag.name}": ${encounteredError}`); // Show specific error
        // Stop processing further tags on first error to avoid confusing state
        break;
      }
    }

    setIsProcessing(false);
    if (!success && !error) {
      setError(encounteredError || "Failed to save some changes.");
    } else if (success) {
      setError(null); // Clear error on full success
      console.log("Tag changes saved successfully.");
      // Final state refresh will be handled by the useEffect watching allTagsAdmin
    }
    // Filter out tags that were successfully deleted and are not new
    if (success) {
      setEditableTags((prev) => prev.filter((t) => !(t.isDeleted && !t.isNew)));
    }
  };

  const hasPendingChanges = editableTags.some((tag) => tag.isModified);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        {/* Header and Save Button */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-medium text-[#525252]">Manage Tags</h2>
          {hasPendingChanges && (
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm">
              <Save className="w-4 h-4" />
              {isProcessing ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-900 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Add New Tag Form */}
        <form onSubmit={handleAddTag} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => {
              setNewTagName(e.target.value);
              if (error?.includes("already exists")) setError(null); // Clear name error on type
            }}
            placeholder="Enter new tag name"
            className="flex-1 px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] focus:border-[#2A2825] text-sm"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!newTagName.trim() || isProcessing}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
            <Plus className="w-4 h-4" />
            Add Tag
          </button>
        </form>

        {/* Loading State */}
        {allTagsAdmin === undefined && <div>Loading tags...</div>}

        {/* Tag List */}
        <div className="space-y-3">
          {editableTags.map((tag) => (
            <div
              key={tag._id}
              className={`border rounded-md overflow-hidden transition-all duration-200 ease-in-out ${tag.isDeleted ? "border-red-300 bg-red-50" : tag.isNew ? "border-green-300 bg-green-50" : tag.isModified ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
              {/* Main Tag Row */}
              <div
                className={`flex items-center justify-between p-3 ${tag.isDeleted ? "opacity-60" : ""}`}>
                {/* Tag Name and Colors */}
                <div className="flex items-center gap-2 flex-wrap min-w-0 mr-2">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-sm font-medium max-w-full truncate"
                    style={{
                      backgroundColor: tag.backgroundColor || "#F4F0ED", // Default BG
                      color: tag.textColor || "#525252", // Default Text
                      // Add a subtle border if no custom BG color is set
                      border: `1px solid ${tag.backgroundColor ? "transparent" : "#D5D3D0"}`,
                    }}
                    title={tag.name} // Show full name on hover if truncated
                  >
                    {tag.name}
                  </span>
                  {tag.isHidden && (
                    <span className="text-xs text-gray-500 flex-shrink-0">(Hidden)</span>
                  )}
                  {tag.isModified && !tag.isDeleted && (
                    <span className="italic text-xs text-blue-600 opacity-80 flex-shrink-0">
                      (edited)
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!tag.isDeleted ? (
                    <>
                      {/* Color Picker Toggle */}
                      <button
                        onClick={() =>
                          setEditColorsTagId(editColorsTagId === tag._id ? null : tag._id)
                        }
                        className="text-[#787672] hover:text-[#525252] disabled:opacity-50 p-1"
                        title="Edit Colors"
                        disabled={isProcessing}>
                        <Palette className="w-4 h-4" />
                      </button>

                      {/* Toggle Hidden (Archive) */}
                      <button
                        onClick={() => handleToggleHidden(tag._id)}
                        className="text-[#787672] hover:text-[#525252] disabled:opacity-50 p-1"
                        title={
                          tag.isHidden
                            ? "Archived (Click to Unarchive)"
                            : "Visible (Click to Archive)"
                        }
                        disabled={isProcessing}>
                        {tag.isHidden ? (
                          <ArchiveRestore className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Archive className="w-4 h-4" />
                        )}
                      </button>

                      {/* Toggle Header Visibility */}
                      <button
                        onClick={() => handleToggleHeader(tag._id)}
                        className="text-[#787672] hover:text-[#525252] disabled:opacity-50 p-1"
                        title={tag.showInHeader ? "Visible in header" : "Hidden from header"}
                        disabled={isProcessing || !!tag.isHidden} // Disable if tag is hidden
                      >
                        {tag.showInHeader ? (
                          <Eye className="w-4 h-4 text-green-600" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteTag(tag._id)}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                        title="Delete tag"
                        disabled={isProcessing}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    // Undelete Button
                    <button
                      onClick={() => handleUndeleteTag(tag._id)}
                      className="text-xs text-gray-600 hover:text-black font-medium disabled:opacity-50 p-1"
                      disabled={isProcessing}>
                      Undo Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Color Editor (Collapsible) */}
              {editColorsTagId === tag._id && !tag.isDeleted && (
                <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`bg-color-${tag._id}`}
                      className="text-xs font-medium text-gray-600 w-20 flex-shrink-0">
                      BG Color:
                    </label>
                    <input
                      type="color"
                      id={`bg-color-${tag._id}`}
                      value={tag.backgroundColor || "#ffffff"} // Default to white for picker
                      onChange={(e) =>
                        handleFieldChange(tag._id, "backgroundColor", e.target.value)
                      }
                      className="h-6 w-10 border border-gray-300 rounded cursor-pointer p-0.5 bg-clip-content"
                      disabled={isProcessing}
                    />
                    <input
                      type="text"
                      value={tag.backgroundColor || ""}
                      placeholder="#rrggbb"
                      onChange={(e) =>
                        handleFieldChange(tag._id, "backgroundColor", e.target.value || null)
                      } // Set to null if empty
                      className="px-2 py-1 text-xs border border-gray-300 rounded w-20"
                      disabled={isProcessing}
                    />
                    <button
                      onClick={() => handleFieldChange(tag._id, "backgroundColor", null)}
                      className="text-xs text-gray-500 hover:text-black"
                      disabled={isProcessing}>
                      Clear
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`text-color-${tag._id}`}
                      className="text-xs font-medium text-gray-600 w-20 flex-shrink-0">
                      Text Color:
                    </label>
                    <input
                      type="color"
                      id={`text-color-${tag._id}`}
                      value={tag.textColor || "#000000"} // Default to black for picker
                      onChange={(e) => handleFieldChange(tag._id, "textColor", e.target.value)}
                      className="h-6 w-10 border border-gray-300 rounded cursor-pointer p-0.5 bg-clip-content"
                      disabled={isProcessing}
                    />
                    <input
                      type="text"
                      value={tag.textColor || ""}
                      placeholder="#rrggbb"
                      onChange={(e) =>
                        handleFieldChange(tag._id, "textColor", e.target.value || null)
                      } // Set to null if empty
                      className="px-2 py-1 text-xs border border-gray-300 rounded w-20"
                      disabled={isProcessing}
                    />
                    <button
                      onClick={() => handleFieldChange(tag._id, "textColor", null)}
                      className="text-xs text-gray-500 hover:text-black"
                      disabled={isProcessing}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend/Help Text */}
        <div className="mt-6 text-xs text-[#787672]">
          <p>Manage tags for submitted apps. Changes require saving.</p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>
              <Palette className="w-3 h-3 inline mr-1" />: Edit background/text colors.
            </li>
            <li>
              <Archive className="w-3 h-3 inline mr-1" /> /{" "}
              <ArchiveRestore className="w-3 h-3 inline mr-1" />: Archive/unarchive tag (hides from
              public view).
            </li>
            <li>
              <Eye className="w-3 h-3 inline mr-1" /> / <EyeOff className="w-3 h-3 inline mr-1" />:
              Toggle header visibility (only affects non-archived tags).
            </li>
            <li>
              <Trash2 className="w-3 h-3 inline mr-1" />: Mark for deletion.
            </li>
          </ul>
          <p className="mt-1 font-medium">Indicators:</p>
          <p className="mt-0.5">
            <span className="inline-block px-1 border border-green-300 bg-green-50 text-green-700 rounded text-[10px] mr-1">
              New
            </span>
            <span className="inline-block px-1 border border-blue-300 bg-blue-50 text-blue-700 rounded text-[10px] mr-1">
              Modified
            </span>
            <span className="inline-block px-1 border border-red-300 bg-red-50 text-red-700 rounded text-[10px] mr-1">
              Deleted
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
