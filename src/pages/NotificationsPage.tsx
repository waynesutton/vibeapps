import React from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type AlertType = {
  _id: Id<"alerts">;
  _creationTime: number;
  type:
    | "vote"
    | "comment"
    | "reply"
    | "mention"
    | "rating"
    | "follow"
    | "judged"
    | "bookmark"
    | "report"
    | "verified"
    | "pinned"
    | "admin_message"
    | "message"
    | "dm_report"
    | "spam";
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
      <div className="min-h-screen bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-surface rounded-lg p-8 border border-hairline text-center max-w-md">
              <h2 className="text-xl font-medium text-ink mb-4">
                Sign in to see notifications
              </h2>
              <p className="text-copy mb-6">
                You need to be signed in to view your notifications.
              </p>
              <Link
                to="/sign-in"
                className="inline-block px-6 py-3 bg-cta text-on-cta rounded-md hover:bg-cta-hover transition-colors"
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
          <h1 className="text-xl font-medium text-ink">Notifications</h1>
          <p className="text-copy mt-2">
            Stay up to date with activity on your apps and profile.
          </p>
        </div>

        <div className="bg-surface rounded-lg border border-hairline">
          {alerts === undefined ? (
            <div className="p-8 text-center text-copy">
              Loading notifications...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-copy mb-4">No notifications yet</div>
              <p className="text-sm text-soft">
                When people interact with your apps, you'll see notifications
                here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hairline">
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
  // Owner-scoped spam status drives the Request review button on spam alerts
  const spamStatus = useQuery(
    api.spamCheck.getMySpamStatus,
    alert.type === "spam" && alert.storyId
      ? { storyId: alert.storyId }
      : "skip",
  );
  const requestSpamReview = useMutation(api.spamCheck.requestSpamReview);
  const [requestingReview, setRequestingReview] = React.useState(false);

  // Dispute the spam mark in-app: stamps the story and pings admins in the
  // Activity log, no email required
  const handleRequestReview = async () => {
    if (!alert.storyId || requestingReview) return;
    setRequestingReview(true);
    try {
      const { status } = await requestSpamReview({ storyId: alert.storyId });
      if (status === "requested") {
        toast.success("Review requested. An admin will take another look.");
      } else if (status === "notSpam") {
        toast.success("Good news: this post is no longer marked as spam.");
      } else {
        toast.error("This submission no longer exists.");
      }
    } catch {
      toast.error("Could not request a review. Please try again.");
    } finally {
      setRequestingReview(false);
    }
  };

  const getNotificationText = () => {
    switch (alert.type) {
      case "vote":
        return "vibed your app";
      case "comment":
        return "commented on your app";
      case "reply":
        return "replied to your comment";
      case "mention":
        return alert.commentId
          ? "mentioned you in a comment"
          : "mentioned you in judge collaboration notes";
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
      case "verified":
        return "verified your account";
      case "pinned":
        return "Your post has been featured";
      case "admin_message":
        return "Your post has a custom message from admin";
      case "message":
        return "sent you a new message";
      case "dm_report":
        return "reported a message";
      case "spam":
        return "Your post has been marked as spam and has been removed. Check your email for the reason.";
      default:
        return "interacted with your content";
    }
  };

  return (
    <div
      className={`p-4 hover:bg-surface-hover transition-colors ${
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
              <div className="w-8 h-8 rounded-full bg-cta flex items-center justify-center">
                <span className="text-on-cta text-xs">
                  {actorUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        ) : (
          alert.type !== "judged" &&
          alert.type !== "verified" &&
          alert.type !== "spam" && (
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-cta-hover flex items-center justify-center">
                <span className="text-on-cta text-xs">?</span>
              </div>
            </div>
          )
        )}

        {/* System notification icon for verified */}
        {alert.type === "verified" && !actorUser && (
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink">
            {alert.type === "spam" ? (
              <span>
                Your post has been marked as spam and has been removed. Check
                your email for the reason. If you think this was a mistake,
                request a review below or{" "}
                <a
                  href="https://github.com/waynesutton/vibeapps/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-ink"
                >
                  file an issue on GitHub
                </a>
                .
              </span>
            ) : alert.type === "judged" ? (
              <span>{getNotificationText()}</span>
            ) : alert.type === "verified" ? (
              <span className="font-medium text-blue-600">
                Congratulations! Your account has been verified
              </span>
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
                      className="inline-block px-3 py-1 mt-1 bg-cta text-on-cta text-xs rounded hover:bg-cta-hover transition-colors"
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

          {/* In-app dispute: only shown to the owner while the mark stands */}
          {alert.type === "spam" && spamStatus?.isSpam && (
            <div className="mt-2">
              {spamStatus.reviewRequestedAt !== undefined ? (
                <span className="inline-flex items-center text-xs font-medium text-copy bg-surface-hover border border-hairline rounded px-2 py-1">
                  Review requested{" "}
                  {formatDistanceToNow(spamStatus.reviewRequestedAt, {
                    addSuffix: true,
                  })}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestReview}
                  disabled={requestingReview}
                  className="px-3 py-1 bg-cta text-on-cta text-xs rounded hover:bg-cta-hover transition-colors disabled:opacity-50"
                >
                  {requestingReview ? "Requesting..." : "Request review"}
                </button>
              )}
            </div>
          )}

          <div className="text-xs text-soft mt-1">
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
