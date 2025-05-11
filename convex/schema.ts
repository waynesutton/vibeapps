import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(), // User's name
    clerkId: v.string(), // Clerk User ID for linking
    email: v.optional(v.string()), // Added user's email
    username: v.optional(v.string()), // Added username, make it unique
    role: v.optional(v.string()), // User's role, e.g., "admin"
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]), // Index for fetching by username

  stories: defineTable({
    title: v.string(),
    slug: v.string(),
    url: v.string(),
    description: v.string(),
    tagIds: v.array(v.id("tags")),
    userId: v.id("users"),
    votes: v.number(),
    commentCount: v.number(),
    screenshotId: v.optional(v.id("_storage")),
    ratingSum: v.number(),
    ratingCount: v.number(),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
    chefAppUrl: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    isHidden: v.boolean(),
    isPinned: v.boolean(),
    customMessage: v.optional(v.string()),
    isApproved: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_votes", ["votes"])
    .searchIndex("search_all", { searchField: "title", filterFields: ["status", "isHidden"] }),

  comments: defineTable({
    content: v.string(),
    userId: v.id("users"),
    storyId: v.id("stories"),
    parentId: v.optional(v.id("comments")),
    votes: v.number(),
    status: v.string(),
    isHidden: v.optional(v.boolean()),
  })
    .index("by_storyId_status", ["storyId", "status"])
    .index("by_user", ["userId"])
    .index("by_hidden_status", ["storyId", "isHidden", "status"]),

  votes: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
  })
    .index("by_user_story", ["userId", "storyId"])
    .index("by_story", ["storyId"]),

  tags: defineTable({
    name: v.string(),
    showInHeader: v.boolean(),
    isHidden: v.optional(v.boolean()),
    backgroundColor: v.optional(v.string()),
    textColor: v.optional(v.string()),
  }).index("by_name", ["name"]),

  settings: defineTable({
    itemsPerPage: v.number(),
    siteTitle: v.string(),
    defaultViewMode: v.optional(v.union(v.literal("list"), v.literal("grid"), v.literal("vibe"))),
  }),

  forms: defineTable({
    title: v.string(),
    slug: v.string(),
    isPublic: v.boolean(),
    resultsArePublic: v.boolean(),
  }).index("by_slug", ["slug"]),

  formFields: defineTable({
    formId: v.id("forms"),
    order: v.number(),
    label: v.string(),
    fieldType: v.string(),
    required: v.boolean(),
    options: v.optional(v.array(v.string())),
    placeholder: v.optional(v.string()),
  }).index("by_formId_order", ["formId", "order"]),

  formSubmissions: defineTable({
    formId: v.id("forms"),
    data: v.any(),
  }).index("by_formId", ["formId"]),

  submissionLogs: defineTable({
    submitterEmail: v.string(),
    userId: v.optional(v.id("users")),
    submissionTime: v.number(),
  }).index("by_user_time", ["userId", "submissionTime"]),

  storyRatings: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
    value: v.number(),
  }).index("by_user_story", ["userId", "storyId"]),

  convexBoxConfig: defineTable({
    identifier: v.string(),
    isEnabled: v.boolean(),
    displayText: v.string(),
    linkUrl: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
  }).index("by_identifier", ["identifier"]),
});
