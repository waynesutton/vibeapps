import { defineApp } from "convex/server";
import { v } from "convex/values";
import resend from "@convex-dev/resend/convex.config";
import agentReady from "@waynesutton/agent-ready/convex.config.js";
import crons from "@convex-dev/crons/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";

// FIRECRAWL_API_KEY is declared as app env and bound by reference into the
// Firecrawl component, so one deployment env var powers every consumer.
const app = defineApp({
  env: {
    FIRECRAWL_API_KEY: v.string(),
  },
});
app.use(resend);
app.use(crons);
app.use(workpool);
// Separate pool for AI spam scans so batch scans never queue behind
// (or starve) the AI judge's own workpool.
app.use(workpool, { name: "spamWorkpool" });
app.use(agentReady);
app.use(rateLimiter);
app.use(firecrawl, {
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
  },
});

export default app;
