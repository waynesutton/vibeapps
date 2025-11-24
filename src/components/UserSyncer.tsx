import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";

/**
 * This component ensures that when a user is signed in with Clerk,
 * a corresponding user record is created or verified in the Convex database.
 * It calls the `ensureUser` mutation.
 */
export function UserSyncer() {
  const { isSignedIn, user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const ensureUserMutation = useMutation(api.users.ensureUser);
  const navigate = useNavigate();

  // Fetch the Convex user document after Clerk loads and user is signed in
  const convexUserDoc = useQuery(
    api.users.getMyUserDocument,
    isClerkLoaded && isSignedIn ? {} : "skip" // Only run if clerk is loaded and user is signed in
  );

  const [isSyncedAndChecked, setIsSyncedAndChecked] = useState(false);

  useEffect(() => {
    // Effect for ensuring user record in Convex DB
    if (isClerkLoaded && isSignedIn && clerkUser && !isSyncedAndChecked) {
      ensureUserMutation()
        .then((userId) => {
          // After ensuring user, convexUserDoc query will refetch or update.
          // The next useEffect will handle username check.
        })
        .catch((error) => {
          console.error("Error running ensureUser mutation:", error);
        });
    }
  }, [isClerkLoaded, isSignedIn, clerkUser, ensureUserMutation, isSyncedAndChecked]);

  useEffect(() => {
    // Effect for checking username and redirecting if null
    // This runs after convexUserDoc is fetched/updated
    if (isClerkLoaded && isSignedIn && convexUserDoc !== undefined && !isSyncedAndChecked) {
      if (convexUserDoc === null) {
        // This implies ensureUser might have failed or is still in progress, or user somehow not in DB
        // This state should ideally be transient. If ensureUser ran, convexUserDoc should become non-null.
        console.warn(
          "UserSyncer: Convex user document is null after ensureUser should have run. Waiting for query to update."
        );
        // Potentially set a small timeout before concluding it's an error or retrying ensureUser.
      } else if (convexUserDoc.username === null || convexUserDoc.username === undefined) {
        navigate("/set-username");
      }
      setIsSyncedAndChecked(true); // Mark as checked for this session/user state
    }

    // Reset if user signs out
    if (isClerkLoaded && !isSignedIn) {
      setIsSyncedAndChecked(false);
    }
  }, [isClerkLoaded, isSignedIn, convexUserDoc, navigate, isSyncedAndChecked]);

  return null; // This component doesn't render anything
}
