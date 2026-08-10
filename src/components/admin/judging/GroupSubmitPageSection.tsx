import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ImageIcon, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import {
  ALWAYS_VISIBLE_FIELD_KEYS,
  CustomQuestion,
  GroupDetails,
  HeaderSaveButton,
  SUBMISSION_FIELD_DEFS,
  SUBMISSION_SECTION_DEFS,
  SectionCard,
  SaveFooter,
  SubmissionFieldRequirements,
  SubmissionFieldVisibility,
  TogglePill,
  UrlRow,
  makeQuestionKey,
  mergeRequirements,
  mergeVisibility,
  useSaveState,
} from "./groupSection";

// Custom submission page: enable toggle, branding (title, description,
// image, layout, links), form copy, required tag with backfill sync, and
// per-field required/optional configuration.
export function GroupSubmitPageSection({ group }: { group: GroupDetails }) {
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const syncRequiredTagSubmissions = useMutation(
    api.judgingGroupSubmissions.syncRequiredTagSubmissions,
  );
  const createTag = useMutation(api.tags.create);
  // Includes hidden tags: judging tracking tags are usually hidden so they
  // stay off story cards and never count toward the tag limit
  const allTags = useQuery(api.tags.listAllForDropdown);
  const { saving, saved, error, setError, run } = useSaveState();

  const [enabled, setEnabled] = useState(
    group.hasCustomSubmissionPage || false,
  );
  const [pageTitle, setPageTitle] = useState(group.submissionPageTitle || "");
  const [pageDescription, setPageDescription] = useState(
    group.submissionPageDescription || "",
  );
  const [layout, setLayout] = useState<"two-column" | "one-third" | "single">(
    group.submissionPageLayout || "two-column",
  );
  const [imageSize, setImageSize] = useState(
    group.submissionPageImageSize || 400,
  );
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>(
    group.submissionPageLinks || [],
  );
  const [formTitle, setFormTitle] = useState(group.submissionFormTitle || "");
  const [formSubtitle, setFormSubtitle] = useState(
    group.submissionFormSubtitle || "",
  );
  const [requiredTagId, setRequiredTagId] = useState<Id<"tags"> | null>(
    group.submissionFormRequiredTagId || null,
  );
  const [requirements, setRequirements] =
    useState<SubmissionFieldRequirements>(
      mergeRequirements(group.submissionFieldRequirements),
    );
  const [visibility, setVisibility] = useState<SubmissionFieldVisibility>(
    mergeVisibility(group.submissionFieldVisibility),
  );
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(
    group.submissionCustomQuestions || [],
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [createTagError, setCreateTagError] = useState("");
  const [newTagHidden, setNewTagHidden] = useState(true);

  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    const term = tagSearch.trim().toLowerCase();
    if (!term) return allTags;
    return allTags.filter((tag) => tag.name.toLowerCase().includes(term));
  }, [allTags, tagSearch]);

  const hasStoredImage = !!group.submissionPageImageId && !removeImage;

  // Persist the enable flag immediately so the public URL works right away.
  // The rest of the page settings still apply on save.
  const handleToggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    setError("");
    void updateGroup({
      groupId: group._id,
      hasCustomSubmissionPage: next,
    }).catch(() => {
      setEnabled(!next);
      setError("Failed to update page availability. Please try again.");
    });
  };

  const handleSave = () => {
    // Basic link validation before saving
    for (const link of links) {
      if (link.label.trim() && !link.url.trim()) {
        setError(`Link "${link.label}" is missing a URL`);
        return;
      }
    }
    // Hiding the tag picker requires a saved required tag so submissions
    // still land in this judging group automatically.
    if (!visibility.tags && !requiredTagId) {
      setError(
        "Set a required tag before hiding the Tags field, so submissions still land in this group.",
      );
      return;
    }
    // Custom questions need a label; keys are generated from labels on save.
    for (const question of customQuestions) {
      if (!question.label.trim()) {
        setError("Every custom question needs a label.");
        return;
      }
    }
    void run(async () => {
      let uploadedImageId: Id<"_storage"> | undefined;
      if (imageFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageFile.type },
          body: imageFile,
        });
        const { storageId } = await result.json();
        uploadedImageId = storageId;
      }
      const cleanLinks = links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.label && l.url);
      // Assign stable keys to new questions; existing keys never change so
      // stored answers stay linked to their question.
      const usedKeys: string[] = customQuestions
        .map((q) => q.key)
        .filter((k) => k !== "");
      const cleanQuestions: CustomQuestion[] = customQuestions.map((q) => {
        let key = q.key;
        if (!key) {
          key = makeQuestionKey(q.label, usedKeys);
          usedKeys.push(key);
        }
        return {
          key,
          label: q.label.trim(),
          placeholder: q.placeholder?.trim() || undefined,
          description: q.description?.trim() || undefined,
          fieldType: q.fieldType,
          required: q.required,
        };
      });
      await updateGroup({
        groupId: group._id,
        hasCustomSubmissionPage: enabled,
        submissionPageTitle: pageTitle.trim() || null,
        submissionPageDescription: pageDescription.trim() || null,
        submissionPageLayout: layout,
        submissionPageImageSize: imageSize,
        submissionPageLinks: cleanLinks,
        submissionFormTitle: formTitle.trim() || null,
        submissionFormSubtitle: formSubtitle.trim() || null,
        submissionFormRequiredTagId: requiredTagId,
        submissionFieldRequirements: requirements,
        submissionFieldVisibility: visibility,
        submissionCustomQuestions: cleanQuestions,
        ...(uploadedImageId
          ? { submissionPageImageId: uploadedImageId }
          : removeImage
            ? { submissionPageImageId: null }
            : {}),
      });
      setCustomQuestions(cleanQuestions);
      setImageFile(null);
      setRemoveImage(false);
    });
  };

  // Backfill stories carrying the saved required tag into this group
  const handleSyncByTag = async () => {
    setSyncMessage(null);
    setIsSyncing(true);
    try {
      const result = await syncRequiredTagSubmissions({ groupId: group._id });
      if (!result.requiredTagSet) {
        setSyncMessage(
          "No required tag is saved for this group. Select a tag and save first.",
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

  const requiredTagName = requiredTagId
    ? allTags?.find((t) => t._id === requiredTagId)?.name
    : null;

  // Inline tag creation through the standard tags.create mutation, so the
  // new tag shows up in Tag Management with all the usual tag features.
  // Requires the tags.manage permission; errors surface inline.
  const trimmedTagSearch = tagSearch.trim();
  const tagNameExists = !!allTags?.some(
    (t) => t.name.toLowerCase() === trimmedTagSearch.toLowerCase(),
  );

  const handleCreateTag = async () => {
    if (!trimmedTagSearch || creatingTag) return;
    setCreateTagError("");
    setCreatingTag(true);
    try {
      const tagId = await createTag({
        name: trimmedTagSearch,
        // Same slug convention as Tag Management
        slug: trimmedTagSearch
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w-]+/g, ""),
        showInHeader: false,
        isHidden: newTagHidden,
        createdByAdmin: true,
      });
      setRequiredTagId(tagId);
      setTagSearch("");
    } catch (err) {
      setCreateTagError(
        err instanceof Error ? err.message : "Failed to create tag",
      );
    } finally {
      setCreatingTag(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Custom submission page"
        description="A branded public form where participants submit directly into this judging group."
        headerAction={
          enabled ? (
            <HeaderSaveButton
              saving={saving}
              saved={saved}
              onSave={handleSave}
            />
          ) : undefined
        }
        footer={
          <SaveFooter
            saving={saving}
            saved={saved}
            error={error}
            onSave={handleSave}
          />
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-[#292929]">
              Enable custom submission page
            </p>
            <p className="text-xs text-gray-500">
              {enabled
                ? "The public submit page is available"
                : "The public submit page is disabled"}
            </p>
          </div>
          <TogglePill
            enabled={enabled}
            onToggle={handleToggleEnabled}
            onLabel="Enabled"
            offLabel="Disabled"
            disabled={saving}
          />
        </div>

        {enabled && (
          <UrlRow
            label="Submission page"
            path={`/judging/${group.slug}/submit`}
            hint={
              group.submissionPagePassword
                ? "Password protected (see Access section)"
                : undefined
            }
          />
        )}

        {enabled && (
          <>
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div>
                <Label htmlFor="page-title">Page title</Label>
                <Input
                  id="page-title"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder={group.name}
                  disabled={saving}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="page-description">Page description</Label>
                <Textarea
                  id="page-description"
                  value={pageDescription}
                  onChange={(e) => setPageDescription(e.target.value)}
                  placeholder="Intro text shown next to the submission form..."
                  rows={3}
                  disabled={saving}
                  className="mt-1"
                />
              </div>

              {/* Layout choice */}
              <div>
                <Label>Layout</Label>
                <div className="flex gap-2 mt-1">
                  {(
                    [
                      { value: "two-column", label: "Two column" },
                      { value: "one-third", label: "One third / two thirds" },
                      { value: "single", label: "Single column" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLayout(option.value)}
                      disabled={saving}
                      className={`px-3 py-1.5 text-[13px] font-medium rounded-md border transition-colors ${
                        layout === option.value
                          ? "bg-[#292929] border-[#292929] text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Header image */}
              <div>
                <Label htmlFor="header-image" className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Header image
                </Label>
                {hasStoredImage && !imageFile && (
                  <div className="flex items-center gap-2 mt-1 text-[13px] text-gray-600">
                    <span>An image is currently set.</span>
                    <button
                      type="button"
                      onClick={() => setRemoveImage(true)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700 text-xs font-medium"
                    >
                      Remove on save
                    </button>
                  </div>
                )}
                {removeImage && (
                  <div className="flex items-center gap-2 mt-1 text-[13px] text-red-600">
                    <span>Image will be removed on save.</span>
                    <button
                      type="button"
                      onClick={() => setRemoveImage(false)}
                      className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                    >
                      Undo
                    </button>
                  </div>
                )}
                <Input
                  id="header-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setImageFile(e.target.files?.[0] ?? null);
                    setRemoveImage(false);
                  }}
                  disabled={saving}
                  className="mt-1"
                />
                <div className="mt-2">
                  <Label htmlFor="image-size">
                    Image display size ({imageSize}px)
                  </Label>
                  <input
                    id="image-size"
                    type="range"
                    min={200}
                    max={800}
                    step={20}
                    value={imageSize}
                    onChange={(e) => setImageSize(parseInt(e.target.value))}
                    disabled={saving}
                    className="w-full mt-1 accent-[#292929]"
                  />
                </div>
              </div>

              {/* Page links */}
              <div>
                <Label>Page links</Label>
                <div className="space-y-2 mt-1">
                  {links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={link.label}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((l, i) =>
                              i === index
                                ? { ...l, label: e.target.value }
                                : l,
                            ),
                          )
                        }
                        placeholder="Label"
                        disabled={saving}
                        className="flex-1"
                      />
                      <Input
                        value={link.url}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((l, i) =>
                              i === index ? { ...l, url: e.target.value } : l,
                            ),
                          )
                        }
                        placeholder="https://..."
                        disabled={saving}
                        className="flex-[2]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLinks((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                        disabled={saving}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors flex-shrink-0"
                        aria-label="Remove link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setLinks((prev) => [...prev, { label: "", url: "" }])
                    }
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add link
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div>
                <Label htmlFor="form-title">Form title</Label>
                <Input
                  id="form-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Submit your app"
                  disabled={saving}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="form-subtitle">Form subtitle</Label>
                <Input
                  id="form-subtitle"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Share what you built for judging"
                  disabled={saving}
                  className="mt-1"
                />
              </div>

              {/* Required tag applied to every submission from this form */}
              <div>
                <Label>Required tag</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Every submission from this form is tagged automatically so it
                  lands in this judging group.
                </p>
                {requiredTagName && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                      {requiredTagName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRequiredTagId(null)}
                      disabled={saving}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <Input
                  value={tagSearch}
                  onChange={(e) => {
                    setTagSearch(e.target.value);
                    setCreateTagError("");
                  }}
                  placeholder="Search or type a new tag name..."
                  disabled={saving}
                  className="mt-2"
                />
                <div className="mt-1.5 max-h-36 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                  {allTags === undefined && (
                    <p className="px-3 py-2 text-[13px] text-gray-500">
                      Loading tags...
                    </p>
                  )}
                  {filteredTags.map((tag) => (
                    <button
                      key={tag._id}
                      type="button"
                      onClick={() => setRequiredTagId(tag._id)}
                      disabled={saving}
                      className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors ${
                        requiredTagId === tag._id
                          ? "bg-gray-100 text-[#292929] font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {tag.name}
                      {tag.isHidden && (
                        <span className="ml-2 text-xs text-gray-400">
                          hidden
                        </span>
                      )}
                    </button>
                  ))}

                  {/* Create a new tag from the search term via tags.create */}
                  {trimmedTagSearch && !tagNameExists && (
                    <button
                      type="button"
                      onClick={() => void handleCreateTag()}
                      disabled={saving || creatingTag}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {creatingTag ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Create tag "{trimmedTagSearch}"
                        {newTagHidden && (
                          <span className="text-xs text-gray-400">hidden</span>
                        )}
                      </span>
                    </button>
                  )}
                </div>
                {trimmedTagSearch && !tagNameExists && (
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTagHidden}
                      onChange={(e) => setNewTagHidden(e.target.checked)}
                      disabled={saving || creatingTag}
                      className="rounded border-gray-300"
                    />
                    Create as hidden tag (stays off story cards and never
                    counts toward the tag limit; recommended for tracking tags)
                  </label>
                )}
                {createTagError && (
                  <p className="mt-1.5 text-[13px] text-red-600">
                    {createTagError}
                  </p>
                )}
              </div>

              {/* Field visibility and requirements */}
              <div>
                <Label>Form fields</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Choose which fields appear on the submission form and which
                  are required. Hidden fields are removed from the form
                  entirely.
                </p>
                <div className="mt-1.5 rounded-md border border-gray-200 divide-y divide-gray-100">
                  {SUBMISSION_FIELD_DEFS.map((field) => {
                    const alwaysVisible = ALWAYS_VISIBLE_FIELD_KEYS.includes(
                      field.key,
                    );
                    const isVisible = alwaysVisible || visibility[field.key];
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <span
                          className={`text-[13px] ${
                            isVisible ? "text-gray-700" : "text-gray-400"
                          }`}
                        >
                          {field.label}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isVisible && (
                            <button
                              type="button"
                              onClick={() =>
                                setRequirements((prev) => ({
                                  ...prev,
                                  [field.key]: !prev[field.key],
                                }))
                              }
                              disabled={saving}
                              className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                                requirements[field.key]
                                  ? "bg-[#292929] text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {requirements[field.key]
                                ? "Required"
                                : "Optional"}
                            </button>
                          )}
                          {alwaysVisible ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-50 text-gray-400 border border-gray-200">
                              Always shown
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setVisibility((prev) => ({
                                  ...prev,
                                  [field.key]: !prev[field.key],
                                }))
                              }
                              disabled={saving}
                              className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                                visibility[field.key]
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-transparent"
                              }`}
                            >
                              {visibility[field.key] ? "Shown" : "Hidden"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!visibility.tags && !requiredTagId && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    Tags are hidden: set a required tag above so submissions
                    still land in this judging group.
                  </p>
                )}
                {!visibility.githubUrl && group.aiJudgeEnabled && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    The AI judge is enabled for this group but the GitHub Repo
                    URL field is hidden, so submissions may have no repo to
                    analyze.
                  </p>
                )}
              </div>

              {/* Section visibility */}
              <div>
                <Label>Form sections</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Show or hide the optional sections of the form.
                </p>
                <div className="mt-1.5 rounded-md border border-gray-200 divide-y divide-gray-100">
                  {SUBMISSION_SECTION_DEFS.map((section) => (
                    <div
                      key={section.key}
                      className="flex items-center justify-between gap-2 px-3 py-1.5"
                    >
                      <span
                        className={`text-[13px] ${
                          visibility[section.key]
                            ? "text-gray-700"
                            : "text-gray-400"
                        }`}
                      >
                        {section.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVisibility((prev) => ({
                            ...prev,
                            [section.key]: !prev[section.key],
                          }))
                        }
                        disabled={saving}
                        className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors flex-shrink-0 ${
                          visibility[section.key]
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-transparent"
                        }`}
                      >
                        {visibility[section.key] ? "Shown" : "Hidden"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom questions */}
              <div>
                <Label>Custom questions</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add extra questions to this form. Answers are stored with
                  the submission and shown to judges.
                </p>
                <div className="mt-1.5 space-y-3">
                  {customQuestions.map((question, index) => (
                    <div
                      key={question.key || `new-${index}`}
                      className="rounded-md border border-gray-200 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={question.label}
                          onChange={(e) =>
                            setCustomQuestions((prev) =>
                              prev.map((q, i) =>
                                i === index
                                  ? { ...q, label: e.target.value }
                                  : q,
                              ),
                            )
                          }
                          placeholder="Question label (e.g. What inspired this project?)"
                          disabled={saving}
                          className="flex-1"
                        />
                        <select
                          value={question.fieldType}
                          onChange={(e) =>
                            setCustomQuestions((prev) =>
                              prev.map((q, i) =>
                                i === index
                                  ? {
                                      ...q,
                                      fieldType: e.target
                                        .value as CustomQuestion["fieldType"],
                                    }
                                  : q,
                              ),
                            )
                          }
                          disabled={saving}
                          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#292929]"
                          aria-label="Question field type"
                        >
                          <option value="text">Short text</option>
                          <option value="textarea">Long text</option>
                          <option value="url">URL</option>
                          <option value="email">Email</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomQuestions((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          disabled={saving}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors flex-shrink-0"
                          aria-label="Remove question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={question.placeholder || ""}
                          onChange={(e) =>
                            setCustomQuestions((prev) =>
                              prev.map((q, i) =>
                                i === index
                                  ? { ...q, placeholder: e.target.value }
                                  : q,
                              ),
                            )
                          }
                          placeholder="Placeholder (optional)"
                          disabled={saving}
                          className="flex-1"
                        />
                        <Input
                          value={question.description || ""}
                          onChange={(e) =>
                            setCustomQuestions((prev) =>
                              prev.map((q, i) =>
                                i === index
                                  ? { ...q, description: e.target.value }
                                  : q,
                              ),
                            )
                          }
                          placeholder="Help text (optional)"
                          disabled={saving}
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCustomQuestions((prev) =>
                              prev.map((q, i) =>
                                i === index
                                  ? { ...q, required: !q.required }
                                  : q,
                              ),
                            )
                          }
                          disabled={saving}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors flex-shrink-0 ${
                            question.required
                              ? "bg-[#292929] text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {question.required ? "Required" : "Optional"}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setCustomQuestions((prev) => [
                        ...prev,
                        {
                          key: "",
                          label: "",
                          fieldType: "text",
                          required: false,
                        },
                      ])
                    }
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add question
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Sync by required tag"
        description="Backfill stories already carrying the saved required tag into this group."
      >
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void handleSyncByTag()}
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
    </div>
  );
}
