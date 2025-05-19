import React, { useState, useEffect, useRef } from "react";
import { useUser, useClerk, UserProfile } from "@clerk/clerk-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
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
  UserMinus,
  Users,
  AlertTriangle,
  Settings,
  Bookmark,
  BookmarkCheck,
  BookmarkMinus,
  BookKey,
} from "lucide-react";
import type { Story } from "../types"; // Import the Story type
import AlertDialog from "../components/ui/AlertDialog"; // Corrected path
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import { NotFoundPage } from "./NotFoundPage"; // Added import for NotFoundPage

// Placeholder for loading and error states
const Loading = () => <div className="text-center p-8"> </div>;
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
  followersCount?: number;
  followingCount?: number;
  isFollowedByCurrentUser?: boolean;
};

// Define a type for user items in follower/following lists
// Ensure this matches the return type of api.follows.getFollowers/getFollowing
type FollowUserListItem = Doc<"users"> & {
  // username is already part of Doc<"users">, but ensure it's handled if optional
  username?: string | null; // explicitly define if it can be null/undefined in the query result
  name?: string | null;
  imageUrl?: string | null;
};

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const location = useLocation(); // Get location object for query params
  const { user: authUser, isLoaded: isClerkLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  // Console log for authUser (Clerk user object)
  useEffect(() => {
    if (isClerkLoaded && authUser) {
      // console.log("Auth User (Clerk):", JSON.stringify(authUser, null, 2));
    }
  }, [isClerkLoaded, authUser]);

  const profileData = useQuery(
    api.users.getUserProfileByUsername,
    username && !username.startsWith("user-settings") ? { username } : "skip"
  );

  // Corrected useEffect for logging Profile User (Convex user object)
  useEffect(() => {
    if (profileData?.user) {
      // Safely access profileData.user
      // console.log("Profile User (Convex) from top useEffect:", JSON.stringify(profileData.user, null, 2));
    }
  }, [profileData]); // Depend on the profileData object

  const followUserMutation = useMutation(api.follows.followUser);
  const unfollowUserMutation = useMutation(api.follows.unfollowUser);

  // Queries for followers and following lists
  const followersData = useQuery(
    api.follows.getFollowers,
    profileData?.user?._id ? { userId: profileData.user._id } : "skip"
  );
  const followingData = useQuery(
    api.follows.getFollowing,
    profileData?.user?._id ? { userId: profileData.user._id } : "skip"
  );

  const unvoteStoryMutation = useMutation(api.stories.voteStory);
  const deleteOwnStoryMutation = useMutation(api.stories.deleteOwnStory);
  const deleteOwnCommentMutation = useMutation(api.comments.deleteOwnComment);
  const deleteOwnRatingMutation = useMutation(api.storyRatings.deleteOwnRating);
  const addOrRemoveBookmarkMutation = useMutation(api.bookmarks.addOrRemoveBookmark);

  const generateUploadUrl = useAction(api.users.generateUploadUrl);
  const setUserProfileImage = useMutation(api.users.setUserProfileImage);
  const updateUsernameMutation = useMutation(api.users.updateUsername);
  const updateProfileDetails = useMutation(api.users.updateProfileDetails);

  const userBookmarksCount = useQuery(
    api.bookmarks.countUserBookmarks,
    isClerkLoaded && authUser && username !== "user-settings" ? {} : "skip"
  );
  const userBookmarksWithDetails = useQuery(
    api.bookmarks.getUserBookmarksWithStoryDetails,
    isClerkLoaded && authUser && username !== "user-settings" ? {} : "skip"
  );

  // Add user number query
  const userNumber = useQuery(
    api.users.getUserNumber,
    profileData?.user?._id ? { userId: profileData.user._id } : "skip"
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoadingFollowAction, setIsLoadingFollowAction] = useState(false);

  // State for confirmation dialogs
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    onConfirm: () => void;
    confirmText?: string;
    confirmVariant?: "default" | "destructive";
    itemContext?: any; // For storing IDs or other context
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (username === "user-settings") {
      return;
    }
    if (isEditing && profileData?.user) {
      setNewUsername(profileData.user.username || "");
      setNewProfileImagePreview(profileData.user.imageUrl || null);
      setNewBio(profileData.user.bio || "");
      setNewWebsite(profileData.user.website || "");
      setNewTwitter(profileData.user.twitter || "");
      setNewBluesky(profileData.user.bluesky || "");
      setNewLinkedin(profileData.user.linkedin || "");
    } else if (!isEditing) {
      setNewProfileImageFile(null);
      setEditError(null);
    }
  }, [isEditing, profileData, username]);

  // Handle /user-settings route for Clerk's UserProfile component
  if (location.pathname.startsWith("/user-settings")) {
    // Modified condition
    // Removed searchParams and clerkProfilePath logic for selecting sub-sections
    // The UserProfile component with routing="path" will handle sub-paths like /user-settings/security
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 bg-white rounded-lg shadow min-h-screen">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-[#545454] hover:text-[#525252] inline-block mb-6 bg-transparent border-none cursor-pointer p-0">
          ← Back to previous page
        </button>{" "}
        {/* Set path to the base path where UserProfile is mounted */}
        <UserProfile path="/user-settings" routing="path" />
      </div>
    );
  }

  if (isRedirecting) return <p className="text-center p-8">Loading...</p>;
  if (!username)
    return <p className="text-center p-8 text-red-600">Error: Username not found in URL.</p>;
  if (profileData === null) {
    return <NotFoundPage />;
  }

  // If profileData is still undefined here for a non-"user-settings" path, it means it's loading.
  if (profileData === undefined && !(username && username.startsWith("user-settings"))) {
    return <Loading />;
  }

  // If it's user-settings path and profileData is undefined (skipped query), UserProfile component handles it.
  // If it's another path and profileData is still undefined, the Loading component above handles it.
  // If profileData is null, NotFoundPage handles it.
  // So, if we reach here and it's not user-settings, profileData MUST be an object.
  // For user-settings, profileData might be undefined, but that path returns <UserProfile> which doesn't use profileData directly.

  // Fallback if somehow profileData is not an object for a page that needs it (excluding user-settings)
  if (!profileData && !(username && username.startsWith("user-settings"))) {
    console.error("UserProfilePage: profileData is unexpectedly not loaded for", username);
    return <ErrorDisplay message={`Profile data could not be loaded for ${username}.`} />;
  }

  // Destructure AFTER all checks ensure profileData is the loaded object for the current path
  // or it's the user-settings path where profileData might be undefined (query skipped)
  const {
    user: loadedProfileUser,
    stories,
    votes,
    comments,
    ratings,
    followersCount,
    followingCount,
    isFollowedByCurrentUser,
  } = profileData || {
    user: null,
    stories: [],
    votes: [],
    comments: [],
    ratings: [],
    followersCount: 0,
    followingCount: 0,
    isFollowedByCurrentUser: false,
  };

  // Correct calculation for isOwnProfile, using the reliably loadedProfileUser
  const isOwnProfile =
    !!authUser && !!loadedProfileUser && authUser.id === loadedProfileUser.clerkId;

  // If we are on a specific user's profile page (not user-settings) and loadedProfileUser is null (due to fallback from destructuring)
  // it implies an issue not caught by earlier checks, or profileData was an empty object without a 'user' field.
  if (!(username && username.startsWith("user-settings")) && !loadedProfileUser) {
    console.error(
      "UserProfilePage: loadedProfileUser is null for",
      username,
      "profileData was:",
      profileData
    );
    return <ErrorDisplay message={`User details could not be loaded for ${username}.`} />;
  }

  const handleEditToggle = () => {
    if (!isEditing) {
      if (loadedProfileUser) {
        setNewUsername(loadedProfileUser.username || "");
        setNewProfileImagePreview(loadedProfileUser.imageUrl || null);
        setNewBio(loadedProfileUser.bio || "");
        setNewWebsite(loadedProfileUser.website || "");
        setNewTwitter(loadedProfileUser.twitter || "");
        setNewBluesky(loadedProfileUser.bluesky || "");
        setNewLinkedin(loadedProfileUser.linkedin || "");
      }
    } else {
      setNewProfileImageFile(null);
      setEditError(null);
    }
    setIsEditing(!isEditing);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setNewProfileImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!loadedProfileUser) return;
    setEditError(null);
    setIsSaving(true);
    let usernameChanged = false;
    try {
      if (
        newUsername.trim() !== (loadedProfileUser.username || "").trim() &&
        newUsername.trim() !== ""
      ) {
        await updateUsernameMutation({ newUsername: newUsername.trim() });
        usernameChanged = true;
        if (authUser && authUser.update) await authUser.update({ username: newUsername.trim() });
        setIsRedirecting(true);
        navigate(`/${newUsername.trim()}`, { replace: true });
        return;
      }
      if (
        newBio !== (loadedProfileUser.bio || "") ||
        newWebsite !== (loadedProfileUser.website || "") ||
        newTwitter !== (loadedProfileUser.twitter || "") ||
        newBluesky !== (loadedProfileUser.bluesky || "") ||
        newLinkedin !== (loadedProfileUser.linkedin || "")
      ) {
        await updateProfileDetails({
          bio: newBio,
          website: newWebsite,
          twitter: newTwitter,
          bluesky: newBluesky,
          linkedin: newLinkedin,
        });
      }
      if (newProfileImageFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": newProfileImageFile.type },
          body: newProfileImageFile,
        });
        const { storageId } = await result.json();
        if (!storageId) throw new Error("Failed to get storageId from image upload.");
        await setUserProfileImage({ storageId });
      }
      setIsEditing(false);
      setNewProfileImageFile(null);
      if (usernameChanged && newUsername.trim() !== username) {
        navigate(`/${newUsername.trim()}`, { replace: true });
      }
    } catch (error: any) {
      console.error("Failed to save profile:", error);
      setEditError(error.data?.message || error.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!loadedProfileUser || !authUser || isOwnProfile) return;
    setIsLoadingFollowAction(true);
    try {
      if (isFollowedByCurrentUser) {
        await unfollowUserMutation({ userIdToUnfollow: loadedProfileUser._id });
        // Optionally, show a success toast/notification here
      } else {
        await followUserMutation({ userIdToFollow: loadedProfileUser._id });
        // Optionally, show a success toast/notification here
      }
      // Data will refetch due to Convex reactivity, updating isFollowedByCurrentUser
    } catch (error: any) {
      // Explicitly type error
      console.error("Follow/Unfollow failed:", error);
      setActionError(error.data?.message || error.message || "Failed to update follow status.");
    } finally {
      setIsLoadingFollowAction(false);
    }
  };

  const triggerFileEdit = () => fileInputRef.current?.click();

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

  const currentImageUrl = newProfileImagePreview || loadedProfileUser?.imageUrl;

  // --- Action Handlers with Confirmation ---
  const confirmAndExecute = (
    actionFn: () => Promise<void>,
    successMsg: string,
    errorMsg: string,
    itemContext?: any
  ) => {
    setDialogState({ isOpen: false, title: "", description: "", onConfirm: () => {}, itemContext });
    actionFn()
      .then(() => {
        // Success: Optionally show a toast/notification here later
        // For now, errors are handled by setActionError within the specific confirm functions
      })
      .catch((error) => {
        console.error(errorMsg, error);
        setActionError(
          errorMsg +
            (error.data?.message || error.message
              ? `: ${error.data?.message || error.message}`
              : ".")
        );
      });
  };

  const handleUnvote = (storyId: Id<"stories">) => {
    setDialogState({
      isOpen: true,
      title: "Confirm Unvote",
      description: "Are you sure you want to remove your vote from this story?",
      confirmText: "Unvote",
      confirmVariant: "destructive",
      onConfirm: () =>
        confirmAndExecute(
          async () => {
            await unvoteStoryMutation({ storyId });
          },
          "Vote removed.",
          "Failed to remove vote."
        ),
    });
  };

  const handleDeleteStory = (storyId: Id<"stories">) => {
    setDialogState({
      isOpen: true,
      title: "Delete Submission?",
      description:
        "Are you sure you want to permanently delete this submission? This action cannot be undone.",
      confirmText: "Delete Submission",
      confirmVariant: "destructive",
      onConfirm: () =>
        confirmAndExecute(
          async () => {
            await deleteOwnStoryMutation({ storyId });
          },
          "Submission deleted.",
          "Failed to delete submission."
        ),
    });
  };

  const handleDeleteComment = (commentId: Id<"comments">) => {
    setDialogState({
      isOpen: true,
      title: "Delete Comment?",
      description: "Are you sure you want to permanently delete this comment?",
      confirmText: "Delete Comment",
      confirmVariant: "destructive",
      onConfirm: () =>
        confirmAndExecute(
          async () => {
            await deleteOwnCommentMutation({ commentId });
          },
          "Comment deleted.",
          "Failed to delete comment."
        ),
    });
  };

  const handleDeleteRating = (ratingId: Id<"storyRatings">) => {
    setDialogState({
      isOpen: true,
      title: "Delete Rating?",
      description: "Are you sure you want to delete your rating for this story?",
      confirmText: "Delete Rating",
      confirmVariant: "destructive",
      onConfirm: () =>
        confirmAndExecute(
          async () => {
            await deleteOwnRatingMutation({ storyRatingId: ratingId });
          },
          "Rating deleted.",
          "Failed to delete rating."
        ),
    });
  };

  const handleRemoveBookmark = (storyId: Id<"stories">) => {
    setDialogState({
      isOpen: true,
      title: "Remove Bookmark?",
      description: "Are you sure you want to remove this story from your bookmarks?",
      confirmText: "Remove",
      confirmVariant: "destructive",
      onConfirm: () =>
        confirmAndExecute(
          async () => {
            await addOrRemoveBookmarkMutation({ storyId });
          },
          "Bookmark removed.",
          "Failed to remove bookmark."
        ),
    });
  };

  const handleSignOut = () => {
    setDialogState({
      isOpen: true,
      title: "Confirm Sign Out",
      description: "Are you sure you want to sign out of your account?",
      confirmText: "Sign Out",
      confirmVariant: "default", // Or destructive if preferred
      onConfirm: () =>
        confirmAndExecute(
          async () => {
            await signOut();
            navigate("/", { replace: true });
          },
          "Signed out successfully.",
          "Failed to sign out."
        ),
    });
  };

  const handleDeleteAccount = () => {
    setDialogState({
      isOpen: true,
      title: "Delete Account?",
      description: (
        <>
          <p className="mb-2">Are you sure you want to permanently delete your account?</p>
          <p className="font-semibold text-red-600">
            This action cannot be undone and all your data will be lost.
          </p>
        </>
      ),
      confirmText: "Delete My Account",
      confirmVariant: "destructive",
      onConfirm: () =>
        confirmAndExecute(
          async () => {
            // TODO: Implement a deleteUserData mutation in Convex to clean up user data
            // await deleteUserDataMutation();
            if (authUser) {
              await authUser.delete();
            }
            navigate("/", { replace: true });
          },
          "Account deleted.",
          "Failed to delete account."
        ),
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 from-slate-50 to-gray-100 min-h-screen">
      <header
        className="mb-4 p-6 bg-[#ffffff] rounded-lg border border-gray-200"
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
                  <ProfileImagePlaceholder name={loadedProfileUser?.name} size="w-24 h-24" />
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
                alt={`${loadedProfileUser?.name || "User"}'s profile`}
                className="w-24  rounded-full object-cover border-2 border-gray-300"
              />
            ) : (
              <ProfileImagePlaceholder name={loadedProfileUser?.name} size="w-24 h-24" />
            )}
          </div>

          {/* Profile Info Section */}
          <div className="flex-grow text-center sm:text-left">
            {isEditing ? (
              <div className="flex items-center mb-2">
                {loadedProfileUser?.username == null ? (
                  <>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="text-xl font-normal text-[#292929] w-auto px-2 py-1 border border-gray-300 rounded-md mr-2"
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
                      className="text-xl font-normal text-[#292929] mr-2"
                      style={{ fontFamily: "Inter, sans-serif" }}>
                      {loadedProfileUser?.name || "Anonymous User"}
                    </span>
                    <span
                      className="text-lg text-gray-500"
                      style={{ fontFamily: "Inter, sans-serif" }}>
                      @{loadedProfileUser?.username}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-baseline mb-1">
                <h1
                  className="text-lg font-normal text-[#292929] mr-2"
                  style={{ fontFamily: "Inter, sans-serif" }}>
                  {loadedProfileUser?.name || "Anonymous User"}
                </h1>
                <p className="text-lg text-gray-600" style={{ fontFamily: "Inter, sans-serif" }}>
                  @{loadedProfileUser?.username || "N/A"}{" "}
                  {typeof userNumber === "number" && (
                    <span className="ml-2 text-xs text-gray-400">User #{userNumber}</span>
                  )}
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
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-[#292929] focus:border-[#292929]"
                  placeholder="Add a short bio (max 200 chars)"
                  style={{ fontFamily: "Inter, sans-serif" }}
                  rows={3}
                />
              ) : loadedProfileUser?.bio ? (
                <p
                  className="text-sm text-gray-700 w-full"
                  style={{ fontFamily: "Inter, sans-serif" }}>
                  {loadedProfileUser.bio}
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
                    className="flex-grow sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-black"
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
                    className="flex-grow  sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-black"
                    placeholder="Bluesky"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <input
                    type="url"
                    value={newLinkedin}
                    onChange={(e) => setNewLinkedin(e.target.value)}
                    className="flex-grow  sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-black"
                    placeholder="LinkedIn"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                </>
              ) : (
                <>
                  {loadedProfileUser?.website && (
                    <a
                      href={loadedProfileUser.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#292929]"
                      title="Website">
                      Website
                    </a>
                  )}
                  {loadedProfileUser?.twitter && (
                    <a
                      href={loadedProfileUser.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#292929]"
                      title="Twitter">
                      Twitter
                    </a>
                  )}
                  {loadedProfileUser?.bluesky && (
                    <a
                      href={loadedProfileUser.bluesky}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#292929]"
                      title="Bluesky">
                      Bluesky
                    </a>
                  )}
                  {loadedProfileUser?.linkedin && (
                    <a
                      href={loadedProfileUser.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#292929]"
                      title="LinkedIn">
                      LinkedIn
                    </a>
                  )}
                </>
              )}
            </div>

            {/* FOLLOW BUTTON - Placed after social links and before Edit Profile button for non-own profiles */}
            {!isOwnProfile && authUser && loadedProfileUser && !isEditing && (
              <div className="mt-3">
                <button
                  onClick={handleFollowToggle}
                  disabled={isLoadingFollowAction}
                  className={`px-6 py-2 rounded-md text-sm font-medium flex items-center justify-center transition-colors w-full sm:w-auto
                    ${
                      isFollowedByCurrentUser
                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : "bg-[#292929] text-white hover:bg-gray-700"
                    }`}
                  style={{ fontFamily: "Inter, sans-serif" }}>
                  {isLoadingFollowAction ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : isFollowedByCurrentUser ? (
                    <UserMinus className="w-4 h-4 mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {isLoadingFollowAction
                    ? "Processing..."
                    : isFollowedByCurrentUser
                      ? "Unfollow"
                      : "Follow"}
                </button>
              </div>
            )}

            {isOwnProfile && !isEditing && (
              <button
                onClick={handleEditToggle}
                className="mt-2 px-6 py-2 rounded-md bg-[#292929] border border-[#D8E1EC] text-[#ffffff] rounded-md text-sm font-medium hover:bg-[#F2F0ED] hover:text-[#292929] flex items-center justify-center sm:justify-start"
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
                  newUsername.trim() === (loadedProfileUser?.username || "").trim() &&
                  newBio === (loadedProfileUser?.bio || "") &&
                  newWebsite === (loadedProfileUser?.website || "") &&
                  newTwitter === (loadedProfileUser?.twitter || "") &&
                  newBluesky === (loadedProfileUser?.bluesky || "") &&
                  newLinkedin === (loadedProfileUser?.linkedin || ""))
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
        className="mb-4 p-4 bg-[#fff] rounded-md border border-gray-200"
        style={{ fontFamily: "Inter, sans-serif" }}>
        <h2 className="text-lg font-normal text-[#292929] mb-4 pb-2 border-b border-gray-300">
          My Vibes
        </h2>
        <div className="flex flex-row gap-8 justify-center sm:justify-start">
          <div className="flex flex-col items-center">
            <a
              href="#submissions"
              onClick={() => setActiveTab("votes")}
              className="text-xl text-[#292929] hover:underline">
              {stories.length}
            </a>
            <span className="text-sm text-gray-500">Submissions</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-votes"
              onClick={() => setActiveTab("votes")}
              className="text-xl text-[#292929] hover:underline">
              {votes.length}
            </a>
            <span className="text-sm text-gray-500">Votes</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-ratings"
              onClick={() => setActiveTab("ratings")}
              className="text-xl text-[#292929] hover:underline">
              {ratings.length}
            </a>
            <span className="text-sm text-gray-500">Ratings Given</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-comments"
              onClick={() => setActiveTab("comments")}
              className="text-xl text-[#292929] hover:underline">
              {comments.length}
            </a>
            <span className="text-sm text-gray-500">Comments</span>
          </div>
          {isOwnProfile && (
            <div className="flex flex-col items-center">
              <a
                href="#tab-section-bookmarks"
                onClick={() => setActiveTab("bookmarks")}
                className="text-xl text-[#292929] hover:underline">
                {userBookmarksCount ?? 0}
              </a>
              <span className="text-sm text-gray-500">Bookmarks</span>
            </div>
          )}
          {/* Followers and Following Counts */}
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-followers"
              onClick={() => setActiveTab("followers")}
              className="text-xl text-[#292929] hover:underline">
              {followersCount ?? 0}
            </a>
            <span className="text-sm text-gray-500">Followers</span>
          </div>
          <div className="flex flex-col items-center">
            <a
              href="#tab-section-following"
              onClick={() => setActiveTab("following")}
              className="text-xl text-[#292929] hover:underline">
              {followingCount ?? 0}
            </a>
            <span className="text-sm text-gray-500">Following</span>
          </div>
        </div>
      </section>

      {/* Section for User's Submissions (Stories) - Always Visible */}
      <section id="submissions" className="mb-6 p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
        <h2 className="text-lg font-normal text-[#292929] mb-4 pb-2 border-b border-gray-300">
          Submissions
        </h2>
        {stories.length === 0 && <p className="text-gray-500 italic">No submissions yet.</p>}
        {stories.length > 0 && (
          <ul className="space-y-4">
            {stories.map((story: StoryInProfile) => (
              <li
                key={story._id}
                className="p-4 bg-gray-50 border border-gray-200 rounded-md flex justify-between items-center transition-shadow">
                <div className="flex-grow mr-4">
                  <Link
                    to={`/s/${story.slug}`}
                    className="text-lg font-semibold text-[#292929] hover:underline">
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
      <div className="mb-20">
        {/* Tab Buttons */}
        <div className="flex border-b border-gray-300 mb-4">
          <button
            onClick={() => setActiveTab("votes")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none ${
              activeTab === "votes"
                ? "border-b-2 border-[#292929] text-[#292929]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            Votes ({votes?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("ratings")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none ${
              activeTab === "ratings"
                ? "border-b-2 border-[#292929] text-[#292929]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            Ratings Given ({ratings?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none ${
              activeTab === "comments"
                ? "border-b-2 border-[#292929] text-[#292929]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            Comments ({comments?.length ?? 0})
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab("bookmarks")}
              className={`py-2 px-4 text-sm font-medium focus:outline-none flex items-center ${
                activeTab === "bookmarks"
                  ? "border-b-2 border-[#292929] text-[#292929]"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              title="Bookmarks are private">
              <BookKey className="w-4 h-4 mr-1" />
              {isOwnProfile ? `Bookmarks (${userBookmarksCount ?? 0})` : "Bookmarks"}
            </button>
          )}
          {/* Followers Tab Button */}
          <button
            onClick={() => setActiveTab("followers")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none flex items-center ${
              activeTab === "followers"
                ? "border-b-2 border-[#292929] text-[#292929]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            <Users className="w-4 h-4 mr-1" /> Followers ({followersCount ?? 0})
          </button>
          {/* Following Tab Button */}
          <button
            onClick={() => setActiveTab("following")}
            className={`py-2 px-4 text-sm font-medium focus:outline-none flex items-center ${
              activeTab === "following"
                ? "border-b-2 border-[#292929] text-[#292929]"
                : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            <Users className="w-4 h-4 mr-1" /> Following ({followingCount ?? 0})
          </button>
        </div>

        {/* Conditionally Rendered Content */}
        {activeTab === "votes" && (
          <section
            id="tab-section-votes"
            className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
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
                        className="text-lg font-semibold text-[#292929] hover:underline">
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
                        className="text-lg font-semibold text-[#292929] hover:underline">
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
                          className="text-[#292929] hover:underline">
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
                        className="text-lg font-semibold text-[#292929] hover:underline">
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
                        onClick={() => handleRemoveBookmark(bookmark.storyId)}
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

        {/* Followers Tab Content */}
        {activeTab === "followers" && (
          <section
            id="tab-section-followers"
            className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
            {followersData === undefined && <p className="text-center p-8">Loading followers...</p>}
            {followersData && followersData.length === 0 && (
              <p className="text-gray-500 italic">No followers yet.</p>
            )}
            {followersData && followersData.length > 0 && (
              <ul className="space-y-3">
                {followersData.map((follower: FollowUserListItem | null) =>
                  follower ? (
                    <li
                      key={follower._id}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between transition-shadow hover:shadow-sm">
                      <Link
                        to={`/${follower.username}`}
                        className="flex items-center flex-grow mr-3">
                        {follower.imageUrl ? (
                          <img
                            src={follower.imageUrl}
                            alt={follower.name ?? "User"}
                            className="w-10 h-10 rounded-full mr-3 object-cover border border-gray-200"
                          />
                        ) : (
                          <ProfileImagePlaceholder name={follower.name} size="w-10 h-10" />
                        )}
                        <div>
                          <span className="text-sm font-semibold text-[#292929] hover:underline">
                            {follower.name || "Anonymous User"}
                          </span>
                          <p className="text-xs  text-gray-500">@{follower.username || "N/A"}</p>
                        </div>
                      </Link>
                      {/* Optional: Add follow/unfollow button for logged-in user viewing this list */}
                      {/* This requires checking if authUser.id is follower._id and if authUser is following this follower */}
                    </li>
                  ) : null
                )}
              </ul>
            )}
          </section>
        )}

        {/* Following Tab Content */}
        {activeTab === "following" && (
          <section
            id="tab-section-following"
            className="p-4 bg-[#F3F4F6] rounded-md border border-gray-200">
            {followingData === undefined && <p className="text-center p-8">Loading following...</p>}
            {followingData && followingData.length === 0 && (
              <p className="text-gray-500 italic">Not following anyone yet.</p>
            )}
            {followingData && followingData.length > 0 && (
              <ul className="space-y-3">
                {followingData.map((followedUser: FollowUserListItem | null) =>
                  followedUser ? (
                    <li
                      key={followedUser._id}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between transition-shadow hover:shadow-sm">
                      <Link
                        to={`/${followedUser.username}`}
                        className="flex items-center flex-grow mr-3">
                        {followedUser.imageUrl ? (
                          <img
                            src={followedUser.imageUrl}
                            alt={followedUser.name ?? "User"}
                            className="w-10 h-10 rounded-full mr-3 object-cover border border-gray-200"
                          />
                        ) : (
                          <ProfileImagePlaceholder name={followedUser.name} size="w-10 h-10" />
                        )}
                        <div>
                          <span className="text-sm p-1 font-semibold text-[#292929] hover:underline">
                            {followedUser.name || "Anonymous User"}
                          </span>
                          <p className="text-xs  p-1 text-gray-500">
                            @{followedUser.username || "N/A"}
                          </p>
                        </div>
                      </Link>
                      {/* Optional: Add follow/unfollow button for logged-in user viewing this list */}
                    </li>
                  ) : null
                )}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Manage Profile Section - Visible only to profile owner */}
      {isOwnProfile && (
        <section
          id="manage-profile"
          className="mb-4 p-6 bg-[#ffffff] rounded-lg border border-gray-200"
          style={{ fontFamily: "Inter, sans-serif" }}>
          <h2 className="text-lg font-normal text-[#292929] mb-6 pb-3 border-b border-gray-300">
            Manage Profile & Account
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Profile Settings and General Account Management */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-normal text-[#292929] mb-2">Profile Settings</h3>
                <button
                  onClick={() => {
                    if (!isEditing) handleEditToggle();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#292929] transition-colors disabled:opacity-50 flex items-center">
                  <Edit3 className="w-4 h-4 inline-block mr-2" /> Edit Profile Details
                </button>
              </div>

              <div>
                <h3 className="text-base font-normal text-[#292929] mb-2">Account Management</h3>
                <Link
                  to="/user-settings"
                  className="w-full mt-2 px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#292929] transition-colors flex items-center">
                  <Settings className="w-4 h-4 inline-block mr-2" /> Manage Account Settings
                  (Password, Email, etc.)
                </Link>
              </div>
            </div>

            {/* Column 2: Account Actions (Sign Out, Delete Account) */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-normal text-[#292929] mb-2">Account Actions</h3>
                <button
                  onClick={handleSignOut} // Updated to new handler
                  className="w-full mt-2 px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-sm text-[#292929] transition-colors flex items-center">
                  <LogOut className="w-4 h-4 inline-block mr-2" /> Sign Out
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

      {/* AlertDialog for confirmations */}
      <AlertDialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState({ ...dialogState, isOpen: false })}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        description={dialogState.description}
        confirmButtonText={dialogState.confirmText}
        confirmButtonVariant={dialogState.confirmVariant}
      />
    </div>
  );
}
