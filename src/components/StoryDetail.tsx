import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronUp, MessageSquare, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Story, Comment as CommentType } from '../types';
import { Comment } from './Comment';
import { CommentForm } from './CommentForm';

// Temporary mock data
const MOCK_COMMENTS: CommentType[] = [
  {
    id: '1',
    content: 'This is a really interesting perspective on web development!',
    author: 'webdev_enthusiast',
    createdAt: new Date(Date.now() - 3600000),
    storyId: '1',
    votes: 15,
  },
  {
    id: '2',
    content: 'I\'ve been working with these technologies, and I can confirm that the learning curve is worth it.',
    author: 'tech_guru',
    createdAt: new Date(Date.now() - 7200000),
    storyId: '1',
    votes: 8,
  },
];

interface StoryDetailProps {
  story: Story;
}

export function StoryDetail({ story }: StoryDetailProps) {
  const [comments, setComments] = React.useState<CommentType[]>(MOCK_COMMENTS);
  const [replyToId, setReplyToId] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState<number>(0);
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);
  const [hasRated, setHasRated] = React.useState(false);

  const handleComment = (content: string) => {
    const newComment: CommentType = {
      id: Date.now().toString(),
      content,
      author: 'current_user', // TODO: Replace with actual user
      createdAt: new Date(),
      storyId: story.id,
      parentId: replyToId || undefined,
      votes: 0,
    };
    setComments([...comments, newComment]);
    setReplyToId(null);
  };

  const handleRating = (value: number) => {
    if (!hasRated) {
      setRating(value);
      setHasRated(true);
      // TODO: Send rating to backend
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-[#787672] hover:text-[#525252] inline-block mb-6">
        ← Back to Apps
      </Link>
      
      <article className="bg-white rounded-lg p-4">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 min-w-[40px]">
            <button className="text-[#2A2825] hover:bg-[#F4F0ED] p-1 rounded">
              <ChevronUp className="w-5 h-5" />
            </button>
            <span className="text-[#525252] font-medium">{story.votes}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-medium text-[#525252] mb-2">
              <a href={story.url} className="hover:text-[#2A2825]" target="_blank" rel="noopener noreferrer">
                {story.title}
              </a>
            </h1>
            {story.screenshot && (
              <div className="mb-4 rounded-md overflow-hidden">
                <img 
                  src={story.screenshot} 
                  alt={story.title}
                  className="w-full max-h-96 object-cover"
                />
              </div>
            )}
            <p className="text-[#787672] mb-4">{story.description}</p>
            <div className="flex items-center gap-4 text-sm text-[#787672] flex-wrap">
              <span>by {story.author}</span>
              <span>{formatDistanceToNow(story.createdAt)} ago</span>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {comments.length}
              </div>
              <div className="flex gap-2 flex-wrap">
                {story.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/t/${tag}`}
                    className="text-[#787672] hover:text-[#525252]"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>

      <div className="mt-8 bg-white rounded-lg p-6">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-xl font-medium text-[#525252]">Rate this app</h2>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                disabled={hasRated}
                className={`p-1 transition-colors ${
                  hasRated
                    ? value <= rating
                      ? 'text-yellow-400'
                      : 'text-[#D5D3D0]'
                    : value <= (hoveredRating || rating)
                    ? 'text-yellow-400'
                    : 'text-[#D5D3D0] hover:text-yellow-400'
                }`}
              >
                <Star className="w-6 h-6 fill-current" />
              </button>
            ))}
          </div>
          {story.ratingCount && (
            <span className="text-sm text-[#787672]">
              ({story.ratingCount} {story.ratingCount === 1 ? 'rating' : 'ratings'})
            </span>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-medium text-[#525252] mb-4">Comments</h2>
        <CommentForm onSubmit={handleComment} />
        <div className="mt-8 space-y-6">
          {comments.map((comment) => (
            <React.Fragment key={comment.id}>
              <Comment
                comment={comment}
                onReply={(parentId) => setReplyToId(parentId)}
              />
              {replyToId === comment.id && (
                <div className="pl-8">
                  <CommentForm
                    onSubmit={handleComment}
                    parentId={comment.id}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}