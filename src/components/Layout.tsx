import React from 'react';
import { Link, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import { LayoutGrid, List, PlusCircle, Search } from 'lucide-react';
import type { Tag } from '../types';
import { ConvexBox } from './ConvexBox';
import { Footer } from './Footer';

interface LayoutContextType {
  viewMode: 'list' | 'grid';
  selectedTag?: string;
  timePeriod: 'today' | 'week' | 'month' | 'year';
}

export const AVAILABLE_TAGS: Tag[] = [
  { name: 'AI', showInHeader: true },
  { name: 'SaaS', showInHeader: true },
  { name: 'Clone', showInHeader: false },
  { name: 'Hackathon', showInHeader: true }
];

export function Layout() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('list');
  const [selectedTag, setSelectedTag] = React.useState<string>();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [timePeriod, setTimePeriod] = React.useState<'today' | 'week' | 'month' | 'year'>('week');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchExpanded(false);
    }
  };

  const handleSearchIconClick = () => {
    setIsSearchExpanded(!isSearchExpanded);
    if (!isSearchExpanded) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7EE] flex flex-col">
      <header className="py-4">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex justify-end mb-4">
              <form onSubmit={handleSearch} className="relative">
                <div className="flex items-center">
                  <div
                    className={`flex items-center transition-all duration-300 ease-in-out ${
                      isSearchExpanded ? 'w-64' : 'w-8'
                    }`}
                  >
                    {isSearchExpanded && (
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search what's been cooked..."
                        className="w-full pl-3 pr-10 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchIconClick}
                    className={`${
                      isSearchExpanded ? 'absolute right-2' : ''
                    } text-[#525252] hover:text-[#2A2825] p-1`}
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
            <h1 className="title-font text-[#2A2825] text-2xl mb-1">Vibe Apps</h1>
            <p className="text-sm text-[#787672] mb-4">Vibe Coding Apps Directory</p>
            <div className="flex justify-center gap-2 mb-4">
              {AVAILABLE_TAGS.filter(tag => tag.showInHeader).map((tag) => (
                <button
                  key={tag.name}
                  onClick={() => setSelectedTag(selectedTag === tag.name ? undefined : tag.name)}
                  className={`text-[#787672] hover:text-[#525252] px-3 py-1 rounded-md ${
                    selectedTag === tag.name ? 'bg-[#F4F0ED]' : ''
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-4 items-center">
              <div className="flex items-center gap-2">
                <Link
                  to="/submit"
                  className="flex items-center gap-2 text-[#787672] hover:text-[#525252] px-3 py-1 rounded-md"
                >
                  <PlusCircle className="w-4 h-4" />
                  Submit App
                </Link>
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value as 'today' | 'week' | 'month' | 'year')}
                  className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md border-none focus:outline-none focus:ring-1 focus:ring-[#D5D3D0] cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-[#F4F0ED]' : ''}`}
              >
                <List className="w-5 h-5 text-[#525252]" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-[#F4F0ED]' : ''}`}
              >
                <LayoutGrid className="w-5 h-5 text-[#525252]" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 flex-1">
        <Outlet context={{ viewMode, selectedTag, timePeriod }} />
      </main>
      <Footer />
      <ConvexBox />
    </div>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContextType>();
}