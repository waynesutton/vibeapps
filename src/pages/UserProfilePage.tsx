import React, { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ThumbsUp,
  MessageCircle,
  Trash2,
  Star,
  Edit3,
  Camera,
  Save,
  XCircle,
  Globe,
  Twitter,
  Linkedin,
  LogOut,
  Lock,
  Mail,
  UserPlus,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  BookmarkMinus,
} from "lucide-react";
import type { Story } from "../types"; // Import the Story type
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";

// Placeholder for loading and error states
const Loading = () => <div className="text-center p-8">Loading profile...</div>;
const ErrorDisplay = ({ message }: { message: string }) => (
  <div className="text-center p-8 text-red-600">Error: {message}</div>
);

// Explicitly define types for the items in arrays if not perfectly inferred
// These should align with what api.users.getUserProfileByUsername returns for these arrays
type StoryInProfile = Doc<"stories"> & {
  slug: string;
  title: string;
  description: string;
  status: string;
  authorName?: string | null;
  authorUsername?: string | null;
};

type VoteInProfile = Doc<"votes"> & {
  storySlug?: string;
  storyTitle?: string;
  storyId: Id<"stories">;
};
type CommentInProfile = Doc<"comments"> & {
  storySlug?: string;
  storyTitle?: string;
  content: string;
};
type RatingInProfile = Doc<"storyRatings"> & {
  storySlug?: string;
  storyTitle?: string;
  value: number;
};

// Define a type for bookmarked stories, mirroring getUserBookmarksWithStoryDetails return
type BookmarkedStoryItem = Doc<"bookmarks"> & {
  storyTitle?: string | null;
  storySlug?: string | null;
  storyDescription?: string | null;
  storyAuthorName?: string | null;
  storyAuthorUsername?: string | null;
  storyScreenshotUrl?: string | null;
};

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: authUser, isLoaded: isClerkLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const profileData = useQuery(
    api.users.getUserProfileByUsername,
    username ? { username } : "skip"
  );

  const unvoteStoryMutation = useMutation(api.stories.voteStory);
  const deleteOwnStoryMutation = useMutation(api.stories.deleteOwnStory);
  const deleteOwnCommentMutation = useMutation(api.comments.deleteOwnComment);
  const deleteOwnRatingMutation = useMutation(api.storyRatings.deleteOwnRating);
  const addOrRemoveBookmarkMutation = useMutation(api.bookmarks.addOrRemoveBookmark);

  // New mutations and actions for profile editing
  const generateUploadUrl = useAction(api.users.generateUploadUrl);
  const setUserProfileImage = useMutation(api.users.setUserProfileImage);
  const updateUsernameMutation = useMutation(api.users.updateUsername);
  const updateProfileDetails = useMutation(api.users.updateProfileDetails);

  const userBookmarksCount = useQuery(
    api.bookmarks.countUserBookmarks,
    isClerkLoaded && authUser ? {} : "skip"
  );
  const userBookmarksWithDetails = useQuery(
    api.bookmarks.getUserBookmarksWithStoryDetails,
    isClerkLoaded && authUser ? {} : "skip"
  );

  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newProfileImageFile, setNewProfileImageFile] = useState<File | null>(null);
  const [newProfileImagePreview, setNewProfileImagePreview] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newTwitter, setNewTwitter] = useState("");
  const [newBluesky, setNewBluesky] = useState("");
  const [newLinkedin, setNewLinkedin] = useState("");
  const [activeTab, setActiveTab] = useState<string>("votes");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to initialize edit form when profileData loads or editing starts
  useEffect(() => {
    if (isEditing && profileData?.user) {
      setNewUsername(profileData.user.username || "");
      setNewProfileImagePreview(profileData.user.imageUrl || null);
      setNewBio(profileData.user.bio || "");
      setNewWebsite(profileData.user.website || "");
      setNewTwitter(profileData.user.twitter || "");
      setNewBluesky(profileData.user.bluesky || "");
      setNewLinkedin(profileData.user.linkedin || "");
    } else if (!isEditing) {
      // Reset form state when exiting edit mode
      setNewProfileImageFile(null);
      // setNewProfileImagePreview(null); // Keep preview if not saved? Or reset?
      setEditError(null);
    }
  }, [isEditing, profileData]);

  // Initial check for username, which is crucial for the query
  if (isRedirecting) {
    return <Loading />;
  }
  if (!username) {
    // If username is not available from params, show error or redirect.
    // This check should ideally come very early.
    return <ErrorDisplay message="Username not found in URL." />;
  }

  // Query is active because username is present.
  // profileData can be: undefined (loading), null (user not found), or {data}
  if (profileData === undefined) {
    return <Loading />; // Query is loading
  }

  if (profileData === null) {
    // Query finished, user not found
    // If we are redirecting, don't show error
    if (isRedirecting) return <Loading />;
    return <ErrorDisplay message={`Profile for user "${username}" not found.`} />;
  }

  // If we reach here, profileData is guaranteed to be the actual data object
  // because username is valid, profileData is not undefined, and profileData is not null.
  const { user: profileUser, stories, votes, comments, ratings } = profileData;
  const isOwnProfile = !!authUser && authUser.username === profileUser?.username;

  const handleEditToggle = () => {
    if (!isEditing) {
      setNewUsername(profileUser.username || "");
      setNewProfileImagePreview(profileUser.imageUrl || null);
      setNewBio(profileUser.bio || "");
      setNewWebsite(profileUser.website || "");
      setNewTwitter(profileUser.twitter || "");
      setNewBluesky(profileUser.bluesky || "");
      setNewLinkedin(profileUser.linkedin || "");
      setNewProfileImageFile(null); // Clear previously selected file if any
      setEditError(null);
    }
    setIsEditing(!isEditing);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileUser) return;
    setEditError(null);
    setIsSaving(true);
    let usernameChanged = false;
    let imageChanged = false;
    let detailsChanged = false;
    try {
      if (newUsername.trim() !== (profileUser.username || "").trim() && newUsername.trim() !== "") {
        await updateUsernameMutation({ newUsername: newUsername.trim() });
        usernameChanged = true;
        if (authUser && authUser.update) {
          await authUser.update({ username: newUsername.trim() });
        }
        // Immediately redirect to new profile URL and prevent further code from running
        setIsRedirecting(true);
        navigate(`/u/${newUsername.trim()}`, { replace: true });
        return;
      }
      if (
        newBio !== (profileUser.bio || "") ||
        newWebsite !== (profileUser.website || "") ||
        newTwitter !== (profileUser.twitter || "") ||
        newBluesky !== (profileUser.bluesky || "") ||
        newLinkedin !== (profileUser.linkedin || "")
      ) {
        await updateProfileDetails({
          bio: newBio,
          website: newWebsite,
          twitter: newTwitter,
          bluesky: newBluesky,
          linkedin: newLinkedin,
        });
        detailsChanged = true;
      }
      if (newProfileImageFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": newProfileImageFile.type },
          body: newProfileImageFile,
        });
        const { storageId } = await result.json();
        if (!storageId) {
          throw new Error("Failed to get storageId from image upload.");
        }
        await setUserProfileImage({ storageId });
        imageChanged = true;
      }
      setIsEditing(false);
      setNewProfileImageFile(null); // Clear file input
      // Data should refetch automatically due to Convex reactivity or an explicit refetch can be added.
      // If username changed, navigate to new profile URL
      if (usernameChanged && newUsername.trim() !== username) {
        navigate(`/u/${newUsername.trim()}`, { replace: true });
      }
      // TODO: Add a success notification/toast
      // alert("Profile updated successfully!"); // Removed as per request
    } catch (error: any) {
      console.error("Failed to save profile:", error);
      setEditError(error.data?.message || error.message || "Failed to save profile.");
      // TODO: Add an error notification/toast
    } finally {
      setIsSaving(false);
    }
  };

  const triggerFileEdit = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Fallback for profile image if none is set
  const ProfileImagePlaceholder = ({
    name,
    size = "w-24 h-24",
  }: {
    name?: string;
    size?: string;
  }) => (
    <div
      className={`rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-4xl font-bold border-2 border-gray-400 ${size}`}>
      {name ? name.charAt(0).toUpperCase() : "U"}
    </div>
  );

  const currentImageUrl = newProfileImagePreview || profileUser.imageUrl;

  // --- Handler functions from original component ---
  const handleUnvote = async (storyId: Id<"stories">) => {
    try {
      await unvoteStoryMutation({ storyId });
      alert("Vote removed successfully!");
    } catch (error) {
      console.error("Failed to remove vote:", error);
      alert("Failed to remove vote. See console for details.");
    }
  };

  const handleDeleteStory = async (storyId: Id<"stories">) => {
    if (window.confirm("Are you sure you want to delete this submission?")) {
      try {
        await deleteOwnStoryMutation({ storyId });
        alert("Submission deleted successfully!");
      } catch (error) {
        console.error("Failed to delete submission:", error);
        alert("Failed to delete submission. See console for details.");
      }
    }
  };

  const handleDeleteComment = async (commentId: Id<"comments">) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        await deleteOwnCommentMutation({ commentId });
        alert("Comment deleted successfully!");
      } catch (error) {
        console.error("Failed to delete comment:", error);
        alert("Failed to delete comment. See console for details.");
      }
    }
  };

  const handleDeleteRating = async (ratingId: Id<"storyRatings">) => {
    if (window.confirm("Are you sure you want to delete your rating?")) {
      try {
        await deleteOwnRatingMutation({ storyRatingId: ratingId });
        // alert("Rating deleted successfully!"); // Removed as per request
      } catch (error) {
        console.error("Failed to delete rating:", error);
        alert("Failed to delete rating. See console for details.");
      }
    }
  };
  // --- End of original handler functions ---

  // Add new handler functions for account management
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Failed to sign out:", error);
      setActionError("Failed to sign out. Please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    try {
      // First delete user data from Convex
      // TODO: Implement a deleteUserData mutation in Convex to clean up user data
      // await deleteUserDataMutation();

      // Then delete the Clerk user account
      if (authUser) {
        await authUser.delete();
      }

      // Redirect to home page after successful deletion
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Failed to delete account:", error);
      setActionError("Failed to delete account. Please try again.");
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const handleChangePassword = () => {
    // For password change, we'll open Clerk's User Profile component focused on password
    if (authUser) {
      // There are a couple of approaches:
      // 1. Redirect to a page that shows Clerk's <UserProfile path="account" />
      navigate("/user-settings?tab=password");

      // 2. Or call the Clerk API directly if we have a custom UI
      // authUser.update({ password: newPassword })
    }
  };

  const handleChangeEmail = () => {
    // Similar to password, redirect to Clerk's User Profile or custom page
    navigate("/user-settings?tab=email");
  };

  const handleManageConnections = () => {
    // Redirect to a page with Clerk's <UserProfile path="account/connections" />
    navigate("/user-settings?tab=connections");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6  from-slate-50 to-gray-100 min-h-screen">
      {/* Profile Header - Product Hunt Inspired */}
      <header
        className="mb-10 p-6 bg-[#ffffff] rounded-lg border border-gray-200"
        style={{ fontFamily: "Inter, sans-serif" }}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start">
          {/* Profile Image Section */}
          <div className="relative mb-4 sm:mb-0 sm:mr-6 w-24 h-24">
            {isEditing ? (
              <button onClick={triggerFileEdit} className="relative group w-24 h-24 rounded-full">
                {newProfileImagePreview ? (
                  <img
                    src={newProfileImagePreview}
                    alt="Profile preview"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-300 group-hover:opacity-75 transition-opacity"
                  />
                ) : (
                  <ProfileImagePlaceholder name={profileUser.name} size="w-24 h-24" />
                )}
                <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/gif"
                  className="hidden"
                />
              </button>
            ) : currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={`${profileUser.name || "User"}'s profile`}
                className="w-24  rounded-full object-cover border-4 border-gray-300"
              />
            ) : (
              <ProfileImagePlaceholder name={profileUser.name} size="w-24 h-24" />
            )}
          </div>

          {/* Profile Info Section */}
          <div className="flex-grow text-center sm:text-left">
            {isEditing ? (
              <div className="flex items-center mb-2">
                {profileUser.username == null ? (
                  <>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="text-xl font-normal text-[#2A2825] w-auto px-2 py-1 border border-gray-300 rounded-md mr-2"
                      placeholder="Enter username"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    />
                    <span
                      className="text-lg text-gray-500"
                      style={{ fontFamily: "Inter, sans-serif" }}>
                      @{newUsername || "username"}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="text-xl font-normal text-[#2A2825] mr-2"
                      style={{ fontFamily: "Inter, sans-serif" }}>
                      {profileUser.name || "Anonymous User"}
                    </span>
                    <span
                      className="text-lg text-gray-500"
                      style={{ fontFamily: "Inter, sans-serif" }}>
                      @{profileUser.username}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-baseline mb-1">
                <h1
                  className="text-lg font-normal text-[#2A2825] mr-2"
                  style={{ fontFamily: "Inter, sans-serif" }}>
                  {profileUser.name || "Anonymous User"}
                </h1>
                <p className="text-lg text-gray-600" style={{ fontFamily: "Inter, sans-serif" }}>
                  @{profileUser.username || "N/A"}
                </p>
              </div>
            )}

            {/* Bio Section - Full Width */}
            <div className="mb-3 w-full">
              {isEditing ? (
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value.slice(0, 200))}
                  maxLength={200}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-[#2A2825] focus:border-[#2A2825]"
                  placeholder="Add a short bio (max 200 chars)"
                  style={{ fontFamily: "Inter, sans-serif" }}
                  rows={3}
                />
              ) : profileUser.bio ? (
                <p
                  className="text-sm text-gray-700 w-full"
                  style={{ fontFamily: "Inter, sans-serif" }}>
                  {profileUser.bio}
                </p>
              ) : (
                <p
                  className="text-sm text-gray-400 italic w-full"
                  style={{ fontFamily: "Inter, sans-serif" }}>
                  No bio yet.
                </p>
              )}
            </div>

            {/* Social Links Section - Horizontal */}
            <div className="flex flex-wrap gap-3 items-center mb-3">
              {isEditing ? (
                <>
                  <input
                    type="url"
                    value={newWebsite}
                    onChange={(e) => setNewWebsite(e.target.value)}
                    className="flex-grow  sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-black focus:border-black"
                    placeholder="Website"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <input
                    type="url"
                    value={newTwitter}
                    onChange={(e) => setNewTwitter(e.target.value)}
                    className="flex-grow  sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-black focus:border-black"
                    placeholder="Twitter"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <input
                    type="url"
                    value={newBluesky}
                    onChange={(e) => setNewBluesky(e.target.value)}
                    className="flex-grow  sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-black focus:border-black"
                    placeholder="Bluesky"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <input
                    type="url"
                    value={newLinkedin}
                    onChange={(e) => setNewLinkedin(e.target.value)}
                    className="flex-grow  sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-black focus:border-black"
                    placeholder="LinkedIn"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                </>
              ) : (
                <>
                  {profileUser.website && (
                    <a
                      href={profileUser.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#2A2825]"
                      title="Website">
                      Website
                    </a>
                  )}
                  {profileUser.twitter && (
                    <a
                      href={profileUser.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#2A2825]"
                      title="Twitter">
                      Twitter
                    </a>
                  )}
                  {profileUser.bluesky && (
                    <a
                      href={profileUser.bluesky}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#2A2825]"
                      title="Bluesky">
                      Bluesky
                    </a>
                  )}
                  {profileUser.linkedin && (
                    <a
                      href={profileUser.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#2A2825]"
                      title="LinkedIn">
                      LinkedIn
                    </a>
                  )}
                </>
              )}
            </div>

            {isOwnProfile && !isEditing && (
              <button
                onClick={handleEditToggle}
                className="mt-2 px-6 py-2 rounded-md bg-[#2A2825] border border-[#D8E1EC] text-[#ffffff] rounded-md text-sm font-medium hover:bg-[#F2F0ED] hover:text-[#2A2825] flex items-center justify-center sm:justify-start"
                style={{ fontFamily: "Inter, sans-serif" }}>
                <Edit3 className="w-4 h-4 mr-2 text-md" /> Edit my profile
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            {editError && (
              <p
                className="text-sm text-red-500 w-full sm:w-auto text-center sm:text-left"
                style={{ fontFamily: "Inter, sans-serif" }}>
                {editError}
              </p>
            )}
            <button
              onClick={handleEditToggle} // This is cancel
              disabled={isSaving}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center"
              style={{ fontFamily: "Inter, sans-serif" }}>
              <XCircle className="w-4 h-4 mr-2" /> Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={
                isSaving ||
                (!newProfileImageFile &&
                  newUsername.trim() === (profileUser.username || "").trim() &&
                  newBio === (profileUser.bio || "") &&
                  newWebsite === (profileUser.website || "") &&
                  newTwitter === (profileUser.twitter || "") &&
                  newBluesky === (profileUser.bluesky || "") &&
                  newLinkedin === (profileUser.linkedin || ""))
              }
              className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-50"
              style={{ fontFamily: "Inter, sans-serif" }}>
              <Save className="w-4 h-4 mr-2" /> {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </header>

      {/* Mini Dashboard Section */}
      <section
        className="mb-10 p-4 bg-[#fff] rounded-md border border-gray-200"
        style={{ fontFamily: "Inter, sans-serif" }}>
        <h2 className="text-lg font-normal text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          Dashboard
        </h2>
        <div className="flex flex-row gap-8 justify-center sm:justify-start">
          <div className="flex flex-col items-center">
            <a
              href="#submissions"
              onClick={() => setActiveTab("votes")}
              className="text-xl text-[#2A2825] hover:underline">
              {stories.length}
            </a>
            <span className="text-sm text-gray-500">Submissions</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-votes"
              onClick={() => setActiveTab("votes")}
              className="text-xl text-[#2A2825] hover:underline">
              {votes.length}
            </a>
            <span className="text-sm text-gray-500">Votes</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-ratings"
              onClick={() => setActiveTab("ratings")}
              className="text-xl text-[#2A2825] hover:underline">
              {ratings.length}
            </a>
            <span className="text-sm text-gray-500">Ratings Given</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-comments"
              onClick={() => setActiveTab("comments")}
              className="text-xl text-[#2A2825] hover:underline">
              {comments.length}
            </a>
            <span className="text-sm text-gray-500">Comments</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-bookmarks"
              onClick={() => setActiveTab("bookmarks")}
              className="text-xl text-[#2A2825] hover:underline">
              {userBookmarksCount ?? 0}
            </a>
            <span className="text-sm text-gray-500">Bookmarks</span>
          </div>
        </div>
      </section>

      {/* Section for User's Submissions (Stories) - Always Visible */}
      <section id="submissions" className="mb-6 p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
        <h2 className="text-lg font-normal text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          Submissions
        </h2>
        {stories.length === 0 && <p className="text-gray-500 italic">No submissions yet.</p>}
        {stories.length > 0 && (
          <ul className="space-y-4">
            {stories.map((story: Story) => (
              <li
                key={story._id}
                className="p-4 bg-gray-50 border border-gray-200 rounded-md flex justify-between items-center transition-shadow">
                <div className="flex-grow mr-4">
                  <Link
                    to={`/s/${story.slug}`}
                    className="text-lg font-semibold text-[#2A2825] hover:underline">
                    {story.title}
                  </Link>
                  <p className="text-sm text-gray-600 truncate">{story.description}</p>
                  <p className="text-xs text-gray-500">
                    Submitted by: {story.authorName || story.authorUsername || "Anonymous"}
                  </p>
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => handleDeleteStory(story._id)}
                    className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tab Navigation and Content Area */}
      <div className="mb-12">
        {/* Tab Buttons */}
        <div className="flex border-b border-gray-300 mb-4">
          <button
            onClick={() => setActiveTab("votes")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none ${
              activeTab === "votes"
                ? "border-b-2 border-[#2A2825] text-[#2A2825]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            Votes ({votes?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("ratings")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none ${
              activeTab === "ratings"
                ? "border-b-2 border-[#2A2825] text-[#2A2825]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            Ratings Given ({ratings?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none ${
              activeTab === "comments"
                ? "border-b-2 border-[#2A2825] text-[#2A2825]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            Comments ({comments?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("bookmarks")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none ${
              activeTab === "bookmarks"
                ? "border-b-2 border-[#2A2825] text-[#2A2825]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            Bookmarks ({userBookmarksCount ?? 0})
          </button>
        </div>

        {/* Conditionally Rendered Content */}
        {activeTab === "votes" && (
          <section
            id="tab-section-votes"
            className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
            {/* Votes content from original section, no title needed here as it's on the tab */}
            {votes.length === 0 && <p className="text-gray-500 italic">No votes yet.</p>}
            {votes.length > 0 && (
              <ul className="space-y-4">
                {votes.map((vote: VoteInProfile) => (
                  <li
                    key={vote._id}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-md flex justify-between items-center transition-shadow">
                    <div className="flex-grow mr-4">
                      <Link
                        to={`/s/${vote.storySlug}`}
                        className="text-lg font-semibold text-[#2A2825] hover:underline">
                        {vote.storyTitle || "View Story"}
                      </Link>
                      <p className="text-xs text-gray-400">
                        Voted on: {new Date(vote._creationTime).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button
                        onClick={() => handleUnvote(vote.storyId)}
                        className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0">
                        <ThumbsUp className="w-4 h-4 transform rotate-180" /> Unvote
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "ratings" && (
          <section
            id="tab-section-ratings"
            className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
            {/* Ratings content from original section */}
            {ratings.length === 0 && <p className="text-gray-500 italic">No ratings given yet.</p>}
            {ratings.length > 0 && (
              <ul className="space-y-4">
                {ratings.map((rating: RatingInProfile) => (
                  <li
                    key={rating._id}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-md flex justify-between items-center transition-shadow">
                    <div className="flex-grow mr-4">
                      <Link
                        to={`/s/${rating.storySlug}`}
                        className="text-lg font-semibold text-[#2A2825] hover:underline">
                        {rating.storyTitle || "View Story"}
                      </Link>
                      <p className="text-sm text-yellow-500 flex items-center">
                        Rated:{" "}
                        {Array(rating.value)
                          .fill(null)
                          .map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                          ))}
                        {Array(5 - rating.value)
                          .fill(null)
                          .map((_, i) => (
                            <Star
                              key={i + rating.value}
                              className="w-4 h-4 text-gray-300 fill-current"
                            />
                          ))}
                        <span className="ml-2 text-xs text-gray-400">
                          ({new Date(rating._creationTime).toLocaleDateString()})
                        </span>
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button
                        onClick={() => handleDeleteRating(rating._id)}
                        className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "comments" && (
          <section
            id="tab-section-comments"
            className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
            {/* Comments content from original section */}
            {comments.length === 0 && <p className="text-gray-500 italic">No comments yet.</p>}
            {comments.length > 0 && (
              <ul className="space-y-4">
                {comments.map((comment: CommentInProfile) => (
                  <li
                    key={comment._id}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-md flex justify-between items-center transition-shadow">
                    <div className="flex-grow mr-4">
                      <p className="text-gray-700 mb-1 whitespace-pre-wrap">{comment.content}</p>
                      <p className="text-xs text-gray-400">
                        Commented on{" "}
                        <Link
                          to={`/s/${comment.storySlug}#comments`}
                          className="text-[#2A2825] hover:underline">
                          {comment.storyTitle || "story"}
                        </Link>{" "}
                        - {new Date(comment._creationTime).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button
                        onClick={() => handleDeleteComment(comment._id)}
                        className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "bookmarks" && (
          <section
            id="tab-section-bookmarks"
            className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
            {(!userBookmarksWithDetails || userBookmarksWithDetails.length === 0) && (
              <p className="text-gray-500 italic">No bookmarks yet.</p>
            )}
            {userBookmarksWithDetails && userBookmarksWithDetails.length > 0 && (
              <ul className="space-y-4">
                {userBookmarksWithDetails.map((bookmark: BookmarkedStoryItem) => (
                  <li
                    key={bookmark._id}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-md flex justify-between items-center transition-shadow">
                    <div className="flex-grow mr-4">
                      <Link
                        to={`/s/${bookmark.storySlug}`}
                        className="text-lg font-semibold text-[#2A2825] hover:underline">
                        {bookmark.storyTitle || "View Story"}
                      </Link>
                      {bookmark.storyDescription && (
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {bookmark.storyDescription}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Bookmarked on: {new Date(bookmark._creationTime).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button
                        onClick={async () => {
                          try {
                            await addOrRemoveBookmarkMutation({ storyId: bookmark.storyId });
                            // Optionally add a success alert or toast
                          } catch (error) {
                            console.error("Failed to remove bookmark:", error);
                            alert("Failed to remove bookmark. Please try again.");
                          }
                        }}
                        className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                        title="Remove bookmark">
                        <BookmarkMinus className="w-4 h-4" /> Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Manage Profile Section - Visible only to profile owner */}
      {isOwnProfile && (
        <section
          id="manage-profile"
          className="mb-10 p-6 bg-[#ffffff] rounded-lg border border-gray-200"
          style={{ fontFamily: "Inter, sans-serif" }}>
          <h2 className="text-xl font-semibold text-[#2A2825] mb-6 pb-3 border-b border-gray-300">
            Manage Profile & Account
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-[#2A2825] mb-2">Profile Settings</h3>
                <button
                  onClick={() => {
                    if (!isEditing) {
                      handleEditToggle(); // Activate editing mode if not already active
                    }
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#2A2825] transition-colors disabled:opacity-50">
                  <Edit3 className="w-4 h-4 inline-block mr-2" /> Edit Profile Details
                </button>
              </div>

              <div>
                <h3 className="text-lg font-medium text-[#2A2825] mb-2">Account Security</h3>
                <button
                  onClick={handleChangePassword}
                  className="w-full mt-2 px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#2A2825] transition-colors">
                  <Lock className="w-4 h-4 inline-block mr-2" /> Change Password
                </button>
                <button
                  onClick={handleChangeEmail}
                  className="w-full mt-2 px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#2A2825] transition-colors">
                  <Mail className="w-4 h-4 inline-block mr-2" /> Change Email Address
                </button>
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-[#2A2825] mb-2">Connected Services</h3>
                <button
                  onClick={handleManageConnections}
                  className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#2A2825] transition-colors">
                  <UserPlus className="w-4 h-4 inline-block mr-2" /> Manage Connected Accounts
                </button>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#2A2825] mb-2">Account Actions</h3>
                <button
                  onClick={handleSignOut}
                  className="w-full mt-2 px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#2A2825] transition-colors">
                  <LogOut className="w-4 h-4 inline-block mr-2" /> Sign Out
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className={`w-full mt-4 px-4 py-2 text-left ${
                    isConfirmingDelete
                      ? "bg-red-200 border-red-400"
                      : "bg-red-50 hover:bg-red-100 border-red-300"
                  } rounded-md text-sm text-red-700 transition-colors flex items-center justify-between`}>
                  <span>
                    <AlertTriangle className="w-4 h-4 inline-block mr-2" />{" "}
                    {isConfirmingDelete ? "Confirm Account Deletion" : "Delete Account"}
                  </span>
                  {isConfirmingDelete && <span className="text-xs">Click again to confirm</span>}
                </button>
              </div>
            </div>
          </div>
          {actionError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-md">
              <p className="text-sm text-red-700">{actionError}</p>
            </div>
          )}
          <p className="mt-6 text-xs text-gray-500">
            For more advanced settings, you can also visit your main account page.
          </p>
        </section>
      )}
    </div>
  );
}
