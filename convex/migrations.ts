import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdminRole } from "./users";

/**
 * Migration to create YCHackForm as a built-in submit form
 * This should be run once to migrate the existing YCHackForm to the new system
 */
export const migrateYCHackForm = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Check if YCHackForm already exists
    const existingForm = await ctx.db
      .query("submitForms")
      .withIndex("by_slug", (q) => q.eq("slug", "ychackathon"))
      .unique();

    if (existingForm) {
      console.log("YCHackForm already exists, skipping migration");
      return null;
    }

    // Find the first admin user to assign as creator, fallback to first user
    let adminUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    if (!adminUser) {
      // Fallback to first user if no admin exists
      adminUser = await ctx.db.query("users").first();
      if (!adminUser) {
        throw new Error(
          "No users found. Please create a user before running migration.",
        );
      }
    }

    // Create the YCHackForm submit form
    const formId = await ctx.db.insert("submitForms", {
      title: "YC AI Hackathon Submissions (Admin Managed)",
      slug: "ychackathon",
      description: "Submit your AI-powered application to the YC AI Hackathon",
      isEnabled: true,
      customHiddenTag: "ychackathon",
      headerText: "YC AI Hackathon Submissions",
      submitButtonText: "Submit App",
      successMessage: "Thanks for sharing!",
      disabledMessage:
        "This form is no longer accepting applications. Please sign up for updates.",
      isBuiltIn: true,
      createdBy: adminUser._id,
      submissionCount: 0,
    });

    // Create the default form fields for YCHackForm
    const defaultFields = [
      {
        fieldKey: "title",
        label: "App Title",
        placeholder: "Site name",
        fieldType: "text" as const,
        isRequired: true,
        isEnabled: true,
        order: 1,
        storyPropertyMapping: "title",
      },
      {
        fieldKey: "tagline",
        label: "App/Project Tagline",
        placeholder: "One sentence pitch or description",
        fieldType: "text" as const,
        isRequired: true,
        isEnabled: true,
        order: 2,
        storyPropertyMapping: "description",
      },
      {
        fieldKey: "longDescription",
        label: "Description",
        placeholder:
          "- What it does\n- Key Features\n- How you built it\n- How are you using AI",
        description: "Optional detailed description",
        fieldType: "textarea" as const,
        isRequired: false,
        isEnabled: true,
        order: 3,
        storyPropertyMapping: "longDescription",
      },
      {
        fieldKey: "url",
        label: "App Website Link",
        placeholder: "https://",
        description: "Enter your app url (ex: https://)",
        fieldType: "url" as const,
        isRequired: true,
        isEnabled: true,
        order: 4,
        storyPropertyMapping: "url",
      },
      {
        fieldKey: "videoUrl",
        label: "Video Demo - 3-5 minutes recommended",
        placeholder: "https://youtube.com/..",
        description: "Share a video demo of your app (YouTube, Vimeo, etc.)",
        fieldType: "url" as const,
        isRequired: false,
        isEnabled: true,
        order: 5,
        storyPropertyMapping: "videoUrl",
      },
      {
        fieldKey: "submitterName",
        label: "Your Name",
        placeholder: "Your name",
        fieldType: "text" as const,
        isRequired: true,
        isEnabled: true,
        order: 6,
        storyPropertyMapping: "submitterName",
      },
      {
        fieldKey: "email",
        label: "Email",
        placeholder: "your@email.com",
        description:
          "Required for anonymous submissions (used for communication only)",
        fieldType: "email" as const,
        isRequired: true,
        isEnabled: true,
        order: 7,
        storyPropertyMapping: "email",
      },
      {
        fieldKey: "screenshot",
        label: "Upload Screenshot",
        description: "Recommended but Optional",
        fieldType: "file" as const,
        isRequired: false,
        isEnabled: true,
        order: 8,
        storyPropertyMapping: "screenshotId",
      },
      {
        fieldKey: "linkedinUrl",
        label: "LinkedIn URL",
        placeholder: "https://linkedin.com/in/...",
        fieldType: "url" as const,
        isRequired: false,
        isEnabled: true,
        order: 9,
        storyPropertyMapping: "linkedinUrl",
      },
      {
        fieldKey: "twitterUrl",
        label: "Twitter URL",
        placeholder: "https://twitter.com/...",
        fieldType: "url" as const,
        isRequired: false,
        isEnabled: true,
        order: 10,
        storyPropertyMapping: "twitterUrl",
      },
      {
        fieldKey: "githubUrl",
        label: "GitHub URL",
        placeholder: "https://github.com/...",
        fieldType: "url" as const,
        isRequired: false,
        isEnabled: true,
        order: 11,
        storyPropertyMapping: "githubUrl",
      },
      {
        fieldKey: "chefShowUrl",
        label: "Chef Show URL",
        placeholder: "https://...",
        fieldType: "url" as const,
        isRequired: false,
        isEnabled: true,
        order: 12,
        storyPropertyMapping: "chefShowUrl",
      },
      {
        fieldKey: "chefAppUrl",
        label: "Chef App URL",
        placeholder: "https://...",
        fieldType: "url" as const,
        isRequired: false,
        isEnabled: true,
        order: 13,
        storyPropertyMapping: "chefAppUrl",
      },
    ];

    // Insert all the form fields
    // TODO: Update this to use the new submitFormToStoryFields approach
    // for (const field of defaultFields) {
    //   await ctx.db.insert("submitFormFields", {
    //     formId,
    //     ...field,
    //   });
    // }

    console.log("Successfully migrated YCHackForm to submit forms system");
    return null;
  },
});

/**
 * Public mutation wrapper to trigger the YCHackForm migration
 * This can be called from admin interface
 */
export const triggerYCHackFormMigration = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    await ctx.runMutation(internal.migrations.migrateYCHackForm, {});
    return null;
  },
});

/**
 * Direct migration runner (no auth required - for development)
 */
export const runMigrationDirect = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.migrations.migrateYCHackForm, {});
    return null;
  },
});

/**
 * Clean up existing YCHackForm and re-run migration with new slug
 */
export const cleanAndRemigrate = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Delete existing form with "ychack" slug
    const existingForm = await ctx.db
      .query("submitForms")
      .withIndex("by_slug", (q) => q.eq("slug", "ychack"))
      .unique();

    if (existingForm) {
      // Delete associated fields
      // TODO: Update this to use the new submitFormToStoryFields approach
      // const fields = await ctx.db
      //   .query("submitFormFields")
      //   .withIndex("by_formId_order", (q) => q.eq("formId", existingForm._id))
      //   .collect();

      // for (const field of fields) {
      //   await ctx.db.delete(field._id);
      // }

      // Delete the form
      await ctx.db.delete(existingForm._id);
      console.log("Deleted existing YCHackForm with ychack slug");
    }

    // Re-run migration with new slug
    await ctx.runMutation(internal.migrations.migrateYCHackForm, {});
    return null;
  },
});
