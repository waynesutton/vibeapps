import React from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import type { Comment as CommentType } from "../types";
import ReactMarkdown from "react-markdown";
import { Id } from "../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { renderTextWithMentions } from "../utils/mentions";

interface CommentProps {
  comment: CommentType;
  onReply: (parentId: Id<"comments">) => void;
}

export function Comment({ comment, onReply }: CommentProps) {
  const authorDisplayName = comment.authorName || "Anonymous";
  const authorProfileUrl = comment.authorUsername
    ? `/${comment.authorUsername}`
    : null;

  return (
    <div className="pl-4 mt-4">
      <div className="flex gap-2 items-center text-sm text-[#545454] mb-2">
        {authorProfileUrl ? (
          <Link
            to={authorProfileUrl}
            className="font-medium text-[#525252] hover:underline"
          >
            {authorDisplayName}
          </Link>
        ) : (
          <span className="font-medium text-[#525252]">
            {authorDisplayName}
          </span>
        )}
        <span>•</span>
        <span>{formatDistanceToNow(comment._creationTime)} ago</span>
      </div>
      <div className="prose prose-sm max-w-none text-[#525252]">
        <ReactMarkdown
          components={{
            // Override text rendering to process mentions
            p: ({ children }) => (
              <p>{renderTextWithMentions(String(children))}</p>
            ),
            // Handle mentions in other markdown elements too
            text: ({ children }) => (
              <>{renderTextWithMentions(String(children))}</>
            ),
          }}
        >
          {comment.content}
        </ReactMarkdown>
      </div>
      <button
        onClick={() => onReply(comment._id)}
        className="text-sm text-[#545454] hover:text-[#525252] mt-2"
      >
        reply
      </button>
    </div>
  );
}
