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
    isVerified: v.optional(v.boolean()), // New field for verifying users
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]), // Index for fetching by username

  stories: defineTable({
    title: v.string(),
    slug: v.string(),
    url: v.string(),
    description: v.string(), // Short tagline
    longDescription: v.optional(v.string()), // Detailed description
    submitterName: v.optional(v.string()), // Name from form input
    tagIds: v.array(v.id("tags")),
    userId: v.optional(v.id("users")), // Made optional to support anonymous submissions
    votes: v.number(),
    commentCount: v.number(),
    screenshotId: v.optional(v.id("_storage")),
    additionalImageIds: v.optional(v.array(v.id("_storage"))), // Up to 4 additional images
    ratingSum: v.number(),
    ratingCount: v.number(),
    videoUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    chefShowUrl: v.optional(v.string()),
    chefAppUrl: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    isHidden: v.boolean(),
    isPinned: v.boolean(),
    customMessage: v.optional(v.string()),
    isApproved: v.optional(v.boolean()),
    rejectionReason: v.optional(v.string()),
    email: v.optional(v.string()),
    // Hackathon team info
    teamName: v.optional(v.string()),
    teamMemberCount: v.optional(v.number()),
    teamMembers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          email: v.string(),
        }),
      ),
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_userId_isApproved", ["userId", "isApproved"])
    .index("by_votes", ["votes"])
    .index("by_status_isHidden_votes", ["status", "isHidden", "votes"])
    .index("by_status_isHidden", ["status", "isHidden"])
    .searchIndex("search_all", {
      searchField: "title",
      filterFields: ["status", "isHidden"],
    }),

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
    .index("by_storyId", ["storyId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["status", "isHidden"],
    }),

  votes: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
  })
    .index("by_user_story", ["userId", "storyId"])
    .index("by_story", ["storyId"])
    .index("by_userId", ["userId"]),

  tags: defineTable({
    name: v.string(),
    slug: v.optional(v.string()),
    showInHeader: v.boolean(),
    isHidden: v.optional(v.boolean()),
    backgroundColor: v.optional(v.string()),
    textColor: v.optional(v.string()),
    emoji: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    order: v.optional(v.number()),
    createdByAdmin: v.optional(v.boolean()), // Track if tag was created by admin or user
  })
    .index("by_name", ["name"])
    .index("by_slug", ["slug"]),

  settings: defineTable({
    itemsPerPage: v.number(),
    siteTitle: v.string(),
    defaultViewMode: v.optional(
      v.union(v.literal("list"), v.literal("grid"), v.literal("vibe")),
    ),
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
        v.literal("votes_year"),
      ),
    ),
    showListView: v.optional(v.boolean()),
    showGridView: v.optional(v.boolean()),
    showVibeView: v.optional(v.boolean()),
    siteDefaultViewMode: v.optional(
      v.union(
        v.literal("list"),
        v.literal("grid"),
        v.literal("vibe"),
        v.literal("none"),
      ),
    ),
    profilePageDefaultViewMode: v.optional(
      v.union(
        v.literal("list"),
        v.literal("grid"),
        v.literal("vibe"),
        v.literal("none"),
      ),
    ),
    adminDashboardDefaultViewMode: v.optional(
      v.union(
        v.literal("list"),
        v.literal("grid"),
        v.literal("vibe"),
        v.literal("none"),
      ),
    ),
    // Submission limit settings
    showSubmissionLimit: v.optional(v.boolean()),
    submissionLimitCount: v.optional(v.number()),
    // Hackathon team info settings
    showHackathonTeamInfo: v.optional(v.boolean()),
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
    .index("by_storyId", ["storyId"])
    .index("by_userId", ["userId"]),

  convexBoxConfig: defineTable({
    identifier: v.string(),
    isEnabled: v.boolean(),
    displayText: v.string(),
    linkUrl: v.string(),
    textAboveLogo: v.optional(v.boolean()),
    logoStorageId: v.optional(v.id("_storage")),
    boxSize: v.optional(v.union(v.literal("standard"), v.literal("square"))),
  }).index("by_identifier", ["identifier"]),

  reports: defineTable({
    storyId: v.id("stories"),
    reporterUserId: v.id("users"),
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("resolved_hidden"),
      v.literal("resolved_deleted"),
      v.literal("dismissed"),
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

  // New follows table
  follows: defineTable({
    followerId: v.id("users"), // The ID of the user who is performing the follow action
    followingId: v.id("users"), // The ID of the user who is being followed
  })
    .index("by_followerId_followingId", ["followerId", "followingId"]) // Unique constraint and quick lookups for unfollow
    .index("by_followingId", ["followingId"]) // To get all followers of a user
    .index("by_followerId", ["followerId"]), // To get all users a user is following

  // Form fields configuration for dynamic story form management
  storyFormFields: defineTable({
    key: v.string(), // Unique identifier for the field (e.g., "linkedinUrl", "twitterUrl")
    label: v.string(), // Display label for the field
    placeholder: v.string(), // Placeholder text
    isEnabled: v.boolean(), // Whether the field is shown in the form
    isRequired: v.boolean(), // Whether the field is required
    order: v.number(), // Display order in the form
    fieldType: v.union(v.literal("url"), v.literal("text"), v.literal("email")), // Field input type
    description: v.optional(v.string()), // Optional description text
    storyPropertyName: v.string(), // Property name in stories table (e.g., "linkedinUrl")
  })
    .index("by_key", ["key"])
    .index("by_order", ["order"])
    .index("by_enabled", ["isEnabled"]),

  // Judging system tables
  judgingGroups: defineTable({
    name: v.string(), // Display name for the judging group
    slug: v.string(), // URL-friendly identifier
    description: v.optional(v.string()), // Optional description of the group
    isPublic: v.boolean(), // Public (shareable link) or private access
    password: v.optional(v.string()), // Password for private groups (hashed)
    resultsIsPublic: v.optional(v.boolean()), // Whether results page is public (defaults to private)
    resultsPassword: v.optional(v.string()), // Password for private results pages
    isActive: v.boolean(), // Whether judging is currently active
    startDate: v.optional(v.number()), // Optional judging start time
    endDate: v.optional(v.number()), // Optional judging end time
    createdBy: v.id("users"), // Admin who created the group
  })
    .index("by_slug", ["slug"])
    .index("by_isPublic", ["isPublic"])
    .index("by_isActive", ["isActive"]),

  judgingCriteria: defineTable({
    groupId: v.id("judgingGroups"), // Associated judging group
    question: v.string(), // The judging question/criteria
    description: v.optional(v.string()), // Optional clarification/description
    weight: v.optional(v.number()), // Optional weighting factor (default 1.0)
    order: v.number(), // Display order
  }).index("by_groupId_order", ["groupId", "order"]),

  judgingGroupSubmissions: defineTable({
    groupId: v.id("judgingGroups"), // Associated judging group
    storyId: v.id("stories"), // Submission being judged
    addedBy: v.id("users"), // Admin who added the submission
    addedAt: v.number(), // When it was added to the group
  })
    .index("by_groupId", ["groupId"])
    .index("by_storyId", ["storyId"])
    .index("by_groupId_storyId", ["groupId", "storyId"]), // Unique constraint

  judges: defineTable({
    name: v.string(), // Judge's name
    email: v.optional(v.string()), // Optional email for communication
    groupId: v.id("judgingGroups"), // Associated judging group
    sessionId: v.string(), // Unique session identifier
    lastActiveAt: v.number(), // Last activity timestamp
  })
    .index("by_groupId", ["groupId"])
    .index("by_sessionId", ["sessionId"]),

  judgeScores: defineTable({
    judgeId: v.id("judges"), // Judge who gave the score
    groupId: v.id("judgingGroups"), // Associated judging group
    storyId: v.id("stories"), // Submission being scored
    criteriaId: v.id("judgingCriteria"), // Specific criteria being scored
    score: v.number(), // Score (1-10)
    comments: v.optional(v.string()), // Optional comments from judge
  })
    .index("by_judge_story_criteria", ["judgeId", "storyId", "criteriaId"]) // Unique constraint
    .index("by_groupId_storyId", ["groupId", "storyId"])
    .index("by_storyId", ["storyId"]),

  submissionStatuses: defineTable({
    groupId: v.id("judgingGroups"), // Associated judging group
    storyId: v.id("stories"), // Submission being tracked
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("skip"),
    ), // Current judging status
    assignedJudgeId: v.optional(v.id("judges")), // Judge assigned to this submission (if any)
    lastUpdatedBy: v.optional(v.id("judges")), // Judge who last updated the status
    lastUpdatedAt: v.number(), // When status was last updated
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_storyId", ["groupId", "storyId"]) // Unique constraint
    .index("by_status", ["status"])
    .index("by_assignedJudgeId", ["assignedJudgeId"]),

  submissionNotes: defineTable({
    groupId: v.id("judgingGroups"), // Associated judging group
    storyId: v.id("stories"), // Submission the note is about
    judgeId: v.id("judges"), // Judge who wrote the note
    content: v.string(), // Note content
    replyToId: v.optional(v.id("submissionNotes")), // For threaded replies
  })
    .index("by_groupId_storyId", ["groupId", "storyId"])
    .index("by_replyToId", ["replyToId"])
    .index("by_judgeId", ["judgeId"]),

  // Submit Forms Management System
  submitForms: defineTable({
    title: v.string(), // e.g., "YC AI Hackathon Submissions"
    slug: v.string(), // URL slug e.g., "ychack", "newform"
    description: v.optional(v.string()), // Form description
    isEnabled: v.boolean(), // Enable/disable form
    customHiddenTag: v.string(), // Hidden tag to auto-add (e.g., "ychackathon")
    headerText: v.optional(v.string()), // Custom header text
    submitButtonText: v.optional(v.string()), // Custom submit button text
    successMessage: v.optional(v.string()), // Custom success message
    disabledMessage: v.optional(v.string()), // Message when form is disabled
    isBuiltIn: v.optional(v.boolean()), // Mark built-in forms like YCHackForm
    createdBy: v.id("users"),
    submissionCount: v.optional(v.number()), // Track submissions
  })
    .index("by_slug", ["slug"])
    .index("by_enabled", ["isEnabled"])
    .index("by_createdBy", ["createdBy"]),

  submitFormToStoryFields: defineTable({
    formId: v.id("submitForms"),
    storyFieldId: v.id("storyFormFields"),
    order: v.number(),
  })
    .index("by_formId_order", ["formId", "order"])
    .index("by_storyFieldId", ["storyFieldId"])
    .index("by_formId_storyFieldId", ["formId", "storyFieldId"]),
});
