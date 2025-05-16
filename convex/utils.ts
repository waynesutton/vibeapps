import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Ensures the user is authenticated and retrieves their document from the database.
 * Throws an error if the user is not authenticated or not found in the database.
 * For queries where authentication is optional, handle the null return case.
 */
export const requireAuth = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    // For mutations, it's often best to throw. For queries, returning null
    // might be acceptable if the query can function for unauthenticated users.
    // Since bookmarks are user-specific, we'll be strict here for now.
    // Consider if queries like isStoryBookmarked should return false or throw.
    // For now, mutations will throw, queries will result in user being null.
    if ((ctx as any).db === undefined) {
      // Heuristic to check if it's a mutation context
      throw new Error("User not authenticated.");
    }
    return { user: null, identity: null };
  }

  // The 'users' table schema uses 'clerkId' to store the Clerk User ID (identity.subject)
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    if ((ctx as any).db === undefined) {
      // Heuristic for mutation context
      throw new Error("User not found in database. Please ensure user is synced.");
    }
    return { user: null, identity }; // User identity exists but no DB record
  }

  return { user, identity };
};
