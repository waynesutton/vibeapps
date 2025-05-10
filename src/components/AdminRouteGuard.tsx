import { SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/clerk-react";
import { Outlet, Navigate } from "react-router-dom";

// Placeholder for a loading spinner, replace with your actual component
function LoadingSpinner() {
  return (
    <div
      style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      Loading...
    </div>
  );
}

export function AdminRouteGuard() {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) {
    return <LoadingSpinner />; // Or your own loading component
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  // Check for admin role. Adjust this based on how you set roles in Clerk.
  // Option 1: Via public metadata (ensure you set this in Clerk dashboard or via API)
  const isAdmin = user?.publicMetadata?.role === "admin";

  // Option 2: Via organization roles (if you use Clerk organizations)
  // const isAdmin = user?.organizationMemberships?.some(mem => mem.role === "org:admin");

  if (!isAdmin) {
    // If signed in but not an admin, redirect to home or an unauthorized page
    return <Navigate to="/" replace />;
  }

  // User is signed in and is an admin
  return <Outlet />;
}
