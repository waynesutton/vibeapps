import React, { ReactNode } from "react";
import { SunIcon } from "@phosphor-icons/react";
import { useTheme } from "../lib/ThemeContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { SlidersHorizontal, X, Home } from "lucide-react";
import {
  Link,
  Outlet,
  useOutletContext,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  PlusCircle,
  Search,
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
import { ThemeToggle } from "./ThemeToggle";
import { WeeklyLeaderboard } from "./WeeklyLeaderboard";
import { TopCategoriesOfWeek } from "./TopCategoriesOfWeek";
import { RecentVibers } from "./RecentVibers";
import { LumaEventList } from "./LumaEventList";
import { AuthRequiredDialog } from "./ui/AuthRequiredDialog";
import { SimpleSelect } from "./ui/SimpleSelect";
import { formatDistanceToNow } from "date-fns";
import {
  isLumaWidgetVisible,
  isSidebarWidgetVisible,
  type LumaWidgetSurface,
  type SidebarWidgetSurface,
} from "../lib/sidebarWidgets";

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
  | "votes_year"
  | "votes_all";

export function Layout({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const { user: clerkUser, isSignedIn, isLoaded: isClerkLoaded } = useUser();
  const clerk = useClerk();
  const { theme, cycleTheme } = useTheme();
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
  // Drives the dot on the Filters trigger, so a collapsed filter is still
  // visible as being set.
  const hasActiveFilters =
    Boolean(selectedTagId) || Boolean(sortPeriod && sortPeriod !== "all");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [isTagsMenuOpen, setIsTagsMenuOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  // The collapsible mobile bar and the desktop field both render an input;
  // they need separate refs or whichever mounts last wins.
  const desktopSearchRef = React.useRef<HTMLInputElement>(null);

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

  // Inbox queries
  const userInboxEnabled = useQuery(
    api.dm.getInboxEnabled,
    isClerkLoaded && isSignedIn && convexUserDoc?._id
      ? { userId: convexUserDoc._id }
      : "skip",
  );
  const hasUnreadMessages = useQuery(
    api.dm.hasUnreadMessages,
    isClerkLoaded && isSignedIn ? {} : "skip",
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

  // ⌘K on Apple platforms, Ctrl+K elsewhere.
  const isAppleDevice = React.useMemo(
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(
        (navigator as Navigator & { userAgentData?: { platform?: string } })
          .userAgentData?.platform ||
          navigator.platform ||
          navigator.userAgent,
      ),
    [],
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        // offsetParent is null when the desktop field is hidden by its
        // breakpoint, which is how we tell which input is actually on screen.
        const desktop = desktopSearchRef.current;
        if (desktop && desktop.offsetParent !== null) {
          desktop.focus();
          desktop.select();
          return;
        }
        // Otherwise open the collapsible bar and focus it once mounted.
        setIsSearchExpanded(true);
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }
      if (event.key === "Escape") {
        const active = document.activeElement;
        if (active === desktopSearchRef.current || active === searchInputRef.current) {
          (active as HTMLInputElement).blur();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSearchIconClick = () => {
    setIsSearchExpanded(!isSearchExpanded);
    if (!isSearchExpanded) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  // Command+K keyboard shortcut to toggle search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); // Prevent default browser behavior

        // Toggle search expansion
        setIsSearchExpanded((prev) => {
          const newState = !prev;

          // If opening, focus the input
          if (newState) {
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 100);
          }

          return newState;
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
  // Never show sidebar on story detail pages, judging pages, hackathon forms, dynamic submit forms, custom form pages, or results pages
  const isStoryDetailPage = location.pathname.startsWith("/s/");
  const isJudgingPage = location.pathname.startsWith("/judging/");
  const isYCHackFormPage = location.pathname === "/ychack";
  const isDynamicSubmitFormPage = location.pathname.startsWith("/submit/");
  const isCustomFormPage = location.pathname.startsWith("/f/");
  const isPublicResultsPage = location.pathname.startsWith("/results/");
  const isAdminFormPage = location.pathname.startsWith("/admin/forms/");
  const isAdminPage = location.pathname.startsWith("/admin");
  // View and filters only mean something against the story list, so they are
  // scoped to it rather than following the user onto profiles, inbox, admin…
  const isStoryListPage = location.pathname === "/";
  const isInboxPage = location.pathname.startsWith("/inbox");
  const isNotificationsPage = location.pathname.startsWith("/notifications");
  const isLeaderboardPage = location.pathname === "/leaderboard";
  const isEventsPage = location.pathname === "/events";
  const isUsernameSetup = location.pathname === "/set-username";
  const isTagPage = location.pathname.startsWith("/tag/");
  const isDefaultSubmitPage = location.pathname === "/submit";
  const hideSubmitSidebar =
    isDefaultSubmitPage && (settings?.hideSubmitPageSidebar ?? false);

  const widgetSurface: SidebarWidgetSurface = isDefaultSubmitPage
    ? "submitPage"
    : isTagPage
      ? "tagPage"
      : viewMode === "grid"
        ? "gridView"
        : viewMode === "vibe"
          ? "vibeView"
          : "listView";

  const lumaPlacement =
    isDefaultSubmitPage
      ? "submit_page"
      : isTagPage
        ? "tag_page"
        : viewMode === "grid"
          ? "grid_view"
          : viewMode === "vibe"
            ? "vibe_view"
            : "list_view";

  const lumaWidgetSurface: LumaWidgetSurface = widgetSurface;
  const widgets = settings?.sidebarWidgets;
  const showMostVibes = isSidebarWidgetVisible(
    widgets,
    "mostVibes",
    widgetSurface,
  );
  const showRecentVibers = isSidebarWidgetVisible(
    widgets,
    "recentVibers",
    widgetSurface,
  );
  const showTopCategories = isSidebarWidgetVisible(
    widgets,
    "topCategories",
    widgetSurface,
  );
  const lumaSurfaceOn = isLumaWidgetVisible(widgets, lumaWidgetSurface);
  const lumaEvents = useQuery(
    api.luma.listForPlacement,
    hideSubmitSidebar ||
      !lumaSurfaceOn ||
      isStoryDetailPage ||
      isJudgingPage ||
      isYCHackFormPage ||
      isDynamicSubmitFormPage ||
      isCustomFormPage ||
      isPublicResultsPage ||
      isAdminFormPage ||
      isAdminPage ||
      isInboxPage ||
      isNotificationsPage ||
      isLeaderboardPage ||
      isEventsPage ||
      isUsernameSetup
      ? "skip"
      : { placement: lumaPlacement },
  );
  const showLumaEvents = (lumaEvents?.length ?? 0) > 0;
  const hasSidebarContent =
    showMostVibes || showRecentVibers || showTopCategories || showLumaEvents;

  const showSidebar =
    settings &&
    !hideSubmitSidebar &&
    !isStoryDetailPage &&
    !isJudgingPage &&
    !isYCHackFormPage &&
    !isDynamicSubmitFormPage &&
    !isCustomFormPage &&
    !isPublicResultsPage &&
    !isAdminFormPage &&
    !isAdminPage &&
    !isInboxPage &&
    !isNotificationsPage &&
    !isLeaderboardPage &&
    !isEventsPage &&
    !isUsernameSetup &&
    hasSidebarContent &&
    (viewMode === "vibe" ||
      viewMode === "list" ||
      viewMode === "grid") &&
    (settings.showListView || settings.showVibeView || settings.showGridView);

  return (
    <>
      {/* <div className="absolute top-0 z-[-2] h-screen w-screen bg-surface bg-[radial-gradient(100%_50%_at_50%_0%,rgba(0,163,255,0.13)_0,rgba(0,163,255,0)_50%,rgba(0,163,255,0)_100%)]"></div> */}

      <div className="flex flex-col min-h-screen bg-canvas">
        <header className="pt-3 pb-1 bg-canvas sticky top-0 z-50">
          <div className="container mx-auto px-4">
            {/* Responsive header layout */}
            <div className="flex flex-col gap-y-1.5 lg:flex-row lg:justify-between lg:items-center">
              {/* Row 1: Site Title & Profile Icon (Mobile) / Desktop: SiteTitle order-1, ProfileIcon order-3 */}
              <div className="flex w-full justify-between items-center lg:contents">
                {/* Left: Site Title */}
                <Link
                  to="/"
                  className="inline-block text-ink hover:text-copy lg:order-1"
                >
                  <h1 className="title-font text-xl">{siteTitle}</h1>
                </Link>
                {/* Right: User/Sign-in */}
                <div className="flex items-center gap-2 lg:order-3">
                  {/* Signed-in users get the theme control inside the account
                      menu; signed-out visitors have no menu, so keep it here. */}
                  <SignedOut>
                    <ThemeToggle />
                  </SignedOut>
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <button
                        className="px-4 py-2 bg-cta border border-hairline text-on-cta rounded-md text-xs font-normal hover:bg-surface-hover hover:text-ink transition-colors"
                        type="button"
                      >
                        Sign up
                      </button>
                    </SignUpButton>
                    <SignInButton mode="modal">
                      <button
                        className="px-4 py-2 bg-cta border border-hairline text-on-cta rounded-md text-xs font-normal hover:bg-surface-hover hover:text-ink transition-colors"
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
                      {/* From lg up these live in the header; below lg they are
                          rows in the account menu and the bottom bar. */}
                      <button
                        onClick={() =>
                          setShowAlertsDropdown(!showAlertsDropdown)
                        }
                        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-md text-soft hover:text-ink hover:bg-surface-hover transition-colors"
                        aria-label={
                          hasUnreadAlerts ? "Notifications, unread" : "Notifications"
                        }
                      >
                        <Bell className="w-[18px] h-[18px]" />
                        {hasUnreadAlerts && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand" />
                        )}
                      </button>

                      {showAlertsDropdown && (
                        <div
                          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                          onClick={() => setShowAlertsDropdown(false)}
                          aria-hidden="true"
                        />
                      )}
                      {showAlertsDropdown && (
                        <div
                          role="dialog"
                          aria-label="Notifications"
                          className="fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-sm flex-col border-l border-hairline bg-surface shadow-lg py-2 lg:absolute lg:inset-y-auto lg:top-full lg:right-0 lg:mt-2 lg:w-80 lg:max-w-none lg:flex-none lg:rounded-md lg:border"
                        >
                          <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
                            <h3 className="text-sm font-medium text-ink">
                              Notifications
                            </h3>
                            <button
                              type="button"
                              onClick={() => setShowAlertsDropdown(false)}
                              className="lg:hidden flex items-center justify-center w-8 h-8 -mr-1 rounded-md text-soft hover:text-ink hover:bg-surface-hover transition-colors"
                              aria-label="Close notifications"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto lg:flex-none lg:max-h-80">
                            {recentAlerts && recentAlerts.length > 0 ? (
                              recentAlerts.map((alert: any) => (
                                <DropdownNotificationItem
                                  key={alert._id}
                                  alert={alert}
                                  onClose={() => setShowAlertsDropdown(false)}
                                />
                              ))
                            ) : (
                              <div className="px-3 py-4 text-center text-xs text-soft">
                                No notifications yet
                              </div>
                            )}
                          </div>

                          <div className="border-t border-hairline pt-2">
                            <Link
                              to="/notifications"
                              onClick={() => {
                                setShowAlertsDropdown(false);
                                // Mark all as read will be handled by the notifications page
                              }}
                              className="block w-full px-3 py-2 text-center text-xs text-ink hover:bg-surface-hover transition-colors"
                            >
                              View all
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {userInboxEnabled !== false && (
                      <div className="relative hidden lg:block">
                        <Link
                          to="/inbox"
                          className="flex items-center justify-center w-8 h-8 rounded-md text-soft hover:text-ink hover:bg-surface-hover transition-colors"
                          aria-label={
                            hasUnreadMessages ? "Inbox, unread" : "Inbox"
                          }
                        >
                          <Inbox className="w-[18px] h-[18px]" />
                        </Link>
                        {hasUnreadMessages && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand pointer-events-none" />
                        )}
                      </div>
                    )}

                    {/* Custom Profile Dropdown */}
                    <div className="relative" ref={profileDropdownRef}>
                      <button
                        onClick={() =>
                          setShowProfileDropdown(!showProfileDropdown)
                        }
                        className="relative flex items-center justify-center w-8 h-8 rounded-full bg-cta hover:bg-cta-hover transition-colors"
                        aria-label={
                          hasUnreadAlerts || hasUnreadMessages
                            ? "Profile menu, you have unread items"
                            : "Profile menu"
                        }
                      >
                        {(hasUnreadAlerts || hasUnreadMessages) && (
                          <span className="lg:hidden absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand ring-2 ring-canvas" />
                        )}
                        {clerkUser?.imageUrl ? (
                          <img
                            src={clerkUser.imageUrl}
                            alt="Profile"
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-on-cta" />
                        )}
                      </button>

                      {showProfileDropdown && (
                        <div className="absolute right-0 mt-2 w-52 bg-surface [border-radius:0.375rem] shadow-lg border border-hairline py-0.5 z-50">
                          <button
                            onClick={() => {
                              setShowProfileDropdown(false);
                              setShowAlertsDropdown(true);
                            }}
                            className="lg:hidden flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface-hover transition-colors text-left"
                          >
                            <span className="flex items-center gap-2">
                              <Bell className="w-3.5 h-3.5 text-soft" />
                              Notifications
                            </span>
                            {hasUnreadAlerts && (
                              <span className="w-2 h-2 rounded-full bg-brand" />
                            )}
                          </button>
                          {userInboxEnabled !== false && (
                            <Link
                              to="/inbox"
                              onClick={() => setShowProfileDropdown(false)}
                              className="lg:hidden flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface-hover transition-colors"
                            >
                              <span className="flex items-center gap-2">
                                <Inbox className="w-3.5 h-3.5 text-soft" />
                                Inbox
                              </span>
                              {hasUnreadMessages && (
                                <span className="w-2 h-2 rounded-full bg-brand" />
                              )}
                            </Link>
                          )}
                          <button
                            onClick={() => cycleTheme()}
                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface-hover transition-colors text-left"
                          >
                            <span className="flex items-center gap-2">
                              <SunIcon className="w-3.5 h-3.5 text-soft" />
                              Theme
                            </span>
                            <span className="text-soft capitalize">{theme}</span>
                          </button>
                          <div className="my-0.5 border-t border-hairline" />
                          <Link
                            to={profileUrl}
                            className="block px-3 py-1.5 text-xs text-ink hover:bg-surface-hover transition-colors"
                            onClick={() => setShowProfileDropdown(false)}
                          >
                            My Profile
                          </Link>
                          <button
                            onClick={() => {
                              clerk.openUserProfile();
                              setShowProfileDropdown(false);
                            }}
                            className="block w-full px-3 py-1.5 text-xs text-ink hover:bg-surface-hover transition-colors text-left"
                          >
                            Manage Account
                          </button>
                          <button
                            onClick={() => {
                              clerk.signOut({ redirectUrl: "/" });
                              setShowProfileDropdown(false);
                            }}
                            className="block w-full px-3 py-1.5 text-xs text-ink hover:bg-surface-hover transition-colors text-left"
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
              <div className="flex flex-col lg:flex-row lg:flex-1 lg:justify-center lg:items-center lg:gap-3 lg:order-2 lg:px-6">
                {/* Row 2 content: Submit & View Options */}
                <div className="flex w-full lg:w-auto flex-wrap items-center gap-2 lg:gap-3">
                  {/* Submit Button: Navigate to /submit if signed in, show auth dialog if not */}
                  <button
                    onClick={() => {
                      if (isSignedIn) {
                        navigate("/submit");
                      } else {
                        setShowAuthDialog(true);
                      }
                    }}
                    className="hidden items-center gap-2 bg-cta text-on-cta px-3 py-1 rounded-md text-sm hover:bg-cta-hover transition-colors"
                    title="Submit your app to the community"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Submit
                  </button>
                  {isStoryListPage && (
                    <div className="contents lg:hidden">
                    {/* View and filters are dropdowns rather than a row of
                        toggles plus a row of selects: two controls instead of
                        five, and the toolbar fits one line on a phone. */}
                    <SimpleSelect
                      value={viewMode ?? ""}
                      onChange={(value) => {
                        setViewMode(value as NonNullable<typeof viewMode>);
                        setUserChangedViewMode(true);
                        navigate("/");
                      }}
                      aria-label="View layout"
                      className="w-auto h-9 py-0 pl-3 pr-2 text-sm gap-1"
                      options={[
                        ...(settings?.showListView
                          ? [{ value: "list", label: "List" }]
                          : []),
                        ...(settings?.showGridView
                          ? [{ value: "grid", label: "Grid" }]
                          : []),
                        ...(settings?.showVibeView
                          ? [{ value: "vibe", label: "Vibe" }]
                          : []),
                      ]}
                    />

                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-hairline bg-surface text-sm text-copy hover:bg-surface-hover transition-colors"
                          aria-label="Filters"
                        >
                          <SlidersHorizontal className="w-4 h-4 text-soft" />
                          Filters
                          {hasActiveFilters && (
                            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-3">
                        <div className="space-y-3">
                    {/* Categories Dropdown (themed, replaces native select) */}
                    <SimpleSelect
                      value={selectedTagId || ""}
                      onChange={(value) =>
                        setSelectedTagId(
                          value ? (value as Id<"tags">) : undefined,
                        )
                      }
                      aria-label="Filter by category"
                      className="w-full h-9 py-0 pl-3 pr-2 text-sm gap-1"
                      options={[
                        { value: "", label: "All Categories" },
                        ...(headerTags
                          ?.filter(
                            (tag) =>
                              !tag.isHidden &&
                              tag.name !== "resendhackathon" &&
                              tag.name !== "ychackathon",
                          ) // Filter hidden tags and hackathon tracking tags
                          .map((tag) => ({
                            value: tag._id as string,
                            label: tag.name,
                          })) ?? []),
                      ]}
                    />

                    {/* Sort Dropdown (themed, replaces native select) */}
                    <SimpleSelect
                      value={sortPeriod ?? ""}
                      onChange={(value) => {
                        setSortPeriod(value as SortPeriod);
                        setUserChangedSortPeriod(true); // User has made a selection
                      }}
                      aria-label="Sort submissions"
                      className="w-full h-9 py-0 pl-3 pr-2 text-sm gap-1"
                      options={[
                        { value: "today", label: "Today" },
                        { value: "week", label: "This Week" },
                        { value: "month", label: "This Month" },
                        { value: "year", label: "This Year" },
                        { value: "all", label: "Most Recent" },
                        { value: "votes_today", label: "Most Vibes (Today)" },
                        { value: "votes_week", label: "Most Vibes (Week)" },
                        { value: "votes_month", label: "Most Vibes (Month)" },
                        { value: "votes_year", label: "Most Vibes (Year)" },
                        { value: "votes_all", label: "Most Vibes (All Time)" },
                      ]}
                    />
                        </div>
                      </PopoverContent>
                    </Popover>
                    </div>
                  )}

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
                        className="w-full h-9 px-3 text-sm focus:outline-none bg-surface text-copy rounded-md border border-hairline-strong"
                      />
                    </form>
                  </div>
                )}

                {/* Row 3 content: Dropdowns & Desktop Search */}
                <div className="flex w-full md:w-auto lg:w-full lg:flex-1 items-center gap-1 md:gap-3">
                  {/* Desktop search: always open, centred in the header. */}
                  <form
                    onSubmit={handleSearch}
                    className="hidden lg:flex items-center w-full max-w-2xl lg:mx-auto"
                  >
                    <div className="relative w-full">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-soft" />
                      <input
                        ref={desktopSearchRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search apps, tags and creators"
                        aria-label="Search"
                        aria-keyshortcuts="Meta+K Control+K"
                        className="w-full h-10 pl-11 pr-20 text-sm rounded-md border border-hairline-strong bg-surface text-copy placeholder:text-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink transition-colors"
                      />
                      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded border border-hairline bg-surface-alt px-1.5 py-0.5 text-[11px] font-medium text-soft">
                        {isAppleDevice ? "⌘" : "Ctrl"}
                        <span>K</span>
                      </kbd>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Tags Navigation Row */}
            {/* Conditionally render if there are tags to show and settings allow (future) */}
            {headerTags &&
              headerTags.filter((tag) => !tag.isHidden && tag.showInHeader)
                .length > 0 && (
                <div className="py-3 mt-1 border-t border-hairline">
                  {" "}
                  {/* Mobile: Hamburger menu button - Hidden on screens 450px and smaller */}
                  <div className="hidden sm:block md:hidden mb-2">
                    <button
                      onClick={() => setIsTagsMenuOpen(!isTagsMenuOpen)}
                      className="flex items-center gap-2 px-3 py-1 bg-surface-alt text-copy border border-hairline rounded-md text-xs font-medium hover:bg-surface-hover transition-colors"
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
                                    ? "bg-cta text-on-cta"
                                    : "bg-surface-alt text-copy border-hairline hover:bg-surface-hover"
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
                              backgroundColor: tag.backgroundColor || "var(--th-surface-alt)", // Default to gray-50
                              color: tag.textColor || "var(--th-copy)", // Default to gray-700
                              border: `1px solid ${tag.borderColor || (tag.backgroundColor ? "transparent" : "var(--th-hairline-strong)")}`, // Use borderColor or fallback
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
        <main className="flex-grow container mx-auto px-4 py-1 pb-20 lg:pb-1">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Desktop rail: Submit on top, then the view and filter controls
                laid out rather than collapsed into dropdowns. Below lg these
                live in the header and the bottom bar instead. */}
            {isStoryListPage && (
              <aside className="hidden lg:block lg:w-56 lg:flex-shrink-0">
                <div className="sticky top-[60px] max-h-[calc(100vh-72px)] overflow-y-auto space-y-6 pb-4">
                  <button
                    onClick={() => {
                      if (isSignedIn) {
                        navigate("/submit");
                      } else {
                        setShowAuthDialog(true);
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-md bg-cta text-on-cta text-sm font-semibold hover:bg-cta-hover transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Submit your app
                  </button>

                  {(settings?.showListView ||
                    settings?.showGridView ||
                    settings?.showVibeView) && (
                    <div>
                      <h3 className="px-2 mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                        Layout
                      </h3>
                      <div className="flex flex-col">
                        {[
                          { key: "list", label: "List", show: settings?.showListView },
                          { key: "grid", label: "Grid", show: settings?.showGridView },
                          { key: "vibe", label: "Vibe", show: settings?.showVibeView },
                        ]
                          .filter((o) => o.show)
                          .map((o) => (
                            <button
                              key={o.key}
                              onClick={() => {
                                setViewMode(o.key as NonNullable<typeof viewMode>);
                                setUserChangedViewMode(true);
                                navigate("/");
                              }}
                              aria-pressed={viewMode === o.key}
                              className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                                viewMode === o.key
                                  ? "bg-surface-alt text-ink font-medium"
                                  : "text-copy hover:bg-surface-hover"
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="px-2 mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                      Sort
                    </h3>
                    <div className="flex flex-col">
                      {[
                        { value: "all", label: "Most Recent" },
                        { value: "today", label: "Today" },
                        { value: "week", label: "This Week" },
                        { value: "month", label: "This Month" },
                        { value: "votes_week", label: "Most Vibes (Week)" },
                        { value: "votes_all", label: "Most Vibes (All Time)" },
                      ].map((o) => (
                        <button
                          key={o.value}
                          onClick={() => {
                            setSortPeriod(o.value as SortPeriod);
                            setUserChangedSortPeriod(true);
                          }}
                          aria-pressed={sortPeriod === o.value}
                          className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                            sortPeriod === o.value
                              ? "bg-surface-alt text-ink font-medium"
                              : "text-copy hover:bg-surface-hover"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {headerTags && headerTags.length > 0 && (
                    <div>
                      <h3 className="px-2 mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                        Categories
                      </h3>
                      <div className="flex flex-col">
                        <button
                          onClick={() => setSelectedTagId(undefined)}
                          aria-pressed={!selectedTagId}
                          className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                            !selectedTagId
                              ? "bg-surface-alt text-ink font-medium"
                              : "text-copy hover:bg-surface-hover"
                          }`}
                        >
                          All Categories
                        </button>
                        {headerTags
                          .filter((tag) => !tag.isHidden && tag.showInHeader)
                          .map((tag) => (
                            <button
                              key={tag._id}
                              onClick={() => setSelectedTagId(tag._id)}
                              aria-pressed={selectedTagId === tag._id}
                              className={`text-left px-2 py-1.5 rounded-md text-sm truncate transition-colors ${
                                selectedTagId === tag._id
                                  ? "bg-surface-alt text-ink font-medium"
                                  : "text-copy hover:bg-surface-hover"
                              }`}
                            >
                              {tag.emoji ? `${tag.emoji} ` : ""}
                              {tag.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}

            <div className={showSidebar ? "lg:flex-1 lg:min-w-0" : "w-full"}>
              {children || (
                <Outlet context={{ viewMode, selectedTagId, sortPeriod }} />
              )}
            </div>
            {showSidebar && (
              <aside className="lg:w-1/4 space-y-6">
                {showLumaEvents && (
                  <LumaEventList placement={lumaPlacement} compact />
                )}
                {showMostVibes && <WeeklyLeaderboard />}
                {showRecentVibers && <RecentVibers />}
                {showTopCategories && (
                  <TopCategoriesOfWeek
                    selectedTagId={selectedTagId}
                    setSelectedTagId={setSelectedTagId}
                  />
                )}
              </aside>
            )}
          </div>
        </main>
        <Footer />

        {/* Mobile bottom bar. The primary actions sit within thumb reach and
            the header is left holding only the content controls. Hidden from
            lg up, where the header has room for all of it. */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch justify-around border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]"
          aria-label="Primary"
        >
          <Link
            to="/"
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors ${
              location.pathname === "/"
                ? "text-ink"
                : "text-soft hover:text-ink"
            }`}
          >
            <Home className="w-5 h-5" />
            Home
          </Link>

          <button
            type="button"
            onClick={handleSearchIconClick}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-soft hover:text-ink transition-colors"
          >
            <Search className="w-5 h-5" />
            Search
          </button>

          <button
            type="button"
            onClick={() => {
              if (isSignedIn) {
                navigate("/submit");
              } else {
                setShowAuthDialog(true);
              }
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-ink"
            aria-label="Submit your app"
          >
            <span className="flex items-center justify-center w-9 h-7 rounded-md bg-cta text-on-cta">
              <PlusCircle className="w-5 h-5" />
            </span>
            Submit
          </button>

          <SignedIn>
            <button
              type="button"
              onClick={() => setShowAlertsDropdown(true)}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-soft hover:text-ink transition-colors"
              aria-label={
                hasUnreadAlerts
                  ? "Notifications, unread"
                  : "Notifications"
              }
            >
              <Bell className="w-5 h-5" />
              {hasUnreadAlerts && (
                <span className="absolute top-1.5 right-[28%] w-2 h-2 rounded-full bg-brand" />
              )}
              Alerts
            </button>

            <Link
              to={profileUrl}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-soft hover:text-ink transition-colors"
            >
              {clerkUser?.imageUrl ? (
                <img
                  src={clerkUser.imageUrl}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
              {hasUnreadMessages && (
                <span className="absolute top-1.5 right-[28%] w-2 h-2 rounded-full bg-brand" />
              )}
              You
            </Link>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-soft hover:text-ink transition-colors"
              >
                <User className="w-5 h-5" />
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </nav>

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
function DropdownNotificationItem({
  alert,
  onClose,
}: {
  alert: any;
  onClose: () => void;
}) {
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
      case "spam":
        return "Your post has been marked as spam and has been removed. Check your email for details.";
      case "spam_review":
        return "requested a review of a spam mark";
      default:
        return "interacted with your content";
    }
  };

  return (
    <div
      className={`px-3 py-2 border-b border-hairline last:border-b-0 hover:bg-surface-hover transition-colors ${
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
              <div className="w-6 h-6 rounded-full bg-cta flex items-center justify-center">
                <span className="text-on-cta text-xs">
                  {actorUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-xs text-copy">
            {alert.type === "judged" || alert.type === "spam" ? (
              <span>{getNotificationText()}</span>
            ) : actorUser ? (
              <>
                {actorUser.username ? (
                  <Link
                    to={`/${actorUser.username}`}
                    className="font-medium hover:underline cursor-pointer text-copy hover:text-ink"
                    onClick={onClose}
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
          <div className="text-xs text-soft mt-1">
            {formatDistanceToNow(alert._creationTime, { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}
