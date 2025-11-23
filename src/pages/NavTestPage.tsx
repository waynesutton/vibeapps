import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom"; // useNavigate might be needed if you test navigation actions
import {
  LayoutGrid,
  List,
  PlusCircle,
  Search,
  ThumbsUp,
  ChevronDown,
} from "lucide-react";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react"; // Assuming UserButton is not directly in header, but UserSyncer might be
// import { useQuery } from "convex/react"; // Mocking data, so not fetching live
// import { api } from "../../convex/_generated/api"; // Mocking data
import type { Id } from "../../convex/_generated/dataModel"; // For Tag type
import { UserSyncer } from "../components/UserSyncer"; // UserSyncer is in the header
import { useDialog } from "../hooks/useDialog";

// Define SortPeriod type locally or import if it's in a shared types file
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

// Simplified Tag type for NavTestPage
interface MockTag {
  _id: Id<"tags">;
  name: string;
  isHidden?: boolean;
}

const NavTestPage: React.FC = () => {
  const navigate = useNavigate(); // Included for potential link testing
  const { user: clerkUser, isSignedIn } = useUser();
  const { showMessage, DialogComponents } = useDialog();

  // Mimic state and props from Layout.tsx needed for the header
  const [siteTitle, setSiteTitle] = useState("Test Site Title");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "grid" | "vibe">("vibe");
  const [selectedTagId, setSelectedTagId] = useState<Id<"tags"> | undefined>(
    undefined,
  );
  const [sortPeriod, setSortPeriod] = useState<SortPeriod>("all");

  // Mock headerTags data
  const headerTags: MockTag[] = [
    { _id: "tag1" as Id<"tags">, name: "General" },
    { _id: "tag2" as Id<"tags">, name: "Tech" },
    { _id: "tag3" as Id<"tags">, name: "Art", isHidden: true },
    { _id: "tag4" as Id<"tags">, name: "Science" },
  ];

  // Mock user data for profile display
  const profileUrl = isSignedIn
    ? clerkUser?.username
      ? `/${clerkUser.username}`
      : "/set-username"
    : "/sign-in";
  const avatarUrl = clerkUser?.imageUrl || "https://via.placeholder.com/36"; // Default placeholder

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      showMessage("Search", `Searching for: ${searchQuery.trim()}`, "info");
      // navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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

  // Effect to close dropdown on outside click (copied from Layout)
  useEffect(() => {
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
      <DialogComponents />
      <div className="flex flex-col min-h-screen bg-gray-100">
        {/* Copied Header from Layout.tsx */}
        <header className="pt-5 pb-0 bg-[#F4F2EE] sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col gap-y-2 md:flex-row md:justify-between md:items-center">
              <div className="flex w-full justify-between items-center md:contents">
                <Link
                  to="/"
                  className="inline-block text-[#292929] hover:text-[#525252] md:order-1"
                >
                  <h1 className="title-font text-2xl">{siteTitle}</h1>
                </Link>
                <div className="flex items-center gap-2 md:order-3">
                  <SignedOut>
                    <button
                      onClick={() => navigate("/sign-in")}
                      className="px-4 py-2 bg-[#292929] border border-[#D8E1EC] text-[#ffffff] rounded-md text-xs font-normal hover:bg-[#F2F0ED] hover:text-[#292929] transition-colors"
                    >
                      Sign in
                    </button>
                  </SignedOut>
                  <SignedIn>
                    <UserSyncer />
                    <div className="relative" ref={menuRef}>
                      <a // Changed to simple anchor or Link for testing, original onClick for setShowProfileMenu(false) on parent might be complex
                        href={profileUrl}
                        onClick={(e) => {
                          e.preventDefault();
                          setShowProfileMenu(false);
                          navigate(profileUrl);
                        }}
                        className="block px-4 py-2 text-sm text-[#292929] hover:bg-[#F3F4F6]"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowProfileMenu((v) => !v);
                          }}
                          className="rounded-full border border-[#D8E1EC] w-9 h-9 overflow-hidden focus:outline-none"
                          aria-label="Open profile menu"
                          type="button"
                        >
                          <img
                            src={avatarUrl}
                            alt="User avatar"
                            className="w-9 h-9 object-cover"
                          />
                        </button>
                      </a>
                      {/* Basic dropdown for testing - can be expanded if needed */}
                      {showProfileMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                          <Link
                            to={profileUrl}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setShowProfileMenu(false)}
                          >
                            Profile
                          </Link>
                          <button
                            onClick={() => {
                              showMessage("Sign Out", "Signing out...", "info");
                              setShowProfileMenu(false);
                            }}
                            className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Sign Out
                          </button>
                        </div>
                      )}
                    </div>
                  </SignedIn>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:gap-3 md:order-2">
                <div className="flex w-full md:w-auto items-center gap-3">
                  <Link
                    to="/submit"
                    className="flex items-center gap-2 text-[#545454] hover:text-[#525252] px-3 py-1 rounded-md text-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Submit
                  </Link>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-md border border-[#D8E1EC] ${viewMode === "list" ? "bg-[#FBF5DB]" : "hover:bg-gray-100"}`}
                    aria-label="List View"
                  >
                    <List className="w-5 h-5 text-[#545454]" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-md border border-[#D8E1EC] ${viewMode === "grid" ? "bg-[#FBF5DB]" : "hover:bg-gray-100"}`}
                    aria-label="Grid View"
                  >
                    <LayoutGrid className="w-5 h-5 text-[#545454]" />
                  </button>
                  <button
                    onClick={() => setViewMode("vibe")}
                    className={`p-2 rounded-md border border-[#D8E1EC] ${viewMode === "vibe" ? "bg-[#FBF5DB]" : "hover:bg-gray-100"}`}
                    aria-label="Vibe View"
                  >
                    <ThumbsUp className="w-5 h-5 text-[#545454]" />
                  </button>
                </div>

                <div className="flex w-full md:w-auto items-center gap-3">
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
                      className="appearance-none cursor-pointer pl-3 pr-8 py-2 bg-white border border-[#D8E1EC] rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] hover:border-[#A8A29E]"
                    >
                      <option value="">All Categories</option>
                      {headerTags
                        ?.filter((tag) => !tag.isHidden)
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

                  <div className="relative inline-block text-left">
                    <select
                      value={sortPeriod}
                      onChange={(e) =>
                        setSortPeriod(e.target.value as SortPeriod)
                      }
                      className="appearance-none cursor-pointer pl-3 pr-8 py-2 bg-white border border-[#D8E1EC] rounded-md text-sm text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] hover:border-[#A8A29E]"
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#545454]">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>

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
        </header>

        {/* Original NavTestPage content */}
        <main className="flex-grow">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-center mt-8">
              Nav Icon Test Area
            </h1>
            <p className="text-center mt-4">
              The header above is a copy from Layout.tsx for testing. Modify its
              JSX here and then copy it back to Layout.tsx.
            </p>
            <p className="text-center mt-2 text-sm text-gray-600">
              (Note: Advanced dynamic functionalities like live data fetching
              are simplified or mocked here.)
            </p>
          </div>
        </main>

        {/* Optional: Add a simplified footer for completeness if needed */}
        <footer className="bg-gray-200 text-center p-4 mt-auto">
          <p className="text-sm text-gray-600">
            Simplified Footer for Test Page
          </p>
        </footer>
      </div>
    </>
  );
};

export default NavTestPage;
