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

  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isClerkLoaded) return; // Wait for Clerk

    if (!isSignedIn) {
      navigate("/sign-in");
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

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            canSubmit
              ? "Write your comment... (Markdown supported)"
              : "Sign in to write your comment..."
          }
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] min-h-[100px] disabled:opacity-50 disabled:bg-gray-100"
          required
          disabled={!canSubmit}
        />
        <div className="mt-2 text-sm text-[#787672]">
          Comments are held for moderation before appearing on the site.
        </div>
        <button
          type="submit"
          disabled={!canSubmit || !content.trim()}
          className="mt-2 px-4 py-2 bg-[#2A2825] text-white rounded-md hover:bg-[#525252] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
          title={!canSubmit ? "Sign in to comment" : undefined}>
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
