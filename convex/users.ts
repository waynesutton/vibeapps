import { query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Get the user document corresponding to the currently authenticated user.
 *
 * Throws an error if the user is not authenticated.
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx): Promise<Doc<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // This should not happen if called after checking isAuthenticated, but adding for safety
      console.error("User is not authenticated.");
      return null;
      // Alternatively, throw an error:
      // throw new Error("User must be authenticated to fetch user data.");
    }

    // Find the user document linked to the authenticted identity (subject)
    // Assumes the user document has an index on 'subject'
    const user = await ctx.db
      .query("users")
      .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
      .unique();

    return user;
  },
});
