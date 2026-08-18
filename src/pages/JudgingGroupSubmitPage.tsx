import React, { useState, useEffect, useRef } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ExternalLink, Lock, Plus, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Markdown } from "../components/Markdown";
import { ChoiceFieldInput } from "../components/ui/ChoiceFieldInput";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { authUrlWithReturn } from "../lib/redirectPath";

// Default required state for each configurable submission field.
// Mirrors the admin defaults in EditJudgingGroupModal.
const DEFAULT_FIELD_REQUIREMENTS = {
  title: true,
  tagline: true,
  longDescription: false,
  url: true,
  githubUrl: false,
  videoUrl: false,
  screenshot: true,
  submitterName: true,
  email: false,
  tags: true,
  // Form sections default to optional
  teamInfo: false,
  additionalImages: false,
  additionalLinks: false,
} as const;

type SubmissionFieldRequirements = {
  -readonly [K in keyof typeof DEFAULT_FIELD_REQUIREMENTS]: boolean;
};

// Merge stored (partial) requirements over the defaults so unset keys keep defaults.
function resolveRequirements(
  stored?: Partial<SubmissionFieldRequirements> | null,
): SubmissionFieldRequirements {
  const result: SubmissionFieldRequirements = { ...DEFAULT_FIELD_REQUIREMENTS };
  if (stored) {
    (Object.keys(result) as Array<keyof SubmissionFieldRequirements>).forEach(
      (key) => {
        if (typeof stored[key] === "boolean") {
          result[key] = stored[key] as boolean;
        }
      },
    );
  }
  return result;
}

// Default visibility: every field and section shown, matching the original
// form so existing groups without config render unchanged.
const DEFAULT_FIELD_VISIBILITY = {
  title: true,
  tagline: true,
  longDescription: true,
  url: true,
  githubUrl: true,
  videoUrl: true,
  screenshot: true,
  submitterName: true,
  email: true,
  tags: true,
  teamInfo: true,
  additionalImages: true,
  additionalLinks: true,
} as const;

type SubmissionFieldVisibility = {
  -readonly [K in keyof typeof DEFAULT_FIELD_VISIBILITY]: boolean;
};

// Merge stored (partial) visibility over the defaults. Title is always shown.
function resolveVisibility(
  stored?: Partial<SubmissionFieldVisibility> | null,
): SubmissionFieldVisibility {
  const result: SubmissionFieldVisibility = { ...DEFAULT_FIELD_VISIBILITY };
  if (stored) {
    (Object.keys(result) as Array<keyof SubmissionFieldVisibility>).forEach(
      (key) => {
        if (typeof stored[key] === "boolean") {
          result[key] = stored[key] as boolean;
        }
      },
    );
  }
  result.title = true;
  return result;
}

// Admin-defined custom question rendered on the group submission form
type CustomQuestion = {
  key: string;
  label: string;
  placeholder?: string;
  description?: string;
  fieldType:
    | "text"
    | "url"
    | "email"
    | "textarea"
    | "radio"
    | "multiselect"
    | "select";
  options?: string[]; // Choices for radio/multiselect/select questions
  required: boolean;
  visible?: boolean; // Unset = shown
};

// Per-group overrides for admin-managed form fields, keyed by field key
type DynamicFieldOverrides = Record<
  string,
  { required?: boolean; visible?: boolean }
>;

// Fields the hackathon skill can prefill via query params
// (?url=&title=&tagline=&github=)
type FormPrefill = {
  title: string;
  tagline: string;
  url: string;
  github: string;
};

// Convex mutation errors arrive wrapped ("[CONVEX ...] ... Uncaught Error:
// message"). Extract the friendly message so users see it clean.
function cleanSubmitError(raw: string): string {
  const match = raw.match(/Uncaught Error:\s*([^\n]+)/);
  if (match) return match[1].trim();
  return raw.replace(/^\[.*?\]\s*/, "").trim() || "Failed to submit";
}

export function JudgingGroupSubmitPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();

  // Signing in from this page must come back to this group's form. Most
  // visitors arrive from a QR code or shared link while signed out, and
  // without this they land on the homepage after authenticating.
  const returnTo = `/judging/${slug}/submit${location.search}`;

  // Optional one-click prefill from the hackathon skill's submit link.
  // The form works exactly as before when no params are present.
  const prefill: FormPrefill = {
    title: searchParams.get("title") || "",
    tagline: searchParams.get("tagline") || "",
    url: searchParams.get("url") || "",
    github: searchParams.get("github") || "",
  };
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch submission page data
  const submissionPage = useQuery(
    api.judgingGroups.getSubmissionPage,
    slug ? { slug } : "skip",
  );
  const validateSubmissionPagePassword = useMutation(
    api.judgingGroups.validateSubmissionPagePassword,
  );

  // Handle password validation
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionPage) return;

    try {
      const isValid = await validateSubmissionPagePassword({
        groupId: submissionPage._id,
        password,
      });

      if (isValid) {
        setIsAuthenticated(true);
        setPasswordError("");
      } else {
        setPasswordError("Incorrect password");
      }
    } catch (error) {
      setPasswordError("Error validating password");
    }
  };

  // No auto-unlock here: the password gate below only renders when a
  // submission password is set, so pages without one open directly. Judge
  // access visibility (isPublic) must never bypass the submission password.

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-copy">Loading...</div>
      </div>
    );
  }

  if (submissionPage === undefined) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-copy">Loading submission page...</div>
      </div>
    );
  }

  if (submissionPage === null) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-medium text-ink mb-4">Page Not Found</h1>
        <p className="text-copy mb-6">
          This submission page doesn't exist or isn't enabled.
        </p>
        <Link to="/" className="text-ink hover:underline">
          ← Back to Home
        </Link>
      </div>
    );
  }

  // Show password form if not authenticated
  if (!isAuthenticated && submissionPage.hasSubmissionPagePassword) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="bg-surface rounded-lg p-8 max-w-md w-full border border-hairline">
          <div className="flex items-center justify-center w-12 h-12 bg-canvas rounded-full mx-auto mb-4">
            <Lock className="w-6 h-6 text-copy" />
          </div>
          <h2 className="text-xl font-medium text-ink text-center mb-2">
            Password Required
          </h2>
          <p className="text-sm text-copy text-center mb-6">
            This submission page is password-protected
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full"
                required
              />
              {passwordError && (
                <p className="text-sm text-red-600 mt-1">{passwordError}</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-cta hover:bg-cta-hover">
              Submit
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Determine grid layout classes based on admin setting
  const isSingleColumn = submissionPage.submissionPageLayout === "single";
  const layoutClass =
    submissionPage.submissionPageLayout === "one-third"
      ? "lg:grid-cols-[1fr_2fr]" // 33/67 split
      : "lg:grid-cols-2"; // 50/50 split

  // Calculate image size (square crop only) and aspect (square or 16:9 wide)
  const imageSize = submissionPage.submissionPageImageSize || 400;
  const isWideImage = submissionPage.submissionPageImageAspect === "wide";

  // Shared form card used by every layout variant
  const formCard = (
    <div className="bg-surface rounded-xl p-6 sm:p-8 border border-hairline">
      {showSuccess ? (
        /* Success Message */
        <div className="text-center py-12">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-medium text-ink mb-2">Thank You!</h2>
          <p className="text-copy">
            Your submission has been received successfully.
          </p>
          <p className="text-sm text-faint mt-4">
            Redirecting you to the homepage...
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-medium text-ink mb-2">
            {submissionPage.submissionFormTitle || "Submit Your App"}
          </h2>
          {submissionPage.submissionFormSubtitle && (
            <p className="text-sm text-copy mb-4">
              {submissionPage.submissionFormSubtitle}
            </p>
          )}
          <div className="mb-6" />

          {/* Notice about authentication */}
          {!isSignedIn && (
            <div className="mb-6 p-4 bg-canvas border border-hairline rounded-md">
              <p className="text-sm text-copy">
                You need to{" "}
                <Link
                  to={authUrlWithReturn("/sign-up", returnTo)}
                  className="underline font-medium text-ink hover:text-copy"
                >
                  sign up
                </Link>{" "}
                or{" "}
                <Link
                  to={authUrlWithReturn("/sign-in", returnTo)}
                  className="underline font-medium text-ink hover:text-copy"
                >
                  sign in
                </Link>{" "}
                to submit your app to the hackathon.
              </p>
            </div>
          )}

          {isSignedIn ? (
            <SubmissionFormContent
              judgingGroupId={submissionPage._id}
              requiredTagId={submissionPage.submissionFormRequiredTagId}
              showRequiredTag={
                submissionPage.submissionFormRequiredTagVisible !== false
              }
              fieldRequirements={resolveRequirements(
                submissionPage.submissionFieldRequirements,
              )}
              fieldVisibility={resolveVisibility(
                submissionPage.submissionFieldVisibility,
              )}
              customQuestions={submissionPage.submissionCustomQuestions || []}
              dynamicFieldOverrides={
                submissionPage.submissionDynamicFieldOverrides || {}
              }
              prefill={prefill}
              onSuccess={() => {
                setShowSuccess(true);
                // Redirect to homepage after 2.5 seconds
                setTimeout(() => {
                  navigate("/");
                }, 2500);
              }}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-copy mb-4">
                You need to sign up or sign in to submit your app to the
                hackathon.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link to={authUrlWithReturn("/sign-up", returnTo)}>
                  <Button className="bg-cta hover:bg-cta-hover">Sign Up</Button>
                </Link>
                <Link to={authUrlWithReturn("/sign-in", returnTo)}>
                  <Button className="bg-cta hover:bg-cta-hover">Sign In</Button>
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Single column layout: centered hero (image, title, description, links)
  // stacked above the form card. Matches the no-sidebar submit page width,
  // with wide (16:9) header images filling the full column.
  if (isSingleColumn) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
          <header className="mb-10 sm:mb-12 text-center">
            {submissionPage.submissionPageImageUrl && (
              <img
                src={submissionPage.submissionPageImageUrl}
                alt={submissionPage.submissionPageTitle || submissionPage.name}
                style={
                  isWideImage
                    ? { width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }
                    : {
                        width: "100%",
                        maxWidth: `${imageSize}px`,
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                      }
                }
                className="mx-auto rounded-xl border border-hairline mb-8"
              />
            )}
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-ink">
              {submissionPage.submissionPageTitle || submissionPage.name}
            </h1>
            {submissionPage.submissionPageDescription && (
              <p className="mt-4 text-copy leading-relaxed whitespace-pre-wrap max-w-2xl mx-auto">
                {submissionPage.submissionPageDescription}
              </p>
            )}
            {submissionPage.submissionPageLinks &&
              submissionPage.submissionPageLinks.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {submissionPage.submissionPageLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface border border-hairline text-sm text-ink hover:border-hairline-strong hover:text-copy transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
          </header>

          {formCard}
        </div>
      </div>
    );
  }

  // Main submission page - Luma-style layout
  return (
    <div className="min-h-screen bg-canvas">
      {/* Main Content - Dynamic Column Layout */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className={`grid grid-cols-1 ${layoutClass} gap-8`}>
          {/* Left Column - Event Info */}
          <div className="space-y-6 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto self-start">
            {/* Header Image */}
            {submissionPage.submissionPageImageUrl && (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={submissionPage.submissionPageImageUrl}
                  alt={
                    submissionPage.submissionPageTitle || submissionPage.name
                  }
                  style={
                    isWideImage
                      ? {
                          width: "100%",
                          aspectRatio: "16 / 9",
                          objectFit: "cover",
                        }
                      : {
                          width: `${imageSize}px`,
                          height: `${imageSize}px`,
                          objectFit: "cover",
                        }
                  }
                  className="mx-auto"
                />
              </div>
            )}

            {/* Title & Description */}
            <div className="bg-surface rounded-lg p-6 border border-hairline">
              <h1 className="text-3xl font-medium text-ink mb-4">
                {submissionPage.submissionPageTitle || submissionPage.name}
              </h1>
              {submissionPage.submissionPageDescription && (
                <div className="prose prose-sm max-w-none text-copy">
                  <p className="whitespace-pre-wrap">
                    {submissionPage.submissionPageDescription}
                  </p>
                </div>
              )}
            </div>

            {/* Links - No Heading, Just Links */}
            {submissionPage.submissionPageLinks &&
              submissionPage.submissionPageLinks.length > 0 && (
                <div className="bg-surface rounded-lg p-6 border border-hairline">
                  <div className="space-y-2">
                    {submissionPage.submissionPageLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-ink hover:text-copy transition-colors group"
                      >
                        <ExternalLink className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="group-hover:underline">
                          {link.label}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Submission Form */}
          <div>{formCard}</div>
        </div>
      </div>
    </div>
  );
}

// Hairline section heading used to group related form fields
function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-medium uppercase tracking-wider text-faint whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-surface-hover" aria-hidden="true" />
    </div>
  );
}

// Submission Form Content Component - Matches StoryForm.tsx exactly
function SubmissionFormContent({
  judgingGroupId,
  requiredTagId,
  showRequiredTag,
  fieldRequirements,
  fieldVisibility,
  customQuestions,
  dynamicFieldOverrides,
  prefill,
  onSuccess,
}: {
  judgingGroupId: Id<"judgingGroups">;
  requiredTagId?: Id<"tags"> | null;
  // Display-only: when false the locked required tag is hidden from the
  // submitter (pills, quick select, counter) but still applied on submit
  showRequiredTag: boolean;
  fieldRequirements: SubmissionFieldRequirements;
  fieldVisibility: SubmissionFieldVisibility;
  customQuestions: CustomQuestion[];
  dynamicFieldOverrides: DynamicFieldOverrides;
  prefill: FormPrefill;
  onSuccess: () => void;
}) {
  const req = fieldRequirements;
  // Drift guard: never hide the tag picker unless a required tag guarantees
  // the submission still lands in this judging group.
  const vis: SubmissionFieldVisibility = {
    ...fieldVisibility,
    tags: fieldVisibility.tags || !requiredTagId,
  };
  const submit = useMutation(api.stories.submit);
  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const availableTags = useQuery(api.tags.listHeader); // Only show header tags
  const allTags = useQuery(api.tags.listAllForDropdown); // For dropdown search
  const formFields = useQuery(api.storyFormFields.listEnabled);
  const siteSettings = useQuery(api.settings.get); // Tag limits

  // Admin-managed dynamic fields, filtered and configured per group.
  // Overrides beat the field's global defaults; unset entries fall through.
  const visibleDynamicFields = (formFields || []).filter(
    (field) =>
      field.key !== "githubUrl" &&
      (dynamicFieldOverrides[field.key]?.visible ?? true),
  );
  const isDynamicFieldRequired = (fieldKey: string, fallback: boolean) =>
    dynamicFieldOverrides[fieldKey]?.required ?? fallback;

  // Custom questions hidden by the group admin are removed entirely
  const visibleCustomQuestions = customQuestions.filter(
    (question) => question.visible !== false,
  );

  const [selectedTagIds, setSelectedTagIds] = React.useState<Id<"tags">[]>([]);
  const [newTagInputValue, setNewTagInputValue] = React.useState("");
  const [newTagNames, setNewTagNames] = React.useState<string[]>([]);
  const [dropdownSearchValue, setDropdownSearchValue] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);

  const [formData, setFormData] = useState({
    title: prefill.title,
    tagline: prefill.tagline,
    longDescription: "",
    submitterName: "",
    url: prefill.url,
    videoUrl: "",
    email: "",
  });

  const [teamData, setTeamData] = useState({
    teamName: "",
    teamSize: "",
    teamMembers: [{ name: "", email: "" }],
  });

  const [dynamicFormData, setDynamicFormData] = useState<
    Record<string, string>
  >(() => {
    const initial: Record<string, string> = {};
    if (prefill.github) initial.githubUrl = prefill.github;
    return initial;
  });
  // Answers to this group's custom questions, keyed by question key
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
    {},
  );
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Non-blocking warning when the GitHub repo looks private or missing.
  // The AI judge can only analyze public repos.
  const [repoVisibilityWarning, setRepoVisibilityWarning] = useState<
    string | null
  >(null);

  // Client-side GitHub visibility check, run on blur of the GitHub URL field.
  // Unauthenticated GET against the public GitHub API: 404 means the repo is
  // private or does not exist. Errors are ignored so this never blocks submits.
  const checkRepoVisibility = async (url: string) => {
    const match = url.trim().match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
    if (!match) {
      setRepoVisibilityWarning(null);
      return;
    }
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, "");
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (res.status === 404) {
        setRepoVisibilityWarning(
          "This repo looks private or missing. The AI judge can only analyze public repos, so make it public before judging starts.",
        );
      } else {
        setRepoVisibilityWarning(null);
      }
    } catch {
      // Network or rate-limit issues: stay quiet rather than warn incorrectly
      setRepoVisibilityWarning(null);
    }
  };

  const MAX_TAGLINE_LENGTH = 140;

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-select required tag if specified
  useEffect(() => {
    if (requiredTagId && !selectedTagIds.includes(requiredTagId)) {
      setSelectedTagIds((prev) => [...prev, requiredTagId]);
    }
  }, [requiredTagId]);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshot(e.target.files[0]);
    }
  };

  const handleAdditionalImagesChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const totalImages = additionalImages.length + filesArray.length;
      if (totalImages > 5) {
        setError("You can upload a maximum of 5 additional images.");
        return;
      }
      setAdditionalImages((prev) => [...prev, ...filesArray]);
    }
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Tag limits from admin settings (hidden tracking tags never count)
  const maxTags = siteSettings?.maxTagsPerSubmission ?? 6;
  const maxTagLength = siteSettings?.maxTagLength ?? 20;

  // Count selected tags toward the limit, excluding hidden tags and a
  // form-hidden required tag (submitters cannot see or remove it)
  const countedTags =
    selectedTagIds.filter((id) => {
      if (!showRequiredTag && requiredTagId && id === requiredTagId) {
        return false;
      }
      const tag = allTags?.find((t) => t._id === id);
      return tag ? tag.isHidden !== true : true;
    }).length + newTagNames.length;

  const handleAddNewTag = () => {
    const tagName = newTagInputValue.trim();

    if (countedTags >= maxTags) {
      setError(`You can select a maximum of ${maxTags} tags.`);
      return;
    }

    if (tagName.length > maxTagLength) {
      setError(`Tag names are limited to ${maxTagLength} characters.`);
      return;
    }

    if (
      tagName &&
      !newTagNames.some((t) => t.toLowerCase() === tagName.toLowerCase()) &&
      !availableTags?.some(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      ) &&
      !allTags?.some((t) => t.name.toLowerCase() === tagName.toLowerCase())
    ) {
      setNewTagNames((prev) => [...prev, tagName]);
      setNewTagInputValue("");
      setError("");
    } else if (tagName) {
      setError("Tag name already exists or is invalid.");
    }
  };

  const handleSelectFromDropdown = (tagId: Id<"tags">) => {
    // Hidden tags never count toward the limit
    const selectedTag = allTags?.find((t) => t._id === tagId);
    if (selectedTag?.isHidden !== true && countedTags >= maxTags) {
      setError(`You can select a maximum of ${maxTags} tags.`);
      return;
    }
    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds((prev) => [...prev, tagId]);
      setError("");
    }
    setDropdownSearchValue("");
    setShowDropdown(false);
  };

  const toggleTag = (tagId: Id<"tags">) => {
    // Prevent deselecting the required tag
    if (requiredTagId && tagId === requiredTagId) {
      return;
    }
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      // Hidden tags never count toward the limit
      const selectedTag = allTags?.find((t) => t._id === tagId);
      if (selectedTag?.isHidden !== true && countedTags >= maxTags) {
        setError(`You can select a maximum of ${maxTags} tags.`);
        return prev;
      }
      setError("");
      return [...prev, tagId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Enforce tag requirement (custom selector cannot use HTML required).
    // Skipped when the tag picker is hidden; the required tag is applied
    // automatically both client- and server-side.
    if (
      vis.tags &&
      req.tags &&
      selectedTagIds.length === 0 &&
      newTagNames.length === 0
    ) {
      setError("Please select or add at least one tag.");
      return;
    }

    // Section-level requirements set by the group admin
    if (vis.teamInfo && req.teamInfo && !teamData.teamName.trim()) {
      setError("Team info is required. Please add your team name.");
      return;
    }
    if (vis.additionalImages && req.additionalImages && additionalImages.length === 0) {
      setError("Please upload at least one additional image.");
      return;
    }
    if (
      vis.additionalLinks &&
      req.additionalLinks &&
      !visibleDynamicFields.some((field) =>
        (dynamicFormData[field.key] || "").trim(),
      )
    ) {
      setError("Please fill in at least one of the additional link fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload main screenshot
      let screenshotId: Id<"_storage"> | undefined = undefined;
      if (screenshot) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": screenshot.type },
          body: screenshot,
        });
        const { storageId } = await result.json();
        screenshotId = storageId;
      }

      // Upload additional images
      const additionalImageIds: Id<"_storage">[] = [];
      for (const image of additionalImages) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": image.type },
          body: image,
        });
        const { storageId } = await result.json();
        additionalImageIds.push(storageId);
      }

      // Submit story with all fields
      await submit({
        title: formData.title,
        tagline: formData.tagline,
        longDescription: formData.longDescription || undefined,
        submitterName: formData.submitterName || undefined,
        url: formData.url,
        videoUrl: formData.videoUrl || undefined,
        email: formData.email || undefined,
        tagIds: selectedTagIds,
        newTagNames,
        screenshotId,
        additionalImageIds:
          additionalImageIds.length > 0 ? additionalImageIds : undefined,
        judgingGroupId, // Auto-add to judging group
        // Dynamic form fields
        linkedinUrl: dynamicFormData.linkedinUrl || undefined,
        twitterUrl: dynamicFormData.twitterUrl || undefined,
        githubUrl: dynamicFormData.githubUrl || undefined,
        chefShowUrl: dynamicFormData.chefShowUrl || undefined,
        chefAppUrl: dynamicFormData.chefAppUrl || undefined,
        // Pasted hackathon.md for private/no-repo projects
        hackathonLog: dynamicFormData.hackathonLog || undefined,
        // Every visible admin-managed field, so new fields are never dropped
        dynamicFieldValues: (formFields || [])
          .filter(
            (field) =>
              (dynamicFieldOverrides[field.key]?.visible ?? true) &&
              (dynamicFormData[field.key] || "").trim(),
          )
          .map((field) => ({
            key: field.key,
            label: field.label,
            value: dynamicFormData[field.key],
          })),
        // Team info (always included if provided)
        teamName: teamData.teamName ? teamData.teamName : undefined,
        teamMemberCount: teamData.teamName
          ? parseInt(teamData.teamSize) || undefined
          : undefined,
        teamMembers: teamData.teamName
          ? teamData.teamMembers.filter((m) => m.name.trim() || m.email.trim())
          : undefined,
        // Custom question answers (label denormalized for display).
        // Hidden questions are excluded; users never saw them.
        customFormAnswers:
          visibleCustomQuestions.length > 0
            ? visibleCustomQuestions
                .map((question) => ({
                  key: question.key,
                  label: question.label,
                  value: (customAnswers[question.key] || "").trim(),
                }))
                .filter((answer) => answer.value)
            : undefined,
      });

      onSuccess();
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err instanceof Error
          ? cleanSubmitError(err.message)
          : "Failed to submit",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionHeading label="Project details" />

      {/* App Title */}
      <div>
        <label className="block text-sm font-medium text-copy mb-1">
          App Title{req.title ? "*" : " (Optional)"}
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          placeholder="Site name"
          className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
          required={req.title}
          disabled={isSubmitting}
        />
      </div>

      {/* Tagline */}
      {vis.tagline && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            App/Project Tagline{req.tagline ? "*" : " (Optional)"}
          </label>
          <input
            type="text"
            value={formData.tagline}
            onChange={(e) => {
              if (e.target.value.length <= MAX_TAGLINE_LENGTH) {
                setFormData((prev) => ({ ...prev, tagline: e.target.value }));
              }
            }}
            maxLength={MAX_TAGLINE_LENGTH}
            placeholder="One sentence pitch or description"
            className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
            required={req.tagline}
            disabled={isSubmitting}
          />
          <div className="text-xs text-right text-soft mt-1">
            {formData.tagline.length}/{MAX_TAGLINE_LENGTH}
          </div>
        </div>
      )}

      {/* Long Description */}
      {vis.longDescription && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            Description{req.longDescription ? "*" : ""} (Markdown and fenced
            `code` blocks supported)
          </label>
          <textarea
            value={formData.longDescription}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                longDescription: e.target.value,
              }))
            }
            placeholder="- Problem you're solving&#10;- How the app works&#10;- Notable features&#10;- Why did you build this&#10;- Tech stack list&#10;- Challenges we ran into&#10;- Any success stories or metrics&#10;"
            rows={8}
            className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
            required={req.longDescription}
            disabled={isSubmitting}
          />
          {formData.longDescription && (
            <div className="mt-2">
              <div className="text-xs text-soft mb-1">Preview</div>
              <div className="prose prose-sm max-w-none text-copy bg-surface-alt border border-hairline rounded-md p-3">
                <Markdown>{formData.longDescription}</Markdown>
              </div>
            </div>
          )}
        </div>
      )}

      {(vis.url ||
        vis.githubUrl ||
        vis.additionalLinks ||
        vis.videoUrl ||
        vis.screenshot ||
        vis.additionalImages) && <SectionHeading label="Links and media" />}

      {/* URL */}
      {vis.url && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            App Website Link{req.url ? "*" : " (Optional)"}
          </label>
          <div className="text-sm text-soft mb-2">
            Enter your app url (ex: https://)
          </div>
          <input
            type="url"
            value={formData.url}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, url: e.target.value }))
            }
            placeholder="https://"
            className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
            required={req.url}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* GitHub URL Field */}
      {vis.githubUrl && (
        <div>
          <label
            htmlFor="githubUrl"
            className="block text-sm font-medium text-copy mb-1"
          >
            GitHub Repo URL{req.githubUrl ? "*" : " (Optional)"}
          </label>
          <div className="text-sm text-soft mb-2">
            GitHub repository URL for your project
          </div>
          <input
            type="url"
            id="githubUrl"
            placeholder="https://github.com/username/repository"
            value={dynamicFormData.githubUrl || ""}
            onChange={(e) =>
              setDynamicFormData((prev) => ({
                ...prev,
                githubUrl: e.target.value,
              }))
            }
            onBlur={(e) => {
              void checkRepoVisibility(e.target.value);
            }}
            className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
            required={req.githubUrl}
            disabled={isSubmitting}
          />
          {repoVisibilityWarning && (
            <div className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {repoVisibilityWarning}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Form Fields (per-group required/visible overrides applied) */}
      {vis.additionalLinks &&
        visibleDynamicFields.map((field) => {
          const fieldRequired = isDynamicFieldRequired(
            field.key,
            field.isRequired,
          );
          return (
            <div key={field.key}>
              <label
                htmlFor={field.key}
                className="block text-sm font-medium text-copy mb-1"
              >
                {field.label}
                {fieldRequired && !field.label.includes("*") ? "*" : ""}
              </label>
              {field.description && (
                <div className="text-sm text-soft mb-2">
                  {field.description}
                </div>
              )}
              {field.fieldType === "radio" ||
              field.fieldType === "multiselect" ||
              field.fieldType === "select" ? (
                <ChoiceFieldInput
                  fieldKey={field.key}
                  fieldType={field.fieldType}
                  options={field.options ?? []}
                  placeholder={field.placeholder}
                  value={dynamicFormData[field.key] || ""}
                  onChange={(value) =>
                    setDynamicFormData((prev) => ({
                      ...prev,
                      [field.key]: value,
                    }))
                  }
                  required={fieldRequired}
                  disabled={isSubmitting}
                />
              ) : field.fieldType === "textarea" ? (
                <>
                  <textarea
                    id={field.key}
                    placeholder={field.placeholder}
                    value={dynamicFormData[field.key] || ""}
                    onChange={(e) =>
                      setDynamicFormData((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    rows={10}
                    maxLength={20000}
                    className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline font-mono text-xs"
                    required={fieldRequired}
                    disabled={isSubmitting}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-soft">
                      This will be read by judges. Do not paste API keys, env
                      values, or personal data.
                    </span>
                    <span className="text-xs text-soft tabular-nums">
                      {(dynamicFormData[field.key] || "").length}/20000
                    </span>
                  </div>
                </>
              ) : (
                <input
                  type={field.fieldType}
                  id={field.key}
                  placeholder={field.placeholder}
                  value={dynamicFormData[field.key] || ""}
                  onChange={(e) =>
                    setDynamicFormData((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
                  required={fieldRequired}
                  disabled={isSubmitting}
                />
              )}
            </div>
          );
        })}
      {vis.additionalLinks && formFields === undefined && (
        <div className="text-sm text-soft">Loading form fields...</div>
      )}

      {/* Video URL */}
      {vis.videoUrl && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            Video Demo{req.videoUrl ? "*" : " (Recommended)"}
          </label>
          <div className="text-sm text-soft mb-2">
            Share a video demo of your app (YouTube, Vimeo, etc.)
          </div>
          <input
            type="url"
            value={formData.videoUrl}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))
            }
            placeholder="https://youtube.com/..."
            className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
            required={req.videoUrl}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Screenshot */}
      {vis.screenshot && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            Screenshot or Image{req.screenshot ? "*" : " (Optional)"}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={isSubmitting}
            className="w-full text-sm text-copy file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-surface-alt file:text-ink hover:file:bg-surface-hover"
            required={req.screenshot}
          />
        </div>
      )}

      {/* Additional Images */}
      {vis.additionalImages && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            Additional Images{req.additionalImages ? "*" : " (Optional)"} (max
            4)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleAdditionalImagesChange}
            disabled={isSubmitting || additionalImages.length >= 5}
            className="w-full text-sm text-copy file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-surface-alt file:text-ink hover:file:bg-surface-hover"
          />
          {additionalImages.length > 0 && (
            <div className="mt-2 space-y-1">
              {additionalImages.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm text-copy bg-surface-alt p-2 rounded"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAdditionalImage(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom questions defined by the group admin (hidden ones excluded) */}
      {visibleCustomQuestions.length > 0 && (
        <>
          <SectionHeading label="Additional questions" />
          {visibleCustomQuestions.map((question) => (
            <div key={question.key}>
              <label
                htmlFor={`custom-${question.key}`}
                className="block text-sm font-medium text-copy mb-1"
              >
                {question.label}
                {question.required ? "*" : " (Optional)"}
              </label>
              {question.description && (
                <div className="text-sm text-soft mb-2">
                  {question.description}
                </div>
              )}
              {question.fieldType === "radio" ||
              question.fieldType === "multiselect" ||
              question.fieldType === "select" ? (
                <ChoiceFieldInput
                  fieldKey={`custom-${question.key}`}
                  fieldType={question.fieldType}
                  options={question.options ?? []}
                  placeholder={question.placeholder}
                  value={customAnswers[question.key] || ""}
                  onChange={(value) =>
                    setCustomAnswers((prev) => ({
                      ...prev,
                      [question.key]: value,
                    }))
                  }
                  required={question.required}
                  disabled={isSubmitting}
                />
              ) : question.fieldType === "textarea" ? (
                <textarea
                  id={`custom-${question.key}`}
                  value={customAnswers[question.key] || ""}
                  onChange={(e) =>
                    setCustomAnswers((prev) => ({
                      ...prev,
                      [question.key]: e.target.value,
                    }))
                  }
                  placeholder={question.placeholder || ""}
                  rows={4}
                  className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
                  required={question.required}
                  disabled={isSubmitting}
                />
              ) : (
                <input
                  type={question.fieldType}
                  id={`custom-${question.key}`}
                  value={customAnswers[question.key] || ""}
                  onChange={(e) =>
                    setCustomAnswers((prev) => ({
                      ...prev,
                      [question.key]: e.target.value,
                    }))
                  }
                  placeholder={question.placeholder || ""}
                  className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
                  required={question.required}
                  disabled={isSubmitting}
                />
              )}
            </div>
          ))}
        </>
      )}

      {(vis.submitterName || vis.email) && <SectionHeading label="About you" />}

      {/* Submitter Name */}
      {vis.submitterName && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            Your Name{req.submitterName ? "*" : " (Optional)"}
          </label>
          <input
            type="text"
            value={formData.submitterName}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                submitterName: e.target.value,
              }))
            }
            placeholder="Your name"
            className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
            required={req.submitterName}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Email */}
      {vis.email && (
        <div>
          <label className="block text-sm font-medium text-copy mb-1">
            Email{req.email ? "*" : " (Optional)"}
          </label>
          <div className="text-sm text-soft mb-2">
            Hidden and for hackathon notifications
          </div>
          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="your@email.com"
            className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
            required={req.email}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Hackathon Team Info */}
      {vis.teamInfo && (
        <div className="bg-canvas p-4 rounded-md border border-hairline">
          <h3 className="text-base font-medium text-ink mb-3">
            Hackathon Team Info{req.teamInfo ? "*" : " (Optional)"}
          </h3>

          <div className="space-y-4">
            {/* Team Name */}
            <div>
              <label
                className="block text-sm font-medium text-copy mb-1"
                htmlFor="teamName"
              >
                Team Name{req.teamInfo ? "*" : " (Optional)"}
              </label>
              <input
                type="text"
                id="teamName"
                placeholder="e.g., The Code Wizards"
                value={teamData.teamName}
                onChange={(e) =>
                  setTeamData((prev) => ({
                    ...prev,
                    teamName: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
                required={req.teamInfo}
                disabled={isSubmitting}
              />
            </div>

            {/* Team Size */}
            {teamData.teamName && (
              <div>
                <label
                  className="block text-sm font-medium text-copy mb-1"
                  htmlFor="teamSize"
                >
                  Team Size
                </label>
                <input
                  type="number"
                  id="teamSize"
                  min="1"
                  max="20"
                  placeholder="e.g., 4"
                  value={teamData.teamSize}
                  onChange={(e) =>
                    setTeamData((prev) => ({
                      ...prev,
                      teamSize: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Team Members */}
            {teamData.teamName && (
              <div>
                <label className="block text-sm font-medium text-copy mb-2">
                  Team Members (Optional)
                </label>
                <div className="space-y-2">
                  {teamData.teamMembers.map((member, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => {
                          const newMembers = [...teamData.teamMembers];
                          newMembers[index].name = e.target.value;
                          setTeamData((prev) => ({
                            ...prev,
                            teamMembers: newMembers,
                          }));
                        }}
                        className="flex-1 px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
                        disabled={isSubmitting}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={member.email}
                        onChange={(e) => {
                          const newMembers = [...teamData.teamMembers];
                          newMembers[index].email = e.target.value;
                          setTeamData((prev) => ({
                            ...prev,
                            teamMembers: newMembers,
                          }));
                        }}
                        className="flex-1 px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline"
                        disabled={isSubmitting}
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newMembers = teamData.teamMembers.filter(
                              (_, i) => i !== index,
                            );
                            setTeamData((prev) => ({
                              ...prev,
                              teamMembers: newMembers,
                            }));
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          disabled={isSubmitting}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTeamData((prev) => ({
                        ...prev,
                        teamMembers: [
                          ...prev.teamMembers,
                          { name: "", email: "" },
                        ],
                      }));
                    }}
                    className="w-full px-3 py-2 border border-hairline text-copy hover:bg-surface-hover rounded-md transition-colors flex items-center justify-center gap-2"
                    disabled={isSubmitting}
                  >
                    <Plus className="w-4 h-4" />
                    Add Team Member
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {vis.tags && (
        <>
          <SectionHeading label="Tags" />

          {/* Tags Section */}
          <div>
            <label className="block text-sm font-medium text-copy mb-2">
              Select Tags{req.tags ? " *" : " (Optional)"}
            </label>
            <span className="ml-2 text-xs text-copy">
              Select tags that best describe your app or hackathon participation
            </span>

            {/* Quick Select - Header Tags */}
            <div className="flex flex-wrap gap-2 mb-4 mt-3">
              {availableTags === undefined && (
                <span className="text-sm text-soft">Loading tags...</span>
              )}
              {availableTags
                ?.filter(
                  // A form-hidden required tag never renders as a quick-select
                  // button; it is still applied automatically on submit
                  (tag) =>
                    showRequiredTag ||
                    !requiredTagId ||
                    tag._id !== requiredTagId,
                )
                .map((tag) => (
                <button
                  key={tag._id}
                  type="button"
                  onClick={() => toggleTag(tag._id)}
                  disabled={
                    isSubmitting ||
                    !!(requiredTagId && tag._id === requiredTagId)
                  }
                  className={`px-3 py-1 rounded-md text-sm transition-colors border flex items-center gap-1 ${
                    selectedTagIds.includes(tag._id)
                      ? "bg-surface-alt text-ink border-hairline-strong"
                      : "bg-surface text-soft border-hairline-strong hover:border-hairline-strong hover:text-copy"
                  }`}
                  style={{
                    backgroundColor: selectedTagIds.includes(tag._id)
                      ? tag.backgroundColor || "var(--th-surface-alt)"
                      : "white",
                    color: selectedTagIds.includes(tag._id)
                      ? (tag.textColor ?? "var(--th-ink)")
                      : "var(--th-soft)",
                    borderColor: selectedTagIds.includes(tag._id)
                      ? tag.borderColor ||
                        (tag.backgroundColor
                          ? "transparent"
                          : "var(--th-hairline-strong)")
                      : "var(--th-hairline-strong)",
                  }}
                >
                  {tag.emoji && <span className="text-sm">{tag.emoji}</span>}
                  {tag.iconUrl && !tag.emoji && (
                    <img
                      src={tag.iconUrl}
                      alt=""
                      className="w-4 h-4 rounded-sm object-cover"
                    />
                  )}
                  {tag.name}
                </button>
              ))}
            </div>

            {/* Search All Tags Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-copy mb-2">
                Search All Available Tags
              </label>
              <span className="ml-2 text-xs text-copy mb-2 block">
                Find and select from all tags, including those not shown above
              </span>
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text"
                  value={dropdownSearchValue}
                  onChange={(e) => {
                    setDropdownSearchValue(e.target.value);
                    setShowDropdown(e.target.value.length > 0);
                  }}
                  onFocus={() =>
                    setShowDropdown(dropdownSearchValue.length > 0)
                  }
                  placeholder="Type to search for tags..."
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline text-sm"
                />

                {/* Dropdown Results */}
                {showDropdown && allTags && (
                  <div className="absolute z-10 w-full mt-1 bg-surface border border-hairline rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {(() => {
                      const searchTerm = dropdownSearchValue.toLowerCase();
                      const filteredTags = allTags
                        .filter(
                          (tag) =>
                            tag.name.toLowerCase().includes(searchTerm) &&
                            !selectedTagIds.includes(tag._id) &&
                            !newTagNames.some(
                              (newTag) =>
                                newTag.toLowerCase() === tag.name.toLowerCase(),
                            ),
                        )
                        .slice(0, 10);

                      if (filteredTags.length === 0) {
                        return (
                          <div className="px-3 py-2 text-sm text-soft">
                            No matching tags found
                          </div>
                        );
                      }

                      return filteredTags.map((tag) => (
                        <button
                          key={tag._id}
                          type="button"
                          onClick={() => handleSelectFromDropdown(tag._id)}
                          disabled={isSubmitting}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover focus:bg-surface-alt focus:outline-none flex items-center gap-2"
                        >
                          {tag.emoji && (
                            <span className="text-sm">{tag.emoji}</span>
                          )}
                          {tag.iconUrl && !tag.emoji && (
                            <img
                              src={tag.iconUrl}
                              alt=""
                              className="w-4 h-4 rounded-sm object-cover"
                            />
                          )}
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor:
                                tag.backgroundColor || "var(--th-surface-alt)",
                              color: tag.textColor || "var(--th-copy)",
                              border: `1px solid ${tag.backgroundColor ? "transparent" : "var(--th-hairline-strong)"}`,
                            }}
                          >
                            {tag.name}
                          </span>
                          {tag.isHidden && (
                            <span className="text-xs text-faint">(Hidden)</span>
                          )}
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Create New Tag */}
            <label className="block text-sm font-medium text-copy mb-2">
              Add New Tags (optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTagInputValue}
                onChange={(e) => setNewTagInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewTag();
                  }
                }}
                maxLength={maxTagLength}
                placeholder={
                  countedTags >= maxTags
                    ? `Maximum ${maxTags} tags reached`
                    : "Enter new tag name..."
                }
                disabled={isSubmitting || countedTags >= maxTags}
                className="flex-1 px-3 py-2 bg-surface rounded-md text-copy focus:outline-none focus:ring-1 focus:ring-ink border border-hairline text-sm"
              />
              <button
                type="button"
                onClick={handleAddNewTag}
                disabled={
                  !newTagInputValue.trim() ||
                  isSubmitting ||
                  countedTags >= maxTags
                }
                className="px-3 py-1 bg-surface-alt text-copy rounded-md hover:bg-surface-hover transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* Tag Selection Hints */}
            {req.tags &&
              selectedTagIds.length === 0 &&
              newTagNames.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Please select or add at least one tag.
                </p>
              )}
            {countedTags >= maxTags && (
              <p className="text-xs text-amber-600 mt-1">
                Maximum of {maxTags} tags reached. Remove a tag to add another.
              </p>
            )}
          </div>

          {/* Selected Tags - Always Visible */}
          <div className="p-4 bg-canvas rounded-md border border-hairline">
            <div className="text-sm font-medium text-copy mb-3">
              Selected Tags ({countedTags}/{maxTags})
            </div>
            {selectedTagIds.filter(
              (id) =>
                showRequiredTag || !requiredTagId || id !== requiredTagId,
            ).length > 0 || newTagNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {/* Show selected existing tags */}
                {allTags &&
                  selectedTagIds.map((tagId) => {
                    const tag =
                      availableTags?.find((t) => t._id === tagId) ||
                      allTags.find((t) => t._id === tagId);
                    if (!tag) return null;
                    const isRequired = requiredTagId && tagId === requiredTagId;
                    // Form-hidden required tag stays out of the visible pills
                    if (isRequired && !showRequiredTag) return null;

                    return (
                      <span
                        key={tag._id}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm border transition-colors"
                        style={{
                          backgroundColor:
                            tag.backgroundColor || "var(--th-surface-alt)",
                          color: tag.textColor || "var(--th-ink)",
                          borderColor: tag.backgroundColor
                            ? "transparent"
                            : "var(--th-hairline-strong)",
                        }}
                      >
                        {tag.emoji && (
                          <span className="text-sm">{tag.emoji}</span>
                        )}
                        {tag.iconUrl && !tag.emoji && (
                          <img
                            src={tag.iconUrl}
                            alt=""
                            className="w-4 h-4 rounded-sm object-cover"
                          />
                        )}
                        {tag.name}
                        {tag.isHidden && (
                          <span className="text-xs opacity-70">(Hidden)</span>
                        )}
                        {isRequired && (
                          <span title="Required tag">
                            <Lock className="w-3 h-3 ml-1 opacity-50" />
                          </span>
                        )}
                      </span>
                    );
                  })}

                {/* Show new tags being created */}
                {newTagNames.map((tagName) => (
                  <span
                    key={tagName}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm border border-blue-200"
                  >
                    {tagName}
                    <span className="text-xs opacity-70">(New)</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-faint">
                No tags selected yet. Please select tags above.
              </p>
            )}
          </div>
        </>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-cta hover:bg-cta-hover h-11 text-[15px]"
      >
        {isSubmitting ? "Submitting..." : "Submit App"}
      </Button>
    </form>
  );
}
