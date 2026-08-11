import React from "react";
import { useQuery } from "convex/react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { WeeklyTopCategory } from "../../convex/tags"; // Import the type
import { Hash } from "lucide-react"; // Example icon
import type { Id } from "../../convex/_generated/dataModel";

interface TopCategoriesOfWeekProps {
  selectedTagId: Id<"tags"> | undefined;
  setSelectedTagId: (tagId: Id<"tags"> | undefined) => void;
}

export function TopCategoriesOfWeek({
  selectedTagId,
  setSelectedTagId,
}: TopCategoriesOfWeekProps) {
  const topCategories = useQuery(api.tags.getWeeklyTopCategories, {
    limit: 10,
  });
  const navigate = useNavigate();
  const location = useLocation();

  if (topCategories === undefined) {
    return (
      <div className="p-4 bg-surface rounded-lg border border-hairline">
        Loading categories...
      </div>
    );
  }

  if (!topCategories || topCategories.length === 0) {
    return (
      <div className="p-4 bg-surface rounded-lg border border-hairline">
        <h3 className="text-md font-normal text-ink mb-3">
          Top Categories This Week
        </h3>
        <p className="text-sm text-soft">
          No active categories this week.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface rounded-lg border border-hairline">
      <h3 className="text-md font-normal text-ink mb-3">
        Top Categories This Week
      </h3>
      <ul className="space-y-2">
        {/* "All" button */}
        <li>
          <button
            onClick={() => {
              setSelectedTagId(undefined);
              if (location.pathname !== "/") {
                navigate("/");
              }
            }}
            className={`flex items-center w-full text-left gap-2 text-sm py-1 rounded-md focus:outline-none
                        ${
                          selectedTagId === undefined
                            ? "text-ink font-semibold ring-1 ring-offset-1 ring-offset-canvas bg-surface-alt ring-hairline-strong"
                            : "text-soft hover:text-ink hover:underline"
                        }`}
            title="Show All Categories"
          >
            <Hash className="w-4 h-4 text-faint" />
            <span className="flex-grow truncate" title="All Categories">
              All
            </span>
            {/* Optionally, you might want to hide or not show a count for "All" */}
          </button>
        </li>

        {topCategories
          .filter(
            (category) =>
              category.name !== "resendhackathon" &&
              category.name !== "ychackathon",
          )
          .map((category) => {
            if (!category.slug) {
              // Optionally, render something different for tags without slugs, or just skip
              // For now, we skip rendering if no slug, as it can't be linked.
              // console.warn(`Category "${category.name}" has no slug, skipping link.`);
              return (
                <li
                  key={category._id}
                  className="flex boohide items-center gap-2 text-sm text-ink py-1 opacity-90"
                >
                  <Hash className="w-4 h-4 text-faint" />
                  <span
                    className="flex-grow truncate"
                    title={`${category.name} (no slug)`}
                  >
                    {category.name}
                  </span>
                  <span className="text-xs text-faint">
                    ({category.count})
                  </span>
                </li>
              );
            }
            // Category has a slug, make it a button
            const isSelected = selectedTagId === category._id;
            return (
              <li key={category._id}>
                <button
                  onClick={() => {
                    const newSelectedId = isSelected ? undefined : category._id;
                    setSelectedTagId(newSelectedId);
                    if (location.pathname !== "/") {
                      navigate("/");
                    }
                  }}
                  className={`flex items-center w-full text-left gap-2 text-sm py-1 rounded-md focus:outline-none
                            ${
                              isSelected
                                ? "text-ink font-semibold ring-1 ring-offset-1 ring-offset-canvas bg-surface-alt ring-hairline-strong"
                                : "text-soft hover:text-ink hover:underline"
                            }`}
                  title={category.name}
                >
                  <Hash className="w-4 h-4 text-faint" />
                  <span className="flex-grow truncate" title={category.name}>
                    {category.name}
                  </span>
                  <span className="text-xs text-faint">
                    ({category.count})
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
      {/* Optionally, add a link to explore all communities/categories like in the image */}
      {/* <div className="mt-4">
        <Link to="/communities" className="text-sm text-blue-600 hover:underline">Explore Communities</Link>
      </div> */}
    </div>
  );
}
