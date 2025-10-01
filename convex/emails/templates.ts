import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Generate daily admin email template with platform metrics
 */
export const generateDailyAdminEmail = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    userUsername: v.optional(v.string()),
    metrics: v.object({
      date: v.string(),
      newSubmissions: v.number(),
      newUsers: v.number(),
      totalUsers: v.number(),
      dailyVotes: v.number(),
      dailyComments: v.number(),
      dailyRatings: v.number(),
      dailyBookmarks: v.number(),
      dailyFollows: v.number(),
      activeUsers: v.number(),
      pendingReports: v.number(),
      resolvedReports: v.number(),
    }),
    previousMetrics: v.optional(v.any()),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const { metrics, previousMetrics } = args;

    const calculateChange = (current: number, previous?: number) => {
      if (!previous) return "";
      const diff = current - previous;
      const sign = diff > 0 ? "+" : "";
      return ` (${sign}${diff})`;
    };

    const subject = `VibeApps Updates: Daily Report - ${metrics.date}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: left; margin-bottom: 30px;">
              <a href="https://vibeapps.dev" style="text-decoration: none;">
                <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px; border-radius: 8px;" />
              </a>
            </div>
            <h1 style="color: #292929;">VibeApps Daily Report</h1>
            <p style="color: #666; font-size: 14px;">${metrics.date}</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Daily Growth</h2>
              <ul style="list-style: none; padding: 0;">
                <li>New Apps Submitted: <strong>${metrics.newSubmissions}</strong>${calculateChange(metrics.newSubmissions, previousMetrics?.newSubmissions)}</li>
                <li>New Users Signed Up: <strong>${metrics.newUsers}</strong>${calculateChange(metrics.newUsers, previousMetrics?.newUsers)}</li>
                <li>Total Platform Users: <strong>${metrics.totalUsers}</strong></li>
              </ul>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Daily Engagement</h2>
              <ul style="list-style: none; padding: 0;">
                <li>Votes Cast: <strong>${metrics.dailyVotes}</strong></li>
                <li>Comments Added: <strong>${metrics.dailyComments}</strong></li>
                <li>Ratings Given: <strong>${metrics.dailyRatings}</strong></li>
                <li>Bookmarks Added: <strong>${metrics.dailyBookmarks}</strong></li>
                <li>New Follows: <strong>${metrics.dailyFollows}</strong></li>
                <li>Active Users: <strong>${metrics.activeUsers}</strong></li>
              </ul>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Platform Health</h2>
              <ul style="list-style: none; padding: 0;">
                <li>Reports Pending: <strong>${metrics.pendingReports}</strong></li>
                <li>Reports Resolved: <strong>${metrics.resolvedReports}</strong></li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://vibeapps.dev/admin" style="background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Admin Dashboard</a>
            </div>

            <p style="color: #666; font-size: 12px; text-align: center;">
              This is an automated report from VibeApps admin system.
            </p>
            
            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : args.userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #666; line-height: 1.4;">
                <p style="margin: 5px 0;">If you have any questions, feedback, ideas or problems <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">contact us!</a></p>
                <p style="margin: 5px 0;">You can manage which email notifications you receive and unsubscribe from your profile page.</p>
                <p style="margin: 5px 0;">VibeApps is an <a href="https://github.com/waynesutton/vibeapps" style="color: #666;">open-source project</a>.</p>
                <p style="margin: 5px 0;"><a href="https://convex.dev/?utm_source=vibeapps-dev" style="color: #666;">Convex</a> 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA</p>
                <p style="margin: 5px 0;">
                  Follow us on <a href="https://twitter.com/convex_dev" style="color: #666;">Twitter</a> or <a href="https://www.linkedin.com/company/convex-dev/" style="color: #666;">LinkedIn</a>. 
                  <a href="https://github.com/get-convex/convex-backend" style="color: #666;">Star on Github</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

/**
 * Generate welcome email for new users
 */
export const generateWelcomeEmail = internalQuery({
  args: {
    userId: v.id("users"),
    userName: v.string(),
    userEmail: v.string(),
    userUsername: v.optional(v.string()),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = "Welcome to VibeApps! Let's get you started";

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: left; margin-bottom: 30px;">
              <a href="https://vibeapps.dev" style="text-decoration: none;">
                <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px; border-radius: 8px;" />
              </a>
            </div>
            <h1 style="color: #292929;">Welcome to VibeApps!</h1>
            
            <p>Hey ${args.userName},</p>
            
            <p>Welcome to VibeApps, the community where you go to show off what you've built, and see what others are building!</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Here's how to get started:</h2>
              
              <div style="margin: 15px 0;">
                <strong>Explore Apps</strong><br>
                Browse apps by category<br>
                <a href="https://vibeapps.dev" style="color: #292929;">Explore Apps →</a>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Submit Your App</strong><br>
                Share your project with the community<br>
                <a href="https://vibeapps.dev/submit" style="color: #292929;">Submit App →</a>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>See what's trending</strong><br>
                Vote  for your favorite apps<br>
                <a href="https://vibeapps.dev/leaderboard" style="color: #292929;">Check out the leaderboard →</a>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Set up your profile</strong><br>
                Choose your username and add your bio<br>
                <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/set-username"}" style="color: #292929;">Complete your profile →</a>
              </div>
            </div>

          
            
            <p>Happy building!<br>VibeApps.dev</p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : args.userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences in the Manage Profile & Account section on your profile page.</a>${args.unsubscribeToken ? ` ` : ""}
              
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #666; line-height: 1.4;">
                <p style="margin: 5px 0;">If you have any questions, feedback, ideas or problems <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">contact us!</a></p>
                <p style="margin: 5px 0;">You can manage which email notifications you receive and unsubscribe from your profile page.</p>
                <p style="margin: 5px 0;">VibeApps is an <a href="https://github.com/waynesutton/vibeapps" style="color: #666;">open-source project</a>.</p>
                <p style="margin: 5px 0;"><a href="https://convex.dev/?utm_source=vibeapps-dev" style="color: #666;">Convex</a> 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA</p>
                <p style="margin: 5px 0;">
                  Follow us on <a href="https://twitter.com/convex_dev" style="color: #666;">Twitter</a> or <a href="https://www.linkedin.com/company/convex-dev/" style="color: #666;">LinkedIn</a>. 
                  <a href="https://github.com/get-convex/convex-backend" style="color: #666;">Star on Github</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

/**
 * Generate daily engagement email for users
 */
export const generateEngagementEmail = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    userName: v.string(),
    userUsername: v.optional(v.string()),
    engagementSummary: v.object({
      totalEngagement: v.number(),
      storyEngagements: v.array(
        v.object({
          storyId: v.id("stories"),
          storySlug: v.optional(v.string()),
          storyTitle: v.string(),
          votes: v.number(),
          ratings: v.number(),
          comments: v.number(),
          bookmarks: v.number(),
        }),
      ),
    }),
    newFollowers: v.optional(v.array(v.string())),
    followedSubmissions: v.optional(
      v.array(
        v.object({
          title: v.string(),
          author: v.string(),
          storyId: v.id("stories"),
          storySlug: v.optional(v.string()),
        }),
      ),
    ),
    mentions: v.optional(
      v.array(
        v.object({
          authorName: v.string(),
          storyTitle: v.string(),
          contentExcerpt: v.string(),
          context: v.union(v.literal("comment"), v.literal("judge_note")),
        }),
      ),
    ),
    replies: v.optional(
      v.array(
        v.object({
          replierName: v.string(),
          storyTitle: v.string(),
          contentExcerpt: v.string(),
        }),
      ),
    ),
    pinnedStories: v.optional(
      v.array(
        v.object({
          storyTitle: v.string(),
        }),
      ),
    ),
    adminMessages: v.optional(
      v.array(
        v.object({
          storyTitle: v.string(),
        }),
      ),
    ),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = "VibeApps Updates: Your apps received engagement today";

    const generateAppSection = (app: any) => {
      const engagements = [];
      if (app.votes > 0)
        engagements.push(`${app.votes} new vote${app.votes !== 1 ? "s" : ""}`);
      if (app.ratings > 0)
        engagements.push(
          `${app.ratings} new rating${app.ratings !== 1 ? "s" : ""}`,
        );
      if (app.comments > 0)
        engagements.push(
          `${app.comments} new comment${app.comments !== 1 ? "s" : ""}`,
        );
      if (app.bookmarks > 0)
        engagements.push(
          `${app.bookmarks} new bookmark${app.bookmarks !== 1 ? "s" : ""}`,
        );

      return `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
          <h3 style="margin-top: 0; color: #292929;">${app.storyTitle}</h3>
          <ul style="list-style: none; padding: 0;">
            ${engagements.map((eng) => `<li>• ${eng}</li>`).join("")}
          </ul>
          <a href="https://vibeapps.dev/s/${app.storySlug || app.storyId}" style="color: #292929; text-decoration: none;">View App →</a>
        </div>
      `;
    };

    const followersSection =
      args.newFollowers && args.newFollowers.length > 0
        ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h3 style="margin-top: 0; color: #292929;">New followers today: ${args.newFollowers.length}</h3>
        <ul style="list-style: none; padding: 0;">
          ${args.newFollowers.map((follower) => `<li>• ${follower}</li>`).join("")}
        </ul>
      </div>
    `
        : "";

    const submissionsSection =
      args.followedSubmissions && args.followedSubmissions.length > 0
        ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h3 style="margin-top: 0; color: #292929;">New submissions from people you follow:</h3>
        <ul style="list-style: none; padding: 0;">
          ${args.followedSubmissions.map((sub) => `<li>• <a href="https://vibeapps.dev/s/${sub.storySlug || sub.storyId}" style="color: #292929; text-decoration: none;">"${sub.title}"</a> by ${sub.author}</li>`).join("")}
        </ul>
      </div>
    `
        : "";

    const mentionsSection =
      args.mentions && args.mentions.length > 0
        ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h3 style="margin-top: 0; color: #292929;">You were mentioned ${args.mentions.length} time${args.mentions.length !== 1 ? "s" : ""} today:</h3>
        <ul style="list-style: none; padding: 0;">
          ${args.mentions
            .slice(0, 10)
            .map(
              (mention) => `
            <li style="margin: 8px 0; padding: 8px; background: #ffffff; border-radius: 4px;">
              <strong>${mention.authorName}</strong> mentioned you in a ${mention.context === "comment" ? "comment" : "judge note"} on "${mention.storyTitle}"
              <br><em style="color: #666; font-size: 12px;">"${mention.contentExcerpt.slice(0, 100)}${mention.contentExcerpt.length > 100 ? "..." : ""}"</em>
            </li>
          `,
            )
            .join("")}
        </ul>
        ${args.mentions.length > 10 ? `<p style="text-align: center; margin: 10px 0;"><a href="https://vibeapps.dev/notifications" style="color: #292929;">View all ${args.mentions.length} mentions →</a></p>` : ""}
      </div>
    `
        : "";

    const repliesSection =
      args.replies && args.replies.length > 0
        ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h3 style="margin-top: 0; color: #292929;">You received ${args.replies.length} repl${args.replies.length !== 1 ? "ies" : "y"} today:</h3>
        <ul style="list-style: none; padding: 0;">
          ${args.replies
            .slice(0, 10)
            .map(
              (reply) => `
            <li style="margin: 8px 0; padding: 8px; background: #ffffff; border-radius: 4px;">
              <strong>${reply.replierName}</strong> replied on "${reply.storyTitle}"
              <br><em style="color: #666; font-size: 12px;">"${reply.contentExcerpt.slice(0, 100)}${reply.contentExcerpt.length > 100 ? "..." : ""}"</em>
            </li>
          `,
            )
            .join("")}
        </ul>
        ${args.replies.length > 10 ? `<p style="text-align: center; margin: 10px 0;"><a href="https://vibeapps.dev/notifications" style="color: #292929;">View all ${args.replies.length} replies →</a></p>` : ""}
      </div>
    `
        : "";

    const pinnedSection =
      args.pinnedStories && args.pinnedStories.length > 0
        ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h3 style="margin-top: 0; color: #292929;">Your post has been featured</h3>
        <ul style="list-style: none; padding: 0;">
          ${args.pinnedStories
            .map((p) => `<li style=\"margin: 6px 0;\">• ${p.storyTitle}</li>`)
            .join("")}
        </ul>
      </div>
    `
        : "";

    const adminMessageSection =
      args.adminMessages && args.adminMessages.length > 0
        ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h3 style="margin-top: 0; color: #292929;">Your post has a custom message from admin</h3>
        <ul style="list-style: none; padding: 0;">
          ${args.adminMessages
            .map((m) => `<li style=\"margin: 6px 0;\">• ${m.storyTitle}</li>`)
            .join("")}
        </ul>
      </div>
    `
        : "";

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: left; margin-bottom: 30px;">
              <a href="https://vibeapps.dev" style="text-decoration: none;">
                <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px; border-radius: 8px;" />
              </a>
            </div>
            <h1 style="color: #292929;">Your apps received engagement today</h1>
            
            <p>Hey ${args.userName},</p>
            
            <p>Great news! Here's your daily summary:</p>
            
            ${args.engagementSummary.storyEngagements.map(generateAppSection).join("")}
            
            ${followersSection}
            
            ${submissionsSection}
            
            ${mentionsSection}
            
            ${repliesSection}

            ${pinnedSection}

            ${adminMessageSection}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : args.userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/profile"}" style="background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Your Profile</a>
            </div>

            <p>Keep shipping amazing things!</p>
            <p>VibeApps.dev. </p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : args.userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #666; line-height: 1.4;">
                <p style="margin: 5px 0;">If you have any questions, feedback, ideas or problems <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">contact us!</a></p>
                <p style="margin: 5px 0;">You can manage which email notifications you receive and unsubscribe from your profile page.</p>
                <p style="margin: 5px 0;">VibeApps is an <a href="https://github.com/waynesutton/vibeapps" style="color: #666;">open-source project</a>.</p>
                <p style="margin: 5px 0;"><a href="https://convex.dev/?utm_source=vibeapps-dev" style="color: #666;">Convex</a> 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA</p>
                <p style="margin: 5px 0;">
                  Follow us on <a href="https://twitter.com/convex_dev" style="color: #666;">Twitter</a> or <a href="https://www.linkedin.com/company/convex-dev/" style="color: #666;">LinkedIn</a>. 
                  <a href="https://github.com/get-convex/convex-backend" style="color: #666;">Star on Github</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

/**
 * Generate weekly digest email
 */
export const generateWeeklyDigest = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    userName: v.string(),
    userUsername: v.optional(v.string()),
    topApps: v.array(
      v.object({
        storyId: v.id("stories"),
        storySlug: v.optional(v.string()),
        title: v.string(),
        vibes: v.number(),
      }),
    ),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = "VibeApps Updates: Most Vibes This Week";

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: left; margin-bottom: 30px;">
              <a href="https://vibeapps.dev" style="text-decoration: none;">
                <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px; border-radius: 8px;" />
              </a>
            </div>
            <h1 style="color: #292929;">Most Vibes This Week</h1>
            
            <p>Hey ${args.userName},</p>
            
            <p>Here are the top submissions this week by vibes:</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <ol style="padding-left: 20px;">
                ${args.topApps
                  .map(
                    (app, index) => `
                  <li style="margin: 10px 0;">
                    <a href="https://vibeapps.dev/s/${app.storySlug || app.storyId}" style="color: #292929; text-decoration: none;">
                      <strong>${app.title}</strong>
                    </a> — ${app.vibes} vibes
                  </li>
                `,
                  )
                  .join("")}
              </ol>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://vibeapps.dev/leaderboard" style="background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Weekly Leaderboard</a>
            </div>

            <p>VibeApps.dev</p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : args.userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #666; line-height: 1.4;">
                <p style="margin: 5px 0;">If you have any questions, feedback, ideas or problems <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">contact us!</a></p>
                <p style="margin: 5px 0;">You can manage which email notifications you receive and unsubscribe from your profile page.</p>
                <p style="margin: 5px 0;">VibeApps is an <a href="https://github.com/waynesutton/vibeapps" style="color: #666;">open-source project</a>.</p>
                <p style="margin: 5px 0;"><a href="https://convex.dev/?utm_source=vibeapps-dev" style="color: #666;">Convex</a> 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA</p>
                <p style="margin: 5px 0;">
                  Follow us on <a href="https://twitter.com/convex_dev" style="color: #666;">Twitter</a> or <a href="https://www.linkedin.com/company/convex-dev/" style="color: #666;">LinkedIn</a>. 
                  <a href="https://github.com/get-convex/convex-backend" style="color: #666;">Star on Github</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

/**
 * Generate broadcast email template
 */
export const generateBroadcastEmail = internalQuery({
  args: {
    subject: v.string(),
    content: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    userUsername: v.optional(v.string()),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = `VibeApps Updates: ${args.subject}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: left; margin-bottom: 30px;">
              <a href="https://vibeapps.dev" style="text-decoration: none;">
                <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px; border-radius: 8px;" />
              </a>
            </div>
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #292929; margin: 0; font-size: 24px;">VibeApps</h1>
              <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">The community where you go to show off what you've built, and see what others are building.</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${args.content}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://vibeapps.dev" style="background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Visit VibeApps</a>
            </div>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 0 0 10px 0;">
                This message was sent by the VibeApps team to keep you updated on platform news and features.
              </p>
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : args.userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #666; line-height: 1.4;">
                <p style="margin: 5px 0;">If you have any questions, feedback, ideas or problems <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">contact us!</a></p>
                <p style="margin: 5px 0;">You can manage which email notifications you receive and unsubscribe from your profile page.</p>
                <p style="margin: 5px 0;">VibeApps is an <a href="https://github.com/waynesutton/vibeapps" style="color: #666;">open-source project</a>.</p>
                <p style="margin: 5px 0;"><a href="https://convex.dev/?utm_source=vibeapps-dev" style="color: #666;">Convex</a> 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA</p>
                <p style="margin: 5px 0;">
                  Follow us on <a href="https://twitter.com/convex_dev" style="color: #666;">Twitter</a> or <a href="https://www.linkedin.com/company/convex-dev/" style="color: #666;">LinkedIn</a>. 
                  <a href="https://github.com/get-convex/convex-backend" style="color: #666;">Star on Github</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

export const generateMentionEmail = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    userName: v.string(),
    userUsername: v.optional(v.string()),
    mentionAuthor: v.string(),
    storyTitle: v.string(),
    contentExcerpt: v.string(),
    permalink: v.string(),
    context: v.union(v.literal("comment"), v.literal("judge_note")),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const contextText = args.context === "comment" ? "comment" : "judge note";
    const subject = `VibeApps Updates: You were mentioned by ${args.mentionAuthor}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: left; margin-bottom: 30px;">
              <a href="https://vibeapps.dev" style="text-decoration: none;">
                <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px; border-radius: 8px;" />
              </a>
            </div>
            <h1 style="color: #292929;">You were mentioned</h1>
            
            <p>Hey ${args.userName},</p>
            
            <p>You were mentioned in a ${contextText} on: <strong>${args.storyTitle}</strong></p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="font-style: italic;">"${args.contentExcerpt}"</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${args.permalink}" style="background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Thread</a>
            </div>

            <p>- The VibeApps Team</p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : args.userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #666; line-height: 1.4;">
                <p style="margin: 5px 0;">If you have any questions, feedback, ideas or problems <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">contact us!</a></p>
                <p style="margin: 5px 0;">You can manage which email notifications you receive and unsubscribe from your profile page.</p>
                <p style="margin: 5px 0;">VibeApps is an <a href="https://github.com/waynesutton/vibeapps" style="color: #666;">open-source project</a>.</p>
                <p style="margin: 5px 0;"><a href="https://convex.dev/?utm_source=vibeapps-dev" style="color: #666;">Convex</a> 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA</p>
                <p style="margin: 5px 0;">
                  Follow us on <a href="https://twitter.com/convex_dev" style="color: #666;">Twitter</a> or <a href="https://www.linkedin.com/company/convex-dev/" style="color: #666;">LinkedIn</a>. 
                  <a href="https://github.com/get-convex/convex-backend" style="color: #666;">Star on Github</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

/**
 * Generate admin user report notification email template
 */
export const generateAdminUserReportEmail = internalQuery({
  args: {
    adminUserId: v.optional(v.id("users")),
    adminName: v.string(),
    adminUsername: v.optional(v.string()),
    reporterName: v.string(),
    reporterUsername: v.optional(v.string()),
    reporterEmail: v.optional(v.string()),
    reportedUserName: v.string(),
    reportedUsername: v.optional(v.string()),
    reportReason: v.string(),
    reportTimestamp: v.number(),
    userJoinDate: v.number(),
    submissionCount: v.number(),
    commentCount: v.number(),
    dashboardUrl: v.string(),
    profileUrl: v.string(),
    unsubscribeToken: v.string(),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = `User Report - ${args.reportedUserName}`;

    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px;">
            </div>

            <h1 style="color: #292929; margin-bottom: 10px;">User Report Requires Review</h1>
            <p style="color: #666; margin-bottom: 30px;">A user has been reported and needs immediate admin attention.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #856404;">Report Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reported User:</td>
                  <td style="padding: 8px 0;">
                    ${args.reportedUserName}
                    ${args.reportedUsername ? ` (@${args.reportedUsername})` : ""}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reported by:</td>
                  <td style="padding: 8px 0;">
                    ${args.reporterName}
                    ${args.reporterUsername ? ` (@${args.reporterUsername})` : ""}
                    ${args.reporterEmail ? `<br><small style="color: #666;">${args.reporterEmail}</small>` : ""}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reason:</td>
                  <td style="padding: 8px 0; color: #d63384; font-weight: 500;">${args.reportReason}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reported:</td>
                  <td style="padding: 8px 0;">${formatDate(args.reportTimestamp)}</td>
                </tr>
              </table>
            </div>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #292929;">User Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Profile:</td>
                  <td style="padding: 8px 0;">
                    <a href="${args.profileUrl}" style="color: #292929; text-decoration: none;">${args.profileUrl}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">User since:</td>
                  <td style="padding: 8px 0;">${formatDate(args.userJoinDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Total Submissions:</td>
                  <td style="padding: 8px 0;">${args.submissionCount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Total Comments:</td>
                  <td style="padding: 8px 0;">${args.commentCount}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${args.dashboardUrl}" style="display: inline-block; background: #d63384; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 0 10px;">Review Report</a>
              <a href="${args.profileUrl}" style="display: inline-block; background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 0 10px;">View Profile</a>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>Action Required:</strong> This report requires immediate admin review. Please log into the admin dashboard to investigate and take appropriate moderation action.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                You received this email because you are an administrator at VibeApps.
              </p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                <a href="${args.adminUsername ? `https://vibeapps.dev/${args.adminUsername}` : args.adminUserId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666;">Manage email preferences</a> | 
                <a href="https://vibeapps.dev/admin" style="color: #666;">Admin Dashboard</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

/**
 * Generate story report notification email for admins/managers
 */
export const generateReportNotificationEmail = internalQuery({
  args: {
    adminUserId: v.optional(v.id("users")),
    adminName: v.string(),
    adminUsername: v.optional(v.string()),
    reporterName: v.string(),
    reporterUsername: v.optional(v.string()),
    storyTitle: v.string(),
    storyUrl: v.string(),
    storySlug: v.optional(v.string()),
    reportReason: v.string(),
    reportTimestamp: v.number(),
    dashboardUrl: v.string(),
    unsubscribeToken: v.string(),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = `Story Report - ${args.storyTitle}`;

    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px;">
            </div>

            <h1 style="color: #292929; margin-bottom: 10px;">Story Report Requires Review</h1>
            <p style="color: #666; margin-bottom: 30px;">A submission has been reported and needs immediate admin attention.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #856404;">Report Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reported Story:</td>
                  <td style="padding: 8px 0;">
                    <a href="${args.storyUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                      ${args.storyTitle}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reported by:</td>
                  <td style="padding: 8px 0;">
                    ${args.reporterName}
                    ${args.reporterUsername ? ` (@${args.reporterUsername})` : ""}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reason:</td>
                  <td style="padding: 8px 0; color: #d63384; font-weight: 500;">${args.reportReason}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reported:</td>
                  <td style="padding: 8px 0;">${formatDate(args.reportTimestamp)}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${args.dashboardUrl}" style="display: inline-block; background: #d63384; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 0 10px;">Review Report</a>
              <a href="${args.storyUrl}" style="display: inline-block; background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 0 10px;">View Story</a>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>Action Required:</strong> This report requires immediate admin review. Please log into the admin dashboard to investigate and take appropriate moderation action.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                You received this email because you are an administrator at VibeApps.
              </p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                <a href="${args.adminUsername ? `https://vibeapps.dev/${args.adminUsername}` : args.adminUserId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666;">Manage email preferences</a> | 
                <a href="https://vibeapps.dev/admin" style="color: #666;">Admin Dashboard</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});
