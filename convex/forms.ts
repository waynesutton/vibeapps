import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users";

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
    await requireAdminRole(ctx);
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
      console.log(`Form not found or not public for slug: ${args.slug}`);
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
    await requireAdminRole(ctx);
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

// NEW: Query to get form results by slug (for public results view)
export const getFormResultsBySlug = query({
  args: { slug: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<
    (Doc<"forms"> & { fields: Doc<"formFields">[]; submissions: Doc<"formSubmissions">[] }) | null
  > => {
    const form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("resultsArePublic"), true)) // Only return if results are public
      .unique();

    if (!form) {
      console.log(`Form results not found or not public for slug: ${args.slug}`);
      return null;
    }

    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", form._id))
      .order("asc")
      .collect();

    const submissions = await ctx.db
      .query("formSubmissions")
      .withIndex("by_formId", (q) => q.eq("formId", form._id))
      .order("desc")
      .collect();

    return { ...form, fields, submissions };
  },
});

// Mutation to create a new form
export const createForm = mutation({
  args: { title: v.string() }, // Only need title to create
  handler: async (ctx, args): Promise<Id<"forms">> => {
    await requireAdminRole(ctx);
    let slug = generateSlug(args.title);
    const existing = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    // Ensure slug uniqueness
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-5)}`; // Append timestamp suffix if needed
      console.warn(`Slug "${generateSlug(args.title)}" exists, using unique slug "${slug}"`);
    }

    // Create form with default private settings
    return await ctx.db.insert("forms", {
      title: args.title,
      slug,
      isPublic: false,
      resultsArePublic: false, // Default results to private
    });
  },
});

// Mutation to update form details (excluding slug)
export const updateForm = mutation({
  args: {
    formId: v.id("forms"),
    title: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    resultsArePublic: v.optional(v.boolean()), // Allow updating results visibility
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const { formId, ...updates } = args;

    // Note: We are intentionally NOT allowing slug updates here
    // to prevent breaking existing links. A separate mechanism
    // would be needed if slug changes are required.

    await ctx.db.patch(formId, updates);
  },
});

// Mutation to delete a form and its associated data
export const deleteForm = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
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
    await requireAdminRole(ctx);
    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    // Strategy: Delete existing fields and insert new ones.
    // Could be optimized to patch/update existing fields if needed.
    const existingFields = await ctx.db
      .query("formFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", args.formId))
      .collect();
    await Promise.all(existingFields.map((field) => ctx.db.delete(field._id)));

    // Insert the new fields with correct formId
    for (const field of args.fields) {
      await ctx.db.insert("formFields", {
        formId: args.formId, // Ensure correct formId is associated
        ...field,
      });
    }
  },
});

// --- Submission Management ---

// Mutation to submit data for a form (using slug)
export const submitForm = mutation({
  args: {
    slug: v.string(), // Use slug to identify the form
    data: v.any(), // Expecting a JSON object representing form data
  },
  handler: async (ctx, args) => {
    // Find the form by slug
    const form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    // Check if form exists and is public
    if (!form || !form.isPublic) {
      throw new Error("Form not found or is not public");
    }

    // TODO: Add validation against form fields based on form._id?

    // Insert the submission data
    await ctx.db.insert("formSubmissions", {
      formId: form._id, // Use the found form's ID
      data: args.data,
    });
  },
});

// Query to list submissions for a specific form (for admin, using formId)
export const listSubmissions = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, args): Promise<Doc<"formSubmissions">[]> => {
    await requireAdminRole(ctx);
    return await ctx.db
      .query("formSubmissions")
      .withIndex("by_formId", (q) => q.eq("formId", args.formId))
      .order("desc") // Show newest first
      .collect();
  },
});
