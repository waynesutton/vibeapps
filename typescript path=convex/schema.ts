import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // --- Existing Tables (ensure they are defined) ---
  stories: defineTable({
    // ... your story fields
    title: v.string(),
    url: v.optional(v.string()),
    text: v.optional(v.string()),
    userId: v.id("users"),
    username: v.string(),
    tags: v.optional(v.array(v.id("tags"))),
    status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
    ),
    isHidden: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    customMessage: v.optional(v.string()),
    // ... other fields like voteCount, commentCount
  })
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_pinned_status_creation", ["isPinned", "status", "_creationTime"]), // Example for ordering

  comments: defineTable({
    // ... your comment fields
    storyId: v.id("stories"),
    userId: v.id("users"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
    ),
    isHidden: v.optional(v.boolean()),
  })
  .index("by_story", ["storyId"])
  .index("by_user", ["userId"])
  .index("by_status", ["status"]),

  tags: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    backgroundColor: v.optional(v.string()),
    textColor: v.optional(v.string()),
    showInHeader: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()), // For soft delete or admin-only visibility
    order: v.optional(v.number()),
  })
  .index("by_slug", ["slug"])
  .index("by_name", ["name"])
  .index("by_hidden_name", ["isHidden", "name"]), // For admin listing

  settings: defineTable({
    // ... your site settings fields
    siteTitle: v.optional(v.string()),
    defaultViewMode: v.optional(v.union(v.literal("grid"), v.literal("list"), v.literal("vibe"))),
    defaultSortPeriod: v.optional(v.string()), // Consider specific literals
    // ... other settings
  }), // Site settings usually have one document, consider how to query it (e.g., a known ID or .first())

  forms: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    // userId: v.id("users"), // Creator/owner
  })
  .index("by_slug", ["slug"]),

  formFields: defineTable({
    formId: v.id("forms"),
    label: v.string(),
    fieldType: v.string(), // "text", "textarea", "dropdown", etc.
    options: v.optional(v.array(v.string())),
    required: v.boolean(),
    placeholder: v.optional(v.string()),
    order: v.number(),
  }).index("by_formId_order", ["formId", "order"]),

  formSubmissions: defineTable({
    formId: v.id("forms"),
    data: v.any(), // Or a more specific validator for submission data
    // userId: v.optional(v.id("users")), // Submitter if logged in
  }).index("by_formId", ["formId"]),

  convexBoxConfig: defineTable({
    isEnabled: v.boolean(),
    displayText: v.string(),
    linkUrl: v.string(),
    logoStorageId: v.optional(v.id("_storage")), // Convex file storage ID
    // Usually a single document for this config
  }),

  // --- Users Table (Crucial for Admin Role) ---
  users: defineTable({
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    clerkId: v.string(), // Clerk User ID
    tokenIdentifier: v.string(), // Clerk's tokenIdentifier (subject from JWT)
    role: v.optional(v.string()), // "admin", "member", etc.
    // ... other user fields like email, profileImageUrl
  })
  .index("by_clerk_id", ["clerkId"])
  .index("by_token_identifier", ["tokenIdentifier"]) // Essential for auth.ts helpers
  .index("by_username", ["username"]), // If you query/link by username

  // --- Reports Table (with fixes for TS errors) ---
  reports: defineTable({
    storyId: v.id("stories"),
    reporterUserId: v.id("users"), // Assuming reports are made by logged-in users
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("resolved_hidden"),
      v.literal("resolved_deleted"),
      v.literal("dismissed")
    ),
    // The field "tokenIdentifier" was causing issues. If it's meant to be the reporter's
    // token, it's redundant if you have reporterUserId and a users table linked by tokenIdentifier.
    // If reports can be anonymous but still tied to a session token, then it might be needed.
    // For now, assuming it's NOT a field on reports table directly to avoid confusion.
    // If it IS a field, it should be defined here: e.g., tokenIdentifier: v.optional(v.string()),
  })
  .index("by_storyId", ["storyId"]) // Ensure this index is on the 'storyId' field
  .index("by_status", ["status"])   // Ensure this index is on the 'status' field
  .index("by_reporterUserId", ["reporterUserId"]), // Index for querying reports by user

  // ... any other tables
}); 