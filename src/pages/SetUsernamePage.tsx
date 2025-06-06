import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

export default function SetUsernamePage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const setUsernameMutation = useMutation(api.users.setUsername);
  const navigate = useNavigate();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  const convexUser = useQuery(
    api.users.getMyUserDocument,
    isClerkLoaded && clerkUser ? {} : "skip"
  );

  useEffect(() => {
    if (isClerkLoaded && convexUser && convexUser.username) {
      // Username is set and available
      navigate(`/${convexUser.username}`);
    }
  }, [isClerkLoaded, convexUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    if (!username.trim()) {
      setError("Username cannot be empty.");
      setIsLoading(false);
      return;
    }
    if (!clerkUser) {
      setError("User not authenticated. Please sign in again.");
      setIsLoading(false);
      return;
    }
    try {
      const newTrimmedUsername = username.trim();
      await setUsernameMutation({ newUsername: newTrimmedUsername });
      // Successfully set username in Convex.
      // Navigate directly. The useEffect will also catch this if this navigation fails
      // or if the component re-renders before navigation fully happens.
      navigate(`/${newTrimmedUsername}`);
      // Optionally, you might want to update Clerk's user session if it stores username
      // and your app relies on clerkUser.username for UI elements immediately.
      // This typically involves calling a Clerk function to update user metadata.
      // e.g., await clerkUser.update({ username: newTrimmedUsername });
      // However, this depends on how your Clerk instance is configured and if 'username' is a standard or custom attribute.
      // For now, we'll rely on Convex as the source of truth for profile URLs.
    } catch (err: any) {
      console.error("Error setting username:", err);
      setError(
        err.data?.message || err.message || "Failed to set username. It might be taken or invalid."
      );
    }
    setIsLoading(false);
  };

  if (!isClerkLoaded || convexUser === undefined) {
    return <div className="text-center p-8">Loading...</div>;
  }

  if (convexUser && convexUser.username) {
    // Should have been redirected by useEffect, but as a fallback:
    return <div className="text-center p-8">Username already set. Redirecting...</div>;
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-xl border border-gray-200">
      <h1 className="text-2xl font-bold text-[#292929] mb-6 text-center">Set Your Username</h1>
      <p className="text-sm text-[#545454] mb-4">
        Choose a unique username for your profile. This will be part of your public profile URL.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-[#525252]">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#292929] focus:border-[#292929] sm:text-sm"
            placeholder="e.g., janedoe"
            required
            disabled={isLoading}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isLoading || !username.trim()}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#292929] hover:bg-[#525252] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#292929] disabled:opacity-50">
          {isLoading ? "Saving..." : "Set Username"}
        </button>
      </form>
    </div>
  );
}
