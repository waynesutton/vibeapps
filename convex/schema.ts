import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(), // User's name
    clerkId: v.string(), // Clerk User ID for linking
    email: v.optional(v.string()), // Added user's email
    username: v.optional(v.string()), // Added username, make it unique
    role: v.optional(v.string()), // User's role, e.g., "admin"
    imageUrl: v.optional(v.string()), // Publicly visible profile image URL
    bio: v.optional(v.string()), // User bio, max 200 chars (enforced in code)
    website: v.optional(v.string()), // User website URL
    twitter: v.optional(v.string()), // Twitter profile URL
    bluesky: v.optional(v.string()), // Bluesky profile URL
    linkedin: v.optional(v.string()), // LinkedIn profile URL
    isBanned: v.optional(v.boolean()), // New field for banning users
    isPaused: v.optional(v.boolean()), // New field for pausing users
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
    rejectionReason: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_votes", ["votes"])
    .index("by_status_isHidden_votes", ["status", "isHidden", "votes"])
    .index("by_status_isHidden", ["status", "isHidden"])
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
    .index("by_hidden_status", ["storyId", "isHidden", "status"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["status", "isHidden"],
    }),

  votes: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
  })
    .index("by_user_story", ["userId", "storyId"])
    .index("by_story", ["storyId"]),

  tags: defineTable({
    name: v.string(),
    slug: v.optional(v.string()),
    showInHeader: v.boolean(),
    isHidden: v.optional(v.boolean()),
    backgroundColor: v.optional(v.string()),
    textColor: v.optional(v.string()),
    emoji: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_slug", ["slug"]),

  settings: defineTable({
    itemsPerPage: v.number(),
    siteTitle: v.string(),
    defaultViewMode: v.optional(v.union(v.literal("list"), v.literal("grid"), v.literal("vibe"))),
    defaultSortPeriod: v.optional(
      v.union(
        v.literal("today"),
        v.literal("week"),
        v.literal("month"),
        v.literal("year"),
        v.literal("all"),
        v.literal("votes_today"),
        v.literal("votes_week"),
        v.literal("votes_month"),
        v.literal("votes_year")
      )
    ),
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
  })
    .index("by_formId", ["formId"])
    .searchIndex("search_data", { searchField: "data" }),

  submissionLogs: defineTable({
    submitterEmail: v.string(),
    userId: v.optional(v.id("users")),
    submissionTime: v.number(),
  }).index("by_user_time", ["userId", "submissionTime"]),

  storyRatings: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
    value: v.number(),
  })
    .index("by_user_story", ["userId", "storyId"])
    .index("by_storyId", ["storyId"]),

  convexBoxConfig: defineTable({
    identifier: v.string(),
    isEnabled: v.boolean(),
    displayText: v.string(),
    linkUrl: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
  }).index("by_identifier", ["identifier"]),

  reports: defineTable({
    storyId: v.id("stories"),
    reporterUserId: v.id("users"),
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("resolved_hidden"),
      v.literal("resolved_deleted"),
      v.literal("dismissed")
    ),
    // Optional: store story details at time of report if stories can be fully deleted
    // storyTitleSnapshot: v.optional(v.string()),
    // storyUrlSnapshot: v.optional(v.string()),
  })
    .index("by_storyId", ["storyId"])
    .index("by_status", ["status"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
  })
    .index("by_user_story", ["userId", "storyId"])
    .index("by_userId", ["userId"])
    .index("by_storyId", ["storyId"]),
});
