import { QueryCtx, MutationCtx } from "./_generated/server";
// Remove Id import if no longer needed elsewhere, kept for now
import { Id } from "./_generated/dataModel";

// Return the Clerk User ID (string) instead of a Convex table ID
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("User must be authenticated.");
  }
  // The subject is the Clerk User ID when Clerk is configured
  const clerkUserId = identity.subject;

  // Authorization (e.g., checking if the user is an admin) should be handled
  // separately if needed, potentially by checking clerkUserId against
  // environment variables or a dedicated table.

  // Return the Clerk User ID
  return clerkUserId;
}
