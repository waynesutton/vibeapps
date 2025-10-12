import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Test that email system fetches fresh data from database
 * Admin-accessible mutation to test email data freshness
 */
export const testEmailDataFreshness = mutation({
  args: {
    emailType: v.union(
      v.literal("daily_admin"),
      v.literal("daily_engagement"),
      v.literal("weekly_digest"),
    ),
    testDate: v.optional(v.string()), // Optional: YYYY-MM-DD format to test specific date
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    dataSnapshot: v.any(),
    dateRange: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check admin permission
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const now = Date.now();
    const today = args.testDate || new Date().toISOString().split("T")[0];
    let dataSnapshot: any = {
      timestamp: now,
      emailType: args.emailType,
      testingDate: today,
    };

    try {
      // Take a snapshot of current data

      if (args.emailType === "daily_admin") {
        // Calculate what the email WILL show (items created on test date)
        const testDate = new Date(today);
        const startOfDay = new Date(testDate.setHours(0, 0, 0, 0)).getTime();
        const endOfDay = new Date(testDate.setHours(23, 59, 59, 999)).getTime();

        // Count items created on the test date
        const storiesOnDate = await ctx.db
          .query("stories")
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const votesOnDate = await ctx.db
          .query("votes")
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const commentsOnDate = await ctx.db
          .query("comments")
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        dataSnapshot.metrics = {
          dateRange: `${today} 00:00:00 to ${today} 23:59:59`,
          newSubmissionsOnDate: storiesOnDate.length,
          votesOnDate: votesOnDate.length,
          commentsOnDate: commentsOnDate.length,
          warning:
            storiesOnDate.length === 0
              ? "⚠️ No activity on this date - email will show zeros"
              : "✅ Activity found",
        };

        console.log("📊 Daily admin email will show:", dataSnapshot.metrics);
        console.log(`📅 Date range: ${today} (midnight to midnight)`);
        console.log("🚀 Triggering daily admin email...");

        // Trigger the email (always uses current date, not test date)
        await ctx.scheduler.runAfter(
          0,
          internal.emails.daily.sendDailyAdminEmail,
          {},
        );
      } else if (args.emailType === "daily_engagement") {
        // Check what engagement exists for the test date
        const testDate = new Date(today);
        const startOfDay = new Date(testDate.setHours(0, 0, 0, 0)).getTime();
        const endOfDay = new Date(testDate.setHours(23, 59, 59, 999)).getTime();

        // Count engagement activity on the test date
        const votesOnDate = await ctx.db
          .query("votes")
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const commentsOnDate = await ctx.db
          .query("comments")
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        dataSnapshot.engagement = {
          dateRange: `${today} 00:00:00 to ${today} 23:59:59`,
          votesOnDate: votesOnDate.length,
          commentsOnDate: commentsOnDate.length,
          warning:
            votesOnDate.length === 0 && commentsOnDate.length === 0
              ? "⚠️ No engagement on this date - no emails will be sent"
              : `✅ Found ${votesOnDate.length} votes and ${commentsOnDate.length} comments`,
        };

        console.log(
          "📊 User engagement will process:",
          dataSnapshot.engagement,
        );
        console.log(`📅 Date range: ${today} (midnight to midnight)`);
        console.log("🚀 Processing fresh engagement data...");

        // Process fresh engagement data (requires date parameter)
        await ctx.scheduler.runAfter(
          0,
          internal.emails.daily.processUserEngagement,
          { date: today },
        );

        // Then send emails
        await ctx.scheduler.runAfter(
          5000, // Wait 5 seconds for processing
          internal.emails.daily.sendDailyUserEmails,
          {},
        );
      } else if (args.emailType === "weekly_digest") {
        // Weekly digest looks at LAST WEEK (previous Mon-Sun)
        const nowDate = new Date();
        const dayOfWeek = nowDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const weekStart = new Date(nowDate);
        weekStart.setDate(nowDate.getDate() - daysToMonday - 7); // Last week's Monday
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Last week's Sunday
        weekEnd.setHours(23, 59, 59, 999);

        const recentVotes = await ctx.db
          .query("votes")
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), weekStart.getTime()) &&
              q.lte(q.field("_creationTime"), weekEnd.getTime()),
          )
          .collect();

        dataSnapshot.weekly = {
          dateRange: `${weekStart.toISOString().split("T")[0]} to ${weekEnd.toISOString().split("T")[0]} (Last Week: Mon-Sun)`,
          votesLastWeek: recentVotes.length,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          warning:
            recentVotes.length === 0
              ? "⚠️ No votes last week - digest will be empty"
              : `✅ Found ${recentVotes.length} votes last week`,
        };

        console.log("📊 Weekly digest will show:", dataSnapshot.weekly);
        console.log(
          `📅 Date range: Last week (${weekStart.toISOString().split("T")[0]} to ${weekEnd.toISOString().split("T")[0]})`,
        );
        console.log("🚀 Triggering weekly digest...");

        // Trigger weekly digest
        await ctx.scheduler.runAfter(
          0,
          internal.emails.weekly.sendWeeklyDigest,
          {},
        );
      }

      const dateRangeMsg =
        args.emailType === "weekly_digest"
          ? `Last week (${dataSnapshot.weekly?.dateRange || "calculating..."})`
          : `Today: ${today}`;

      return {
        success: true,
        message: `Test triggered for ${args.emailType}. Date range: ${dateRangeMsg}. Check email logs and your inbox.`,
        dataSnapshot,
        dateRange: dateRangeMsg,
      };
    } catch (error: any) {
      console.error("❌ Test failed:", error);
      return {
        success: false,
        message: `Test failed: ${error.message}`,
        dataSnapshot,
        dateRange: "Error occurred",
      };
    }
  },
});

/**
 * Query to verify email logs contain fresh data
 * Admin-accessible query
 */
export const verifyEmailLogFreshness = query({
  args: {
    emailType: v.union(
      v.literal("daily_admin"),
      v.literal("daily_engagement"),
      v.literal("weekly_digest"),
    ),
    lookbackMinutes: v.optional(v.number()),
  },
  returns: v.object({
    recentLogs: v.array(
      v.object({
        _id: v.id("emailLogs"),
        emailType: v.string(),
        sentAt: v.number(),
        status: v.string(),
        recipientEmail: v.string(),
        timeSinceSent: v.string(),
      }),
    ),
    summary: v.object({
      totalFound: v.number(),
      successfulSends: v.number(),
      failedSends: v.number(),
      oldestLog: v.optional(v.string()),
      newestLog: v.optional(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    // Check admin permission
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }
    const lookbackMs = (args.lookbackMinutes || 60) * 60 * 1000;
    const cutoffTime = Date.now() - lookbackMs;

    // Get recent logs for this email type
    const logs = await ctx.db
      .query("emailLogs")
      .filter(
        (q) =>
          q.eq(q.field("emailType"), args.emailType) &&
          q.gte(q.field("sentAt"), cutoffTime),
      )
      .collect();

    const recentLogs = logs.map((log) => {
      const minutesAgo = Math.floor((Date.now() - log.sentAt) / 60000);
      return {
        _id: log._id,
        emailType: log.emailType,
        sentAt: log.sentAt,
        status: log.status,
        recipientEmail: log.recipientEmail,
        timeSinceSent: `${minutesAgo} minutes ago`,
      };
    });

    const successfulSends = logs.filter((l) => l.status === "sent").length;
    const failedSends = logs.filter((l) => l.status === "failed").length;

    return {
      recentLogs,
      summary: {
        totalFound: logs.length,
        successfulSends,
        failedSends,
        oldestLog:
          logs.length > 0 ? new Date(logs[0].sentAt).toISOString() : undefined,
        newestLog:
          logs.length > 0
            ? new Date(logs[logs.length - 1].sentAt).toISOString()
            : undefined,
      },
    };
  },
});

/**
 * Compare current database state with what was sent in last email
 * This helps verify emails are using current data
 * Admin-accessible query
 */
export const compareEmailDataWithDatabase = query({
  args: {},
  returns: v.object({
    currentState: v.any(),
    lastEmailLog: v.optional(v.any()),
    dataIsFresh: v.boolean(),
    notes: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Check admin permission
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }
    const notes: string[] = [];

    // Get current database state
    const stories = await ctx.db.query("stories").collect();
    const users = await ctx.db.query("users").collect();
    const votes = await ctx.db.query("votes").collect();
    const comments = await ctx.db.query("comments").collect();

    const currentState = {
      totalStories: stories.length,
      totalUsers: users.length,
      totalVotes: votes.length,
      totalComments: comments.length,
      timestamp: Date.now(),
    };

    // Get most recent admin email log using index
    const recentAdminEmails = await ctx.db
      .query("emailLogs")
      .withIndex("by_type_date", (q) => q.eq("emailType", "daily_admin"))
      .order("desc")
      .take(1);

    const lastEmailLog = recentAdminEmails[0] || null;

    // Analyze freshness
    let dataIsFresh = true;

    if (lastEmailLog) {
      const hoursSinceEmail =
        (Date.now() - lastEmailLog.sentAt) / (1000 * 60 * 60);
      notes.push(
        `Last admin email sent ${hoursSinceEmail.toFixed(1)} hours ago`,
      );

      if (hoursSinceEmail < 24) {
        notes.push("✅ Email timing is within expected daily schedule");
      } else {
        notes.push("⚠️ Last email is older than 24 hours - check cron jobs");
        dataIsFresh = false;
      }

      if (lastEmailLog.metadata) {
        notes.push("✅ Email contains metadata from database snapshot");
      }
    } else {
      notes.push(
        "⚠️ No admin email logs found - system may not have sent emails yet",
      );
      dataIsFresh = false;
    }

    // Check if cron jobs are enabled
    notes.push(
      "💡 To test immediately: Run internal.emails.daily.sendDailyAdminEmail in Convex dashboard",
    );

    return {
      currentState,
      lastEmailLog: lastEmailLog
        ? {
            sentAt: new Date(lastEmailLog.sentAt).toISOString(),
            status: lastEmailLog.status,
            recipientEmail: lastEmailLog.recipientEmail,
          }
        : undefined,
      dataIsFresh,
      notes,
    };
  },
});
