import { v } from "convex/values";

// Validator for Doc<"tags">
export const tagDocValidator = v.object({
  _id: v.id("tags"),
  _creationTime: v.number(),
  name: v.string(),
  showInHeader: v.boolean(),
  isHidden: v.optional(v.boolean()),
  backgroundColor: v.optional(v.string()),
  textColor: v.optional(v.string()),
});

// Validator for StoryWithDetails type
export const storyWithDetailsValidator = v.object({
  // Fields from Doc<"stories">
  _id: v.id("stories"),
  _creationTime: v.number(),
  title: v.string(),
  slug: v.string(),
  url: v.string(),
  description: v.string(),
  tagIds: v.array(v.id("tags")),
  userId: v.optional(v.id("users")),
  votes: v.number(),
  commentCount: v.number(),
  customMessage: v.optional(v.string()),
  screenshotId: v.optional(v.id("_storage")),
  ratingSum: v.number(),
  ratingCount: v.number(),
  linkedinUrl: v.optional(v.string()),
  twitterUrl: v.optional(v.string()),
  githubUrl: v.optional(v.string()),
  chefAppUrl: v.optional(v.string()),
  chefShowUrl: v.optional(v.string()),
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  isHidden: v.optional(v.boolean()),
  isPinned: v.optional(v.boolean()),
  isApproved: v.optional(v.boolean()),

  // Added fields for StoryWithDetails
  voteScore: v.number(),
  screenshotUrl: v.union(v.string(), v.null()),
  tags: v.array(tagDocValidator), // Use the tagDocValidator here
});
