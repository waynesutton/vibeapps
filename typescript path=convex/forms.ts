import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { Doc, Id } from "./_generated/dataModel";

export const listForms = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("forms").order("desc").collect();
  },
});

export const getFormWithFields = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // Or requireAuth if public users can view structure but not results
    const form = await ctx.db.get(args.formId);
    if (!form) return null;
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", args.formId))
      .order("asc") // Assuming 'order' field dictates sequence
      .collect();
    return { ...form, fields };
  },
});

export const createForm = mutation({
  args: {
    title: v.string(),
    slug: v.string(), // Ensure slug is unique
    description: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Add slug uniqueness check if necessary
    return await ctx.db.insert("forms", args);
  },
});

export const updateForm = mutation({
  args: {
    formId: v.id("forms"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { formId, ...updates } = args;
    await ctx.db.patch(formId, updates);
  },
});

export const saveFields = mutation({
  args: {
    formId: v.id("forms"),
    fields: v.array(
      v.object({
        _id: v.optional(v.id("formFields")), // For existing fields
        localId: v.optional(v.string()), // For client-side tracking, not stored
        label: v.string(),
        fieldType: v.string(),
        options: v.optional(v.array(v.string())),
        required: v.boolean(),
        placeholder: v.optional(v.string()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Complex logic: delete old fields not in new set, update existing, insert new
    const existingFields = await ctx.db
        .query("formFields")
        .withIndex("by_formId_order", q => q.eq("formId", args.formId))
        .collect();

    const fieldsToDelete = existingFields.filter(ef => !args.fields.find(f => f._id === ef._id));
    for (const field of fieldsToDelete) {
        await ctx.db.delete(field._id);
    }

    for (const fieldData of args.fields) {
      const { localId, ...dbData } = fieldData; // Don't save localId
      if (dbData._id) { // Existing field
        await ctx.db.replace(dbData._id, { formId: args.formId, ...dbData });
      } else { // New field
        await ctx.db.insert("formFields", { formId: args.formId, ...dbData });
      }
    }
  },
});

export const deleteForm = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Also delete related formFields and formSubmissions
    const fields = await ctx.db.query("formFields").withIndex("by_formId_order", q => q.eq("formId", args.formId)).collect();
    for (const field of fields) {
        await ctx.db.delete(field._id);
    }
    const submissions = await ctx.db.query("formSubmissions").withIndex("by_formId", q => q.eq("formId", args.formId)).collect();
    for (const submission of submissions) {
        await ctx.db.delete(submission._id);
    }
    await ctx.db.delete(args.formId);
  },
});

export const listSubmissions = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("formSubmissions")
      .withIndex("by_formId", (q) => q.eq("formId", args.formId))
      .order("desc") // Sort by creation time by default
      .collect();
  },
});

// deleteFormField (if it's a direct mutation, not just part of saveFields)
// export const deleteFormField = mutation({
//   args: { fieldId: v.id("formFields") },
//   handler: async (ctx, args) => {
//     await requireAdmin(ctx);
//     await ctx.db.delete(args.fieldId);
//   },
// }); 