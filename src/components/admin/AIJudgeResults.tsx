import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  Github,
  Globe,
  BarChart3,
  FileText,
  ListOrdered,
  Copy,
  Download,
  Users,
  Video,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { SimpleSelect } from "../ui/SimpleSelect";
import { useDialog } from "../../hooks/useDialog";

// Rendered inside the group workspace; the workspace header and sidebar
// provide navigation, so this component has no back button.
interface AIJudgeResultsProps {
  groupId: Id<"judgingGroups">;
  groupName: string;
}

type CriteriaScore = {
  key: string;
  label: string;
  score: number;
  reasoning: string;
};

// Features that count as "advanced" Convex usage for the stats rollup
const ADVANCED_FEATURE_REGEX =
  /schedul|cron|file storage|storage|full.?text|search|vector|http action|component|agent|workflow|workpool|aggregate/i;

// Display labels for detected frontend hosting platforms (keys match
// AI_FRONTEND_PLATFORMS in convex/aiJudge.ts)
const FRONTEND_PLATFORM_LABELS: Record<string, string> = {
  "codex-sites": "Codex Sites",
  "convex-hosting": "Convex hosting",
  vercel: "Vercel",
  netlify: "Netlify",
  other: "Other host",
};

type StatsResult = {
  status: string;
  averageScore?: number;
  criteriaScores?: Array<CriteriaScore>;
  convexFeaturesDetected?: Array<string>;
  componentsDetected?: Array<string>;
  urlCheck?: { isLive: boolean };
  sourcesUsed?: {
    github: boolean;
    liveUrl: boolean;
    videoTranscript?: boolean;
  };
};

// Rollup numbers for the Stats tab and the report overview
function computeStats(results: Array<StatsResult>) {
  const completed = results.filter((r) => r.status === "completed");

  const usesConvex = (r: StatsResult) =>
    (r.convexFeaturesDetected?.length ?? 0) > 0;
  const usesAdvanced = (r: StatsResult) =>
    (r.convexFeaturesDetected || []).some((f) =>
      ADVANCED_FEATURE_REGEX.test(f),
    ) ||
    (r.criteriaScores || []).some(
      (cs) => cs.key === "advanced" && cs.score >= 6,
    );

  const scores = completed
    .map((r) => r.averageScore)
    .filter((s): s is number => s !== undefined);
  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10
      : 0;

  // Count each detected feature (case-insensitive) for the top features list
  const featureCounts = new Map<string, number>();
  for (const r of completed) {
    for (const feature of r.convexFeaturesDetected || []) {
      const key = feature.trim().toLowerCase();
      if (!key) continue;
      featureCounts.set(key, (featureCounts.get(key) || 0) + 1);
    }
  }
  const topFeatures = [...featureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Components detected from package.json / convex.config.ts (new runs only);
  // older results fall back to feature strings mentioning "component"
  const usesComponents = (r: StatsResult) =>
    (r.componentsDetected?.length ?? 0) > 0 ||
    (r.convexFeaturesDetected || []).some((f) => /component/i.test(f));
  const componentCounts = new Map<string, number>();
  for (const r of completed) {
    for (const component of r.componentsDetected || []) {
      const key = component.trim().toLowerCase();
      if (!key) continue;
      componentCounts.set(key, (componentCounts.get(key) || 0) + 1);
    }
  }
  const componentsUsed = [...componentCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  // Average-score distribution bands for the mini chart
  const bands = [
    { label: "9-10", min: 9, max: 10.01, count: 0 },
    { label: "7-8.9", min: 7, max: 9, count: 0 },
    { label: "5-6.9", min: 5, max: 7, count: 0 },
    { label: "3-4.9", min: 3, max: 5, count: 0 },
    { label: "1-2.9", min: 0, max: 3, count: 0 },
  ];
  for (const s of scores) {
    const band = bands.find((b) => s >= b.min && s < b.max);
    if (band) band.count++;
  }

  return {
    total: results.length,
    completed: completed.length,
    usingConvex: completed.filter(usesConvex).length,
    advancedConvex: completed.filter(usesAdvanced).length,
    usingComponents: completed.filter(usesComponents).length,
    componentsUsed,
    liveApps: completed.filter((r) => r.urlCheck?.isLive).length,
    urlChecked: completed.filter((r) => r.urlCheck !== undefined).length,
    reposAnalyzed: completed.filter((r) => r.sourcesUsed?.github).length,
    averageScore,
    topFeatures,
    bands,
  };
}

type ReportSubmission = {
  title: string;
  slug: string;
  url?: string;
  githubUrl?: string;
  teamName?: string;
  teamMemberCount?: number;
  teamMembers?: Array<{ name: string; email: string }>;
  submitterName?: string;
  status: string;
  criteriaScores?: Array<CriteriaScore>;
  totalScore?: number;
  averageScore?: number;
  overallReasoning?: string;
  convexFeaturesDetected?: Array<string>;
  componentsDetected?: Array<string>;
  urlCheck?: {
    checkedUrl?: string;
    isLive: boolean;
    statusCode?: number;
    note: string;
  };
  sourcesUsed?: {
    github: boolean;
    liveUrl: boolean;
    videoTranscript?: boolean;
  };
  error?: string;
};

// Escape pipes so titles and notes don't break markdown tables
function mdCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

// Build the full hackathon report as markdown (pastes into Notion/Google Docs)
function buildHackathonReport(
  data: {
    groupName: string;
    groupDescription?: string;
    submissions: Array<ReportSubmission>;
  },
  origin: string,
): string {
  const completed = data.submissions.filter((s) => s.status === "completed");
  const failed = data.submissions.filter((s) => s.status === "failed");
  const stats = computeStats(data.submissions);

  const teams = new Map<string, Array<ReportSubmission>>();
  const solo: Array<ReportSubmission> = [];
  for (const s of data.submissions) {
    if (s.teamName) {
      const list = teams.get(s.teamName) || [];
      list.push(s);
      teams.set(s.teamName, list);
    } else {
      solo.push(s);
    }
  }
  const listedMembers = data.submissions.reduce(
    (sum, s) => sum + (s.teamMembers?.length ?? 0),
    0,
  );

  const lines: Array<string> = [];
  lines.push(`# ${data.groupName}: Best Use of Convex AI Review Report`);
  lines.push("");
  lines.push(
    `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} by the vibeapps AI Judge. Scores were produced by an AI review of each submission's GitHub repository and live app, and may have been adjusted by event admins.`,
  );
  if (data.groupDescription) {
    lines.push("");
    lines.push(`> ${data.groupDescription}`);
  }

  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Submissions in group | ${data.submissions.length} |`);
  lines.push(`| AI reviews completed | ${stats.completed} |`);
  lines.push(`| Apps using Convex | ${stats.usingConvex} |`);
  lines.push(
    `| Apps using advanced Convex features | ${stats.advancedConvex} |`,
  );
  lines.push(
    `| Apps using Convex components | ${stats.usingComponents}${stats.componentsUsed.length > 0 ? ` (${stats.componentsUsed.length} distinct: ${stats.componentsUsed.map(([name]) => name).join(", ")})` : ""} |`,
  );
  lines.push(
    `| Live apps at review time | ${stats.liveApps} of ${stats.urlChecked} checked |`,
  );
  lines.push(`| GitHub repos analyzed | ${stats.reposAnalyzed} |`);
  lines.push(`| Average score | ${stats.averageScore}/10 |`);

  lines.push("");
  lines.push("## Participation");
  lines.push("");
  lines.push(
    `- ${data.submissions.length} submission${data.submissions.length === 1 ? "" : "s"} from ${teams.size} team${teams.size === 1 ? "" : "s"} and ${solo.length} solo builder${solo.length === 1 ? "" : "s"}`,
  );
  if (listedMembers > 0) {
    lines.push(
      `- ${listedMembers} listed team member${listedMembers === 1 ? "" : "s"}`,
    );
  }

  lines.push("");
  lines.push("## Rankings");
  lines.push("");
  lines.push(
    "| Rank | Submission | Team | Score | Live app | GitHub | Convex features |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  completed.forEach((s, index) => {
    const submissionLink = `[${mdCell(s.title)}](${origin}/s/${s.slug})`;
    const team = s.teamName
      ? mdCell(s.teamName)
      : s.submitterName
        ? mdCell(s.submitterName)
        : "-";
    const score =
      s.averageScore !== undefined ? `${s.averageScore.toFixed(1)}/10` : "-";
    const live = s.url
      ? `[${s.urlCheck ? (s.urlCheck.isLive ? "Live" : s.urlCheck.statusCode === 404 ? "404" : "Down") : "Link"}](${s.url})`
      : "-";
    const github = s.githubUrl ? `[Repo](${s.githubUrl})` : "-";
    const features = mdCell((s.convexFeaturesDetected || []).join(", ")) || "-";
    lines.push(
      `| ${index + 1} | ${submissionLink} | ${team} | ${score} | ${live} | ${github} | ${features} |`,
    );
  });

  if (teams.size > 0 || solo.length > 0) {
    lines.push("");
    lines.push("## Teams and builders");
    lines.push("");
    for (const [teamName, teamSubs] of teams) {
      const members = teamSubs
        .flatMap((s) => s.teamMembers || [])
        .map((m) => m.name)
        .filter((name, idx, arr) => arr.indexOf(name) === idx);
      const memberText = members.length > 0 ? `: ${members.join(", ")}` : "";
      const titles = teamSubs.map((s) => `*${mdCell(s.title)}*`).join(", ");
      const memberCount = teamSubs[0].teamMemberCount ?? (members.length || 1);
      lines.push(
        `- **${mdCell(teamName)}** (${memberCount} member${memberCount === 1 ? "" : "s"})${memberText}, built ${titles}`,
      );
    }
    for (const s of solo) {
      lines.push(
        `- ${s.submitterName ? mdCell(s.submitterName) : "Unknown builder"}, built *${mdCell(s.title)}*`,
      );
    }
  }

  lines.push("");
  lines.push("## Submission details");
  completed.forEach((s, index) => {
    lines.push("");
    lines.push(
      `### ${index + 1}. ${s.title}${s.averageScore !== undefined ? ` (${s.averageScore.toFixed(1)}/10)` : ""}`,
    );
    lines.push("");
    const links: Array<string> = [`[Submission](${origin}/s/${s.slug})`];
    if (s.url) links.push(`[Live app](${s.url})`);
    if (s.githubUrl) links.push(`[GitHub](${s.githubUrl})`);
    lines.push(`- Links: ${links.join(" · ")}`);
    if (s.teamName) {
      const members = (s.teamMembers || []).map((m) => m.name).join(", ");
      lines.push(`- Team: ${s.teamName}${members ? ` (${members})` : ""}`);
    } else if (s.submitterName) {
      lines.push(`- Builder: ${s.submitterName}`);
    }
    if (s.urlCheck) {
      lines.push(
        `- Live app status: ${s.urlCheck.isLive ? "live" : `not working (${s.urlCheck.note})`}`,
      );
    }
    if (s.convexFeaturesDetected && s.convexFeaturesDetected.length > 0) {
      lines.push(`- Convex features: ${s.convexFeaturesDetected.join(", ")}`);
    }
    if (s.componentsDetected && s.componentsDetected.length > 0) {
      lines.push(`- Convex components: ${s.componentsDetected.join(", ")}`);
    }
    if (s.criteriaScores && s.criteriaScores.length > 0) {
      lines.push(
        `- Scores: ${s.criteriaScores.map((cs) => `${cs.label} ${cs.score}/10`).join(" · ")}`,
      );
    }
    if (s.overallReasoning) {
      lines.push(`- AI note: ${s.overallReasoning}`);
    }
  });

  if (failed.length > 0) {
    lines.push("");
    lines.push("## Reviews that could not complete");
    lines.push("");
    for (const s of failed) {
      lines.push(`- ${s.title}${s.error ? `: ${mdCell(s.error)}` : ""}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// Lazy viewer for the stored video transcript: the markdown is only fetched
// when an organizer opens the section, so the results list stays light.
function VideoTranscriptSection({
  groupId,
  storyId,
}: {
  groupId: Id<"judgingGroups">;
  storyId: Id<"stories">;
}) {
  const [open, setOpen] = useState(false);
  const transcript = useQuery(
    api.videoTranscripts.getTranscriptForStory,
    open ? { groupId, storyId } : "skip",
  );

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-copy"
      >
        <Video className="w-3.5 h-3.5" />
        Video Transcript
        <span className="text-xs font-normal text-faint">
          what the judge read, unverified builder narrative
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>
      {open && (
        <div className="mt-2">
          {transcript === undefined ? (
            <p className="text-xs text-faint">Loading transcript...</p>
          ) : transcript === null ? (
            <p className="text-xs text-faint">
              No transcript is stored for this submission.
            </p>
          ) : (
            <div className="bg-surface-alt border border-hairline rounded-md p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-soft">
                {transcript.title && (
                  <span className="font-medium text-ink">
                    {transcript.title}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded-full border bg-surface border-hairline">
                  {transcript.kind}
                </span>
                <span className="px-1.5 py-0.5 rounded-full border bg-surface border-hairline">
                  {transcript.status.replace(/_/g, " ")}
                </span>
                <span className="px-1.5 py-0.5 rounded-full border bg-surface border-hairline">
                  via{" "}
                  {transcript.provider === "contextdev"
                    ? "Context.dev"
                    : "Firecrawl"}
                </span>
                <a
                  href={transcript.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-copy underline"
                >
                  open video
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {transcript.errorMessage && (
                <p className="text-xs text-red-700">
                  {transcript.errorMessage}
                </p>
              )}
              {transcript.markdown ? (
                <pre className="text-xs text-copy whitespace-pre-wrap max-h-72 overflow-y-auto font-sans">
                  {transcript.markdown}
                </pre>
              ) : (
                <p className="text-xs text-faint">
                  No markdown content was captured
                  {transcript.status === "no_transcript"
                    ? " (the video has no captions)."
                    : "."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AIJudgeResults({ groupId, groupName }: AIJudgeResultsProps) {
  const data = useQuery(api.aiJudge.getGroupAiResults, { groupId });
  const startReview = useMutation(api.aiJudge.startReview);
  const retrySubmission = useMutation(api.aiJudge.retrySubmission);
  const updateResultScore = useMutation(api.aiJudge.updateResultScore);
  const { showMessage, DialogComponents } = useDialog();

  const [isStarting, setIsStarting] = useState(false);
  const [expandedId, setExpandedId] = useState<Id<"aiJudgeResults"> | null>(
    null,
  );
  const [editingId, setEditingId] = useState<Id<"aiJudgeResults"> | null>(null);
  const [editScores, setEditScores] = useState<Array<CriteriaScore>>([]);
  const [editOverall, setEditOverall] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<"results" | "stats" | "report">(
    "results",
  );
  // Build-timeline filter (Phase 3): all / built in window / started before
  const [timelineFilter, setTimelineFilter] = useState<
    "all" | "in_window" | "started_before"
  >("all");
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  const isRunning =
    (data?.counts.pending ?? 0) > 0 || (data?.counts.running ?? 0) > 0;

  // Stats need at least one completed review; the report needs the full run done
  const statsReady = (data?.counts.completed ?? 0) > 0;
  const reportReady = !isRunning && (data?.counts.completed ?? 0) > 0;

  // Report data (team info included) is admin-only and fetched lazily
  const reportData = useQuery(
    api.aiJudge.getGroupAiReportData,
    activeTab === "report" && reportReady ? { groupId } : "skip",
  );

  const handleGenerateReport = () => {
    if (!reportData) return;
    setReportMarkdown(buildHackathonReport(reportData, window.location.origin));
  };

  const handleCopyReport = async () => {
    if (!reportMarkdown) return;
    try {
      await navigator.clipboard.writeText(reportMarkdown);
    } catch {
      // Clipboard API unavailable: fall back to a temporary textarea
      const textarea = document.createElement("textarea");
      textarea.value = reportMarkdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!reportMarkdown || !reportData) return;
    const blob = new Blob([reportMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportData.groupSlug}-ai-hackathon-report.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStartReview = async () => {
    setIsStarting(true);
    try {
      const result = await startReview({ groupId });
      showMessage(
        "AI Review Started",
        `Queued ${result.queued} submission${result.queued === 1 ? "" : "s"} for AI review. Results appear here as each submission completes.`,
        "success",
      );
    } catch (error) {
      showMessage(
        "Could Not Start AI Review",
        error instanceof Error
          ? error.message
              .replace(/^\[.*?\]\s*/, "")
              .replace(/^Uncaught Error:\s*/, "")
          : "Please try again.",
        "error",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleRetry = async (resultId: Id<"aiJudgeResults">) => {
    try {
      await retrySubmission({ resultId });
    } catch (error) {
      showMessage(
        "Retry Failed",
        error instanceof Error ? error.message : "Please try again.",
        "error",
      );
    }
  };

  const startEditing = (result: {
    _id: Id<"aiJudgeResults">;
    criteriaScores?: Array<CriteriaScore>;
    overallReasoning?: string;
  }) => {
    setEditingId(result._id);
    setEditScores(result.criteriaScores ? [...result.criteriaScores] : []);
    setEditOverall(result.overallReasoning || "");
    setExpandedId(result._id);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditScores([]);
    setEditOverall("");
  };

  const saveEditing = async () => {
    if (!editingId) return;
    setIsSavingEdit(true);
    try {
      await updateResultScore({
        resultId: editingId,
        criteriaScores: editScores,
        overallReasoning: editOverall,
      });
      cancelEditing();
    } catch (error) {
      showMessage(
        "Save Failed",
        error instanceof Error ? error.message : "Please try again.",
        "error",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            Completed
          </span>
        );
      case "running":
        return (
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Reviewing
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs bg-surface-alt text-copy rounded-full">
            Pending
          </span>
        );
    }
  };

  const completedResults = (data?.results || []).filter(
    (r) => r.status === "completed",
  );

  // Rank numbers come from the full ranked list so filtering never renumbers
  const rankById = new Map(
    (data?.results || []).map((r, index) => [r._id, index + 1]),
  );
  const visibleResults = (data?.results || []).filter((r) => {
    if (timelineFilter === "all") return true;
    return r.gitFacts?.builtDuringEvent === timelineFilter;
  });

  // Short date for timeline facts
  const shortDate = (ts?: number) =>
    ts
      ? new Date(ts).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "n/a";

  return (
    <div className="space-y-6">
      {/* Header: title left, run action right; navigation lives in the workspace */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-copy flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          AI Judge: Best Use of Convex
        </h2>
        <Button
          onClick={handleStartReview}
          disabled={isStarting || isRunning}
          className="bg-cta hover:bg-cta-hover"
        >
          {isStarting || isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isRunning ? "Review in progress..." : "Starting..."}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {completedResults.length > 0
                ? "Re-run AI Review"
                : "Run AI Review"}
            </>
          )}
        </Button>
      </div>

      {data === undefined && <div>Loading AI results...</div>}

      {data && (
        <>
          {/* Progress counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                {
                  label: "Pending",
                  value: data.counts.pending,
                  color: "text-copy",
                },
                {
                  label: "Reviewing",
                  value: data.counts.running,
                  color: "text-blue-600",
                },
                {
                  label: "Completed",
                  value: data.counts.completed,
                  color: "text-green-600",
                },
                {
                  label: "Failed",
                  value: data.counts.failed,
                  color: "text-red-600",
                },
              ] as const
            ).map((stat) => (
              <div
                key={stat.label}
                className="bg-surface p-4 rounded-lg border border-hairline"
              >
                <p className="text-sm text-soft">{stat.label}</p>
                <p className={`text-2xl font-semibold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Tabs: results / stats / hackathon report */}
          <div className="flex items-center gap-1 border-b border-hairline">
            <button
              onClick={() => setActiveTab("results")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "results"
                  ? "border-ink text-ink"
                  : "border-transparent text-soft hover:text-copy"
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              Results
            </button>
            <button
              onClick={() => statsReady && setActiveTab("stats")}
              disabled={!statsReady}
              title={
                statsReady
                  ? "Review stats"
                  : "Available after at least one review completes"
              }
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "stats"
                  ? "border-ink text-ink"
                  : statsReady
                    ? "border-transparent text-soft hover:text-copy"
                    : "border-transparent text-faint cursor-not-allowed"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </button>
            <button
              onClick={() => reportReady && setActiveTab("report")}
              disabled={!reportReady}
              title={
                reportReady
                  ? "Generate the hackathon report"
                  : "Available after every submission has been reviewed"
              }
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "report"
                  ? "border-ink text-ink"
                  : reportReady
                    ? "border-transparent text-soft hover:text-copy"
                    : "border-transparent text-faint cursor-not-allowed"
              }`}
            >
              <FileText className="w-4 h-4" />
              Hackathon Report
            </button>
          </div>

          {activeTab === "stats" && statsReady && (
            <StatsPanel groupName={groupName} results={data.results} />
          )}

          {activeTab === "report" && reportReady && (
            <div className="space-y-4">
              {/* Generate + export actions */}
              <div className="bg-surface rounded-lg border border-hairline p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-ink">
                    AI Hackathon Report
                  </h3>
                  <p className="text-xs text-soft mt-0.5">
                    Markdown report with rankings, GitHub and live app links,
                    teams, and participation. Paste into Notion or Google Docs,
                    or download as a .md file.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleGenerateReport}
                    disabled={reportData === undefined}
                    className="bg-cta hover:bg-cta-hover"
                  >
                    {reportData === undefined ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading data...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        {reportMarkdown
                          ? "Regenerate Report"
                          : "Generate Report"}
                      </>
                    )}
                  </Button>
                  {reportMarkdown && (
                    <>
                      <Button variant="outline" onClick={handleCopyReport}>
                        {reportCopied ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Markdown
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleDownloadReport}>
                        <Download className="w-4 h-4 mr-2" />
                        Download .md
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Report preview */}
              {reportMarkdown ? (
                <div className="bg-surface rounded-lg border border-hairline p-4">
                  <pre className="whitespace-pre-wrap text-sm text-ink font-mono max-h-[36rem] overflow-y-auto">
                    {reportMarkdown}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-10 text-soft bg-surface rounded-lg border border-hairline">
                  <Users className="w-12 h-12 mx-auto mb-4 text-faint" />
                  <p className="text-lg font-medium mb-2">
                    Ready to build the report
                  </p>
                  <p className="text-sm max-w-md mx-auto">
                    Every submission has been reviewed. Generate the report to
                    get submission counts, team participation, rankings, and
                    per-submission links in one shareable markdown document.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "results" && data.results.length === 0 && (
            <div className="text-center py-8 text-soft bg-surface rounded-lg border border-hairline">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-faint" />
              <p className="text-lg font-medium mb-2">No AI reviews yet</p>
              <p className="text-sm">
                Run the AI review to score every submission in this group on
                Best Use of Convex.
              </p>
            </div>
          )}

          {/* Ranked results */}
          {activeTab === "results" && data.results.length > 0 && (
            <div className="space-y-3">
              {/* Build-timeline filter */}
              <div className="flex items-center justify-end gap-2">
                <label htmlFor="timeline-filter" className="text-xs text-soft">
                  Build timeline
                </label>
                <SimpleSelect
                  id="timeline-filter"
                  value={timelineFilter}
                  onChange={(value) =>
                    setTimelineFilter(
                      value as "all" | "in_window" | "started_before",
                    )
                  }
                  className="w-auto h-auto px-2 py-1.5 text-xs gap-1"
                  options={[
                    { value: "all", label: "All submissions" },
                    { value: "in_window", label: "Built in event window" },
                    {
                      value: "started_before",
                      label: "Started before event",
                    },
                  ]}
                />
              </div>
              {visibleResults.length === 0 && (
                <p className="text-sm text-soft bg-surface rounded-lg border border-hairline p-4">
                  No submissions match this timeline filter.
                </p>
              )}
              {visibleResults.map((result) => {
                const index = (rankById.get(result._id) ?? 1) - 1;
                const isExpanded = expandedId === result._id;
                const isEditing = editingId === result._id;
                return (
                  <div
                    key={result._id}
                    className="bg-surface rounded-lg border border-hairline"
                  >
                    {/* Row header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {result.status === "completed" && (
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-alt text-copy flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`/s/${result.storySlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-ink hover:underline truncate"
                            >
                              {result.storyTitle}
                            </a>
                            <ExternalLink className="w-3.5 h-3.5 text-faint flex-shrink-0" />
                            {statusBadge(result.status)}
                            {result.editedAt && (
                              <span className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded-full">
                                Edited by admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-soft">
                            {result.sourcesUsed && (
                              <>
                                <span
                                  className={`inline-flex items-center gap-1 ${result.sourcesUsed.github ? "text-green-600" : "text-faint"}`}
                                  title={
                                    result.sourcesUsed.github
                                      ? "GitHub repo was analyzed"
                                      : "GitHub repo was not accessible"
                                  }
                                >
                                  <Github className="w-3 h-3" />
                                  {result.sourcesUsed.github
                                    ? "repo"
                                    : "no repo"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 ${result.sourcesUsed.liveUrl ? "text-green-600" : "text-faint"}`}
                                  title={
                                    result.sourcesUsed.liveUrl
                                      ? "Live site was scraped"
                                      : "Live site was not scraped"
                                  }
                                >
                                  <Globe className="w-3 h-3" />
                                  {result.sourcesUsed.liveUrl
                                    ? "site"
                                    : "no site"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 ${result.sourcesUsed.videoTranscript ? "text-green-600" : "text-faint"}`}
                                  title={
                                    result.sourcesUsed.videoTranscript
                                      ? "Video transcript/content was included in the review"
                                      : "No video transcript was available for this review"
                                  }
                                >
                                  <Video className="w-3 h-3" />
                                  {result.sourcesUsed.videoTranscript
                                    ? "video"
                                    : "no video"}
                                </span>
                              </>
                            )}
                            {result.urlCheck && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${
                                  result.urlCheck.isLive
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                                title={`Live app URL check: ${result.urlCheck.note}${result.urlCheck.checkedUrl ? ` (${result.urlCheck.checkedUrl})` : ""}`}
                              >
                                {result.urlCheck.isLive
                                  ? "URL live"
                                  : result.urlCheck.statusCode === 404
                                    ? "URL 404"
                                    : result.urlCheck.checkedUrl
                                      ? "URL down"
                                      : "no URL"}
                              </span>
                            )}
                            {result.frontendHosting && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-surface-alt text-soft border-hairline"
                                title={`Frontend hosting detected: ${result.frontendHosting.evidence}. The platform's weight multiplies the frontend checker score in the weighted ranking.`}
                              >
                                {FRONTEND_PLATFORM_LABELS[
                                  result.frontendHosting.platform
                                ] ?? result.frontendHosting.platform}
                              </span>
                            )}
                            {result.hackathonLogEvent && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-surface-alt text-soft border-hairline"
                                title="Event named in this submission's hackathon.md header. Self-reported, informational only; never used to route, match, or score."
                              >
                                {result.hackathonLogEvent}
                              </span>
                            )}
                            {(result.logDiscrepancies?.length ?? 0) > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200"
                                title={`hackathon.md claims that do not match detected facts (recorded only, never scored):\n${(result.logDiscrepancies ?? []).join("\n")}`}
                              >
                                {result.logDiscrepancies?.length} log{" "}
                                {result.logDiscrepancies?.length === 1
                                  ? "discrepancy"
                                  : "discrepancies"}
                              </span>
                            )}
                            {result.repoAccess === "private_or_missing" && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200"
                                title="The GitHub repo returned 404: it is private or was deleted. Repo-based criteria were capped."
                              >
                                repo private/missing
                              </span>
                            )}
                            {result.gitFacts?.isFork && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200"
                                title={`Forked from ${result.gitFacts.parentRepo || "another repo"}`}
                              >
                                fork
                              </span>
                            )}
                            {result.gitFacts?.builtDuringEvent ===
                              "in_window" && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200"
                                title="First commit falls inside the event window. Commit dates can be rewritten with force-push, so treat this as a strong signal, not proof."
                              >
                                built in window
                              </span>
                            )}
                            {result.gitFacts?.builtDuringEvent ===
                              "started_before" && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200"
                                title="First commit predates the event window. Commit dates can be rewritten with force-push, so verify before disqualifying."
                              >
                                started before
                              </span>
                            )}
                            {result.judgeProvider && (
                              <span title={result.judgeModel}>
                                via {result.judgeProvider}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {result.status === "completed" &&
                          result.averageScore !== undefined && (
                            <div className="text-right">
                              <p className="text-lg font-semibold text-ink">
                                {result.averageScore.toFixed(1)}
                                <span className="text-sm text-faint">/10</span>
                              </p>
                              <p className="text-xs text-soft">
                                total {result.totalScore}
                                {result.weightedScore !== undefined &&
                                  result.weightedScore !==
                                    result.totalScore && (
                                    <span title="Weighted total using this group's rubric weights; ranking uses this value.">
                                      {" "}
                                      / weighted {result.weightedScore}
                                    </span>
                                  )}
                              </p>
                            </div>
                          )}
                        {result.status === "failed" && (
                          <button
                            onClick={() => handleRetry(result._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-copy hover:text-ink bg-surface hover:bg-surface-hover rounded-lg border border-hairline hover:border-hairline-strong transition-all font-medium"
                            title="Retry AI review for this submission"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                          </button>
                        )}
                        {result.status === "completed" && (
                          <button
                            onClick={() =>
                              setExpandedId(isExpanded ? null : result._id)
                            }
                            className="p-2 text-soft hover:text-copy hover:bg-surface-hover rounded-lg transition-colors"
                            title={isExpanded ? "Collapse" : "Expand details"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Failed error message */}
                    {result.status === "failed" && result.error && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                          {result.error}
                        </p>
                      </div>
                    )}

                    {/* Expanded details */}
                    {isExpanded && result.status === "completed" && (
                      <div className="border-t border-hairline p-4 space-y-4">
                        {/* Edit toggle */}
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-ink">
                            Criteria Scores
                          </h4>
                          {!isEditing ? (
                            <button
                              onClick={() => startEditing(result)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-copy hover:text-ink bg-surface hover:bg-surface-hover rounded-lg border border-hairline hover:border-hairline-strong transition-all font-medium"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit Scores
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={saveEditing}
                                disabled={isSavingEdit}
                                className="bg-cta hover:bg-cta-hover"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                {isSavingEdit ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                disabled={isSavingEdit}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Criteria */}
                        <div className="space-y-3">
                          {(isEditing
                            ? editScores
                            : result.criteriaScores || []
                          ).map((cs, csIndex) => (
                            <div
                              key={cs.key}
                              className="bg-surface-alt border border-hairline rounded-md p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-ink">
                                  {cs.label}
                                </p>
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    {Array.from(
                                      { length: 10 },
                                      (_, i) => i + 1,
                                    ).map((score) => (
                                      <button
                                        key={score}
                                        type="button"
                                        onClick={() =>
                                          setEditScores((prev) =>
                                            prev.map((item, idx) =>
                                              idx === csIndex
                                                ? { ...item, score }
                                                : item,
                                            ),
                                          )
                                        }
                                        className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${
                                          cs.score === score
                                            ? "bg-cta text-on-cta border-ink"
                                            : "bg-surface text-copy border-hairline hover:border-hairline-strong"
                                        }`}
                                      >
                                        {score}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm font-semibold text-ink">
                                    {cs.score}/10
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="mt-2">
                                  <Label
                                    htmlFor={`reasoning-${result._id}-${cs.key}`}
                                    className="text-xs text-soft"
                                  >
                                    Reasoning
                                  </Label>
                                  <Textarea
                                    id={`reasoning-${result._id}-${cs.key}`}
                                    value={cs.reasoning}
                                    onChange={(e) =>
                                      setEditScores((prev) =>
                                        prev.map((item, idx) =>
                                          idx === csIndex
                                            ? {
                                                ...item,
                                                reasoning: e.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    rows={2}
                                    className="mt-1"
                                  />
                                </div>
                              ) : (
                                cs.reasoning && (
                                  <p className="text-sm text-copy mt-2">
                                    {cs.reasoning}
                                  </p>
                                )
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Overall reasoning */}
                        <div>
                          <h4 className="text-sm font-medium text-ink mb-1">
                            Overall Note
                          </h4>
                          {isEditing ? (
                            <Textarea
                              value={editOverall}
                              onChange={(e) => setEditOverall(e.target.value)}
                              rows={3}
                            />
                          ) : (
                            <p className="text-sm text-copy">
                              {result.overallReasoning || "No overall note."}
                            </p>
                          )}
                        </div>

                        {/* Convex features detected */}
                        {result.convexFeaturesDetected &&
                          result.convexFeaturesDetected.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-ink mb-2">
                                Convex Features Detected
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {result.convexFeaturesDetected.map(
                                  (feature) => (
                                    <span
                                      key={feature}
                                      className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full"
                                    >
                                      {feature}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {/* Components: installed vs actually used (Phase 1) */}
                        {((result.componentsDetected?.length ?? 0) > 0 ||
                          (result.componentsUsed?.length ?? 0) > 0) && (
                          <div>
                            <h4 className="text-sm font-medium text-ink mb-2">
                              Convex Components
                            </h4>
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-soft w-16">
                                  Used
                                </span>
                                {(result.componentsUsed?.length ?? 0) > 0 ? (
                                  result.componentsUsed?.map((component) => (
                                    <span
                                      key={component}
                                      className="px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full"
                                      title="Referenced in code (components.* usage found)"
                                    >
                                      {component}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-faint">
                                    none referenced in code
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-soft w-16">
                                  Installed
                                </span>
                                {(result.componentsDetected?.length ?? 0) >
                                0 ? (
                                  result.componentsDetected?.map(
                                    (component) => (
                                      <span
                                        key={component}
                                        className="px-2.5 py-1 text-xs bg-surface-alt text-copy border border-hairline rounded-full"
                                        title="Found in package.json / convex.config.ts. Only used components count toward scoring."
                                      >
                                        {component}
                                      </span>
                                    ),
                                  )
                                ) : (
                                  <span className="text-xs text-faint">
                                    none installed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Verified repo facts (Phase 1, deterministic) */}
                        {result.repoFacts && (
                          <div>
                            <h4 className="text-sm font-medium text-ink mb-2">
                              Verified Repo Facts
                              <span
                                className="ml-2 text-xs font-normal text-faint"
                                title="Counted deterministically from the repo source, not by the LLM"
                              >
                                deterministic
                              </span>
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              {(
                                [
                                  [
                                    "Convex files",
                                    result.repoFacts.convexFileCount,
                                  ],
                                  ["Tables", result.repoFacts.tableCount],
                                  ["Indexes", result.repoFacts.indexCount],
                                  ["Queries", result.repoFacts.queryCount],
                                  ["Mutations", result.repoFacts.mutationCount],
                                  ["Actions", result.repoFacts.actionCount],
                                  [
                                    "HTTP actions",
                                    result.repoFacts.httpActionCount,
                                  ],
                                  [
                                    "Return validators",
                                    result.repoFacts.returnsValidatorCount,
                                  ],
                                ] as const
                              ).map(([label, value]) => (
                                <div
                                  key={label}
                                  className="bg-surface-alt border border-hairline rounded-md px-2.5 py-1.5"
                                >
                                  <span className="font-semibold text-ink">
                                    {value}
                                  </span>{" "}
                                  <span className="text-soft">{label}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(
                                [
                                  ["schema", result.repoFacts.hasSchema],
                                  [
                                    "http router",
                                    result.repoFacts.hasHttpRouter,
                                  ],
                                  ["crons", result.repoFacts.hasCrons],
                                  ["scheduler", result.repoFacts.usesScheduler],
                                  [
                                    "file storage",
                                    result.repoFacts.usesStorage,
                                  ],
                                  [
                                    "vector search",
                                    result.repoFacts.usesVectorSearch,
                                  ],
                                  ["auth", result.repoFacts.usesAuth],
                                  [
                                    "pagination",
                                    result.repoFacts.usesPagination,
                                  ],
                                ] as const
                              ).map(([label, present]) => (
                                <span
                                  key={label}
                                  className={`px-2 py-0.5 text-xs rounded-full border ${
                                    present
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-surface-alt text-faint border-hairline"
                                  }`}
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Git timeline (Phase 3) */}
                        {result.gitFacts && (
                          <div>
                            <h4 className="text-sm font-medium text-ink mb-2">
                              Git Timeline
                              <span
                                className="ml-2 text-xs font-normal text-faint"
                                title="Commit dates can be rewritten with force-push; treat these as strong signals, not proof."
                              >
                                from commit history
                              </span>
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <div className="bg-surface-alt border border-hairline rounded-md px-2.5 py-1.5">
                                <span className="text-soft">First commit</span>{" "}
                                <span className="font-medium text-ink">
                                  {shortDate(result.gitFacts.firstCommitAt)}
                                </span>
                              </div>
                              <div className="bg-surface-alt border border-hairline rounded-md px-2.5 py-1.5">
                                <span className="text-soft">Last commit</span>{" "}
                                <span className="font-medium text-ink">
                                  {shortDate(result.gitFacts.lastCommitAt)}
                                </span>
                              </div>
                              <div className="bg-surface-alt border border-hairline rounded-md px-2.5 py-1.5">
                                <span className="text-soft">Repo created</span>{" "}
                                <span className="font-medium text-ink">
                                  {shortDate(result.gitFacts.repoCreatedAt)}
                                </span>
                              </div>
                              <div className="bg-surface-alt border border-hairline rounded-md px-2.5 py-1.5">
                                <span className="text-soft">Commits</span>{" "}
                                <span className="font-medium text-ink">
                                  {result.gitFacts.commitCount}
                                  {result.gitFacts.commitCountCapped ? "+" : ""}
                                </span>
                              </div>
                              <div className="bg-surface-alt border border-hairline rounded-md px-2.5 py-1.5">
                                <span className="text-soft">Active days</span>{" "}
                                <span className="font-medium text-ink">
                                  {result.gitFacts.activeDayCount}
                                </span>
                              </div>
                              <div className="bg-surface-alt border border-hairline rounded-md px-2.5 py-1.5">
                                <span className="text-soft">Contributors</span>{" "}
                                <span className="font-medium text-ink">
                                  {result.gitFacts.contributorCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Video demo transcript viewer (unverified narrative) */}
                        {result.sourcesUsed?.videoTranscript && (
                          <VideoTranscriptSection
                            groupId={groupId}
                            storyId={result.storyId}
                          />
                        )}

                        {/* Harness and model attribution (Phase 4, never scored) */}
                        {((result.harnessSignals?.length ?? 0) > 0 ||
                          result.selfReportedHarness ||
                          result.selfReportedModel) && (
                          <div>
                            <h4 className="text-sm font-medium text-ink mb-2">
                              AI Tool Attribution
                              <span className="ml-2 text-xs font-normal text-faint">
                                informational only, never affects scores
                              </span>
                            </h4>
                            {(result.harnessSignals?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {result.harnessSignals?.map((signal, i) => (
                                  <span
                                    key={`${signal.tool}-${i}`}
                                    className={`px-2.5 py-1 text-xs rounded-full border ${
                                      signal.confidence === "high"
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : signal.confidence === "medium"
                                          ? "bg-surface-alt text-copy border-hairline-strong"
                                          : "bg-surface-alt text-soft border-hairline"
                                    }`}
                                    title={`${signal.evidence} (${signal.confidence} confidence)`}
                                  >
                                    {signal.tool} ({signal.confidence})
                                  </span>
                                ))}
                              </div>
                            )}
                            {(result.selfReportedHarness ||
                              result.selfReportedModel) && (
                              <p className="text-xs text-soft">
                                Self-reported, unverified:{" "}
                                {[
                                  result.selfReportedHarness,
                                  result.selfReportedModel,
                                ]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </p>
                            )}
                          </div>
                        )}

                        {/* hackathon.md cross-check notes (recorded, never scored) */}
                        {(result.logDiscrepancies?.length ?? 0) > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-ink mb-2">
                              Hackathon Log Discrepancies
                              <span className="ml-2 text-xs font-normal text-faint">
                                recorded only, never affects scores
                              </span>
                            </h4>
                            <ul className="space-y-1">
                              {result.logDiscrepancies?.map((note, i) => (
                                <li
                                  key={i}
                                  className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5"
                                >
                                  {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Retry a completed review */}
                        <div className="pt-2 border-t border-hairline">
                          <button
                            onClick={() => handleRetry(result._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-copy hover:text-ink bg-surface hover:bg-surface-hover rounded-lg border border-hairline hover:border-hairline-strong transition-all font-medium"
                            title="Re-run the AI review for this submission (overwrites current scores)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Re-run this submission
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <DialogComponents />
    </div>
  );
}

// Screenshot-friendly stats rollup for a completed (or partial) AI review
function StatsPanel({
  groupName,
  results,
}: {
  groupName: string;
  results: Array<StatsResult>;
}) {
  const stats = computeStats(results);
  const maxBand = Math.max(1, ...stats.bands.map((b) => b.count));
  const maxFeature = Math.max(
    1,
    ...stats.topFeatures.map(([, count]) => count),
  );

  const cards = [
    {
      label: "Apps reviewed",
      value: `${stats.completed}`,
      sub: `of ${stats.total} in group`,
    },
    {
      label: "Using Convex",
      value: `${stats.usingConvex}`,
      sub:
        stats.completed > 0
          ? `${Math.round((stats.usingConvex / stats.completed) * 100)}% of reviewed`
          : "",
    },
    {
      label: "Advanced Convex features",
      value: `${stats.advancedConvex}`,
      sub: "scheduler, storage, search, components...",
    },
    {
      label: "Using Convex components",
      value: `${stats.usingComponents}`,
      sub:
        stats.componentsUsed.length > 0
          ? `${stats.componentsUsed.length} distinct component${stats.componentsUsed.length === 1 ? "" : "s"}`
          : "from package.json / convex.config.ts",
    },
    {
      label: "Live apps",
      value: `${stats.liveApps}`,
      sub:
        stats.urlChecked > 0
          ? `of ${stats.urlChecked} URLs checked`
          : "no URLs checked",
    },
    {
      label: "Repos analyzed",
      value: `${stats.reposAnalyzed}`,
      sub: "GitHub accessible",
    },
    {
      label: "Average score",
      value: `${stats.averageScore}`,
      sub: "out of 10",
    },
  ];

  return (
    <div className="bg-surface rounded-lg border border-hairline p-6 space-y-6">
      {/* Report header for screenshots */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-medium text-ink flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Best Use of Convex: AI Review Stats
          </h3>
          <p className="text-sm text-soft mt-0.5">{groupName}</p>
        </div>
        <p className="text-xs text-faint">
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-surface-alt border border-hairline rounded-lg p-4"
          >
            <p className="text-3xl font-semibold text-ink">{card.value}</p>
            <p className="text-sm font-medium text-copy mt-1">{card.label}</p>
            {card.sub && <p className="text-xs text-soft mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Convex features detected */}
        <div>
          <h4 className="text-sm font-medium text-ink mb-3">
            Top Convex features detected
          </h4>
          {stats.topFeatures.length === 0 ? (
            <p className="text-sm text-soft">No features detected yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topFeatures.map(([feature, count]) => (
                <div key={feature} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm text-copy truncate">
                        {feature}
                      </span>
                      <span className="text-xs text-soft flex-shrink-0">
                        {count} app{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cta rounded-full"
                        style={{ width: `${(count / maxFeature) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Convex components detected (deterministic, from repo files) */}
        <div>
          <h4 className="text-sm font-medium text-ink mb-3">
            Convex components used
          </h4>
          {stats.componentsUsed.length === 0 ? (
            <p className="text-sm text-soft">
              No components detected yet. Components are read from each repo's
              package.json and convex.config.ts during the AI review.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.componentsUsed.map(([component, count]) => (
                <div key={component} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm text-copy truncate">
                        {component}
                      </span>
                      <span className="text-xs text-soft flex-shrink-0">
                        {count} app{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cta rounded-full"
                        style={{
                          width: `${(count / Math.max(1, ...stats.componentsUsed.map(([, c]) => c))) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score distribution */}
        <div>
          <h4 className="text-sm font-medium text-ink mb-3">
            Score distribution (average per app)
          </h4>
          <div className="space-y-2">
            {stats.bands.map((band) => (
              <div key={band.label} className="flex items-center gap-3">
                <span className="text-xs text-soft w-12 flex-shrink-0 text-right">
                  {band.label}
                </span>
                <div className="flex-1 h-4 bg-surface-alt rounded overflow-hidden">
                  <div
                    className="h-full bg-cta rounded"
                    style={{ width: `${(band.count / maxBand) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-soft w-6 flex-shrink-0">
                  {band.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-faint pt-2 border-t border-hairline">
        Generated by the vibeapps AI Judge. "Using Convex" counts apps with at
        least one detected Convex feature; "Advanced" counts scheduler, crons,
        file storage, search, vector, HTTP actions, components, or agents.
        Components are detected from each repo's package.json and
        convex.config.ts and raise the advanced score.
      </p>
    </div>
  );
}
