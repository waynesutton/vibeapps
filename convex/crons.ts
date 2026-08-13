import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily fallback cache for discovery files. HTTP routes generate live from
// public submissions; this keeps siteFiles populated if a live query fails.
crons.interval(
  "rebuild robots llms and directory daily",
  { hours: 24 },
  internal.siteFiles.rebuild,
  {},
);

// Email cron jobs (PST timezone)

// Daily admin email at 9:00 AM PST
crons.cron(
  "daily admin email",
  "0 17 * * *", // 9:00 AM PST = 17:00 UTC
  internal.emails.daily.sendDailyAdminEmail,
  {},
);

// Process daily engagement at 5:30 PM PST (before user emails).
// Date is computed inside the action at run time; cron args are evaluated
// once at deploy time, so passing a date here would freeze it forever.
crons.cron(
  "process daily engagement",
  "30 1 * * *", // 5:30 PM PST = 1:30 UTC next day
  internal.emails.daily.processUserEngagement,
  {},
);

// Send user engagement emails at 6:00 PM PST
crons.cron(
  "daily user emails",
  "0 2 * * *", // 6:00 PM PST = 2:00 UTC next day
  internal.emails.daily.sendDailyUserEmails,
  {},
);

// Weekly digest Monday 9:00 AM PST
crons.cron(
  "weekly most vibes digest",
  "0 17 * * MON", // Monday 9:00 AM PST = 17:00 UTC
  internal.emails.weekly.sendWeeklyDigest,
  {},
);

export default crons;
