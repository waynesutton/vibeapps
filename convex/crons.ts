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

// Email cron jobs (PST timezone)

// Daily admin email at 9:00 AM PST
crons.cron(
  "daily admin email",
  "0 17 * * *", // 9:00 AM PST = 17:00 UTC
  internal.emails.daily.sendDailyAdminEmail,
  {},
);

// Process daily engagement at 5:30 PM PST (before user emails)
crons.cron(
  "process daily engagement",
  "30 1 * * *", // 5:30 PM PST = 1:30 UTC next day
  internal.emails.daily.processUserEngagement,
  {
    date: new Date().toISOString().split("T")[0],
  },
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
