import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Story } from '../types';

interface StoryListProps {
  stories: Story[];
  viewMode: 'list' | 'grid';
}

export function StoryList({ stories, viewMode }: StoryListProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 20; // This should come from admin settings
  const totalPages = Math.ceil(stories.length / itemsPerPage);

  const containerClass = viewMode === 'grid' 
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
    : 'space-y-4';

  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedStories = stories.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString)) + ' ago';
    } catch (error) {
      return 'Date not available';
    }
  };

  return (
    <div className="space-y-8">
      <div className={containerClass}>
        {displayedStories.map((story) => (
          <article key={story.id} className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row'} gap-4 bg-white rounded-lg p-4 border border-[#D5D3D0]`}>
            <div className={`flex ${viewMode === 'grid' ? 'flex-row gap-1' : 'flex-col items-center'} ${viewMode === 'list' ? 'min-w-[40px]' : ''}`}>
              <button className="text-[#2A2825] hover:bg-[#F4F0ED] p-1 rounded">
                <ChevronUp className="w-5 h-5" />
              </button>
              <span className="text-[#525252] font-medium">{story.votes}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-[#525252] font-medium mb-2">
                <Link 
                  to={`/s/${story.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} 
                  className="hover:text-[#2A2825]"
                >
                  {story.title}
                </Link>
              </h2>
              {viewMode === 'grid' && (
                <>
                  {story.screenshot && (
                    <div className="mb-4 rounded-md overflow-hidden">
                      <img 
                        src={story.screenshot} 
                        alt={story.title}
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}
                  <p className="text-[#787672] text-sm mb-4 line-clamp-3">{story.description}</p>
                </>
              )}
              {story.customMessage && (
                <div className="mb-4 text-[#787671] bg-[#F3F0ED] border border-[#D5D3D0] rounded-md p-4">
                  {story.customMessage}
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-[#787672] flex-wrap">
                <span>by {story.author}</span>
                <span>{formatDate(story.createdAt)}</span>
                <Link 
                  to={`/s/${story.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} 
                  className="flex items-center gap-1"
                >
                  <MessageSquare className="w-4 h-4" />
                  {story.commentCount}
                </Link>
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
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-[#787672] hover:text-[#525252] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1 rounded-md ${
                currentPage === page
                  ? 'bg-[#F4F0ED] text-[#2A2825]'
                  : 'text-[#787672] hover:text-[#525252]'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 text-[#787672] hover:text-[#525252] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}