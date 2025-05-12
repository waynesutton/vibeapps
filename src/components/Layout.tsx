import React, { useState, createContext, useContext, ReactNode } from "react";
import { Link, Outlet, useOutletContext, useNavigate } from "react-router-dom";
import { LayoutGrid, List, PlusCircle, Search, ThumbsUp, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { SiteSettings, Tag } from "../types";
import { ConvexBox } from "./ConvexBox";
import { Footer } from "./Footer";
import { SignedIn, SignedOut, UserButton, useUser, useClerk } from "@clerk/clerk-react";
import { UserSyncer } from "./UserSyncer";

interface LayoutContextType {
  viewMode: "list" | "grid" | "vibe";
  selectedTagId?: Id<"tags">;
  sortPeriod: SortPeriod;
}

type SortPeriod =
  | "today"
  | "week"
  | "month"
  | "year"
  | "all"
  | "votes_today"
  | "votes_week"
  | "votes_month"
  | "votes_year";

export function Layout({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const { user: clerkUser, isSignedIn, isLoaded: isClerkLoaded } = useUser();
  const clerk = useClerk();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const settings = useQuery(api.settings.get);
  const [viewMode, setViewMode] = React.useState<"grid" | "list" | "vibe" | undefined>(undefined);
  const [userChangedViewMode, setUserChangedViewMode] = React.useState(false);
  const [sortPeriod, setSortPeriod] = React.useState<SortPeriod | undefined>(undefined);
  const [selectedTagId, setSelectedTagId] = React.useState<Id<"tags"> | undefined>(undefined);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const headerTags = useQuery(api.tags.listHeader);

  const convexUserDoc = useQuery(
    api.users.getMyUserDocument,
    isClerkLoaded && isSignedIn ? {} : "skip"
  );

  React.useEffect(() => {
    if (settings) {
      if (!userChangedViewMode) {
        setViewMode(settings.defaultViewMode || "vibe");
      }
      if (sortPeriod === undefined) {
        setSortPeriod(settings.defaultSortPeriod || "all");
      }
    } else {
      if (!userChangedViewMode && viewMode === undefined) {
        setViewMode("vibe");
      }
      if (sortPeriod === undefined) {
        setSortPeriod("all");
      }
    }
  }, [settings, userChangedViewMode]);

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

  let profileUrl = "/sign-in";
  let avatarUrl = clerkUser?.imageUrl;
  if (isClerkLoaded && isSignedIn) {
    if (convexUserDoc === undefined) {
      profileUrl = "#";
    } else if (convexUserDoc && convexUserDoc.username) {
      profileUrl = `/u/${convexUserDoc.username}`;
    } else {
      profileUrl = "/set-username";
    }
  }

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!showProfileMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showProfileMenu]);

  return (
    <>
      {/* <div className="absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(100%_50%_at_50%_0%,rgba(0,163,255,0.13)_0,rgba(0,163,255,0)_50%,rgba(0,163,255,0)_100%)]"></div> */}

      <div className="flex flex-col min-h-screen bg-[#F3F4F6]">
        <header className="pt-5 pb-4 bg-[#F3F4F6] sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center">
              {/* Left: Site Title */}
              <Link to="/" className="inline-block text-[#2A2825] hover:text-[#525252]">
                <h1 className="title-font text-2xl">{siteTitle}</h1>
              </Link>

              {/* Middle: Controls */}
              <div className="flex items-center gap-3">
                <Link
                  to="/submit"
                  className="flex items-center gap-2 text-[#787672] hover:text-[#525252] px-3 py-1 rounded-md text-sm">
                  <PlusCircle className="w-4 h-4" />
                  Submit
                </Link>
                <button
                  onClick={() => {
                    setViewMode("list");
                    setUserChangedViewMode(true);
                  }}
                  className={`p-2 rounded-md border border-[#D5D3D0] ${viewMode === "list" ? "bg-[#F4F0ED]" : "hover:bg-gray-100"}`}
                  aria-label="List View">
                  <List className="w-5 h-5 text-[#525252]" />
                </button>
                <button
                  onClick={() => {
                    setViewMode("grid");
                    setUserChangedViewMode(true);
                  }}
                  className={`p-2 rounded-md border border-[#D5D3D0] ${viewMode === "grid" ? "bg-[#F4F0ED]" : "hover:bg-gray-100"}`}
                  aria-label="Grid View">
                  <LayoutGrid className="w-5 h-5 text-[#525252]" />
                </button>
                <button
                  onClick={() => {
                    setViewMode("vibe");
                    setUserChangedViewMode(true);
                  }}
                  className={`p-2 rounded-md border border-[#D5D3D0] ${viewMode === "vibe" ? "bg-[#F4F0ED]" : "hover:bg-gray-100"}`}
                  aria-label="Vibe View">
                  <ThumbsUp className="w-5 h-5 text-[#525252]" />
                </button>

                {/* Categories Dropdown */}
                <div className="relative inline-block text-left">
                  <select
                    value={selectedTagId || ""}
                    onChange={(e) =>
                      setSelectedTagId(e.target.value ? (e.target.value as Id<"tags">) : undefined)
                    }
                    className="appearance-none cursor-pointer pl-3 pr-8 py-2 bg-white border border-[#D5D3D0] rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] hover:border-[#A8A29E]">
                    <option value="">All Categories</option>
                    {headerTags
                      ?.filter((tag) => !tag.isHidden) // Still filter hidden tags
                      .map((tag) => (
                        <option key={tag._id} value={tag._id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#787672]">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>

                {/* Sort Dropdown */}
                <div className="relative inline-block text-left">
                  <select
                    value={sortPeriod}
                    onChange={(e) => setSortPeriod(e.target.value as SortPeriod)}
                    className="appearance-none cursor-pointer pl-3 pr-8 py-2 bg-white border border-[#D5D3D0] rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] hover:border-[#A8A29E]">
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                    <option value="all">All Time</option>
                    <option value="votes_today">Most Vibes (Today)</option>
                    <option value="votes_week">Most Vibes (Week)</option>
                    <option value="votes_month">Most Vibes (Month)</option>
                    <option value="votes_year">Most Vibes (Year)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#787672]">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>

                {/* Search */}
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
                    className={`transition-all duration-300 ease-in-out h-9 text-sm focus:outline-none bg-white text-[#525252] rounded-md border ${isSearchExpanded ? "w-48 opacity-100 px-3 border-[#D5D3D0]" : "w-0 opacity-0 p-0 border-none"}`}
                    style={{ borderColor: isSearchExpanded ? "#D5D3D0" : "transparent" }}
                    tabIndex={isSearchExpanded ? 0 : -1}
                  />
                </form>
              </div>

              {/* Right: User/Sign-in */}
              <div className="flex items-center gap-2">
                <SignedOut>
                  <button
                    onClick={() => navigate("/sign-in")}
                    className="px-4 py-2 bg-[#2A2825] border border-[#D5D3D0] text-[#ffffff] rounded-md text-xs font-normal hover:bg-[#F2F0ED] hover:text-[#2A2825] transition-colors">
                    Sign in
                  </button>
                </SignedOut>
                <SignedIn>
                  <UserSyncer />
                  {/* Custom Avatar Button and Dropdown */}
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setShowProfileMenu((v) => !v)}
                      className="rounded-full border border-[#D5D3D0] w-9 h-9 overflow-hidden focus:outline-none"
                      aria-label="Open profile menu"
                      type="button">
                      <img src={avatarUrl} alt="User avatar" className="w-9 h-9 object-cover" />
                    </button>
                    {showProfileMenu && (
                      <div className="absolute right-0 mt-2 w-40 bg-white border border-[#D5D3D0] rounded-md shadow-lg z-50">
                        <a
                          href={profileUrl}
                          className="block px-4 py-2 text-sm text-[#2A2825] hover:bg-[#F3F4F6]"
                          onClick={() => setShowProfileMenu(false)}>
                          Profile
                        </a>
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            clerk.signOut();
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-[#2A2825] hover:bg-[#F3F4F6]"
                          type="button">
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                </SignedIn>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-8">
          {children || <Outlet context={{ viewMode, selectedTagId, sortPeriod }} />}
        </main>
        <Footer />
        <ConvexBox />
      </div>
    </>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContextType>();
}
