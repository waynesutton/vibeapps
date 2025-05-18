import React from "react";
import { useQuery, useConvexAuth } from "convex/react";
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
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const skip = authIsLoading || !isAuthenticated;

  const totalSubmissions = useQuery(api.adminQueries.getTotalSubmissions, skip ? "skip" : {});
  const totalUsers = useQuery(api.adminQueries.getTotalUsers, skip ? "skip" : {});
  const totalVotes = useQuery(api.adminQueries.getTotalVotes, skip ? "skip" : {});
  const totalComments = useQuery(api.adminQueries.getTotalComments, skip ? "skip" : {});
  const totalReportsData = useQuery(api.adminQueries.getTotalReports, skip ? "skip" : {});
  const solvedReportsData = useQuery(api.adminQueries.getTotalSolvedReports, skip ? "skip" : {});
  const totalBookmarksData = useQuery(api.adminQueries.getTotalBookmarks, skip ? "skip" : {});
  const totalRatingsData = useQuery(api.adminQueries.getTotalRatings, skip ? "skip" : {});

  if (authIsLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Key Metrics</h2>
        <div className="text-center py-10">Loading authentication...</div>
      </div>
    );
  }

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
