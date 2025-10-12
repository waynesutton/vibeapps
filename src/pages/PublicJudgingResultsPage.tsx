import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Lock, Home } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { PublicJudgingResultsDashboard } from "../components/PublicJudgingResultsDashboard";

export default function PublicJudgingResultsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [password, setPassword] = useState("");
  const [isPasswordValidated, setIsPasswordValidated] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const group = useQuery(
    api.judgingGroups.getPublicGroupForResults,
    slug ? { slug } : "skip",
  );

  const validateResultsPassword = useMutation(
    api.judgingGroups.validateResultsPassword,
  );

  // Check if results are public (no password needed)
  useEffect(() => {
    if (group && group.resultsIsPublic) {
      setIsPasswordValidated(true);
    }
  }, [group]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    setIsValidating(true);
    setPasswordError("");

    try {
      const isValid = await validateResultsPassword({
        groupId: group._id,
        password: password.trim(),
      });

      if (isValid) {
        setIsPasswordValidated(true);
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
  if (!group) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (group === null) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-xl font-medium text-gray-900 mb-4">
            Results Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            The judging results you're looking for don't exist or have been
            removed.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Password required state
  if (!group.resultsIsPublic && !isPasswordValidated) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-medium text-gray-900 mb-2">
              Protected Results
            </h1>
            <p className="text-gray-600">
              This judging results page is password protected.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter results password"
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
              {isValidating ? "Validating..." : "View Results"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Results view (authenticated) - embed the admin results dashboard
  return (
    <div className="min-h-screen bg-[#F5F7F9]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">
              {group.name} - Results
            </h1>
            {group.description && (
              <p className="text-gray-600 mt-1">{group.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Results Dashboard */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PublicJudgingResultsDashboard groupId={group._id} />
      </div>
    </div>
  );
}
