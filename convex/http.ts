import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { resend } from "./sendEmails";
import { registerRoutes } from "@waynesutton/agent-ready";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { sha256Hex } from "./agentJudges";
import {
  SITE_ORIGIN,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  buildVibeappsMd,
  type PublicDirectory,
} from "./siteDirectory";

const http = httpRouter();

// Agent Ready component routes (agents.md, llms-full.txt, llms-status, etc.)
// /llms.txt, /robots.txt, and /sitemap.xml are skipped because this app
// serves live directory files from public submissions.
registerRoutes(http, components.agentReady, {
  skipRoutes: ["/llms.txt", "/robots.txt", "/sitemap.xml"],
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

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: story.title,
    description: story.description,
    url: canonicalUrl,
    image: imageUrl,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: "https://vibeapps.dev",
    },
    ...(story.authorName
      ? { author: { "@type": "Person", name: story.authorName } }
      : {}),
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Basic SEO -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" type="text/plain" title="LLMs" href="https://vibeapps.dev/llms.txt">
  <link rel="alternate" type="text/markdown" title="Directory" href="https://vibeapps.dev/vibeapps.md">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle} | ${siteName}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="en_US">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${twitterHandle}">
  <meta name="twitter:creator" content="${twitterHandle}">
  <meta name="twitter:title" content="${safeTitle} | ${siteName}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${safeTitle}">
  
  <script type="application/ld+json">${jsonLd}</script>
  
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

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: canonicalUrl,
    image: imageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: "https://vibeapps.dev",
    },
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Basic SEO -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" type="text/plain" title="LLMs" href="https://vibeapps.dev/llms.txt">
  <link rel="alternate" type="text/markdown" title="Directory" href="https://vibeapps.dev/vibeapps.md">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle} | ${siteName}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="en_US">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${twitterHandle}">
  <meta name="twitter:creator" content="${twitterHandle}">
  <meta name="twitter:title" content="${safeTitle} | ${siteName}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${safeTitle}">
  
  <script type="application/ld+json">${jsonLd}</script>
  
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

function discoveryHeaders(contentType: string): Record<string, string> {
  return {
    "content-type": contentType,
    "cache-control":
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    "access-control-allow-origin": "*",
    "content-signal": "search=yes, ai-train=yes",
    link: `<${SITE_ORIGIN}/llms.txt>; rel="describedby"; type="text/plain", <${SITE_ORIGIN}/vibeapps.md>; rel="alternate"; type="text/markdown"`,
  };
}

async function serveLiveDirectoryFile(
  ctx: ActionCtx,
  kind: "robots" | "llms" | "vibeapps" | "sitemap",
): Promise<Response> {
  try {
    const directory: PublicDirectory = await ctx.runQuery(
      internal.siteFiles.listPublicDirectory,
      {},
    );
    if (kind === "robots") {
      return new Response(buildRobotsTxt(SITE_ORIGIN), {
        status: 200,
        headers: discoveryHeaders("text/plain; charset=utf-8"),
      });
    }
    if (kind === "llms") {
      return new Response(buildLlmsTxt(directory, SITE_ORIGIN), {
        status: 200,
        headers: discoveryHeaders("text/plain; charset=utf-8"),
      });
    }
    if (kind === "vibeapps") {
      return new Response(buildVibeappsMd(directory, SITE_ORIGIN), {
        status: 200,
        headers: discoveryHeaders("text/markdown; charset=utf-8"),
      });
    }
    return new Response(buildSitemapXml(directory, SITE_ORIGIN), {
      status: 200,
      headers: discoveryHeaders("application/xml; charset=utf-8"),
    });
  } catch (error) {
    console.error("Live directory file failed, using cache", error);
    const key =
      kind === "robots"
        ? "robots.txt"
        : kind === "llms"
          ? "llms.txt"
          : kind === "vibeapps"
            ? "vibeapps.md"
            : "sitemap.xml";
    const cached = await ctx.runQuery(internal.siteFiles.getFile, { key });
    if (cached) {
      const contentType =
        kind === "sitemap"
          ? "application/xml; charset=utf-8"
          : kind === "vibeapps"
            ? "text/markdown; charset=utf-8"
            : "text/plain; charset=utf-8";
      return new Response(cached, {
        status: 200,
        headers: discoveryHeaders(contentType),
      });
    }
    return new Response("User-agent: *\nAllow: /\n", {
      status: 200,
      headers: discoveryHeaders("text/plain; charset=utf-8"),
    });
  }
}

// Live discovery files generated from public submissions
http.route({
  path: "/robots.txt",
  method: "GET",
  handler: httpAction(async (ctx) => {
    return await serveLiveDirectoryFile(ctx, "robots");
  }),
});

http.route({
  path: "/llms.txt",
  method: "GET",
  handler: httpAction(async (ctx) => {
    return await serveLiveDirectoryFile(ctx, "llms");
  }),
});

http.route({
  path: "/vibeapps.md",
  method: "GET",
  handler: httpAction(async (ctx) => {
    return await serveLiveDirectoryFile(ctx, "vibeapps");
  }),
});

http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx) => {
    return await serveLiveDirectoryFile(ctx, "sitemap");
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

// RFC 8058 one-click unsubscribe. Mail providers POST to the URL advertised
// in the List-Unsubscribe header (with body "List-Unsubscribe=One-Click").
// No HTML response needed, just a 2xx on success.
http.route({
  path: "/api/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    const result = await ctx.runMutation(
      internal.emails.unsubscribe.handleUnsubscribeToken,
      { token },
    );

    return new Response(result.success ? "Unsubscribed" : "Invalid token", {
      status: result.success ? 200 : 400,
    });
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
    return jsonResponse({ error: "Missing x-judge-key header" }, 401);
  }
  const keyHash = await sha256Hex(rawKey);
  const context = await ctx.runQuery(internal.agentJudges.getAgentContext, {
    keyHash,
  });
  if (!context) {
    // Covers unknown keys, revoked keys, and groups whose agent API is disabled
    return jsonResponse(
      {
        error:
          "Invalid or revoked judge key, or the agent API is disabled for this group",
      },
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
      scores: Array<{
        criteriaId?: unknown;
        score?: unknown;
        comments?: unknown;
      }>;
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

export default http;
