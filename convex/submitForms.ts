import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole, getAuthenticatedUserId } from "./users";
import { api, internal } from "./_generated/api";

// Helper to generate slugs
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Helper function to generate a unique slug by checking for duplicates
async function generateUniqueSlug(ctx: any, title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();

    if (!existing) {
      return slug;
    }

    // If slug exists, try with incremental number
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// --- Admin Functions ---

/**
 * List all submit forms for admin dashboard
 */
export const listSubmitForms = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("submitForms"),
      _creationTime: v.number(),
      title: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isEnabled: v.boolean(),
      customHiddenTag: v.string(),
      headerText: v.optional(v.string()),
      submitButtonText: v.optional(v.string()),
      successMessage: v.optional(v.string()),
      disabledMessage: v.optional(v.string()),
      isBuiltIn: v.optional(v.boolean()),
      createdBy: v.id("users"),
      submissionCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdminRole(ctx);

    const forms = await ctx.db.query("submitForms").order("desc").collect();
    return forms;
  },
});

/**
 * Get a submit form with its fields for admin
 */
export const getSubmitFormWithFields = query({
  args: { formId: v.id("submitForms") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("submitForms"),
      _creationTime: v.number(),
      title: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isEnabled: v.boolean(),
      customHiddenTag: v.string(),
      headerText: v.optional(v.string()),
      submitButtonText: v.optional(v.string()),
      successMessage: v.optional(v.string()),
      disabledMessage: v.optional(v.string()),
      isBuiltIn: v.optional(v.boolean()),
      createdBy: v.id("users"),
      submissionCount: v.optional(v.number()),
      fields: v.array(
        v.object({
          _id: v.union(v.id("storyFormFields"), v.string()), // Allow both real IDs and string IDs for core fields
          _creationTime: v.number(),
          key: v.string(),
          label: v.string(),
          placeholder: v.string(),
          isEnabled: v.boolean(),
          isRequired: v.boolean(),
          order: v.number(),
          fieldType: v.union(
            v.literal("url"),
            v.literal("text"),
            v.literal("email"),
          ),
          description: v.optional(v.string()),
          storyPropertyName: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const form = await ctx.db.get(args.formId);
    if (!form) {
      return null;
    }

    // Start with default core fields
    const coreFields = DEFAULT_CORE_FIELDS.map((field, index) => ({
      ...field,
      order: index,
    }));

    // Get the linked additional fields for this form
    const fieldLinks = await ctx.db
      .query("submitFormToStoryFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", args.formId))
      .order("asc")
      .collect();

    // Get the actual additional field data
    const additionalFields = [];
    for (const link of fieldLinks) {
      const field = await ctx.db.get(link.storyFieldId);
      if (field) {
        additionalFields.push({
          ...field,
          order: coreFields.length + link.order, // Offset by core fields length
        });
      }
    }

    // Combine core fields with additional fields
    const allFields = [...coreFields, ...additionalFields];

    return { ...form, fields: allFields };
  },
});

/**
 * Create a new submit form
 */
export const createSubmitForm = mutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    customHiddenTag: v.string(),
    headerText: v.optional(v.string()),
    submitButtonText: v.optional(v.string()),
    successMessage: v.optional(v.string()),
    disabledMessage: v.optional(v.string()),
  },
  returns: v.id("submitForms"),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const slug = args.slug || generateSlug(args.title);

    const formId = await ctx.db.insert("submitForms", {
      ...args,
      slug,
      isEnabled: true,
      submissionCount: 0,
      createdBy: await getAuthenticatedUserId(ctx),
    });

    const defaultFields = await ctx.db
      .query("storyFormFields")
      .filter((q) => q.eq(q.field("isEnabled"), true))
      .order("asc")
      .collect();

    for (const field of defaultFields) {
      await ctx.db.insert("submitFormToStoryFields", {
        formId: formId,
        storyFieldId: field._id,
        order: field.order,
      });
    }

    return formId;
  },
});

/**
 * Update a submit form
 */
export const updateSubmitForm = mutation({
  args: {
    formId: v.id("submitForms"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
    customHiddenTag: v.optional(v.string()),
    headerText: v.optional(v.string()),
    submitButtonText: v.optional(v.string()),
    successMessage: v.optional(v.string()),
    disabledMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const { formId, ...updates } = args;

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    if (Object.keys(cleanUpdates).length > 0) {
      await ctx.db.patch(formId, cleanUpdates);
    }

    return null;
  },
});

/**
 * Delete a submit form and its associated data
 */
export const deleteSubmitForm = mutation({
  args: { formId: v.id("submitForms") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    if (form.isBuiltIn) {
      throw new Error("Cannot delete a built-in form");
    }

    const links = await ctx.db
      .query("submitFormToStoryFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", args.formId))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    await ctx.db.delete(args.formId);

    return null;
  },
});

export const updateSubmitFormFields = mutation({
  args: {
    formId: v.id("submitForms"),
    fieldIds: v.array(v.id("storyFormFields")),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);

    // delete existing links
    const existingLinks = await ctx.db
      .query("submitFormToStoryFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", args.formId))
      .collect();

    await Promise.all(existingLinks.map((link) => ctx.db.delete(link._id)));

    // create new links
    for (let i = 0; i < args.fieldIds.length; i++) {
      await ctx.db.insert("submitFormToStoryFields", {
        formId: args.formId,
        storyFieldId: args.fieldIds[i],
        order: i,
      });
    }
  },
});

// --- Public Functions ---

// Define the default core fields that every submit form should have
const DEFAULT_CORE_FIELDS = [
  {
    _id: "core-title" as Id<"storyFormFields">,
    _creationTime: 0,
    key: "title",
    label: "App Title",
    placeholder: "Site name",
    description: undefined,
    fieldType: "text" as const,
    isEnabled: true,
    isRequired: true,
    order: 0,
    storyPropertyName: "title",
  },
  {
    _id: "core-tagline" as Id<"storyFormFields">,
    _creationTime: 0,
    key: "tagline",
    label: "App/Project Tagline",
    placeholder: "One sentence pitch or description",
    description: undefined,
    fieldType: "text" as const,
    isEnabled: true,
    isRequired: true,
    order: 1,
    storyPropertyName: "description",
  },
  {
    _id: "core-longDescription" as Id<"storyFormFields">,
    _creationTime: 0,
    key: "longDescription",
    label: "Description",
    placeholder:
      "- What it does\\n- Key Features\\n- How you built it\\n- How are you using AI",
    description: "Optional detailed description",
    fieldType: "text" as const, // Will render as textarea in frontend
    isEnabled: true,
    isRequired: false,
    order: 2,
    storyPropertyName: "longDescription",
  },
  {
    _id: "core-url" as Id<"storyFormFields">,
    _creationTime: 0,
    key: "url",
    label: "App Website Link",
    placeholder: "https://",
    description: "Enter your app url (ex: https://)",
    fieldType: "url" as const,
    isEnabled: true,
    isRequired: true,
    order: 3,
    storyPropertyName: "url",
  },
  {
    _id: "core-videoUrl" as Id<"storyFormFields">,
    _creationTime: 0,
    key: "videoUrl",
    label: "Video Demo - 3-5 minutes recommended",
    placeholder: "https://youtube.com/..",
    description: "Share a video demo of your app (YouTube, Vimeo, etc.)",
    fieldType: "url" as const,
    isEnabled: true,
    isRequired: false,
    order: 4,
    storyPropertyName: "videoUrl",
  },
  {
    _id: "core-submitterName" as Id<"storyFormFields">,
    _creationTime: 0,
    key: "submitterName",
    label: "Your Name",
    placeholder: "Your name",
    description: undefined,
    fieldType: "text" as const,
    isEnabled: true,
    isRequired: true,
    order: 5,
    storyPropertyName: "submitterName",
  },
  {
    _id: "core-email" as Id<"storyFormFields">,
    _creationTime: 0,
    key: "email",
    label: "Email",
    placeholder: "your@email.com",
    description:
      "Required for anonymous submissions (used for communication only)",
    fieldType: "email" as const,
    isEnabled: true,
    isRequired: true,
    order: 6,
    storyPropertyName: "email",
  },
] as const;

/**
 * Get a submit form by slug for public display
 */
export const getPublicSubmitForm = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("submitForms"),
      title: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isEnabled: v.boolean(),
      customHiddenTag: v.string(),
      headerText: v.optional(v.string()),
      submitButtonText: v.optional(v.string()),
      successMessage: v.optional(v.string()),
      disabledMessage: v.optional(v.string()),
      fields: v.array(
        v.object({
          _id: v.union(v.id("storyFormFields"), v.string()), // Allow both real IDs and string IDs for core fields
          _creationTime: v.number(),
          key: v.string(),
          label: v.string(),
          placeholder: v.string(),
          isEnabled: v.boolean(),
          isRequired: v.boolean(),
          order: v.number(),
          fieldType: v.union(
            v.literal("url"),
            v.literal("text"),
            v.literal("email"),
          ),
          description: v.optional(v.string()),
          storyPropertyName: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("submitForms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!form) {
      return null;
    }

    // Start with default core fields
    const coreFields = DEFAULT_CORE_FIELDS.map((field, index) => ({
      ...field,
      order: index,
    }));

    // Get the linked additional fields for this form
    const fieldLinks = await ctx.db
      .query("submitFormToStoryFields")
      .withIndex("by_formId_order", (q) => q.eq("formId", form._id))
      .order("asc")
      .collect();

    // Get the actual additional field data
    const additionalFields = [];
    for (const link of fieldLinks) {
      const field = await ctx.db.get(link.storyFieldId);
      if (field && field.isEnabled) {
        additionalFields.push({
          ...field,
          order: coreFields.length + link.order, // Offset by core fields length
        });
      }
    }

    // Combine core fields with additional fields
    const allFields = [...coreFields, ...additionalFields];

    return {
      _id: form._id,
      title: form.title,
      slug: form.slug,
      description: form.description,
      isEnabled: form.isEnabled,
      customHiddenTag: form.customHiddenTag,
      headerText: form.headerText,
      submitButtonText: form.submitButtonText,
      successMessage: form.successMessage,
      disabledMessage: form.disabledMessage,
      fields: allFields,
    };
  },
});

/**
 * Submit form data - processes dynamic form submission to stories
 */
export const submitFormData = mutation({
  args: {
    formSlug: v.string(),
    formData: v.any(), // Dynamic form data object
    screenshotId: v.optional(v.id("_storage")),
  },
  returns: v.object({
    storyId: v.id("stories"),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get the form configuration
    const form = await ctx.db
      .query("submitForms")
      .withIndex("by_slug", (q) => q.eq("slug", args.formSlug))
      .unique();

    if (!form) {
      throw new Error("Form not found");
    }

    if (!form.isEnabled) {
      throw new Error("This form is not currently accepting submissions");
    }

    // Rate limiting by email for anonymous submissions
    const email = args.formData.email;
    if (email) {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentSubmissions = await ctx.db
        .query("submissionLogs")
        .withIndex("by_user_time", (q) =>
          q.eq("userId", undefined).gt("submissionTime", twentyFourHoursAgo),
        )
        .filter((q) => q.eq(q.field("submitterEmail"), email))
        .collect();

      if (recentSubmissions.length >= 10) {
        throw new Error(
          "Submission limit reached. You can submit up to 10 projects per day.",
        );
      }
    }

    // Generate unique slug for the story
    const title = args.formData.title || args.formData.name || "untitled";
    const slug = await generateUniqueSlug(ctx, title);

    // Ensure the hidden tag exists
    let hiddenTagId: Id<"tags"> | null = null;
    const hiddenTag = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", form.customHiddenTag))
      .unique();

    if (hiddenTag) {
      hiddenTagId = hiddenTag._id;
    } else {
      // Create the hidden tag if it doesn't exist
      hiddenTagId = await ctx.db.insert("tags", {
        name: form.customHiddenTag,
        slug: generateSlug(form.customHiddenTag),
        showInHeader: false,
        isHidden: true,
      });
    }

    // Build tag IDs array (existing tags + new hidden tag)
    const tagIds = [hiddenTagId];
    if (args.formData.tagIds && Array.isArray(args.formData.tagIds)) {
      tagIds.push(...args.formData.tagIds);
    }

    // Create the story from form data
    const storyId = await ctx.db.insert("stories", {
      title: args.formData.title || "Untitled",
      slug: slug,
      url: args.formData.url || "",
      description: args.formData.tagline || args.formData.description || "",
      longDescription: args.formData.longDescription,
      submitterName: args.formData.submitterName,
      tagIds: tagIds,
      userId: undefined, // Anonymous submission
      votes: 1,
      commentCount: 0,
      screenshotId: args.screenshotId,
      ratingSum: 0,
      ratingCount: 0,
      videoUrl: args.formData.videoUrl,
      linkedinUrl: args.formData.linkedinUrl,
      twitterUrl: args.formData.twitterUrl,
      githubUrl: args.formData.githubUrl,
      chefShowUrl: args.formData.chefShowUrl,
      chefAppUrl: args.formData.chefAppUrl,
      status: "approved", // Auto-approve form submissions
      isHidden: false,
      isPinned: false,
      customMessage: undefined,
      isApproved: true,
      email: email,
      // Hackathon team info
      teamName: args.formData.teamName,
      teamMemberCount: args.formData.teamMemberCount,
      teamMembers: args.formData.teamMembers,
    });

    // Log the submission
    if (email) {
      await ctx.db.insert("submissionLogs", {
        submitterEmail: email,
        userId: undefined,
        submissionTime: Date.now(),
      });
    }

    // Update form submission count
    await ctx.db.patch(form._id, {
      submissionCount: (form.submissionCount || 0) + 1,
    });

    return { storyId, slug };
  },
});

/**
 * Generate upload URL for form submissions
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
