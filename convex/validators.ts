import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Validator for Doc<"tags"> for use in other validators
export const tagDocValidator = v.object({
  _id: v.id("tags"),
  _creationTime: v.number(),
  name: v.string(),
  showInHeader: v.boolean(),
  isHidden: v.optional(v.boolean()),
  backgroundColor: v.optional(v.string()),
  textColor: v.optional(v.string()),
});

// Validator for the main story document fields that are directly from the 'stories' table
export const baseStoryValidator = {
  _id: v.id("stories"),
  _creationTime: v.number(),
  title: v.string(),
  slug: v.string(),
  url: v.string(),
  description: v.string(),
  tagIds: v.array(v.id("tags")),
  userId: v.id("users"),
  votes: v.number(),
  commentCount: v.number(), // This should be updated by a separate mechanism or a trigger
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
};

// Validator for StoryWithDetails - includes author and tag details
export const storyWithDetailsValidator = v.object({
  ...baseStoryValidator,
  // Joined data (not directly on stories table but added by queries)
  authorName: v.optional(v.string()),
  authorUsername: v.optional(v.string()),
  authorImageUrl: v.optional(v.string()),
  tags: v.array(tagDocValidator), // Array of full tag objects
  screenshotUrl: v.union(v.string(), v.null()), // URL for the screenshot
  voteScore: v.number(), // Made non-optional
});

// TypeScript type corresponding to storyWithDetailsValidator
export type StoryWithDetailsPublic = {
  _id: Id<"stories">;
  _creationTime: number;
  title: string;
  slug: string;
  url: string;
  description: string;
  tagIds: Id<"tags">[];
  userId: Id<"users">;
  votes: number;
  commentCount: number;
  screenshotId?: Id<"_storage">;
  ratingSum: number;
  ratingCount: number;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  chefShowUrl?: string;
  chefAppUrl?: string;
  status: "pending" | "approved" | "rejected";
  isHidden: boolean;
  isPinned: boolean;
  customMessage?: string;
  isApproved?: boolean;
  // Joined data
  authorName?: string;
  authorUsername?: string;
  authorImageUrl?: string;
  tags: Doc<"tags">[];
  screenshotUrl: string | null;
  voteScore: number; // Made non-optional
  _score?: number; // For search results, if applicable
};
