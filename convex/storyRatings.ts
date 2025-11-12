import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { getAuthenticatedUserId } from "./users"; // Assuming this helper exists and is robust

export const deleteOwnRating = mutation({
  args: { storyRatingId: v.id("storyRatings") },
  handler: async (ctx: MutationCtx, args: { storyRatingId: Id<"storyRatings"> }) => {
    const userId = await getAuthenticatedUserId(ctx);
    
    // Perform all validation reads first
    const rating: Doc<"storyRatings"> | null = await ctx.db.get(args.storyRatingId);

    if (!rating) {
      throw new Error("Rating not found.");
    }

    if (rating.userId !== userId) {
      throw new Error("User not authorized to delete this rating.");
    }

    // Read story before deletion to get current values
    const story: Doc<"stories"> | null = await ctx.db.get(rating.storyId);
    if (!story) {
      console.warn(
        `Story with ID ${rating.storyId} not found when deleting rating ${args.storyRatingId}`
      );
      // Still delete the orphaned rating
      await ctx.db.delete(args.storyRatingId);
      return { success: true };
    }

    // All validation complete - now perform writes
    // Delete the rating
    await ctx.db.delete(args.storyRatingId);

    // Immediately patch story with updated counts using previously read values
    await ctx.db.patch(story._id, {
      ratingSum: story.ratingSum - rating.value,
      ratingCount: Math.max(0, story.ratingCount - 1),
    });

    return { success: true };
  },
});
