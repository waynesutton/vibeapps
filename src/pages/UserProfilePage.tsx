import React from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { ThumbsUp, MessageCircle, Trash2 } from "lucide-react";

// Placeholder for loading and error states
const Loading = () => <div className="text-center p-8">Loading profile...</div>;
const ErrorDisplay = ({ message }: { message: string }) => (
  <div className="text-center p-8 text-red-600">Error: {message}</div>
);

export default function UserProfilePage() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  // Fetch the Convex user document for the currently authenticated user
  const convexUserDoc = useQuery(api.users.getAuthenticatedUserDoc, clerkUser ? {} : "skip");
  // Pass empty object as args if clerkUser exists, otherwise skip

  // Fetch user's stories if convexUserDoc and its _id are available
  const userStories = useQuery(
    api.users.listUserStories,
    convexUserDoc?._id ? { userId: convexUserDoc._id } : "skip"
  );

  // Fetch user's votes if convexUserDoc and its _id are available
  const userVotes = useQuery(
    api.users.listUserVotes,
    convexUserDoc?._id ? { userId: convexUserDoc._id } : "skip"
  );

  // Fetch user's comments if convexUserDoc and its _id are available
  const userComments = useQuery(
    api.users.listUserComments,
    convexUserDoc?._id ? { userId: convexUserDoc._id } : "skip"
  );

  const unvoteStoryMutation = useMutation(api.stories.voteStory);
  const deleteOwnStoryMutation = useMutation(api.stories.deleteOwnStory);
  const deleteOwnCommentMutation = useMutation(api.comments.deleteOwnComment);

  if (!isClerkLoaded || convexUserDoc === undefined) {
    return <Loading />;
  }

  if (!clerkUser) {
    return <ErrorDisplay message="User not found or not logged in." />;
  }

  if (convexUserDoc === null && isClerkLoaded) {
    // This means user is authenticated with Clerk but not found in Convex DB yet.
    // ensureUser should have run. This might indicate a sync delay or an issue.
    return <ErrorDisplay message="User data not yet synced. Please try refreshing shortly." />;
  }

  const handleUnvote = async (storyId: Id<"stories">) => {
    try {
      await unvoteStoryMutation({ storyId });
      // Optionally, add optimistic updates or refetch data
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
        // Optionally, refetch data or optimistically update UI
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
        // Optionally, refetch data or optimistically update UI
      } catch (error) {
        console.error("Failed to delete comment:", error);
        alert("Failed to delete comment. See console for details.");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#2A2825] mb-2">Your Profile</h1>
        {clerkUser.imageUrl && (
          <img
            src={clerkUser.imageUrl}
            alt={`${clerkUser.fullName || clerkUser.username || "User"}'s profile picture`}
            className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-gray-300"
          />
        )}
        <p className="text-xl text-[#525252]">
          Welcome, {clerkUser.fullName || clerkUser.username || "User"}!
        </p>
        <p className="text-sm text-[#787672]">Clerk User ID: {clerkUser.id}</p>
        {clerkUser.primaryEmailAddress && (
          <p className="text-sm text-[#787672]">
            Email: {clerkUser.primaryEmailAddress.emailAddress}
          </p>
        )}
      </header>

      {/* Section for User's Submissions (Stories) */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          My Submissions
        </h2>
        {userStories === undefined && <p>Loading submissions...</p>}
        {userStories && userStories.length === 0 && (
          <p className="text-gray-500 italic">You haven't submitted any apps yet.</p>
        )}
        {userStories && userStories.length > 0 && (
          <ul className="space-y-4">
            {userStories.map((story) => (
              <li
                key={story._id}
                className="p-4 bg-white border border-gray-200 rounded-md shadow-sm flex justify-between items-center">
                <div className="flex-grow mr-4">
                  <Link
                    to={`/s/${story.slug}`}
                    className="text-lg font-semibold text-blue-600 hover:underline">
                    {story.title}
                  </Link>
                  <p className="text-sm text-gray-600 truncate">{story.description}</p>
                  <p className="text-xs text-gray-400">Status: {story.status}</p>
                </div>
                <button
                  onClick={() => handleDeleteStory(story._id)}
                  className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                  title="Delete submission">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section for User's Votes */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          My Votes
        </h2>
        {userVotes === undefined && <p>Loading votes...</p>}
        {userVotes && userVotes.length === 0 && (
          <p className="text-gray-500 italic">You haven't voted for any apps yet.</p>
        )}
        {userVotes && userVotes.length > 0 && (
          <ul className="space-y-4">
            {userVotes.map((vote) => (
              <li
                key={vote._id}
                className="p-4 bg-white border border-gray-200 rounded-md shadow-sm flex justify-between items-center">
                <div className="flex-grow mr-4">
                  <Link
                    to={`/s/${vote.storySlug}`}
                    className="text-lg font-semibold text-blue-600 hover:underline">
                    {vote.storyTitle || "View Story"}
                  </Link>
                  <p className="text-xs text-gray-400">
                    Voted on: {new Date(vote._creationTime).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleUnvote(vote.storyId)}
                  className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                  title="Remove vote">
                  <ThumbsUp className="w-4 h-4 transform rotate-180" /> Unvote
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section for User's Comments */}
      <section>
        <h2 className="text-2xl font-semibold text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          My Comments
        </h2>
        {userComments === undefined && <p>Loading comments...</p>}
        {userComments && userComments.length === 0 && (
          <p className="text-gray-500 italic">You haven't posted any comments yet.</p>
        )}
        {userComments && userComments.length > 0 && (
          <ul className="space-y-4">
            {userComments.map((comment) => (
              <li
                key={comment._id}
                className="p-4 bg-white border border-gray-200 rounded-md shadow-sm flex justify-between items-center">
                <div className="flex-grow mr-4">
                  <p className="text-gray-700 mb-1 whitespace-pre-wrap">{comment.content}</p>
                  <p className="text-xs text-gray-400">
                    Commented on{" "}
                    <Link
                      to={`/s/${comment.storySlug}#comments`}
                      className="text-blue-500 hover:underline">
                      {comment.storyTitle || "story"}
                    </Link>{" "}
                    - {new Date(comment._creationTime).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteComment(comment._id)}
                  className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                  title="Delete comment">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
