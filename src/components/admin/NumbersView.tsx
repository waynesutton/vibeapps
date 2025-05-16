import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

// Helper component for displaying each statistic
const StatCard = ({ title, value }: { title: string; value: number | string | undefined }) => (
  <div className="bg-white shadow rounded-lg p-4 min-h-[100px]">
    <h3 className="text-sm font-medium text-gray-500 truncate">{title}</h3>
    <p className="mt-1 text-3xl font-semibold text-gray-900">
      {value === undefined ? "Loading..." : value}
    </p>
  </div>
);

export function NumbersView() {
  const totalSubmissions = useQuery(api.adminQueries.getTotalSubmissions);
  const totalUsers = useQuery(api.adminQueries.getTotalUsers);
  const totalVotes = useQuery(api.adminQueries.getTotalVotes);
  const totalComments = useQuery(api.adminQueries.getTotalComments);
  const totalReportsData = useQuery(api.adminQueries.getTotalReports);
  const solvedReportsData = useQuery(api.adminQueries.getTotalSolvedReports);
  const totalBookmarksData = useQuery(api.adminQueries.getTotalBookmarks);
  const totalRatingsData = useQuery(api.adminQueries.getTotalRatings);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Key Metrics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <StatCard title="Total Submissions" value={totalSubmissions} />
        <StatCard title="Total Users" value={totalUsers} />
        <StatCard title="Total Votes" value={totalVotes} />
        <StatCard title="Total Comments" value={totalComments} />
        <StatCard title="Total Reports" value={totalReportsData} />
        <StatCard title="Solved Reports" value={solvedReportsData} />
        <StatCard title="Total Bookmarks" value={totalBookmarksData} />
        <StatCard title="Total Ratings" value={totalRatingsData} />
      </div>
    </div>
  );
}
