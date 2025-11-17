import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole, isUserAdmin } from "./users";

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
function isStoryValidForJudging(story: Doc<"stories"> | null): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isHidden === true) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  return true;
}

// Simple password hashing (for basic protection)
// In production, consider using a more robust solution
function hashPassword(password: string): string {
  // Use TextEncoder for browser-compatible base64 encoding
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  return btoa(String.fromCharCode(...data));
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
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
      submissionCount: v.number(),
      judgeCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    const groups = await ctx.db.query("judgingGroups").order("desc").collect();

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
        ).filter((submission): submission is NonNullable<typeof submission> => submission !== null);

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
  },
  returns: v.id("judgingGroups"),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

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
      ? hashPassword(args.judgePassword)
      : undefined;
    const hashedSubmissionPassword = args.submissionPagePassword
      ? hashPassword(args.submissionPagePassword)
      : undefined;
    const hashedResultsPassword = args.resultsPassword
      ? hashPassword(args.resultsPassword)
      : undefined;

    return await ctx.db.insert("judgingGroups", {
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
    });
  },
});

/**
 * Update a judging group
 */
export const updateGroup = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    judgePassword: v.optional(v.string()),
    submissionPagePassword: v.optional(v.string()),
    resultsIsPublic: v.optional(v.boolean()),
    resultsPassword: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    hasCustomSubmissionPage: v.optional(v.boolean()),
    submissionPageImageId: v.optional(v.id("_storage")),
    submissionPageImageSize: v.optional(v.number()),
    submissionPageLayout: v.optional(
      v.union(v.literal("two-column"), v.literal("one-third")),
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const { groupId, judgePassword, submissionPagePassword, resultsPassword, ...updates } = args;

    // Hash passwords if provided
    const finalUpdates: any = { ...updates };
    if (judgePassword !== undefined) {
      finalUpdates.judgePassword = judgePassword ? hashPassword(judgePassword) : undefined;
    }
    if (submissionPagePassword !== undefined) {
      finalUpdates.submissionPagePassword = submissionPagePassword
        ? hashPassword(submissionPagePassword)
        : undefined;
    }
    if (resultsPassword !== undefined) {
      finalUpdates.resultsPassword = resultsPassword
        ? hashPassword(resultsPassword)
        : undefined;
    }

    await ctx.db.patch(groupId, finalUpdates);
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
    await requireAdminRole(ctx);

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

    // 5. Finally, the group itself
    await ctx.db.delete(args.groupId);

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
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const group = await ctx.db
      .query("judgingGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!group) {
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
      submissionPageLayout: v.optional(v.union(v.literal("two-column"), v.literal("one-third"))),
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
    await requireAdminRole(ctx);

    const group = await ctx.db.get(args.groupId);
    if (!group) {
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
    ).filter((submission): submission is NonNullable<typeof submission> => submission !== null);

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
      submissionPageLayout: group.submissionPageLayout,
      submissionPageTitle: group.submissionPageTitle,
      submissionPageDescription: group.submissionPageDescription,
      submissionPageLinks: group.submissionPageLinks,
      submissionFormTitle: group.submissionFormTitle,
      submissionFormSubtitle: group.submissionFormSubtitle,
      submissionFormRequiredTagId: group.submissionFormRequiredTagId,
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
        return null; // Return null to show 404 for non-admin users
      }
    }

    // Return basic info without sensitive data
    return {
      _id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      isPublic: group.isPublic,
      isActive: group.isActive,
      hasJudgePassword: !!(group.judgePassword || (group as any).password), // Backward compatibility
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

    return verifyPassword(args.password, storedPassword);
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

    return verifyPassword(args.password, group.submissionPagePassword);
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

    return verifyPassword(args.password, group.resultsPassword);
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
      submissionPageLayout: v.optional(
        v.union(v.literal("two-column"), v.literal("one-third")),
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
      submissionPageLayout: group.submissionPageLayout || "two-column", // Default to two-column
      submissionPageTitle: group.submissionPageTitle,
      submissionPageDescription: group.submissionPageDescription,
      submissionPageLinks: group.submissionPageLinks,
      submissionFormTitle: group.submissionFormTitle,
      submissionFormSubtitle: group.submissionFormSubtitle,
      submissionFormRequiredTagId: group.submissionFormRequiredTagId,
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
