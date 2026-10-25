import { lazy, Suspense, useEffect, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Layout } from "./components/Layout";
import { StoryList } from "./components/StoryList";
import { useLayoutContext } from "./components/Layout";
import { Story } from "./types";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { Toaster } from "sonner";
import { useTheme } from "./lib/ThemeContext";

// Route level code splitting: the home page, layout, and 404 ship in the entry
// bundle; every other route loads its own chunk on first visit.
const loadStoryDetail = () => import("./components/StoryDetail");
const StoryDetail = lazy(() =>
  loadStoryDetail().then((m) => ({ default: m.StoryDetail })),
);
const StoryForm = lazy(() =>
  import("./components/StoryForm").then((m) => ({ default: m.StoryForm })),
);
const ResendForm = lazy(() =>
  import("./components/ResendForm").then((m) => ({ default: m.ResendForm })),
);
const YCHackForm = lazy(() =>
  import("./components/YCHackForm").then((m) => ({ default: m.YCHackForm })),
);
const DynamicSubmitForm = lazy(() =>
  import("./components/DynamicSubmitForm").then((m) => ({
    default: m.DynamicSubmitForm,
  })),
);
const SearchResults = lazy(() =>
  import("./components/SearchResults").then((m) => ({
    default: m.SearchResults,
  })),
);
const AdminDashboard = lazy(() =>
  import("./components/admin/AdminDashboard").then((m) => ({
    default: m.AdminDashboard,
  })),
);
const FormBuilder = lazy(() =>
  import("./components/admin/FormBuilder").then((m) => ({
    default: m.FormBuilder,
  })),
);
const FormResults = lazy(() =>
  import("./components/admin/FormResults").then((m) => ({
    default: m.FormResults,
  })),
);
const PublicForm = lazy(() =>
  import("./components/PublicForm").then((m) => ({ default: m.PublicForm })),
);
const PublicResultsViewer = lazy(() =>
  import("./components/PublicResultsViewer").then((m) => ({
    default: m.PublicResultsViewer,
  })),
);
const TagPage = lazy(() =>
  import("./pages/TagPage").then((m) => ({ default: m.TagPage })),
);
const JudgingGroupSubmitPage = lazy(() =>
  import("./pages/JudgingGroupSubmitPage").then((m) => ({
    default: m.JudgingGroupSubmitPage,
  })),
);
const JudgingGroupJoinPage = lazy(() =>
  import("./pages/JudgingGroupJoinPage").then((m) => ({
    default: m.JudgingGroupJoinPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((m) => ({
    default: m.LeaderboardPage,
  })),
);
const EventsPage = lazy(() =>
  import("./pages/EventsPage").then((m) => ({ default: m.EventsPage })),
);
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const SignOutPage = lazy(() => import("./pages/SignOutPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const SetUsernamePage = lazy(() => import("./pages/SetUsernamePage"));
const NavTestPage = lazy(() => import("./pages/NavTestPage"));
const JudgingGroupPage = lazy(() => import("./pages/JudgingGroupPage"));
const JudgingInterfacePage = lazy(() => import("./pages/JudgingInterfacePage"));
const PublicJudgingResultsPage = lazy(
  () => import("./pages/PublicJudgingResultsPage"),
);
const AIJudgeResultsPage = lazy(() => import("./pages/AIJudgeResultsPage"));
const HowToJudgePage = lazy(() => import("./pages/HowToJudgePage"));
const JudgeTrackingPage = lazy(() => import("./pages/JudgeTrackingPage"));
const AdminJudgingGroupPage = lazy(
  () => import("./pages/AdminJudgingGroupPage"),
);
const InboxPage = lazy(() => import("./pages/InboxPage"));

// Wraps routes that render outside Layout (sign in, YC hack form)
function TopLevelRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

function HomePage() {
  const { viewMode, selectedTagId, sortPeriod } = useLayoutContext();
  const settings = useQuery(api.settings.get);

  // Skip until settings load so the feed is fetched once at the right page size
  const {
    results: stories,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.stories.listApproved,
    settings === undefined
      ? "skip"
      : { tagId: selectedTagId, sortPeriod: sortPeriod },
    { initialNumItems: settings?.itemsPerPage || 20 },
  );

  // Warm the story page chunk once the feed is idle, since it is the next click
  const feedReady = status !== "LoadingFirstPage" && settings !== undefined;
  useEffect(() => {
    if (!feedReady) return;
    const preload = () => {
      void loadStoryDetail();
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(preload, 2000);
    return () => window.clearTimeout(timer);
  }, [feedReady]);

  if (status === "LoadingFirstPage" || settings === undefined) {
    return <div>Loading...</div>;
  }

  if (!stories || stories.length === 0) {
    return (
      <div>
        No apps found in this category.{" "}
        <a href="/submit">Why not submit one?</a>
      </div>
    );
  }

  return (
    <StoryList
      stories={stories as Story[]}
      viewMode={viewMode}
      status={status}
      loadMore={loadMore}
      itemsPerPage={settings.itemsPerPage}
    />
  );
}

function StoryPage() {
  const { storySlug } = useParams<{ storySlug: string }>();

  const story = useQuery(
    api.stories.getBySlug,
    storySlug ? { slug: storySlug } : "skip",
  );

  if (story === undefined) {
    return <div>Loading story...</div>;
  }
  if (story === null) {
    return <div>App not found or not approved.</div>;
  }

  return <StoryDetail story={story as Story} />;
}

function SearchPage() {
  const { viewMode } = useLayoutContext();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const { results: stories, status } = usePaginatedQuery(
    api.stories.listApproved,
    { searchTerm: query },
    { initialNumItems: 100 },
  );

  if (status === "LoadingFirstPage") {
    return <div>Searching...</div>;
  }

  return (
    <SearchResults
      query={query}
      stories={stories as Story[]}
      viewMode={viewMode}
    />
  );
}

function PublicFormPage() {
  const { formSlug } = useParams<{ formSlug: string }>();
  const formWithFields = useQuery(
    api.forms.getFormBySlug,
    formSlug ? { slug: formSlug } : "skip",
  );

  if (formWithFields === undefined) {
    return <div>Loading form...</div>;
  }
  if (formWithFields === null) {
    return <div>Form not found or not public.</div>;
  }

  return <PublicForm form={formWithFields} fields={formWithFields.fields} />;
}

function App() {
  const { theme } = useTheme();
  return (
    <BrowserRouter>
      {/* Global toast outlet; follows the active site theme */}
      <Toaster
        theme={theme === "dark" ? "dark" : "light"}
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--th-surface)",
            color: "var(--th-ink)",
            border: "1px solid var(--th-hairline)",
          },
        }}
      />
      <TopLevelRoutes>
        <Routes>
          <Route path="/ychack" element={<YCHackForm />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/submit" element={<StoryForm />} />
            <Route path="/submit/:slug" element={<DynamicSubmitForm />} />
            <Route path="/resend" element={<ResendForm />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/set-username" element={<SetUsernamePage />} />
            </Route>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/forms/new" element={<FormBuilder />} />
            <Route path="/admin/forms/:formId" element={<FormBuilder />} />
            <Route
              path="/admin/forms/:formId/results"
              element={<FormResults />}
            />
            <Route path="/s/:storySlug" element={<StoryPage />} />
            <Route path="/tag/:tagSlug" element={<TagPage />} />
            <Route path="/f/:formSlug" element={<PublicFormPage />} />
            <Route path="/results/:slug" element={<PublicResultsViewer />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/judging/:slug" element={<JudgingGroupPage />} />
            <Route
              path="/judging/:slug/submit"
              element={<JudgingGroupSubmitPage />}
            />
            {/* QR code target: hands scanners off to the group's submit form */}
            <Route
              path="/judging/:slug/join"
              element={<JudgingGroupJoinPage />}
            />
            <Route
              path="/judging/:slug/judge"
              element={<JudgingInterfacePage />}
            />
            <Route
              path="/judging/:slug/results"
              element={<PublicJudgingResultsPage />}
            />
            <Route
              path="/judging/:slug/ai-results"
              element={<AIJudgeResultsPage />}
            />
            {/* Public judge one sheet; no login, never shows a passcode */}
            <Route
              path="/judging/:slug/howtojudge"
              element={<HowToJudgePage />}
            />
            <Route
              path="/admin/judging/:slug/tracking"
              element={<JudgeTrackingPage />}
            />
            <Route
              path="/admin/judging/:slug"
              element={<AdminJudgingGroupPage />}
            />
            <Route path="/:username" element={<UserProfilePage />} />
            <Route path="/navtest" element={<NavTestPage />} />
            <Route path="/user-settings/*" element={<UserProfilePage />} />
          </Route>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/signout" element={<SignOutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </TopLevelRoutes>
    </BrowserRouter>
  );
}

export default App;
