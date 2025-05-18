import React, { useState, createContext, useContext, ReactNode } from "react";
import { Link, Outlet, useOutletContext, useNavigate, useLocation } from "react-router-dom";
import { LayoutGrid, List, PlusCircle, Search, ThumbsUp, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { SiteSettings, Tag } from "../types";
import { ConvexBox } from "./ConvexBox";
import { Footer } from "./Footer";
import { SignedIn, SignedOut, UserButton, useUser, useClerk } from "@clerk/clerk-react";
import { UserSyncer } from "./UserSyncer";
import { WeeklyLeaderboard } from "./WeeklyLeaderboard";
import { TopCategoriesOfWeek } from "./TopCategoriesOfWeek";

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
  const location = useLocation();

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

  // Effect to reset viewMode on specific pages like admin or profile
  React.useEffect(() => {
    const { pathname } = location;
    const isAdminPage = pathname.startsWith("/admin");
    const isSetUsernamePage = pathname === "/set-username";

    let isProfilePage = false;
    if (isSignedIn && convexUserDoc?.username) {
      isProfilePage = pathname === `/${convexUserDoc.username}`;
    }

    if (isAdminPage || isSetUsernamePage || isProfilePage) {
      // If a view mode is active or was actively chosen by user, reset it
      // This ensures no view mode button is highlighted on these specific pages
      // and that default view logic applies if navigating away from these pages
      // (not via a view-mode button click).
      if (viewMode !== undefined || userChangedViewMode) {
        setViewMode(undefined);
        setUserChangedViewMode(false);
      }
    }
  }, [
    location.pathname,
    isSignedIn,
    convexUserDoc,
    viewMode,
    setViewMode,
    userChangedViewMode,
    setUserChangedViewMode,
  ]);

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
      profileUrl = `/${convexUserDoc.username}`;
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

      <div className="flex flex-col min-h-screen bg-[#F2F4F7]">
        <header className="pt-5 pb-0 bg-[#F2F4F7] sticky top-0 z-50">
          <div className="container mx-auto px-4">
            {/* Responsive header layout */}
            <div className="flex flex-col gap-y-2 md:flex-row md:justify-between md:items-center">
              {/* Row 1: Site Title & Profile Icon (Mobile) / Desktop: SiteTitle order-1, ProfileIcon order-3 */}
              <div className="flex w-full justify-between items-center md:contents">
                {/* Left: Site Title */}
                <Link
                  to="/"
                  className="inline-block text-[#292929] hover:text-[#525252] md:order-1">
                  <h1 className="title-font text-2xl">{siteTitle}</h1>
                </Link>
                {/* Right: User/Sign-in */}
                <div className="flex items-center gap-2 md:order-3">
                  <SignedOut>
                    <button
                      onClick={() => navigate("/sign-in")}
                      className="px-4 py-2 bg-[#292929] border border-[#D8E1EC] text-[#ffffff] rounded-md text-xs font-normal hover:bg-[#F2F0ED] hover:text-[#292929] transition-colors">
                      Sign in
                    </button>
                  </SignedOut>
                  <SignedIn>
                    <UserSyncer />
                    {/* Custom Avatar Button and Dropdown */}
                    <div className="relative" ref={menuRef}>
                      <a
                        href={profileUrl}
                        className="block px-4 py-2 text-sm text-[#292929] hover:bg-[#F3F4F6]"
                        onClick={() => setShowProfileMenu(false)}>
                        <button
                          onClick={() => setShowProfileMenu((v) => !v)}
                          className="rounded-full border border-[#D8E1EC] w-9 h-9 overflow-hidden focus:outline-none"
                          aria-label="Open profile menu"
                          type="button">
                          <img src={avatarUrl} alt="User avatar" className="w-9 h-9 object-cover" />
                        </button>
                      </a>
                    </div>
                  </SignedIn>
                </div>
              </div>

              {/* Middle Controls Wrapper for stacking on mobile and centering on desktop */}
              <div className="flex flex-col md:flex-row md:items-center md:gap-3 md:order-2">
                {/* Row 2 content: Submit & View Options */}
                <div className="flex w-full md:w-auto items-center gap-3">
                  <Link
                    to="/submit"
                    className="flex items-center gap-2 text-[#545454] hover:text-[#525252] px-3 py-1 rounded-md text-sm">
                    <PlusCircle className="w-4 h-4" />
                    Submit
                  </Link>
                  <button
                    onClick={() => {
                      setViewMode("list");
                      setUserChangedViewMode(true);
                      navigate("/"); // Navigate to homepage
                    }}
                    className={`p-2 rounded-md border border-[#D8E1EC] ${viewMode === "list" ? "bg-[#FBF5DB]" : "hover:bg-gray-100"}`}
                    aria-label="List View">
                    <List className="w-5 h-5 text-[#545454]" />
                  </button>
                  <button
                    onClick={() => {
                      setViewMode("grid");
                      setUserChangedViewMode(true);
                      navigate("/"); // Navigate to homepage
                    }}
                    className={`p-2 rounded-md border border-[#D8E1EC] ${viewMode === "grid" ? "bg-[#FBF5DB]" : "hover:bg-gray-100"}`}
                    aria-label="Grid View">
                    <LayoutGrid className="w-5 h-5 text-[#545454]" />
                  </button>
                  <button
                    onClick={() => {
                      setViewMode("vibe");
                      setUserChangedViewMode(true);
                      navigate("/"); // Navigate to homepage
                    }}
                    className={`p-2 rounded-md border border-[#D8E1EC] ${viewMode === "vibe" ? "bg-[#FBF5DB]" : "hover:bg-gray-100"}`}
                    aria-label="Vibe View">
                    <ThumbsUp className="w-5 h-5 text-[#545454]" />
                  </button>
                </div>

                {/* Row 3 content: Dropdowns & Search */}
                <div className="flex w-full md:w-auto items-center gap-3">
                  {/* Categories Dropdown */}
                  <div className="relative inline-block text-left">
                    <select
                      value={selectedTagId || ""}
                      onChange={(e) =>
                        setSelectedTagId(
                          e.target.value ? (e.target.value as Id<"tags">) : undefined
                        )
                      }
                      className="appearance-none cursor-pointer pl-3 pr-8 py-2 bg-white border border-[#D8E1EC] rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] hover:border-[#A8A29E]">
                      <option value="">All Categories</option>
                      {headerTags
                        ?.filter((tag) => !tag.isHidden) // Still filter hidden tags
                        .map((tag) => (
                          <option key={tag._id} value={tag._id}>
                            {tag.name}
                          </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#545454]">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="relative inline-block text-left">
                    <select
                      value={sortPeriod}
                      onChange={(e) => setSortPeriod(e.target.value as SortPeriod)}
                      className="appearance-none cursor-pointer pl-3 pr-8 py-2 bg-white border border-[#D8E1EC] rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] hover:border-[#A8A29E]">
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#545454]">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Search */}
                  <button
                    type="button"
                    onClick={handleSearchIconClick}
                    className="p-2 text-[#525252] hover:text-[#292929]"
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
              </div>
            </div>
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className={viewMode === "vibe" || viewMode === "list" ? "md:w-3/4" : "w-full"}>
              {children || <Outlet context={{ viewMode, selectedTagId, sortPeriod }} />}
            </div>
            {(viewMode === "vibe" || viewMode === "list") && (
              <aside className="md:w-1/4 space-y-6">
                <WeeklyLeaderboard />
                <TopCategoriesOfWeek />
              </aside>
            )}
          </div>
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
