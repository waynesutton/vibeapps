import React, { useState, createContext, useContext, ReactNode } from "react";
import { Link, Outlet, useOutletContext, useNavigate, useLocation } from "react-router-dom";
import { LayoutGrid, List, PlusCircle, Search, ThumbsUp, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { SiteSettings, Tag } from "../types";
import { ConvexBox } from "./ConvexBox";
import { Footer } from "./Footer";
import {
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
  useClerk,
  SignInButton,
  SignUpButton,
} from "@clerk/clerk-react";
import { UserSyncer } from "./UserSyncer";
import { WeeklyLeaderboard } from "./WeeklyLeaderboard";
import { TopCategoriesOfWeek } from "./TopCategoriesOfWeek";
import { dark } from "@clerk/themes";
import { AuthRequiredDialog } from "./ui/AuthRequiredDialog";

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
  const [userChangedSortPeriod, setUserChangedSortPeriod] = React.useState(false);
  const [sortPeriod, setSortPeriod] = React.useState<SortPeriod | undefined>(undefined);
  const [selectedTagId, setSelectedTagId] = React.useState<Id<"tags"> | undefined>(undefined);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Auth required dialog state
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);

  const headerTags = useQuery(api.tags.listHeader);

  const convexUserDoc = useQuery(
    api.users.getMyUserDocument,
    isClerkLoaded && isSignedIn ? {} : "skip"
  );

  React.useEffect(() => {
    if (settings) {
      if (!userChangedViewMode) {
        const { pathname } = location;
        const isAdminPage = pathname.startsWith("/admin");
        const isSetUsernamePage = pathname === "/set-username";
        const isUserSettingsPage = pathname.toLowerCase().startsWith("/user-settings");
        let isProfilePage = false;
        if (isSignedIn && convexUserDoc?.username) {
          isProfilePage = pathname === `/${convexUserDoc.username}`;
        }

        let newViewMode: "grid" | "list" | "vibe" | undefined = undefined;

        if (isAdminPage) {
          newViewMode =
            settings.adminDashboardDefaultViewMode === "none"
              ? undefined
              : settings.adminDashboardDefaultViewMode || "list";
        } else if (isProfilePage) {
          newViewMode =
            settings.profilePageDefaultViewMode === "none"
              ? undefined
              : settings.profilePageDefaultViewMode || "list";
        } else if (isSetUsernamePage) {
          newViewMode = undefined; // No view mode on set-username page
        } else if (isUserSettingsPage) {
          newViewMode = undefined; // No view mode on user-settings pages
        } else {
          // General site pages - this is where siteDefaultViewMode is used
          if (settings.siteDefaultViewMode === "none") {
            newViewMode = undefined;
          } else if (settings.siteDefaultViewMode === "list" && settings.showListView) {
            newViewMode = "list";
          } else if (settings.siteDefaultViewMode === "grid" && settings.showGridView) {
            newViewMode = "grid";
          } else if (settings.siteDefaultViewMode === "vibe" && settings.showVibeView) {
            newViewMode = "vibe";
          } else {
            // Fallback if default is hidden: pick first available shown view
            if (settings.showListView) newViewMode = "list";
            else if (settings.showGridView) newViewMode = "grid";
            else if (settings.showVibeView) newViewMode = "vibe";
            else newViewMode = undefined;
          }
        }
        // Only update viewMode if it has actually changed to prevent potential loops if newViewMode is the same as current viewMode
        if (viewMode !== newViewMode) {
          setViewMode(newViewMode);
        }
      }

      // Directly set sortPeriod from settings if available and user hasn't changed it, otherwise fallback
      if (!userChangedSortPeriod) {
        const newSortPeriod = settings.defaultSortPeriod || "all";
        if (sortPeriod !== newSortPeriod) {
          setSortPeriod(newSortPeriod);
        }
      } else if (sortPeriod === undefined) {
        // If user has supposedly changed it, but it's undefined, set a fallback.
        // This case should be rare.
        setSortPeriod("all");
      }
    } else {
      // Fallback if settings are not loaded yet
      if (!userChangedViewMode && viewMode === undefined) {
        setViewMode("vibe");
      }
      // Set sortPeriod to fallback only if it's currently undefined and user hasn't changed it
      if (!userChangedSortPeriod && sortPeriod === undefined) {
        setSortPeriod("all");
      }
    }
  }, [
    settings,
    userChangedViewMode,
    userChangedSortPeriod,
    location.pathname,
    isSignedIn,
    convexUserDoc,
    viewMode,
    sortPeriod,
  ]); // Added userChangedSortPeriod to deps

  // Effect to reset viewMode on specific pages like admin or profile
  // This effect might need adjustment based on the new default logic above.
  // The above useEffect already handles setting viewMode based on page type.
  // This one might only be needed if we want to CLEAR userChangedViewMode on navigation to these pages.
  React.useEffect(() => {
    const { pathname } = location;
    const isAdminPage = pathname.startsWith("/admin");
    const isSetUsernamePage = pathname === "/set-username";
    let isProfilePage = false;
    if (isSignedIn && convexUserDoc?.username) {
      isProfilePage = pathname === `/${convexUserDoc.username}`;
    }

    // If navigating to these pages and the user HAD manually changed view mode,
    // we might want to reset that so the page-specific default takes over cleanly.
    if ((isAdminPage || isSetUsernamePage || isProfilePage) && userChangedViewMode) {
      // The main useEffect will set the appropriate default for admin/profile.
      // Resetting userChangedViewMode allows the main effect to apply the page-specific default.
      setUserChangedViewMode(false);
    }
  }, [
    location.pathname,
    isSignedIn,
    convexUserDoc,
    userChangedViewMode, // Only run if userChangedViewMode changes
    // No dependency on viewMode or setViewMode here to avoid loops with the other effect
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

  // Determine if the sidebar should be shown based on view mode and settings
  // Ensure settings is loaded before trying to access its properties for showSidebar
  // Never show sidebar on story detail pages
  const isStoryDetailPage = location.pathname.startsWith("/s/");
  const showSidebar =
    settings &&
    !isStoryDetailPage &&
    (viewMode === "vibe" || viewMode === "list") &&
    (settings.showListView || settings.showVibeView);

  return (
    <>
      {/* <div className="absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(100%_50%_at_50%_0%,rgba(0,163,255,0.13)_0,rgba(0,163,255,0)_50%,rgba(0,163,255,0)_100%)]"></div> */}

      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#F2F4F7] to-[#ffffff]">
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
                    <SignUpButton mode="modal">
                      <button
                        className="px-4 py-2 bg-[#292929] border border-[#D8E1EC] text-[#ffffff] rounded-md text-xs font-normal hover:bg-[#F2F0ED] hover:text-[#292929] transition-colors"
                        type="button">
                        Sign up
                      </button>
                    </SignUpButton>
                    <SignInButton mode="modal">
                      <button
                        className="px-4 py-2 bg-[#292929] border border-[#D8E1EC] text-[#ffffff] rounded-md text-xs font-normal hover:bg-[#F2F0ED] hover:text-[#292929] transition-colors"
                        type="button">
                        Sign in
                      </button>
                    </SignInButton>
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
                  {/* Submit Button: Navigate to /submit if signed in, show auth dialog if not */}
                  <button
                    onClick={() => {
                      if (isSignedIn) {
                        navigate("/submit");
                      } else {
                        setShowAuthDialog(true);
                      }
                    }}
                    className="flex items-center gap-2 bg-[#292929] text-white px-3 py-1 rounded-md text-sm hover:bg-[#525252] transition-colors">
                    <PlusCircle className="w-4 h-4" />
                    Submit
                  </button>
                  {settings?.showListView && (
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
                  )}
                  {settings?.showGridView && (
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
                  )}
                  {settings?.showVibeView && (
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
                  )}
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
                        ?.filter((tag) => !tag.isHidden && tag.name !== "resendhackathon") // Filter hidden tags and resendhackathon
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
                      onChange={(e) => {
                        setSortPeriod(e.target.value as SortPeriod);
                        setUserChangedSortPeriod(true); // User has made a selection
                      }}
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

            {/* Tags Navigation Row */}
            {/* Conditionally render if there are tags to show and settings allow (future) */}
            {headerTags &&
              headerTags.filter((tag) => !tag.isHidden && tag.showInHeader).length > 0 && (
                <div className="py-3 mt-1 border-t border-[#D8E1EC]">
                  {" "}
                  {/* Tailwind gray-200 */}
                  <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2">
                    {/* "All" button */}
                    <button
                      onClick={() => {
                        setSelectedTagId(undefined);
                        if (location.pathname !== "/") navigate("/");
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors  focus:outline-none
                                ${
                                  selectedTagId === undefined
                                    ? "text-slate-700 ring-1 ring-gray-400 ring-offset-1"
                                    : "bg-[#F3F4F6] text-gray-700 border-[#D8E1EC] hover:bg-[white]"
                                }`}
                      title="Show All Categories">
                      All
                    </button>

                    {/* Tag links */}
                    {headerTags
                      .filter(
                        (tag) => !tag.isHidden && tag.showInHeader && tag.name !== "resendhackathon"
                      ) // Ensure only relevant tags are mapped
                      .map((tag) => (
                        <Link
                          key={tag._id}
                          to={`/tag/${tag.slug}`}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 focus:outline-none"
                          style={{
                            backgroundColor: tag.backgroundColor || "#F9FAFB", // Default to gray-50
                            color: tag.textColor || "#374151", // Default to gray-700
                            border: `1px solid ${tag.backgroundColor ? "transparent" : "#D1D5DB"}`, // Tailwind gray-300
                          }}
                          title={`View all apps tagged with ${tag.name}`}>
                          {/* Show emoji or icon if present */}
                          {tag.emoji ? (
                            <span className="mr-1 align-middle text-base">{tag.emoji}</span>
                          ) : tag.iconUrl ? (
                            <img
                              src={tag.iconUrl}
                              alt=""
                              className="inline-block w-4 h-4 mr-1 align-middle object-cover rounded-sm"
                              style={{ verticalAlign: "middle" }}
                            />
                          ) : null}
                          {tag.name}
                        </Link>
                      ))}
                  </div>
                </div>
              )}
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className={showSidebar ? "md:w-3/4" : "w-full"}>
              {children || <Outlet context={{ viewMode, selectedTagId, sortPeriod }} />}
            </div>
            {showSidebar && (
              <aside className="md:w-1/4 space-y-6">
                <WeeklyLeaderboard />
                <TopCategoriesOfWeek
                  selectedTagId={selectedTagId}
                  setSelectedTagId={setSelectedTagId}
                />
              </aside>
            )}
          </div>
        </main>
        <Footer />
        <ConvexBox />
      </div>

      {/* Auth Required Dialog */}
      <AuthRequiredDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        action="submit your app"
        title="Sign in to submit"
        description="You need to be signed in to submit apps to the community. Join to share your projects!"
      />
    </>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContextType>();
}
