import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Ensures a user record exists in the Convex database for the authenticated user.
 * If the user doesn't exist, it creates a new user record.
 *
 * This mutation should be called from the frontend after a successful
 * sign-in or sign-up with Clerk.
 */
export const ensureUser = mutation({
  args: {}, // No args needed, gets info from Clerk identity
  returns: v.id("users"), // Returns the Convex user ID
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called ensureUser without authentication");
    }

    // Check if user already exists by their Clerk ID (identity.subject)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existingUser) {
      // Optional: Update user data if needed (e.g., name change from Clerk)
      // if (existingUser.name !== (identity.name ?? identity.nickname ?? "Anonymous")) {
      //   await ctx.db.patch(existingUser._id, { name: identity.name ?? identity.nickname ?? "Anonymous" });
      // }
      // If roles are synced from Clerk token (e.g., publicMetadata.roles)
      // const clerkRoles = identity.publicMetadata?.roles as string[] | undefined;
      // if (clerkRoles && JSON.stringify(clerkRoles) !== JSON.stringify(existingUser.roles)) {
      //    await ctx.db.patch(existingUser._id, { roles: clerkRoles });
      // }
      return existingUser._id;
    }

    // Create new user if they don't exist
    // Priority for name: givenName + familyName > name > nickname > "Anonymous"
    let nameToStore = "Anonymous";
    if (identity.givenName && identity.familyName) {
      nameToStore = `${identity.givenName} ${identity.familyName}`;
    } else if (identity.name) {
      nameToStore = identity.name;
    } else if (identity.nickname) {
      nameToStore = identity.nickname;
    }

    // Store roles from Clerk token if available (e.g., publicMetadata.roles)
    // This is one way to sync roles. Another is via webhooks.
    const initialRoles = (identity.publicMetadata?.roles as string[] | undefined) ?? [];

    const userId = await ctx.db.insert("users", {
      name: nameToStore,
      clerkId: identity.subject, // This is the Clerk User ID
      roles: initialRoles,
    });

    return userId;
  },
});
