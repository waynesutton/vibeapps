import React from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { WeeklyTopCategory } from "../../convex/tags"; // Import the type
import { Hash } from "lucide-react"; // Example icon

export function TopCategoriesOfWeek() {
  const topCategories = useQuery(api.tags.getWeeklyTopCategories, { limit: 10 });

  if (topCategories === undefined) {
    return (
      <div className="p-4 bg-white rounded-lg border border-[#D8E1EC]">Loading categories...</div>
    );
  }

  if (!topCategories || topCategories.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg border border-[#D8E1EC]">
        <h3 className="text-lg font-semibold text-[#2A2825] mb-3">Top Categories This Week</h3>
        <p className="text-sm text-[#545454]">No active categories this week.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-[#D8E1EC]">
      <h3 className="text-lg font-semibold text-[#2A2825] mb-3">Top Categories This Week</h3>
      <ul className="space-y-2">
        {topCategories.map((category) => {
          if (!category.slug) {
            // Optionally, render something different for tags without slugs, or just skip
            // For now, we skip rendering if no slug, as it can't be linked.
            // console.warn(`Category "${category.name}" has no slug, skipping link.`);
            return (
              <li
                key={category._id}
                className="flex items-center gap-2 text-sm text-[#101828] py-1 opacity-90">
                <Hash className="w-4 h-4 text-[#787672]" />
                <span className="flex-grow truncate" title={`${category.name} (no slug)`}>
                  {category.name}
                </span>
                <span className="text-xs text-[#787672]">({category.count})</span>
              </li>
            );
          }
          return (
            <li key={category._id}>
              <Link
                to={`/t/${category.slug}`}
                className="flex items-center gap-2 text-sm text-[#545454] hover:text-[#2A2825] hover:underline py-1">
                <Hash className="w-4 h-4 text-[#787672]" />
                <span className="flex-grow truncate" title={category.name}>
                  {category.name}
                </span>
                <span className="text-xs text-[#787672]">({category.count})</span>
              </Link>
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
