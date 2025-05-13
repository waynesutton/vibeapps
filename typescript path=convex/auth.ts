import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Retrieves the authenticated user's document from the 'users' table.
 * Throws an error if the user is not authenticated or not found in the database.
 * Assumes 'users' table has a 'tokenIdentifier' field indexed as 'by_token_identifier'.
 */
export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("User not authenticated. Please sign in.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) {
    throw new ConvexError(
      "Authenticated user not found in the database. Ensure user record is created after sign-up."
    );
  }
  return user;
}

/**
 * Ensures the current user is authenticated and has the 'admin' role.
 * Throws an error if not authenticated or not an admin.
 * Returns the admin user's document.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getAuthenticatedUser(ctx);

  if (user.role !== "admin") {
    throw new ConvexError("Access denied. Admin role required.");
  }
  return user;
}

/**
 * Ensures the current user is authenticated.
 * Throws an error if not authenticated.
 * Returns the authenticated user's document.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  return await getAuthenticatedUser(ctx);
} 