import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Archive,
  ArchiveRestore,
  Palette,
  Edit3,
  Check,
  Smile,
} from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";

// Default tag color constants used across UI and when clearing values
const DEFAULT_TAG_BG = "#F4F0ED";
const DEFAULT_TAG_TEXT = "#525252";

// Interface matching the updated Convex schema for tags
// Use string | null for colors locally to represent clearing, but handle conversion for mutation
interface EditableTag
  extends Omit<
    Doc<"tags">,
    | "backgroundColor"
    | "textColor"
    | "emoji"
    | "iconUrl"
    | "order"
    | "createdByAdmin"
  > {
  // Omit to redefine
  _id: Id<"tags">; // Existing or temporary client-side
  _creationTime: number;
  name: string;
  showInHeader: boolean;
  isHidden?: boolean;
  backgroundColor?: string | null;
  textColor?: string | null;
  emoji?: string | undefined; // Corrected type
  iconUrl?: string | undefined; // Corrected type
  iconFile?: File | null; // New: for local file handling before upload
  order?: number | undefined; // Corrected type: should align with Doc<"tags">
  createdByAdmin?: boolean; // Track if created by admin

  // UI State Flags
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export function TagManagement() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  // Use the admin query to fetch all tags, including hidden ones
  const allTagsAdmin = useQuery(
    api.tags.listAllAdmin,
    authIsLoading || !isAuthenticated ? "skip" : {},
  );
  const createTag = useMutation(api.tags.create);
  const updateTag = useMutation(api.tags.update);
  const deleteTagMutation = useMutation(api.tags.deleteTag);
  const generateUploadUrl = useMutation(api.tags.generateIconUploadUrl); // Use the new mutation

  const [editableTags, setEditableTags] = useState<EditableTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // Generic processing state
  const [error, setError] = useState<string | null>(null);
  const [editColorsTagId, setEditColorsTagId] = useState<Id<"tags"> | null>(
    null,
  );
  const [editNameTagId, setEditNameTagId] = useState<Id<"tags"> | null>(null); // For inline name editing
  const [stagedName, setStagedName] = useState<string>(""); // Temp storage for new name
  const [editIconEmojiTagId, setEditIconEmojiTagId] =
    useState<Id<"tags"> | null>(null); // For icon/emoji editor
  const [searchQuery, setSearchQuery] = useState<string>(""); // Search functionality

  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input
  const orderSaveTimersRef = useRef<Record<string, number>>({}); // Debounce timers per tag
  const draggingTagIdRef = useRef<Id<"tags"> | null>(null); // Drag-and-drop state

  // Sync Convex data to local editable state
  useEffect(() => {
    if (allTagsAdmin) {
      // Only update local state if not currently processing to avoid overwriting pending changes
      if (!isProcessing) {
        // Sort initially fetched tags by their existing order, then by name for stability
        const sortedTags = [...allTagsAdmin].sort((a, b) => {
          const orderA = a.order ?? Infinity;
          const orderB = b.order ?? Infinity;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return (a.name ?? "").localeCompare(b.name ?? "");
        });

        setEditableTags(
          sortedTags.map(
            (tag): EditableTag => ({
              ...tag,
              backgroundColor: tag.backgroundColor ?? undefined,
              textColor: tag.textColor ?? undefined,
              emoji: tag.emoji ?? undefined,
              iconUrl: tag.iconUrl ?? undefined,
              iconFile: null,
              order: tag.order ?? undefined, // Keep existing order
              createdByAdmin: tag.createdByAdmin ?? true, // Default to admin for existing tags
              isNew: false,
              isModified: false,
              isDeleted: false,
            }),
          ),
        );
      }
    }
    // Keep dependency on isProcessing to prevent refresh during saves
  }, [allTagsAdmin, isProcessing]);

  // --- Local State Update Handlers ---

  const handleFieldChange = (
    tagId: Id<"tags">,
    field: keyof EditableTag,
    value: any,
  ) => {
    setEditableTags((prevTags) =>
      prevTags.map((tag) => {
        if (tag._id === tagId) {
          return { ...tag, [field]: value, isModified: true };
        }
        return tag;
      }),
    );
    setError(null); // Clear error on modification
  };

  const handleOrderChange = (tagId: Id<"tags">, newOrder: string) => {
    const orderNum = newOrder === "" ? undefined : parseInt(newOrder, 10);
    if (
      newOrder !== "" &&
      (isNaN(orderNum!) || orderNum! < 0 || orderNum! > 999)
    ) {
      return; // Invalid order, ignore
    }
    // Update local state WITHOUT marking as modified so Save button doesn't light up
    setEditableTags((prevTags) =>
      prevTags.map((tag) =>
        tag._id === tagId ? { ...tag, order: orderNum } : tag,
      ),
    );

    // Debounce immediate persistence to Convex for order only
    const key = String(tagId);
    const timers = orderSaveTimersRef.current;
    if (timers[key]) {
      window.clearTimeout(timers[key]);
    }
    timers[key] = window.setTimeout(async () => {
      try {
        await updateTag({ tagId, order: orderNum as any });
      } catch (err) {
        console.error("Failed to update tag order immediately:", err);
        setError(
          (err as any)?.data?.message ||
            (err as Error).message ||
            "Failed to save order.",
        );
      }
    }, 400);
  };

  // Drag and Drop helpers
  const handleDragStart = (tagId: Id<"tags">) => {
    draggingTagIdRef.current = tagId;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const persistAllOrders = async (tags: EditableTag[]) => {
    // Persist sequentially only for tags whose order changed
    for (const tag of tags) {
      // Skip deleted tags
      if (tag.isDeleted) continue;
      try {
        await updateTag({ tagId: tag._id, order: tag.order as any });
      } catch (err) {
        console.error("Failed to persist tag order:", tag.name, err);
        setError(
          (err as any)?.data?.message ||
            (err as Error).message ||
            "Failed to persist order.",
        );
        // Continue other updates even if one fails
      }
    }
  };

  const handleDrop = async (targetTagId: Id<"tags">) => {
    const draggedId = draggingTagIdRef.current;
    draggingTagIdRef.current = null;
    if (!draggedId || draggedId === targetTagId) return;

    // Reorder within the current list view
    setIsProcessing(true);
    setEditableTags((prev) => {
      const newList = [...prev];
      // Work with indices within non-deleted list to compute new orders
      const nonDeleted = newList.filter((t) => !t.isDeleted);
      const draggedIndex = nonDeleted.findIndex((t) => t._id === draggedId);
      const targetIndex = nonDeleted.findIndex((t) => t._id === targetTagId);
      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }

      // Map back to indices in newList
      const idToIndex: Record<string, number> = {};
      newList.forEach((t, idx) => (idToIndex[String(t._id)] = idx));

      // Build array of indices of non-deleted items in original array order
      const nonDeletedIndices = newList
        .map((t, idx) => ({ t, idx }))
        .filter(({ t }) => !t.isDeleted)
        .map(({ idx }) => idx);

      const from = nonDeletedIndices[draggedIndex];
      const to = nonDeletedIndices[targetIndex];
      if (from === undefined || to === undefined) return prev;

      const [moved] = newList.splice(from, 1);
      newList.splice(to, 0, moved);

      // Recompute sequential order for non-deleted tags based on new visual order
      let orderCounter = 0;
      for (const tag of newList) {
        if (tag.isDeleted) continue;
        tag.order = orderCounter;
        orderCounter++;
      }

      // Persist orders (fire-and-forget via async below)
      (async () => {
        try {
          await persistAllOrders(newList);
        } finally {
          setIsProcessing(false);
        }
      })();

      return newList;
    });
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
      editableTags.some(
        (tag) =>
          !tag.isDeleted && tag.name.toLowerCase() === name.toLowerCase(),
      )
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
      emoji: undefined, // Corrected type
      iconUrl: undefined, // Corrected type
      iconFile: null,
      order: undefined, // Default order for new tags is undefined
      createdByAdmin: true, // Admin is creating this tag
      _creationTime: Date.now(),
      isNew: true,
      isModified: true, // Mark as modified to be included in save
      isDeleted: false,
    };

    setEditableTags((prevTags) => [...prevTags, newClientTag]);
    setNewTagName("");
  };

  const handleDeleteTag = (tagId: Id<"tags">) => {
    setEditNameTagId(null); // Cancel name edit if deleting
    setEditColorsTagId(null); // Cancel color edit
    setEditIconEmojiTagId(null); // Cancel icon/emoji edit
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
        prevTags.map((t) => (t._id === tagId ? { ...t, isModified: true } : t)),
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
      // If hiding, also cancel any open editors for this tag
      if (!currentTag.isHidden) {
        setEditColorsTagId(null);
        setEditNameTagId(null);
        setEditIconEmojiTagId(null);
      }
    }
  };

  // --- Name Editing Handlers ---
  const handleEditName = (tag: EditableTag) => {
    setEditNameTagId(tag._id);
    setStagedName(tag.name);
    setEditColorsTagId(null); // Close other editors
    setEditIconEmojiTagId(null);
  };

  const handleSaveName = (tagId: Id<"tags">) => {
    const trimmedName = stagedName.trim();
    if (!trimmedName) {
      setError("Tag name cannot be empty.");
      return;
    }
    // Check for name collisions, excluding the current tag if it's not new
    if (
      editableTags.some(
        (tag) =>
          tag._id !== tagId &&
          !tag.isDeleted &&
          tag.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      setError("Tag name already exists.");
      return;
    }

    handleFieldChange(tagId, "name", trimmedName);
    setEditNameTagId(null);
    setError(null);
  };

  const handleCancelName = () => {
    setEditNameTagId(null);
    setError(null);
  };

  // --- Icon/Emoji Handlers ---
  const handleFileChange = (
    tagId: Id<"tags">,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "image/png") {
        handleFieldChange(tagId, "iconFile", file); // Store the file locally
        handleFieldChange(tagId, "iconUrl", undefined); // Clear existing URL, new file takes precedence
        handleFieldChange(tagId, "emoji", undefined); // Clear emoji if icon is chosen
        setError(null);
      } else {
        setError("Icon must be a PNG file.");
      }
      // Clear the file input value so the same file can be re-selected if needed after an error/clear
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleClearIcon = (tagId: Id<"tags">) => {
    handleFieldChange(tagId, "iconFile", null); // Clear local file selection
    handleFieldChange(tagId, "iconUrl", undefined); // Clear stored URL
    // Mark as modified so save picks it up, will pass clearIcon: true or null iconStorageId
    handleFieldChange(tagId, "isModified", true);
  };

  const handleClearEmoji = (tagId: Id<"tags">) => {
    handleFieldChange(tagId, "emoji", undefined);
  };

  // --- Save Logic ---

  const handleSave = async () => {
    setIsProcessing(true);
    setError(null);
    let success = true;
    let encounteredError: string | null = null;

    // Filter out deleted tags for reordering, but keep them for deletion processing later if not new
    const tagsToReorderAndSave = editableTags.filter((tag) => !tag.isDeleted);
    const updatedTagsWithOrder = tagsToReorderAndSave.map((tag, index) => ({
      ...tag,
      order: index, // Assign order based on current visual position
      isModified: true, // Ensure it's marked as modified if order changed or other fields changed
    }));

    // Combine with tags marked for deletion that are not new
    const tagsMarkedForDeletion = editableTags.filter(
      (tag) => tag.isDeleted && !tag.isNew,
    );

    // Create a comprehensive list of tags to process for backend operations
    // This includes tags that had their order changed, new tags, modified tags, and tags to be deleted.
    const allTagsToProcess = [
      ...updatedTagsWithOrder,
      ...tagsMarkedForDeletion,
    ].reduce((acc, current) => {
      // Deduplicate based on _id, prioritizing the one from updatedTagsWithOrder if present
      if (!acc.find((item) => item._id === current._id)) {
        acc.push(current);
      }
      return acc;
    }, [] as EditableTag[]);

    for (const tag of allTagsToProcess) {
      // Only proceed if the tag is genuinely modified (content or order) or needs deletion/creation
      if (!tag.isModified && !tag.isNew && !tag.isDeleted) continue;

      try {
        let iconStorageIdToSend: Id<"_storage"> | undefined = undefined;
        let shouldClearIcon = !tag.iconFile && !tag.iconUrl;

        if (tag.iconFile) {
          try {
            const uploadUrl = await generateUploadUrl();
            const uploadResponse = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": tag.iconFile.type },
              body: tag.iconFile,
            });
            // Parse as JSON and extract storageId (matches StoryForm.tsx)
            const uploadJson = await uploadResponse.json();
            const storageId = uploadJson.storageId;
            if (!storageId || typeof storageId !== "string") {
              console.error("Upload response json:", uploadJson);
              throw new Error(
                "Icon upload did not return a valid storageId string.",
              );
            }
            iconStorageIdToSend = storageId as Id<"_storage">;
            shouldClearIcon = false; // We have a new icon, so don't clear
          } catch (uploadErr: any) {
            console.error(
              `Failed to upload icon for tag ${tag.name}:`,
              uploadErr,
            );
            setError(
              `Error uploading icon for "${tag.name}": ${uploadErr.message}`,
            );
            success = false; // Mark overall save as failed
            break; // Stop processing on upload error
          }
        }

        if (tag.isDeleted) {
          if (!tag.isNew) {
            await deleteTagMutation({ tagId: tag._id });
          }
        } else if (tag.isNew) {
          const createPayload: any = {
            name: tag.name,
            slug: tag.name
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^\w-]+/g, ""),
            showInHeader: tag.showInHeader,
            isHidden: tag.isHidden ?? false,
            backgroundColor: tag.backgroundColor ?? undefined,
            textColor: tag.textColor ?? undefined,
            emoji: tag.emoji ?? undefined,
            iconUrl: tag.iconUrl ?? undefined,
            order: tag.order,
            createdByAdmin: tag.createdByAdmin ?? true,
          };
          if (iconStorageIdToSend)
            createPayload.iconStorageId = iconStorageIdToSend;
          await createTag(createPayload);
        } else {
          // Existing tag update
          const updatePayload: any = {
            tagId: tag._id,
            name: tag.name,
            slug: tag.name
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^\w-]+/g, ""),
            showInHeader: tag.showInHeader,
            isHidden: tag.isHidden,
            backgroundColor: tag.backgroundColor ?? undefined,
            textColor: tag.textColor ?? undefined,
            emoji: tag.emoji ?? undefined,
            iconUrl: tag.iconUrl ?? undefined,
            clearIcon:
              shouldClearIcon && !iconStorageIdToSend ? true : undefined,
            order: tag.order,
            createdByAdmin: tag.createdByAdmin,
          };
          if (iconStorageIdToSend)
            updatePayload.iconStorageId = iconStorageIdToSend;
          await updateTag(updatePayload);
        }
        // If successful, mark the tag as no longer modified in the local state immediately
        // This assumes the mutation succeeded
        setEditableTags(
          (prev) =>
            prev
              .map((t) =>
                t._id === tag._id
                  ? {
                      ...t,
                      isModified: false,
                      isNew: false,
                      isDeleted: tag.isDeleted,
                      iconFile: null,
                    } // Clear local file after "save"
                  : t,
              )
              .filter((t) => !(t.isNew && t.isDeleted)), // Remove tags that were new and then deleted
        );
      } catch (err: any) {
        console.error(
          `Failed operation for tag ${tag.name} (${tag._id}):`,
          err,
        );
        success = false;
        encounteredError =
          err?.data?.message || err.message || "An error occurred.";
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

  // Handle auth loading state
  if (authIsLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          Loading authentication...
        </div>
      </div>
    );
  }

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
              className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              {isProcessing ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search Tags */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] focus:border-[#292929] text-sm"
            disabled={isProcessing}
          />
        </div>

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
            className="flex-1 px-3 py-2 border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] focus:border-[#292929] text-sm"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!newTagName.trim() || isProcessing}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Tag
          </button>
        </form>

        {/* Loading State */}
        {allTagsAdmin === undefined && <div>Loading tags...</div>}

        {/* Tag List */}
        <div className="space-y-3">
          {editableTags
            .filter((tag) =>
              tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((tag) => (
              <div
                key={tag._id}
                className={`border rounded-md overflow-hidden transition-all duration-200 ease-in-out ${tag.isDeleted ? "border-red-300 bg-red-50" : tag.isNew ? "border-green-300 bg-green-50" : tag.isModified ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
                draggable={!tag.isDeleted}
                onDragStart={() => handleDragStart(tag._id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(tag._id)}
              >
                {/* Main Tag Row */}
                <div
                  className={`flex items-center justify-between p-3 ${tag.isDeleted ? "opacity-60" : ""}`}
                >
                  {/* Order Input */}
                  {!tag.isDeleted && (
                    <div className="flex flex-col items-center mr-3">
                      <label className="text-xs text-gray-500 mb-1">
                        Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={tag.order ?? ""}
                        onChange={(e) =>
                          handleOrderChange(tag._id, e.target.value)
                        }
                        placeholder="0"
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={isProcessing}
                        title="Order (0-999, lower numbers appear first)"
                      />
                    </div>
                  )}

                  {/* Tag Name and Colors/Icons - Modified for inline editing */}
                  <div className="flex items-center gap-2 flex-wrap min-w-0 mr-2 flex-grow">
                    {editNameTagId === tag._id && !tag.isDeleted ? (
                      <div className="flex items-center gap-1 flex-grow">
                        <input
                          type="text"
                          value={stagedName}
                          onChange={(e) => setStagedName(e.target.value)}
                          className="px-2 py-1 border border-blue-500 rounded-md text-sm flex-grow"
                          autoFocus
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleSaveName(tag._id)
                          }
                        />
                        <button
                          onClick={() => handleSaveName(tag._id)}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Save name"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelName}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Cancel edit"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => !tag.isDeleted && handleEditName(tag)}
                      >
                        {tag.emoji && (
                          <span className="text-lg">{tag.emoji}</span>
                        )}
                        {tag.iconUrl && !tag.emoji && (
                          <img
                            src={tag.iconUrl}
                            alt=""
                            className="w-5 h-5 rounded-sm object-cover"
                          />
                        )}
                        {tag.iconFile && !tag.iconUrl && !tag.emoji && (
                          <img
                            src={URL.createObjectURL(tag.iconFile)}
                            alt="preview"
                            className="w-5 h-5 rounded-sm object-cover"
                          />
                        )}
                        <span
                          className="inline-block px-2 py-0.5 rounded text-sm font-medium max-w-full truncate"
                          style={{
                            backgroundColor: tag.backgroundColor || "#F4F0ED", // Default BG
                            color: tag.textColor || "#525252", // Default Text
                            border: `1px solid ${tag.backgroundColor ? "transparent" : "#D5D3D0"}`,
                          }}
                          title={tag.name} // Show full name on hover if truncated
                        >
                          {tag.name}
                        </span>
                        {!tag.isDeleted && (
                          <Edit3 className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </div>
                    )}
                    {tag.isHidden && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        (Hidden)
                      </span>
                    )}
                    {tag.createdByAdmin === false && (
                      <span className="text-xs text-orange-600 flex-shrink-0 font-medium">
                        (User)
                      </span>
                    )}
                    {tag.createdByAdmin !== false && (
                      <span className="text-xs text-green-600 flex-shrink-0 font-medium">
                        (Admin)
                      </span>
                    )}
                    {tag.isModified && !tag.isDeleted && (
                      <span className="italic text-xs text-blue-600 opacity-80 flex-shrink-0">
                        (edited)
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {" "}
                    {/* Adjusted gap for smaller screens */}
                    {!tag.isDeleted ? (
                      <>
                        {/* Emoji/Icon Picker Toggle */}
                        <button
                          onClick={() =>
                            setEditIconEmojiTagId(
                              editIconEmojiTagId === tag._id ? null : tag._id,
                            )
                          }
                          className="text-[#545454] hover:text-[#525252] disabled:opacity-50 p-1"
                          title="Edit Emoji/Icon"
                          disabled={isProcessing}
                        >
                          <Smile className="w-4 h-4" />
                        </button>

                        {/* Color Picker Toggle */}
                        <button
                          onClick={() =>
                            setEditColorsTagId(
                              editColorsTagId === tag._id ? null : tag._id,
                            )
                          }
                          className="text-[#545454] hover:text-[#525252] disabled:opacity-50 p-1"
                          title="Edit Colors"
                          disabled={isProcessing}
                        >
                          <Palette className="w-4 h-4" />
                        </button>

                        {/* Toggle Hidden (Archive) */}
                        <button
                          onClick={() => handleToggleHidden(tag._id)}
                          className="text-[#545454] hover:text-[#525252] disabled:opacity-50 p-1"
                          title={
                            tag.isHidden
                              ? "Archived (Click to Unarchive)"
                              : "Visible (Click to Archive)"
                          }
                          disabled={isProcessing}
                        >
                          {tag.isHidden ? (
                            <ArchiveRestore className="w-4 h-4 text-orange-600" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                        </button>

                        {/* Toggle Header Visibility */}
                        <button
                          onClick={() => handleToggleHeader(tag._id)}
                          className="text-[#545454] hover:text-[#525252] disabled:opacity-50 p-1"
                          title={
                            tag.showInHeader
                              ? "Visible in header"
                              : "Hidden from header"
                          }
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
                          disabled={isProcessing}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      // Undelete Button
                      <button
                        onClick={() => handleUndeleteTag(tag._id)}
                        className="text-xs text-gray-600 hover:text-black font-medium disabled:opacity-50 p-1"
                        disabled={isProcessing}
                      >
                        Undo Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Color Editor (Collapsible) */}
                {editColorsTagId === tag._id && !tag.isDeleted && (
                  <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">
                      Edit Colors:
                    </p>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={`bg-color-${tag._id}`}
                        className="text-xs font-medium text-gray-600 w-20 flex-shrink-0"
                      >
                        BG Color:
                      </label>
                      <input
                        type="color"
                        id={`bg-color-${tag._id}`}
                        value={tag.backgroundColor || DEFAULT_TAG_BG} // Default to app's tag background
                        onChange={(e) =>
                          handleFieldChange(
                            tag._id,
                            "backgroundColor",
                            e.target.value,
                          )
                        }
                        className="h-6 w-10 border border-gray-300 rounded cursor-pointer p-0.5 bg-clip-content"
                        disabled={isProcessing}
                      />
                      <input
                        type="text"
                        value={tag.backgroundColor || ""}
                        placeholder="#rrggbb"
                        onChange={(e) =>
                          handleFieldChange(
                            tag._id,
                            "backgroundColor",
                            e.target.value || null,
                          )
                        } // Set to null if empty
                        className="px-2 py-1 text-xs border border-gray-300 rounded w-20"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() =>
                          handleFieldChange(
                            tag._id,
                            "backgroundColor",
                            DEFAULT_TAG_BG,
                          )
                        }
                        className="text-xs text-gray-500 hover:text-black"
                        disabled={isProcessing}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={`text-color-${tag._id}`}
                        className="text-xs font-medium text-gray-600 w-20 flex-shrink-0"
                      >
                        Text Color:
                      </label>
                      <input
                        type="color"
                        id={`text-color-${tag._id}`}
                        value={tag.textColor || DEFAULT_TAG_TEXT} // Default to app's tag text color
                        onChange={(e) =>
                          handleFieldChange(
                            tag._id,
                            "textColor",
                            e.target.value,
                          )
                        }
                        className="h-6 w-10 border border-gray-300 rounded cursor-pointer p-0.5 bg-clip-content"
                        disabled={isProcessing}
                      />
                      <input
                        type="text"
                        value={tag.textColor || ""}
                        placeholder="#rrggbb"
                        onChange={(e) =>
                          handleFieldChange(
                            tag._id,
                            "textColor",
                            e.target.value || null,
                          )
                        } // Set to null if empty
                        className="px-2 py-1 text-xs border border-gray-300 rounded w-20"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() =>
                          handleFieldChange(
                            tag._id,
                            "textColor",
                            DEFAULT_TAG_TEXT,
                          )
                        }
                        className="text-xs text-gray-500 hover:text-black"
                        disabled={isProcessing}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Emoji/Icon Editor (Collapsible) */}
                {editIconEmojiTagId === tag._id && !tag.isDeleted && (
                  <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">
                      Edit Emoji/Icon:
                    </p>
                    {/* Emoji Input */}
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={`emoji-${tag._id}`}
                        className="text-xs font-medium text-gray-600 w-20 flex-shrink-0"
                      >
                        Emoji:
                      </label>
                      <input
                        type="text"
                        id={`emoji-${tag._id}`}
                        value={tag.emoji || ""}
                        onChange={(e) => {
                          handleFieldChange(
                            tag._id,
                            "emoji",
                            e.target.value || null,
                          );
                          if (e.target.value) {
                            // If emoji is set, clear icon
                            handleFieldChange(tag._id, "iconFile", null);
                            handleFieldChange(tag._id, "iconUrl", null);
                          }
                        }}
                        placeholder="e.g. ✨"
                        className="px-2 py-1 text-xs border border-gray-300 rounded w-20"
                        maxLength={5} // Keep emoji input short
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() => handleClearEmoji(tag._id)}
                        className="text-xs text-gray-500 hover:text-black"
                        disabled={isProcessing || !tag.emoji}
                      >
                        Clear Emoji
                      </button>
                    </div>

                    {/* Icon Upload */}
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={`icon-file-${tag._id}`}
                        className="text-xs font-medium text-gray-600 w-20 flex-shrink-0"
                      >
                        Icon (PNG):
                      </label>
                      <input
                        type="file"
                        id={`icon-file-${tag._id}`}
                        accept="image/png"
                        onChange={(e) => handleFileChange(tag._id, e)}
                        className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                        ref={fileInputRef} // Use ref if direct click needed
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() => handleClearIcon(tag._id)}
                        className="text-xs text-gray-500 hover:text-black"
                        disabled={
                          isProcessing || (!tag.iconFile && !tag.iconUrl)
                        }
                      >
                        Clear Icon
                      </button>
                    </div>
                    {tag.iconFile && (
                      <div className="pl-24 text-xs text-gray-500">
                        Selected: {tag.iconFile.name}
                      </div>
                    )}
                    {tag.iconUrl && !tag.iconFile && (
                      <div className="pl-24 text-xs text-gray-500">
                        Current:{" "}
                        <a
                          href={tag.iconUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {tag.iconUrl.substring(0, 30)}...
                        </a>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 pl-24">
                      Set emoji OR upload icon.
                    </p>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Legend/Help Text */}
        <div className="mt-6 text-xs text-[#545454]">
          <p>
            Manage tags for submitted apps. Changes require saving. Admin tags
            appear first, then user tags.
          </p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>
              <strong>Order:</strong> Enter number (0-999) to set display order.
              Lower numbers appear first.
            </li>
            <li>
              <Edit3 className="w-3 h-3 inline mr-1" />: Click tag name to edit.
            </li>
            <li>
              <Smile className="w-3 h-3 inline mr-1" />: Edit emoji/icon.
            </li>
            <li>
              <Palette className="w-3 h-3 inline mr-1" />: Edit background/text
              colors.
            </li>
            <li>
              <Archive className="w-3 h-3 inline mr-1" />
              /
              <ArchiveRestore className="w-3 h-3 inline mr-1" />:
              Archive/unarchive tag (hides from public view).
            </li>
            <li>
              <Eye className="w-3 h-3 inline mr-1" />
              /
              <EyeOff className="w-3 h-3 inline mr-1" />: Toggle header
              visibility (only affects non-archived tags).
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
            <span className="inline-block text-green-600 font-medium text-[10px] mr-1">
              (Admin)
            </span>
            <span className="inline-block text-orange-600 font-medium text-[10px] mr-1">
              (User)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
