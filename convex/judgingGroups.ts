import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { isUserAdmin, getAuthenticatedUserId } from "./users";
import {
  requirePermission,
  requireJudgingGroupPermission,
  getAllowedJudgingGroupIds,
  getAccessContext,
} from "./adminAccess";
import { logActivity } from "./activityLog";
import { ensureStoryInGroup } from "./judgingGroupSubmissions";

// Validator for admin-selectable required fields on the custom submission form.
// Each key is optional; unset keys fall back to defaults on the public page.
const submissionFieldRequirementsValidator = v.object({
  title: v.optional(v.boolean()),
  tagline: v.optional(v.boolean()),
  longDescription: v.optional(v.boolean()),
  url: v.optional(v.boolean()),
  githubUrl: v.optional(v.boolean()),
  videoUrl: v.optional(v.boolean()),
  screenshot: v.optional(v.boolean()),
  submitterName: v.optional(v.boolean()),
  email: v.optional(v.boolean()),
  tags: v.optional(v.boolean()),
  // Form sections can also be marked required
  teamInfo: v.optional(v.boolean()),
  additionalImages: v.optional(v.boolean()),
  additionalLinks: v.optional(v.boolean()),
});

// Validator for admin-selectable visible fields on the custom submission form.
// Unset keys default to visible on the public page. Title can never be hidden.
const submissionFieldVisibilityValidator = v.object({
  title: v.optional(v.boolean()),
  tagline: v.optional(v.boolean()),
  longDescription: v.optional(v.boolean()),
  url: v.optional(v.boolean()),
  githubUrl: v.optional(v.boolean()),
  videoUrl: v.optional(v.boolean()),
  screenshot: v.optional(v.boolean()),
  submitterName: v.optional(v.boolean()),
  email: v.optional(v.boolean()),
  tags: v.optional(v.boolean()),
  teamInfo: v.optional(v.boolean()),
  additionalImages: v.optional(v.boolean()),
  additionalLinks: v.optional(v.boolean()),
});

// Validator for admin-defined custom questions on the custom submission form.
const submissionCustomQuestionsValidator = v.array(
  v.object({
    key: v.string(),
    label: v.string(),
    placeholder: v.optional(v.string()),
    description: v.optional(v.string()),
    fieldType: v.union(
      v.literal("text"),
      v.literal("url"),
      v.literal("email"),
      v.literal("textarea"),
      v.literal("radio"),
      v.literal("multiselect"),
      v.literal("select"),
    ),
    options: v.optional(v.array(v.string())), // Choices for radio/multiselect/select
    required: v.boolean(),
    visible: v.optional(v.boolean()), // Unset = shown
  }),
);

// Per-group overrides for admin-managed form fields (storyFormFields).
// Keyed by the field's key; unset entries fall back to the field defaults.
const submissionDynamicFieldOverridesValidator = v.record(
  v.string(),
  v.object({
    required: v.optional(v.boolean()),
    visible: v.optional(v.boolean()),
  }),
);

// Helper to generate slugs (consistent with existing forms.ts)
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Helper function to check if a story should be included in judging
// Returns true if story is valid for judging (not deleted, hidden, archived, or rejected)
// Type guard to ensure TypeScript knows story is not null when this returns true
function isStoryValidForJudging(
  story: Doc<"stories"> | null,
): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isHidden === true) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  return true;
}

// SHA-256 hex digest. Older rows used reversible btoa; verifyPassword
// still accepts those so existing groups keep working until the password
// is saved again.
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function legacyBtoaHash(password: string): string {
  const data = new TextEncoder().encode(password);
  return btoa(String.fromCharCode(...data));
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if ((await hashPassword(password)) === hash) return true;
  return legacyBtoaHash(password) === hash;
}

// --- Admin Functions ---

/**
 * List all judging groups for admin dashboard
 */
export const listGroups = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("judgingGroups"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isPublic: v.boolean(),
      resultsIsPublic: v.optional(v.boolean()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      hasCustomSubmissionPage: v.optional(v.boolean()),
      aiJudgeEnabled: v.optional(v.boolean()),
      submissionCount: v.number(),
      judgeCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requirePermission(ctx, "judging.view");

    // Scope the list to groups the caller can access (full admins see all)
    const allowedIds = await getAllowedJudgingGroupIds(ctx);
    const allGroups = await ctx.db
      .query("judgingGroups")
      .order("desc")
      .collect();
    const groups =
      allowedIds === "all"
        ? allGroups
        : allGroups.filter((group) => allowedIds.includes(group._id));

    // Enrich with counts
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        const allSubmissions = await ctx.db
          .query("judgingGroupSubmissions")
          .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
          .collect();

        // Filter out invalid stories (deleted, hidden, archived, rejected)
        const validSubmissions = (
          await Promise.all(
            allSubmissions.map(async (submission) => {
              const story = await ctx.db.get(submission.storyId);
              if (!isStoryValidForJudging(story)) {
                return null;
              }
              return submission;
            }),
          )
        ).filter(
          (submission): submission is NonNullable<typeof submission> =>
            submission !== null,
        );

        const submissionCount = validSubmissions.length;

        const judgeCount = await ctx.db
          .query("judges")
          .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
          .collect()
          .then((judges) => judges.length);

        return {
          _id: group._id,
          _creationTime: group._creationTime,
          name: group.name,
          slug: group.slug,
          description: group.description,
          isPublic: group.isPublic,
          resultsIsPublic: group.resultsIsPublic,
          isActive: group.isActive,
          createdBy: group.createdBy,
          hasCustomSubmissionPage: group.hasCustomSubmissionPage,
          aiJudgeEnabled: group.aiJudgeEnabled,
          submissionCount,
          judgeCount,
        };
      }),
    );

    return enrichedGroups;
  },
});

/**
 * Create a new judging group
 */
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    judgePassword: v.optional(v.string()),
    submissionPagePassword: v.optional(v.string()),
    resultsIsPublic: v.optional(v.boolean()),
    resultsPassword: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    aiJudgeEnabled: v.optional(v.boolean()),
    aiResultsIsPublic: v.optional(v.boolean()),
    aiResultsPassword: v.optional(v.string()),
  },
  returns: v.id("judgingGroups"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "judging.manage");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found in database");
    }

    // Generate unique slug
    let slug = generateSlug(args.name);
    const existing = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-5)}`;
    }

    // Hash passwords if provided
    const hashedJudgePassword = args.judgePassword
      ? await hashPassword(args.judgePassword)
      : undefined;
    const hashedSubmissionPassword = args.submissionPagePassword
      ? await hashPassword(args.submissionPagePassword)
      : undefined;
    const hashedResultsPassword = args.resultsPassword
      ? await hashPassword(args.resultsPassword)
      : undefined;
    const hashedAiResultsPassword = args.aiResultsPassword
      ? await hashPassword(args.aiResultsPassword)
      : undefined;

    const newGroupId = await ctx.db.insert("judgingGroups", {
      name: args.name,
      slug,
      description: args.description,
      isPublic: args.isPublic,
      judgePassword: hashedJudgePassword,
      submissionPagePassword: hashedSubmissionPassword,
      resultsIsPublic: args.resultsIsPublic ?? false, // Default to private
      resultsPassword: hashedResultsPassword,
      isActive: args.isActive ?? true,
      createdBy: user._id,
      judgesPerSubmission: 1,
      aiJudgeEnabled: args.aiJudgeEnabled ?? false,
      aiResultsIsPublic: args.aiResultsIsPublic ?? false, // Default to private
      aiResultsPassword: hashedAiResultsPassword,
    });

    // Delegated users with a scoped grant automatically get access to the
    // group they just created so it shows up in their list.
    const access = await getAccessContext(ctx);
    if (!access.isAdmin && access.grant && !access.grant.allJudgingGroups) {
      await ctx.db.patch(access.grant._id, {
        judgingGroupIds: [...access.grant.judgingGroupIds, newGroupId],
      });
    }

    await logActivity(ctx, {
      category: "judging",
      action: "judgingGroup.created",
      message: `Created judging group "${args.name}"`,
      targetType: "judgingGroup",
      targetId: newGroupId,
      targetLabel: args.name,
      groupId: newGroupId,
    });

    return newGroupId;
  },
});

// Sanitize a custom slug the same way createGroup derives one from a name.
function normalizeGroupSlug(raw: string): string {
  const slug = generateSlug(raw);
  if (slug.length < 2) {
    throw new Error(
      "Slug must be at least 2 characters after cleanup (letters, numbers, hyphens).",
    );
  }
  if (slug.length > 80) {
    throw new Error("Slug must be 80 characters or fewer.");
  }
  return slug;
}

/**
 * Change a judging group's URL slug. Public pages, submit links, results,
 * AI results, the admin workspace, and the Agent API all look up the current
 * slug, so they follow immediately. Old URLs 404. Gated by judging.slug.
 */
export const updateGroupSlug = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    slug: v.string(),
  },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.slug");

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    const slug = normalizeGroupSlug(args.slug);
    if (slug === group.slug) {
      return { slug };
    }

    const existing = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing && existing._id !== args.groupId) {
      throw new Error("That URL slug is already used by another judging group.");
    }

    await ctx.db.patch(args.groupId, { slug });

    await logActivity(ctx, {
      category: "judging",
      action: "judgingGroup.slugChanged",
      message: `Changed judging group slug from "${group.slug}" to "${slug}"`,
      targetType: "judgingGroup",
      targetId: args.groupId,
      targetLabel: group.name,
      groupId: args.groupId,
      metadata: { oldSlug: group.slug, newSlug: slug },
    });

    return { slug };
  },
});

/**
 * Update a judging group
 */
export const updateGroup = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    isPublic: v.optional(v.boolean()),
    judgePassword: v.optional(v.union(v.string(), v.null())),
    submissionPagePassword: v.optional(v.union(v.string(), v.null())),
    resultsIsPublic: v.optional(v.boolean()),
    resultsPassword: v.optional(v.union(v.string(), v.null())),
    isActive: v.optional(v.boolean()),
    hasCustomSubmissionPage: v.optional(v.boolean()),
    submissionPageImageId: v.optional(v.union(v.id("_storage"), v.null())),
    submissionPageImageSize: v.optional(v.number()),
    submissionPageImageAspect: v.optional(
      v.union(v.literal("square"), v.literal("wide")),
    ),
    submissionPageLayout: v.optional(
      v.union(
        v.literal("two-column"),
        v.literal("one-third"),
        v.literal("single"),
      ),
    ),
    submissionPageTitle: v.optional(v.union(v.string(), v.null())),
    submissionPageDescription: v.optional(v.union(v.string(), v.null())),
    submissionPageLinks: v.optional(
      v.array(
        v.object({
          label: v.string(),
          url: v.string(),
        }),
      ),
    ),
    submissionFormTitle: v.optional(v.union(v.string(), v.null())),
    submissionFormSubtitle: v.optional(v.union(v.string(), v.null())),
    submissionFormRequiredTagId: v.optional(v.union(v.id("tags"), v.null())),
    submissionFormRequiredTagVisible: v.optional(v.boolean()),
    submissionFieldRequirements: v.optional(
      submissionFieldRequirementsValidator,
    ),
    submissionFieldVisibility: v.optional(submissionFieldVisibilityValidator),
    submissionCustomQuestions: v.optional(submissionCustomQuestionsValidator),
    submissionDynamicFieldOverrides: v.optional(
      submissionDynamicFieldOverridesValidator,
    ),
    judgesPerSubmission: v.optional(v.number()),
    // Human judging score scale: 5 or 10 (unset = 10)
    scoreScale: v.optional(v.union(v.literal(5), v.literal(10))),
    // Multi-tag + date range auto-include config (nullable to clear)
    autoIncludeTagIds: v.optional(v.union(v.array(v.id("tags")), v.null())),
    autoIncludeMatchMode: v.optional(
      v.union(v.literal("any"), v.literal("all")),
    ),
    autoIncludeStartDate: v.optional(v.union(v.number(), v.null())),
    autoIncludeEndDate: v.optional(v.union(v.number(), v.null())),
    // Event window for the build-timeline check (builtDuringEvent)
    startDate: v.optional(v.union(v.number(), v.null())),
    endDate: v.optional(v.union(v.number(), v.null())),
    // AI Judge settings
    aiJudgeEnabled: v.optional(v.boolean()),
    aiResultsIsPublic: v.optional(v.boolean()),
    aiResultsPassword: v.optional(v.union(v.string(), v.null())),
    // Organizer emails for new-submission alerts (null clears the list)
    notificationEmails: v.optional(v.union(v.array(v.string()), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");

    // Snapshot the existing required tag so we can detect a change below.
    const existingGroup = await ctx.db.get(args.groupId);
    const previousRequiredTagId = existingGroup?.submissionFormRequiredTagId;

    const {
      groupId,
      judgePassword,
      submissionPagePassword,
      resultsPassword,
      aiResultsPassword,
      judgesPerSubmission,
      autoIncludeTagIds,
      autoIncludeMatchMode,
      autoIncludeStartDate,
      autoIncludeEndDate,
      startDate,
      endDate,
      ...updates
    } = args;

    // Validate custom submission form config before saving
    if (args.submissionCustomQuestions !== undefined) {
      const seenKeys = new Set<string>();
      for (const question of args.submissionCustomQuestions) {
        if (!question.key.trim() || !question.label.trim()) {
          throw new Error("Custom questions need a label");
        }
        if (seenKeys.has(question.key)) {
          throw new Error(`Duplicate custom question key: ${question.key}`);
        }
        seenKeys.add(question.key);
        if (
          (question.fieldType === "radio" ||
            question.fieldType === "multiselect" ||
            question.fieldType === "select") &&
          (question.options ?? []).filter((o) => o.trim()).length < 2
        ) {
          throw new Error(
            `Custom question "${question.label}" needs at least 2 options`,
          );
        }
      }
    }
    if (args.submissionFieldVisibility?.title === false) {
      throw new Error(
        "The title field cannot be hidden; submissions need a title for judging",
      );
    }

    // Build finalUpdates object properly, handling nulls explicitly
    const finalUpdates: any = {};

    // Copy non-password fields. Null means "clear this optional field";
    // patching undefined unsets it, while null would fail schema validation.
    Object.keys(updates).forEach((key) => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        finalUpdates[key] = value === null ? undefined : value;
      }
    });

    // Clamp judgesPerSubmission to >= 1
    if (judgesPerSubmission !== undefined) {
      finalUpdates.judgesPerSubmission = Math.max(
        1,
        Math.round(judgesPerSubmission),
      );
    }

    // Auto-include config: null clears (store undefined), otherwise set the value.
    if (autoIncludeTagIds !== undefined) {
      finalUpdates.autoIncludeTagIds = autoIncludeTagIds ?? undefined;
    }
    if (autoIncludeMatchMode !== undefined) {
      finalUpdates.autoIncludeMatchMode = autoIncludeMatchMode;
    }
    if (autoIncludeStartDate !== undefined) {
      finalUpdates.autoIncludeStartDate = autoIncludeStartDate ?? undefined;
    }
    if (autoIncludeEndDate !== undefined) {
      finalUpdates.autoIncludeEndDate = autoIncludeEndDate ?? undefined;
    }

    // Event window: null clears (store undefined), otherwise set the value
    if (startDate !== undefined) {
      finalUpdates.startDate = startDate ?? undefined;
    }
    if (endDate !== undefined) {
      finalUpdates.endDate = endDate ?? undefined;
    }

    // Hash passwords if provided, set undefined if null to clear
    if (judgePassword !== undefined) {
      finalUpdates.judgePassword = judgePassword
        ? await hashPassword(judgePassword)
        : undefined;
    }
    if (submissionPagePassword !== undefined) {
      finalUpdates.submissionPagePassword = submissionPagePassword
        ? await hashPassword(submissionPagePassword)
        : undefined;
    }
    if (resultsPassword !== undefined) {
      finalUpdates.resultsPassword = resultsPassword
        ? await hashPassword(resultsPassword)
        : undefined;
    }
    if (aiResultsPassword !== undefined) {
      finalUpdates.aiResultsPassword = aiResultsPassword
        ? await hashPassword(aiResultsPassword)
        : undefined;
    }

    await ctx.db.patch(groupId, finalUpdates);

    await logActivity(ctx, {
      category: "judging",
      action: "judgingGroup.updated",
      message: `Updated judging group "${existingGroup?.name ?? "unknown"}"`,
      targetType: "judgingGroup",
      targetId: groupId,
      targetLabel: existingGroup?.name,
      groupId,
      metadata: { fields: Object.keys(finalUpdates) },
    });

    // If the required tag was set (or changed to a new tag), backfill any
    // existing stories carrying that tag so they are immediately judgeable and
    // counted, matching the custom submission page behavior.
    const newRequiredTagId =
      args.submissionFormRequiredTagId === undefined
        ? previousRequiredTagId
        : (args.submissionFormRequiredTagId ?? undefined);

    if (newRequiredTagId && newRequiredTagId !== previousRequiredTagId) {
      const addedBy = await getAuthenticatedUserId(ctx);
      const stories = await ctx.db.query("stories").collect();
      for (const story of stories) {
        if (!isStoryValidForJudging(story)) continue;
        if (!(story.tagIds || []).includes(newRequiredTagId)) continue;
        await ensureStoryInGroup(ctx, groupId, story._id, addedBy);
      }
    }

    // If the multi-tag + date range auto-include config was part of this update
    // and tags are configured, backfill matching stories immediately so the
    // group is populated without a separate sync click.
    const autoIncludeTouched =
      autoIncludeTagIds !== undefined ||
      autoIncludeMatchMode !== undefined ||
      autoIncludeStartDate !== undefined ||
      autoIncludeEndDate !== undefined;

    if (autoIncludeTouched) {
      const updatedGroup = await ctx.db.get(groupId);
      if (
        updatedGroup &&
        updatedGroup.autoIncludeTagIds &&
        updatedGroup.autoIncludeTagIds.length > 0
      ) {
        const addedBy = await getAuthenticatedUserId(ctx);
        const tagIds = updatedGroup.autoIncludeTagIds;
        const matchMode = updatedGroup.autoIncludeMatchMode ?? "any";
        const startDate = updatedGroup.autoIncludeStartDate;
        const endDate = updatedGroup.autoIncludeEndDate;

        const stories = await ctx.db.query("stories").collect();
        for (const story of stories) {
          if (!isStoryValidForJudging(story)) continue;
          const storyTagIds = story.tagIds || [];
          const tagMatches =
            matchMode === "all"
              ? tagIds.every((tagId) => storyTagIds.includes(tagId))
              : tagIds.some((tagId) => storyTagIds.includes(tagId));
          if (!tagMatches) continue;
          if (startDate !== undefined && story._creationTime < startDate)
            continue;
          if (endDate !== undefined && story._creationTime > endDate) continue;
          await ensureStoryInGroup(ctx, groupId, story._id, addedBy);
        }
      }
    }

    return null;
  },
});

/**
 * Delete a judging group and all associated data
 */
export const deleteGroup = mutation({
  args: { groupId: v.id("judgingGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.delete");

    // Snapshot the name for the activity log before rows disappear
    const groupToDelete = await ctx.db.get(args.groupId);

    // Delete all associated data in order
    // 1. Judge scores
    const scores = await ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const score of scores) {
      await ctx.db.delete(score._id);
    }

    // 2. Judges
    const judges = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const judge of judges) {
      await ctx.db.delete(judge._id);
    }

    // 3. Group submissions
    const submissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const submission of submissions) {
      await ctx.db.delete(submission._id);
    }

    // 4. Criteria
    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const criterion of criteria) {
      await ctx.db.delete(criterion._id);
    }

    // 5. Multi-judge completion records
    const completions = await ctx.db
      .query("submissionJudgeCompletions")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const completion of completions) {
      await ctx.db.delete(completion._id);
    }

    // 6. AI judge results
    const aiResults = await ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const aiResult of aiResults) {
      await ctx.db.delete(aiResult._id);
    }

    // 7. Finally, the group itself
    await ctx.db.delete(args.groupId);

    await logActivity(ctx, {
      category: "judging",
      action: "judgingGroup.deleted",
      message: `Deleted judging group "${groupToDelete?.name ?? "unknown"}" and all associated data`,
      targetType: "judgingGroup",
      targetLabel: groupToDelete?.name,
    });

    return null;
  },
});

/**
 * Get a judging group by slug (admin only)
 */
export const getGroupBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judgingGroups"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isPublic: v.boolean(),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      judgesPerSubmission: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "judging.view");

    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!group) {
      return null;
    }

    // Scoped users only see groups in their grant
    const allowedIds = await getAllowedJudgingGroupIds(ctx);
    if (allowedIds !== "all" && !allowedIds.includes(group._id)) {
      return null;
    }

    return {
      _id: group._id,
      _creationTime: group._creationTime,
      name: group.name,
      slug: group.slug,
      description: group.description,
      isPublic: group.isPublic,
      isActive: group.isActive,
      createdBy: group.createdBy,
      judgesPerSubmission: group.judgesPerSubmission ?? 1,
    };
  },
});

/**
 * Get a judging group with all details (admin only)
 */
export const getGroupWithDetails = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judgingGroups"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isPublic: v.boolean(),
      judgePassword: v.optional(v.string()),
      submissionPagePassword: v.optional(v.string()),
      resultsIsPublic: v.optional(v.boolean()),
      resultsPassword: v.optional(v.string()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      hasJudgePassword: v.boolean(),
      hasSubmissionPagePassword: v.boolean(),
      hasCustomSubmissionPage: v.optional(v.boolean()),
      submissionPageImageId: v.optional(v.id("_storage")),
      submissionPageImageSize: v.optional(v.number()),
      submissionPageImageAspect: v.optional(
        v.union(v.literal("square"), v.literal("wide")),
      ),
      submissionPageLayout: v.optional(
        v.union(
          v.literal("two-column"),
          v.literal("one-third"),
          v.literal("single"),
        ),
      ),
      submissionPageTitle: v.optional(v.string()),
      submissionPageDescription: v.optional(v.string()),
      submissionPageLinks: v.optional(
        v.array(
          v.object({
            label: v.string(),
            url: v.string(),
          }),
        ),
      ),
      submissionFormTitle: v.optional(v.string()),
      submissionFormSubtitle: v.optional(v.string()),
      submissionFormRequiredTagId: v.optional(v.id("tags")),
      submissionFormRequiredTagVisible: v.optional(v.boolean()),
      submissionFieldRequirements: v.optional(
        submissionFieldRequirementsValidator,
      ),
      submissionFieldVisibility: v.optional(submissionFieldVisibilityValidator),
      submissionCustomQuestions: v.optional(submissionCustomQuestionsValidator),
      submissionDynamicFieldOverrides: v.optional(
        submissionDynamicFieldOverridesValidator,
      ),
      autoIncludeTagIds: v.optional(v.array(v.id("tags"))),
      autoIncludeMatchMode: v.optional(
        v.union(v.literal("any"), v.literal("all")),
      ),
      autoIncludeStartDate: v.optional(v.number()),
      autoIncludeEndDate: v.optional(v.number()),
      judgesPerSubmission: v.number(),
      scoreScale: v.number(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      aiJudgeEnabled: v.optional(v.boolean()),
      aiResultsIsPublic: v.optional(v.boolean()),
      hasAiResultsPassword: v.boolean(),
      aiResultsPassword: v.optional(v.string()),
      aiRubricWeights: v.optional(
        v.array(v.object({ key: v.string(), weight: v.number() })),
      ),
      aiFrontendWeights: v.optional(
        v.array(v.object({ key: v.string(), weight: v.number() })),
      ),
      aiCustomCriteria: v.optional(
        v.array(
          v.object({
            key: v.string(),
            label: v.string(),
            description: v.string(),
          }),
        ),
      ),
      aiDisabledCriteria: v.optional(v.array(v.string())),
      hasCustomAiPrompt: v.boolean(),
      agentScoresAdvisory: v.optional(v.boolean()),
      agentKeysEnabled: v.optional(v.boolean()),
      notificationEmails: v.optional(v.array(v.string())),
      criteria: v.array(
        v.object({
          _id: v.id("judgingCriteria"),
          _creationTime: v.number(),
          groupId: v.id("judgingGroups"),
          question: v.string(),
          description: v.optional(v.string()),
          weight: v.optional(v.number()),
          order: v.number(),
        }),
      ),
      submissionCount: v.number(),
      judgeCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "judging.view");

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return null;
    }

    // Scoped users only see groups in their grant
    const allowedIds = await getAllowedJudgingGroupIds(ctx);
    if (allowedIds !== "all" && !allowedIds.includes(group._id)) {
      return null;
    }

    const criteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .order("asc")
      .collect();

    const allSubmissions = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Filter out invalid stories (deleted, hidden, archived, rejected)
    const validSubmissions = (
      await Promise.all(
        allSubmissions.map(async (submission) => {
          const story = await ctx.db.get(submission.storyId);
          if (!isStoryValidForJudging(story)) {
            return null;
          }
          return submission;
        }),
      )
    ).filter(
      (submission): submission is NonNullable<typeof submission> =>
        submission !== null,
    );

    const submissionCount = validSubmissions.length;

    const judgeCount = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect()
      .then((judges) => judges.length);

    return {
      _id: group._id,
      _creationTime: group._creationTime,
      name: group.name,
      slug: group.slug,
      description: group.description,
      isPublic: group.isPublic,
      judgePassword: group.judgePassword,
      submissionPagePassword: group.submissionPagePassword,
      resultsIsPublic: group.resultsIsPublic,
      resultsPassword: group.resultsPassword,
      isActive: group.isActive,
      createdBy: group.createdBy,
      hasJudgePassword: !!(group.judgePassword || (group as any).password), // Backward compatibility
      hasSubmissionPagePassword: !!group.submissionPagePassword,
      hasCustomSubmissionPage: group.hasCustomSubmissionPage,
      submissionPageImageId: group.submissionPageImageId,
      submissionPageImageSize: group.submissionPageImageSize,
      submissionPageImageAspect: group.submissionPageImageAspect,
      submissionPageLayout: group.submissionPageLayout,
      submissionPageTitle: group.submissionPageTitle,
      submissionPageDescription: group.submissionPageDescription,
      submissionPageLinks: group.submissionPageLinks,
      submissionFormTitle: group.submissionFormTitle,
      submissionFormSubtitle: group.submissionFormSubtitle,
      submissionFormRequiredTagId: group.submissionFormRequiredTagId,
      submissionFormRequiredTagVisible: group.submissionFormRequiredTagVisible,
      submissionFieldRequirements: group.submissionFieldRequirements,
      submissionFieldVisibility: group.submissionFieldVisibility,
      submissionCustomQuestions: group.submissionCustomQuestions,
      submissionDynamicFieldOverrides: group.submissionDynamicFieldOverrides,
      autoIncludeTagIds: group.autoIncludeTagIds,
      autoIncludeMatchMode: group.autoIncludeMatchMode,
      autoIncludeStartDate: group.autoIncludeStartDate,
      autoIncludeEndDate: group.autoIncludeEndDate,
      judgesPerSubmission: group.judgesPerSubmission ?? 1,
      scoreScale: group.scoreScale ?? 10,
      startDate: group.startDate,
      endDate: group.endDate,
      aiJudgeEnabled: group.aiJudgeEnabled,
      aiResultsIsPublic: group.aiResultsIsPublic,
      hasAiResultsPassword: !!group.aiResultsPassword,
      aiResultsPassword: group.aiResultsPassword,
      aiRubricWeights: group.aiRubricWeights,
      aiFrontendWeights: group.aiFrontendWeights,
      aiCustomCriteria: group.aiCustomCriteria,
      aiDisabledCriteria: group.aiDisabledCriteria,
      hasCustomAiPrompt: !!group.aiJudgeSystemPrompt,
      agentScoresAdvisory: group.agentScoresAdvisory,
      agentKeysEnabled: group.agentKeysEnabled,
      notificationEmails: group.notificationEmails,
      criteria,
      submissionCount,
      judgeCount,
    };
  },
});

// --- Public Functions ---

/**
 * Get public group details by slug (for judge access)
 */
export const getPublicGroup = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isPublic: v.boolean(),
      isActive: v.boolean(),
      hasJudgePassword: v.boolean(),
      judgesPerSubmission: v.number(),
      scoreScale: v.number(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!group) {
      return null;
    }

    // If group is inactive, only allow access for admins
    if (!group.isActive) {
      const userIsAdmin = await isUserAdmin(ctx);
      if (!userIsAdmin) {
        return null;
      }
    }

    return {
      _id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      isPublic: group.isPublic,
      isActive: group.isActive,
      hasJudgePassword: !!(group.judgePassword || (group as any).password),
      judgesPerSubmission: group.judgesPerSubmission ?? 1,
      scoreScale: group.scoreScale ?? 10,
      startDate: group.startDate,
      endDate: group.endDate,
    };
  },
});

/**
 * Validate password for judge access to judging interface
 */
export const validatePassword = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    // Backward compatibility: check both new judgePassword and old password fields
    const storedPassword = group?.judgePassword || (group as any)?.password;
    if (!group || !storedPassword) {
      return false;
    }

    return await verifyPassword(args.password, storedPassword);
  },
});

/**
 * Validate password for submission page access
 */
export const validateSubmissionPagePassword = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.submissionPagePassword) {
      return false;
    }

    return await verifyPassword(args.password, group.submissionPagePassword);
  },
});

/**
 * Validate password for private results page access (public endpoint)
 */
export const validateResultsPassword = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.resultsPassword) {
      return false;
    }

    return await verifyPassword(args.password, group.resultsPassword);
  },
});

/**
 * Get public group info for results page (public endpoint)
 */
export const getPublicGroupForResults = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      resultsIsPublic: v.optional(v.boolean()),
      isActive: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!group) {
      return null;
    }

    // Return basic group info - password protection will be handled separately
    return {
      _id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      resultsIsPublic: group.resultsIsPublic ?? false,
      isActive: group.isActive,
    };
  },
});

/**
 * Get submission page data by slug (public endpoint)
 */
export const getSubmissionPage = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isPublic: v.boolean(),
      hasSubmissionPagePassword: v.boolean(),
      hasCustomSubmissionPage: v.optional(v.boolean()),
      submissionPageImageUrl: v.optional(v.string()),
      submissionPageImageSize: v.optional(v.number()),
      submissionPageImageAspect: v.optional(
        v.union(v.literal("square"), v.literal("wide")),
      ),
      submissionPageLayout: v.optional(
        v.union(
          v.literal("two-column"),
          v.literal("one-third"),
          v.literal("single"),
        ),
      ),
      submissionPageTitle: v.optional(v.string()),
      submissionPageDescription: v.optional(v.string()),
      submissionPageLinks: v.optional(
        v.array(
          v.object({
            label: v.string(),
            url: v.string(),
          }),
        ),
      ),
      submissionFormTitle: v.optional(v.string()),
      submissionFormSubtitle: v.optional(v.string()),
      submissionFormRequiredTagId: v.optional(v.id("tags")),
      submissionFormRequiredTagVisible: v.optional(v.boolean()),
      submissionFieldRequirements: v.optional(
        submissionFieldRequirementsValidator,
      ),
      submissionFieldVisibility: v.optional(submissionFieldVisibilityValidator),
      submissionCustomQuestions: v.optional(submissionCustomQuestionsValidator),
      submissionDynamicFieldOverrides: v.optional(
        submissionDynamicFieldOverridesValidator,
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!group) {
      return null;
    }

    // Only return submission page if it's enabled
    if (!group.hasCustomSubmissionPage) {
      return null;
    }

    // Get image URL if image is set
    let submissionPageImageUrl: string | undefined = undefined;
    if (group.submissionPageImageId) {
      submissionPageImageUrl =
        (await ctx.storage.getUrl(group.submissionPageImageId)) ?? undefined;
    }

    return {
      _id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      isPublic: group.isPublic,
      hasSubmissionPagePassword: !!group.submissionPagePassword,
      hasCustomSubmissionPage: group.hasCustomSubmissionPage,
      submissionPageImageUrl,
      submissionPageImageSize: group.submissionPageImageSize,
      submissionPageImageAspect: group.submissionPageImageAspect,
      submissionPageLayout: group.submissionPageLayout || "two-column", // Default to two-column
      submissionPageTitle: group.submissionPageTitle,
      submissionPageDescription: group.submissionPageDescription,
      submissionPageLinks: group.submissionPageLinks,
      submissionFormTitle: group.submissionFormTitle,
      submissionFormSubtitle: group.submissionFormSubtitle,
      submissionFormRequiredTagId: group.submissionFormRequiredTagId,
      submissionFormRequiredTagVisible: group.submissionFormRequiredTagVisible,
      submissionFieldRequirements: group.submissionFieldRequirements,
      submissionFieldVisibility: group.submissionFieldVisibility,
      submissionCustomQuestions: group.submissionCustomQuestions,
      submissionDynamicFieldOverrides: group.submissionDynamicFieldOverrides,
    };
  },
});

/**
 * Get submission page metadata for OpenGraph/social media sharing
 * Internal query for HTTP action use only
 */
export const getSubmissionPageMetadata = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      title: v.string(),
      description: v.string(),
      imageUrl: v.union(v.string(), v.null()),
      slug: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (!group || !group.hasCustomSubmissionPage) {
      return null;
    }

    // Resolve image URL for OpenGraph
    const imageUrl = group.submissionPageImageId
      ? await ctx.storage.getUrl(group.submissionPageImageId)
      : null;

    return {
      title: group.submissionPageTitle || group.name,
      description:
        group.submissionPageDescription ||
        group.description ||
        `Submit your app to ${group.name}`,
      imageUrl,
      slug: group.slug,
    };
  },
});

/**
 * Verify results password for a judging group
 */
export const verifyResultsPassword = query({
  args: {
    groupId: v.id("judgingGroups"),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group || !group.resultsPassword) {
      return false;
    }

    return await verifyPassword(args.password, group.resultsPassword);
  },
});

/**
 * Get public results information for a judging group (metadata only, no scores)
 * Used to show if results are available and what password protection exists
 */
export const getPublicResultsInfo = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.union(
    v.object({
      _id: v.id("judgingGroups"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isResultsPublic: v.boolean(),
      hasResultsPassword: v.boolean(),
      isAdmin: v.boolean(), // Whether current user is admin (can bypass password)
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      return null;
    }

    // Check if user is admin
    const isAdmin = await isUserAdmin(ctx);

    return {
      _id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      isResultsPublic: group.resultsIsPublic ?? false,
      hasResultsPassword: !!group.resultsPassword,
      isAdmin,
    };
  },
});
