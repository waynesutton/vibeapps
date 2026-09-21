import { formatDistanceToNow } from "date-fns";
import type { Comment as CommentType } from "../types";
import ReactMarkdown from "react-markdown";
import { Id } from "../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { Reply } from "lucide-react";
import { renderTextWithMentions } from "../utils/mentions";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

interface CommentProps {
  comment: CommentType & { authorImageUrl?: string };
  onReply: (parentId: Id<"comments">) => void;
}

export function Comment({ comment, onReply }: CommentProps) {
  const authorDisplayName = comment.authorName || "Anonymous";
  const authorProfileUrl = comment.authorUsername
    ? `/${comment.authorUsername}`
    : null;

  const avatar = comment.authorImageUrl ? (
    <img
      src={comment.authorImageUrl}
      alt=""
      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
    />
  ) : (
    <span className="w-8 h-8 rounded-full bg-surface-alt border border-hairline flex items-center justify-center text-[13px] font-semibold text-soft flex-shrink-0">
      {authorDisplayName.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <article className="flex gap-3">
      {/* Avatar anchors the row so a thread reads as a conversation rather than
          a run of unattributed paragraphs. */}
      {authorProfileUrl && comment.authorUsername ? (
        <ProfileHoverCard username={comment.authorUsername}>
          <Link to={authorProfileUrl} className="flex-shrink-0">
            {avatar}
          </Link>
        </ProfileHoverCard>
      ) : (
        avatar
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {authorProfileUrl && comment.authorUsername ? (
            <ProfileHoverCard username={comment.authorUsername}>
              <Link
                to={authorProfileUrl}
                className="text-sm font-semibold text-ink hover:underline underline-offset-2"
              >
                {authorDisplayName}
              </Link>
            </ProfileHoverCard>
          ) : (
            <span className="text-sm font-semibold text-ink">
              {authorDisplayName}
            </span>
          )}
          <span className="text-xs text-faint tabular-nums">
            {formatDistanceToNow(comment._creationTime)} ago
          </span>
        </div>

        <div className="mt-0.5 text-[15px] leading-snug text-copy break-words [&_p]:m-0 [&_p+p]:mt-2">
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
          className="mt-1 inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-md text-[13px] font-medium text-soft hover:text-ink hover:bg-surface-hover transition-colors motion-reduce:transition-none"
        >
          <Reply className="w-3.5 h-3.5" aria-hidden="true" />
          Reply
        </button>
      </div>
    </article>
  );
}
