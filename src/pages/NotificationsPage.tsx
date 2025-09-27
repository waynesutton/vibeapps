import React from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

type AlertType = {
  _id: Id<"alerts">;
  _creationTime: number;
  type:
    | "vote"
    | "comment"
    | "rating"
    | "follow"
    | "judged"
    | "bookmark"
    | "report";
  isRead: boolean;
  actorUserId?: Id<"users">;
  storyId?: Id<"stories">;
  commentId?: Id<"comments">;
  ratingValue?: number;
};

export function NotificationsPage() {
  const { isSignedIn, isLoaded } = useAuth();

  // Queries and mutations
  const alerts = useQuery(api.alerts.listForPage, isSignedIn ? {} : "skip");
  const markAllAsRead = useMutation(api.alerts.markAllAsRead);

  // Mark all as read on page load
  React.useEffect(() => {
    if (isSignedIn && alerts) {
      markAllAsRead();
    }
  }, [isSignedIn, alerts, markAllAsRead]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F2F4F7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#F2F4F7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-lg p-8 border border-[#D8E1EC] text-center max-w-md">
              <h2 className="text-xl font-medium text-[#292929] mb-4">
                Sign in to see notifications
              </h2>
              <p className="text-[#525252] mb-6">
                You need to be signed in to view your notifications.
              </p>
              <Link
                to="/sign-in"
                className="inline-block px-6 py-3 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#292929]">Notifications</h1>
          <p className="text-[#525252] mt-2">
            Stay up to date with activity on your apps and profile.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-[#D8E1EC]">
          {alerts === undefined ? (
            <div className="p-8 text-center text-[#525252]">
              Loading notifications...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-[#525252] mb-4">No notifications yet</div>
              <p className="text-sm text-[#545454]">
                When people interact with your apps, you'll see notifications
                here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F4F0ED]">
              {alerts.map((alert: AlertType) => (
                <NotificationItem key={alert._id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationItemProps {
  alert: AlertType;
}

function NotificationItem({ alert }: NotificationItemProps) {
  const actorUser = useQuery(
    api.users.getUserById,
    alert.actorUserId ? { userId: alert.actorUserId } : "skip",
  );
  const story = useQuery(
    api.stories.getById,
    alert.storyId ? { id: alert.storyId } : "skip",
  );

  const getNotificationText = () => {
    switch (alert.type) {
      case "vote":
        return "vibed your app";
      case "comment":
        return "commented on your app";
      case "rating":
        return `rated your app ${alert.ratingValue} stars`;
      case "follow":
        return "started following you";
      case "judged":
        return "Your app has been judged";
      case "bookmark":
        return "bookmarked your app";
      case "report":
        return "reported a submission";
      default:
        return "interacted with your content";
    }
  };

  return (
    <div
      className={`p-4 hover:bg-[#F2F4F7] transition-colors ${
        !alert.isRead ? "bg-blue-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Actor Avatar */}
        {actorUser ? (
          <div className="flex-shrink-0">
            {actorUser.imageUrl ? (
              <img
                src={actorUser.imageUrl}
                alt={actorUser.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#292929] flex items-center justify-center">
                <span className="text-white text-xs">
                  {actorUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        ) : (
          alert.type !== "judged" && (
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#525252] flex items-center justify-center">
                <span className="text-white text-xs">?</span>
              </div>
            </div>
          )
        )}

        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-[#292929]">
            {alert.type === "judged" ? (
              <span>{getNotificationText()}</span>
            ) : actorUser ? (
              <>
                <Link
                  to={`/${actorUser.username}`}
                  className="font-medium hover:underline"
                >
                  {actorUser.name}
                </Link>{" "}
                {getNotificationText()}
                {story && alert.type !== "follow" && (
                  <>
                    {" "}
                    <Link
                      to={`/s/${story.slug}`}
                      className="inline-block px-3 py-1 mt-1 bg-[#292929] text-white text-xs rounded hover:bg-[#525252] transition-colors"
                    >
                      {story.title}
                    </Link>
                  </>
                )}
              </>
            ) : (
              <span>Someone {getNotificationText()}</span>
            )}
          </div>

          <div className="text-xs text-[#545454] mt-1">
            {formatDistanceToNow(alert._creationTime, { addSuffix: true })}
          </div>
        </div>

        {/* Read Status Indicator */}
        {!alert.isRead && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
}
