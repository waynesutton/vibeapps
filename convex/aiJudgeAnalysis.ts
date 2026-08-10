import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  DEFAULT_AI_JUDGE_PROMPT_BODY,
  getRubricForGroup,
  type RubricCriterion,
} from "./aiJudge";

// Content budgets so prompts stay well under model context limits.
// Facts are counted from a wider file set than the prompt includes, so
// large projects are measured fully even when the prompt is trimmed.
const MAX_FILE_CHARS = 8000;
const MAX_TOTAL_REPO_CHARS = 180000;
const MAX_SCRAPE_CHARS = 8000;
const MAX_CONVEX_FILES_PROMPT = 40; // Convex files included in the model prompt
const MAX_CONVEX_FILES_FACTS = 60; // Convex files fetched for fact extraction
const MAX_LOG_FILE_CHARS = 5000; // Per hackathon log/tracking file in the prompt
const MAX_MANIFEST_CHARS = 6000; // Published hackathon.json manifest in the prompt

// Deterministic Convex facts counted from the repo before the model sees it.
// Everything the score depends on is measured here, never inferred by the LLM.
export type RepoFacts = {
  convexFileCount: number;
  hasSchema: boolean;
  hasHttpRouter: boolean;
  hasCrons: boolean;
  hasConvexConfig: boolean;
  tableCount: number;
  indexCount: number;
  searchIndexCount: number;
  vectorIndexCount: number;
  queryCount: number;
  mutationCount: number;
  actionCount: number;
  httpActionCount: number;
  usesScheduler: boolean;
  usesStorage: boolean;
  usesVectorSearch: boolean;
  usesAuth: boolean;
  usesPagination: boolean;
  returnsValidatorCount: number;
};

type RepoContext = {
  fetched: boolean;
  repoAccess?: "public" | "private_or_missing";
  summary: string;
  componentsInstalled: Array<string>;
  componentsUsed: Array<string>;
  repoFacts?: RepoFacts;
  filePaths: Array<string>;
  // Hackathon/tracking markdown files found at the repo root (self-reported
  // build context: hackathon.md, changelog.md, task.md, files.md)
  logFiles: Array<{ path: string; content: string }>;
  // Agent skills present in the repo (.agents/skills/*/SKILL.md and similar)
  skillPaths: Array<string>;
  repoMeta?: {
    createdAt?: number;
    isFork: boolean;
    parentRepo?: string;
    defaultBranch: string;
  };
};

type CommitInfo = {
  committedAt: number | undefined;
  authorEmail: string | undefined;
  authorName: string | undefined;
  message: string;
};

type CommitHistory = {
  fetched: boolean;
  commits: Array<CommitInfo>;
  capped: boolean;
};

export type GitFacts = {
  firstCommitAt?: number;
  lastCommitAt?: number;
  commitCount: number;
  commitCountCapped: boolean;
  activeDayCount: number;
  contributorCount: number;
  builtDuringEvent: "in_window" | "started_before" | "no_window_set";
  repoCreatedAt?: number;
  isFork: boolean;
  parentRepo?: string;
};

export type HarnessSignal = {
  tool: string;
  source: "commit_trailer" | "config_file";
  evidence: string;
  confidence: "high" | "medium" | "low";
};

// Extract Convex component names INSTALLED via package.json deps
// (@convex-dev/*) and convex.config.ts imports of */convex.config.
// Installation alone earns nothing; see extractComponentsUsed.
function extractComponents(
  packageJsonRaw: string | null,
  convexConfigRaw: string | null,
): Array<string> {
  const found = new Set<string>();

  if (packageJsonRaw) {
    try {
      const pkg = JSON.parse(packageJsonRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
      for (const dep of deps) {
        if (dep.startsWith("@convex-dev/") && dep !== "@convex-dev/eslint-plugin") {
          found.add(dep.replace("@convex-dev/", ""));
        }
      }
    } catch {
      // Unparseable package.json: fall back to config imports only
    }
  }

  if (convexConfigRaw) {
    const importRegex = /from\s+["']([^"']+)\/convex\.config(?:\.js)?["']/g;
    let match;
    while ((match = importRegex.exec(convexConfigRaw))) {
      const source = match[1];
      if (source.startsWith("@convex-dev/")) {
        found.add(source.replace("@convex-dev/", ""));
      } else if (source.startsWith("@")) {
        found.add(source);
      } else {
        // Local component folder: use the last path segment as its name
        const parts = source.split("/").filter((p) => p && p !== ".");
        const name = parts[parts.length - 1];
        if (name) found.add(name);
      }
    }
  }

  return [...found].sort();
}

// Strip // line comments and /* */ block comments without touching string
// contents (so "https://..." inside a string is not treated as a comment).
// Small state machine: deterministic and good enough for counting.
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let state:
    | "code"
    | "line_comment"
    | "block_comment"
    | "single_quote"
    | "double_quote"
    | "template" = "code";

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line_comment";
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block_comment";
        i += 2;
        continue;
      }
      if (ch === "'") state = "single_quote";
      else if (ch === '"') state = "double_quote";
      else if (ch === "`") state = "template";
      out += ch;
      i++;
      continue;
    }

    if (state === "line_comment") {
      if (ch === "\n") {
        state = "code";
        out += ch;
      }
      i++;
      continue;
    }

    if (state === "block_comment") {
      if (ch === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Inside a string or template literal: copy verbatim, honor escapes
    if (ch === "\\") {
      out += ch + (next ?? "");
      i += 2;
      continue;
    }
    if (
      (state === "single_quote" && ch === "'") ||
      (state === "double_quote" && ch === '"') ||
      (state === "template" && ch === "`")
    ) {
      state = "code";
    }
    out += ch;
    i++;
  }

  return out;
}

// Count non-overlapping regex matches in a string
function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

// Count verified Convex facts from the full file tree plus fetched contents.
// Path facts use the full recursive tree; content facts use the fetched
// (comment-stripped) file contents.
function extractConvexFacts(
  filePaths: Array<string>,
  fileContentsByPath: Map<string, string>,
): RepoFacts {
  const convexPaths = filePaths.filter(
    (p) => /(^|\/)convex\//.test(p) && !p.includes("_generated"),
  );

  const hasPath = (suffix: RegExp) => convexPaths.some((p) => suffix.test(p));

  // Comment-stripped contents, split by kind
  let schemaContent = "";
  let allConvexContent = "";
  for (const [path, raw] of fileContentsByPath) {
    if (!/(^|\/)convex\//.test(path) || path.includes("_generated")) continue;
    const stripped = stripComments(raw);
    allConvexContent += "\n" + stripped;
    if (/(^|\/)convex\/schema\.ts$/.test(path)) {
      schemaContent += "\n" + stripped;
    }
  }

  return {
    convexFileCount: convexPaths.length,
    hasSchema: hasPath(/(^|\/)convex\/schema\.ts$/),
    hasHttpRouter: hasPath(/(^|\/)convex\/http\.ts$/),
    hasCrons: hasPath(/(^|\/)convex\/crons\.ts$/),
    hasConvexConfig: hasPath(/(^|\/)convex\/convex\.config\.ts$/),
    tableCount: countMatches(schemaContent, /defineTable\(/g),
    indexCount: countMatches(allConvexContent, /\.index\(/g),
    searchIndexCount: countMatches(allConvexContent, /\.searchIndex\(/g),
    vectorIndexCount: countMatches(allConvexContent, /\.vectorIndex\(/g),
    queryCount:
      countMatches(allConvexContent, /=\s*query\(/g) +
      countMatches(allConvexContent, /=\s*internalQuery\(/g),
    mutationCount:
      countMatches(allConvexContent, /=\s*mutation\(/g) +
      countMatches(allConvexContent, /=\s*internalMutation\(/g),
    actionCount:
      countMatches(allConvexContent, /=\s*action\(/g) +
      countMatches(allConvexContent, /=\s*internalAction\(/g),
    httpActionCount: countMatches(allConvexContent, /httpAction\(/g),
    usesScheduler: /ctx\.scheduler\.(runAfter|runAt)/.test(allConvexContent),
    usesStorage: /ctx\.storage\./.test(allConvexContent),
    usesVectorSearch: /ctx\.vectorSearch\(/.test(allConvexContent),
    usesAuth: /ctx\.auth\./.test(allConvexContent),
    usesPagination: /paginationOpts/.test(allConvexContent),
    returnsValidatorCount: countMatches(allConvexContent, /returns:\s/g),
  };
}

// Components actually USED: a `components.<name>` reference in fetched Convex
// source. This is the anti-gaming fix: installing a component without
// referencing it earns nothing. Names are matched back to installed component
// names when possible (rate-limiter vs components.rateLimiter).
function extractComponentsUsed(
  fileContentsByPath: Map<string, string>,
  componentsInstalled: Array<string>,
): Array<string> {
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const installedByNormalized = new Map<string, string>();
  for (const name of componentsInstalled) {
    installedByNormalized.set(normalize(name), name);
  }

  const used = new Set<string>();
  const usageRegex = /\bcomponents\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for (const [path, raw] of fileContentsByPath) {
    if (!/(^|\/)convex\//.test(path) || path.includes("_generated")) continue;
    if (/(^|\/)convex\/convex\.config\.ts$/.test(path)) continue; // config wires, does not use
    const stripped = stripComments(raw);
    let match;
    while ((match = usageRegex.exec(stripped))) {
      const property = match[1];
      const installedName = installedByNormalized.get(normalize(property));
      used.add(installedName ?? property);
    }
  }

  return [...used].sort();
}

type ScrapeContext = {
  fetched: boolean;
  markdown: string;
};

type UrlCheck = {
  checkedUrl?: string;
  isLive: boolean;
  statusCode?: number;
  note: string;
};

// Parse "https://github.com/owner/repo(/...)" into { owner, repo }
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("github.com")) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

// Decode GitHub's base64 file content (may contain newlines) as UTF-8
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Required auth headers for GitHub. GITHUB_TOKEN is REQUIRED: unauthenticated
// quota (60/hour) runs out mid-event and silently scores later submissions as
// repo-not-fetched, so a missing token fails the run loudly instead.
function requireGithubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set in Convex environment variables. The AI judge requires an authenticated GitHub token; without one the API quota runs out after a few submissions and later repos silently score as not fetched.",
    );
  }
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "vibeapps-ai-judge",
    Authorization: `Bearer ${token}`,
  };
}

// GitHub fetch with rate limit handling: read x-ratelimit-remaining and
// retry-after, back off and retry once, then fail with a named error rather
// than scoring on empty data.
async function githubFetch(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers });
    const remaining = res.headers.get("x-ratelimit-remaining");
    const isRateLimited =
      (res.status === 403 || res.status === 429) &&
      (remaining === "0" || res.headers.get("retry-after") !== null);

    if (!isRateLimited) return res;

    if (attempt === 0) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : 5;
      // Cap the in-action wait at 30 seconds
      const waitMs = Math.min(Math.max(retryAfterSeconds, 2), 30) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    throw new Error(
      "GitHub API rate limit exceeded while analyzing this submission. Re-run the review after the limit resets.",
    );
  }
  throw new Error("GitHub fetch retry loop exited unexpectedly");
}

// Fetch the GitHub repo: metadata, full file tree, and Convex-related files.
// Two-tier fetch: up to MAX_CONVEX_FILES_FACTS Convex files are fetched for
// fact extraction; only the top MAX_CONVEX_FILES_PROMPT by priority go into
// the prompt. Facts are computed from the wider set so large projects are
// measured completely (fixes truncation bias against complex submissions).
async function fetchGithubContext(githubUrl: string | undefined): Promise<RepoContext> {
  const empty: RepoContext = {
    fetched: false,
    summary: "",
    componentsInstalled: [],
    componentsUsed: [],
    filePaths: [],
    logFiles: [],
    skillPaths: [],
  };
  if (!githubUrl) return empty;
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) return { ...empty, repoAccess: "private_or_missing" };

  const headers = requireGithubHeaders();
  const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;

  const repoRes = await githubFetch(base, { ...headers });
  if (!repoRes.ok) {
    return { ...empty, repoAccess: "private_or_missing" };
  }
  const repoJson = (await repoRes.json()) as {
    default_branch?: string;
    description?: string | null;
    language?: string | null;
    created_at?: string;
    fork?: boolean;
    parent?: { full_name?: string } | null;
  };
  const defaultBranch = repoJson.default_branch || "main";
  const repoMeta = {
    createdAt: repoJson.created_at ? Date.parse(repoJson.created_at) : undefined,
    isFork: repoJson.fork === true,
    parentRepo: repoJson.parent?.full_name ?? undefined,
    defaultBranch,
  };

  const treeRes = await githubFetch(
    `${base}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    headers,
  );
  let treeEntries: Array<{ path: string; type: string; size?: number }> = [];
  if (treeRes.ok) {
    const treeJson = (await treeRes.json()) as {
      tree?: Array<{ path: string; type: string; size?: number }>;
    };
    treeEntries = (treeJson.tree || []).filter((entry) => entry.type === "blob");
  }
  const filePaths = treeEntries.map((entry) => entry.path);
  const sizeByPath = new Map(treeEntries.map((e) => [e.path, e.size ?? 0]));

  // Convex source files ordered by priority: schema, convex.config, http,
  // crons first, then remaining by descending size (bigger files carry more
  // of the app; small stubs go last).
  const isConvexSource = (p: string) =>
    /(^|\/)convex\/.*\.(ts|tsx|js|jsx)$/.test(p) && !p.includes("_generated");
  const priorityRank = (p: string): number => {
    if (/(^|\/)convex\/schema\.ts$/.test(p)) return 0;
    if (/(^|\/)convex\/convex\.config\.ts$/.test(p)) return 1;
    if (/(^|\/)convex\/http\.ts$/.test(p)) return 2;
    if (/(^|\/)convex\/crons\.ts$/.test(p)) return 3;
    return 4;
  };
  const convexFilesOrdered = filePaths
    .filter(isConvexSource)
    .sort((a, b) => {
      const rankDiff = priorityRank(a) - priorityRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (sizeByPath.get(b) ?? 0) - (sizeByPath.get(a) ?? 0);
    });

  const factFiles = convexFilesOrdered.slice(0, MAX_CONVEX_FILES_FACTS);
  const promptConvexFiles = new Set(
    convexFilesOrdered.slice(0, MAX_CONVEX_FILES_PROMPT),
  );

  // Non-Convex context files (prompt only)
  const packageJsonPath = filePaths.find((p) => p === "package.json");
  const readmePath = filePaths.find((p) => /^README\.md$/i.test(p));

  // Hackathon/tracking markdown at the repo root: self-reported build context
  // the judge can cross-check against commit history and code facts.
  const logFilePaths = filePaths.filter((p) =>
    /^(hackathon|changelog|task|tasks|files)\.md$/i.test(p),
  );

  // Agent skills present in the repo (evidence of agent-assisted workflow)
  const skillPaths = filePaths.filter((p) =>
    /^\.(agents|claude|codex|cursor)\/skills\/.+\/SKILL\.md$/i.test(p),
  );

  const filesToFetch: Array<string> = [];
  if (packageJsonPath) filesToFetch.push(packageJsonPath);
  if (readmePath) filesToFetch.push(readmePath);
  filesToFetch.push(...logFilePaths);
  filesToFetch.push(...factFiles);

  // Fetch file contents (fact tier). Failures on individual files are skipped;
  // partial repo context is still useful.
  const fileContentsByPath = new Map<string, string>();
  for (const path of filesToFetch) {
    try {
      const fileRes = await githubFetch(
        `${base}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(defaultBranch)}`,
        headers,
      );
      if (!fileRes.ok) continue;
      const fileJson = (await fileRes.json()) as {
        content?: string;
        encoding?: string;
      };
      if (!fileJson.content || fileJson.encoding !== "base64") continue;
      fileContentsByPath.set(path, decodeBase64Utf8(fileJson.content));
    } catch (error) {
      // Rate limit exhaustion must fail the run; other per-file errors skip
      if (error instanceof Error && /rate limit/i.test(error.message)) {
        throw error;
      }
    }
  }

  const packageJsonRaw = packageJsonPath
    ? (fileContentsByPath.get(packageJsonPath) ?? null)
    : null;
  const convexConfigPath = factFiles.find((p) =>
    /(^|\/)convex\/convex\.config\.ts$/.test(p),
  );
  const convexConfigRaw = convexConfigPath
    ? (fileContentsByPath.get(convexConfigPath) ?? null)
    : null;

  const componentsInstalled = extractComponents(packageJsonRaw, convexConfigRaw);
  const componentsUsed = extractComponentsUsed(
    fileContentsByPath,
    componentsInstalled,
  );
  const repoFacts = extractConvexFacts(filePaths, fileContentsByPath);

  // Build the prompt summary from the narrower prompt subset with char budgets
  let totalChars = 0;
  const fileSections: Array<string> = [];
  const promptPaths: Array<string> = [];
  if (packageJsonPath) promptPaths.push(packageJsonPath);
  if (readmePath) promptPaths.push(readmePath);
  for (const path of factFiles) {
    if (promptConvexFiles.has(path)) promptPaths.push(path);
  }
  for (const path of promptPaths) {
    if (totalChars >= MAX_TOTAL_REPO_CHARS) break;
    let content = fileContentsByPath.get(path);
    if (content === undefined) continue;
    if (content.length > MAX_FILE_CHARS) {
      content = content.slice(0, MAX_FILE_CHARS) + "\n... (truncated)";
    }
    totalChars += content.length;
    fileSections.push(`--- FILE: ${path} ---\n${content}`);
  }

  // Hackathon log files, each capped so self-reported prose cannot crowd out code
  const logFiles: Array<{ path: string; content: string }> = [];
  for (const path of logFilePaths) {
    const raw = fileContentsByPath.get(path);
    if (raw === undefined) continue;
    logFiles.push({
      path,
      content:
        raw.length > MAX_LOG_FILE_CHARS
          ? raw.slice(0, MAX_LOG_FILE_CHARS) + "\n... (truncated)"
          : raw,
    });
  }

  const convexFilePaths = filePaths.filter(
    (p) => p.includes("convex/") && !p.includes("_generated"),
  );

  const summary = [
    `Repository: ${parsed.owner}/${parsed.repo}`,
    repoJson.description ? `Description: ${repoJson.description}` : "",
    repoJson.language ? `Primary language: ${repoJson.language}` : "",
    `Convex-related file paths (${convexFilePaths.length}):`,
    convexFilePaths.slice(0, 100).join("\n"),
    "",
    ...fileSections,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    fetched: true,
    repoAccess: "public",
    summary,
    componentsInstalled,
    componentsUsed,
    repoFacts,
    filePaths,
    logFiles,
    skillPaths,
    repoMeta,
  };
}

// Fetch up to 300 commits (3 pages of 100) from the repo's default branch.
// Uses committer dates downstream: author dates are trivially faked with
// --date, committer dates are harder and are what GitHub displays.
async function fetchCommitHistory(
  parsed: { owner: string; repo: string } | null,
): Promise<CommitHistory> {
  if (!parsed) return { fetched: false, commits: [], capped: false };

  const headers = requireGithubHeaders();
  const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const commits: Array<CommitInfo> = [];
  let capped = false;

  for (let page = 1; page <= 3; page++) {
    const res = await githubFetch(`${base}/commits?per_page=100&page=${page}`, headers);
    // 409 = empty repo; 404 = private/missing. Either way: no history.
    if (!res.ok) {
      return { fetched: page > 1, commits, capped };
    }
    const json = (await res.json()) as Array<{
      commit?: {
        committer?: { date?: string; email?: string } | null;
        author?: { date?: string; name?: string; email?: string } | null;
        message?: string;
      };
      author?: { login?: string } | null;
    }>;
    if (!Array.isArray(json)) {
      return { fetched: page > 1, commits, capped };
    }
    for (const item of json) {
      const committerDate = item.commit?.committer?.date;
      const authorDate = item.commit?.author?.date;
      commits.push({
        committedAt: committerDate
          ? Date.parse(committerDate)
          : authorDate
            ? Date.parse(authorDate)
            : undefined,
        authorEmail: item.commit?.author?.email ?? undefined,
        authorName: item.commit?.author?.name ?? undefined,
        message: item.commit?.message ?? "",
      });
    }
    if (json.length < 100) {
      return { fetched: true, commits, capped: false };
    }
    if (page === 3) {
      capped = true;
    }
  }

  return { fetched: true, commits, capped };
}

// Compute the build timeline facts. builtDuringEvent answers the eligibility
// question "was this built during the event window". Force-pushed rewritten
// history is undetectable; the admin UI states that limitation.
function computeGitFacts(
  history: CommitHistory,
  repoMeta: RepoContext["repoMeta"],
  eventStartDate: number | undefined,
  eventEndDate: number | undefined,
): GitFacts | undefined {
  if (!history.fetched && !repoMeta) return undefined;

  const timestamps = history.commits
    .map((c) => c.committedAt)
    .filter((t): t is number => t !== undefined);
  const firstCommitAt = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
  const lastCommitAt = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

  const days = new Set<string>();
  for (const t of timestamps) {
    days.add(new Date(t).toISOString().slice(0, 10));
  }

  const contributors = new Set<string>();
  for (const c of history.commits) {
    const key = c.authorEmail || c.authorName;
    if (key) contributors.add(key.toLowerCase());
  }

  let builtDuringEvent: GitFacts["builtDuringEvent"] = "no_window_set";
  if (eventStartDate !== undefined && firstCommitAt !== undefined) {
    builtDuringEvent = firstCommitAt >= eventStartDate ? "in_window" : "started_before";
  }
  // eventEndDate is informational only; late commits are not an eligibility flag
  void eventEndDate;

  return {
    firstCommitAt,
    lastCommitAt,
    commitCount: history.commits.length,
    commitCountCapped: history.capped,
    activeDayCount: days.size,
    contributorCount: contributors.size,
    builtDuringEvent,
    repoCreatedAt: repoMeta?.createdAt,
    isFork: repoMeta?.isFork ?? false,
    parentRepo: repoMeta?.parentRepo,
  };
}

// Detect AI harness signals from config files and commit trailers.
// IMPORTANT: this is organizer metadata only. Signals must NEVER feed into
// the rubric, clamps, or prompt context, and must never be collapsed into a
// single "harness" string: lone AGENTS.md / CLAUDE.md files are often written
// by `npx convex ai-files install`, so naive detection reads Convex tooling
// as several harnesses at once.
function detectHarnessSignals(
  filePaths: Array<string>,
  commits: Array<CommitInfo>,
): Array<HarnessSignal> {
  const signals: Array<HarnessSignal> = [];
  const seen = new Set<string>();
  const add = (signal: HarnessSignal) => {
    const key = `${signal.tool}|${signal.source}`;
    if (seen.has(key)) return;
    seen.add(key);
    signals.push(signal);
  };

  // Commit trailers: high confidence
  for (const commit of commits) {
    if (/co-authored-by:\s*claude/i.test(commit.message)) {
      add({
        tool: "claude-code",
        source: "commit_trailer",
        evidence: "Co-Authored-By: Claude commit trailer",
        confidence: "high",
      });
    }
    if (/generated with .{0,10}claude code/i.test(commit.message)) {
      add({
        tool: "claude-code",
        source: "commit_trailer",
        evidence: "Generated with Claude Code commit trailer",
        confidence: "high",
      });
    }
    if (commit.authorName && /\(aider\)/i.test(commit.authorName)) {
      add({
        tool: "aider",
        source: "commit_trailer",
        evidence: "(aider) in commit author name",
        confidence: "high",
      });
    }
    if (/co-authored-by:.*copilot/i.test(commit.message)) {
      add({
        tool: "copilot",
        source: "commit_trailer",
        evidence: "Co-authored-by: Copilot commit trailer",
        confidence: "high",
      });
    }
  }

  // Config files: medium confidence. `.mcp.json` is MCP tooling, not a harness.
  const has = (predicate: (p: string) => boolean) => filePaths.some(predicate);
  if (has((p) => p.startsWith(".cursor/rules/") || p === ".cursorrules")) {
    add({
      tool: "cursor",
      source: "config_file",
      evidence: ".cursor/rules/ or .cursorrules",
      confidence: "medium",
    });
  }
  if (has((p) => p.startsWith(".claude/"))) {
    add({
      tool: "claude-code",
      source: "config_file",
      evidence: ".claude/ directory",
      confidence: "medium",
    });
  }
  if (
    has(
      (p) =>
        p === "opencode.json" || p === "opencode.jsonc" || p.startsWith(".opencode/"),
    )
  ) {
    add({
      tool: "opencode",
      source: "config_file",
      evidence: "opencode config",
      confidence: "medium",
    });
  }
  if (has((p) => p === ".windsurfrules" || p.startsWith(".windsurf/"))) {
    add({
      tool: "windsurf",
      source: "config_file",
      evidence: ".windsurfrules or .windsurf/",
      confidence: "medium",
    });
  }
  if (has((p) => p === ".github/copilot-instructions.md")) {
    add({
      tool: "copilot",
      source: "config_file",
      evidence: ".github/copilot-instructions.md",
      confidence: "medium",
    });
  }
  if (has((p) => p === ".aider.conf.yml")) {
    add({
      tool: "aider",
      source: "config_file",
      evidence: ".aider.conf.yml",
      confidence: "medium",
    });
  }
  if (has((p) => p.startsWith(".codex/"))) {
    add({
      tool: "codex",
      source: "config_file",
      evidence: ".codex/ directory",
      confidence: "medium",
    });
  }

  // Lone marker files: low confidence. `npx convex ai-files install` writes
  // managed AGENTS.md and CLAUDE.md files, so these often signal Convex
  // tooling rather than a harness choice.
  if (has((p) => p === "AGENTS.md")) {
    add({
      tool: "unknown",
      source: "config_file",
      evidence: "AGENTS.md alone (may be written by npx convex ai-files install)",
      confidence: "low",
    });
  }
  if (has((p) => p === "CLAUDE.md")) {
    add({
      tool: "claude-code",
      source: "config_file",
      evidence: "CLAUDE.md alone (may be written by npx convex ai-files install)",
      confidence: "low",
    });
  }

  // Sort by confidence descending so the strongest evidence renders first
  const rank = { high: 0, medium: 1, low: 2 } as const;
  signals.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
  return signals;
}

// Build convexFeaturesDetected deterministically from repoFacts so the field
// keeps its name and every existing consumer keeps working, but its contents
// become reproducible: same repo, same list, every run.
function buildFeaturesFromFacts(
  facts: RepoFacts,
  componentsUsed: Array<string>,
): Array<string> {
  const features: Array<string> = [];
  if (facts.hasSchema && facts.tableCount > 0) {
    features.push(facts.indexCount > 0 ? "schema with indexes" : "schema");
  }
  if (facts.queryCount > 0) features.push("real-time queries");
  if (facts.mutationCount > 0) features.push("mutations");
  if (facts.actionCount > 0) features.push("actions");
  if (facts.httpActionCount > 0) features.push("http actions");
  if (facts.hasCrons) features.push("crons");
  if (facts.usesScheduler) features.push("scheduler");
  if (facts.usesStorage) features.push("file storage");
  if (facts.searchIndexCount > 0) features.push("full-text search");
  if (facts.vectorIndexCount > 0 || facts.usesVectorSearch) {
    features.push("vector search");
  }
  if (facts.usesAuth) features.push("auth");
  if (facts.usesPagination) features.push("pagination");
  for (const component of componentsUsed) {
    features.push(`component: ${component}`);
  }
  return features;
}

// Deterministic liveness check of the submission's live app URL (never social
// links). GET with redirects followed; any 2xx/3xx counts as live.
async function checkUrlLiveness(url: string | undefined): Promise<UrlCheck> {
  if (!url) {
    return { isLive: false, note: "no URL provided" };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { checkedUrl: url, isLive: false, note: "invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { checkedUrl: url, isLive: false, note: "not an http(s) URL" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "vibeapps-ai-judge" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return { checkedUrl: url, isLive: true, statusCode: res.status, note: "OK" };
    }
    return {
      checkedUrl: url,
      isLive: false,
      statusCode: res.status,
      note:
        res.status === 404
          ? "404 Not Found"
          : `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`,
    };
  } catch {
    return {
      checkedUrl: url,
      isLive: false,
      note: "network error (unreachable or timed out)",
    };
  }
}

// Scrape the live URL to markdown via Firecrawl (skipped if key is not set)
async function fetchLiveUrlContext(url: string | undefined): Promise<ScrapeContext> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey || !url) return { fetched: false, markdown: "" };

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return { fetched: false, markdown: "" };
    const json = (await res.json()) as {
      success?: boolean;
      data?: { markdown?: string };
    };
    const markdown = json.data?.markdown || "";
    if (!markdown) return { fetched: false, markdown: "" };
    return {
      fetched: true,
      markdown:
        markdown.length > MAX_SCRAPE_CHARS
          ? markdown.slice(0, MAX_SCRAPE_CHARS) + "\n... (truncated)"
          : markdown,
    };
  } catch {
    return { fetched: false, markdown: "" };
  }
}

type ManifestContext = { fetched: boolean; content: string; url?: string };

// Fetch the published /hackathon.json manifest from the live app origin.
// Teams with private or missing repos can publish this self-reported build
// manifest so the judge still has structured context. Verified facts always
// outrank manifest claims in the prompt rules.
async function fetchHackathonManifest(
  url: string | undefined,
): Promise<ManifestContext> {
  if (!url) return { fetched: false, content: "" };
  let origin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { fetched: false, content: "" };
    }
    origin = parsed.origin;
  } catch {
    return { fetched: false, content: "" };
  }

  const manifestUrl = `${origin}/hackathon.json`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(manifestUrl, {
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { fetched: false, content: "" };
    const text = await res.text();
    // Must parse as a JSON object: SPAs commonly serve index.html for any path
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return { fetched: false, content: "" };
    }
    if (typeof parsedJson !== "object" || parsedJson === null) {
      return { fetched: false, content: "" };
    }
    const pretty = JSON.stringify(parsedJson, null, 2);
    return {
      fetched: true,
      url: manifestUrl,
      content:
        pretty.length > MAX_MANIFEST_CHARS
          ? pretty.slice(0, MAX_MANIFEST_CHARS) + "\n... (truncated)"
          : pretty,
    };
  } catch {
    return { fetched: false, content: "" };
  }
}

// Build the system prompt from the group's effective rubric and optional
// custom prompt body. The {{rubric}} placeholder expands to the numbered
// criteria list; if a custom body omits the placeholder the rubric block is
// appended so the model always sees every criterion. The JSON response
// contract is ALWAYS appended here (never editable), so a custom prompt can
// never break response parsing.
function buildSystemPrompt(
  customBody: string | undefined,
  rubric: Array<RubricCriterion>,
): string {
  const rubricText = rubric
    .map((c, idx) => `${idx + 1}. key: "${c.key}" — ${c.label}\n   ${c.description}`)
    .join("\n");

  let body = (customBody ?? DEFAULT_AI_JUDGE_PROMPT_BODY).trim();
  if (body.includes("{{rubric}}")) {
    body = body.split("{{rubric}}").join(rubricText);
  } else {
    body += `\n\nScore the submission on each rubric criterion from 1 to 10:\n${rubricText}`;
  }

  const jsonContract = `Respond with ONLY a JSON object in exactly this shape (no markdown fences, no extra text):
{
  "criteria": {
    ${rubric.map((c) => `"${c.key}": { "score": <1-10>, "reasoning": "<why>" }`).join(",\n    ")}
  },
  "overallReasoning": "<2-4 sentence overall note on why this submission scored the way it did>"
}`;

  return `${body}\n\n${jsonContract}`;
}

// Render the verified facts block for the user message
function formatRepoFacts(facts: RepoFacts): string {
  const yesNo = (b: boolean) => (b ? "yes" : "no");
  return [
    `Convex source files: ${facts.convexFileCount}`,
    `Schema file (convex/schema.ts): ${yesNo(facts.hasSchema)}; tables defined: ${facts.tableCount}`,
    `Indexes: ${facts.indexCount}; search indexes: ${facts.searchIndexCount}; vector indexes: ${facts.vectorIndexCount}`,
    `Functions: queries ${facts.queryCount}, mutations ${facts.mutationCount}, actions ${facts.actionCount}, http actions ${facts.httpActionCount}`,
    `Return validators: ${facts.returnsValidatorCount}`,
    `Scheduler used: ${yesNo(facts.usesScheduler)}; file storage: ${yesNo(facts.usesStorage)}; vector search calls: ${yesNo(facts.usesVectorSearch)}`,
    `Auth (ctx.auth): ${yesNo(facts.usesAuth)}; pagination: ${yesNo(facts.usesPagination)}`,
    `Crons file: ${yesNo(facts.hasCrons)}; HTTP router file: ${yesNo(facts.hasHttpRouter)}; convex.config.ts: ${yesNo(facts.hasConvexConfig)}`,
  ].join("\n");
}

// Render the git history block for the user message
function formatGitFacts(git: GitFacts): string {
  const fmt = (t?: number) => (t !== undefined ? new Date(t).toISOString() : "unknown");
  const lines = [
    `First commit (committer date): ${fmt(git.firstCommitAt)}`,
    `Last commit (committer date): ${fmt(git.lastCommitAt)}`,
    `Commits: ${git.commitCount}${git.commitCountCapped ? "+ (capped at 300)" : ""}`,
    `Active days with commits: ${git.activeDayCount}; distinct contributors: ${git.contributorCount}`,
    `Fork: ${git.isFork ? `yes${git.parentRepo ? ` (parent: ${git.parentRepo})` : ""}` : "no"}`,
  ];
  if (git.builtDuringEvent === "started_before") {
    lines.push(
      "Event window: the first commit predates the judging group's start date (started_before). Mention this in overallReasoning as an eligibility note for organizers; do not change any criterion score because of it.",
    );
  } else if (git.builtDuringEvent === "in_window") {
    lines.push("Event window: first commit is within the judging group's event window.");
  }
  return lines.join("\n");
}

// Build the user message with all gathered submission context.
// Harness signals are deliberately EXCLUDED: harness attribution is organizer
// metadata and must never bias scoring.
function buildUserMessage(
  data: {
    title: string;
    description: string;
    longDescription?: string;
    url?: string;
    githubUrl?: string;
    videoUrl?: string;
    tags: Array<string>;
  },
  repo: RepoContext,
  scrape: ScrapeContext,
  urlCheck: UrlCheck,
  gitFacts: GitFacts | undefined,
  manifest: ManifestContext,
): string {
  const sections: Array<string> = [
    `SUBMISSION: ${data.title}`,
    `Tagline: ${data.description}`,
  ];
  if (data.longDescription) sections.push(`Description: ${data.longDescription}`);
  if (data.tags.length > 0) sections.push(`Tags: ${data.tags.join(", ")}`);
  sections.push(`Live URL: ${data.url || "not provided"}`);
  sections.push(`GitHub URL: ${data.githubUrl || "not provided"}`);
  if (data.videoUrl) sections.push(`Video URL: ${data.videoUrl}`);

  // Deterministic liveness facts so the model does not have to guess
  sections.push(
    `\n=== LIVE URL CHECK (verified by direct HTTP request) ===\nStatus: ${
      urlCheck.isLive ? "LIVE" : "NOT LIVE"
    }${urlCheck.statusCode ? ` (HTTP ${urlCheck.statusCode})` : ""}\nDetail: ${urlCheck.note}`,
  );

  // Deterministic Convex facts: authoritative counts the model must not contradict
  if (repo.fetched && repo.repoFacts) {
    sections.push(
      `\n=== VERIFIED CONVEX FACTS (counted from the repository; authoritative) ===\n${formatRepoFacts(repo.repoFacts)}`,
    );
  }

  // Component detection split: used in code vs merely installed
  sections.push(
    `\n=== CONVEX COMPONENTS ===\nUsed in code (components.<name> referenced): ${
      repo.componentsUsed.length > 0 ? repo.componentsUsed.join(", ") : "none"
    }\nInstalled but not referenced in fetched code: ${
      repo.componentsInstalled.filter((c) => !repo.componentsUsed.includes(c)).length > 0
        ? repo.componentsInstalled
            .filter((c) => !repo.componentsUsed.includes(c))
            .join(", ")
        : "none"
    }`,
  );

  if (gitFacts) {
    sections.push(
      `\n=== GIT HISTORY (from GitHub commits API, committer dates) ===\n${formatGitFacts(gitFacts)}`,
    );
  }

  // Self-reported hackathon/tracking markdown from the repo root
  if (repo.logFiles.length > 0) {
    const logSections = repo.logFiles
      .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
      .join("\n");
    sections.push(
      `\n=== PROJECT LOG FILES (self-reported by the team; verify against facts) ===\n${logSections}`,
    );
  }

  // Agent skills found in the repo (workflow evidence, not a scoring criterion)
  if (repo.skillPaths.length > 0) {
    sections.push(
      `\n=== AGENT SKILLS IN REPO ===\n${repo.skillPaths.slice(0, 30).join("\n")}`,
    );
  }

  // Published hackathon.json manifest (fallback context for private/no-repo)
  if (manifest.fetched) {
    sections.push(
      `\n=== PUBLISHED HACKATHON MANIFEST (${manifest.url}; self-reported, verify against facts) ===\n${manifest.content}`,
    );
  }

  sections.push(
    repo.fetched
      ? `\n=== GITHUB REPOSITORY CONTEXT ===\n${repo.summary}`
      : "\n=== GITHUB REPOSITORY CONTEXT ===\nRepository was not accessible (missing, private, or invalid URL).",
  );

  sections.push(
    scrape.fetched
      ? `\n=== LIVE SITE CONTENT (scraped) ===\n${scrape.markdown}`
      : "\n=== LIVE SITE CONTENT ===\nNot available.",
  );

  return sections.join("\n");
}

type LlmResult = {
  text: string;
  provider: string;
  model: string;
};

// Call Anthropic Messages API
async function callAnthropic(systemPrompt: string, userMessage: string): Promise<LlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model = "claude-sonnet-4-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (json.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("");
  if (!text) throw new Error("Anthropic returned empty response");
  return { text, provider: "anthropic", model };
}

// Call an OpenAI-compatible chat completions endpoint
async function callOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  provider: string,
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`${provider} API error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider} returned empty response`);
  return { text, provider, model };
}

// Try providers in order: Anthropic, then OpenAI, then OpenRouter
async function callLlmWithFallback(
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult> {
  const errors: Array<string> = [];

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(systemPrompt, userMessage);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Anthropic failed");
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAiCompatible(
        "https://api.openai.com/v1/chat/completions",
        process.env.OPENAI_API_KEY,
        "gpt-4o",
        "openai",
        systemPrompt,
        userMessage,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "OpenAI failed");
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenAiCompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        process.env.OPENROUTER_API_KEY,
        "anthropic/claude-sonnet-4.5",
        "openrouter",
        systemPrompt,
        userMessage,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "OpenRouter failed");
    }
  }

  if (errors.length === 0) {
    throw new Error(
      "No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY in Convex environment variables.",
    );
  }
  throw new Error(`All configured AI providers failed: ${errors.join(" | ")}`);
}

type ParsedAnalysis = {
  criteriaScores: Array<{ key: string; label: string; score: number; reasoning: string }>;
  overallReasoning: string;
};

// Parse and validate the model's JSON response against the group's effective rubric
function parseAnalysisResponse(
  text: string,
  rubric: Array<RubricCriterion>,
): ParsedAnalysis {
  // Strip markdown fences if the model added them anyway
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  // Fall back to the outermost JSON object if there is surrounding prose
  if (!cleaned.startsWith("{")) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Response contained no JSON object");
    cleaned = cleaned.slice(start, end + 1);
  }

  const parsed = JSON.parse(cleaned) as {
    criteria?: Record<string, { score?: number; reasoning?: string }>;
    overallReasoning?: string;
  };

  if (!parsed.criteria || typeof parsed.criteria !== "object") {
    throw new Error("Response missing criteria object");
  }

  const criteriaScores = rubric.map((rubricItem) => {
    const entry = parsed.criteria![rubricItem.key];
    if (!entry || typeof entry.score !== "number") {
      throw new Error(`Response missing score for criterion "${rubricItem.key}"`);
    }
    const score = Math.min(10, Math.max(1, Math.round(entry.score)));
    return {
      key: rubricItem.key,
      label: rubricItem.label,
      score,
      reasoning: typeof entry.reasoning === "string" ? entry.reasoning : "",
    };
  });

  return {
    criteriaScores,
    overallReasoning:
      typeof parsed.overallReasoning === "string" ? parsed.overallReasoning : "",
  };
}

type CriteriaScore = { key: string; label: string; score: number; reasoning: string };

// Cap one criterion at `cap`, prefixing the reasoning with the clamp note
function clampCriterion(
  scores: Array<CriteriaScore>,
  key: string,
  cap: number,
  note: string,
): Array<CriteriaScore> {
  return scores.map((cs) => {
    if (cs.key !== key || cs.score <= cap) return cs;
    return { ...cs, score: cap, reasoning: `${note} ${cs.reasoning}`.trim() };
  });
}

/**
 * Analyze one submission for Best Use of Convex. Always saves an outcome
 * (success or failure). Analyses run through the AI judge workpool with
 * limited parallelism, so no scheduler chaining happens here.
 */
export const analyzeSubmission = internalAction({
  args: { resultId: v.id("aiJudgeResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.aiJudge.markRunning, { resultId: args.resultId });

    try {
      const data = await ctx.runQuery(internal.aiJudge.getSubmissionForAnalysis, {
        resultId: args.resultId,
      });
      if (!data) {
        throw new Error("Submission is no longer available for review");
      }

      // Gather context: GitHub repo + commit history (primary), live URL
      // scrape (secondary), and a deterministic liveness check
      const parsedRepoUrl = data.githubUrl ? parseGithubUrl(data.githubUrl) : null;
      const [repo, commitHistory, scrape, urlCheckRaw, manifest] = await Promise.all([
        fetchGithubContext(data.githubUrl),
        fetchCommitHistory(parsedRepoUrl),
        fetchLiveUrlContext(data.url),
        checkUrlLiveness(data.url),
        fetchHackathonManifest(data.url),
      ]);

      // Some hosts block plain fetch but serve crawlers: a successful
      // Firecrawl scrape proves the site is up even if the direct GET failed
      const urlCheck: UrlCheck =
        !urlCheckRaw.isLive && scrape.fetched
          ? {
              ...urlCheckRaw,
              isLive: true,
              note: "reachable via crawler (direct request blocked)",
            }
          : urlCheckRaw;

      // Build timeline + harness metadata (harness never feeds scoring)
      const gitFacts = repo.fetched
        ? computeGitFacts(
            commitHistory,
            repo.repoMeta,
            data.eventStartDate,
            data.eventEndDate,
          )
        : undefined;
      const harnessSignals = repo.fetched
        ? detectHarnessSignals(repo.filePaths, commitHistory.commits)
        : [];

      // Effective rubric: built-in criteria plus this group's custom criteria
      const rubric = getRubricForGroup(data);
      const systemPrompt = buildSystemPrompt(data.aiJudgeSystemPrompt, rubric);
      const userMessage = buildUserMessage(
        data,
        repo,
        scrape,
        urlCheck,
        gitFacts,
        manifest,
      );

      // One retry on parse failure: re-ask the same provider chain
      let parsed: ParsedAnalysis | null = null;
      let llm: LlmResult | null = null;
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          llm = await callLlmWithFallback(systemPrompt, userMessage);
          parsed = parseAnalysisResponse(llm.text, rubric);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Analysis failed");
        }
      }
      if (!parsed || !llm) {
        throw lastError ?? new Error("Analysis failed");
      }

      // Server-side clamps. Deterministic facts always win over the model:
      // 1. Dead/missing URL caps the liveness score (existing behavior)
      let criteriaScores = parsed.criteriaScores.map((cs) => {
        if (cs.key !== "liveness" || urlCheck.isLive) return cs;
        const cap = urlCheck.checkedUrl ? 2 : 3;
        if (cs.score <= cap) return cs;
        return {
          ...cs,
          score: cap,
          reasoning: `Live URL check: ${urlCheck.note}. ${cs.reasoning}`.trim(),
        };
      });

      if (!repo.fetched) {
        // 2. Repo not fetched: all repo-based criteria capped at 4
        const note = "Repository was not accessible, so this score is capped at 4.";
        for (const key of ["schema", "functions", "realtime", "advanced", "depth"]) {
          criteriaScores = clampCriterion(criteriaScores, key, 4, note);
        }
      } else if (repo.repoFacts) {
        // 3. No Convex code at all: schema and functions capped at 2
        if (repo.repoFacts.tableCount === 0 && repo.repoFacts.convexFileCount === 0) {
          const note =
            "Verified facts: no convex/ directory and no tables were found, so this score is capped at 2.";
          criteriaScores = clampCriterion(criteriaScores, "schema", 2, note);
          criteriaScores = clampCriterion(criteriaScores, "functions", 2, note);
        }
        // 4. No components referenced in code: advanced capped at 6
        //    (closes the install-a-component-never-use-it exploit)
        if (repo.componentsUsed.length === 0) {
          const note =
            "Verified facts: no Convex component is referenced in code (installed-but-unused components earn nothing), so this score is capped at 6.";
          criteriaScores = clampCriterion(criteriaScores, "advanced", 6, note);
        }
      }

      let overallReasoning = parsed.overallReasoning;
      if (!urlCheck.isLive && !/404|not live|unreachable|no url|dead/i.test(overallReasoning)) {
        overallReasoning = `${overallReasoning} Note: the submitted live app URL was not working at review time (${urlCheck.note}).`.trim();
      }
      if (
        gitFacts?.builtDuringEvent === "started_before" &&
        !/before the event|predates|started_before/i.test(overallReasoning)
      ) {
        overallReasoning =
          `${overallReasoning} Note for organizers: the first commit predates the judging group's start date, so review event eligibility.`.trim();
      }

      // Feature list is now derived from verified facts, not model output
      const convexFeaturesDetected = repo.repoFacts
        ? buildFeaturesFromFacts(repo.repoFacts, repo.componentsUsed)
        : [];

      await ctx.runMutation(internal.aiJudge.saveResult, {
        resultId: args.resultId,
        outcome: {
          kind: "success" as const,
          criteriaScores,
          overallReasoning,
          convexFeaturesDetected,
          componentsDetected: repo.componentsInstalled,
          componentsUsed: repo.componentsUsed,
          repoFacts: repo.repoFacts,
          gitFacts,
          harnessSignals,
          repoAccess: repo.repoAccess,
          judgeProvider: llm.provider,
          judgeModel: llm.model,
          sourcesUsed: { github: repo.fetched, liveUrl: scrape.fetched },
          urlCheck,
        },
      });
    } catch (error) {
      await ctx.runMutation(internal.aiJudge.saveResult, {
        resultId: args.resultId,
        outcome: {
          kind: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    return null;
  },
});
