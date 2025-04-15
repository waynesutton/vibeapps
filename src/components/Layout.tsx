import React from "react";
import { Link, Outlet, useOutletContext, useNavigate } from "react-router-dom";
import { LayoutGrid, List, PlusCircle, Search, ThumbsUp, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { SiteSettings, Tag } from "../types";
import { ConvexBox } from "./ConvexBox";
import { Footer } from "./Footer";

interface LayoutContextType {
  viewMode: "list" | "grid" | "vibe";
  selectedTagId?: Id<"tags">;
  sortPeriod: SortPeriod;
}

type SortPeriod = "today" | "week" | "month" | "year" | "all";

export function Layout() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = React.useState<"grid" | "list" | "vibe">();
  const [selectedTagId, setSelectedTagId] = React.useState<Id<"tags">>();
  const [sortPeriod, setSortPeriod] = React.useState<SortPeriod>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const headerTags = useQuery(api.tags.listHeader);
  const settings = useQuery(api.settings.get);

  React.useEffect(() => {
    if (settings?.defaultViewMode && !viewMode) {
      setViewMode(settings.defaultViewMode);
    } else if (!settings && !viewMode) {
      setViewMode("vibe");
    }
  }, [settings, viewMode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
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

  const siteTitle = settings?.siteTitle || "Vibe Apps";

  return (
    <div className="min-h-screen bg-[#F8F7F7] flex flex-col">
      <header className="pt-5 pb-4">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <Link to="/" className="inline-block text-[#2A2825] hover:text-[#525252]">
              <h1 className="title-font text-2xl mb-1">{siteTitle}</h1>
            </Link>
            <p className="text-sm text-[#787672] mb-4">Vibe Coding Apps Directory</p>
            <div className="flex justify-center flex-wrap gap-2 mb-4 px-4">
              {headerTags === undefined && (
                <div className="text-sm text-gray-500">Loading tags...</div>
              )}
              {headerTags
                // Filter tags shown in header AND not hidden
                ?.filter((tag) => tag.showInHeader && !tag.isHidden)
                .map((tag) => {
                  const isSelected = selectedTagId === tag._id;
                  const defaultBgColor = "#FFFFFF"; // White background default
                  const defaultTextColor = "#787672"; // Default text color
                  const selectedBgColor = "#F4F0ED"; // Selected background
                  const selectedTextColor = "#2A2825"; // Selected text

                  const bgColor = isSelected
                    ? selectedBgColor
                    : tag.backgroundColor || defaultBgColor;
                  const textColor = isSelected
                    ? selectedTextColor
                    : tag.textColor || defaultTextColor;
                  const border = isSelected
                    ? `1px solid ${selectedBgColor}` // Use BG color for border when selected
                    : tag.backgroundColor
                      ? "1px solid transparent" // No border if custom BG
                      : `1px solid #D5D3D0`; // Default border

                  return (
                    <button
                      key={tag._id}
                      onClick={() => setSelectedTagId(isSelected ? undefined : tag._id)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out hover:opacity-80`}
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                        border: border,
                      }}>
                      {tag.name}
                    </button>
                  );
                })}
            </div>
            <div className="flex justify-center gap-4 items-center relative">
              <div className="flex items-center gap-2">
                <Link
                  to="/submit"
                  className="flex items-center gap-2 text-[#787672] hover:text-[#525252] px-3 py-1 rounded-md">
                  <PlusCircle className="w-4 h-4" />
                  Submit App
                </Link>
              </div>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md ${viewMode === "list" ? "bg-[#F4F0ED]" : ""}`}
                aria-label="List View">
                <List className="w-5 h-5 text-[#525252]" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md ${viewMode === "grid" ? "bg-[#F4F0ED]" : ""}`}
                aria-label="Grid View">
                <LayoutGrid className="w-5 h-5 text-[#525252]" />
              </button>
              <button
                onClick={() => setViewMode("vibe")}
                className={`p-2 rounded-md ${viewMode === "vibe" ? "bg-[#F4F0ED]" : ""}`}
                aria-label="Vibe View">
                <ThumbsUp className="w-5 h-5 text-[#525252]" />
              </button>
              <div className="relative inline-block text-left">
                <div>
                  <select
                    value={sortPeriod}
                    onChange={(e) => setSortPeriod(e.target.value as SortPeriod)}
                    className="appearance-none cursor-pointer pl-3 pr-8 py-2 bg-white border border-[#D5D3D0] rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] hover:border-[#A8A29E]">
                    <option value="all">All Time</option>
                    <option value="year">This Year</option>
                    <option value="month">This Month</option>
                    <option value="week">This Week</option>
                    <option value="today">Today</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#787672]">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSearchIconClick}
                  className="p-2 text-[#525252] hover:text-[#2A2825]"
                  aria-label="Search">
                  <Search className="w-5 h-5" />
                </button>
                <form onSubmit={handleSearch} className="flex items-center">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className={`transition-all duration-300 ease-in-out h-9 px-3 text-sm focus:outline-none bg-white text-[#525252] rounded-md border ${isSearchExpanded ? "w-64 opacity-100 border-[#D5D3D0]" : "w-0 opacity-0 p-0 border-none hidden"}`}
                    style={{ borderColor: isSearchExpanded ? "#D5D3D0" : "transparent" }}
                  />
                </form>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 flex-1">
        {viewMode ? (
          <Outlet context={{ viewMode, selectedTagId, sortPeriod }} />
        ) : (
          <div>Loading view...</div>
        )}
      </main>
      <Footer />
      <ConvexBox />
    </div>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContextType>();
}
