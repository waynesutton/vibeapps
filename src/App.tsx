import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  usePaginatedQuery,
  useQuery,
  useConvex,
  ConvexProvider,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { Layout } from "./components/Layout";
import { StoryList } from "./components/StoryList";
import { StoryForm } from "./components/StoryForm";
import { ResendForm } from "./components/ResendForm";
import { YCHackForm } from "./components/YCHackForm";
import { DynamicSubmitForm } from "./components/DynamicSubmitForm";
import { StoryDetail } from "./components/StoryDetail";
import { SearchResults } from "./components/SearchResults";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { FormBuilder } from "./components/admin/FormBuilder";
import { FormResults } from "./components/admin/FormResults";
import { PublicForm } from "./components/PublicForm";
import { PublicResultsViewer } from "./components/PublicResultsViewer";
import { useLayoutContext } from "./components/Layout";
import { Id } from "../convex/_generated/dataModel";
import { Story } from "./types";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import SignOutPage from "./pages/SignOutPage";
import { ProtectedLayout } from "./components/ProtectedLayout";
import UserProfilePage from "./pages/UserProfilePage";
import SetUsernamePage from "./pages/SetUsernamePage";
import NavTestPage from "./pages/NavTestPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TagPage } from "./pages/TagPage";
import JudgingGroupPage from "./pages/JudgingGroupPage";
import JudgingInterfacePage from "./pages/JudgingInterfacePage";
import PublicJudgingResultsPage from "./pages/PublicJudgingResultsPage";

function HomePage() {
  const { viewMode, selectedTagId, sortPeriod } = useLayoutContext();
  const settings = useQuery(api.settings.get);

  const {
    results: stories,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.stories.listApproved,
    { tagId: selectedTagId, sortPeriod: sortPeriod },
    { initialNumItems: settings?.itemsPerPage || 20 },
  );

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
  return (
    <BrowserRouter>
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
          <Route path="/judging/:slug" element={<JudgingGroupPage />} />
          <Route
            path="/judging/:slug/judge"
            element={<JudgingInterfacePage />}
          />
          <Route
            path="/judging/:slug/results"
            element={<PublicJudgingResultsPage />}
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
    </BrowserRouter>
  );
}

export default App;
