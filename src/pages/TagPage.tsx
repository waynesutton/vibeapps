import React from "react";
import { useParams, Link } from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { StoryList } from "../components/StoryList";
import { useLayoutContext } from "../components/Layout";
import type { Story } from "../types";

export function TagPage() {
  const { tagSlug } = useParams<{ tagSlug: string }>();
  const { viewMode } = useLayoutContext();

  // Get the tag by slug
  const tag = useQuery(api.tags.getBySlug, tagSlug ? { slug: tagSlug } : "skip");

  // Get stories for this tag
  const {
    results: stories,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.stories.listApproved,
    tag && tag._id
      ? {
          tagId: tag._id,
          sortPeriod: "all",
        }
      : "skip",
    { initialNumItems: 20 }
  );

  if (tag === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">Loading tag...</div>
      </div>
    );
  }

  if (tag === null) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/" className="text-[#545454] hover:text-[#525252] inline-block mb-6">
          ← Back to Apps
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#292929] mb-4">Tag Not Found</h1>
          <p className="text-[#545454]">The tag "{tagSlug}" doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const getTagDisplay = () => {
    const baseStyle = {
      backgroundColor: tag.backgroundColor || "#F4F0ED",
      color: tag.textColor || "#525252",
      border: `1px solid ${tag.backgroundColor ? "transparent" : "#D5D3D0"}`,
    };

    return (
      <span
        className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium"
        style={baseStyle}>
        {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
        {tag.iconUrl && !tag.emoji && (
          <img src={tag.iconUrl} alt="" className="w-4 h-4 mr-1 rounded-sm object-cover" />
        )}
        {tag.name}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="text-[#545454] hover:text-[#525252] inline-block mb-6">
        ← Back to Apps
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-[#292929]">Apps tagged with</h1>
          {getTagDisplay()}
        </div>
        <p className="text-[#545454]">
          {stories?.length || 0} {stories?.length === 1 ? "app" : "apps"} found
        </p>
      </div>

      {stories && stories.length > 0 ? (
        <StoryList
          stories={stories as Story[]}
          viewMode={viewMode || "list"}
          status={status}
          loadMore={loadMore}
          itemsPerPage={20}
        />
      ) : (
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-[#292929] mb-2">No apps found</h2>
          <p className="text-[#545454] mb-6">There are no apps with the tag "{tag.name}" yet.</p>
          <Link
            to="/submit"
            className="inline-flex items-center px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors">
            Submit an App
          </Link>
        </div>
      )}
    </div>
  );
}
