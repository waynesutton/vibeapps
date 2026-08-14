import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Validator for Doc<"tags"> for use in other validators
export const tagDocValidator = v.object({
  _id: v.id("tags"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  showInHeader: v.boolean(),
  isHidden: v.optional(v.boolean()),
  hideInStoryDetail: v.optional(v.boolean()),
  hideInStoryList: v.optional(v.boolean()),
  backgroundColor: v.optional(v.string()),
  textColor: v.optional(v.string()),
  borderColor: v.optional(v.string()),
  emoji: v.optional(v.string()),
  iconUrl: v.optional(v.string()),
});

// Validator for the main story document fields that are directly from the 'stories' table
export const baseStoryValidator = {
  _id: v.id("stories"),
  _creationTime: v.number(),
  title: v.string(),
  slug: v.string(),
  url: v.string(),
  description: v.string(), // Short tagline
  longDescription: v.optional(v.string()), // Detailed description
  submitterName: v.optional(v.string()), // Name from form input
  tagIds: v.array(v.id("tags")),
  userId: v.optional(v.id("users")), // Made optional to support anonymous submissions
  votes: v.number(),
  commentCount: v.number(), // This should be updated by a separate mechanism or a trigger
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
  wasPinned: v.optional(v.boolean()),
  isArchived: v.optional(v.boolean()),
  customMessage: v.optional(v.string()),
  isApproved: v.optional(v.boolean()),
  rejectionReason: v.optional(v.string()),
  email: v.optional(v.string()),
  // AI spam moderation fields (mirrors stories table schema)
  isSpam: v.optional(v.boolean()),
  spamReason: v.optional(v.string()),
  spamMarkedAt: v.optional(v.number()),
  spamMarkedBy: v.optional(v.id("users")),
  // Hackathon team info
  teamName: v.optional(v.string()),
  teamMemberCount: v.optional(v.number()),
  teamMembers: v.optional(
    v.array(
      v.object({
        name: v.string(),
        email: v.optional(v.string()),
      }),
    ),
  ),
  // Self-reported AI build attribution (metadata only, never used in scoring)
  selfReportedHarness: v.optional(v.string()),
  selfReportedModel: v.optional(v.string()),
  // Answers to per-group custom submission questions
  customFormAnswers: v.optional(
    v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        value: v.string(),
      }),
    ),
  ),
  // Values for admin-added form fields without a dedicated stories column
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
};

// Validator for StoryWithDetails - includes author and tag details
export const storyWithDetailsValidator = v.object({
  ...baseStoryValidator,
  // Joined data (not directly on stories table but added by queries)
  authorName: v.optional(v.string()),
  authorUsername: v.optional(v.string()),
  authorImageUrl: v.optional(v.string()),
  authorEmail: v.optional(v.string()),
  authorIsVerified: v.optional(v.boolean()),
  tags: v.array(tagDocValidator), // Array of full tag objects
  screenshotUrl: v.union(v.string(), v.null()), // URL for the screenshot
  additionalImageUrls: v.array(v.string()), // URLs for additional images
  voteScore: v.number(), // Made non-optional
  averageRating: v.number(), // Added: average rating for the story
  commentsCount: v.number(), // Added: count of comments (distinct from story.commentCount which might be different)
  votesCount: v.number(), // Added: count of votes (distinct from story.votes which might be raw sum or different metric)
  _score: v.optional(v.number()), // For search results
});

// Validator for User object in profile data
export const userInProfileValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  username: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  bio: v.optional(v.string()),
  website: v.optional(v.string()),
  twitter: v.optional(v.string()),
  bluesky: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  isVerified: v.optional(v.boolean()),
});

// Validator for Vote object with story details in profile data
export const voteWithStoryDetailsValidator = v.object({
  _id: v.id("votes"),
  _creationTime: v.number(),
  userId: v.id("users"),
  storyId: v.id("stories"),
  storyTitle: v.optional(v.string()),
  storySlug: v.optional(v.string()),
});

// Validator for Comment object with story/author details in profile data
export const commentDetailsForProfileValidator = v.object({
  _id: v.id("comments"),
  _creationTime: v.number(),
  content: v.string(),
  userId: v.id("users"), // User who wrote the comment
  storyId: v.id("stories"),
  parentId: v.optional(v.id("comments")),
  status: v.string(), // Assuming status is always present
  votes: v.number(), // Votes on the comment itself
  isHidden: v.boolean(), // Explicitly boolean, handle default in query if needed
  storyTitle: v.optional(v.string()), // Title of the story commented on
  storySlug: v.optional(v.string()), // Slug of the story commented on
  authorName: v.optional(v.string()), // Name of the comment author
  authorUsername: v.optional(v.string()), // Username of the comment author
});

// Validator for Rating object with story details in profile data
export const ratingWithStoryDetailsValidator = v.object({
  _id: v.id("storyRatings"),
  _creationTime: v.number(),
  userId: v.id("users"),
  storyId: v.id("stories"),
  value: v.number(),
  storyTitle: v.optional(v.string()),
  storySlug: v.optional(v.string()),
});

// TypeScript type corresponding to storyWithDetailsValidator
export type StoryWithDetailsPublic = {
  _id: Id<"stories">;
  _creationTime: number;
  title: string;
  slug: string;
  url: string;
  description: string; // Short tagline
  longDescription?: string; // Detailed description
  submitterName?: string; // Name from form input
  tagIds: Id<"tags">[];
  userId?: Id<"users">; // Made optional to support anonymous submissions
  votes: number;
  commentCount: number;
  screenshotId?: Id<"_storage">;
  additionalImageIds?: Id<"_storage">[]; // Up to 4 additional images
  ratingSum: number;
  ratingCount: number;
  videoUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  chefShowUrl?: string;
  chefAppUrl?: string;
  status: "pending" | "approved" | "rejected";
  isHidden: boolean;
  isPinned: boolean;
  wasPinned?: boolean;
  isArchived?: boolean;
  customMessage?: string;
  isApproved?: boolean;
  rejectionReason?: string;
  email?: string;
  // AI spam moderation fields (mirrors stories table schema)
  isSpam?: boolean;
  spamReason?: string;
  spamMarkedAt?: number;
  spamMarkedBy?: Id<"users">;
  // Hackathon team info
  teamName?: string;
  teamMemberCount?: number;
  teamMembers?: Array<{
    name: string;
    email?: string;
  }>;
  // Self-reported AI build attribution (metadata only)
  selfReportedHarness?: string;
  selfReportedModel?: string;
  // Answers to per-group custom submission questions
  customFormAnswers?: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  // Values for admin-added form fields without a dedicated stories column
  dynamicFormValues?: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  // Changelog tracking for user edits
  changeLog?: Array<{
    timestamp: number;
    textChanges?: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }>;
    linkChanges?: Array<{
      field: string;
      oldValue?: string;
      newValue?: string;
    }>;
    tagChanges?: {
      added: string[];
      removed: string[];
    };
    videoChanged?: boolean;
    imagesChanged?: boolean;
  }>;
  // Joined data
  authorName?: string;
  authorUsername?: string;
  authorImageUrl?: string;
  authorIsVerified?: boolean;
  authorEmail?: string;
  tags: Array<{
    _id: Id<"tags">;
    _creationTime: number;
    name: string;
    slug: string;
    showInHeader: boolean;
    isHidden?: boolean;
    hideInStoryDetail?: boolean;
    hideInStoryList?: boolean;
    backgroundColor?: string;
    textColor?: string;
  }>;
  screenshotUrl: string | null;
  additionalImageUrls: string[]; // URLs for additional images
  voteScore: number; // Made non-optional
  averageRating: number; // Added field
  commentsCount: number; // Added field
  votesCount: number; // Added field
  _score?: number; // For search results, if applicable
};
