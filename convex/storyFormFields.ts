import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { requireAdminRole } from "./users";

// Query to get all form fields ordered by display order
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("storyFormFields"),
      _creationTime: v.number(),
      key: v.string(),
      label: v.string(),
      placeholder: v.string(),
      isEnabled: v.boolean(),
      isRequired: v.boolean(),
      order: v.number(),
      fieldType: v.union(v.literal("url"), v.literal("text"), v.literal("email")),
      description: v.optional(v.string()),
      storyPropertyName: v.string(),
    })
  ),
  handler: async (ctx) => {
    const fields = await ctx.db.query("storyFormFields").withIndex("by_order").collect();

    return fields.sort((a, b) => a.order - b.order);
  },
});

// Query to get only enabled form fields for the story form
export const listEnabled = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("storyFormFields"),
      _creationTime: v.number(),
      key: v.string(),
      label: v.string(),
      placeholder: v.string(),
      isEnabled: v.boolean(),
      isRequired: v.boolean(),
      order: v.number(),
      fieldType: v.union(v.literal("url"), v.literal("text"), v.literal("email")),
      description: v.optional(v.string()),
      storyPropertyName: v.string(),
    })
  ),
  handler: async (ctx) => {
    const fields = await ctx.db
      .query("storyFormFields")
      .withIndex("by_enabled", (q) => q.eq("isEnabled", true))
      .collect();

    return fields.sort((a, b) => a.order - b.order);
  },
});

// Admin query to get all form fields
export const listAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("storyFormFields"),
      _creationTime: v.number(),
      key: v.string(),
      label: v.string(),
      placeholder: v.string(),
      isEnabled: v.boolean(),
      isRequired: v.boolean(),
      order: v.number(),
      fieldType: v.union(v.literal("url"), v.literal("text"), v.literal("email")),
      description: v.optional(v.string()),
      storyPropertyName: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const fields = await ctx.db.query("storyFormFields").withIndex("by_order").collect();

    return fields.sort((a, b) => a.order - b.order);
  },
});

// Create a new form field
export const create = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    placeholder: v.string(),
    isEnabled: v.boolean(),
    isRequired: v.boolean(),
    order: v.number(),
    fieldType: v.union(v.literal("url"), v.literal("text"), v.literal("email")),
    description: v.optional(v.string()),
    storyPropertyName: v.string(),
  },
  returns: v.id("storyFormFields"),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Check if key already exists
    const existing = await ctx.db
      .query("storyFormFields")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      throw new Error(`Form field with key "${args.key}" already exists`);
    }

    return await ctx.db.insert("storyFormFields", args);
  },
});

// Update a form field
export const update = mutation({
  args: {
    fieldId: v.id("storyFormFields"),
    key: v.optional(v.string()),
    label: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
    isRequired: v.optional(v.boolean()),
    order: v.optional(v.number()),
    fieldType: v.optional(v.union(v.literal("url"), v.literal("text"), v.literal("email"))),
    description: v.optional(v.string()),
    storyPropertyName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const { fieldId, ...updates } = args;

    // If updating key, check for conflicts
    if (updates.key) {
      const keyToCheck = updates.key;
      const existing = await ctx.db
        .query("storyFormFields")
        .withIndex("by_key", (q) => q.eq("key", keyToCheck))
        .filter((q) => q.neq(q.field("_id"), fieldId))
        .first();

      if (existing) {
        throw new Error(`Form field with key "${keyToCheck}" already exists`);
      }
    }

    // Only update fields that were provided
    const updateData: Partial<Doc<"storyFormFields">> = {};
    if (updates.key !== undefined) updateData.key = updates.key;
    if (updates.label !== undefined) updateData.label = updates.label;
    if (updates.placeholder !== undefined) updateData.placeholder = updates.placeholder;
    if (updates.isEnabled !== undefined) updateData.isEnabled = updates.isEnabled;
    if (updates.isRequired !== undefined) updateData.isRequired = updates.isRequired;
    if (updates.order !== undefined) updateData.order = updates.order;
    if (updates.fieldType !== undefined) updateData.fieldType = updates.fieldType;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.storyPropertyName !== undefined)
      updateData.storyPropertyName = updates.storyPropertyName;

    await ctx.db.patch(fieldId, updateData);
    return null;
  },
});

// Delete a form field
export const deleteField = mutation({
  args: {
    fieldId: v.id("storyFormFields"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.delete(args.fieldId);
    return null;
  },
});

// Reorder form fields
export const reorder = mutation({
  args: {
    fieldIds: v.array(v.id("storyFormFields")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // Update order for each field
    for (let i = 0; i < args.fieldIds.length; i++) {
      await ctx.db.patch(args.fieldIds[i], { order: i });
    }

    return null;
  },
});

// Internal mutation to initialize default form fields
export const initializeDefaultFields = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Check if any form fields exist
    const existingFields = await ctx.db.query("storyFormFields").take(1);
    if (existingFields.length > 0) {
      return null; // Already initialized
    }

    // Create default form fields
    const defaultFields = [
      {
        key: "linkedinUrl",
        label: "LinkedIn Profile or LinkedIn Announcement Post URL (Optional)",
        placeholder: "https://linkedin.com/post/...",
        isEnabled: true,
        isRequired: false,
        order: 0,
        fieldType: "url" as const,
        description: "LinkedIn profile or announcement post URL",
        storyPropertyName: "linkedinUrl",
      },
      {
        key: "twitterUrl",
        label: "X (Twitter) or Bluesky Profile or Announcement Post URL (Optional)",
        placeholder: "https://twitter.com/...",
        isEnabled: true,
        isRequired: false,
        order: 1,
        fieldType: "url" as const,
        description: "X (Twitter) or Bluesky profile or announcement post URL",
        storyPropertyName: "twitterUrl",
      },
      {
        key: "githubUrl",
        label: "GitHub Repo URL (Optional)",
        placeholder: "https://github.com/...",
        isEnabled: true,
        isRequired: false,
        order: 2,
        fieldType: "url" as const,
        description: "GitHub repository URL",
        storyPropertyName: "githubUrl",
      },
      {
        key: "chefAppUrl",
        label: "Chef deployment convex.app link (Optional)",
        placeholder: "https://chef.app/...",
        isEnabled: true,
        isRequired: false,
        order: 3,
        fieldType: "url" as const,
        description: "Chef deployment convex.app link",
        storyPropertyName: "chefAppUrl",
      },
      {
        key: "chefShowUrl",
        label: "Convexchef.show project link (Optional)",
        placeholder: "https://chef.show/...",
        isEnabled: true,
        isRequired: false,
        order: 4,
        fieldType: "url" as const,
        description: "Convexchef.show project link",
        storyPropertyName: "chefShowUrl",
      },
    ];

    for (const field of defaultFields) {
      await ctx.db.insert("storyFormFields", field);
    }

    return null;
  },
});
