import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import type { Comment as CommentType } from '../types';
import ReactMarkdown from 'react-markdown';

interface CommentProps {
  comment: CommentType;
  onReply: (parentId: string) => void;
}

export function Comment({ comment, onReply }: CommentProps) {
  return (
    <div className="pl-4 mt-4">
      <div className="flex gap-2 items-center text-sm text-[#787672] mb-2">
        <span>{comment.author}</span>
        <span>•</span>
        <span>{formatDistanceToNow(comment.createdAt)} ago</span>
      </div>
      <div className="prose prose-sm max-w-none text-[#525252]">
        <ReactMarkdown>{comment.content}</ReactMarkdown>
      </div>
      <button
        onClick={() => onReply(comment.id)}
        className="text-sm text-[#787672] hover:text-[#525252] mt-2"
      >
        reply
      </button>
    </div>
  );
}