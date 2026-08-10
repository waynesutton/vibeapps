import { useMemo, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { Check, Download, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  GroupDetails,
  SectionCard,
  SaveFooter,
  dateInputToEndTs,
  dateInputToStartTs,
  tsToDateInput,
  useSaveState,
} from "./groupSection";

// Escape a CSV cell value (handles commas, quotes, newlines)
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Submission sources: multi-tag auto-include with optional date range,
// backfill sync actions, and CSV export of everything in the group.
export function GroupSubmissionsSection({ group }: { group: GroupDetails }) {
  const convex = useConvex();
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const syncAutoIncludeSubmissions = useMutation(
    api.judgingGroupSubmissions.syncAutoIncludeSubmissions,
  );
  const addSubmissions = useMutation(api.judgingGroupSubmissions.addSubmissions);
  const allTags = useQuery(api.tags.list);
  const { saving, saved, error, run } = useSaveState();

  const [tagIds, setTagIds] = useState<Id<"tags">[]>(
    group.autoIncludeTagIds || [],
  );
  const [matchMode, setMatchMode] = useState<"any" | "all">(
    group.autoIncludeMatchMode ?? "any",
  );
  const [startDate, setStartDate] = useState(
    tsToDateInput(group.autoIncludeStartDate),
  );
  const [endDate, setEndDate] = useState(
    tsToDateInput(group.autoIncludeEndDate),
  );
  const [tagSearch, setTagSearch] = useState("");
  const [storySearch, setStorySearch] = useState("");
  const [addingStoryId, setAddingStoryId] = useState<Id<"stories"> | null>(
    null,
  );
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Live story search for the manual add card (skipped until 2+ characters)
  const trimmedStorySearch = storySearch.trim();
  const storyResults = useQuery(
    api.judgingGroupSubmissions.searchStoriesForGroup,
    trimmedStorySearch.length >= 2
      ? { groupId: group._id, searchTerm: trimmedStorySearch }
      : "skip",
  );

  const selectedTagSet = useMemo(() => new Set(tagIds), [tagIds]);
  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    const term = tagSearch.trim().toLowerCase();
    if (!term) return allTags;
    return allTags.filter((tag) => tag.name.toLowerCase().includes(term));
  }, [allTags, tagSearch]);

  const toggleTag = (tagId: Id<"tags">) => {
    setTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // Add a single hand-picked story to the group (server dedupes and creates the pending status)
  const handleAddStory = async (storyId: Id<"stories">, title: string) => {
    setAddMessage(null);
    setAddingStoryId(storyId);
    try {
      const result = await addSubmissions({
        groupId: group._id,
        storyIds: [storyId],
      });
      if (result.added > 0) {
        setAddMessage(`Added "${title}" to this group.`);
      } else if (result.skipped > 0) {
        setAddMessage(`"${title}" is already in this group.`);
      } else {
        setAddMessage(result.errors[0] ?? "Could not add this submission.");
      }
    } catch {
      setAddMessage("Could not add this submission. Please try again.");
    } finally {
      setAddingStoryId(null);
    }
  };

  const handleSave = () => {
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        autoIncludeTagIds: tagIds.length > 0 ? tagIds : null,
        autoIncludeMatchMode: matchMode,
        autoIncludeStartDate: dateInputToStartTs(startDate),
        autoIncludeEndDate: dateInputToEndTs(endDate),
      });
    });
  };

  // Backfill existing stories matching the saved tag + date config
  const handleSync = async () => {
    setSyncMessage(null);
    setIsSyncing(true);
    try {
      const result = await syncAutoIncludeSubmissions({ groupId: group._id });
      if (!result.tagsConfigured) {
        setSyncMessage(
          "No tags are saved for auto-include. Select tags and save first.",
        );
      } else {
        setSyncMessage(
          `Added ${result.added} submission${result.added === 1 ? "" : "s"}. ${result.alreadyPresent} already included.`,
        );
      }
    } catch {
      setSyncMessage("Failed to sync submissions. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch submissions on demand and download as CSV (same columns as before)
  const handleExportCsv = async () => {
    setExportMessage(null);
    setIsExporting(true);
    try {
      const rows = await convex.query(
        api.judgingGroupSubmissions.exportGroupSubmissions,
        { groupId: group._id },
      );
      if (!rows || rows.length === 0) {
        setExportMessage("This judging group has no submissions to export.");
        return;
      }
      const headers = [
        "App Title",
        "App/Project Tagline",
        "Description",
        "App Website Link",
        "Video Demo URL",
        "GitHub",
        "LinkedIn",
        "Twitter/X",
        "Chef Show URL",
        "Chef App URL",
        "Tags",
        "Team Name",
        "Team Member Count",
        "Team Members",
        "Submitter Name",
        "Email",
        "Slug",
        "Votes",
      ];
      const csvLines = [headers.map(escapeCsv).join(",")];
      for (const row of rows) {
        csvLines.push(
          [
            row.title,
            row.tagline,
            row.longDescription || "",
            row.url,
            row.videoUrl || "",
            row.githubUrl || "",
            row.linkedinUrl || "",
            row.twitterUrl || "",
            row.chefShowUrl || "",
            row.chefAppUrl || "",
            row.tags,
            row.teamName || "",
            row.teamMemberCount !== undefined
              ? String(row.teamMemberCount)
              : "",
            row.teamMembers,
            row.submitterName || "",
            row.email || "",
            row.slug,
            String(row.votes),
          ]
            .map(escapeCsv)
            .join(","),
        );
      }
      const blob = new Blob([csvLines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `judging-${group.name.toLowerCase().replace(/\s+/g, "-")}-submissions-${timestamp}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportMessage(
        err instanceof Error
          ? err.message
          : "Could not export submissions. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Add submissions"
        description="Search every site submission by title and add it to this group. Added submissions appear in judge queues and are included in AI judge runs."
      >
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={storySearch}
            onChange={(e) => setStorySearch(e.target.value)}
            placeholder="Search submissions by title..."
            className="pl-9"
            aria-label="Search submissions by title"
          />
        </div>
        {trimmedStorySearch.length >= 2 && (
          <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
            {storyResults === undefined && (
              <p className="px-3 py-2 text-[13px] text-gray-500">
                Searching...
              </p>
            )}
            {storyResults && storyResults.length === 0 && (
              <p className="px-3 py-2 text-[13px] text-gray-500">
                No submissions match "{trimmedStorySearch}"
              </p>
            )}
            {storyResults?.map((story) => (
              <div
                key={story._id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#292929] truncate">
                    {story.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    /s/{story.slug}
                    {story.status !== "approved" && (
                      <span className="ml-1.5 inline-flex px-1.5 py-0 text-[11px] rounded-full bg-amber-50 text-amber-700">
                        {story.status}
                      </span>
                    )}
                  </p>
                </div>
                {story.inGroup ? (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    In group
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleAddStory(story._id, story.title)}
                    disabled={addingStoryId !== null}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {addingStoryId === story._id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {trimmedStorySearch.length > 0 && trimmedStorySearch.length < 2 && (
          <p className="text-xs text-gray-500">
            Type at least 2 characters to search.
          </p>
        )}
        {addMessage && (
          <p className="text-[13px] text-gray-600">{addMessage}</p>
        )}
      </SectionCard>

      <SectionCard
        title="Auto-include by tag"
        description="New submissions carrying any of these tags are added to this group automatically. Optionally limit by submission date."
        footer={
          <SaveFooter
            saving={saving}
            saved={saved}
            error={error}
            onSave={handleSave}
          />
        }
      >
        {/* Selected tag chips */}
        {tagIds.length > 0 && allTags && (
          <div className="flex flex-wrap gap-1.5">
            {tagIds.map((id) => {
              const tag = allTags.find((t) => t._id === id);
              if (!tag) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => toggleTag(id)}
                    className="text-gray-400 hover:text-gray-700"
                    aria-label={`Remove ${tag.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => setTagIds([])}
              className="text-xs text-gray-500 hover:text-gray-700 px-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Tag search + picker */}
        <div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="pl-9"
            />
          </div>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
            {allTags === undefined && (
              <p className="px-3 py-2 text-[13px] text-gray-500">
                Loading tags...
              </p>
            )}
            {allTags && filteredTags.length === 0 && (
              <p className="px-3 py-2 text-[13px] text-gray-500">
                No tags match "{tagSearch}"
              </p>
            )}
            {filteredTags.map((tag) => (
              <label
                key={tag._id}
                className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTagSet.has(tag._id)}
                  onChange={() => toggleTag(tag._id)}
                  className="rounded border-gray-300"
                />
                {tag.name}
              </label>
            ))}
          </div>
        </div>

        {/* Match mode */}
        <div>
          <Label>Match mode</Label>
          <div className="flex gap-2 mt-1">
            {(
              [
                { value: "any", label: "Any selected tag" },
                { value: "all", label: "All selected tags" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMatchMode(option.value)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md border transition-colors ${
                  matchMode === option.value
                    ? "bg-[#292929] border-[#292929] text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="auto-start">Submitted on or after</Label>
            <Input
              id="auto-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="auto-end">Submitted on or before</Label>
            <Input
              id="auto-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Sync existing submissions"
        description="Backfill stories that already match the saved tag and date configuration."
      >
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isSyncing ? "Syncing..." : "Sync matching submissions"}
          </button>
          {syncMessage && (
            <span className="text-[13px] text-gray-600">{syncMessage}</span>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Export"
        description="Download all submissions in this group as a CSV, including custom form fields."
      >
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
          {exportMessage && (
            <span className="text-[13px] text-gray-600">{exportMessage}</span>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
