import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { Lock } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "../components/ui/button";
import { authUrlWithReturn } from "../lib/redirectPath";

// Landing page behind a judging group's QR code. Its only job is to survive a
// phone scan: signed-in scanners go straight to the group's submission form,
// signed-out scanners see what they are joining and get auth links that return
// them to that same form. The submission password gate stays on the submit page.
export function JudgingGroupJoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();

  // Reuses the public submission page query, so this page exposes nothing new
  // and returns null whenever the group has no custom submission page enabled.
  const group = useQuery(
    api.judgingGroups.getSubmissionPage,
    slug ? { slug } : "skip",
  );

  // Forward any query params (the prefill links use ?title=&url=&github=) so a
  // join link works everywhere a submit link does.
  const submitPath = `/judging/${slug}/submit${location.search}`;

  if (!isLoaded || group === undefined) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-copy">Loading...</div>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-medium text-ink mb-4">Page Not Found</h1>
        <p className="text-copy mb-6">
          This join link doesn't exist or isn't enabled.
        </p>
        <Link to="/" className="text-ink hover:underline">
          ← Back to Home
        </Link>
      </div>
    );
  }

  // Already signed in: hand straight off to the form. `replace` keeps this
  // page out of history so Back does not bounce through it.
  if (isSignedIn) {
    return <Navigate to={submitPath} replace />;
  }

  const heading = group.submissionPageTitle || group.name;

  return (
    <div className="min-h-screen bg-canvas flex items-start justify-center p-4 py-12 sm:py-20">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-xl border border-hairline p-6 sm:p-8 text-center">
          {group.submissionPageImageUrl && (
            <img
              src={group.submissionPageImageUrl}
              alt={heading}
              className="mx-auto mb-6 w-full max-w-[220px] aspect-square object-cover rounded-lg border border-hairline"
            />
          )}

          <p className="text-xs font-medium uppercase tracking-wider text-faint mb-2">
            You're joining
          </p>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            {heading}
          </h1>
          {group.submissionPageDescription && (
            <p className="mt-3 text-sm text-copy leading-relaxed whitespace-pre-wrap">
              {group.submissionPageDescription}
            </p>
          )}

          <p className="mt-6 text-sm text-copy">
            Sign in or create an account to submit your app. We'll bring you
            right back to the submission form.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
            <Link
              to={authUrlWithReturn("/sign-up", submitPath)}
              className="flex-1"
            >
              <Button className="w-full bg-cta hover:bg-cta-hover h-11 text-[15px]">
                Sign Up
              </Button>
            </Link>
            <Link
              to={authUrlWithReturn("/sign-in", submitPath)}
              className="flex-1"
            >
              <Button
                variant="outline"
                className="w-full h-11 text-[15px] border-hairline"
              >
                Sign In
              </Button>
            </Link>
          </div>

          {group.hasSubmissionPagePassword && (
            <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-soft">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              This form also asks for the event's submission password
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default JudgingGroupJoinPage;
