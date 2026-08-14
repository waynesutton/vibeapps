import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Lock,
  Home,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Github,
  Globe,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Id } from "../../convex/_generated/dataModel";

export default function AIJudgeResultsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [password, setPassword] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isPasswordValidated, setIsPasswordValidated] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [expandedId, setExpandedId] = useState<Id<"aiJudgeResults"> | null>(
    null,
  );

  const info = useQuery(
    api.aiJudge.getPublicAiResultsInfo,
    slug ? { slug } : "skip",
  );

  const validateAiResultsPassword = useMutation(
    api.aiJudge.validateAiResultsPassword,
  );

  // Access is granted when: public, admin, or validated password this session
  const hasAccess =
    !!info &&
    (info.isAiResultsPublic || info.isAdmin || isPasswordValidated);

  // Check sessionStorage for an existing validation for this group
  useEffect(() => {
    if (info && !info.isAiResultsPublic && !info.isAdmin) {
      const stored = sessionStorage.getItem(`aiResultsPassword_${info._id}`);
      if (stored) {
        setEnteredPassword(stored);
        setIsPasswordValidated(true);
      }
    }
  }, [info]);

  // Load results only once access is granted. Public query covers the public
  // and admin cases; validated query covers the password case.
  const publicResults = useQuery(
    api.aiJudge.getPublicAiResults,
    info && hasAccess && (info.isAiResultsPublic || info.isAdmin)
      ? { groupId: info._id }
      : "skip",
  );
  const validatedResults = useQuery(
    api.aiJudge.getValidatedAiResults,
    info && hasAccess && !info.isAiResultsPublic && !info.isAdmin
      ? { groupId: info._id, password: enteredPassword }
      : "skip",
  );
  const results =
    info && (info.isAiResultsPublic || info.isAdmin)
      ? publicResults
      : validatedResults;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;

    setIsValidating(true);
    setPasswordError("");

    try {
      const isValid = await validateAiResultsPassword({
        groupId: info._id,
        password: password.trim(),
      });

      if (isValid) {
        setIsPasswordValidated(true);
        setEnteredPassword(password.trim());
        sessionStorage.setItem(
          `aiResultsPassword_${info._id}`,
          password.trim(),
        );
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (error) {
      setPasswordError("Error validating password. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  // Loading state
  if (info === undefined) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hairline-strong border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-copy">Loading AI results...</p>
        </div>
      </div>
    );
  }

  // Not found or AI judge not enabled
  if (info === null || !info.aiJudgeEnabled) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface rounded-lg border border-hairline p-6 text-center">
          <h1 className="text-xl font-medium text-ink mb-4">
            AI Results Not Found
          </h1>
          <p className="text-copy mb-6">
            The AI review results you're looking for don't exist or have been
            removed.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-cta text-on-cta rounded-md hover:bg-cta-hover transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Password gate
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface rounded-lg border border-hairline p-6">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-faint mx-auto mb-4" />
            <h1 className="text-2xl font-medium text-ink mb-2">
              Private AI Results
            </h1>
            <p className="text-copy mb-2">
              These AI review results are private and require a password.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Access Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter AI results password"
                required
                disabled={isValidating}
              />
              {passwordError && (
                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!password.trim() || isValidating}
            >
              {isValidating ? "Validating..." : "View AI Results"}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link
              to={`/judging/${slug}`}
              className="text-sm text-blue-600 hover:text-blue-800 block"
            >
              Access the judging interface →
            </Link>
            <Link
              to="/"
              className="text-sm text-soft hover:text-copy inline-flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <div className="bg-canvas">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-medium text-ink flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            {info.name} — Best Use of Convex, AI Review
          </h1>
          {info.description && (
            <p className="text-copy mt-1">{info.description}</p>
          )}
          <p className="text-sm text-soft mt-2">
            These rankings and notes were generated by an AI review of each
            submission's code repository and live site, and may have been
            adjusted by event admins.
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {results === undefined && (
          <div className="text-center py-8 text-soft">
            Loading results...
          </div>
        )}

        {results !== undefined &&
          (results === null || results.length === 0) && (
            <div className="text-center py-12 bg-surface rounded-lg border border-hairline">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-faint" />
              <p className="text-lg font-medium text-ink mb-2">
                No AI results yet
              </p>
              <p className="text-sm text-soft">
                The AI review has not been run for this group yet. Check back
                later.
              </p>
            </div>
          )}

        {results && results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => {
              const isExpanded = expandedId === result._id;
              return (
                <div
                  key={result._id}
                  className="bg-surface rounded-lg border border-hairline"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : result._id)
                    }
                    className="w-full flex items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          index === 0
                            ? "bg-amber-100 text-amber-700"
                            : index === 1
                              ? "bg-surface-hover text-copy"
                              : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-surface-alt text-copy"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">
                          {result.storyTitle}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-soft">
                          {result.sourcesUsed?.github && (
                            <span className="inline-flex items-center gap-1">
                              <Github className="w-3 h-3" />
                              repo reviewed
                            </span>
                          )}
                          {result.sourcesUsed?.liveUrl && (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              site reviewed
                            </span>
                          )}
                          {result.urlCheck && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${
                                result.urlCheck.isLive
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                              title={`Live app URL check at review time: ${result.urlCheck.note}`}
                            >
                              {result.urlCheck.isLive
                                ? "app live"
                                : result.urlCheck.statusCode === 404
                                  ? "app URL 404"
                                  : result.urlCheck.checkedUrl
                                    ? "app URL down"
                                    : "no app URL"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {result.averageScore !== undefined && (
                        <div className="text-right">
                          <p className="text-lg font-semibold text-ink">
                            {result.averageScore.toFixed(1)}
                            <span className="text-sm text-faint">/10</span>
                          </p>
                        </div>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-faint" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-faint" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-hairline p-4 space-y-4">
                      {/* Links */}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <a
                          href={`/s/${result.storySlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          View submission
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {result.githubUrl && (
                          <a
                            href={result.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Github className="w-3.5 h-3.5" />
                            GitHub
                          </a>
                        )}
                        {result.storyUrl && (
                          <a
                            href={result.storyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            Live site
                          </a>
                        )}
                      </div>

                      {/* Overall note */}
                      {result.overallReasoning && (
                        <div className="bg-surface-alt border border-hairline rounded-md p-3">
                          <p className="text-xs font-medium text-soft mb-1">
                            AI overall note
                          </p>
                          <p className="text-sm text-copy">
                            {result.overallReasoning}
                          </p>
                        </div>
                      )}

                      {/* Per-criterion scores */}
                      {result.criteriaScores &&
                        result.criteriaScores.length > 0 && (
                          <div className="space-y-2">
                            {result.criteriaScores.map((cs) => (
                              <div
                                key={cs.key}
                                className="border border-hairline rounded-md p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-ink">
                                    {cs.label}
                                  </p>
                                  <span className="text-sm font-semibold text-ink flex-shrink-0">
                                    {cs.score}/10
                                  </span>
                                </div>
                                {cs.reasoning && (
                                  <p className="text-sm text-copy mt-1">
                                    {cs.reasoning}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                      {/* Convex features detected */}
                      {result.convexFeaturesDetected &&
                        result.convexFeaturesDetected.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-soft mb-2">
                              Convex features detected
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {result.convexFeaturesDetected.map((feature) => (
                                <span
                                  key={feature}
                                  className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Convex components: used vs installed */}
                      {((result.componentsUsed?.length ?? 0) > 0 ||
                        (result.componentsDetected?.length ?? 0) > 0) && (
                        <div>
                          <p className="text-xs font-medium text-soft mb-2">
                            Convex components
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {result.componentsUsed?.map((component) => (
                              <span
                                key={`used-${component}`}
                                className="px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full"
                                title="Referenced in the app's code"
                              >
                                {component} (used)
                              </span>
                            ))}
                            {result.componentsDetected
                              ?.filter(
                                (component) =>
                                  !result.componentsUsed?.includes(component),
                              )
                              .map((component) => (
                                <span
                                  key={`installed-${component}`}
                                  className="px-2.5 py-1 text-xs bg-surface-alt text-soft border border-hairline rounded-full"
                                  title="Installed but no usage found in code"
                                >
                                  {component} (installed)
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Verified repo facts, deterministic */}
                      {result.repoFacts && (
                        <p className="text-xs text-soft">
                          Verified from source: {result.repoFacts.tableCount}{" "}
                          tables, {result.repoFacts.indexCount} indexes,{" "}
                          {result.repoFacts.queryCount} queries,{" "}
                          {result.repoFacts.mutationCount} mutations,{" "}
                          {result.repoFacts.actionCount} actions across{" "}
                          {result.repoFacts.convexFileCount} Convex files.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* AI transparency footer */}
        <p className="text-xs text-faint text-center mt-8">
          Scores and notes on this page were generated by AI as part of a Best
          Use of Convex review.
        </p>
      </div>
    </div>
  );
}
