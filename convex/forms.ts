import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Helper to generate slugs (can be moved to a utility file)
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Form Management ---

// Query to list all forms (for admin)
export const listForms = query({
  args: {},
  handler: async (ctx): Promise<Doc<"forms">[]> => {
    // TODO: Add admin authentication check
    return await ctx.db.query("forms").order("asc").collect();
  },
});

// Query to get a specific form by slug (for public view)
export const getFormBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<(Doc<"forms"> & { fields: Doc<"formFields">[] }) | null> => {
    const form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("isPublic"), true)) // Only return public forms
      .unique();

    if (!form) {
      return null;
    }

    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", form._id))
      .order("asc")
      .collect();

    return { ...form, fields };
  },
});

// Query to get a form and its fields (for admin builder/results)
export const getFormWithFields = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, args): Promise<(Doc<"forms"> & { fields: Doc<"formFields">[] }) | null> => {
    // TODO: Add admin authentication check
    const form = await ctx.db.get(args.formId);
    if (!form) {
      return null;
    }
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", form._id))
      .order("asc")
      .collect();
    return { ...form, fields };
  },
});

// Mutation to create a new form
export const createForm = mutation({
  args: { title: v.string() },
  handler: async (ctx, args): Promise<Id<"forms">> => {
    // TODO: Add admin authentication check
    const slug = generateSlug(args.title);
    const existing = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      // Simple way to make slug unique: append timestamp or random chars
      const uniqueSlug = `${slug}-${Date.now().toString().slice(-5)}`;
      console.warn(`Slug "${slug}" exists, using unique slug "${uniqueSlug}"`);
      return await ctx.db.insert("forms", { title: args.title, slug: uniqueSlug, isPublic: false });
    }

    return await ctx.db.insert("forms", { title: args.title, slug, isPublic: false });
  },
});

// Mutation to update form details
export const updateForm = mutation({
  args: {
    formId: v.id("forms"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // TODO: Add admin authentication check
    const { formId, ...updates } = args;

    if (updates.slug) {
      const existing = await ctx.db
        .query("forms")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .filter((q) => q.neq(q.field("_id"), formId))
        .first();
      if (existing) {
        throw new Error(`Slug "${updates.slug}" is already in use.`);
      }
    }

    await ctx.db.patch(formId, updates);
  },
});

// Mutation to delete a form
export const deleteForm = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    // TODO: Add admin authentication check
    // Delete associated fields
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", args.formId))
      .collect();
    await Promise.all(fields.map((field) => ctx.db.delete(field._id)));

    // Delete associated submissions
    const submissions = await ctx.db
      .query("formSubmissions")
      .withIndex("by_formId", (q) => q.eq("formId", args.formId))
      .collect();
    await Promise.all(submissions.map((sub) => ctx.db.delete(sub._id)));

    // Delete the form itself
    await ctx.db.delete(args.formId);
  },
});

// --- Field Management ---

// Validator for a single field object (used in saveFields)
const fieldValidator = v.object({
  // id: v.optional(v.id("formFields")), // ID might not be present for new fields
  order: v.number(),
  label: v.string(),
  fieldType: v.union(
    v.literal("shortText"),
    v.literal("longText"),
    v.literal("url"),
    v.literal("email"),
    v.literal("yesNo"),
    v.literal("dropdown"),
    v.literal("multiSelect")
  ),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
  placeholder: v.optional(v.string()),
});

// Mutation to save/update fields for a form
export const saveFields = mutation({
  args: {
    formId: v.id("forms"),
    fields: v.array(fieldValidator), // Expecting an array of field definitions
  },
  handler: async (ctx, args) => {
    // TODO: Add admin authentication check
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    // Delete existing fields for this form first
    const existingFields = await ctx.db
      .query("formFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", args.formId))
      .collect();
    await Promise.all(existingFields.map((field) => ctx.db.delete(field._id)));

    // Insert the new fields
    for (const field of args.fields) {
      await ctx.db.insert("formFields", {
        formId: args.formId,
        ...field,
      });
    }
  },
});

// --- Submission Management ---

// Mutation to submit data for a form
export const submitForm = mutation({
  args: {
    formId: v.id("forms"),
    data: v.any(), // Expecting a JSON object representing form data
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form || !form.isPublic) {
      throw new Error("Form not found or is not public");
    }
    // TODO: Add validation against form fields?
    await ctx.db.insert("formSubmissions", {
      formId: args.formId,
      data: args.data,
    });
  },
});

// Query to list submissions for a specific form (for admin)
export const listSubmissions = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, args): Promise<Doc<"formSubmissions">[]> => {
    // TODO: Add admin authentication check
    return await ctx.db
      .query("formSubmissions")
      .withIndex("by_formId", (q) => q.eq("formId", args.formId))
      .order("desc") // Show newest first
      .collect();
  },
});
