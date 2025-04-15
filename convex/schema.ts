import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  stories: defineTable({
    title: v.string(),
    slug: v.string(),
    url: v.string(),
    description: v.string(),
    tagIds: v.array(v.id("tags")),
    name: v.string(), // Submitter's name (replaces author)
    email: v.optional(v.string()), // Submitter's email (optional)
    votes: v.number(),
    commentCount: v.number(), // Storing for easier querying
    customMessage: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")), // Store file ID for screenshot
    ratingSum: v.number(), // To calculate average rating
    ratingCount: v.number(), // Number of ratings received
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()), // Added GitHub Repo URL
    chefShowUrl: v.optional(v.string()), // Added Chef.show URL
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    isHidden: v.optional(v.boolean()), // Added for admin hide/show
  })
    .index("by_slug", ["slug"])
    .index("by_votes", ["votes"])
    .index("by_status", ["status"])
    .index("by_hidden_status", ["isHidden", "status"])
    .searchIndex("search_all", {
      searchField: "title",
      filterFields: ["status", "isHidden"],
    }),

  comments: defineTable({
    content: v.string(),
    author: v.string(), // Will revisit if auth is added
    storyId: v.id("stories"),
    parentId: v.optional(v.id("comments")), // For nested replies
    votes: v.number(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    isHidden: v.optional(v.boolean()), // Added for admin hide/show
  })
    .index("by_storyId_status", ["storyId", "status"])
    .index("by_hidden_status", ["storyId", "isHidden", "status"]),

  tags: defineTable({
    name: v.string(),
    showInHeader: v.boolean(),
  }).index("by_name", ["name"]),

  settings: defineTable({
    itemsPerPage: v.number(),
    siteTitle: v.string(),
  }),

  forms: defineTable({
    title: v.string(),
    slug: v.string(),
    isPublic: v.boolean(),
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
});
