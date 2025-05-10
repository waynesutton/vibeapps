import React from "react";
import { BrowserRouter, Routes, Route, useParams, useSearchParams } from "react-router-dom";
import { usePaginatedQuery, useQuery, useConvex, ConvexProvider } from "convex/react";
import { api } from "../convex/_generated/api";
import { Layout } from "./components/Layout";
import { StoryList } from "./components/StoryList";
import { StoryForm } from "./components/StoryForm";
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
import { ProtectedLayout } from "./components/ProtectedLayout";
import { AdminRouteGuard } from "./components/AdminRouteGuard";
import UserProfilePage from "./pages/UserProfilePage";

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
    { initialNumItems: settings?.itemsPerPage || 20 }
  );

  if (status === "LoadingFirstPage" || settings === undefined) {
    return <div>Loading...</div>;
  }

  if (!stories || stories.length === 0) {
    return <div>No stories found. Why not submit one?</div>;
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

  const story = useQuery(api.stories.getBySlug, storySlug ? { slug: storySlug } : "skip");

  if (story === undefined) {
    return <div>Loading story...</div>;
  }
  if (story === null) {
    return <div>Story not found or not approved.</div>;
  }

  return <StoryDetail story={story as Story} />;
}

function SearchPage() {
  const { viewMode } = useLayoutContext();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const { results: stories, status } = usePaginatedQuery(
    api.stories.listApproved,
    {},
    { initialNumItems: 100 }
  );

  if (status === "LoadingFirstPage") {
    return <div>Searching...</div>;
  }

  const filteredStories = (stories || []).filter(
    (story) =>
      story.title.toLowerCase().includes(query.toLowerCase()) ||
      story.description.toLowerCase().includes(query.toLowerCase()) ||
      (story.tags || []).some((tag) => tag.name.toLowerCase().includes(query.toLowerCase()))
  );

  return <SearchResults query={query} stories={filteredStories as Story[]} viewMode={viewMode} />;
}

function PublicFormPage() {
  const { formSlug } = useParams<{ formSlug: string }>();
  const formWithFields = useQuery(api.forms.getFormBySlug, formSlug ? { slug: formSlug } : "skip");

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
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/submit" element={<StoryForm />} />
            <Route path="/profile" element={<UserProfilePage />} />
          </Route>
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/forms/new" element={<FormBuilder />} />
            <Route path="/admin/forms/:formId" element={<FormBuilder />} />
            <Route path="/admin/forms/:formId/results" element={<FormResults />} />
          </Route>
          <Route path="/s/:storySlug" element={<StoryPage />} />
          <Route path="/f/:formSlug" element={<PublicFormPage />} />
          <Route path="/results/:slug" element={<PublicResultsViewer />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
