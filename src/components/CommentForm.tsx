import React from "react";
// import * as Dialog from "@radix-ui/react-dialog"; // Dialog removed
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@clerk/clerk-react"; // Added
import { useNavigate } from "react-router-dom"; // Added
import { Link } from "react-router-dom";

interface CommentFormProps {
  onSubmit: (content: string) => void; // Removed author from onSubmit
  parentId?: Id<"comments">;
}

export function CommentForm({ onSubmit, parentId }: CommentFormProps) {
  const [content, setContent] = React.useState("");
  // const [author, setAuthor] = React.useState(""); // Removed author state
  // const [showNameDialog, setShowNameDialog] = React.useState(false); // Removed dialog state
  const [error, setError] = React.useState<string | null>(null); // Added for validation error

  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    if (!isClerkLoaded) return; // Wait for Clerk

    if (!isSignedIn) {
      navigate("/sign-in");
      return;
    }

    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount < 10) {
      setError("Comment must be at least 10 words long.");
      return;
    }

    // if (!author) { // Author check removed
    //   setShowNameDialog(true);
    //   return;
    // }
    onSubmit(content);
    setContent("");
  };

  // const handleNameSubmit = (e: React.FormEvent) => { ... }; // Removed name submit handler

  const canSubmit = isClerkLoaded && isSignedIn;
  const isContentValid = content.trim().split(/\s+/).length >= 10;

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-4">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error && e.target.value.trim().split(/\s+/).length >= 10) {
              setError(null); // Clear error when user starts typing valid comment
            }
          }}
          placeholder={
            canSubmit
              ? "Write your comment... (Markdown supported, min. 10 words)"
              : "Sign in to write your comment..."
          }
          className={`w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] min-h-[100px] disabled:opacity-50 disabled:bg-gray-100 ${
            error ? "border-red-500 ring-red-500" : ""
          }`}
          required
          disabled={!canSubmit}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 text-sm text-[#545454]">
          {/* Comments are held for moderation before appearing on the site. */}
        </div>
        <button
          type="submit"
          disabled={!canSubmit || !content.trim() || !isContentValid}
          className="mt-2 px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
          title={
            !canSubmit
              ? "Sign in to comment"
              : !isContentValid && content.trim()
                ? "Comment must be at least 10 words."
                : undefined
          }>
          {parentId ? "Reply" : "Comment"}
        </button>
        {!canSubmit && isClerkLoaded && (
          <p className="mt-2 text-sm text-red-600">
            Please{" "}
            <Link to="/sign-in" className="underline hover:text-red-800">
              sign in
            </Link>{" "}
            to {parentId ? "reply" : "comment"}.
          </p>
        )}
      </form>

      {/* Dialog.Root and related code removed */}
    </>
  );
}
