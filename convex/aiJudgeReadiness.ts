import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireJudgingGroupPermission } from "./adminAccess";
import { callLlm, resolveLlmModel } from "./lib/llm";

// Preflight for an AI judge run: which keys are set (booleans only, never
// values), how much GitHub quota is left, and whether the AI gateway answers.

export const assertCanCheckReadiness = internalQuery({
  args: { groupId: v.id("judgingGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.ai");
    return null;
  },
});

const readinessValidator = v.object({
  checkedAt: v.number(),
  githubToken: v.boolean(),
  // Core REST quota for the token; absent when the check failed
  githubRemaining: v.optional(v.number()),
  githubLimit: v.optional(v.number()),
  githubResetAt: v.optional(v.number()),
  githubError: v.optional(v.string()),
  contextDev: v.boolean(),
  firecrawl: v.boolean(),
  gatewayOk: v.boolean(),
  gatewayModel: v.string(),
  gatewayError: v.optional(v.string()),
});

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 200 ? `${message.slice(0, 197)}...` : message;
}

export const checkReadiness = action({
  args: { groupId: v.id("judgingGroups") },
  returns: readinessValidator,
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.aiJudgeReadiness.assertCanCheckReadiness, {
      groupId: args.groupId,
    });

    const token = process.env.GITHUB_TOKEN?.trim();
    const gatewayModel = resolveLlmModel();

    // GitHub quota: /rate_limit does not count against the quota
    const githubCheck = (async (): Promise<{
      githubRemaining?: number;
      githubLimit?: number;
      githubResetAt?: number;
      githubError?: string;
    }> => {
      if (!token) return {};
      try {
        const res = await fetch("https://api.github.com/rate_limit", {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "vibeapps-ai-judge",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          return {
            githubError:
              res.status === 401
                ? "GITHUB_TOKEN was rejected (401). Create a new token."
                : `GitHub returned HTTP ${res.status}`,
          };
        }
        const json = (await res.json()) as {
          resources?: {
            core?: { remaining?: number; limit?: number; reset?: number };
          };
        };
        const core = json.resources?.core;
        const quota = {
          githubRemaining: core?.remaining,
          githubLimit: core?.limit,
          githubResetAt: core?.reset ? core.reset * 1000 : undefined,
        };
        // Fine grained tokens scoped to "selected repositories" get a 404 on
        // every other public repo, which the judge reads as a missing repo
        const probe = await fetch(
          "https://api.github.com/repos/octocat/Hello-World",
          {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "vibeapps-ai-judge",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (probe.status === 404) {
          return {
            ...quota,
            githubError:
              "GITHUB_TOKEN cannot read public repos it was not granted. Use a fine grained token with Public repositories access, or a classic token with no scopes.",
          };
        }
        return quota;
      } catch (error) {
        return { githubError: shortError(error) };
      }
    })();

    // One tiny completion through the Convex AI gateway
    const gatewayCheck = (async () => {
      try {
        // Reasoning models spend output tokens before any text appears
        await callLlm("Reply with the single word OK.", "ping", {
          maxOutputTokens: 512,
          temperature: 0,
        });
        return { gatewayOk: true };
      } catch (error) {
        return { gatewayOk: false, gatewayError: shortError(error) };
      }
    })();

    const [github, gateway] = await Promise.all([githubCheck, gatewayCheck]);

    return {
      checkedAt: Date.now(),
      githubToken: Boolean(token),
      ...github,
      contextDev: Boolean(process.env.CONTEXT_DEV_API_KEY?.trim()),
      firecrawl: Boolean(process.env.FIRECRAWL_API_KEY?.trim()),
      gatewayModel,
      ...gateway,
    };
  },
});
