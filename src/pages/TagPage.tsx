import { useParams, Link } from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { StoryList } from "../components/StoryList";
import { useLayoutContext } from "../components/Layout";
import type { Story } from "../types";

function BackToAppsLink() {
  return (
    <Link
      to="/"
      aria-label="Back to all apps"
      className="inline-flex items-center justify-center size-11 -ml-2 shrink-0 rounded-md text-soft hover:text-ink hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
    </Link>
  );
}

export function TagPage() {
  const { tagSlug } = useParams<{ tagSlug: string }>();
  const { viewMode } = useLayoutContext();

  const tag = useQuery(
    api.tags.getBySlug,
    tagSlug ? { slug: tagSlug } : "skip",
  );

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
    { initialNumItems: 20 },
  );

  const totalCount = useQuery(
    api.stories.getApprovedCountByTag,
    tag && tag._id
      ? {
          tagId: tag._id,
          sortPeriod: "all",
        }
      : "skip",
  );

  if (tag === undefined) {
    return (
      <div className="pt-1 pb-4">
        <p className="text-sm text-soft">Loading tag...</p>
      </div>
    );
  }

  if (tag === null) {
    return (
      <div className="pt-1 pb-4">
        <div className="flex items-center gap-1">
          <BackToAppsLink />
          <h1 className="text-[15px] font-medium text-ink">Tag not found</h1>
        </div>
        <p className="mt-2 text-sm text-soft">
          The tag "{tagSlug}" does not exist or has been removed.
        </p>
      </div>
    );
  }

  const countLabel =
    totalCount === undefined
      ? null
      : `${totalCount} ${totalCount === 1 ? "app" : "apps"}`;

  return (
    <div className="pt-1 pb-2">
      {/* One-row identity: back, tag, count. Shared across list/grid/vibe. */}
      <header className="flex items-center gap-1.5 sm:gap-2 mb-4 min-h-11">
        <BackToAppsLink />
        <h1 className="flex items-center gap-2 min-w-0 flex-1 text-[15px] font-medium text-copy">
          <span className="sr-only sm:not-sr-only shrink-0">Apps tagged with </span>
          <span
            className="inline-flex items-center min-w-0 max-w-full px-3 py-1 rounded-full text-xs font-medium truncate"
            style={{
              backgroundColor: tag.backgroundColor || "var(--th-surface-alt)",
              color: tag.textColor || "var(--th-copy)",
              border: `1px solid ${
                tag.borderColor ||
                (tag.backgroundColor
                  ? "transparent"
                  : "var(--th-hairline-strong)")
              }`,
            }}
          >
            {tag.emoji && <span className="mr-1">{tag.emoji}</span>}
            {tag.iconUrl && !tag.emoji && (
              <img
                src={tag.iconUrl}
                alt=""
                width={16}
                height={16}
                className="w-4 h-4 mr-1 rounded-sm object-cover"
              />
            )}
            {tag.name}
          </span>
        </h1>
        {countLabel && (
          <p className="shrink-0 text-sm text-soft tabular-nums">{countLabel}</p>
        )}
      </header>

      {stories === undefined ? (
        <div className="py-12 text-center text-soft">Loading apps...</div>
      ) : stories.length > 0 ? (
        <StoryList
          stories={stories as Story[]}
          viewMode={viewMode || "list"}
          status={status}
          loadMore={loadMore}
          itemsPerPage={20}
        />
      ) : totalCount === undefined ? (
        <div className="py-12 text-center text-soft">Loading apps...</div>
      ) : (
        <div className="py-12 text-center">
          <h2 className="text-xl font-medium text-ink mb-2">No apps found</h2>
          <p className="text-soft mb-6">
            There are no apps with the tag "{tag.name}" yet.
          </p>
          <Link
            to="/submit"
            className="inline-flex items-center px-4 py-2 bg-cta text-on-cta rounded-md hover:bg-cta-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            Submit an App
          </Link>
        </div>
      )}
    </div>
  );
}
