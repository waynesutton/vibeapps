import React, { useMemo } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import { Doc, Id } from "../../../convex/_generated/dataModel";

// Helper component for displaying each statistic
const StatCard = ({
  title,
  value,
}: {
  title: string;
  value: number | string | undefined;
}) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[100px]">
    <h3 className="text-sm font-medium text-gray-500 truncate">{title}</h3>
    <p className="mt-1 text-3xl font-semibold text-gray-900">
      {value === undefined ? "Loading..." : value}
    </p>
  </div>
);

// Define types for the user objects returned by the queries
type UserWithFollowerCount = Doc<"users"> & {
  username: string; // Ensure username is always a string, defaulting to "N/A" if needed
  followerCount: number;
};

type UserWithFollowingCount = Doc<"users"> & {
  username: string; // Ensure username is always a string, defaulting to "N/A" if needed
  followingCount: number;
};

export function NumbersView() {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  const skip = authIsLoading || !isAuthenticated;

  const totalSubmissions = useQuery(
    api.adminQueries.getTotalSubmissions,
    skip ? "skip" : {},
  );
  const totalUsers = useQuery(
    api.adminQueries.getTotalUsers,
    skip ? "skip" : {},
  );
  const totalVotes = useQuery(
    api.adminQueries.getTotalVotes,
    skip ? "skip" : {},
  );
  const totalComments = useQuery(
    api.adminQueries.getTotalComments,
    skip ? "skip" : {},
  );
  const totalReportsData = useQuery(
    api.adminQueries.getTotalReports,
    skip ? "skip" : {},
  );
  const solvedReportsData = useQuery(
    api.adminQueries.getTotalSolvedReports,
    skip ? "skip" : {},
  );
  const totalBookmarksData = useQuery(
    api.adminQueries.getTotalBookmarks,
    skip ? "skip" : {},
  );
  const totalRatingsData = useQuery(
    api.adminQueries.getTotalRatings,
    skip ? "skip" : {},
  );

  // Add new queries for follow stats
  const totalFollowRelationships = useQuery(
    api.adminFollowsQueries.getTotalFollowRelationships,
    skip ? "skip" : {},
  );
  const topFollowers = useQuery(
    api.adminFollowsQueries.getTopUsersByFollowers,
    skip ? "skip" : { limit: 100 },
  );
  const topFollowing = useQuery(
    api.adminFollowsQueries.getTopUsersByFollowing,
    skip ? "skip" : { limit: 100 },
  );
  
  // Get user growth data for chart
  const userGrowthData = useQuery(
    api.adminQueries.getUserGrowthData,
    skip ? "skip" : {},
  );

  // Format data for display - show last 30 days or all data if less
  const chartData = useMemo(() => {
    if (!userGrowthData || userGrowthData.length === 0) return [];
    
    // Take last 30 data points or all if less than 30
    const dataToShow = userGrowthData.slice(-30);
    
    return dataToShow.map(item => ({
      ...item,
      formattedDate: new Date(item.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
    }));
  }, [userGrowthData]);

  // Calculate max value for scaling
  const maxUsers = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map(d => d.cumulative));
  }, [chartData]);

  if (authIsLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Key Metrics
        </h2>
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
        <StatCard title="Total Follows" value={totalFollowRelationships} />
      </div>

      {/* User Growth Chart */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          User Growth Over Time
        </h2>
        {chartData.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            Loading growth data...
          </div>
        )}
        {chartData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="relative h-64 overflow-hidden">
              {/* Bars */}
              <div className="flex items-end justify-between h-full gap-1">
                {chartData.map((item, index) => {
                  const height = maxUsers > 0 ? (item.cumulative / maxUsers) * 100 : 0;
                  
                  return (
                    <div
                      key={item.date}
                      className="flex-1 flex flex-col items-center group relative"
                    >
                      {/* Bar */}
                      <div
                        className="w-full bg-black hover:bg-gray-700 transition-colors rounded-t relative z-0"
                        style={{ height: `${height}%` }}
                      />
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
                        <div className="font-semibold">{item.cumulative} users</div>
                        <div className="text-gray-300">{item.formattedDate}</div>
                        <div className="text-gray-400">+{item.count} new</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Growth Line */}
              <svg 
                className="absolute inset-0 pointer-events-none z-10" 
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%' }}
              >
                <polyline
                  points={chartData.map((item, index) => {
                    const x = ((index + 0.5) / chartData.length) * 100;
                    const y = 100 - (maxUsers > 0 ? (item.cumulative / maxUsers) * 100 : 0);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            
            {/* X-axis labels - show every few labels to avoid crowding */}
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{chartData[0]?.formattedDate}</span>
              {chartData.length > 2 && (
                <span>{chartData[Math.floor(chartData.length / 2)]?.formattedDate}</span>
              )}
              <span>{chartData[chartData.length - 1]?.formattedDate}</span>
            </div>
            
            {/* Y-axis label and stats */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total Users</span>
                <span className="text-2xl font-semibold text-gray-900">
                  {chartData[chartData.length - 1]?.cumulative || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section for Top 100 Most Followed Users */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Top 100 Most Followed Users
        </h2>
        {topFollowers === undefined && (
          <p className="text-gray-600">Loading top followers...</p>
        )}
        {topFollowers && topFollowers.length === 0 && (
          <p className="text-gray-600 italic">No follower data available.</p>
        )}
        {topFollowers && topFollowers.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <ul className="divide-y divide-gray-200">
              {topFollowers.map(
                (user: UserWithFollowerCount | null, index: number) =>
                  user ? (
                    <li
                      key={user._id}
                      className="py-3 flex justify-between items-center"
                    >
                      <span className="text-sm">
                        {index + 1}.{" "}
                        <Link
                          to={`/${user.username}`}
                          className="text-black hover:underline"
                        >
                          {user.name || user.username || "Unnamed User"}
                        </Link>
                      </span>
                      <span className="text-sm text-gray-600">
                        {user.followerCount} followers
                      </span>
                    </li>
                  ) : null,
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Section for Top 100 Users Following Others Most */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Top 100 Users Following Others Most
        </h2>
        {topFollowing === undefined && (
          <p className="text-gray-600">Loading top following...</p>
        )}
        {topFollowing && topFollowing.length === 0 && (
          <p className="text-gray-600 italic">No following data available.</p>
        )}
        {topFollowing && topFollowing.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <ul className="divide-y divide-gray-200">
              {topFollowing.map(
                (user: UserWithFollowingCount | null, index: number) =>
                  user ? (
                    <li
                      key={user._id}
                      className="py-3 flex justify-between items-center"
                    >
                      <span className="text-sm">
                        {index + 1}.{" "}
                        <Link
                          to={`/${user.username}`}
                          className="text-black hover:underline"
                        >
                          {user.name || user.username || "Unnamed User"}
                        </Link>
                      </span>
                      <span className="text-sm text-gray-600">
                        following {user.followingCount}
                      </span>
                    </li>
                  ) : null,
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
