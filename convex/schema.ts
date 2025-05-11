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
    userId: v.optional(v.id("users")), // Link to the users table, optional for public/anonymous submissions
    votes: v.number(),
    commentCount: v.number(), // Storing for easier querying
    customMessage: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")), // Store file ID for screenshot
    ratingSum: v.number(), // To calculate average rating
    ratingCount: v.number(), // Number of ratings received
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()), // Added GitHub Repo URL
    chefAppUrl: v.optional(v.string()), // Added Chef.app URL
    chefShowUrl: v.optional(v.string()), // Added Chef.show URL
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    isHidden: v.optional(v.boolean()), // Added for admin hide/show
    isPinned: v.optional(v.boolean()),
    isApproved: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_votes", ["votes"])
    .index("by_hidden_status", ["isHidden", "status"])
    .index("by_status_creationTime", ["status"])
    .index("by_pinned_status_hidden", ["isPinned", "status", "isHidden"])
    .index("by_approved", ["isApproved"])
    .index("by_user", ["userId"]) // Added index by user
    .searchIndex("search_all", {
      searchField: "title",
      filterFields: ["status", "isHidden"],
    }),

  comments: defineTable({
    content: v.string(),
    userId: v.id("users"), // Link to the users table
    storyId: v.id("stories"),
    parentId: v.optional(v.id("comments")), // For nested replies
    votes: v.number(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    isHidden: v.optional(v.boolean()), // Added for admin hide/show
  })
    .index("by_storyId_status", ["storyId", "status"])
    .index("by_hidden_status", ["storyId", "isHidden", "status"])
    .index("by_user", ["userId"]), // Added index by user

  votes: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
  })
    .index("by_user_story", ["userId", "storyId"]) // Existing unique index
    .index("by_story", ["storyId"]), // Added for deleting votes by storyId

  tags: defineTable({
    name: v.string(),
    showInHeader: v.boolean(),
    isHidden: v.optional(v.boolean()), // Added for admin hide/show
    backgroundColor: v.optional(v.string()), // Optional hex color
    textColor: v.optional(v.string()), // Optional hex color
  }).index("by_name", ["name"]),

  settings: defineTable({
    itemsPerPage: v.number(),
    siteTitle: v.string(),
  }),

  forms: defineTable({
    title: v.string(),
    slug: v.string(),
    isPublic: v.boolean(),
    resultsArePublic: v.optional(v.boolean()), // Add field for public results
  }).index("by_slug", ["slug"]),

  formFields: defineTable({
    formId: v.id("forms"),
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
  }).index("by_formId_order", ["formId", "order"]),

  formSubmissions: defineTable({
    formId: v.id("forms"),
    data: v.any(),
  }).index("by_formId", ["formId"]),

  submissionLogs: defineTable({
    submitterEmail: v.string(), // Index submissions by email - can be kept for anonymous or as a secondary piece of info
    submissionTime: v.number(), // Store the submission timestamp
    userId: v.optional(v.id("users")), // Optional: link to user if submission was by a logged-in user
  })
    .index("by_email_time", ["submitterEmail", "submissionTime"])
    .index("by_user_time", ["userId", "submissionTime"]), // Added for rate limiting by user

  storyRatings: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
    value: v.number(), // Rating value, e.g., 1-5
  }).index("by_user_story", ["userId", "storyId"]), // Unique index
});
