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
    inboxEnabled: v.optional(v.boolean()), // Inbox messaging toggle (default true)
    emojiTheme: v.optional(v.string()), // Emoji color theme preference: "default", "red", "blue", "green", "purple", "orange"
    nameCustomized: v.optional(v.boolean()), // True once the user edits their name in-app; blocks Clerk name sync from overwriting it
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]) // Index for fetching by username
    .searchIndex("search_users", {
      searchField: "name",
      filterFields: ["isBanned"],
    }),

  // Delegated admin access grants. Full admins (Clerk JWT role === "admin")
  // bypass this table entirely; everyone else needs a grant row here.
  adminPermissions: defineTable({
    userId: v.id("users"), // User receiving delegated access
    clerkId: v.string(), // Clerk ID for fast lookup from ctx.auth identity
    permissions: v.array(v.string()), // Permission keys, e.g. "tags.manage"
    judgingGroupIds: v.array(v.id("judgingGroups")), // Scoped judging groups
    allJudgingGroups: v.optional(v.boolean()), // True = every judging group
    grantedBy: v.id("users"), // Admin who granted access
    notes: v.optional(v.string()), // Optional audit note
  })
    .index("by_userId", ["userId"])
    .index("by_clerkId", ["clerkId"]),

  // Admin activity log: one row per notable event (email sends, submissions,
  // spam actions, judging, scoring, access grants, settings changes).
  activityLog: defineTable({
    category: v.union(
      v.literal("email"),
      v.literal("submission"),
      v.literal("spam"),
      v.literal("judging"),
      v.literal("scoring"),
      v.literal("moderation"),
      v.literal("access"),
      v.literal("settings"),
    ),
    action: v.string(), // Short event key, e.g. "story.submitted"
    message: v.string(), // Human-readable one-liner
    actorUserId: v.optional(v.id("users")),
    actorName: v.optional(v.string()), // Denormalized; "System" for background jobs
    targetType: v.optional(v.string()), // e.g. "story", "judgingGroup"
    targetId: v.optional(v.string()),
    targetLabel: v.optional(v.string()),
    groupId: v.optional(v.id("judgingGroups")), // Set on group-scoped events for the per-group log
    metadata: v.optional(v.any()),
    isArchived: v.boolean(), // Always written on insert so indexes stay dense
  })
    .index("by_archived", ["isArchived"])
    .index("by_archived_category", ["isArchived", "category"])
    .index("by_groupId", ["groupId"]),

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
    wasPinned: v.optional(v.boolean()), // Track if story was ever pinned in the past
    isArchived: v.optional(v.boolean()), // Archive submissions to hide from default view
    customMessage: v.optional(v.string()),
    isApproved: v.optional(v.boolean()),
    rejectionReason: v.optional(v.string()),
    email: v.optional(v.string()),
    // AI spam moderation: set when an admin confirms a flagged submission
    isSpam: v.optional(v.boolean()),
    spamReason: v.optional(v.string()), // Why it was marked (shown to the submitter)
    spamMarkedAt: v.optional(v.number()), // When it was marked
    spamMarkedBy: v.optional(v.id("users")), // Admin who confirmed the mark
    spamMarkedByAgent: v.optional(v.boolean()), // True when the automation agent marked it
    spamReviewRequestedAt: v.optional(v.number()), // When the author disputed the mark in-app
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
    // Self-reported AI build attribution. Metadata for organizers only:
    // these values are unverified and must NEVER feed into any scoring,
    // rubric criterion, clamp, or AI judge prompt context.
    selfReportedHarness: v.optional(v.string()), // e.g. "cursor", "claude-code"
    selfReportedModel: v.optional(v.string()), // e.g. "claude-sonnet-4-5"
    // Pasted hackathon.md contents for private/no-repo submissions. Capped
    // at 20k chars and secret-redacted server side. Self-reported context
    // for the AI judge; a repo copy of hackathon.md always wins over this.
    hackathonLog: v.optional(v.string()),
    // Answers to per-group custom submission questions (judging group custom
    // submit pages). Label is denormalized so answers keep meaning even if
    // the question is later edited or removed from the group config.
    customFormAnswers: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          value: v.string(),
        }),
      ),
    ),
    // Values for admin-added Manage Form Fields entries that have no
    // dedicated stories column. Label is denormalized from the field
    // definition so values stay readable if the field is edited or removed.
    dynamicFormValues: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          value: v.string(),
        }),
      ),
    ),
    // Changelog tracking for user edits
    changeLog: v.optional(
      v.array(
        v.object({
          timestamp: v.number(),
          textChanges: v.optional(
            v.array(
              v.object({
                field: v.string(),
                oldValue: v.string(),
                newValue: v.string(),
              }),
            ),
          ),
          linkChanges: v.optional(
            v.array(
              v.object({
                field: v.string(),
                oldValue: v.optional(v.string()),
                newValue: v.optional(v.string()),
              }),
            ),
          ),
          tagChanges: v.optional(
            v.object({
              added: v.array(v.string()),
              removed: v.array(v.string()),
            }),
          ),
          videoChanged: v.optional(v.boolean()),
          imagesChanged: v.optional(v.boolean()),
        }),
      ),
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_userId_isApproved", ["userId", "isApproved"])
    .index("by_url", ["url"]) // Duplicate-URL detection for spam checks
    .index("by_isSpam", ["isSpam"]) // Marked-spam review list
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
    hideInStoryDetail: v.optional(v.boolean()), // Hide tag only on the app detail page
    hideInStoryList: v.optional(v.boolean()), // Hide tag only on app card lists (list/grid/vibe)
    backgroundColor: v.optional(v.string()),
    textColor: v.optional(v.string()),
    borderColor: v.optional(v.string()),
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
    // Default /submit page layout: hide right sidebar and widen the form
    hideSubmitPageSidebar: v.optional(v.boolean()),
    // Tag limit settings (managed from Tags admin section)
    maxTagsPerSubmission: v.optional(v.number()), // Max visible tags per submission (hidden tags exempt)
    maxTagLength: v.optional(v.number()), // Max characters for a new tag name
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

  userReports: defineTable({
    reportedUserId: v.id("users"), // User being reported
    reporterUserId: v.id("users"), // User making the report
    reason: v.string(), // Reason for the report
    status: v.union(
      v.literal("pending"),
      v.literal("resolved_warned"),
      v.literal("resolved_banned"),
      v.literal("resolved_paused"),
      v.literal("dismissed"),
    ),
  })
    .index("by_reportedUserId", ["reportedUserId"])
    .index("by_status", ["status"])
    .index("by_reporterUserId", ["reporterUserId"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    storyId: v.id("stories"),
  })
    .index("by_user_story", ["userId", "storyId"])
    .index("by_userId", ["userId"])
    .index("by_storyId", ["storyId"]),

  // Site files (robots.txt, llms.txt) generated content
  siteFiles: defineTable({
    key: v.string(), // e.g., "robots.txt" or "llms.txt"
    content: v.string(), // file body
    updatedAt: v.number(), // timestamp
  }).index("by_key", ["key"]),

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
    fieldType: v.union(
      v.literal("url"),
      v.literal("text"),
      v.literal("email"),
      v.literal("textarea"),
      v.literal("radio"),
      v.literal("multiselect"),
      v.literal("select"),
    ), // Field input type
    options: v.optional(v.array(v.string())), // Choices for radio/multiselect/select fields
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
    password: v.optional(v.string()), // DEPRECATED: Old password field (kept for backward compatibility)
    judgePassword: v.optional(v.string()), // Password for judge access to judging interface (hashed)
    submissionPagePassword: v.optional(v.string()), // Password for custom submission page access (hashed)
    resultsIsPublic: v.optional(v.boolean()), // Whether results page is public (defaults to private)
    resultsPassword: v.optional(v.string()), // Password for private results pages (hashed)
    isActive: v.boolean(), // Whether judging is currently active (controlled by admin)
    startDate: v.optional(v.number()), // Optional start date timestamp for judging period
    endDate: v.optional(v.number()), // Optional end date timestamp for judging period
    createdBy: v.id("users"), // Admin who created the group
    // Custom submission page settings
    hasCustomSubmissionPage: v.optional(v.boolean()), // Enable custom submission page
    submissionPageImageId: v.optional(v.id("_storage")), // Header image for submission page
    submissionPageImageSize: v.optional(v.number()), // Image size in pixels (square crop only)
    submissionPageImageAspect: v.optional(
      v.union(v.literal("square"), v.literal("wide")),
    ), // Header image crop: square (1:1, default) or wide (16:9, fills layout width)
    submissionPageLayout: v.optional(
      v.union(
        v.literal("two-column"),
        v.literal("one-third"),
        v.literal("single"),
      ),
    ), // Layout style: two-column (50/50), one-third (33/67), or single column
    submissionPageTitle: v.optional(v.string()), // Custom title for submission page
    submissionPageDescription: v.optional(v.string()), // Rich text description
    submissionPageLinks: v.optional(
      v.array(
        v.object({
          label: v.string(),
          url: v.string(),
        }),
      ),
    ), // External links to display
    submissionFormTitle: v.optional(v.string()), // Custom title for submission form (default: "Submit Your App")
    submissionFormSubtitle: v.optional(v.string()), // Optional subtitle text below form title
    submissionFormRequiredTagId: v.optional(v.id("tags")), // Required tag that will be auto-selected and locked in submission form
    // Whether the locked required tag is visible to submitters on the form
    // (pills, quick select, tag counter). Unset = shown. Display only: the tag
    // is always applied on submit, and Tag Management's isHidden flag keeps
    // controlling story cards and tag limits site-wide so the two never conflict.
    submissionFormRequiredTagVisible: v.optional(v.boolean()),
    // Auto-populate by multiple tags (OR match) within an optional date range.
    // Separate from the single required form tag above. Matching stories are
    // materialized into judgingGroupSubmissions so judging/results work unchanged.
    autoIncludeTagIds: v.optional(v.array(v.id("tags"))), // Tags to match
    // How selected tags are matched: "any" (OR, at least one) or "all" (AND, every selected tag required). Defaults to "any".
    autoIncludeMatchMode: v.optional(
      v.union(v.literal("any"), v.literal("all")),
    ),
    autoIncludeStartDate: v.optional(v.number()), // Inclusive lower bound on story creation time (ms)
    autoIncludeEndDate: v.optional(v.number()), // Inclusive upper bound on story creation time (ms)
    // Admin-selectable required fields for the custom submission form. Unset keys fall back to defaults.
    // teamInfo/additionalImages/additionalLinks mark whole form sections required:
    // teamInfo = team name required, additionalImages = at least one extra image,
    // additionalLinks = at least one link field filled.
    submissionFieldRequirements: v.optional(
      v.object({
        title: v.optional(v.boolean()),
        tagline: v.optional(v.boolean()),
        longDescription: v.optional(v.boolean()),
        url: v.optional(v.boolean()),
        githubUrl: v.optional(v.boolean()),
        videoUrl: v.optional(v.boolean()),
        screenshot: v.optional(v.boolean()),
        submitterName: v.optional(v.boolean()),
        email: v.optional(v.boolean()),
        tags: v.optional(v.boolean()),
        teamInfo: v.optional(v.boolean()),
        additionalImages: v.optional(v.boolean()),
        additionalLinks: v.optional(v.boolean()),
      }),
    ),
    // Admin-selectable visible fields for the custom submission form.
    // Unset key = visible (backward compatible). Title can never be hidden
    // because judging, results, and the AI judge all key off it.
    // teamInfo/additionalImages/additionalLinks control whole form sections.
    submissionFieldVisibility: v.optional(
      v.object({
        title: v.optional(v.boolean()),
        tagline: v.optional(v.boolean()),
        longDescription: v.optional(v.boolean()),
        url: v.optional(v.boolean()),
        githubUrl: v.optional(v.boolean()),
        videoUrl: v.optional(v.boolean()),
        screenshot: v.optional(v.boolean()),
        submitterName: v.optional(v.boolean()),
        email: v.optional(v.boolean()),
        tags: v.optional(v.boolean()),
        teamInfo: v.optional(v.boolean()),
        additionalImages: v.optional(v.boolean()),
        additionalLinks: v.optional(v.boolean()),
      }),
    ),
    // Admin-defined extra questions appended to the custom submission form.
    // Answers are stored on stories.customFormAnswers with the label
    // denormalized so they stay readable if a question is edited or removed.
    submissionCustomQuestions: v.optional(
      v.array(
        v.object({
          key: v.string(), // Stable slug, unique within the group
          label: v.string(),
          placeholder: v.optional(v.string()),
          description: v.optional(v.string()),
          fieldType: v.union(
            v.literal("text"),
            v.literal("url"),
            v.literal("email"),
            v.literal("textarea"),
            v.literal("radio"),
            v.literal("multiselect"),
            v.literal("select"),
          ),
          options: v.optional(v.array(v.string())), // Choices for radio/multiselect/select questions
          required: v.boolean(),
          // Unset = shown. Hidden questions stay stored but never render.
          visible: v.optional(v.boolean()),
        }),
      ),
    ),
    // Per-group overrides for admin-managed Form Fields (storyFormFields),
    // keyed by field key. Unset = enabled fields render with their global
    // required setting. visible=false removes the field from this group's form.
    submissionDynamicFieldOverrides: v.optional(
      v.record(
        v.string(),
        v.object({
          required: v.optional(v.boolean()),
          visible: v.optional(v.boolean()),
        }),
      ),
    ),
    // Multi-judge: how many judges must complete each submission (default 1 = single-judge behavior)
    judgesPerSubmission: v.optional(v.number()),
    // Human judging score scale: 5 (1-5) or 10 (1-10). Unset = 10 for backward compatibility.
    scoreScale: v.optional(v.union(v.literal(5), v.literal(10))),
    // AI Judge (Best Use of Convex) settings. Fully separate from human judging.
    aiJudgeEnabled: v.optional(v.boolean()), // Enable AI judge for this group
    aiResultsIsPublic: v.optional(v.boolean()), // Whether AI results page is public (defaults to private)
    aiResultsPassword: v.optional(v.string()), // Password for private AI results page (hashed)
    // Optional per-criterion weights for the AI rubric (built-in + custom
    // criteria). Absent = weight 1 for every key. weightedScore is derived
    // in queries, never stored.
    aiRubricWeights: v.optional(
      v.array(v.object({ key: v.string(), weight: v.number() })),
    ),
    // Per-platform weights for the frontend-checker criterion. Fixed keys:
    // codex-sites, convex-hosting, vercel, netlify, other. Absent = weight 1
    // for every platform. The detected platform's weight multiplies the
    // frontend-checker criterion weight in the derived weighted score.
    aiFrontendWeights: v.optional(
      v.array(v.object({ key: v.string(), weight: v.number() })),
    ),
    // Admin-defined extra AI rubric criteria appended to the built-in six.
    // The AI judge scores these alongside the fixed rubric.
    aiCustomCriteria: v.optional(
      v.array(
        v.object({
          key: v.string(), // Lowercase slug, unique, no clash with built-in keys
          label: v.string(), // Display label
          description: v.string(), // What the AI judge should evaluate
        }),
      ),
    ),
    // Rubric keys (built-in or custom) switched off for this group. Disabled
    // criteria are excluded from the AI prompt, scoring, and rankings.
    aiDisabledCriteria: v.optional(v.array(v.string())),
    // Custom AI judge system prompt body. Absent = built-in default prompt.
    // Supports a {{rubric}} placeholder; the JSON response contract is
    // always appended by the analysis action and is never editable.
    aiJudgeSystemPrompt: v.optional(v.string()),
    // When true (the default), scores written by agent judges are advisory:
    // shown with an agent badge but excluded from final rankings.
    agentScoresAdvisory: v.optional(v.boolean()),
    // Whether the agent judging HTTP API is enabled for this group.
    // Absent = enabled. When false, key creation is blocked and every
    // keyed API call returns 403.
    agentKeysEnabled: v.optional(v.boolean()),
    // DEPRECATED: hackathon skill API fields. The /api/hackathon/{slug}
    // endpoints were removed; the simplified skill keeps one hackathon.md
    // file and needs no registration. Kept optional so existing rows stay
    // valid. Safe to remove after a production cleanup migration.
    hackathonSkillEnabled: v.optional(v.boolean()),
    hackathonRegistrationCodes: v.optional(v.array(v.string())),
    hackathonRules: v.optional(v.string()),
    hackathonRulesUpdatedAt: v.optional(v.number()),
    // Organizer emails for the per-group new-submission alert. Empty or
    // absent means no alert; the dashboard toggle controls the type globally.
    notificationEmails: v.optional(v.array(v.string())),
  })
    .index("by_slug", ["slug"])
    .index("by_isPublic", ["isPublic"])
    .index("by_isActive", ["isActive"]),

  // AI Judge results: one row per group+story, upserted on re-run.
  // Stored separately from judgeScores so human judging is untouched.
  aiJudgeResults: defineTable({
    groupId: v.id("judgingGroups"), // Associated judging group
    storyId: v.id("stories"), // Submission reviewed
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ), // Review lifecycle state
    criteriaScores: v.optional(
      v.array(
        v.object({
          key: v.string(), // Fixed rubric key (e.g., "schema")
          label: v.string(), // Display label
          score: v.number(), // 1-10
          reasoning: v.string(), // Why the AI gave this score
        }),
      ),
    ),
    totalScore: v.optional(v.number()), // Sum of criteria scores
    averageScore: v.optional(v.number()), // Average across criteria
    overallReasoning: v.optional(v.string()), // Overall note on why it scored the submission this way
    convexFeaturesDetected: v.optional(v.array(v.string())), // Convex features (deterministic, derived from repoFacts on new runs)
    componentsDetected: v.optional(v.array(v.string())), // Components INSTALLED (package.json / convex.config.ts)
    componentsUsed: v.optional(v.array(v.string())), // Components actually referenced in code (components.<name>) - the only list scoring may reward
    provider: v.optional(v.string()), // DEPRECATED: judging model provider. Remove after backfillJudgeModelFields has run in production.
    model: v.optional(v.string()), // DEPRECATED: judging model. Remove after backfillJudgeModelFields has run in production.
    judgeProvider: v.optional(v.string()), // AI provider used to run the review ("anthropic" | "openai" | "openrouter")
    judgeModel: v.optional(v.string()), // Model used to run the review (NOT the participant's model)
    // Deterministic Convex facts counted from the repo before the model sees it
    repoFacts: v.optional(
      v.object({
        convexFileCount: v.number(),
        hasSchema: v.boolean(),
        hasHttpRouter: v.boolean(),
        hasCrons: v.boolean(),
        hasConvexConfig: v.boolean(),
        tableCount: v.number(),
        indexCount: v.number(),
        searchIndexCount: v.number(),
        vectorIndexCount: v.number(),
        queryCount: v.number(),
        mutationCount: v.number(),
        actionCount: v.number(),
        httpActionCount: v.number(),
        usesScheduler: v.boolean(),
        usesStorage: v.boolean(),
        usesVectorSearch: v.boolean(),
        usesAuth: v.boolean(),
        usesPagination: v.boolean(),
        returnsValidatorCount: v.number(),
      }),
    ),
    // Git history facts from the GitHub commits API (committer dates)
    gitFacts: v.optional(
      v.object({
        firstCommitAt: v.optional(v.number()),
        lastCommitAt: v.optional(v.number()),
        commitCount: v.number(),
        commitCountCapped: v.boolean(),
        activeDayCount: v.number(),
        contributorCount: v.number(),
        builtDuringEvent: v.union(
          v.literal("in_window"),
          v.literal("started_before"),
          v.literal("no_window_set"),
        ),
        repoCreatedAt: v.optional(v.number()),
        isFork: v.boolean(),
        parentRepo: v.optional(v.string()),
      }),
    ),
    // Detected AI harness signals. Metadata for organizers only: NEVER fed
    // into scoring, clamps, or the judging prompt. Never collapse to one tool.
    harnessSignals: v.optional(
      v.array(
        v.object({
          tool: v.string(),
          source: v.union(
            v.literal("commit_trailer"),
            v.literal("config_file"),
          ),
          evidence: v.string(),
          confidence: v.union(
            v.literal("high"),
            v.literal("medium"),
            v.literal("low"),
          ),
        }),
      ),
    ),
    // Whether the GitHub repo was reachable at review time
    repoAccess: v.optional(
      v.union(v.literal("public"), v.literal("private_or_missing")),
    ),
    error: v.optional(v.string()), // Error message when status is "failed"
    sourcesUsed: v.optional(
      v.object({
        github: v.boolean(), // Whether the GitHub repo was fetched
        liveUrl: v.boolean(), // Whether the live URL was scraped
        videoTranscript: v.optional(v.boolean()), // Whether a video transcript/page scrape was included
      }),
    ),
    urlCheck: v.optional(
      v.object({
        checkedUrl: v.optional(v.string()), // The live app URL that was checked
        isLive: v.boolean(), // Whether the URL responded successfully
        statusCode: v.optional(v.number()), // HTTP status code when a response was received
        note: v.string(), // Short reason ("OK", "404 Not Found", "network error", "no URL provided")
      }),
    ),
    // Deterministic frontend hosting detection (URL host, response headers,
    // repo signals). Drives the per-platform frontend-checker weight.
    frontendHosting: v.optional(
      v.object({
        platform: v.string(), // "codex-sites" | "convex-hosting" | "vercel" | "netlify" | "other"
        evidence: v.string(), // What matched (host suffix, header, or repo file)
      }),
    ),
    // Cross-check notes comparing the hackathon.md header claims against
    // detected facts (frontend platform, components, auth provider).
    // Recorded for organizers only; never affects any score or weight.
    logDiscrepancies: v.optional(v.array(v.string())),
    // Event free text from the hackathon.md header (repo copy wins over a
    // pasted one). Shown beside track info in admin results; never scored.
    hackathonLogEvent: v.optional(v.string()),
    editedBy: v.optional(v.id("users")), // Admin who last edited scores
    editedAt: v.optional(v.number()), // When scores were last edited
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_storyId", ["groupId", "storyId"]),

  // Video demo transcripts scraped for AI judging. One row per story,
  // upserted on refetch. Markdown is unverified builder narrative and must
  // never override verified repo facts in the judge prompt.
  videoTranscripts: defineTable({
    storyId: v.id("stories"), // Submission the video belongs to
    videoUrl: v.string(), // The exact URL that was scraped (cache key)
    provider: v.union(v.literal("contextdev"), v.literal("firecrawl")), // Which scraper produced the result
    kind: v.union(
      v.literal("youtube"), // YouTube video: transcript from captions when available
      v.literal("page"), // Other video host page scrape (Vimeo, Loom, etc.)
      v.literal("unsupported"), // Direct media file or unrecognized URL
    ),
    status: v.union(
      v.literal("completed"), // Markdown captured (transcript or page content)
      v.literal("no_transcript"), // YouTube video without captions: metadata only
      v.literal("failed"), // Scrape attempted but errored
      v.literal("unsupported"), // Not scrapeable (direct media file)
    ),
    markdown: v.optional(v.string()), // Scraped markdown, capped before storage
    metadata: v.optional(
      v.object({
        title: v.optional(v.string()),
        channel: v.optional(v.string()),
        durationSeconds: v.optional(v.number()),
      }),
    ),
    contentLength: v.number(), // Character length of stored markdown (0 when none)
    errorMessage: v.optional(v.string()), // Why the scrape failed, when it did
    fetchedAt: v.number(), // When the scrape ran (cache freshness)
  }).index("by_story", ["storyId"]),

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
    userId: v.optional(v.id("users")), // Optional link to authenticated user profile
    type: v.optional(v.union(v.literal("human"), v.literal("agent"))), // Absent means human
    // Self-declared metadata for agent judges (model, harness, operator)
    agentMetadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        harness: v.optional(v.string()),
        operator: v.optional(v.string()),
      }),
    ),
  })
    .index("by_groupId", ["groupId"])
    .index("by_sessionId", ["sessionId"])
    .index("by_userId", ["userId"]),

  // API keys for external AI agent judges. Only the SHA-256 hash is stored;
  // the raw key is shown exactly once at creation.
  agentJudgeKeys: defineTable({
    groupId: v.id("judgingGroups"), // Group this key can judge
    name: v.string(), // Label shown to admins (e.g. "claude-agent-1")
    keyHash: v.string(), // SHA-256 hex digest of the raw key
    judgeId: v.id("judges"), // The agent judge identity scores are written as
    createdBy: v.id("users"), // Admin who created the key
    revokedAt: v.optional(v.number()), // Set when the key is revoked
    lastUsedAt: v.optional(v.number()), // Last authenticated call
    callCount: v.number(), // Approximate authenticated call count
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_groupId", ["groupId"]),

  // DEPRECATED: audit trail from the removed hackathon skill registration
  // endpoint. Table kept so existing production rows stay valid; no code
  // writes to it anymore. Safe to drop after a production cleanup.
  hackathonRegistrations: defineTable({
    groupId: v.id("judgingGroups"), // Group the code belongs to
    code: v.string(), // Registration code used (uppercased)
    teamName: v.string(), // Team name reported by the skill
    email: v.optional(v.string()), // Optional contact email
    registeredAt: v.number(), // When the team registered
  }).index("by_groupId", ["groupId"]),

  judgeScores: defineTable({
    judgeId: v.id("judges"), // Judge who gave the score
    groupId: v.id("judgingGroups"), // Associated judging group
    storyId: v.id("stories"), // Submission being scored
    criteriaId: v.id("judgingCriteria"), // Specific criteria being scored
    score: v.number(), // Score (1-10)
    comments: v.optional(v.string()), // Optional comments from judge
    isHidden: v.optional(v.boolean()), // Admin can hide scores from results
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

  // Multi-judge completion tracking: each judge writes their own row to avoid OCC conflicts
  submissionJudgeCompletions: defineTable({
    groupId: v.id("judgingGroups"),
    storyId: v.id("stories"),
    judgeId: v.id("judges"),
    completedAt: v.number(),
  })
    .index("by_groupId_storyId", ["groupId", "storyId"])
    .index("by_group_story_judge", ["groupId", "storyId", "judgeId"])
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

  // Mentions system for @username references in comments and judging notes
  mentions: defineTable({
    actorUserId: v.id("users"), // Who wrote the content
    targetUserId: v.id("users"), // Who was mentioned
    context: v.union(v.literal("comment"), v.literal("judge_note")), // Where the mention occurred
    sourceId: v.union(v.id("comments"), v.id("submissionNotes")), // ID of comment or note
    storyId: v.id("stories"), // Always present for both contexts
    groupId: v.optional(v.id("judgingGroups")), // Present for judge notes
    contentExcerpt: v.string(), // First 240 chars for moderation and email previews
    date: v.string(), // Calendar date YYYY-MM-DD for indexed rate limiting and digest queries
  })
    .index("by_actor_and_date", ["actorUserId", "date"]) // For fast quota checks
    .index("by_target_and_date", ["targetUserId", "date"]) // For future daily email rollups
    .index("by_context_and_source", ["context", "sourceId"]), // For debugging and idempotency checks

  // Alerts notifications system
  alerts: defineTable({
    recipientUserId: v.id("users"), // Who receives the notification
    actorUserId: v.optional(v.id("users")), // Who performed the action (null for system events like judged)
    type: v.union(
      v.literal("vote"),
      v.literal("comment"),
      v.literal("reply"),
      v.literal("mention"),
      v.literal("rating"),
      v.literal("follow"),
      v.literal("judged"),
      v.literal("bookmark"),
      v.literal("report"),
      v.literal("verified"),
      v.literal("pinned"),
      v.literal("admin_message"),
      v.literal("message"), // Direct message alert
      v.literal("dm_report"), // DM report alert for admins
      v.literal("spam"), // Submission marked as spam by an admin
    ),
    storyId: v.optional(v.id("stories")), // Related story for vote, comment, rating, judged alerts
    commentId: v.optional(v.id("comments")), // Specific comment for comment alerts
    ratingValue: v.optional(v.number()), // Rating value for rating alerts
    isRead: v.boolean(), // Read status
    readAt: v.optional(v.number()), // When alert was marked as read
  })
    .index("by_recipient", ["recipientUserId"]) // Paginate and order by _creationTime desc
    .index("by_recipient_and_isRead", ["recipientUserId", "isRead"]), // Efficient unread checks

  // Email preferences per user (for Resend integration)
  emailSettings: defineTable({
    userId: v.id("users"),
    // Master kill switch for this user
    unsubscribedAt: v.optional(v.number()),
    // Granular controls
    dailyEngagementEmails: v.optional(v.boolean()),
    messageNotifications: v.optional(v.boolean()),
    marketingEmails: v.optional(v.boolean()),
    weeklyDigestEmails: v.optional(v.boolean()),
    mentionNotifications: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Track email sends to prevent duplicates and for analytics
  emailLogs: defineTable({
    userId: v.optional(v.id("users")), // Optional for admin emails
    emailType: v.union(
      v.literal("daily_admin"),
      v.literal("daily_engagement"),
      v.literal("welcome"),
      v.literal("message_notification"),
      v.literal("weekly_digest"),
      v.literal("mention_notification"),
      v.literal("admin_broadcast"),
      v.literal("admin_report_notification"),
      v.literal("admin_user_report_notification"),
      v.literal("spam_notification"),
      v.literal("submission_confirmation"),
      v.literal("submission_admin_alert"),
      v.literal("results_live"),
      v.literal("judging_group"),
    ),
    recipientEmail: v.string(),
    sentAt: v.number(),
    resendMessageId: v.optional(v.string()), // Store Resend message ID
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
    ),
    metadata: v.optional(v.any()), // Store email-specific data
  })
    .index("by_user_type_date", ["userId", "emailType", "sentAt"])
    .index("by_type_date", ["emailType", "sentAt"])
    .index("by_resend_id", ["resendMessageId"]),

  // Reusable email templates managed in the admin Email dashboard. Bodies
  // and signatures are markdown-lite with {{variable}} placeholders that get
  // substituted per recipient at send time.
  emailTemplates: defineTable({
    name: v.string(),
    subject: v.string(),
    body: v.string(), // markdown-lite content
    signature: v.optional(v.string()), // optional markdown-lite signature
    createdBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // Scheduled judging group emails waiting for their send time. Recipients
  // are resolved when the send is scheduled; delivery runs via
  // ctx.scheduler.runAt and marks the row sent (or an organizer cancels it,
  // which also cancels the scheduled function).
  groupScheduledEmails: defineTable({
    groupId: v.id("judgingGroups"),
    subject: v.string(),
    body: v.string(),
    signature: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    templateId: v.optional(v.id("emailTemplates")),
    sentBy: v.id("users"),
    recipients: v.array(v.object({ name: v.string(), email: v.string() })),
    scheduledFor: v.number(),
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("cancelled"),
    ),
  }).index("by_groupId", ["groupId"]),

  // Track daily engagement for users (for email content)
  dailyEngagementSummary: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    votesReceived: v.number(),
    ratingsReceived: v.number(),
    commentsReceived: v.number(),
    bookmarksReceived: v.number(),
    totalEngagement: v.number(),
    storyEngagements: v.array(
      v.object({
        storyId: v.id("stories"),
        storyTitle: v.string(),
        storySlug: v.optional(v.string()),
        votes: v.number(),
        ratings: v.number(),
        comments: v.number(),
        bookmarks: v.number(),
      }),
    ),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_date", ["date"]),

  // Daily platform metrics snapshot
  dailyMetrics: defineTable({
    date: v.string(), // YYYY-MM-DD format
    newSubmissions: v.number(),
    newUsers: v.number(),
    totalUsers: v.number(),
    dailyVotes: v.number(),
    dailyComments: v.number(),
    dailyRatings: v.number(),
    dailyBookmarks: v.number(),
    dailyFollows: v.number(),
    activeUsers: v.number(), // Users who logged in that day
    pendingReports: v.number(),
    resolvedReports: v.number(),
  }).index("by_date", ["date"]),

  // Unsubscribe tokens for one-click unsubscribe links
  emailUnsubscribeTokens: defineTable({
    userId: v.id("users"),
    token: v.string(), // signed token
    purpose: v.union(
      v.literal("all"),
      v.literal("daily_engagement"),
      v.literal("weekly_digest"),
      v.literal("marketing"),
    ),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Admin broadcast campaigns
  broadcastEmails: defineTable({
    createdBy: v.id("users"),
    subject: v.string(),
    html: v.string(),
    filter: v.optional(v.object({})), // optional targeting; keep simple in v1
    status: v.union(
      v.literal("draft"),
      v.literal("queued"),
      v.literal("sending"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    totalRecipients: v.optional(v.number()),
    sentCount: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  // App/site settings (global flags)
  appSettings: defineTable({
    key: v.string(), // e.g., "emailsEnabled"
    valueBoolean: v.optional(v.boolean()),
    valueString: v.optional(v.string()),
    valueNumber: v.optional(v.number()),
  }).index("by_key", ["key"]),

  // Direct message conversations between users
  dmConversations: defineTable({
    userAId: v.id("users"),
    userBId: v.id("users"),
    lastMessageId: v.optional(v.id("dmMessages")),
    lastActivityTime: v.number(),
  })
    .index("by_userA_userB", ["userAId", "userBId"])
    .index("by_userA_activity", ["userAId", "lastActivityTime"])
    .index("by_userB_activity", ["userBId", "lastActivityTime"]),

  // Individual messages within conversations
  dmMessages: defineTable({
    conversationId: v.id("dmConversations"),
    senderId: v.id("users"),
    content: v.string(), // Max 2000 characters
    parentMessageId: v.optional(v.id("dmMessages")), // For threading
    deletedBy: v.optional(v.array(v.id("users"))), // Track which users deleted this message
  })
    .index("by_conversation", ["conversationId"])
    .index("by_parent", ["parentMessageId"]),

  // Track deleted conversations per user (soft delete)
  dmDeletedConversations: defineTable({
    conversationId: v.id("dmConversations"),
    userId: v.id("users"),
  })
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),

  // Track read status per user per conversation
  dmReads: defineTable({
    conversationId: v.id("dmConversations"),
    userId: v.id("users"),
    lastReadTime: v.number(),
  })
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),

  // Reports for messages and users
  dmReports: defineTable({
    reporterId: v.id("users"),
    reportedUserId: v.id("users"),
    messageId: v.optional(v.id("dmMessages")),
    conversationId: v.id("dmConversations"),
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("action_taken"),
    ),
    adminNotes: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_reporter", ["reporterId"])
    .index("by_reported_user", ["reportedUserId"]),

  // Rate limiting tracking
  dmRateLimits: defineTable({
    userId: v.id("users"),
    recipientId: v.optional(v.id("users")), // For per-recipient limits
    windowStart: v.number(),
    messageCount: v.number(),
    limitType: v.union(
      v.literal("hourly_per_recipient"),
      v.literal("daily_global"),
    ),
  })
    .index("by_user_type_window", ["userId", "limitType", "windowStart"])
    .index("by_user_recipient_window", [
      "userId",
      "recipientId",
      "windowStart",
    ]),

  // User blocking for direct messages
  blockedUsers: defineTable({
    blockerId: v.id("users"), // User who blocked someone
    blockedUserId: v.id("users"), // User who got blocked
  })
    .index("by_blocker_blocked", ["blockerId", "blockedUserId"]) // Check if specific user is blocked
    .index("by_blocker", ["blockerId"]) // Get all users blocked by someone
    .index("by_blocked", ["blockedUserId"]), // Get all users who blocked someone

  // Emoji reactions for direct messages
  dmReactions: defineTable({
    messageId: v.id("dmMessages"), // Message being reacted to
    userId: v.id("users"), // User who reacted
    emoji: v.string(), // One of predefined emojis: "👍", "❤️", "😂", "😮", "😢", "👏"
  })
    .index("by_message", ["messageId"]) // Get all reactions for a message
    .index("by_user_message", ["userId", "messageId"]), // Check if user already reacted to message

  // AI spam check results: one row per story, upserted on re-scan.
  // The AI only flags; a human admin confirms via markAsSpam.
  spamCheckResults: defineTable({
    storyId: v.id("stories"), // Submission that was scanned
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ), // Scan lifecycle state
    verdict: v.optional(
      v.union(v.literal("spam"), v.literal("suspicious"), v.literal("clean")),
    ), // Final verdict once completed
    confidence: v.optional(v.number()), // 0-100 confidence in the verdict
    reasons: v.optional(v.array(v.string())), // Human-readable reasons behind the verdict
    llmReasoning: v.optional(v.string()), // Full model explanation
    // Deterministic signals measured before the model sees anything
    signals: v.optional(
      v.object({
        urlLive: v.boolean(), // Live app URL responded
        urlNote: v.string(), // Liveness detail ("OK", "404 Not Found", ...)
        urlStatusCode: v.optional(v.number()),
        scrapedContent: v.boolean(), // Firecrawl scrape succeeded
        duplicateUrlCount: v.number(), // Other stories sharing the same URL
        repoChecked: v.boolean(), // GitHub repo check ran (requires GITHUB_TOKEN)
        repoAccessible: v.optional(v.boolean()), // Repo is public and reachable
        repoFileCount: v.optional(v.number()), // Files in the repo tree
        repoIsEmpty: v.optional(v.boolean()), // Effectively empty repo (< 3 files)
        repoNote: v.optional(v.string()), // Repo check detail
        linksChecked: v.array(
          v.object({
            label: v.string(), // Which field the link came from
            url: v.string(),
            ok: v.boolean(),
            note: v.string(),
          }),
        ),
      }),
    ),
    provider: v.optional(v.string()), // LLM provider used ("anthropic" | "openai" | "openrouter" | "heuristic")
    model: v.optional(v.string()), // Model used for the verdict
    error: v.optional(v.string()), // Error message when status is "failed"
    triggeredBy: v.union(v.literal("auto"), v.literal("manual")), // Auto on submit or manual batch scan
    checkedAt: v.optional(v.number()), // When the scan completed
  })
    .index("by_storyId", ["storyId"])
    .index("by_status", ["status"])
    .index("by_verdict", ["verdict"]),
});
