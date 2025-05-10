import React from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ThumbsUp, MessageCircle, Trash2, Star } from "lucide-react";

// Placeholder for loading and error states
const Loading = () => <div className="text-center p-8">Loading profile...</div>;
const ErrorDisplay = ({ message }: { message: string }) => (
  <div className="text-center p-8 text-red-600">Error: {message}</div>
);

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: authUser, isLoaded: isClerkLoaded } = useUser();
  const navigate = useNavigate();

  // Fetch profile data based on username from URL
  const profileData = useQuery(
    api.users.getUserProfileByUsername,
    username ? { username } : "skip"
  );

  const unvoteStoryMutation = useMutation(api.stories.voteStory);
  const deleteOwnStoryMutation = useMutation(api.stories.deleteOwnStory);
  const deleteOwnCommentMutation = useMutation(api.comments.deleteOwnComment);
  const deleteOwnRatingMutation = useMutation(api.storyRatings.deleteOwnRating);

  if (!isClerkLoaded || profileData === undefined) {
    return <Loading />;
  }

  if (!username) {
    // Should not happen if route is matched, but good check
    return <ErrorDisplay message="Username not found in URL." />;
  }

  if (profileData === null) {
    return <ErrorDisplay message={`Profile for user "${username}" not found.`} />;
  }

  const { user: profileUser, stories, votes, comments, ratings } = profileData;
  const isOwnProfile = authUser?.username === profileUser?.username; // Check if viewing own profile

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

  const handleDeleteRating = async (ratingId: Id<"storyRatings">) => {
    if (window.confirm("Are you sure you want to delete your rating?")) {
      try {
        await deleteOwnRatingMutation({ storyRatingId: ratingId });
        alert("Rating deleted successfully!");
        // Optionally, refetch profileData or optimistically update UI
      } catch (error) {
        console.error("Failed to delete rating:", error);
        alert("Failed to delete rating. See console for details.");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#2A2825] mb-2">
          {profileUser.name}'s Profile {isOwnProfile && "(Yours)"}
        </h1>
        {/* Display Clerk image if it's own profile and available, otherwise a placeholder or nothing */}
        {isOwnProfile && authUser?.imageUrl && (
          <img
            src={authUser.imageUrl}
            alt={`${authUser.fullName || authUser.username || "User"}'s profile picture`}
            className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-gray-300"
          />
        )}
        <p className="text-xl text-[#525252]">Username: {profileUser.username || "N/A"}</p>
        {profileUser.email && (
          <p className="text-sm text-[#787672]">
            Email: {profileUser.email} {isOwnProfile ? "" : "(Email hidden for privacy)"}
          </p>
        )}
        {profileUser.roles && profileUser.roles.length > 0 && (
          <p className="text-sm text-[#787672]">Roles: {profileUser.roles.join(", ")}</p>
        )}
      </header>

      {/* Section for User's Submissions (Stories) */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          Submissions
        </h2>
        {stories.length === 0 && <p className="text-gray-500 italic">No submissions yet.</p>}
        {stories.length > 0 && (
          <ul className="space-y-4">
            {stories.map((story) => (
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
                {isOwnProfile && (
                  <button
                    onClick={() => handleDeleteStory(story._id)}
                    className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                    title="Delete submission">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section for User's Votes */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          Votes
        </h2>
        {votes.length === 0 && <p className="text-gray-500 italic">No votes yet.</p>}
        {votes.length > 0 && (
          <ul className="space-y-4">
            {votes.map((vote) => (
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
                {isOwnProfile && (
                  <button
                    onClick={() => handleUnvote(vote.storyId)}
                    className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                    title="Remove vote">
                    <ThumbsUp className="w-4 h-4 transform rotate-180" /> Unvote
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section for User's Story Ratings */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          Ratings Given
        </h2>
        {ratings.length === 0 && <p className="text-gray-500 italic">No ratings given yet.</p>}
        {ratings.length > 0 && (
          <ul className="space-y-4">
            {ratings.map((rating) => (
              <li
                key={rating._id}
                className="p-4 bg-white border border-gray-200 rounded-md shadow-sm flex justify-between items-center">
                <div className="flex-grow mr-4">
                  <Link
                    to={`/s/${rating.storySlug}`}
                    className="text-lg font-semibold text-blue-600 hover:underline">
                    {rating.storyTitle || "View Story"}
                  </Link>
                  <p className="text-sm text-yellow-500 flex items-center">
                    Rated:{" "}
                    {Array(rating.value)
                      .fill(null)
                      .map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
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
                    className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                    title="Delete rating">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section for User's Comments */}
      <section>
        <h2 className="text-2xl font-semibold text-[#2A2825] mb-4 pb-2 border-b border-gray-300">
          Comments
        </h2>
        {comments.length === 0 && <p className="text-gray-500 italic">No comments yet.</p>}
        {comments.length > 0 && (
          <ul className="space-y-4">
            {comments.map((comment) => (
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
                {isOwnProfile && (
                  <button
                    onClick={() => handleDeleteComment(comment._id)}
                    className="text-sm text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-md flex items-center gap-1 flex-shrink-0"
                    title="Delete comment">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
