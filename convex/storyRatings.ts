import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { getAuthenticatedUserId } from "./users"; // Assuming this helper exists and is robust

export const deleteOwnRating = mutation({
  args: { storyRatingId: v.id("storyRatings") },
  handler: async (ctx: MutationCtx, args: { storyRatingId: Id<"storyRatings"> }) => {
    const userId = await getAuthenticatedUserId(ctx);
    const rating: Doc<"storyRatings"> | null = await ctx.db.get(args.storyRatingId);

    if (!rating) {
      throw new Error("Rating not found.");
    }

    if (rating.userId !== userId) {
      throw new Error("User not authorized to delete this rating.");
    }

    // Rating found and user is authorized, proceed with deletion
    await ctx.db.delete(args.storyRatingId);

    // Adjust the story's overall ratingSum and ratingCount
    const story: Doc<"stories"> | null = await ctx.db.get(rating.storyId);
    if (story) {
      await ctx.db.patch(story._id, {
        ratingSum: story.ratingSum - rating.value,
        ratingCount: Math.max(0, story.ratingCount - 1),
      });
    } else {
      console.warn(
        `Story with ID ${rating.storyId} not found when adjusting rating counts after deleting rating ${args.storyRatingId}`
      );
    }

    return { success: true };
  },
});
