import React, { ReactNode } from "react";
import {
  Link,
  Outlet,
  useOutletContext,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  LayoutGrid,
  List,
  PlusCircle,
  Search,
  ThumbsUp,
  ChevronDown,
  Menu,
  User,
  Bell,
  Inbox,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ConvexBox } from "./ConvexBox";
import { Footer } from "./Footer";
import {
  SignedIn,
  SignedOut,
  useUser,
  useClerk,
  SignInButton,
  SignUpButton,
} from "@clerk/clerk-react";
import { UserSyncer } from "./UserSyncer";
import { WeeklyLeaderboard } from "./WeeklyLeaderboard";
import { TopCategoriesOfWeek } from "./TopCategoriesOfWeek";
import { RecentVibers } from "./RecentVibers";
import { AuthRequiredDialog } from "./ui/AuthRequiredDialog";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { formatDistanceToNow } from "date-fns";

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
  const [viewMode, setViewMode] = React.useState<
    "grid" | "list" | "vibe" | undefined
  >(undefined);
  const [userChangedViewMode, setUserChangedViewMode] = React.useState(false);
  const [userChangedSortPeriod, setUserChangedSortPeriod] =
    React.useState(false);
  const [sortPeriod, setSortPeriod] = React.useState<SortPeriod | undefined>(
    undefined,
  );
  const [selectedTagId, setSelectedTagId] = React.useState<
    Id<"tags"> | undefined
  >(undefined);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [isTagsMenuOpen, setIsTagsMenuOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Auth required dialog state
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);

  // Profile dropdown state
  const [showProfileDropdown, setShowProfileDropdown] = React.useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  // Alerts dropdown state
  const [showAlertsDropdown, setShowAlertsDropdown] = React.useState(false);
  const alertsDropdownRef = React.useRef<HTMLDivElement>(null);

  const headerTags = useQuery(api.tags.listHeader);

  const convexUserDoc = useQuery(
    api.users.getMyUserDocument,
    isClerkLoaded && isSignedIn ? {} : "skip",
  );

  // Alerts queries
  const hasUnreadAlerts = useQuery(
    api.alerts.hasUnread,
    isClerkLoaded && isSignedIn ? {} : "skip",
  );
  const recentAlerts = useQuery(
    api.alerts.listRecentForDropdown,
    isClerkLoaded && isSignedIn ? {} : "skip",
  );

  // Inbox enabled status
  const userInboxEnabled = useQuery(
    api.dm.getInboxEnabled,
    isClerkLoaded && isSignedIn && convexUserDoc?._id
      ? { userId: convexUserDoc._id }
      : "skip",
  );

  React.useEffect(() => {
    if (settings) {
      if (!userChangedViewMode) {
        const { pathname } = location;
        const isAdminPage = pathname.startsWith("/admin");
        const isSetUsernamePage = pathname === "/set-username";
        const isUserSettingsPage = pathname
          .toLowerCase()
          .startsWith("/user-settings");
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
          } else if (
            settings.siteDefaultViewMode === "list" &&
            settings.showListView
          ) {
            newViewMode = "list";
          } else if (
            settings.siteDefaultViewMode === "grid" &&
            settings.showGridView
          ) {
            newViewMode = "grid";
          } else if (
            settings.siteDefaultViewMode === "vibe" &&
            settings.showVibeView
          ) {
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
    if (
      (isAdminPage || isSetUsernamePage || isProfilePage) &&
      userChangedViewMode
    ) {
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

  // Close profile dropdown on outside click
  React.useEffect(() => {
    if (!showProfileDropdown) return;
    function handleClick(e: MouseEvent) {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node)
      ) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showProfileDropdown]);

  // Close alerts dropdown on outside click
  React.useEffect(() => {
    if (!showAlertsDropdown) return;
    function handleClick(e: MouseEvent) {
      if (
        alertsDropdownRef.current &&
        !alertsDropdownRef.current.contains(e.target as Node)
      ) {
        setShowAlertsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAlertsDropdown]);

  // Determine if the sidebar should be shown based on view mode and settings
  // Ensure settings is loaded before trying to access its properties for showSidebar
  // Never show sidebar on story detail pages, judging pages, hackathon forms, or dynamic submit forms
  const isStoryDetailPage = location.pathname.startsWith("/s/");
  const isJudgingPage = location.pathname.startsWith("/judging/");
  const isYCHackFormPage = location.pathname === "/ychack";
  const isDynamicSubmitFormPage = location.pathname.startsWith("/submit/");
  const showSidebar =
    settings &&
    !isStoryDetailPage &&
    !isJudgingPage &&
    !isYCHackFormPage &&
    !isDynamicSubmitFormPage &&
    (viewMode === "vibe" || viewMode === "list") &&
    (settings.showListView || settings.showVibeView);

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
                  className="inline-block text-[#292929] hover:text-[#525252] md:order-1"
                >
                  <h1 className="title-font text-2xl">{siteTitle}</h1>
                </Link>
                {/* Right: User/Sign-in */}
                <div className="flex items-center gap-2 md:order-3">
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <button
                        className="px-4 py-2 bg-[#292929] border border-[#D8E1EC] text-[#ffffff] rounded-md text-xs font-normal hover:bg-[#F2F0ED] hover:text-[#292929] transition-colors"
                        type="button"
                      >
                        Sign up
                      </button>
                    </SignUpButton>
                    <SignInButton mode="modal">
                      <button
                        className="px-4 py-2 bg-[#292929] border border-[#D8E1EC] text-[#ffffff] rounded-md text-xs font-normal hover:bg-[#F2F0ED] hover:text-[#292929] transition-colors"
                        type="button"
                      >
                        Sign in
                      </button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <UserSyncer />
                    {/* Alerts Bell Icon */}
                    <div className="relative" ref={alertsDropdownRef}>
                      <button
                        onClick={() =>
                          setShowAlertsDropdown(!showAlertsDropdown)
                        }
                        className="flex items-center justify-center w-8 h-8 rounded-full border border-[#D8E1EC] bg-white hover:bg-[#F2F4F7] transition-colors mr-2"
                        aria-label="Notifications"
                      >
                        <Bell className="w-4 h-4 text-[#525252]" />
                        {hasUnreadAlerts && (
                          <div className="alerts-notification-dot absolute top-0 right-2 w-2 h-2 bg-black rounded-full"></div>
                        )}
                      </button>

                      {showAlertsDropdown && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-[#D8E1EC] py-2 z-50">
                          <div className="px-3 py-2 border-b border-[#F4F0ED]">
                            <h3 className="text-sm font-medium text-[#292929]">
                              Notifications
                            </h3>
                          </div>

                          <div className="max-h-80 overflow-y-auto">
                            {recentAlerts && recentAlerts.length > 0 ? (
                              recentAlerts.map((alert: any) => (
                                <DropdownNotificationItem
                                  key={alert._id}
                                  alert={alert}
                                />
                              ))
                            ) : (
                              <div className="px-3 py-4 text-center text-xs text-[#545454]">
                                No notifications yet
                              </div>
                            )}
                          </div>

                          <div className="border-t border-[#F4F0ED] pt-2">
                            <Link
                              to="/notifications"
                              onClick={() => {
                                setShowAlertsDropdown(false);
                                // Mark all as read will be handled by the notifications page
                              }}
                              className="block w-full px-3 py-2 text-center text-xs text-[#292929] hover:bg-[#F2F4F7] transition-colors"
                            >
                              View all
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Inbox Icon - Only show if inbox is enabled */}
                    {userInboxEnabled !== false && (
                      <Link
                        to="/inbox"
                        className="flex items-center justify-center w-8 h-8 rounded-full border border-[#D8E1EC] bg-white hover:bg-[#F2F4F7] transition-colors mr-2"
                        aria-label="Inbox"
                      >
                        <Inbox className="w-4 h-4 text-[#525252]" />
                      </Link>
                    )}

                    {/* Custom Profile Dropdown */}
                    <div className="relative" ref={profileDropdownRef}>
                      <button
                        onClick={() =>
                          setShowProfileDropdown(!showProfileDropdown)
                        }
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#292929] hover:bg-[#525252] transition-colors"
                        aria-label="Profile menu"
                      >
                        {clerkUser?.imageUrl ? (
                          <img
                            src={clerkUser.imageUrl}
                            alt="Profile"
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-white" />
                        )}
                      </button>

                      {showProfileDropdown && (
                        <div className="absolute right-0 mt-2 w-36 bg-white rounded-md shadow-lg border border-[#D8E1EC] py-0.5 z-50">
                          <Link
                            to={profileUrl}
                            className="block px-3 py-1.5 text-xs text-[#292929] hover:bg-[#F2F4F7] transition-colors"
                            onClick={() => setShowProfileDropdown(false)}
                          >
                            My Profile
                          </Link>
                          <button
                            onClick={() => {
                              clerk.openUserProfile();
                              setShowProfileDropdown(false);
                            }}
                            className="block w-full px-3 py-1.5 text-xs text-[#292929] hover:bg-[#F2F4F7] transition-colors text-left"
                          >
                            Manage Account
                          </button>
                          <button
                            onClick={() => {
                              clerk.signOut({ redirectUrl: "/" });
                              setShowProfileDropdown(false);
                            }}
                            className="block w-full px-3 py-1.5 text-xs text-[#292929] hover:bg-[#F2F4F7] transition-colors text-left"
                          >
                            Sign Out
                          </button>
                        </div>
                      )}
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
                    className="flex items-center gap-2 bg-[#292929] text-white px-3 py-1 rounded-md text-sm hover:bg-[#525252] transition-colors"
                  >
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
                      aria-label="List View"
                    >
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
                      aria-label="Grid View"
                    >
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
                      aria-label="Vibe View"
                    >
                      <ThumbsUp className="w-5 h-5 text-[#545454]" />
                    </button>
                  )}

                  {/* Mobile Search Icon - Show only on mobile, next to view options */}
                  <button
                    type="button"
                    onClick={handleSearchIconClick}
                    className="md:hidden p-2 text-[#525252] hover:text-[#292929]"
                    aria-label="Search"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Search Bar - Show below view options when expanded */}
                {isSearchExpanded && (
                  <div className="md:hidden w-full mt-2 mb-1">
                    <form onSubmit={handleSearch} className="flex items-center">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full h-9 px-3 text-sm focus:outline-none bg-white text-[#525252] rounded-md border border-[#D5D3D0]"
                      />
                    </form>
                  </div>
                )}

                {/* Row 3 content: Dropdowns & Desktop Search */}
                <div className="flex w-full md:w-auto items-center gap-1 md:gap-3">
                  {/* Categories Dropdown */}
                  <div className="relative inline-block text-left">
                    <select
                      value={selectedTagId || ""}
                      onChange={(e) =>
                        setSelectedTagId(
                          e.target.value
                            ? (e.target.value as Id<"tags">)
                            : undefined,
                        )
                      }
                      className="appearance-none cursor-pointer pl-2 md:pl-3 pr-6 md:pr-8 py-1.5 md:py-2 bg-white border border-[#D8E1EC] rounded-md text-xs md:text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] hover:border-[#A8A29E]"
                    >
                      <option value="">All Categories</option>
                      {headerTags
                        ?.filter(
                          (tag) =>
                            !tag.isHidden &&
                            tag.name !== "resendhackathon" &&
                            tag.name !== "ychackathon",
                        ) // Filter hidden tags and hackathon tracking tags
                        .map((tag) => (
                          <option key={tag._id} value={tag._id}>
                            {tag.name}
                          </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 md:px-2 text-[#545454]">
                      <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
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
                      className="appearance-none cursor-pointer pl-2 md:pl-3 pr-6 md:pr-8 py-1.5 md:py-2 bg-white border border-[#D8E1EC] rounded-md text-xs md:text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] hover:border-[#A8A29E]"
                    >
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 md:px-2 text-[#545454]">
                      <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
                    </div>
                  </div>

                  {/* Desktop Search - Hidden on mobile */}
                  <div className="hidden md:flex items-center gap-0">
                    <button
                      type="button"
                      onClick={handleSearchIconClick}
                      className="p-2 text-[#525252] hover:text-[#292929]"
                      aria-label="Search"
                    >
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
                        style={{
                          borderColor: isSearchExpanded
                            ? "#D5D3D0"
                            : "transparent",
                        }}
                        tabIndex={isSearchExpanded ? 0 : -1}
                      />
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags Navigation Row */}
            {/* Conditionally render if there are tags to show and settings allow (future) */}
            {headerTags &&
              headerTags.filter((tag) => !tag.isHidden && tag.showInHeader)
                .length > 0 && (
                <div className="py-3 mt-1 border-t border-[#D8E1EC]">
                  {" "}
                  {/* Mobile: Hamburger menu button - Hidden on screens 450px and smaller */}
                  <div className="hidden sm:block md:hidden mb-2">
                    <button
                      onClick={() => setIsTagsMenuOpen(!isTagsMenuOpen)}
                      className="flex items-center gap-2 px-3 py-1 bg-[#F3F4F6] text-gray-700 border border-[#D8E1EC] rounded-md text-xs font-medium hover:bg-white transition-colors"
                    >
                      <Menu className="w-4 h-4" />
                      Categories
                    </button>
                  </div>
                  {/* Desktop: Always visible tags, Mobile: Collapsible tags */}
                  <div
                    className={`${isTagsMenuOpen ? "block" : "hidden"} md:block`}
                  >
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
                        title="Show All Categories"
                      >
                        All
                      </button>

                      {/* Tag links */}
                      {headerTags
                        .filter(
                          (tag) =>
                            !tag.isHidden &&
                            tag.showInHeader &&
                            tag.name !== "resendhackathon" &&
                            tag.name !== "ychackathon",
                        ) // Ensure only relevant tags are mapped
                        .map((tag) => (
                          <Link
                            key={tag._id}
                            to={`/tag/${tag.slug}`}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 focus:outline-none"
                            style={{
                              backgroundColor: tag.backgroundColor || "#F9FAFB", // Default to gray-50
                              color: tag.textColor || "#374151", // Default to gray-700
                              border: `1px solid ${tag.borderColor || (tag.backgroundColor ? "transparent" : "#D1D5DB")}`, // Use borderColor or fallback
                            }}
                            title={`View all apps tagged with ${tag.name}`}
                          >
                            {/* Show emoji or icon if present */}
                            {tag.emoji ? (
                              <span className="mr-1 align-middle text-base">
                                {tag.emoji}
                              </span>
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
                </div>
              )}
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-1">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className={showSidebar ? "lg:w-3/4" : "w-full"}>
              {children || (
                <Outlet context={{ viewMode, selectedTagId, sortPeriod }} />
              )}
            </div>
            {showSidebar && (
              <aside className="lg:w-1/4 space-y-6">
                <WeeklyLeaderboard />
                <RecentVibers />
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

// Dropdown notification item component
function DropdownNotificationItem({ alert }: { alert: any }) {
  const actorUser = useQuery(
    api.users.getUserById,
    alert.actorUserId ? { userId: alert.actorUserId } : "skip",
  );

  const getNotificationText = () => {
    switch (alert.type) {
      case "vote":
        return "vibed your app";
      case "comment":
        return "commented on your app";
      case "rating":
        return `rated your app ${alert.ratingValue} stars`;
      case "follow":
        return "started following you";
      case "judged":
        return "Your app has been judged";
      case "bookmark":
        return "bookmarked your app";
      case "report":
        return "reported a submission";
      default:
        return "interacted with your content";
    }
  };

  return (
    <div
      className={`px-3 py-2 border-b border-[#F4F0ED] last:border-b-0 hover:bg-[#F2F4F7] transition-colors ${
        !alert.isRead ? "bg-blue-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Actor Avatar */}
        {actorUser && (
          <div className="flex-shrink-0">
            {actorUser.imageUrl ? (
              <img
                src={actorUser.imageUrl}
                alt={actorUser.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#292929] flex items-center justify-center">
                <span className="text-white text-xs">
                  {actorUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#525252]">
            {alert.type === "judged" ? (
              <span>{getNotificationText()}</span>
            ) : actorUser ? (
              <>
                {actorUser.username ? (
                  <Link
                    to={`/${actorUser.username}`}
                    className="font-medium hover:underline cursor-pointer text-[#525252] hover:text-[#292929]"
                    onClick={() => setShowAlertsDropdown(false)}
                  >
                    {actorUser.name}
                  </Link>
                ) : (
                  <span className="font-medium">{actorUser.name}</span>
                )}{" "}
                {getNotificationText()}
              </>
            ) : (
              <span>Someone {getNotificationText()}</span>
            )}
          </div>
          <div className="text-xs text-[#545454] mt-1">
            {formatDistanceToNow(alert._creationTime, { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}
