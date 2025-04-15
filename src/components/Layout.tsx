import React from "react";
import { Link, Outlet, useOutletContext, useNavigate } from "react-router-dom";
import { LayoutGrid, List, PlusCircle, Search, ThumbsUp } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { SiteSettings, Tag } from "../types";
import { ConvexBox } from "./ConvexBox";
import { Footer } from "./Footer";

interface LayoutContextType {
  viewMode: "list" | "grid" | "vibe";
  selectedTagId?: Id<"tags">;
}

export function Layout() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = React.useState<"grid" | "list" | "vibe">("list");
  const [selectedTagId, setSelectedTagId] = React.useState<Id<"tags">>();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const headerTags = useQuery(api.tags.listHeader);
  const settings = useQuery(api.settings.get);

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
      <header className="py-4">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex justify-end mb-4">
              <form onSubmit={handleSearch} className="relative">
                <div className="flex items-center">
                  <div
                    className={`flex items-center transition-all duration-300 ease-in-out ${
                      isSearchExpanded ? "w-64" : "w-0"
                    } overflow-hidden`}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search apps..."
                      className={`w-full pl-3 pr-10 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] transition-opacity duration-300 ${
                        isSearchExpanded ? "opacity-100" : "opacity-0"
                      }`}
                      tabIndex={isSearchExpanded ? 0 : -1}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchIconClick}
                    className={`text-[#525252] hover:text-[#2A2825] p-1 ${isSearchExpanded ? "ml-2" : ""}`}>
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
            <h1 className="title-font text-[#2A2825] text-2xl mb-1">{siteTitle}</h1>
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
            <div className="flex justify-center gap-4 items-center">
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
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 flex-1">
        <Outlet context={{ viewMode, selectedTagId }} />
      </main>
      <Footer />
      <ConvexBox />
    </div>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContextType>();
}
