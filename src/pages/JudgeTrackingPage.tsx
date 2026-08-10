import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NotFoundPage } from "./NotFoundPage";
import { JudgeTracking } from "../components/admin/JudgeTracking";
import { useAdminAccessQuery } from "../components/admin/useAdminAccess";

export default function JudgeTrackingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, access } = useAdminAccessQuery();

  const hasTracking =
    access !== null &&
    (access.isAdmin || access.permissions.includes("judging.tracking"));

  // Get the judging group by slug (backend also enforces group scope)
  const group = useQuery(
    api.judgingGroups.getGroupBySlug,
    slug && !isLoading && isAuthenticated && hasTracking ? { slug } : "skip",
  );

  // Handle loading states
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // Show 404 for users without judging tracking access
  if (!isAuthenticated || !hasTracking) {
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
