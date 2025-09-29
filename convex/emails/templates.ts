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
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
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
                <strong>Update your profile</strong><br>
                Add your social links and bio<br>
                <a href="https://vibeapps.dev" style="color: #292929;">Let the community know about you!</a>
              </div>
            </div>

          
            
            <p>Happy building!<br>VibeApps.dev</p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences in the Manage Profile & Account section on your profile page.</a>${args.unsubscribeToken ? ` ` : ""}
              
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
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/profile"}" style="background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Your Profile</a>
            </div>

            <p>Keep shipping amazing things!</p>
            <p>VibeApps.dev. </p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
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
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
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
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
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
              <a href="${args.userUsername ? `https://vibeapps.dev/${args.userUsername}` : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}" style="color: #666; font-size: 12px;">Manage email preferences</a>${args.unsubscribeToken ? ` ` : ""}
              
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
 * Generate report notification email for admins/managers
 */
export const generateReportNotificationEmail = internalQuery({
  args: {
    adminName: v.string(),
    reporterName: v.string(),
    storyTitle: v.string(),
    storyUrl: v.string(),
    reportReason: v.string(),
    dashboardUrl: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Report - VibeApps</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #334155;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">⚠️ New Report Submitted</h1>
            <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 14px;">Requires immediate attention</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px;">
            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #475569;">
                Hello \${args.adminName},
            </p>
            
            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #475569;">
                A new report has been submitted and needs your review.
            </p>

            <!-- Report Details Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Report Details</h3>
                
                <div style="margin-bottom: 12px;">
                    <strong style="color: #475569;">Story:</strong>
                    <div style="margin-top: 4px;">
                        <a href="\${args.storyUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500; word-break: break-word;">
                            \${args.storyTitle}
                        </a>
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong style="color: #475569;">Reported by:</strong> \${args.reporterName}
                </div>
                
                <div>
                    <strong style="color: #475569;">Reason:</strong>
                    <div style="margin-top: 4px; background-color: #ffffff; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626;">
                        \${args.reportReason}
                    </div>
                </div>
            </div>

            <!-- Action Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="\${args.dashboardUrl}" 
                   style="display: inline-block; background-color: #292929; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Review in Admin Dashboard
                </a>
            </div>

            <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                Please review this report promptly to maintain community standards.
            </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                VibeApps Moderation Team
            </p>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                This is an automated notification for admins and managers only.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
  },
});
