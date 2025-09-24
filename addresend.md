# Resend Email Integration PRD - VibeApps

## Overview

This document outlines the implementation of Resend email integration for VibeApps, providing automated email notifications for admin reporting, user engagement, onboarding, and messaging. The system will leverage Convex.dev's real-time capabilities with Resend's email API to deliver timely, relevant communications to users and administrators.

## Chronological Implementation Plan

1. Environment & Dependencies
   - Create Resend account and set `RESEND_API_KEY`.
   - Confirm Convex deployment environment variables are set (Convex URL, Clerk webhook secret).
   - use the Convex Resend Component.

2. Schema & Settings
   - Add `emailSettings` (with `weeklyDigestEmails`), `emailLogs`, `dailyEngagementSummary`, `dailyMetrics`.
   - Add `emailUnsubscribeTokens`, `broadcastEmails`, and `appSettings` with `emailsEnabled` flag.
   - Ensure existing domain tables have needed indexes (see Schema section); prefer `withIndex` over `filter`.

3. Email Templates & Style
   - Implement HTML templates in `convex/emails/templates.ts` matching app style (black/white, no emojis).
   - Standardize footer: settings link + one‑click unsubscribe link.

4. Core Email Sender
   - Implement `convex/emails/resend.ts` action to send emails.
   - Read global `emailsEnabled` kill‑switch before sending. Log results in `emailLogs`.

5. Unsubscribe
   - Create token generation + storage in `emailUnsubscribeTokens`.
   - Add HTTP GET endpoint `/api/unsubscribe?token=...` to consume token and update `emailSettings`.
   - Add unsubscribe link to all templates.

6. Daily Flows
   - Implement daily admin metrics pipeline and email.
   - Implement user daily engagement pipeline: compute summary (engagement, new followers, followed submissions) and send one digest if active in last 24h.
   - Add crons: 9:00 admin, 17:30 compute engagement, 18:00 send user emails (PST).

7. Weekly Digest
   - Implement weekly "Most Vibes This Week" computation and template.
   - Add cron: Monday 9:00 AM PST. Respect `weeklyDigestEmails` and global kill‑switch.

8. Admin Controls
   - Admin Settings: add UI toggle to set `emailsEnabled` via `appSettings`.
   - Admin Broadcast: compose email to all users; create `broadcastEmails` record; scheduler batches sends respecting rate limits and per‑user preferences.

9. Frontend Settings UI
   - Profile settings to manage: daily engagement, message notifications, marketing, weekly digest, timezone, unsubscribe all.

10. Monitoring & Cleanup

- Track email status with `emailLogs`.
- Optional: integrate Convex Resend component cleanup crons.

11. @Mention Notifications

- Add user handles and mention parsing.
- Trigger mention emails from comments and judging notes.
- Respect per-user mention notification setting and online activity heuristics.

## Current System Analysis

### Existing Infrastructure

- **Domain**: vibeapps.dev hosted on Netlify
- **Database**: Convex.dev with real-time reactivity
- **Authentication**: Clerk Auth with webhook sync to Convex
- **Admin System**: Comprehensive admin dashboard with metrics tracking
- **User Engagement**: Voting, rating, commenting, bookmarking, and following systems
- **Planned Features**: Inbox messaging system (reference: inboxforapp.md)

### Current Metrics Available (from NumbersView.tsx)

- Total Submissions (apps submitted to platform)
- Total Users (registered users)
- Total Votes (upvotes on apps)
- Total Comments (comments on apps)
- Total Reports (user reports of content)
- Solved Reports (resolved reports)
- Total Bookmarks (bookmarked apps)
- Total Ratings (1-5 star ratings on apps)
- Total Follows (user follow relationships)
- Top 100 Most Followed Users
- Top 100 Users Following Others Most

### Tracked User Engagement Events

- **Votes**: When users vote on stories/apps (`votes` table)
- **Ratings**: When users rate apps 1-5 stars (`storyRatings` table)
- **Comments**: When users comment on apps (`comments` table)
- **Bookmarks**: When users bookmark apps (`bookmarks` table)
- **Follows**: When users follow other users (`follows` table)

## Email Integration Requirements

### 1. Daily Admin Status Email

**Purpose**: Provide admins with daily platform health and growth metrics

**Frequency**: Once daily at 9:00 AM PST

**Recipients**: Admin users (users with `role: "admin"` in Clerk metadata)

**Content Structure**:

```
Subject: VibeApps Daily Report - [Date]

Daily Metrics Summary:
• New Apps Submitted: X (vs. yesterday: +/-Y)
• New Users Signed Up: X (vs. yesterday: +/-Y)
• Total Platform Users: X
• Daily Engagement:
  - Votes Cast: X
  - Comments Added: X
  - Ratings Given: X
  - Bookmarks Added: X
  - New Follows: X

Weekly Trends:
• Most Active Users (top 5)
• Top Rated Apps This Week
• Trending Categories

Platform Health:
• Reports Pending: X
• Reports Resolved: X
• User Activity Rate: X%
```

### 2. Daily User Engagement Email

**Purpose**: Notify users when their content receives engagement while they're active

**Frequency**: Once daily at 6:00 PM user's timezone (defaulting to PST)

**Recipients**: Users who:

- Have submitted apps to the platform
- Were logged in within the last 24 hours
- Received at least one engagement (vote, rating, comment, bookmark) on their content

**Content Structure**:

```
Subject: Your apps received engagement today

Hey [UserName],

Here’s your daily summary:

[AppName]
- 3 new votes
- 1 new rating (4.2/5 average)
- 2 new comments
- 1 new bookmark

New followers today: 2
- jane_doe
- devmax

New submissions from people you follow:
- "SaaS Starter" by buildwithtom
- "AI Notes" by makerjules

[Read Comments]  [View App Stats]  [See New Followers]

Keep building amazing things!
- The VibeApps Team
```

**Conditions**:

- Only send if user was active (logged in) in last 24 hours
- Only send if they received any engagement OR gained new followers OR accounts they follow posted new submissions
- Group all events for the user into a single daily email
- Include unsubscribe link and a link to notification settings

### 3. Weekly Digest: Most Vibes This Week

**Purpose**: Weekly roundup highlighting the most vibed (voted) submissions across the platform.

**Frequency**: Once weekly on Monday at 9:00 AM PST

**Recipients**: Users who did not unsubscribe from digests (see `weeklyDigestEmails` in `emailSettings`).

**Content Structure**:

```
Subject: Most Vibes This Week

Top submissions this week (by vibes):
1) [App Title] — 124 vibes
2) [App Title] — 98 vibes
3) [App Title] — 77 vibes

[View Full Leaderboard]
```

**Notes**:

- Calculated over rolling 7-day window (Mon 00:00:00 to Sun 23:59:59 PST).
- Ties broken by recent activity, then creation time.
- Respect `appSettings.emailsEnabled` and per-user `emailSettings.weeklyDigestEmails`.

### 4. Welcome Onboarding Email

**Purpose**: Welcome new users and guide them through platform features

**Trigger**: When new user completes signup (triggered by Clerk webhook)

**Recipients**: All newly registered users

**Content Structure**:

```
Subject: Welcome to VibeApps! Let's get you started 🚀

Hey [UserName],

Welcome to VibeApps - the community for discovering and sharing amazing web applications!

Here's how to get started:

1. 🔍 Explore Apps
   Browse our collection of apps by category
   [Explore Apps]

2. 📱 Submit Your App
   Share your project with the community
   [Submit App]

3. 👥 Connect & Follow
   Follow creators you admire
   [Browse Creators]

4. 💬 Join Conversations
   Comment and rate apps you love
   [See Trending]

Need help? Reply to this email or visit our help center.

Happy building!
- The VibeApps Team

[Unsubscribe] | [Help Center] | [Follow us]
```

### 5. Inbox Message Notifications

**Purpose**: Notify users of new direct messages (from planned messaging system)

**Trigger**: When user receives new message in inbox system

**Recipients**: Message recipients (if they have email notifications enabled)

**Content Structure**:

```
Subject: New message from [SenderName] on VibeApps

Hey [RecipientName],

You have a new message from [SenderName]:

"[First 150 characters of message...]"

[Reply on VibeApps] [View All Messages]

Manage your notification preferences: [Settings Link]

- The VibeApps Team
```

**Conditions**:

- Only send if user has message email notifications enabled
- Don't send if user is currently online/active
- Rate limit: Max 5 message notification emails per day per user

### 6. @Mention Notifications (Comments & Judging Notes)

**Purpose**: Notify users when they are mentioned with `@username` in:

- Public comments on stories/apps
- Judge notes thread within the judging interface

**Trigger**:

- On create of a comment or judge note containing `@handle` tokens

**Recipients**: Users whose username is mentioned, if they have mention notifications enabled

**Content Structure**:

```
Subject: You were mentioned by [AuthorName]

Hey [UserName],

You were mentioned in a [comment|judge note] on: [StoryTitle]

"[excerpt of content around the @mention]"

[View Thread]

- The VibeApps Team
```

**Conditions**:

- Skip if the mentioned user is the author of the message
- Skip if user has `mentionNotifications` set to false
- Skip if user is currently online (optional heuristic)
- Rate limit: Max 10 mention emails per day per user (distinct from 30/day mention creation quota in mentions.md)

## Database Schema Updates

### New Tables Required

```typescript
// convex/schema.ts additions

export default defineSchema({
  // ... existing tables ...

  // Email notification preferences for users
  emailSettings: defineTable({
    userId: v.id("users"),
    dailyEngagementEmails: v.boolean(), // Default: true
    messageNotifications: v.boolean(), // Default: true
    marketingEmails: v.boolean(), // Default: false
    weeklyDigestEmails: v.boolean(), // Default: true
    mentionNotifications: v.boolean(), // Default: true
    timezone: v.optional(v.string()), // User's timezone, default PST
    unsubscribedAt: v.optional(v.number()), // Timestamp if unsubscribed
  }).index("by_user", ["userId"]),

  // Track daily email sends to prevent duplicates
  emailLogs: defineTable({
    userId: v.optional(v.id("users")), // Optional for admin emails
    emailType: v.union(
      v.literal("daily_admin"),
      v.literal("daily_engagement"),
      v.literal("welcome"),
      v.literal("message_notification"),
      v.literal("weekly_digest"),
      v.literal("mention_notification"),
      v.literal("admin_broadcast"),
    ),
    recipientEmail: v.string(),
    sentAt: v.number(),
    resendMessageId: v.optional(v.string()), // Store Resend message ID
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("delivered"),
    ),
    metadata: v.optional(v.any()), // Store email-specific data
  })
    .index("by_user_type_date", ["userId", "emailType", "sentAt"])
    .index("by_type_date", ["emailType", "sentAt"])
    .index("by_resend_id", ["resendMessageId"]),

  // Track daily engagement for users (for email content)
  dailyEngagementSummary: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    votesReceived: v.number(),
    ratingsReceived: v.number(),
    commentsReceived: v.number(),
    bookmarksReceived: v.number(),
    totalEngagement: v.number(),
    storyEngagements: v.array(
      v.object({
        storyId: v.id("stories"),
        storyTitle: v.string(),
        votes: v.number(),
        ratings: v.number(),
        comments: v.number(),
        bookmarks: v.number(),
      }),
    ),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_date", ["date"]),

  // Daily platform metrics snapshot
  dailyMetrics: defineTable({
    date: v.string(), // YYYY-MM-DD format
    newSubmissions: v.number(),
    newUsers: v.number(),
    totalUsers: v.number(),
    dailyVotes: v.number(),
    dailyComments: v.number(),
    dailyRatings: v.number(),
    dailyBookmarks: v.number(),
    dailyFollows: v.number(),
    activeUsers: v.number(), // Users who logged in that day
    pendingReports: v.number(),
    resolvedReports: v.number(),
  }).index("by_date", ["date"]),

  // Unsubscribe tokens for one-click unsubscribe links
  emailUnsubscribeTokens: defineTable({
    userId: v.id("users"),
    token: v.string(), // signed token
    purpose: v.union(
      v.literal("all"),
      v.literal("daily_engagement"),
      v.literal("weekly_digest"),
      v.literal("marketing"),
    ),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Admin broadcast campaigns
  broadcastEmails: defineTable({
    createdBy: v.id("users"),
    subject: v.string(),
    html: v.string(),
    filter: v.optional(v.object({})), // optional targeting; keep simple in v1
    status: v.union(
      v.literal("draft"),
      v.literal("queued"),
      v.literal("sending"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    totalRecipients: v.optional(v.number()),
    sentCount: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  // App/site settings (global flags)
  appSettings: defineTable({
    key: v.string(), // e.g., "emailsEnabled"
    valueBoolean: v.optional(v.boolean()),
  }).index("by_key", ["key"]),
});
```

### Mentions Data Model and Utilities (Cross‑Reference)

This email PRD reuses the mentions pipeline defined in `mentions.md` for durable events, rate limiting, and future rollups.

```typescript
// convex/schema.ts additions (from mentions.md)

export default defineSchema({
  // ...existing tables...

  mentions: defineTable({
    actorUserId: v.id("users"),
    targetUserId: v.id("users"),
    context: v.union(v.literal("comment"), v.literal("judge_note")),
    sourceId: v.union(v.id("comments"), v.id("submissionNotes")),
    storyId: v.id("stories"),
    groupId: v.optional(v.id("judgingGroups")),
    contentExcerpt: v.string(),
    date: v.string(), // YYYY-MM-DD
  })
    .index("by_actor_and_date", ["actorUserId", "date"]) // quota checks
    .index("by_target_and_date", ["targetUserId", "date"]) // daily rollups
    .index("by_context_and_source", ["context", "sourceId"]),
});
```

Utilities to reuse (from `convex/mentions.ts` per mentions.md):

- `internal.mentions.extractHandles` (args: `{ text }`) → returns `string[]` of usernames without `@`
- `internal.mentions.resolveHandlesToUsers` (args: `{ handles }`) → returns `{ handle, userId }[]` via `users.by_username`
- `internal.mentions.getActorDailyCount` (args: `{ actorUserId, date }`) → `number`
- `internal.mentions.recordMentions` (args include `actorUserId`, `resolvedTargets`, `context`, `sourceId`, `storyId`, `groupId`, `contentExcerpt`, `date`) → counters object

Email fanout for @mentions in this PRD should:

1. Call `extractHandles` and `resolveHandlesToUsers` (do not reimplement parsing/resolution here).
2. Call `recordMentions` to enforce the 30/day actor quota and persist durable events.
3. Filter recipients by `emailSettings.mentionNotifications !== false` and skip self‑mentions.
4. Apply email rate limit of 10/day per recipient for mention emails (separate from the 30/day actor creation quota).
5. Send via the core Resend action, log to `emailLogs` as `mention_notification`.
6. Link to the specific thread using the `permalink` built in the integration point.

Note: A future daily digest could aggregate `mentions` via `by_target_and_date` to batch mention emails, if desired.

## Backend Implementation

### File Structure

```
convex/
├── emails/
│   ├── resend.ts           # Resend API integration
│   ├── templates.ts        # Email template functions
│   ├── daily.ts            # Daily email processing
│   ├── weekly.ts           # Weekly digest processing
│   └── notifications.ts    # Real-time email notifications
├── crons.ts               # Scheduled email jobs
└── emailSettings.ts       # User email preferences
```

### Core Functions Overview

#### `convex/emails/resend.ts`

```typescript
"use node";
import { Resend } from "resend";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    from: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Global kill switch: skip sending if disabled
      const emailsEnabled = await ctx.runQuery(internal.settings.getBoolean, {
        key: "emailsEnabled",
      });
      if (emailsEnabled === false) {
        return { success: true, messageId: undefined };
      }

      const { data, error } = await resend.emails.send({
        from: args.from || "VibeApps <noreply@vibeapps.dev>",
        to: [args.to],
        subject: args.subject,
        html: args.html,
        replyTo: args.replyTo || "hello@vibeapps.dev",
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (err: any) {
      console.error("Email send error:", err);
      return { success: false, error: err.message };
    }
  },
});
```

> Note: `internal.settings.getBoolean` should be defined alongside existing settings utilities to read `appSettings` by key.

#### Admin Controls & Broadcast

```
Admin Global Email Toggle:
- Store `appSettings` with key `emailsEnabled` (boolean).
- Expose `settings.getBoolean` internal query:

// convex/settings.ts (excerpt)
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getBoolean = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.null(), v.boolean()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row?.valueBoolean ?? null;
  },
});

export const setBoolean = internalMutation({
  args: { key: v.string(), value: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { valueBoolean: args.value });
    else await ctx.db.insert("appSettings", { key: args.key, valueBoolean: args.value });
    return null;
  },
});

Admin Broadcast:
- New admin dashboard section to compose `subject` + HTML body.
- Create a `broadcastEmails` record (status `queued`).
- Scheduler fans out batches reading user list respecting per-user settings and `emailsEnabled`.
- Log to `emailLogs` with type `admin_broadcast`.
```

#### `convex/emails/templates.ts`

```typescript
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const generateDailyAdminEmail = internalQuery({
  args: {
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

    const subject = `VibeApps Daily Report - ${metrics.date}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
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
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

export const generateWelcomeEmail = internalQuery({
  args: {
    userName: v.string(),
    userEmail: v.string(),
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
            <h1 style="color: #292929;">Welcome to VibeApps!</h1>
            
            <p>Hey ${args.userName},</p>
            
            <p>Welcome to VibeApps - the community for discovering and sharing amazing web applications!</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Here's how to get started:</h2>
              
              <div style="margin: 15px 0;">
                <strong>Explore Apps</strong><br>
                Browse our collection of apps by category<br>
                <a href="https://vibeapps.dev" style="color: #292929;">Explore Apps →</a>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Submit Your App</strong><br>
                Share your project with the community<br>
                <a href="https://vibeapps.dev/submit" style="color: #292929;">Submit App →</a>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Connect & Follow</strong><br>
                Follow creators you admire<br>
                <a href="https://vibeapps.dev/users" style="color: #292929;">Browse Creators →</a>
              </div>
              
              <div style="margin: 15px 0;">
                <strong>Join Conversations</strong><br>
                Comment and rate apps you love<br>
                <a href="https://vibeapps.dev/trending" style="color: #292929;">See Trending →</a>
              </div>
            </div>

            <p>Need help? Reply to this email or visit our help center.</p>
            
            <p>Happy building!<br>- The VibeApps Team</p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="https://vibeapps.dev/settings" style="color: #666; font-size: 12px;">Manage email preferences</a> | 
              <a href="https://vibeapps.dev/help" style="color: #666; font-size: 12px;">Help Center</a>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});

export const generateEngagementEmail = internalQuery({
  args: {
    userName: v.string(),
    engagementSummary: v.object({
      totalEngagement: v.number(),
      storyEngagements: v.array(
        v.object({
          storyId: v.id("stories"),
          storyTitle: v.string(),
          votes: v.number(),
          ratings: v.number(),
          comments: v.number(),
          bookmarks: v.number(),
        }),
      ),
    }),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = "Your apps received engagement today";

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
          <a href="https://vibeapps.dev/app/${app.storyId}" style="color: #292929; text-decoration: none;">View App →</a>
        </div>
      `;
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #292929;">Your apps received engagement today</h1>
            
            <p>Hey ${args.userName},</p>
            
            <p>Great news! Your apps received engagement today:</p>
            
            ${args.engagementSummary.storyEngagements.map(generateAppSection).join("")}

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://vibeapps.dev/dashboard" style="background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Your Dashboard</a>
            </div>

            <p>Keep building amazing things!</p>
            <p>- The VibeApps Team</p>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="https://vibeapps.dev/settings" style="color: #666; font-size: 12px;">Manage email preferences</a>
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});
```

#### `convex/emails/mentions.ts`

```typescript
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// Parse @usernames from text (aligned with mentions.md)
export const extractMentions = internalQuery({
  args: { text: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const handles = new Set<string>();
    const regex = /(^|\s)@([a-zA-Z0-9_\.]+)/g; // same as mentions.md
    let match: RegExpExecArray | null;
    while ((match = regex.exec(args.text))) handles.add(match[2]);
    return Array.from(handles);
  },
});

// Resolve usernames to users via by_username (aligned with mentions.md)
export const resolveHandles = internalQuery({
  args: { handles: v.array(v.string()) },
  returns: v.array(v.object({ userId: v.id("users"), handle: v.string() })),
  handler: async (ctx, args) => {
    const results: Array<{ userId: any; handle: string }> = [];
    for (const h of args.handles) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", h))
        .unique();
      if (u) results.push({ userId: u._id, handle: h });
    }
    return results;
  },
});

export const sendMentionNotifications = internalMutation({
  args: {
    context: v.union(v.literal("comment"), v.literal("judge_note")),
    storyId: v.id("stories"),
    authorId: v.id("users"),
    rawText: v.string(),
    permalink: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Outline only in PRD: resolve handles, filter recipients by settings, rate-limit, send via resend
    return null;
  },
});
```

#### `convex/emails/daily.ts`

```typescript
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

// Calculate daily metrics for admin email
export const calculateDailyMetrics = internalQuery({
  args: { date: v.string() },
  returns: v.object({
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
  handler: async (ctx, args) => {
    const today = new Date(args.date);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

    // Calculate metrics using existing admin queries patterns
    const newSubmissions = await ctx.db
      .query("stories")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const newUsers = await ctx.db
      .query("users")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const totalUsers = await ctx.db.query("users").collect();

    const dailyVotes = await ctx.db
      .query("votes")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyComments = await ctx.db
      .query("comments")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyRatings = await ctx.db
      .query("storyRatings")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyBookmarks = await ctx.db
      .query("bookmarks")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const dailyFollows = await ctx.db
      .query("follows")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    const pendingReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const resolvedReports = await ctx.db
      .query("reports")
      .filter(
        (q) =>
          q.or(
            q.eq(q.field("status"), "resolved_hidden"),
            q.eq(q.field("status"), "resolved_deleted"),
          ) &&
          q.gte(q.field("_creationTime"), startOfDay) &&
          q.lte(q.field("_creationTime"), endOfDay),
      )
      .collect();

    return {
      date: args.date,
      newSubmissions: newSubmissions.length,
      newUsers: newUsers.length,
      totalUsers: totalUsers.length,
      dailyVotes: dailyVotes.length,
      dailyComments: dailyComments.length,
      dailyRatings: dailyRatings.length,
      dailyBookmarks: dailyBookmarks.length,
      dailyFollows: dailyFollows.length,
      activeUsers: 0, // TODO: Implement user activity tracking
      pendingReports: pendingReports.length,
      resolvedReports: resolvedReports.length,
    };
  },
});

// Process daily engagement for users
export const processUserEngagement = internalMutation({
  args: { date: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const today = new Date(args.date);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

    // Get all users who have submitted stories
    const storyAuthors = await ctx.db
      .query("stories")
      .filter((q) => q.neq(q.field("userId"), undefined))
      .collect();

    const uniqueAuthorIds = [...new Set(storyAuthors.map((s) => s.userId))];

    for (const userId of uniqueAuthorIds) {
      if (!userId) continue;

      const userStories = storyAuthors.filter((s) => s.userId === userId);
      const storyIds = userStories.map((s) => s._id);

      let totalEngagement = 0;
      const storyEngagements = [];

      for (const story of userStories) {
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_story", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const ratings = await ctx.db
          .query("storyRatings")
          .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const comments = await ctx.db
          .query("comments")
          .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const bookmarks = await ctx.db
          .query("bookmarks")
          .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
          .filter(
            (q) =>
              q.gte(q.field("_creationTime"), startOfDay) &&
              q.lte(q.field("_creationTime"), endOfDay),
          )
          .collect();

        const storyEngagement =
          votes.length + ratings.length + comments.length + bookmarks.length;
        totalEngagement += storyEngagement;

        if (storyEngagement > 0) {
          storyEngagements.push({
            storyId: story._id,
            storyTitle: story.title,
            votes: votes.length,
            ratings: ratings.length,
            comments: comments.length,
            bookmarks: bookmarks.length,
          });
        }
      }

      if (totalEngagement > 0) {
        await ctx.db.insert("dailyEngagementSummary", {
          userId,
          date: args.date,
          votesReceived: storyEngagements.reduce((sum, s) => sum + s.votes, 0),
          ratingsReceived: storyEngagements.reduce(
            (sum, s) => sum + s.ratings,
            0,
          ),
          commentsReceived: storyEngagements.reduce(
            (sum, s) => sum + s.comments,
            0,
          ),
          bookmarksReceived: storyEngagements.reduce(
            (sum, s) => sum + s.bookmarks,
            0,
          ),
          totalEngagement,
          storyEngagements,
        });
      }
    }

    return null;
  },
});
```

#### `convex/emails/weekly.ts`

```typescript
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Compute weekly leaderboard by vibes
export const computeWeeklyMostVibes = internalQuery({
  args: {
    weekStartMs: v.number(),
    weekEndMs: v.number(),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      storyId: v.id("stories"),
      title: v.string(),
      vibes: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // NOTE: Replace with indexed queries as available in schema
    const votes = await ctx.db
      .query("votes")
      .filter(
        (q) =>
          q.gte(q.field("_creationTime"), args.weekStartMs) &&
          q.lte(q.field("_creationTime"), args.weekEndMs),
      )
      .collect();

    const countByStory: Record<string, number> = {};
    for (const vte of votes) {
      const key = String(vte.storyId);
      countByStory[key] = (countByStory[key] ?? 0) + 1;
    }

    const entries = Object.entries(countByStory)
      .map(([storyId, vibes]) => ({ storyId, vibes }))
      .sort((a, b) => b.vibes - a.vibes)
      .slice(0, args.limit);

    const results = [] as Array<{ storyId: any; title: string; vibes: number }>;
    for (const e of entries) {
      const doc = await ctx.db.get(e.storyId as any);
      if (doc)
        results.push({ storyId: doc._id, title: doc.title, vibes: e.vibes });
    }
    return results;
  },
});

export const sendWeeklyDigest = internalMutation({
  args: { date: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // implementation outline in PRD only
    return null;
  },
});
```

#### `convex/crons.ts`

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily admin email at 9:00 AM PST
crons.cron(
  "daily admin email",
  "0 9 * * *",
  internal.emails.daily.sendDailyAdminEmail,
  {},
);

// Process daily engagement at 5:30 PM PST (before user emails)
crons.cron(
  "process daily engagement",
  "30 17 * * *",
  internal.emails.daily.processUserEngagement,
  {
    date: new Date().toISOString().split("T")[0],
  },
);

// Send user engagement emails at 6:00 PM PST
crons.cron(
  "daily user emails",
  "0 18 * * *",
  internal.emails.daily.sendDailyUserEmails,
  {},
);

// Weekly digest Monday 9:00 AM PST
crons.cron(
  "weekly most vibes",
  "0 9 * * MON",
  internal.emails.weekly.sendWeeklyDigest,
  {
    date: new Date().toISOString().split("T")[0],
  },
);

// Optional: cleanup resend component data hourly (see Convex Resend component docs)
// crons.interval("cleanup resend", { hours: 1 }, internal.crons.cleanupResend, {});

export default crons;
```

### User Email Settings

#### `convex/emailSettings.ts`

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./utils";

export const getEmailSettings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      dailyEngagementEmails: v.boolean(),
      messageNotifications: v.boolean(),
      marketingEmails: v.boolean(),
      timezone: v.optional(v.string()),
      unsubscribedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const { user } = await requireAuth(ctx);
    if (!user) return null;

    const settings = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return (
      settings || {
        dailyEngagementEmails: true,
        messageNotifications: true,
        marketingEmails: false,
        timezone: "America/Los_Angeles",
      }
    );
  },
});

export const updateEmailSettings = mutation({
  args: {
    dailyEngagementEmails: v.optional(v.boolean()),
    messageNotifications: v.optional(v.boolean()),
    marketingEmails: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) throw new Error("User not authenticated");

    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("emailSettings", {
        userId: user._id,
        dailyEngagementEmails: args.dailyEngagementEmails ?? true,
        messageNotifications: args.messageNotifications ?? true,
        marketingEmails: args.marketingEmails ?? false,
        timezone: args.timezone ?? "America/Los_Angeles",
      });
    }

    return { success: true };
  },
});

export const unsubscribeUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        dailyEngagementEmails: false,
        messageNotifications: false,
        marketingEmails: false,
        unsubscribedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("emailSettings", {
        userId: args.userId,
        dailyEngagementEmails: false,
        messageNotifications: false,
        marketingEmails: false,
        unsubscribedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
```

### One-Click Unsubscribe Flow

```
Flow:
1) Generate token and store in `emailUnsubscribeTokens` per user and purpose (e.g., "all").
2) Include link in footer: https://<convex-site>/api/unsubscribe?token=<signedToken>
3) HTTP endpoint verifies token, patches `emailSettings` accordingly, logs event to `emailLogs`, and renders a confirmation page.
```

```typescript
// convex/http.ts (excerpt)
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/unsubscribe",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 400 });
    const ok: boolean = await ctx.runMutation(
      internal.emails.unsubscribe.handleToken,
      { token },
    );
    if (!ok) return new Response("Invalid or expired token", { status: 400 });
    return new Response("You have been unsubscribed.", { status: 200 });
  }),
});

export default http;
```

```typescript
// convex/emails/unsubscribe.ts (outline)
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const handleToken = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const rec = await ctx.db
      .query("emailUnsubscribeTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!rec || rec.consumedAt || rec.expiresAt < Date.now()) return false;
    const { userId, purpose } = rec;
    const settings = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (settings) {
      const patch: any = { unsubscribedAt: Date.now() };
      if (purpose === "all") {
        patch.dailyEngagementEmails = false;
        patch.messageNotifications = false;
        patch.marketingEmails = false;
        patch.weeklyDigestEmails = false;
      } else if (purpose === "daily_engagement")
        patch.dailyEngagementEmails = false;
      else if (purpose === "weekly_digest") patch.weeklyDigestEmails = false;
      else if (purpose === "marketing") patch.marketingEmails = false;
      await ctx.db.patch(settings._id, patch);
    }
    await ctx.db.patch(rec._id, { consumedAt: Date.now() });
    return true;
  },
});
```

## Integration Points

### 1. Welcome Email Trigger

Update `convex/users.ts` ensureUser mutation:

```typescript
// In ensureUser mutation, after creating new user
if (!existingUser) {
  const userId = await ctx.db.insert("users", {
    // ... existing fields
  });

  // Trigger welcome email
  await ctx.scheduler.runAfter(
    0,
    internal.emails.notifications.sendWelcomeEmail,
    {
      userId: userId,
    },
  );

  return userId;
}
```

### 2. Clerk Webhook Integration

Update `convex/clerk.ts` to trigger welcome email:

```typescript
// In handleClerkWebhook, after user creation
case "user.created":
  const newUserId = await ctx.runMutation(internal.users.syncUserFromClerkWebhook, {
    // ... existing args
  });

  // Trigger welcome email for new users
  await ctx.runAction(internal.emails.notifications.sendWelcomeEmail, {
    userId: newUserId,
  });
  break;
```

### 3. Message Notification Integration

When messaging system is implemented, add to message send mutation:

```typescript
// In sendMessage mutation (from planned messaging system)
export const sendMessage = mutation({
  // ... existing implementation
  handler: async (ctx, args) => {
    // ... send message logic

    // Check if recipient wants email notifications
    const recipientSettings = await ctx.db
      .query("emailSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.recipientId))
      .unique();

    if (recipientSettings?.messageNotifications !== false) {
      await ctx.scheduler.runAfter(
        0,
        internal.emails.notifications.sendMessageNotification,
        {
          recipientId: args.recipientId,
          senderId: args.senderId,
          messagePreview: args.content.substring(0, 150),
        },
      );
    }
  },
});
```

### 4. Comments @Mention Integration

```typescript
// In comments create mutation (outline)
export const createComment = mutation({
  // ...existing args/returns
  handler: async (ctx, args) => {
    const commentId = await ctx.db.insert("comments", {
      /* ... */
    });
    // Mention fanout (non-blocking):
    await ctx.scheduler.runAfter(
      0,
      internal.emails.mentions.sendMentionNotifications,
      {
        context: "comment",
        storyId: args.storyId,
        authorId: args.authorId,
        rawText: args.content,
        permalink: `https://vibeapps.dev/s/${args.storySlug}#c-${String(commentId)}`,
      },
    );
    return commentId;
  },
});
```

### 5. Judging Notes @Mention Integration

```typescript
// In addSubmissionNote mutation (judging notes)
export const addSubmissionNote = mutation({
  // ...existing impl
  handler: async (ctx, args) => {
    const noteId = await /* existing insert */ ctx.db.insert(
      "submissionNotes",
      {
        /*...*/
      },
    );
    await ctx.scheduler.runAfter(
      0,
      internal.emails.mentions.sendMentionNotifications,
      {
        context: "judge_note",
        storyId: args.storyId,
        authorId: args.judgeId as any, // judge as user id or mapped
        rawText: args.content,
        permalink: `https://vibeapps.dev/judging/${args.groupSlug}?story=${String(args.storyId)}#n-${String(noteId)}`,
      },
    );
    return noteId;
  },
});
```

## Environment Variables

Required environment variables for Netlify deployment:

```bash
# Resend API Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx

# Email Configuration
RESEND_FROM_DOMAIN=vibeapps.dev
ADMIN_EMAIL=admin@vibeapps.dev

# Existing Convex/Clerk vars
VITE_CONVEX_URL=https://xxx.convex.cloud
CLERK_WEBHOOK_SECRET=whsec_xxx
```

## Email Templates Design

### Visual Design Standards (match app style)

- **Brand Colors**: #292929 (primary), #f9f9f9 (surface light), #ffffff (background)
- **Typography**: Arial, sans-serif for cross-client compatibility
- **Layout**: Maximum 600px width for mobile compatibility
- **CTA Buttons**: Consistent styling with #292929 background
- **Footer**: Standard unsubscribe and settings links
- **Icons/Emojis**: Do not use emojis to keep consistent with app and deliverability

### Content Guidelines

- **Tone**: Professional but friendly, community-focused
- **Length**: Concise, scannable content with clear hierarchy
- **Personalization**: Use first names, relevant user data
- **CTAs**: Clear, actionable next steps
- **Value**: Always provide clear value to the recipient
- **Accessibility**: Sufficient contrast, descriptive link text, no image-only CTAs

## Implementation Timeline

### Phase 1: Foundation (Week 1)

- [ ] Set up Resend account and API integration
- [ ] Implement basic email templates and sending functions
- [ ] Create email settings schema and management
- [ ] Set up environment variables and configuration

### Phase 2: Admin Emails (Week 2)

- [ ] Implement daily metrics calculation
- [ ] Create admin email template and sending logic
- [ ] Set up cron job for daily admin emails
- [ ] Test admin email delivery and content

### Phase 3: Welcome Emails (Week 3)

- [ ] Integrate welcome email with user signup flow
- [ ] Test welcome email triggering via Clerk webhook
- [ ] Implement email tracking and logging
- [ ] Create unsubscribe mechanism

### Phase 4: User Engagement Emails (Week 4)

- [ ] Implement daily engagement calculation
- [ ] Create user engagement email templates
- [ ] Set up cron jobs for engagement processing and emails
- [ ] Test engagement email delivery and personalization

### Phase 5: Message Notifications (Week 5)

- [ ] Prepare message notification infrastructure
- [ ] Integrate with planned messaging system
- [ ] Implement rate limiting and user preferences
- [ ] Test message notification flow

### Phase 6: Polish & Optimization (Week 6)

- [ ] Email deliverability optimization
- [ ] Performance monitoring and error handling
- [ ] User settings UI in profile/settings pages
- [ ] Comprehensive testing and bug fixes

## Success Metrics

### Email Performance

- **Delivery Rate**: >95% successful delivery
- **Open Rate**: >25% for engagement emails, >40% for welcome emails
- **Click Rate**: >5% on CTAs
- **Unsubscribe Rate**: <2% monthly
- **Complaint Rate**: <0.1%

### User Engagement

- **Welcome Email**: Track user actions after welcome email
- **Engagement Email**: Monitor return visits after engagement notifications
- **Admin Email**: Ensure daily admin email reliability
- **Message Notifications**: Track message response rates

### Technical Performance

- **Processing Time**: Daily cron jobs complete within 5 minutes
- **Error Rate**: <1% email sending failures
- **Retry Logic**: Successful retry on transient failures
- **Monitoring**: Real-time alerts for email system issues

## Technical Considerations

### Email Deliverability

- **SPF/DKIM**: Configure proper DNS records for vibeapps.dev
- **DMARC**: Set up DMARC policy for domain protection
- **Reputation**: Monitor sending reputation and feedback loops
- **List Hygiene**: Automatic removal of bounced emails

### Rate Limiting

- **Resend Limits**: Respect Resend API rate limits (100 emails/second)
- **User Limits**: Max 1 engagement email per user per day
- **Admin Limits**: Max 1 admin email per day
- **Message Limits**: Max 5 message notifications per user per day
- **Broadcast Batching**: Use batches of 500 recipients with backoff respecting Resend limits

### Error Handling

- **Retry Logic**: Exponential backoff for failed sends
- **Dead Letter Queue**: Log failed emails for manual review
- **Fallback**: Graceful degradation if email service unavailable
- **Monitoring**: Real-time alerts for email failures

### Privacy & Compliance

- **Unsubscribe**: One-click unsubscribe in all emails
- **One-Click UX**: Confirmation page via `/api/unsubscribe` endpoint; no re-login required
- **Data Protection**: Minimal data in email content
- **Consent**: Clear opt-in for marketing emails
- **Audit Trail**: Log all email sends for compliance

## Future Enhancements

### Advanced Features

- **Email Analytics**: Detailed open/click tracking dashboard
- **A/B Testing**: Test different email templates and send times
- **Smart Scheduling**: Send emails at optimal user timezone
- **Digest Mode**: Weekly instead of daily engagement summaries

### AI Integration

- **Smart Summaries**: AI-generated content summaries for admin emails
- **Personalization**: AI-powered email content customization
- **Send Time Optimization**: ML-driven optimal send time prediction
- **Content Recommendations**: Personalized app recommendations in emails

### Mobile Integration

- **Push Notifications**: Complement emails with push notifications
- **SMS Notifications**: Optional SMS for critical messages
- **Progressive Web App**: Native notification support
- **Deep Linking**: Direct links to specific app sections

---

This comprehensive email integration will enhance user engagement, provide valuable admin insights, and create a more connected VibeApps community experience.

## References

- Convex Docs: https://docs.convex.dev/
- Convex Resend Component: https://www.convex.dev/components/resend
- Resend Knowledge Base: https://resend.com/docs/knowledge-base/introduction
- Resend Email Templates: https://resend.com/docs/dashboard/emails/email-templates
- React Email + Resend: https://react.email/docs/integrations/resend
- React Email v4: https://resend.com/blog/react-email-4
- Resend Dashboard Emails Intro: https://resend.com/docs/dashboard/emails/introduction
