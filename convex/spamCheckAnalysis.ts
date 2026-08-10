import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, components } from "./_generated/api";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";

// Firecrawl component client: scrapes the submitted app URL so the model
// judges real page content instead of guessing from the title alone.
const firecrawl = new FirecrawlClient(components.firecrawl);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_SCRAPED_CHARS = 6_000;

type UrlCheck = {
  ok: boolean;
  note: string;
  statusCode?: number;
};

type RepoCheck = {
  checked: boolean;
  accessible?: boolean;
  fileCount?: number;
  isEmpty?: boolean;
  note?: string;
};

type LinkCheck = {
  label: string;
  url: string;
  ok: boolean;
  note: string;
};

// GET with a hard timeout. Browser-like UA because many hosts block
// default fetch agents, which would look like a dead site.
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VibeAppsSpamCheck/1.0; +https://vibeapps.dev)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Liveness check for any URL: is it well-formed and does it respond?
async function checkUrl(url: string | undefined): Promise<UrlCheck> {
  if (!url || url.trim() === "") {
    return { ok: false, note: "no URL provided" };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, note: `unsupported protocol ${parsed.protocol}` };
    }
  } catch {
    return { ok: false, note: "invalid URL" };
  }
  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      return { ok: true, note: "OK", statusCode: res.status };
    }
    // Social sites often block bots with 403/429; that is a weak signal,
    // not proof the link is dead.
    return {
      ok: false,
      note: `HTTP ${res.status} ${res.statusText}`.trim(),
      statusCode: res.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return {
      ok: false,
      note: message.includes("abort") ? "timed out" : message,
    };
  }
}

// Parse "owner/repo" out of a GitHub URL
function parseGithubRepo(
  githubUrl: string,
): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(githubUrl);
    if (!parsed.hostname.endsWith("github.com")) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

// Check the linked GitHub repo: reachable, and does it contain real code?
// Works without GITHUB_TOKEN (60 req/hr unauthenticated) but uses the token
// when configured for higher limits and private-repo awareness.
async function checkGithubRepo(githubUrl: string | undefined): Promise<RepoCheck> {
  if (!githubUrl || githubUrl.trim() === "") {
    return { checked: false, note: "no GitHub URL provided" };
  }
  const parsed = parseGithubRepo(githubUrl);
  if (!parsed) {
    return { checked: true, accessible: false, note: "invalid GitHub URL" };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "VibeAppsSpamCheck/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const repoRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { headers },
    );
    if (repoRes.status === 404) {
      return {
        checked: true,
        accessible: false,
        note: "repository not found or private",
      };
    }
    if (!repoRes.ok) {
      return {
        checked: true,
        accessible: false,
        note: `GitHub API error ${repoRes.status}`,
      };
    }
    const repoJson = (await repoRes.json()) as {
      default_branch?: string;
      size?: number;
    };

    // Count files in the default branch tree; a repo with fewer than
    // three files is effectively empty (a README alone is not an app)
    const branch = repoJson.default_branch || "main";
    const treeRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`,
      { headers },
    );
    if (!treeRes.ok) {
      return {
        checked: true,
        accessible: true,
        note: `repo reachable but tree fetch failed (${treeRes.status})`,
      };
    }
    const treeJson = (await treeRes.json()) as {
      tree?: Array<{ type: string }>;
    };
    const fileCount = (treeJson.tree || []).filter(
      (entry) => entry.type === "blob",
    ).length;
    return {
      checked: true,
      accessible: true,
      fileCount,
      isEmpty: fileCount < 3,
      note: `${fileCount} files on ${branch}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return { checked: true, accessible: false, note: message };
  }
}

// Pull markdown out of the Firecrawl scrape response without assuming the
// exact response shape (the component passes the v2 API response through).
function extractMarkdown(response: unknown): string | undefined {
  if (typeof response !== "object" || response === null) return undefined;
  const record = response as Record<string, unknown>;
  if (typeof record.markdown === "string") return record.markdown;
  const data = record.data;
  if (typeof data === "object" && data !== null) {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.markdown === "string") return dataRecord.markdown;
  }
  return undefined;
}

type LlmResult = {
  text: string;
  provider: string;
  model: string;
};

// Anthropic Messages API (same pattern as the AI judge)
async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult> {
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
      max_tokens: 1500,
      temperature: 0.1,
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

// OpenAI-compatible chat completions endpoint (OpenAI and OpenRouter)
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
      temperature: 0.1,
      max_tokens: 1500,
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

// Provider fallback chain: Anthropic, then OpenAI, then OpenRouter.
// Returns null when no provider is configured so the heuristic can take over.
async function callLlmWithFallback(
  systemPrompt: string,
  userMessage: string,
): Promise<LlmResult | null> {
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

  // No key configured at all: heuristic fallback instead of a hard failure
  if (errors.length === 0) return null;
  throw new Error(`All configured AI providers failed: ${errors.join(" | ")}`);
}

type Verdict = "spam" | "suspicious" | "clean";

type ParsedVerdict = {
  verdict: Verdict;
  confidence: number;
  reasons: Array<string>;
  reasoning: string;
};

// Parse the model's JSON verdict, tolerating markdown code fences
function parseVerdictResponse(text: string): ParsedVerdict {
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();
  const braceStart = jsonText.indexOf("{");
  const braceEnd = jsonText.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    jsonText = jsonText.slice(braceStart, braceEnd + 1);
  }

  const parsed = JSON.parse(jsonText) as {
    verdict?: string;
    confidence?: number;
    reasons?: Array<string>;
    reasoning?: string;
  };

  const verdict: Verdict =
    parsed.verdict === "spam" || parsed.verdict === "suspicious"
      ? parsed.verdict
      : "clean";
  const confidence = Math.min(
    Math.max(Math.round(Number(parsed.confidence) || 0), 0),
    100,
  );
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.filter((r): r is string => typeof r === "string").slice(0, 10)
    : [];
  return {
    verdict,
    confidence,
    reasons,
    reasoning:
      typeof parsed.reasoning === "string" ? parsed.reasoning : text.slice(0, 2000),
  };
}

type Signals = {
  urlLive: boolean;
  urlNote: string;
  urlStatusCode?: number;
  scrapedContent: boolean;
  duplicateUrlCount: number;
  repoChecked: boolean;
  repoAccessible?: boolean;
  repoFileCount?: number;
  repoIsEmpty?: boolean;
  repoNote?: string;
  linksChecked: Array<LinkCheck>;
};

// Deterministic fallback when no LLM provider is configured. Scores hard
// signals only, so it never accuses a working app with a real repo.
function heuristicVerdict(
  signals: Signals,
  description: string,
): ParsedVerdict {
  let score = 0;
  const reasons: Array<string> = [];

  if (!signals.urlLive) {
    score += 40;
    reasons.push(`App URL is not reachable (${signals.urlNote})`);
  }
  if (signals.urlLive && !signals.scrapedContent) {
    score += 10;
    reasons.push("App URL responded but no page content could be read");
  }
  if (signals.repoChecked && signals.repoAccessible === false) {
    score += 15;
    reasons.push(`GitHub repo is not accessible (${signals.repoNote ?? "unknown"})`);
  }
  if (signals.repoIsEmpty === true) {
    score += 20;
    reasons.push(
      `GitHub repo is effectively empty (${signals.repoFileCount ?? 0} files)`,
    );
  }
  if (signals.duplicateUrlCount >= 3) {
    score += 30;
    reasons.push(
      `Same URL submitted ${signals.duplicateUrlCount} other times`,
    );
  } else if (signals.duplicateUrlCount >= 1) {
    score += 10;
    reasons.push(
      `Same URL submitted ${signals.duplicateUrlCount} other time(s)`,
    );
  }
  if (description.trim().length < 20) {
    score += 10;
    reasons.push("Description is unusually short");
  }

  const verdict: Verdict = score >= 70 ? "spam" : score >= 40 ? "suspicious" : "clean";
  if (reasons.length === 0) reasons.push("No spam signals detected");
  return {
    verdict,
    confidence: Math.min(score, 95),
    reasons,
    reasoning:
      "Heuristic verdict from deterministic signals (no AI provider configured). Score: " +
      `${score}/100.`,
  };
}

// Build the user message: submission fields, verified signals, scraped content
function buildUserMessage(
  story: {
    title: string;
    description: string;
    longDescription?: string;
    url: string;
    githubUrl?: string;
    submitterName?: string;
    tags: Array<string>;
  },
  signals: Signals,
  scrapedMarkdown: string | undefined,
): string {
  const sections: Array<string> = [
    `SUBMISSION: ${story.title}`,
    `Tagline: ${story.description}`,
  ];
  if (story.longDescription) sections.push(`Description: ${story.longDescription}`);
  if (story.submitterName) sections.push(`Submitter: ${story.submitterName}`);
  if (story.tags.length > 0) sections.push(`Tags: ${story.tags.join(", ")}`);
  sections.push(`App URL: ${story.url}`);
  sections.push(`GitHub URL: ${story.githubUrl || "not provided"}`);

  sections.push(
    `\n=== VERIFIED SIGNALS (measured by direct HTTP requests) ===` +
      `\nApp URL live: ${signals.urlLive ? "YES" : "NO"} (${signals.urlNote})` +
      `\nPage content scraped: ${signals.scrapedContent ? "YES" : "NO"}` +
      `\nDuplicate submissions with same URL: ${signals.duplicateUrlCount}` +
      `\nRepo checked: ${signals.repoChecked ? "YES" : "NO"}` +
      (signals.repoChecked
        ? `\nRepo accessible: ${signals.repoAccessible ? "YES" : "NO"} (${signals.repoNote ?? ""})` +
          (signals.repoFileCount !== undefined
            ? `\nRepo file count: ${signals.repoFileCount}${signals.repoIsEmpty ? " (effectively empty)" : ""}`
            : "")
        : ""),
  );

  if (signals.linksChecked.length > 0) {
    sections.push(
      `\n=== OTHER LINKS (weak signals; social sites often block bots) ===\n` +
        signals.linksChecked
          .map((l) => `${l.label}: ${l.url} -> ${l.ok ? "OK" : l.note}`)
          .join("\n"),
    );
  }

  sections.push(
    scrapedMarkdown
      ? `\n=== SCRAPED PAGE CONTENT (truncated) ===\n${scrapedMarkdown.slice(0, MAX_SCRAPED_CHARS)}`
      : "\n=== SCRAPED PAGE CONTENT ===\nNot available.",
  );

  return sections.join("\n");
}

/**
 * Full spam analysis for one submission. Runs inside the spam workpool:
 * 1. Deterministic checks: URL liveness, Firecrawl scrape, GitHub repo,
 *    extra links, duplicate URL count.
 * 2. LLM verdict with provider fallback (Anthropic, OpenAI, OpenRouter).
 * 3. Heuristic verdict when no AI provider is configured.
 * Failures are recorded on the result row; nothing here throws upstream.
 */
export const analyzeSubmission = internalAction({
  args: { resultId: v.id("spamCheckResults") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.spamCheck.markRunning, {
      resultId: args.resultId,
    });

    const story = await ctx.runQuery(internal.spamCheck.getStoryForAnalysis, {
      resultId: args.resultId,
    });
    if (!story) {
      await ctx.runMutation(internal.spamCheck.saveResult, {
        resultId: args.resultId,
        outcome: {
          kind: "error" as const,
          errorMessage: "Story no longer exists",
        },
      });
      return null;
    }

    try {
      // 1. Deterministic checks run in parallel
      const [urlCheck, repoCheck, ...extraLinkChecks] = await Promise.all([
        checkUrl(story.url),
        checkGithubRepo(story.githubUrl),
        ...(
          [
            { label: "video", url: story.videoUrl },
            { label: "linkedin", url: story.linkedinUrl },
            { label: "twitter", url: story.twitterUrl },
          ] as Array<{ label: string; url?: string }>
        )
          .filter((link) => link.url && link.url.trim() !== "")
          .map(async (link): Promise<LinkCheck> => {
            const check = await checkUrl(link.url);
            return {
              label: link.label,
              url: link.url as string,
              ok: check.ok,
              note: check.note,
            };
          }),
      ]);

      // 2. Firecrawl scrape of the live app URL (skipped when URL is dead)
      let scrapedMarkdown: string | undefined;
      if (urlCheck.ok) {
        try {
          const scrapeResult = await firecrawl.scrape(ctx, story.url, {
            formats: ["markdown"],
            onlyMainContent: true,
            maxAge: 3_600_000, // reuse Firecrawl's cache for an hour
          });
          scrapedMarkdown = extractMarkdown(scrapeResult);
        } catch {
          // Scrape failure (missing key, credits, blocked site) is a signal,
          // not a scan failure
          scrapedMarkdown = undefined;
        }
      }

      const signals: Signals = {
        urlLive: urlCheck.ok,
        urlNote: urlCheck.note,
        urlStatusCode: urlCheck.statusCode,
        scrapedContent: scrapedMarkdown !== undefined,
        duplicateUrlCount: story.duplicateUrlCount,
        repoChecked: repoCheck.checked,
        repoAccessible: repoCheck.accessible,
        repoFileCount: repoCheck.fileCount,
        repoIsEmpty: repoCheck.isEmpty,
        repoNote: repoCheck.note,
        linksChecked: extraLinkChecks,
      };

      // 3. LLM verdict, or heuristic when no provider key is configured.
      // Uses the admin-editable system prompt (default when no override set).
      const systemPrompt: string = await ctx.runQuery(
        internal.spamCheck.getSpamPromptInternal,
        {},
      );
      const userMessage = buildUserMessage(story, signals, scrapedMarkdown);
      const llmResult = await callLlmWithFallback(systemPrompt, userMessage);

      let parsed: ParsedVerdict;
      let provider: string;
      let model: string;
      if (llmResult) {
        try {
          parsed = parseVerdictResponse(llmResult.text);
        } catch {
          throw new Error(
            `Could not parse ${llmResult.provider} verdict response`,
          );
        }
        provider = llmResult.provider;
        model = llmResult.model;
      } else {
        parsed = heuristicVerdict(signals, story.description);
        provider = "heuristic";
        model = "signals-v1";
      }

      await ctx.runMutation(internal.spamCheck.saveResult, {
        resultId: args.resultId,
        outcome: {
          kind: "success" as const,
          verdict: parsed.verdict,
          confidence: parsed.confidence,
          reasons: parsed.reasons,
          llmReasoning: parsed.reasoning,
          signals,
          provider,
          model,
        },
      });
    } catch (error) {
      await ctx.runMutation(internal.spamCheck.saveResult, {
        resultId: args.resultId,
        outcome: {
          kind: "error" as const,
          errorMessage:
            error instanceof Error ? error.message : "Spam analysis failed",
        },
      });
    }
    return null;
  },
});
