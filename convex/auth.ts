import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("User must be authenticated.");
  }
  // Assuming user document ID matches the identity subject
  // This might need adjustment based on your actual User schema/auth setup
  const userId = identity.subject as Id<"users">;
  // Optional: Check if user exists in the DB and has admin role
  // const user = await ctx.db.get(userId);
  // if (!user || !user.isAdmin) { // Assuming an 'isAdmin' field
  //   throw new Error("User is not authorized to perform this action.");
  // }
  return userId;
}
