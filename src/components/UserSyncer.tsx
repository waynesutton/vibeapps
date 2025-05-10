import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * This component ensures that when a user is signed in with Clerk,
 * a corresponding user record is created or verified in the Convex database.
 * It calls the `ensureUser` mutation.
 */
export function UserSyncer() {
  const { isSignedIn, user, isLoaded } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && user && !isSynced) {
      // Check if user object and its id are available
      console.log("User is signed in, attempting to sync with Convex...");
      ensureUser()
        .then((userId) => {
          console.log(`User synced with Convex. Convex User ID: ${userId}`);
          setIsSynced(true); // Mark as synced for this session/user instance
        })
        .catch((error) => {
          console.error("Error syncing user with Convex:", error);
          // Optionally, you could implement a retry mechanism or flag for retry
        });
    }
    // Reset sync status if user signs out or changes
    if (isLoaded && !isSignedIn) {
      setIsSynced(false);
    }
  }, [isLoaded, isSignedIn, user, ensureUser, isSynced]);

  // This component doesn't render anything itself
  return null;
}
