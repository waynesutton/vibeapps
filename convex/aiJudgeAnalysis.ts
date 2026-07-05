import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { AI_JUDGE_RUBRIC } from "./aiJudge";

// Content budgets so prompts stay well under model context limits
const MAX_FILE_CHARS = 8000;
const MAX_TOTAL_REPO_CHARS = 60000;
const MAX_SCRAPE_CHARS = 8000;
const MAX_CONVEX_FILES = 10;

type RepoContext = {
  fetched: boolean;
  summary: string;
};

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

// Fetch the GitHub repo: metadata, file tree, and key Convex-related files
async function fetchGithubContext(githubUrl: string | undefined): Promise<RepoContext> {
  if (!githubUrl) return { fetched: false, summary: "" };
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) return { fetched: false, summary: "" };

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "vibeapps-ai-judge",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;

  try {
    const repoRes = await fetch(base, { headers });
    if (!repoRes.ok) {
      return { fetched: false, summary: "" };
    }
    const repoJson = (await repoRes.json()) as {
      default_branch?: string;
      description?: string | null;
      language?: string | null;
    };
    const defaultBranch = repoJson.default_branch || "main";

    const treeRes = await fetch(
      `${base}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      { headers },
    );
    let filePaths: Array<string> = [];
    if (treeRes.ok) {
      const treeJson = (await treeRes.json()) as {
        tree?: Array<{ path: string; type: string }>;
      };
      filePaths = (treeJson.tree || [])
        .filter((entry) => entry.type === "blob")
        .map((entry) => entry.path);
    }

    // Pick the files that matter most for judging Convex usage
    const selected: Array<string> = [];
    const addIfExists = (predicate: (path: string) => boolean, limit: number) => {
      for (const path of filePaths) {
        if (selected.length >= 30) break;
        if (selected.filter(predicate).length >= limit) break;
        if (predicate(path) && !selected.includes(path)) {
          selected.push(path);
        }
      }
    };

    addIfExists((p) => p === "package.json", 1);
    addIfExists((p) => /(^|\/)convex\/schema\.ts$/.test(p), 1);
    addIfExists((p) => /(^|\/)convex\/convex\.config\.ts$/.test(p), 1);
    addIfExists((p) => /^README\.md$/i.test(p), 1);
    addIfExists(
      (p) =>
        /(^|\/)convex\/[^/]+\.tsx?$/.test(p) &&
        !p.includes("_generated") &&
        !p.endsWith("schema.ts") &&
        !p.endsWith("convex.config.ts"),
      MAX_CONVEX_FILES,
    );

    let totalChars = 0;
    const fileSections: Array<string> = [];
    for (const path of selected) {
      if (totalChars >= MAX_TOTAL_REPO_CHARS) break;
      try {
        const fileRes = await fetch(
          `${base}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(defaultBranch)}`,
          { headers },
        );
        if (!fileRes.ok) continue;
        const fileJson = (await fileRes.json()) as {
          content?: string;
          encoding?: string;
        };
        if (!fileJson.content || fileJson.encoding !== "base64") continue;
        let content = decodeBase64Utf8(fileJson.content);
        if (content.length > MAX_FILE_CHARS) {
          content = content.slice(0, MAX_FILE_CHARS) + "\n... (truncated)";
        }
        totalChars += content.length;
        fileSections.push(`--- FILE: ${path} ---\n${content}`);
      } catch {
        // Skip unreadable files; partial repo context is still useful
      }
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

    return { fetched: true, summary };
  } catch {
    return { fetched: false, summary: "" };
  }
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

// Build the system prompt with the fixed Best Use of Convex rubric
function buildSystemPrompt(): string {
  const rubricText = AI_JUDGE_RUBRIC.map(
    (c, idx) => `${idx + 1}. key: "${c.key}" — ${c.label}\n   ${c.description}`,
  ).join("\n");

  return `You are an expert judge evaluating hackathon submissions for "Best Use of Convex".

Convex is the open source reactive database where queries are TypeScript code running in the database. Key Convex concepts: schema definitions with validators and indexes in convex/schema.ts, query/mutation/action functions in the convex/ directory, real-time subscriptions via useQuery in React, the scheduler and cron jobs, file storage, full-text and vector search, HTTP actions, and Convex components (installed via convex.config.ts).

Score the submission on each rubric criterion from 1 to 10:
${rubricText}

Scoring guidelines:
- 1-3: Little to no meaningful Convex usage for this criterion
- 4-6: Basic usage, meets expectations
- 7-8: Strong usage, exceeds expectations
- 9-10: Exceptional, deep and idiomatic Convex usage

Rules:
- Base scores primarily on the GitHub repository code when available. The live site scrape and description are secondary signals.
- If the repository was not accessible, say so in your reasoning and score conservatively from the remaining evidence.
- For the "liveness" criterion, use the LIVE URL CHECK facts provided: if the URL is dead, 404, or missing, score it 1-2 and state the observed status in your reasoning; if it is live, score it 5-10 based on how functional the scraped content suggests the app is. This criterion only reflects the live app URL, never social or video links.
- If the live URL is dead, 404, or missing, also flag that fact explicitly in overallReasoning. Do NOT lower the other five Convex criteria because of it; the ranking should stay mostly about Convex usage.
- Be specific in reasoning: name actual files, functions, tables, or features you observed.
- List every Convex feature you detected (e.g. "schema with indexes", "scheduler", "file storage", "full-text search", "vector search", "http actions", "crons", "components", "agents", "real-time queries").

Respond with ONLY a JSON object in exactly this shape (no markdown fences, no extra text):
{
  "criteria": {
    ${AI_JUDGE_RUBRIC.map((c) => `"${c.key}": { "score": <1-10>, "reasoning": "<why>" }`).join(",\n    ")}
  },
  "overallReasoning": "<2-4 sentence overall note on why this submission scored the way it did>",
  "convexFeaturesDetected": ["<feature>", ...]
}`;
}

// Build the user message with all gathered submission context
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
  convexFeaturesDetected: Array<string>;
};

// Parse and validate the model's JSON response against the fixed rubric
function parseAnalysisResponse(text: string): ParsedAnalysis {
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
    convexFeaturesDetected?: Array<string>;
  };

  if (!parsed.criteria || typeof parsed.criteria !== "object") {
    throw new Error("Response missing criteria object");
  }

  const criteriaScores = AI_JUDGE_RUBRIC.map((rubricItem) => {
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
    convexFeaturesDetected: Array.isArray(parsed.convexFeaturesDetected)
      ? parsed.convexFeaturesDetected.filter((f): f is string => typeof f === "string")
      : [],
  };
}

/**
 * Analyze one submission for Best Use of Convex. Always saves an outcome
 * (success or failure) so the scheduler chain continues to the next
 * pending submission in the group.
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

      // Gather context: GitHub repo (primary), live URL scrape (secondary),
      // and a deterministic liveness check of the live app URL
      const [repo, scrape, urlCheckRaw] = await Promise.all([
        fetchGithubContext(data.githubUrl),
        fetchLiveUrlContext(data.url),
        checkUrlLiveness(data.url),
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

      const systemPrompt = buildSystemPrompt();
      const userMessage = buildUserMessage(data, repo, scrape, urlCheck);

      // One retry on parse failure: re-ask the same provider chain
      let parsed: ParsedAnalysis | null = null;
      let llm: LlmResult | null = null;
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          llm = await callLlmWithFallback(systemPrompt, userMessage);
          parsed = parseAnalysisResponse(llm.text);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Analysis failed");
        }
      }
      if (!parsed || !llm) {
        throw lastError ?? new Error("Analysis failed");
      }

      // Server-side clamp: a dead/missing URL always caps the liveness score,
      // regardless of what the model returned. Other criteria are untouched
      // so the ranking stays mostly about Convex usage.
      const criteriaScores = parsed.criteriaScores.map((cs) => {
        if (cs.key !== "liveness" || urlCheck.isLive) return cs;
        const cap = urlCheck.checkedUrl ? 2 : 3;
        if (cs.score <= cap) return cs;
        return {
          ...cs,
          score: cap,
          reasoning: `Live URL check: ${urlCheck.note}. ${cs.reasoning}`.trim(),
        };
      });
      let overallReasoning = parsed.overallReasoning;
      if (!urlCheck.isLive && !/404|not live|unreachable|no url|dead/i.test(overallReasoning)) {
        overallReasoning = `${overallReasoning} Note: the submitted live app URL was not working at review time (${urlCheck.note}).`.trim();
      }

      await ctx.runMutation(internal.aiJudge.saveResult, {
        resultId: args.resultId,
        outcome: {
          kind: "success" as const,
          criteriaScores,
          overallReasoning,
          convexFeaturesDetected: parsed.convexFeaturesDetected,
          provider: llm.provider,
          model: llm.model,
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
