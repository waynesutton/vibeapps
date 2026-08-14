import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ImageIcon, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { SimpleSelect } from "../../ui/SimpleSelect";
import {
  ALWAYS_VISIBLE_FIELD_KEYS,
  CustomQuestion,
  DynamicFieldOverrides,
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
  // Header image crop: square (1:1) or wide (16:9, fills the layout width)
  const [imageAspect, setImageAspect] = useState<"square" | "wide">(
    group.submissionPageImageAspect || "square",
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
  // Display-only: hide the locked required tag from submitters. The tag is
  // still applied on submit; Tag Management's hidden flag is separate.
  const [requiredTagVisible, setRequiredTagVisible] = useState(
    group.submissionFormRequiredTagVisible !== false,
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
  // Per-group required/shown overrides for admin-managed form fields
  const [dynamicOverrides, setDynamicOverrides] =
    useState<DynamicFieldOverrides>(
      group.submissionDynamicFieldOverrides || {},
    );
  // Enabled fields from Manage Form Fields (githubUrl is a core field above)
  const enabledFormFields = useQuery(api.storyFormFields.listEnabled);
  const dynamicFields = (enabledFormFields || []).filter(
    (field) => field.key !== "githubUrl",
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
        const isChoice =
          q.fieldType === "radio" ||
          q.fieldType === "multiselect" ||
          q.fieldType === "select";
        const cleanOptions = isChoice
          ? (q.options ?? []).map((o) => o.trim()).filter(Boolean)
          : undefined;
        if (isChoice && (cleanOptions?.length ?? 0) < 2) {
          throw new Error(
            `"${q.label || "Untitled question"}" needs at least 2 options`,
          );
        }
        return {
          key,
          label: q.label.trim(),
          placeholder: q.placeholder?.trim() || undefined,
          description: q.description?.trim() || undefined,
          fieldType: q.fieldType,
          options: cleanOptions,
          required: q.required,
          visible: q.visible,
        };
      });
      await updateGroup({
        groupId: group._id,
        hasCustomSubmissionPage: enabled,
        submissionPageTitle: pageTitle.trim() || null,
        submissionPageDescription: pageDescription.trim() || null,
        submissionPageLayout: layout,
        submissionPageImageSize: imageSize,
        submissionPageImageAspect: imageAspect,
        submissionPageLinks: cleanLinks,
        submissionFormTitle: formTitle.trim() || null,
        submissionFormSubtitle: formSubtitle.trim() || null,
        submissionFormRequiredTagId: requiredTagId,
        submissionFormRequiredTagVisible: requiredTagVisible,
        submissionFieldRequirements: requirements,
        submissionFieldVisibility: visibility,
        submissionCustomQuestions: cleanQuestions,
        submissionDynamicFieldOverrides: dynamicOverrides,
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
            <p className="text-[13px] font-medium text-ink">
              Enable custom submission page
            </p>
            <p className="text-xs text-soft">
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
            <div className="border-t border-hairline pt-4 space-y-4">
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
                          ? "bg-cta border-ink text-on-cta"
                          : "bg-surface border-hairline text-copy hover:border-hairline-strong"
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
                  <div className="flex items-center gap-2 mt-1 text-[13px] text-copy">
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
                      className="text-copy hover:text-ink text-xs font-medium"
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
                {/* Image crop: square keeps the size slider, wide fills the
                    layout width at 16:9 */}
                <div className="mt-2">
                  <Label>Image shape</Label>
                  <div className="flex gap-2 mt-1">
                    {(
                      [
                        { value: "square", label: "Square (1:1)" },
                        { value: "wide", label: "Wide (16:9)" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setImageAspect(option.value)}
                        disabled={saving}
                        className={`px-3 py-1.5 text-[13px] font-medium rounded-md border transition-colors ${
                          imageAspect === option.value
                            ? "bg-cta border-ink text-on-cta"
                            : "bg-surface border-hairline text-copy hover:border-hairline-strong"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {imageAspect === "wide" && (
                    <p className="text-xs text-soft mt-1">
                      Wide images fill the page width at 16:9, so the size
                      slider does not apply.
                    </p>
                  )}
                </div>
                {imageAspect === "square" && (
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
                      className="w-full mt-1 accent-cta"
                    />
                  </div>
                )}
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
                        className="p-1.5 text-faint hover:text-red-600 rounded transition-colors flex-shrink-0"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add link
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-hairline pt-4 space-y-4">
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
                <p className="text-xs text-soft mt-0.5">
                  Every submission from this form is tagged automatically so it
                  lands in this judging group.
                </p>
                {requiredTagName && (
                  <>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-surface-alt text-copy rounded-full">
                        {requiredTagName}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRequiredTagId(null)}
                        disabled={saving}
                        className="text-xs text-soft hover:text-copy"
                      >
                        Clear
                      </button>
                    </div>
                    {/* Display-only toggle: the tag is always applied on
                        submit; this just controls whether submitters see it */}
                    <div className="flex items-center justify-between gap-2 mt-2 rounded-md border border-hairline px-3 py-1.5">
                      <div>
                        <p className="text-[13px] text-copy">
                          Show required tag on the form
                        </p>
                        <p className="text-xs text-soft">
                          Hidden only removes the locked tag pill from the
                          submission form. The tag is still applied to every
                          submission so entries land in this group.
                          {allTags?.find((t) => t._id === requiredTagId)
                            ?.isHidden &&
                            " This tag is also marked hidden in Tag Management, so it stays off story cards and tag limits either way."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRequiredTagVisible((prev) => !prev)}
                        disabled={saving}
                        className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors flex-shrink-0 ${
                          requiredTagVisible
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-surface-alt text-soft hover:bg-surface-hover border border-transparent"
                        }`}
                      >
                        {requiredTagVisible ? "Shown" : "Hidden"}
                      </button>
                    </div>
                  </>
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
                <div className="mt-1.5 max-h-36 overflow-y-auto rounded-md border border-hairline divide-y divide-hairline">
                  {allTags === undefined && (
                    <p className="px-3 py-2 text-[13px] text-soft">
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
                          ? "bg-surface-alt text-ink font-medium"
                          : "text-copy hover:bg-surface-hover"
                      }`}
                    >
                      {tag.name}
                      {tag.isHidden && (
                        <span className="ml-2 text-xs text-faint">
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
                      className="w-full text-left px-3 py-1.5 text-[13px] text-copy hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {creatingTag ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Create tag "{trimmedTagSearch}"
                        {newTagHidden && (
                          <span className="text-xs text-faint">hidden</span>
                        )}
                      </span>
                    </button>
                  )}
                </div>
                {trimmedTagSearch && !tagNameExists && (
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-soft cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTagHidden}
                      onChange={(e) => setNewTagHidden(e.target.checked)}
                      disabled={saving || creatingTag}
                      className="rounded border-hairline-strong"
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
                <p className="text-xs text-soft mt-0.5">
                  Choose which fields appear on the submission form and which
                  are required. Hidden fields are removed from the form
                  entirely.
                </p>
                <div className="mt-1.5 rounded-md border border-hairline divide-y divide-hairline">
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
                            isVisible ? "text-copy" : "text-faint"
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
                                  ? "bg-cta text-on-cta"
                                  : "bg-surface-alt text-soft hover:bg-surface-hover"
                              }`}
                            >
                              {requirements[field.key]
                                ? "Required"
                                : "Optional"}
                            </button>
                          )}
                          {alwaysVisible ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-surface-alt text-faint border border-hairline">
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
                                  : "bg-surface-alt text-soft hover:bg-surface-hover border border-transparent"
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

              {/* Admin-managed form fields (Manage Form Fields) with
                  per-group required/shown overrides */}
              <div>
                <Label>Additional form fields</Label>
                <p className="text-xs text-soft mt-0.5">
                  Fields added in Admin, Forms, Manage Form Fields. They render
                  inside the Additional link fields section; override each one
                  for this group here.
                </p>
                <div className="mt-1.5 rounded-md border border-hairline divide-y divide-hairline">
                  {enabledFormFields === undefined && (
                    <p className="px-3 py-2 text-[13px] text-soft">
                      Loading form fields...
                    </p>
                  )}
                  {enabledFormFields !== undefined &&
                    dynamicFields.length === 0 && (
                      <p className="px-3 py-2 text-[13px] text-soft">
                        No enabled fields. Add fields under Admin, Forms,
                        Manage Form Fields.
                      </p>
                    )}
                  {dynamicFields.map((field) => {
                    const override = dynamicOverrides[field.key] || {};
                    const isVisible = override.visible ?? true;
                    const isRequired = override.required ?? field.isRequired;
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <span
                          className={`text-[13px] ${
                            isVisible ? "text-copy" : "text-faint"
                          }`}
                        >
                          {field.label}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isVisible && (
                            <button
                              type="button"
                              onClick={() =>
                                setDynamicOverrides((prev) => ({
                                  ...prev,
                                  [field.key]: {
                                    ...prev[field.key],
                                    required: !isRequired,
                                  },
                                }))
                              }
                              disabled={saving}
                              className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                                isRequired
                                  ? "bg-cta text-on-cta"
                                  : "bg-surface-alt text-soft hover:bg-surface-hover"
                              }`}
                            >
                              {isRequired ? "Required" : "Optional"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setDynamicOverrides((prev) => ({
                                ...prev,
                                [field.key]: {
                                  ...prev[field.key],
                                  visible: !isVisible,
                                },
                              }))
                            }
                            disabled={saving}
                            className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                              isVisible
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-surface-alt text-soft hover:bg-surface-hover border border-transparent"
                            }`}
                          >
                            {isVisible ? "Shown" : "Hidden"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!visibility.additionalLinks && dynamicFields.length > 0 && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    The Additional link fields section is hidden below, so
                    these fields do not appear on the form regardless of
                    per-field settings.
                  </p>
                )}
              </div>

              {/* Section visibility and requirements */}
              <div>
                <Label>Form sections</Label>
                <p className="text-xs text-soft mt-0.5">
                  Show, hide, or require the optional sections of the form.
                </p>
                <div className="mt-1.5 rounded-md border border-hairline divide-y divide-hairline">
                  {SUBMISSION_SECTION_DEFS.map((section) => (
                    <div
                      key={section.key}
                      className="flex items-center justify-between gap-2 px-3 py-1.5"
                    >
                      <span
                        className={`text-[13px] ${
                          visibility[section.key]
                            ? "text-copy"
                            : "text-faint"
                        }`}
                      >
                        {section.label}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {visibility[section.key] && (
                          <button
                            type="button"
                            onClick={() =>
                              setRequirements((prev) => ({
                                ...prev,
                                [section.key]: !prev[section.key],
                              }))
                            }
                            disabled={saving}
                            className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                              requirements[section.key]
                                ? "bg-cta text-on-cta"
                                : "bg-surface-alt text-soft hover:bg-surface-hover"
                            }`}
                          >
                            {requirements[section.key]
                              ? "Required"
                              : "Optional"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setVisibility((prev) => ({
                              ...prev,
                              [section.key]: !prev[section.key],
                            }))
                          }
                          disabled={saving}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                            visibility[section.key]
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-surface-alt text-soft hover:bg-surface-hover border border-transparent"
                          }`}
                        >
                          {visibility[section.key] ? "Shown" : "Hidden"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom questions */}
              <div>
                <Label>Custom questions</Label>
                <p className="text-xs text-soft mt-0.5">
                  Add extra questions to this form. Answers are stored with
                  the submission and shown to judges.
                </p>
                <div className="mt-1.5 space-y-3">
                  {customQuestions.map((question, index) => (
                    <div
                      key={question.key || `new-${index}`}
                      className="rounded-md border border-hairline p-3 space-y-2"
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
                        <SimpleSelect
                          value={question.fieldType}
                          onChange={(value) =>
                            setCustomQuestions((prev) =>
                              prev.map((q, i) =>
                                i === index
                                  ? {
                                      ...q,
                                      fieldType:
                                        value as CustomQuestion["fieldType"],
                                    }
                                  : q,
                              ),
                            )
                          }
                          disabled={saving}
                          aria-label="Question field type"
                          className="w-auto h-9 px-2 text-[13px] gap-1"
                          options={[
                            { value: "text", label: "Short text" },
                            { value: "textarea", label: "Long text" },
                            { value: "url", label: "URL" },
                            { value: "email", label: "Email" },
                            { value: "radio", label: "Radio (single choice)" },
                            {
                              value: "multiselect",
                              label: "Multi-select (checkboxes)",
                            },
                            { value: "select", label: "Dropdown (select)" },
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCustomQuestions((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          disabled={saving}
                          className="p-1.5 text-faint hover:text-red-600 rounded transition-colors flex-shrink-0"
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
                              ? "bg-cta text-on-cta"
                              : "bg-surface-alt text-soft hover:bg-surface-hover"
                          }`}
                        >
                          {question.required ? "Required" : "Optional"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomQuestions((prev) =>
                              prev.map((q, i) =>
                                i === index
                                  ? { ...q, visible: !(q.visible ?? true) }
                                  : q,
                              ),
                            )
                          }
                          disabled={saving}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors flex-shrink-0 ${
                            (question.visible ?? true)
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-surface-alt text-soft hover:bg-surface-hover border border-transparent"
                          }`}
                        >
                          {(question.visible ?? true) ? "Shown" : "Hidden"}
                        </button>
                      </div>
                      {(question.fieldType === "radio" ||
                        question.fieldType === "multiselect" ||
                        question.fieldType === "select") && (
                        <div>
                          <label className="block text-xs font-medium text-copy mb-1">
                            Options (one per line)
                          </label>
                          <textarea
                            value={(question.options ?? []).join("\n")}
                            onChange={(e) =>
                              setCustomQuestions((prev) =>
                                prev.map((q, i) =>
                                  i === index
                                    ? {
                                        ...q,
                                        options: e.target.value.split("\n"),
                                      }
                                    : q,
                                ),
                              )
                            }
                            rows={3}
                            placeholder={"Option A\nOption B\nOption C"}
                            disabled={saving}
                            className="w-full px-3 py-2 border border-hairline rounded-md text-copy text-sm focus:outline-none focus:ring-1 focus:ring-ink bg-surface"
                          />
                          <p className="text-xs text-faint mt-0.5">
                            {question.fieldType === "multiselect"
                              ? "Submitters can pick multiple options."
                              : question.fieldType === "select"
                                ? "Submitters pick one option from a dropdown."
                                : "Submitters pick one option."}
                          </p>
                        </div>
                      )}
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isSyncing ? "Syncing..." : "Sync matching submissions"}
          </button>
          {syncMessage && (
            <span className="text-[13px] text-copy">{syncMessage}</span>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
