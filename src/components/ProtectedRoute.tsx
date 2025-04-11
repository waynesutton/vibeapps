import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Define your allowed admin emails here
const ADMIN_EMAILS = ["wayne@convex.dev", "wayne@socialwayne.com"];

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(isAuthenticated ? api.users.getCurrent : null);

  if (isLoading || (isAuthenticated && user === undefined)) {
    // Show a loading state while checking auth or fetching user data
    // You can replace this with a proper loading spinner component
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Check if authenticated AND user has a whitelisted email
  const isAdmin = isAuthenticated && user && ADMIN_EMAILS.includes(user.email);

  if (!isAdmin) {
    // If not authenticated or not an admin, show a simple login prompt
    // We'll replace this with a proper login page/component later
    // For now, redirecting to home might be okay, or show an access denied message.
    // Let's show a dedicated login prompt for now.
    return <AdminLoginPage />; // We will create this component next
  }

  // If authenticated and is an admin, render the requested admin component
  return <>{children}</>;
}

// Simple Login Page Component (to be refined)
function AdminLoginPage() {
  const { login } = useConvexAuth();

  return (
    <div className="max-w-md mx-auto mt-20 p-8 border rounded-lg shadow-md text-center">
      <h1 className="text-2xl font-semibold mb-6">Admin Access Required</h1>
      <p className="mb-6 text-gray-600">
        Please log in with your GitHub account to access the admin dashboard.
      </p>
      <button
        onClick={() => login("github")}
        className="w-full px-4 py-2 bg-[#2A2825] text-white rounded-md hover:bg-[#525252] transition-colors flex items-center justify-center gap-2">
        {/* You might want to add a GitHub icon here */}
        <span>Log in with GitHub</span>
      </button>
      {/* Add Logout button if needed, though typically logout is in the main dashboard */}
    </div>
  );
}
