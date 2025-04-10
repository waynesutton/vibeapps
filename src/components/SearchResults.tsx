import React from 'react';
import { StoryList } from './StoryList';
import type { Story } from '../types';

interface SearchResultsProps {
  query: string;
  stories: Story[];
  viewMode: 'list' | 'grid';
}

export function SearchResults({ query, stories, viewMode }: SearchResultsProps) {
  const filteredStories = stories.filter(story => 
    story.title.toLowerCase().includes(query.toLowerCase()) ||
    story.description.toLowerCase().includes(query.toLowerCase()) ||
    story.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl text-[#525252] mb-2">
          Search Results for "{query}"
        </h2>
        <p className="text-[#787672]">
          Found {filteredStories.length} {filteredStories.length === 1 ? 'result' : 'results'}
        </p>
      </div>
      <StoryList stories={filteredStories} viewMode={viewMode} />
    </div>
  );
}