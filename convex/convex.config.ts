import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";
import agentReady from "@waynesutton/agent-ready/convex.config.js";
import crons from "@convex-dev/crons/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";

const app = defineApp();
app.use(resend);
app.use(crons);
app.use(workpool);
app.use(agentReady);

export default app;
