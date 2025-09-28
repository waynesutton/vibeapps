"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal action to revoke Clerk sessions using Admin API
 */
export const revokeAllSessions = internalAction({
  args: {
    userClerkIds: v.array(v.string()),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    revokedSessions: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx, args) => {
    // Note: This requires CLERK_SECRET_KEY environment variable
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;

    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY environment variable is required");
    }

    let revokedSessions = 0;
    let errors = 0;

    // Process users in batches to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < args.userClerkIds.length; i += BATCH_SIZE) {
      const batch = args.userClerkIds.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (clerkId) => {
        try {
          // Get user's active sessions from Clerk
          const sessionsResponse = await fetch(
            `https://api.clerk.com/v1/users/${clerkId}/sessions`,
            {
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (!sessionsResponse.ok) {
            console.error(`Failed to get sessions for user ${clerkId}`);
            errors++;
            return;
          }

          const sessionsData = await sessionsResponse.json();
          const activeSessions = sessionsData.filter(
            (session: any) => session.status === "active",
          );

          // Revoke each active session
          for (const session of activeSessions) {
            const revokeResponse = await fetch(
              `https://api.clerk.com/v1/sessions/${session.id}/revoke`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${clerkSecretKey}`,
                  "Content-Type": "application/json",
                },
              },
            );

            if (revokeResponse.ok) {
              revokedSessions++;
              console.log(`Revoked session ${session.id} for user ${clerkId}`);
            } else {
              console.error(
                `Failed to revoke session ${session.id} for user ${clerkId}`,
              );
              errors++;
            }
          }
        } catch (error) {
          console.error(`Error processing user ${clerkId}:`, error);
          errors++;
        }
      });

      await Promise.all(batchPromises);

      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < args.userClerkIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `Force logout completed: ${revokedSessions} sessions revoked, ${errors} errors`,
    );

    return {
      success: errors === 0,
      revokedSessions,
      errors,
    };
  },
});
