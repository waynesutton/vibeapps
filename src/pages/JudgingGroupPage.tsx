import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Lock, Calendar, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useDialog } from "../hooks/useDialog";
import { Label } from "../components/ui/label";

export default function JudgingGroupPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { showMessage, DialogComponents } = useDialog();

  const [password, setPassword] = useState("");
  const [judgeName, setJudgeName] = useState("");
  const [judgeEmail, setJudgeEmail] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const group = useQuery(
    api.judgingGroups.getPublicGroup,
    slug ? { slug } : "skip",
  );
  const registerJudge = useMutation(api.judges.registerJudge);
  const validatePassword = useMutation(api.judgingGroups.validatePassword);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !slug) return;

    try {
      const isValid = await validatePassword({
        groupId: group._id,
        password: password.trim(),
      });

      if (isValid) {
        setPasswordError("");
        setIsRegistering(true);
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (error) {
      setPasswordError("Error validating password. Please try again.");
    }
  };

  const handleJudgeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !judgeName.trim()) return;

    try {
      const result = await registerJudge({
        groupId: group._id,
        name: judgeName.trim(),
        email: judgeEmail.trim() || undefined,
      });

      // Store session ID in localStorage
      localStorage.setItem("judgeSessionId", result.sessionId);

      // Navigate to judging interface
      navigate(`/judging/${slug}/judge`);
    } catch (error) {
      console.error("Error registering judge:", error);
      showMessage("Error", "Failed to register. Please try again.", "error");
    }
  };

  if (group === undefined) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading judging group...</p>
        </div>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-xl font-medium text-gray-900 mb-4">
            Group Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            This judging group does not exist or is not currently available.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Show password form for private groups
  if (!group.isPublic && !isRegistering) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-xl font-medium text-gray-900 mb-2">
              {group.name}
            </h1>
            <p className="text-gray-600">
              This judging group is private. Please enter the access code to
              continue.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Access Code</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter group access code"
                required
                className={passwordError ? "border-red-500" : ""}
              />
              {passwordError && (
                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!password.trim()}
            >
              Continue
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show judge registration form
  return (
    <>
      <DialogComponents />
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-2">
            {group.name}
          </h1>
          {group.description && (
            <p className="text-gray-600 mb-4">{group.description}</p>
          )}

          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-6">
            {group.startDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  Started {new Date(group.startDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {group.endDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Ends {new Date(group.endDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleJudgeRegistration} className="space-y-4">
          <div>
            <Label htmlFor="judgeName">
              Your Name * <br />
              <strong>
                {" "}
                Use the same first name if you need to come back and continue
                judging.
              </strong>
            </Label>
            <Input
              id="judgeName"
              type="text"
              value={judgeName}
              onChange={(e) => {
                const value = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z]/g, "");
                setJudgeName(value);
              }}
              placeholder="Enter your full name"
              required
              minLength={2}
            />
            <p className="mt-1 text-sm text-gray-500">
              This will identify your scores in the system.
            </p>
          </div>

          <div>
            <Label htmlFor="judgeEmail">Email (Optional)</Label>
            <Input
              id="judgeEmail"
              type="email"
              value={judgeEmail}
              onChange={(e) => setJudgeEmail(e.target.value)}
              placeholder="your.email@example.com"
            />
            <p className="mt-1 text-sm text-gray-500">
              For communication about the judging process.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={!judgeName.trim()}>
            Start Judging
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
