import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  ArrowLeft,
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
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { useDialog } from "../../hooks/useDialog";

interface AIJudgeResultsProps {
  groupId: Id<"judgingGroups">;
  groupName: string;
  onBack: () => void;
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

type StatsResult = {
  status: string;
  averageScore?: number;
  criteriaScores?: Array<CriteriaScore>;
  convexFeaturesDetected?: Array<string>;
  urlCheck?: { isLive: boolean };
  sourcesUsed?: { github: boolean; liveUrl: boolean };
};

// Rollup numbers for the Stats tab and the report overview
function computeStats(results: Array<StatsResult>) {
  const completed = results.filter((r) => r.status === "completed");

  const usesConvex = (r: StatsResult) =>
    (r.convexFeaturesDetected?.length ?? 0) > 0;
  const usesAdvanced = (r: StatsResult) =>
    (r.convexFeaturesDetected || []).some((f) => ADVANCED_FEATURE_REGEX.test(f)) ||
    (r.criteriaScores || []).some((cs) => cs.key === "advanced" && cs.score >= 6);

  const scores = completed
    .map((r) => r.averageScore)
    .filter((s): s is number => s !== undefined);
  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
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
  urlCheck?: { checkedUrl?: string; isLive: boolean; statusCode?: number; note: string };
  sourcesUsed?: { github: boolean; liveUrl: boolean };
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
  lines.push(`| Apps using advanced Convex features | ${stats.advancedConvex} |`);
  lines.push(`| Live apps at review time | ${stats.liveApps} of ${stats.urlChecked} checked |`);
  lines.push(`| GitHub repos analyzed | ${stats.reposAnalyzed} |`);
  lines.push(`| Average score | ${stats.averageScore}/10 |`);

  lines.push("");
  lines.push("## Participation");
  lines.push("");
  lines.push(
    `- ${data.submissions.length} submission${data.submissions.length === 1 ? "" : "s"} from ${teams.size} team${teams.size === 1 ? "" : "s"} and ${solo.length} solo builder${solo.length === 1 ? "" : "s"}`,
  );
  if (listedMembers > 0) {
    lines.push(`- ${listedMembers} listed team member${listedMembers === 1 ? "" : "s"}`);
  }

  lines.push("");
  lines.push("## Rankings");
  lines.push("");
  lines.push("| Rank | Submission | Team | Score | Live app | GitHub | Convex features |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  completed.forEach((s, index) => {
    const submissionLink = `[${mdCell(s.title)}](${origin}/s/${s.slug})`;
    const team = s.teamName ? mdCell(s.teamName) : (s.submitterName ? mdCell(s.submitterName) : "-");
    const score = s.averageScore !== undefined ? `${s.averageScore.toFixed(1)}/10` : "-";
    const live = s.url
      ? `[${s.urlCheck ? (s.urlCheck.isLive ? "Live" : s.urlCheck.statusCode === 404 ? "404" : "Down") : "Link"}](${s.url})`
      : "-";
    const github = s.githubUrl ? `[Repo](${s.githubUrl})` : "-";
    const features = mdCell((s.convexFeaturesDetected || []).join(", ")) || "-";
    lines.push(`| ${index + 1} | ${submissionLink} | ${team} | ${score} | ${live} | ${github} | ${features} |`);
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
      lines.push(`- **${mdCell(teamName)}** (${memberCount} member${memberCount === 1 ? "" : "s"})${memberText}, built ${titles}`);
    }
    for (const s of solo) {
      lines.push(`- ${s.submitterName ? mdCell(s.submitterName) : "Unknown builder"}, built *${mdCell(s.title)}*`);
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

export function AIJudgeResults({
  groupId,
  groupName,
  onBack,
}: AIJudgeResultsProps) {
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
          ? error.message.replace(/^\[.*?\]\s*/, "").replace(/^Uncaught Error:\s*/, "")
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
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            Pending
          </span>
        );
    }
  };

  const completedResults = (data?.results || []).filter(
    (r) => r.status === "completed",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to judging groups"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-medium text-[#525252] flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Judge: Best Use of Convex
            </h2>
            <p className="text-sm text-gray-500">{groupName}</p>
          </div>
        </div>
        <Button
          onClick={handleStartReview}
          disabled={isStarting || isRunning}
          className="bg-[#292929] hover:bg-[#525252]"
        >
          {isStarting || isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isRunning ? "Review in progress..." : "Starting..."}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {completedResults.length > 0 ? "Re-run AI Review" : "Run AI Review"}
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
                { label: "Pending", value: data.counts.pending, color: "text-gray-600" },
                { label: "Reviewing", value: data.counts.running, color: "text-blue-600" },
                { label: "Completed", value: data.counts.completed, color: "text-green-600" },
                { label: "Failed", value: data.counts.failed, color: "text-red-600" },
              ] as const
            ).map((stat) => (
              <div
                key={stat.label}
                className="bg-white p-4 rounded-lg border border-gray-200"
              >
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className={`text-2xl font-semibold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Tabs: results / stats / hackathon report */}
          <div className="flex items-center gap-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("results")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "results"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
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
                  ? "border-gray-900 text-gray-900"
                  : statsReady
                    ? "border-transparent text-gray-500 hover:text-gray-700"
                    : "border-transparent text-gray-300 cursor-not-allowed"
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
                  ? "border-gray-900 text-gray-900"
                  : reportReady
                    ? "border-transparent text-gray-500 hover:text-gray-700"
                    : "border-transparent text-gray-300 cursor-not-allowed"
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
              <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    AI Hackathon Report
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Markdown report with rankings, GitHub and live app links,
                    teams, and participation. Paste into Notion or Google Docs,
                    or download as a .md file.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleGenerateReport}
                    disabled={reportData === undefined}
                    className="bg-[#292929] hover:bg-[#525252]"
                  >
                    {reportData === undefined ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading data...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        {reportMarkdown ? "Regenerate Report" : "Generate Report"}
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
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono max-h-[36rem] overflow-y-auto">
                    {reportMarkdown}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-gray-200">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
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
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
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
              {data.results.map((result, index) => {
                const isExpanded = expandedId === result._id;
                const isEditing = editingId === result._id;
                return (
                  <div
                    key={result._id}
                    className="bg-white rounded-lg border border-gray-200"
                  >
                    {/* Row header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {result.status === "completed" && (
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`/s/${result.storySlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 hover:underline truncate"
                            >
                              {result.storyTitle}
                            </a>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            {statusBadge(result.status)}
                            {result.editedAt && (
                              <span className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded-full">
                                Edited by admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {result.sourcesUsed && (
                              <>
                                <span
                                  className={`inline-flex items-center gap-1 ${result.sourcesUsed.github ? "text-green-600" : "text-gray-400"}`}
                                  title={
                                    result.sourcesUsed.github
                                      ? "GitHub repo was analyzed"
                                      : "GitHub repo was not accessible"
                                  }
                                >
                                  <Github className="w-3 h-3" />
                                  {result.sourcesUsed.github ? "repo" : "no repo"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 ${result.sourcesUsed.liveUrl ? "text-green-600" : "text-gray-400"}`}
                                  title={
                                    result.sourcesUsed.liveUrl
                                      ? "Live site was scraped"
                                      : "Live site was not scraped"
                                  }
                                >
                                  <Globe className="w-3 h-3" />
                                  {result.sourcesUsed.liveUrl ? "site" : "no site"}
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
                            {result.provider && (
                              <span title={result.model}>
                                via {result.provider}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {result.status === "completed" &&
                          result.averageScore !== undefined && (
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900">
                                {result.averageScore.toFixed(1)}
                                <span className="text-sm text-gray-400">/10</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                total {result.totalScore}
                              </p>
                            </div>
                          )}
                        {result.status === "failed" && (
                          <button
                            onClick={() => handleRetry(result._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
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
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
                      <div className="border-t border-gray-100 p-4 space-y-4">
                        {/* Edit toggle */}
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900">
                            Criteria Scores
                          </h4>
                          {!isEditing ? (
                            <button
                              onClick={() => startEditing(result)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
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
                                className="bg-[#292929] hover:bg-[#525252]"
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
                          {(isEditing ? editScores : result.criteriaScores || []).map(
                            (cs, csIndex) => (
                              <div
                                key={cs.key}
                                className="bg-gray-50 border border-gray-200 rounded-md p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-gray-900">
                                    {cs.label}
                                  </p>
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 10 }, (_, i) => i + 1).map(
                                        (score) => (
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
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                                            }`}
                                          >
                                            {score}
                                          </button>
                                        ),
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm font-semibold text-gray-900">
                                      {cs.score}/10
                                    </span>
                                  )}
                                </div>
                                {isEditing ? (
                                  <div className="mt-2">
                                    <Label
                                      htmlFor={`reasoning-${result._id}-${cs.key}`}
                                      className="text-xs text-gray-500"
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
                                    <p className="text-sm text-gray-600 mt-2">
                                      {cs.reasoning}
                                    </p>
                                  )
                                )}
                              </div>
                            ),
                          )}
                        </div>

                        {/* Overall reasoning */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            Overall Note
                          </h4>
                          {isEditing ? (
                            <Textarea
                              value={editOverall}
                              onChange={(e) => setEditOverall(e.target.value)}
                              rows={3}
                            />
                          ) : (
                            <p className="text-sm text-gray-600">
                              {result.overallReasoning || "No overall note."}
                            </p>
                          )}
                        </div>

                        {/* Convex features detected */}
                        {result.convexFeaturesDetected &&
                          result.convexFeaturesDetected.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">
                                Convex Features Detected
                              </h4>
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

                        {/* Retry a completed review */}
                        <div className="pt-2 border-t border-gray-100">
                          <button
                            onClick={() => handleRetry(result._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all font-medium"
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
  const maxFeature = Math.max(1, ...stats.topFeatures.map(([, count]) => count));

  const cards = [
    { label: "Apps reviewed", value: `${stats.completed}`, sub: `of ${stats.total} in group` },
    {
      label: "Using Convex",
      value: `${stats.usingConvex}`,
      sub: stats.completed > 0 ? `${Math.round((stats.usingConvex / stats.completed) * 100)}% of reviewed` : "",
    },
    {
      label: "Advanced Convex features",
      value: `${stats.advancedConvex}`,
      sub: "scheduler, storage, search, components...",
    },
    {
      label: "Live apps",
      value: `${stats.liveApps}`,
      sub: stats.urlChecked > 0 ? `of ${stats.urlChecked} URLs checked` : "no URLs checked",
    },
    { label: "Repos analyzed", value: `${stats.reposAnalyzed}`, sub: "GitHub accessible" },
    { label: "Average score", value: `${stats.averageScore}`, sub: "out of 10" },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* Report header for screenshots */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Best Use of Convex: AI Review Stats
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{groupName}</p>
        </div>
        <p className="text-xs text-gray-400">
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
            className="bg-gray-50 border border-gray-200 rounded-lg p-4"
          >
            <p className="text-3xl font-semibold text-gray-900">{card.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{card.label}</p>
            {card.sub && <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Convex features detected */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Top Convex features detected
          </h4>
          {stats.topFeatures.length === 0 ? (
            <p className="text-sm text-gray-500">No features detected yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topFeatures.map(([feature, count]) => (
                <div key={feature} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm text-gray-700 truncate">{feature}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {count} app{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-800 rounded-full"
                        style={{ width: `${(count / maxFeature) * 100}%` }}
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
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Score distribution (average per app)
          </h4>
          <div className="space-y-2">
            {stats.bands.map((band) => (
              <div key={band.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-12 flex-shrink-0 text-right">
                  {band.label}
                </span>
                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-gray-800 rounded"
                    style={{ width: `${(band.count / maxBand) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-6 flex-shrink-0">
                  {band.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        Generated by the vibeapps AI Judge. "Using Convex" counts apps with at
        least one detected Convex feature; "Advanced" counts scheduler, crons,
        file storage, search, vector, HTTP actions, components, or agents.
      </p>
    </div>
  );
}
