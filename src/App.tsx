import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout, AVAILABLE_TAGS } from './components/Layout';
import { StoryList } from './components/StoryList';
import { StoryForm } from './components/StoryForm';
import { StoryDetail } from './components/StoryDetail';
import { SearchResults } from './components/SearchResults';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { FormBuilder } from './components/admin/FormBuilder';
import { FormResults } from './components/admin/FormResults';
import { useLayoutContext } from './components/Layout';

const MOCK_STORIES = [
  {
    id: '1',
    title: 'The Future of AI',
    content: 'Artificial Intelligence is reshaping our world in unprecedented ways...',
    author: 'Jane Smith',
    createdAt: '2024-01-15T12:00:00Z',
    tags: ['technology', 'ai'],
    slug: 'the-future-of-ai',
    votes: 42,
    commentCount: 15,
    description: 'An exploration of how AI is changing our world'
  },
  {
    id: '2',
    title: 'Sustainable Living',
    content: 'Small changes in our daily lives can make a big impact...',
    author: 'John Doe',
    createdAt: '2024-01-14T15:30:00Z',
    tags: ['environment', 'lifestyle'],
    slug: 'sustainable-living',
    votes: 38,
    commentCount: 12,
    description: 'Tips for living a more sustainable lifestyle'
  },
  {
    id: '3',
    title: 'Modern Web Development',
    content: 'The landscape of web development is constantly evolving...',
    author: 'Alex Johnson',
    createdAt: '2024-01-13T09:45:00Z',
    tags: ['technology', 'programming'],
    slug: 'modern-web-development',
    votes: 56,
    commentCount: 23,
    description: 'Exploring current trends in web development'
  }
];

function HomePage() {
  const { viewMode, selectedTag } = useLayoutContext();
  const filteredStories = selectedTag
    ? MOCK_STORIES.filter(story => story.tags.includes(selectedTag))
    : MOCK_STORIES;
  return <StoryList stories={filteredStories} viewMode={viewMode} />;
}

function StoryPage() {
  const story = MOCK_STORIES[0]; // TODO: Fetch story based on slug
  return <StoryDetail story={story} />;
}

function SearchPage() {
  const { viewMode } = useLayoutContext();
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q') || '';
  return <SearchResults query={query} stories={MOCK_STORIES} viewMode={viewMode} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/submit" element={<StoryForm />} />
          <Route path="/s/:slug" element={<StoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/forms/new" element={<FormBuilder onSave={console.log} />} />
          <Route path="/admin/forms/:id" element={<FormBuilder onSave={console.log} />} />
          <Route path="/admin/forms/:id/results" element={<FormResults />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;