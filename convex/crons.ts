import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Biweekly (every 14 days) using interval for precision
crons.interval(
  "rebuild robots and llms biweekly",
  { hours: 24 * 14 },
  internal.siteFiles.rebuild,
  {},
);

export default crons;
