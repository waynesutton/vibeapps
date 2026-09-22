import React from "react";
// import * as Dialog from "@radix-ui/react-dialog"; // Dialog removed
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom"; // Added
import { toast } from "sonner"; // Corrected import for toast
import { MentionTextarea } from "./ui/MentionTextarea";

interface CommentFormProps {
  onSubmit: (content: string) => void; // Removed author from onSubmit
  parentId?: Id<"comments">;
  /** Shown for replies so a thread can be backed out of without posting. */
  onCancel?: () => void;
}

export function CommentForm({ onSubmit, parentId, onCancel }: CommentFormProps) {
  const [content, setContent] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { isSignedIn, isLoaded: isClerkLoaded } = useUser(); // Get user for author info
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isClerkLoaded) return;

    if (!isSignedIn) {
      toast.error("Please sign in to comment.");
      // It might be better to redirect or show a modal for sign-in
      navigate("/sign-in");
      return;
    }

    // Trim whitespace from the beginning and end of the content
    const trimmedContent = content.trim();

    // Validate character count instead of word count
    if (trimmedContent.length < 4) {
      setError("Comment must be at least 4 characters long.");
      return;
    }
    // Clear any previous error
    setError(null);
    onSubmit(trimmedContent); // Use trimmed content
    setContent(""); // Clear the textarea after submission
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    // Clear error when user starts typing
    if (error && value.trim().length >= 4) {
      setError(null);
    }
  };

  // Placeholder for a sign-in action, adjust as per your app's routing/UI flow
  const handleSignIn = () => {
    navigate("/sign-in");
  };

  const canSubmit = isClerkLoaded && isSignedIn;
  const isContentValid = content.trim().length >= 4;

  return (
    <>
      {/* The composer sits in its own card so it reads as a distinct place to
          write rather than a stray textarea above the thread. */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-hairline bg-surface p-2.5"
      >
        <MentionTextarea
          value={content}
          onChange={handleContentChange}
          placeholder={
            canSubmit
              ? parentId
                ? "Write a reply…"
                : "Add a comment…"
              : "Sign in to write your comment…"
          }
          className={`min-h-[60px] border-0 bg-transparent px-0 focus:ring-0 ${
            error ? "border-red-500 ring-red-500" : ""
          }`}
          rows={2}
          required
          disabled={!canSubmit}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-hairline pt-1.5">
          <p className="text-xs text-faint">
            Markdown supported · @ to mention
          </p>
          <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={() => {
                setContent("");
                setError(null);
                onCancel();
              }}
              className="inline-flex items-center justify-center h-8 px-3 rounded-md text-sm font-medium text-soft hover:text-ink hover:bg-surface-hover transition-colors motion-reduce:transition-none"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit || !content.trim() || !isContentValid}
            className="inline-flex items-center justify-center h-8 px-3.5 rounded-md bg-cta text-on-cta text-sm font-semibold hover:bg-cta-hover transition-colors motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              !canSubmit
                ? "Sign in to comment"
                : !isContentValid && content.trim()
                  ? "Comment must be at least 4 characters."
                  : undefined
            }
          >
            {parentId ? "Reply" : "Comment"}
          </button>
          </div>
        </div>
      </form>

      {!isClerkLoaded && (
        <p className="mt-2 text-sm text-soft">Loading user status...</p>
      )}

      {isClerkLoaded && !isSignedIn && (
        <div className="mt-4 p-3 bg-surface-alt border border-hairline rounded-md text-sm">
          <p className="text-copy">
            Please{" "}
            <button
              onClick={handleSignIn}
              className="text-ink hover:underline font-medium focus:outline-none"
            >
              sign in
            </button>{" "}
            or{" "}
            <button
              onClick={handleSignIn}
              className="text-ink hover:underline font-medium focus:outline-none"
            >
              sign up
            </button>{" "}
            to leave a comment.
          </p>
        </div>
      )}
    </>
  );
}
