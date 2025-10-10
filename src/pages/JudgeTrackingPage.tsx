import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NotFoundPage } from "./NotFoundPage";
import { JudgeTracking } from "../components/admin/JudgeTracking";

export default function JudgeTrackingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  // Check if user is admin
  const isUserAdmin = useQuery(
    api.users.checkIsUserAdmin,
    isAuthenticated ? {} : "skip",
  );

  // Get the judging group by slug
  const group = useQuery(
    api.judgingGroups.getGroupBySlug,
    slug && authIsLoading === false && isAuthenticated ? { slug } : "skip",
  );

  // Handle loading states
  if (authIsLoading || (isAuthenticated && isUserAdmin === undefined)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // Show 404 for non-admin users
  if (!isAuthenticated || isUserAdmin === false) {
    return <NotFoundPage />;
  }

  // Show loading while fetching group
  if (group === undefined) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">Loading judging group...</div>
      </div>
    );
  }

  // Show 404 if group not found
  if (group === null) {
    return <NotFoundPage />;
  }

  // Navigate back to admin judging tab
  const handleBack = () => {
    navigate("/admin?tab=judging");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <JudgeTracking
        groupId={group._id}
        groupName={group.name}
        onBack={handleBack}
      />
    </div>
  );
}
