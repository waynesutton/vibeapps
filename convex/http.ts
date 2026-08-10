import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { resend } from "./sendEmails";
import { registerRoutes } from "@waynesutton/agent-ready";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { sha256Hex } from "./agentJudges";

const http = httpRouter();

// Agent Ready component routes (agents.md, llms-full.txt, llms-status, etc.)
// /llms.txt and /robots.txt are skipped because this app already serves them
// from the siteFiles table via the routes defined below.
registerRoutes(http, components.agentReady, {
  skipRoutes: ["/llms.txt", "/robots.txt"],
});

// Define a route for Clerk webhooks
// The path can be anything you choose, e.g., "/clerk-webhooks" or "/api/clerk"
// Make sure this path matches what you configure in the Clerk dashboard
http.route({
  path: "/clerk", // You can change this path
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get the signature and payload from the request
    const signature = request.headers.get("svix-signature");
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");

    if (!signature || !id || !timestamp) {
      return new Response("Webhook Error: Missing svix headers", {
        status: 400,
      });
    }

    const payloadString = await request.text(); // Read the raw body as text

    // Call an internal action to handle the webhook, passing headers and the raw payload
    // We pass the raw payload string because svix needs it for verification
    try {
      await ctx.runAction(internal.clerk.handleClerkWebhook, {
        headers: {
          svix_id: id,
          svix_timestamp: timestamp,
          svix_signature: signature,
        },
        payload: payloadString,
      });
      return new Response(null, { status: 200 });
    } catch (err: any) {
      console.error("Error processing Clerk webhook:", err.message);
      // It's good practice to return a 200 even on internal errors
      // to prevent Clerk from resending the webhook unnecessarily,
      // unless the error is due to a malformed request that Clerk should know about.
      // For signature verification errors, svix might throw, which will be caught here.
      // Depending on the error from svix, you might return a 400.
      if (err.message.includes("Webhook Error:")) {
        // Specific errors from our action
        return new Response(err.message, { status: 400 });
      }
      return new Response("Webhook processing failed", { status: 500 }); // Or 200 to ack receipt
    }
  }),
});

// HTML generation function for story metadata
function generateStoryHTML(story: {
  title: string;
  description: string;
  screenshotUrl: string | null;
  slug: string;
  url: string;
  authorName?: string;
}) {
  const imageUrl =
    story.screenshotUrl ||
    "https://vibeapps.dev/vibe-apps-open-graphi-image.png";
  const canonicalUrl = `https://vibeapps.dev/s/${story.slug}`;
  const siteName = "Vibe Apps";
  const twitterHandle = "@waynesutton";

  // Escape HTML characters in dynamic content
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const safeTitle = escapeHtml(story.title);
  const safeDescription = escapeHtml(story.description);
  const safeAuthorName = story.authorName ? escapeHtml(story.authorName) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Basic SEO -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle} | ${siteName}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${twitterHandle}">
  <meta name="twitter:creator" content="${twitterHandle}">
  <meta name="twitter:title" content="${safeTitle} | ${siteName}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Redirect to actual app after a brief delay for crawlers -->
  <script>
    setTimeout(() => {
      window.location.href = "${canonicalUrl}";
    }, 100);
  </script>
</head>
<body>
  <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    ${safeAuthorName ? `<p>By ${safeAuthorName}</p>` : ""}
    <p><a href="${story.url}" target="_blank" rel="noopener noreferrer">Visit App →</a></p>
    <p><small>Redirecting to full page...</small></p>
  </div>
</body>
</html>`;
}

// Route for serving story metadata for social media crawlers
http.route({
  path: "/meta/s",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);

    // Prefer explicit query param, fall back to last path segment
    let slug = url.searchParams.get("slug");
    if (!slug) {
      const parts = url.pathname.split("/");
      slug = parts[parts.length - 1] || "";
    }

    if (!slug) {
      return new Response("Missing slug parameter", { status: 400 });
    }

    try {
      const story = await ctx.runQuery(internal.stories.getStoryMetadata, {
        slug,
      });

      if (!story) {
        return new Response("Story not found", { status: 404 });
      }

      const html = generateStoryHTML(story);
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          // Cache for browsers and CDNs while allowing quick refreshes
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      });
    } catch (error) {
      console.error("Error generating story metadata:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }),
});

// HTML generation function for submission page metadata
function generateSubmissionPageHTML(page: {
  title: string;
  description: string;
  imageUrl: string | null;
  slug: string;
}) {
  const imageUrl =
    page.imageUrl || "https://vibeapps.dev/vibe-apps-open-graphi-image.png";
  const canonicalUrl = `https://vibeapps.dev/submit/${page.slug}`;
  const siteName = "Vibe Apps";
  const twitterHandle = "@waynesutton";

  // Escape HTML characters in dynamic content
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const safeTitle = escapeHtml(page.title);
  const safeDescription = escapeHtml(page.description);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Basic SEO -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle} | ${siteName}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${twitterHandle}">
  <meta name="twitter:creator" content="${twitterHandle}">
  <meta name="twitter:title" content="${safeTitle} | ${siteName}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Redirect to actual app after a brief delay for crawlers -->
  <script>
    setTimeout(() => {
      window.location.href = "${canonicalUrl}";
    }, 100);
  </script>
</head>
<body>
  <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><small>Redirecting to submission page...</small></p>
  </div>
</body>
</html>`;
}

// Route for serving submission page metadata for social media crawlers
http.route({
  path: "/meta/submit",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);

    // Prefer explicit query param, fall back to last path segment
    let slug = url.searchParams.get("slug");
    if (!slug) {
      const parts = url.pathname.split("/");
      slug = parts[parts.length - 1] || "";
    }

    if (!slug) {
      return new Response("Missing slug parameter", { status: 400 });
    }

    try {
      const page = await ctx.runQuery(
        internal.judgingGroups.getSubmissionPageMetadata,
        { slug },
      );

      if (!page) {
        return new Response("Submission page not found", { status: 404 });
      }

      const html = generateSubmissionPageHTML(page);
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          // Cache for browsers and CDNs while allowing quick refreshes
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      });
    } catch (error) {
      console.error("Error generating submission page metadata:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }),
});

// Export router at bottom after routes are defined
// New routes for robots.txt and llms.txt
http.route({
  path: "/robots.txt",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const body = await ctx.runQuery(internal.siteFiles.getFile, {
      key: "robots.txt",
    });
    return new Response(body ?? "User-agent: *\nAllow: /\n", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600",
      },
    });
  }),
});

// Resend webhook handler for email events. The component verifies the svix
// signature with RESEND_WEBHOOK_SECRET, updates its own email records, and
// calls the onEmailEvent mutation (emails/queries.handleEmailEvent) which
// syncs emailLogs statuses.
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req);
  }),
});

http.route({
  path: "/llms.txt",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const body = await ctx.runQuery(internal.siteFiles.getFile, {
      key: "llms.txt",
    });
    return new Response(body ?? "User-agent: *\nAllow: /\n", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600",
      },
    });
  }),
});

// Unsubscribe endpoint for email links
http.route({
  path: "/api/unsubscribe",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invalid Unsubscribe Link</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Invalid Unsubscribe Link</h1>
            <p>The unsubscribe link is missing required information. Please contact support if you continue to receive unwanted emails.</p>
            <a href="https://vibeapps.dev">Return to VibeApps</a>
          </body>
        </html>
      `,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        },
      );
    }

    try {
      const result = await ctx.runMutation(
        internal.emails.unsubscribe.handleUnsubscribeToken,
        {
          token,
        },
      );

      if (result.success) {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Successfully Unsubscribed</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .success { color: #2e7d32; }
                .button { display: inline-block; background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <h1 class="success">Successfully Unsubscribed</h1>
              <p>You have been unsubscribed from VibeApps emails. You will no longer receive email notifications.</p>
              <p>You can manage your email preferences anytime from your profile page.</p>
              <a href="https://vibeapps.dev" class="button">Return to VibeApps</a>
            </body>
          </html>
        `,
          {
            status: 200,
            headers: { "Content-Type": "text/html" },
          },
        );
      } else {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Unsubscribe Link Expired</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .warning { color: #f57c00; }
                .button { display: inline-block; background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <h1 class="warning">Unsubscribe Link Expired</h1>
              <p>This unsubscribe link has expired or has already been used. You can manage your email preferences from your profile page.</p>
              <a href="https://vibeapps.dev" class="button">Go to VibeApps</a>
            </body>
          </html>
        `,
          {
            status: 400,
            headers: { "Content-Type": "text/html" },
          },
        );
      }
    } catch (error) {
      console.error("Unsubscribe error:", error);
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Unsubscribe Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Unsubscribe Error</h1>
            <p>There was an error processing your unsubscribe request. Please contact support.</p>
            <a href="https://vibeapps.dev">Return to VibeApps</a>
          </body>
        </html>
      `,
        {
          status: 500,
          headers: { "Content-Type": "text/html" },
        },
      );
    }
  }),
});

// --- Agent judging API ---
//
// Authenticated HTTP API that lets external AI agents judge hackathon
// submissions. Convex httpRouter has no :slug path params, so both routes
// are registered with pathPrefix and one dispatcher parses the remaining
// segments manually:
//
//   GET  /api/judging/{slug}/openapi.json          (public)
//   GET  /api/judging/{slug}/criteria.json         (x-judge-key)
//   GET  /api/judging/{slug}/submissions.json      (x-judge-key)
//   GET  /api/judging/{slug}/submissions/{id}.json (x-judge-key)
//   GET  /api/judging/{slug}/results.json          (x-judge-key or ?password=)
//   POST /api/judging/{slug}/scores                (x-judge-key)

// Sliding-window style limits per agent key: writes are tighter than reads.
const agentApiLimiter = new RateLimiter(components.rateLimiter, {
  agentJudgeRead: {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 120,
  },
  agentJudgeWrite: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 30,
  },
});

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

type AgentAuthContext = {
  keyId: Id<"agentJudgeKeys">;
  judgeId: Id<"judges">;
  judgeName: string;
  groupId: Id<"judgingGroups">;
  groupSlug: string;
  groupName: string;
  groupIsActive: boolean;
  judgesPerSubmission: number;
  scoreScale: number;
  agentScoresAdvisory: boolean;
};

// Resolve the x-judge-key header (or Bearer token) to an agent context.
// Returns a Response (401/403) when authentication fails.
async function authenticateAgent(
  ctx: ActionCtx,
  request: Request,
  slug: string,
): Promise<AgentAuthContext | Response> {
  const rawKey =
    request.headers.get("x-judge-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;
  if (!rawKey) {
    return jsonResponse(
      { error: "Missing x-judge-key header" },
      401,
    );
  }
  const keyHash = await sha256Hex(rawKey);
  const context = await ctx.runQuery(internal.agentJudges.getAgentContext, {
    keyHash,
  });
  if (!context) {
    // Covers unknown keys, revoked keys, and groups whose agent API is disabled
    return jsonResponse(
      { error: "Invalid or revoked judge key, or the agent API is disabled for this group" },
      403,
    );
  }
  if (context.groupSlug !== slug) {
    return jsonResponse(
      { error: "This key does not grant access to this judging group" },
      403,
    );
  }
  return context;
}

async function checkAgentRateLimit(
  ctx: ActionCtx,
  name: "agentJudgeRead" | "agentJudgeWrite",
  key: string,
): Promise<Response | null> {
  const status = await agentApiLimiter.limit(ctx, name, { key });
  if (!status.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil(status.retryAfter / 1000));
    return jsonResponse({ error: "Rate limit exceeded" }, 429, {
      "retry-after": String(retryAfterSeconds),
    });
  }
  return null;
}

// Minimal OpenAPI document so agents can discover the API shape.
function buildJudgingOpenApiSpec(slug: string) {
  const base = `/api/judging/${slug}`;
  const keyAuth = [{ judgeKey: [] as Array<string> }];
  return {
    openapi: "3.0.3",
    info: {
      title: "Vibe Apps agent judging API",
      version: "1.0.0",
      description:
        "Judge hackathon submissions as an AI agent. Authenticate every request (except this document) with the x-judge-key header. Scores are integers from 1 to the group's score scale (5 or 10; see scoreScale in criteria.json, default 10). POSTing the same criteria again updates your existing scores.",
    },
    components: {
      securitySchemes: {
        judgeKey: {
          type: "apiKey",
          in: "header",
          name: "x-judge-key",
        },
      },
    },
    paths: {
      [`${base}/criteria.json`]: {
        get: {
          summary: "Judging criteria for this group",
          security: keyAuth,
          responses: { "200": { description: "Group info and criteria list" } },
        },
      },
      [`${base}/submissions.json`]: {
        get: {
          summary: "Your judging queue",
          description:
            "Submissions you have not completed, excluding submissions already completed by enough other judges.",
          security: keyAuth,
          responses: { "200": { description: "Submissions to judge" } },
        },
      },
      [`${base}/submissions/{storyId}.json`]: {
        get: {
          summary: "Full detail for one submission",
          security: keyAuth,
          parameters: [
            {
              name: "storyId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Submission detail" },
            "404": { description: "Not part of this group" },
          },
        },
      },
      [`${base}/scores`]: {
        post: {
          summary: "Submit scores for one submission",
          security: keyAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["storyId", "scores"],
                  properties: {
                    storyId: { type: "string" },
                    scores: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["criteriaId", "score"],
                        properties: {
                          criteriaId: { type: "string" },
                          score: {
                            type: "integer",
                            minimum: 1,
                            maximum: 10,
                            description:
                              "Upper bound is the group's scoreScale (5 or 10, default 10).",
                          },
                          comments: { type: "string" },
                        },
                      },
                    },
                    complete: {
                      type: "boolean",
                      description:
                        "Set true once all criteria are scored to mark this submission complete.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Scores written (idempotent upsert)" },
            "400": { description: "Invalid body" },
            "429": { description: "Rate limited; see retry-after header" },
          },
        },
      },
      [`${base}/results.json`]: {
        get: {
          summary: "Completed AI judge results for this group",
          description:
            "Requires a judge key, or ?password= when the group protects results with a password, or no auth when results are public.",
          responses: {
            "200": { description: "AI judge results" },
            "403": { description: "Access denied" },
          },
        },
      },
    },
  };
}

// GET dispatcher for all agent judging reads
http.route({
  pathPrefix: "/api/judging/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const segments = url.pathname
      .slice("/api/judging/".length)
      .split("/")
      .filter(Boolean);
    if (segments.length < 2) {
      return jsonResponse({ error: "Not found" }, 404);
    }
    const slug = segments[0];
    const resource = segments[1];

    // Public API documentation, no key required
    if (resource === "openapi.json" && segments.length === 2) {
      return jsonResponse(buildJudgingOpenApiSpec(slug));
    }

    // Results: judge key, results password, or public results
    if (resource === "results.json" && segments.length === 2) {
      let groupId: Id<"judgingGroups"> | null = null;
      let rateKey = `results:${slug}`;
      const hasKey =
        request.headers.get("x-judge-key") ||
        request.headers.get("authorization");
      if (hasKey) {
        const auth = await authenticateAgent(ctx, request, slug);
        if (auth instanceof Response) return auth;
        groupId = auth.groupId;
        rateKey = auth.keyId;
      } else {
        const password = url.searchParams.get("password") ?? undefined;
        groupId = await ctx.runQuery(internal.aiJudge.resolveResultsAccess, {
          slug,
          password,
        });
        if (!groupId) {
          return jsonResponse(
            { error: "Access denied: provide x-judge-key or ?password=" },
            403,
          );
        }
      }
      const limited = await checkAgentRateLimit(ctx, "agentJudgeRead", rateKey);
      if (limited) return limited;

      const results = await ctx.runQuery(
        internal.aiJudge.getCompletedResultsInternal,
        { groupId },
      );
      if (results === null) {
        return jsonResponse(
          { error: "AI judging is not enabled for this group" },
          404,
        );
      }
      return jsonResponse({ results });
    }

    // Everything below requires a judge key
    const auth = await authenticateAgent(ctx, request, slug);
    if (auth instanceof Response) return auth;

    const limited = await checkAgentRateLimit(
      ctx,
      "agentJudgeRead",
      auth.keyId,
    );
    if (limited) return limited;

    if (resource === "criteria.json" && segments.length === 2) {
      const criteria = await ctx.runQuery(
        internal.agentJudges.getCriteriaForAgent,
        { groupId: auth.groupId },
      );
      return jsonResponse({
        group: {
          slug: auth.groupSlug,
          name: auth.groupName,
          isActive: auth.groupIsActive,
          scoreScale: auth.scoreScale,
          agentScoresAdvisory: auth.agentScoresAdvisory,
        },
        judge: { judgeId: auth.judgeId, name: auth.judgeName },
        criteria,
      });
    }

    if (resource === "submissions.json" && segments.length === 2) {
      const submissions = await ctx.runQuery(
        internal.agentJudges.getAgentQueue,
        { groupId: auth.groupId, judgeId: auth.judgeId },
      );
      return jsonResponse({ submissions });
    }

    if (
      resource === "submissions" &&
      segments.length === 3 &&
      segments[2].endsWith(".json")
    ) {
      const storyIdRaw = segments[2].slice(0, -".json".length);
      try {
        const submission = await ctx.runQuery(
          internal.agentJudges.getSubmissionDetailForAgent,
          {
            groupId: auth.groupId,
            storyId: storyIdRaw as Id<"stories">,
          },
        );
        if (!submission) {
          return jsonResponse(
            { error: "Submission not found in this group" },
            404,
          );
        }
        return jsonResponse({ submission });
      } catch {
        // Invalid Id string fails argument validation
        return jsonResponse({ error: "Invalid submission id" }, 400);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  }),
});

// POST route for agent score writes
http.route({
  pathPrefix: "/api/judging/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const segments = url.pathname
      .slice("/api/judging/".length)
      .split("/")
      .filter(Boolean);
    if (segments.length !== 2 || segments[1] !== "scores") {
      return jsonResponse({ error: "Not found" }, 404);
    }
    const slug = segments[0];

    const auth = await authenticateAgent(ctx, request, slug);
    if (auth instanceof Response) return auth;

    const limited = await checkAgentRateLimit(
      ctx,
      "agentJudgeWrite",
      auth.keyId,
    );
    if (limited) return limited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Body must be valid JSON" }, 400);
    }

    // Minimal shape check; internal mutation validates ids and ranges
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { storyId?: unknown }).storyId !== "string" ||
      !Array.isArray((body as { scores?: unknown }).scores)
    ) {
      return jsonResponse(
        { error: "Body must include storyId (string) and scores (array)" },
        400,
      );
    }
    const parsed = body as {
      storyId: string;
      scores: Array<{ criteriaId?: unknown; score?: unknown; comments?: unknown }>;
      complete?: unknown;
    };
    for (const entry of parsed.scores) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof entry.criteriaId !== "string" ||
        typeof entry.score !== "number"
      ) {
        return jsonResponse(
          {
            error:
              "Each score must include criteriaId (string) and score (number)",
          },
          400,
        );
      }
    }

    try {
      const result = await ctx.runMutation(
        internal.agentJudges.submitAgentScores,
        {
          judgeId: auth.judgeId,
          groupId: auth.groupId,
          storyId: parsed.storyId as Id<"stories">,
          scores: parsed.scores.map((entry) => ({
            criteriaId: entry.criteriaId as Id<"judgingCriteria">,
            score: entry.score as number,
            comments:
              typeof entry.comments === "string" ? entry.comments : undefined,
          })),
          complete: parsed.complete === true,
        },
      );
      await ctx.runMutation(internal.agentJudges.markAgentKeyUsed, {
        keyId: auth.keyId,
      });
      return jsonResponse({
        written: result.written,
        completed: result.completed,
        advisory: auth.agentScoresAdvisory,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to write scores";
      // Validation failures from the mutation map to 400
      return jsonResponse({ error: message }, 400);
    }
  }),
});

// --- Hackathon skill API ---
//
// Endpoints the /hackathon agent skill calls. Authenticated with a group
// registration code (x-hackathon-code header, Bearer token, or ?code=).
// Submissions still flow through the group submit form at
// /judging/{slug}/submit; there is no API submit path.
//
//   GET  /api/hackathon/{slug}/openapi.json  (public)
//   GET  /api/hackathon/{slug}/rules.json    (code)
//   GET  /api/hackathon/{slug}/status?url=   (code)
//   POST /api/hackathon/{slug}/register      (code in body)
//   POST /api/hackathon/{slug}/check         (code)

// Reads are per code; the check endpoint fetches external URLs so it gets
// a much tighter budget.
const hackathonApiLimiter = new RateLimiter(components.rateLimiter, {
  hackathonRead: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 60,
  },
  hackathonCheck: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 10,
  },
});

type HackathonAuthContext = {
  groupId: Id<"judgingGroups">;
  groupName: string;
  groupSlug: string;
  isActive: boolean;
  startDate?: number;
  endDate?: number;
  code: string;
};

// Resolve the registration code on a request to a hackathon context.
// Returns a Response (401/403) when authentication fails.
async function authenticateHackathon(
  ctx: ActionCtx,
  request: Request,
  slug: string,
  bodyCode?: string,
): Promise<HackathonAuthContext | Response> {
  const url = new URL(request.url);
  const rawCode =
    request.headers.get("x-hackathon-code") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("code") ||
    bodyCode ||
    null;
  if (!rawCode) {
    return jsonResponse(
      { error: "Missing registration code: send x-hackathon-code or ?code=" },
      401,
    );
  }
  const context = await ctx.runQuery(internal.hackathon.validateCode, {
    slug,
    code: rawCode,
  });
  if (!context) {
    return jsonResponse(
      {
        error:
          "Invalid registration code, or the hackathon skill API is disabled for this group",
      },
      403,
    );
  }
  return context;
}

async function checkHackathonRateLimit(
  ctx: ActionCtx,
  name: "hackathonRead" | "hackathonCheck",
  key: string,
): Promise<Response | null> {
  const status = await hackathonApiLimiter.limit(ctx, name, { key });
  if (!status.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil(status.retryAfter / 1000));
    return jsonResponse({ error: "Rate limit exceeded" }, 429, {
      "retry-after": String(retryAfterSeconds),
    });
  }
  return null;
}

// GET with a hard timeout so a hung participant site cannot stall a check
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "vibeapps-hackathon-check" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Minimal OpenAPI document so agents can discover the hackathon API shape.
function buildHackathonOpenApiSpec(slug: string) {
  const base = `/api/hackathon/${slug}`;
  const codeAuth = [{ registrationCode: [] as Array<string> }];
  return {
    openapi: "3.0.3",
    info: {
      title: "Vibe Apps hackathon skill API",
      version: "1.0.0",
      description:
        "Register a hackathon team, fetch event rules, pre-check a project, and track submission status. Authenticate with the x-hackathon-code header (or ?code=). Submissions go through the web form at the submitPath returned by rules.json.",
    },
    components: {
      securitySchemes: {
        registrationCode: {
          type: "apiKey",
          in: "header",
          name: "x-hackathon-code",
        },
      },
    },
    paths: {
      [`${base}/register`]: {
        post: {
          summary: "Register a team for this event",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["code", "teamName"],
                  properties: {
                    code: { type: "string" },
                    teamName: { type: "string" },
                    email: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Registration confirmed with rules payload" },
            "403": { description: "Invalid code or skill API disabled" },
          },
        },
      },
      [`${base}/rules.json`]: {
        get: {
          summary: "Event rules, criteria, and AI rubric",
          security: codeAuth,
          responses: {
            "200": { description: "Rules payload with updatedAt and ETag" },
            "304": { description: "Rules unchanged since If-None-Match" },
          },
        },
      },
      [`${base}/status`]: {
        get: {
          summary: "Submission lifecycle for a project URL",
          security: codeAuth,
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "Status payload" } },
        },
      },
      [`${base}/check`]: {
        post: {
          summary: "Deterministic pre-submit check",
          description:
            "Live URL check, hackathon.json manifest fetch, duplicate URL detection, and event window check. No scores, nothing stored.",
          security: codeAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: { url: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Pass/warn/fail check list" },
            "429": { description: "Rate limited; see retry-after header" },
          },
        },
      },
    },
  };
}

// GET dispatcher for hackathon skill reads
http.route({
  pathPrefix: "/api/hackathon/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const segments = url.pathname
      .slice("/api/hackathon/".length)
      .split("/")
      .filter(Boolean);
    if (segments.length !== 2) {
      return jsonResponse({ error: "Not found" }, 404);
    }
    const slug = segments[0];
    const resource = segments[1];

    // Public API documentation, no code required
    if (resource === "openapi.json") {
      return jsonResponse(buildHackathonOpenApiSpec(slug));
    }

    const auth = await authenticateHackathon(ctx, request, slug);
    if (auth instanceof Response) return auth;

    const limited = await checkHackathonRateLimit(
      ctx,
      "hackathonRead",
      `${auth.groupSlug}:${auth.code}`,
    );
    if (limited) return limited;

    if (resource === "rules.json") {
      const rules = await ctx.runQuery(internal.hackathon.getRules, {
        groupId: auth.groupId,
      });
      if (!rules) {
        return jsonResponse({ error: "Rules unavailable" }, 404);
      }
      // Weak ETag from updatedAt lets the skill poll cheaply
      const etag = `W/"${rules.updatedAt}"`;
      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: { etag } });
      }
      return jsonResponse(rules, 200, { etag });
    }

    if (resource === "status") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return jsonResponse({ error: "Missing ?url= query parameter" }, 400);
      }
      const status = await ctx.runQuery(internal.hackathon.getStatusForUrl, {
        groupId: auth.groupId,
        url: targetUrl,
      });
      return jsonResponse(status);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }),
});

// POST dispatcher for register and check
http.route({
  pathPrefix: "/api/hackathon/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const segments = url.pathname
      .slice("/api/hackathon/".length)
      .split("/")
      .filter(Boolean);
    if (segments.length !== 2) {
      return jsonResponse({ error: "Not found" }, 404);
    }
    const slug = segments[0];
    const resource = segments[1];

    let body: Record<string, unknown> = {};
    try {
      const parsed: unknown = await request.json();
      if (typeof parsed === "object" && parsed !== null) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      // Empty or invalid body; endpoints validate their own fields below
    }

    if (resource === "register") {
      const bodyCode = typeof body.code === "string" ? body.code : undefined;
      const auth = await authenticateHackathon(ctx, request, slug, bodyCode);
      if (auth instanceof Response) return auth;

      const limited = await checkHackathonRateLimit(
        ctx,
        "hackathonRead",
        `${auth.groupSlug}:${auth.code}`,
      );
      if (limited) return limited;

      const teamName = typeof body.teamName === "string" ? body.teamName : "";
      if (teamName.trim().length < 2) {
        return jsonResponse(
          { error: "Body must include teamName (string, 2+ characters)" },
          400,
        );
      }

      try {
        const registration = await ctx.runMutation(
          internal.hackathon.registerTeam,
          {
            groupId: auth.groupId,
            code: auth.code,
            teamName,
            email: typeof body.email === "string" ? body.email : undefined,
          },
        );
        const rules = await ctx.runQuery(internal.hackathon.getRules, {
          groupId: auth.groupId,
        });
        return jsonResponse({
          registered: true,
          alreadyRegistered: registration.alreadyRegistered,
          group: { name: auth.groupName, slug: auth.groupSlug },
          submitUrl: `https://vibeapps.dev/judging/${auth.groupSlug}/submit`,
          rules,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Registration failed";
        return jsonResponse({ error: message }, 400);
      }
    }

    if (resource === "check") {
      const auth = await authenticateHackathon(ctx, request, slug);
      if (auth instanceof Response) return auth;

      const limited = await checkHackathonRateLimit(
        ctx,
        "hackathonCheck",
        `${auth.groupSlug}:${auth.code}`,
      );
      if (limited) return limited;

      const targetUrl = typeof body.url === "string" ? body.url.trim() : "";
      if (!targetUrl) {
        return jsonResponse({ error: "Body must include url (string)" }, 400);
      }
      let origin: string;
      try {
        origin = new URL(targetUrl).origin;
      } catch {
        return jsonResponse({ error: "url must be a valid absolute URL" }, 400);
      }

      type CheckEntry = {
        id: string;
        label: string;
        status: "pass" | "warn" | "fail";
        detail: string;
      };
      const checks: Array<CheckEntry> = [];

      // 1. Event window: is the group open for submissions right now?
      const now = Date.now();
      if (!auth.isActive) {
        checks.push({
          id: "event",
          label: "Event open",
          status: "fail",
          detail: "This judging group is not active",
        });
      } else if (auth.endDate !== undefined && now > auth.endDate) {
        checks.push({
          id: "event",
          label: "Event open",
          status: "fail",
          detail: "The event window has ended",
        });
      } else if (auth.startDate !== undefined && now < auth.startDate) {
        checks.push({
          id: "event",
          label: "Event open",
          status: "warn",
          detail: "The event window has not started yet",
        });
      } else {
        checks.push({
          id: "event",
          label: "Event open",
          status: "pass",
          detail: "Group is active and inside the event window",
        });
      }

      // 2. Liveness: a bare GET on the project URL must succeed
      const liveRes = await fetchWithTimeout(targetUrl, 10000);
      if (!liveRes) {
        checks.push({
          id: "liveness",
          label: "Live app status",
          status: "fail",
          detail: "The URL did not respond (network error or timeout)",
        });
      } else if (!liveRes.ok) {
        checks.push({
          id: "liveness",
          label: "Live app status",
          status: "fail",
          detail: `GET returned ${liveRes.status}`,
        });
      } else {
        checks.push({
          id: "liveness",
          label: "Live app status",
          status: "pass",
          detail: `GET returned ${liveRes.status}`,
        });
      }

      // 3. Manifest: published /hackathon.json parses and looks complete.
      // A missing manifest is a warning, not a failure: public-repo teams
      // can skip publishing per the event guide.
      const manifestRes = await fetchWithTimeout(
        `${origin}/hackathon.json`,
        10000,
      );
      if (!manifestRes || !manifestRes.ok) {
        checks.push({
          id: "manifest",
          label: "Published manifest",
          status: "warn",
          detail: `No hackathon.json at ${origin}/hackathon.json. Required for private or no-repo teams; public-repo teams can skip.`,
        });
      } else {
        try {
          const manifest: unknown = await manifestRes.json();
          if (typeof manifest !== "object" || manifest === null) {
            checks.push({
              id: "manifest",
              label: "Published manifest",
              status: "fail",
              detail: "hackathon.json is not a JSON object",
            });
          } else {
            const record = manifest as Record<string, unknown>;
            const missing: Array<string> = [];
            const hasAny = (keys: Array<string>) =>
              keys.some((k) => record[k] !== undefined);
            if (!hasAny(["team", "teamName"])) missing.push("team name");
            if (!hasAny(["appUrl", "app", "url", "siteUrl"]))
              missing.push("app URL");
            if (!hasAny(["packages", "components", "dependencies"]))
              missing.push("packages/components");
            checks.push({
              id: "manifest",
              label: "Published manifest",
              status: missing.length > 0 ? "warn" : "pass",
              detail:
                missing.length > 0
                  ? `Manifest parses but is missing: ${missing.join(", ")}`
                  : "Manifest fetched and parsed",
            });
          }
        } catch {
          checks.push({
            id: "manifest",
            label: "Published manifest",
            status: "fail",
            detail: "hackathon.json exists but is not valid JSON",
          });
        }
      }

      // 4. Duplicate: is this URL already submitted to the group?
      const status = await ctx.runQuery(internal.hackathon.getStatusForUrl, {
        groupId: auth.groupId,
        url: targetUrl,
      });
      checks.push({
        id: "duplicate",
        label: "Duplicate submission",
        status: status.found ? "warn" : "pass",
        detail: status.found
          ? "This URL was already submitted to this event. Submitting it again will be rejected."
          : "No existing submission with this URL",
      });

      const failed = checks.filter((c) => c.status === "fail").length;
      const warned = checks.filter((c) => c.status === "warn").length;
      return jsonResponse({
        ok: failed === 0,
        summary: `${checks.length - failed - warned} passed, ${warned} warnings, ${failed} failed`,
        checks,
        submitUrl: `https://vibeapps.dev/judging/${auth.groupSlug}/submit`,
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  }),
});

export default http;
