import { query, mutation } from "./_generated/server";
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
      resultsIsPublic: v.optional(v.boolean()), // Added
      isActive: v.boolean(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      createdBy: v.id("users"),
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
        const submissionCount = await ctx.db
          .query("judgingGroupSubmissions")
          .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
          .collect()
          .then((submissions) => submissions.length);

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
          startDate: group.startDate,
          endDate: group.endDate,
          createdBy: group.createdBy,
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
    password: v.optional(v.string()),
    resultsIsPublic: v.optional(v.boolean()),
    resultsPassword: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
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
    const hashedPassword = args.password
      ? hashPassword(args.password)
      : undefined;
    const hashedResultsPassword = args.resultsPassword
      ? hashPassword(args.resultsPassword)
      : undefined;

    return await ctx.db.insert("judgingGroups", {
      name: args.name,
      slug,
      description: args.description,
      isPublic: args.isPublic,
      password: hashedPassword,
      resultsIsPublic: args.resultsIsPublic ?? false, // Default to private
      resultsPassword: hashedResultsPassword,
      isActive: args.isActive ?? true,
      startDate: args.startDate,
      endDate: args.endDate,
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
    password: v.optional(v.string()),
    resultsIsPublic: v.optional(v.boolean()),
    resultsPassword: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const { groupId, password, resultsPassword, ...updates } = args;

    // Hash passwords if provided
    const finalUpdates: any = { ...updates };
    if (password !== undefined) {
      finalUpdates.password = password ? hashPassword(password) : undefined;
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
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
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
      startDate: group.startDate,
      endDate: group.endDate,
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
      password: v.optional(v.string()),
      resultsIsPublic: v.optional(v.boolean()),
      resultsPassword: v.optional(v.string()),
      isActive: v.boolean(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      createdBy: v.id("users"),
      hasPassword: v.boolean(),
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

    const submissionCount = await ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect()
      .then((submissions) => submissions.length);

    const judgeCount = await ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect()
      .then((judges) => judges.length);

    return {
      ...group,
      hasPassword: !!group.password,
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
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      hasPassword: v.boolean(),
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
      startDate: group.startDate,
      endDate: group.endDate,
      hasPassword: !!group.password,
    };
  },
});

/**
 * Validate password for private group access
 */
export const validatePassword = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    password: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.password) {
      return false;
    }

    return verifyPassword(args.password, group.password);
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
