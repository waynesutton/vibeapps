import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { hasPermission, requireJudgingGroupPermission } from "./adminAccess";
import { getAuthenticatedUserId } from "./users";
import { ensureStoryInGroup } from "./judgingGroupSubmissions";
import { markResearchStale } from "./researchIndex";
import { logActivity } from "./activityLog";
import { normalizeProjectUrl } from "./hackathon";
import { generateUniqueStorySlug } from "./lib/slug";

// CSV import for judging groups (Devpost exports and similar). Rows are
// parsed and mapped in the browser, then sent here in small batches. Each
// row becomes a story with no account, linked to the group. Re-uploads
// update rows matched by importKey instead of creating duplicates.

// Rows per call: keeps each mutation well inside transaction limits even
// with long descriptions and many extra columns.
const MAX_ROWS_PER_BATCH = 25;
const MAX_EXTRA_ANSWERS = 40;
const MAX_TEAM_MEMBERS = 12;
const MAX_MAPPING_ENTRIES = 200;

// Field caps (characters)
const CAP = {
  key: 500,
  title: 200,
  tagline: 300,
  longDescription: 20000,
  url: 2000,
  name: 200,
  email: 320,
  label: 200,
  value: 5000,
} as const;

const importRowValidator = v.object({
  importKey: v.string(),
  title: v.string(),
  tagline: v.optional(v.string()),
  longDescription: v.optional(v.string()),
  url: v.optional(v.string()),
  githubUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  twitterUrl: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  submitterName: v.optional(v.string()),
  email: v.optional(v.string()),
  teamName: v.optional(v.string()),
  teamMembers: v.optional(
    v.array(v.object({ name: v.string(), email: v.string() })),
  ),
  submittedAt: v.optional(v.number()),
  extraAnswers: v.array(
    v.object({ key: v.string(), label: v.string(), value: v.string() }),
  ),
});

const skippedValidator = v.object({
  importKey: v.string(),
  title: v.string(),
  reason: v.string(),
});

// Trim and cap free text; empty becomes undefined
function clean(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

// Keep only absolute http(s) URLs
function cleanUrl(value: string | undefined): string | undefined {
  const trimmed = clean(value, CAP.url);
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value: string | undefined): string | undefined {
  const trimmed = clean(value, CAP.email)?.toLowerCase();
  return trimmed && EMAIL_REGEX.test(trimmed) ? trimmed : undefined;
}

// Short tagline fallback from the long description
function taglineFrom(longDescription: string | undefined): string {
  if (!longDescription) return "";
  const flat = longDescription.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 137).trimEnd()}...` : flat;
}

/**
 * Import one batch of mapped CSV rows into a judging group.
 * includeInDirectory=false (the default in the UI) keeps rows judging only:
 * hidden from every public surface but judged, AI judged, and emailed.
 */
export const importCsvBatch = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    includeInDirectory: v.boolean(),
    // Optional tag added to every row in the batch
    tagId: v.optional(v.id("tags")),
    rows: v.array(importRowValidator),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.array(skippedValidator),
  }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");
    if (args.rows.length > MAX_ROWS_PER_BATCH) {
      throw new Error(`Send at most ${MAX_ROWS_PER_BATCH} rows per batch`);
    }
    const userId = await getAuthenticatedUserId(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Judging group not found");

    // Live project URLs already in the group, so a team that also used the
    // regular submit form is not imported twice
    const memberships = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const memberStories = await Promise.all(
      memberships.map((m) => ctx.db.get(m.storyId)),
    );
    const takenUrls = new Map<string, Id<"stories">>();
    for (const story of memberStories) {
      if (!story || story.status === "rejected") continue;
      if (story.isHidden === true && story.judgingOnly !== true) continue;
      const normalized = normalizeProjectUrl(story.url);
      if (normalized) takenUrls.set(normalized, story._id);
    }

    // Judging only rows may only carry a private tag: related apps on public
    // story pages match by tag and do not check story visibility
    const importTag = args.tagId ? await ctx.db.get(args.tagId) : null;
    if (args.tagId && !importTag) throw new Error("That tag no longer exists");
    if (importTag && !args.includeInDirectory && importTag.isHidden !== true) {
      throw new Error(
        "Rows kept off the public directory can only get a private tag",
      );
    }

    // Public imports carry the group's required tag plus the import tag;
    // judging only imports carry at most the private import tag
    const baseTagIds: Array<Id<"tags">> =
      args.includeInDirectory && group.submissionFormRequiredTagId
        ? [group.submissionFormRequiredTagId]
        : [];
    const newRowTagIds: Array<Id<"tags">> =
      importTag && !baseTagIds.includes(importTag._id)
        ? [...baseTagIds, importTag._id]
        : baseTagIds;

    if (group.csvImportTagId !== args.tagId) {
      await ctx.db.patch(args.groupId, { csvImportTagId: args.tagId });
    }

    let created = 0;
    let updated = 0;
    const skipped: Array<{ importKey: string; title: string; reason: string }> =
      [];

    for (const row of args.rows) {
      const importKey = clean(row.importKey, CAP.key);
      const title = clean(row.title, CAP.title);
      const label = title ?? importKey ?? "Untitled row";
      if (!importKey) {
        skipped.push({ importKey: "", title: label, reason: "Missing unique key" });
        continue;
      }
      if (!title) {
        skipped.push({ importKey, title: label, reason: "Missing title" });
        continue;
      }

      const longDescription = clean(row.longDescription, CAP.longDescription);
      const githubUrl = cleanUrl(row.githubUrl);
      const sourceUrl = cleanUrl(row.sourceUrl);
      const url = cleanUrl(row.url) ?? githubUrl ?? sourceUrl;
      if (!url) {
        skipped.push({
          importKey,
          title,
          reason: "No live URL, GitHub URL, or source URL",
        });
        continue;
      }

      const teamMembers = (row.teamMembers ?? [])
        .map((member) => ({
          name: clean(member.name, CAP.name) ?? "",
          email: cleanEmail(member.email) ?? "",
        }))
        .filter((member) => member.name || member.email)
        .slice(0, MAX_TEAM_MEMBERS);

      const customFormAnswers = row.extraAnswers
        .map((answer) => ({
          key: clean(answer.key, CAP.label) ?? "",
          label: clean(answer.label, CAP.label) ?? "",
          value: clean(answer.value, CAP.value) ?? "",
        }))
        .filter((answer) => answer.key && answer.label && answer.value)
        .slice(0, MAX_EXTRA_ANSWERS);

      const submittedAt =
        row.submittedAt !== undefined &&
        Number.isFinite(row.submittedAt) &&
        row.submittedAt > 0
          ? row.submittedAt
          : undefined;

      // Fields an import owns; refreshed on every re-upload
      const fields = {
        title,
        url,
        description:
          clean(row.tagline, CAP.tagline) ?? taglineFrom(longDescription),
        longDescription,
        githubUrl,
        videoUrl: cleanUrl(row.videoUrl),
        linkedinUrl: cleanUrl(row.linkedinUrl),
        twitterUrl: cleanUrl(row.twitterUrl),
        submitterName: clean(row.submitterName, CAP.name),
        email: cleanEmail(row.email),
        teamName: clean(row.teamName, CAP.name),
        teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
        teamMemberCount: teamMembers.length > 0 ? teamMembers.length : undefined,
        customFormAnswers:
          customFormAnswers.length > 0 ? customFormAnswers : undefined,
        importSourceUrl: sourceUrl,
        submittedAt,
      };

      const existing: Doc<"stories"> | null = await ctx.db
        .query("stories")
        .withIndex("by_importGroupId_and_importKey", (q) =>
          q.eq("importGroupId", args.groupId).eq("importKey", importKey),
        )
        .first();

      if (existing) {
        // Re-upload: refresh imported fields, keep votes and visibility. The
        // import tag is added, never removed; a public tag is never added to
        // a judging only row
        const existingTagIds = existing.tagIds ?? [];
        const addTag =
          importTag !== null &&
          !existingTagIds.includes(importTag._id) &&
          (existing.judgingOnly !== true || importTag.isHidden === true);
        await ctx.db.patch(
          existing._id,
          addTag ? { ...fields, tagIds: [...existingTagIds, importTag._id] } : fields,
        );
        await ensureStoryInGroup(ctx, args.groupId, existing._id, userId);
        const normalized = normalizeProjectUrl(url);
        if (normalized) takenUrls.set(normalized, existing._id);
        updated++;
        continue;
      }

      const normalized = normalizeProjectUrl(url);
      if (normalized && takenUrls.has(normalized)) {
        skipped.push({
          importKey,
          title,
          reason: "A submission with this URL is already in the group",
        });
        continue;
      }

      const slug = await generateUniqueStorySlug(ctx, title);
      const storyId = await ctx.db.insert("stories", {
        ...fields,
        slug,
        tagIds: newRowTagIds,
        userId: undefined,
        votes: 0,
        commentCount: 0,
        ratingSum: 0,
        ratingCount: 0,
        status: "approved",
        isApproved: true,
        isHidden: !args.includeInDirectory,
        isPinned: false,
        judgingOnly: args.includeInDirectory ? undefined : true,
        importGroupId: args.groupId,
        importKey,
      });
      await ensureStoryInGroup(ctx, args.groupId, storyId, userId);
      if (normalized) takenUrls.set(normalized, storyId);
      created++;
    }

    if (created > 0 || updated > 0) {
      await markResearchStale(ctx, args.groupId);
      await logActivity(ctx, {
        category: "judging",
        action: "judging.csvImport",
        message: `CSV import into ${group.name}: ${created} created, ${updated} updated, ${skipped.length} skipped`,
        targetType: "judgingGroup",
        targetId: args.groupId,
        targetLabel: group.name,
        groupId: args.groupId,
        metadata: {
          created,
          updated,
          skipped: skipped.length,
          includeInDirectory: args.includeInDirectory,
          tagName: importTag?.name,
        },
      });
    }

    return { created, updated, skipped };
  },
});

/**
 * Preview state for the import UI: keys already imported into this group,
 * project URLs already present, and the saved column mapping.
 */
export const getImportState = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.object({
    importedKeys: v.array(v.string()),
    existingUrls: v.array(v.string()),
    mapping: v.optional(
      v.array(v.object({ header: v.string(), target: v.string() })),
    ),
    requiredTagName: v.optional(v.string()),
    // Every tag (private ones included) for the import tag picker
    tags: v.array(
      v.object({ _id: v.id("tags"), name: v.string(), isPrivate: v.boolean() }),
    ),
    lastTagId: v.optional(v.id("tags")),
    canCreatePublicTag: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Judging group not found");

    const memberships = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const stories = await Promise.all(
      memberships.map((m) => ctx.db.get(m.storyId)),
    );

    const importedKeys: Array<string> = [];
    const existingUrls: Array<string> = [];
    for (const story of stories) {
      if (!story) continue;
      if (story.importGroupId === args.groupId && story.importKey) {
        importedKeys.push(story.importKey);
      }
      const normalized = normalizeProjectUrl(story.url);
      if (normalized) existingUrls.push(normalized);
    }

    const requiredTag = group.submissionFormRequiredTagId
      ? await ctx.db.get(group.submissionFormRequiredTagId)
      : null;

    const [allTags, canCreatePublicTag] = await Promise.all([
      ctx.db.query("tags").take(1000),
      hasPermission(ctx, "tags.manage"),
    ]);
    const tags = allTags
      .map((tag) => ({
        _id: tag._id,
        name: tag.name,
        isPrivate: tag.isHidden === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const lastTagId =
      group.csvImportTagId && tags.some((t) => t._id === group.csvImportTagId)
        ? group.csvImportTagId
        : undefined;

    return {
      importedKeys,
      existingUrls,
      mapping: group.csvImportMapping,
      requiredTagName: requiredTag?.name,
      tags,
      lastTagId,
      canCreatePublicTag,
    };
  },
});

const MAX_TAG_NAME = 40;

function tagSlugFrom(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "")
      .replace(/--+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}

/**
 * Create a tag from the CSV import card. Private tags (hidden from public
 * tag lists, tag pages, and app cards) only need judging.manage; a public
 * tag also needs tags.manage. Returns the existing tag when the name is
 * already taken, so a double click never creates two.
 */
export const createImportTag = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    name: v.string(),
    isPrivate: v.boolean(),
  },
  returns: v.object({
    tagId: v.id("tags"),
    name: v.string(),
    isPrivate: v.boolean(),
    existed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");
    const name = args.name.trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Tag name cannot be empty");
    if (name.length > MAX_TAG_NAME) {
      throw new Error(`Tag names can be at most ${MAX_TAG_NAME} characters`);
    }

    const existing = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) {
      return {
        tagId: existing._id,
        name: existing.name,
        isPrivate: existing.isHidden === true,
        existed: true,
      };
    }

    if (!args.isPrivate && !(await hasPermission(ctx, "tags.manage"))) {
      throw new Error(
        "Creating a public tag needs tag management access. Create a private tag instead.",
      );
    }

    // Unique slug: append a counter when the base slug is taken
    const base = tagSlugFrom(name);
    let slug = base;
    for (let n = 2; n < 50; n++) {
      const taken = await ctx.db
        .query("tags")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!taken) break;
      slug = `${base}-${n}`;
    }

    const tagId = await ctx.db.insert("tags", {
      name,
      slug,
      showInHeader: false,
      isHidden: args.isPrivate,
      hideInStoryDetail: false,
      hideInStoryList: false,
      createdByAdmin: true,
    });
    await logActivity(ctx, {
      category: "judging",
      action: "judging.csvImportTagCreated",
      message: `Created ${args.isPrivate ? "private" : "public"} tag ${name} for CSV import`,
      targetType: "judgingGroup",
      targetId: args.groupId,
      targetLabel: name,
      groupId: args.groupId,
      metadata: { tagId, isPrivate: args.isPrivate },
    });
    return { tagId, name, isPrivate: args.isPrivate, existed: false };
  },
});

/**
 * Remember the header to field mapping so the next upload of the same
 * export maps itself.
 */
export const saveImportMapping = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    mapping: v.array(v.object({ header: v.string(), target: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");
    const mapping = args.mapping
      .slice(0, MAX_MAPPING_ENTRIES)
      .map((entry) => ({
        header: entry.header.slice(0, CAP.label),
        target: entry.target.slice(0, 60),
      }));
    await ctx.db.patch(args.groupId, { csvImportMapping: mapping });
    return null;
  },
});
