# Resend Email Integration PRD VibeApps ✅ FULLY IMPLEMENTED

**Status**: Production ready email system with all features working, critical bugs fixed, and comprehensive debugging capabilities

## Domains and environments

- Primary app domain: `vibeapps.dev`
- Email sending subdomain: `updates.vibeapps.dev` (from: `alerts@updates.vibeapps.dev`)
- Local development UI: `http://localhost:5173/`
- Convex development and production have distinct Clerk webhook secrets and Resend keys (already configured).

All subjects are prefixed: `VibeApps Updates: <topic>`.

## Overview

This document outlines the implementation of Resend email integration for VibeApps, providing automated email notifications for admin reporting, user engagement, onboarding, and messaging. The system leverages Convex.dev's real-time capabilities with Resend's email API to deliver timely, relevant communications to users and administrators.

## System Behavior & Duplicate Prevention

### Automatic Daily Reset

The email system uses **date-based duplicate prevention** that automatically resets at midnight PST each day:

- **Daily Emails**: Users receive at most one daily engagement email per calendar day
- **Weekly Emails**: Users receive at most one weekly digest per week
- **Automatic Reset**: The system checks if an email was sent "today" using midnight-to-midnight PST boundaries
- **Production Ready**: No manual intervention required - emails send correctly every day after midnight PST

### How Duplicate Prevention Works

```typescript
// The system checks for emails sent TODAY using date boundaries
const today = new Date();
const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime();
const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime();

// Only emails sent between these timestamps count as "already sent today"
const alreadySent = await ctx.db
  .query("emailLogs")
  .filter(
    (q) =>
      q.gte(q.field("sentAt"), startOfDay) &&
      q.lte(q.field("sentAt"), endOfDay),
  );
```

**Key Points**:

- At 12:00:01 AM PST, all "already sent today" checks return false
- Users who received emails yesterday can receive new emails today
- No manual log clearing needed in production
- Cron jobs run automatically without conflicts

### Comprehensive Logging System

All email functions include detailed logging for debugging and monitoring:

**Weekly Digest Logs**:

- App count with vibes found
- Total users to process
- Emails sent vs skipped with reasons
- Final completion status

**Daily User Engagement Logs**:

- Engagement summaries found
- Mentions found
- Unique users to process
- Per-user skip reasons (unsubscribed, already sent, no engagement)
- Final sent/skipped counts

**Processing Logs**:

- Stories found per day
- Authors processed
- Engagement summaries created
- Users with engagement data

### Testing & Development Utilities

**Clear Today's Email Logs** (`convex/testDailyEmail.ts`):

- Admin-only mutation `clearTodaysEmailLogs`
- Clears email logs from today for re-testing
- Optional email type filtering (daily_engagement, weekly_digest, etc.)
- Accessible via Admin Dashboard → Emails → "Clear Today's Email Logs" button
- Returns count of logs cleared

**Why This Matters**:

- Admins can test emails multiple times per day during development
- Production systems never need this - automatic reset handles everything
- Safe for testing - only affects current day, doesn't touch historical logs

## User Email Preferences & Testing

### User-Facing Email Preferences UI

**Location**: User Profile Page → "Manage Profile & Account" → "Email Preferences" card

**Features**:

- **Visual Status Display**: Shows current subscription status
  - "Receiving email notifications" when subscribed
  - "Currently unsubscribed from all emails" when unsubscribed
- **One-Click Toggle**: Single button switches between subscribed/unsubscribed
  - "Unsubscribe" button when currently subscribed
  - "Resubscribe" button when currently unsubscribed
- **Confirmation Dialogs**: All changes require user confirmation
- **Immediate Effect**: Changes apply instantly without page refresh

**Technical Implementation**:

- Location: `src/pages/UserProfilePage.tsx`
- Mutations: `api.emailSettings.unsubscribeAll` and `api.emailSettings.updateEmailSettings`
- State Management: Real-time updates via Convex reactivity
- Only visible on user's own profile (not visible when viewing other profiles)

### Testing Email Preferences (Step-by-Step)

#### Test Unsubscribe Flow:

1. **Navigate to Profile**:
   - Sign in to your account
   - Go to your user profile page
   - Scroll to "Manage Profile & Account" section
   - Locate "Email Preferences" card

2. **Unsubscribe**:
   - Click "Unsubscribe" button
   - Confirm action in dialog
   - Verify UI updates to show "Currently unsubscribed from all emails"
   - Button changes to "Resubscribe"

3. **Verify in Database** (Convex Dashboard):
   - Open `emailSettings` table
   - Find your user's record
   - Confirm `unsubscribedAt` has a timestamp
   - All email flags should be `false`

4. **Test Email Blocking**:
   - Go to Admin Dashboard → Emails
   - Click "Clear Today's Email Logs"
   - Send test emails (Daily/Weekly)
   - Check Convex logs: should see "Skipped: Unsubscribed"
   - **No emails should be sent**

#### Test Resubscribe Flow:

1. **Resubscribe**:
   - Click "Resubscribe" button
   - Confirm action in dialog
   - Verify UI updates to show "Receiving email notifications"
   - Button changes back to "Unsubscribe"

2. **Verify in Database**:
   - Check `emailSettings` table
   - Confirm `unsubscribedAt` is cleared/undefined
   - All email flags should be `true`

3. **Test Email Delivery**:
   - Clear today's email logs again
   - Send test emails
   - Check Convex logs: should see "Sending email to [your name]"
   - **Emails should be delivered to your inbox**

### Production Behavior

**Automatic Operation**:

- Users can unsubscribe/resubscribe at any time
- Changes take effect immediately for future emails
- No admin intervention required
- System respects user preferences across all email types:
  - Daily engagement emails
  - Weekly digest emails
  - Mention notifications
  - Message notifications
  - Admin broadcast emails

**Email Blocking Logic**:

```typescript
// System checks unsubscribedAt before sending ANY email
if (emailSettings?.unsubscribedAt) {
  console.log("Skipped: User has unsubscribed from all emails");
  continue; // Email NOT sent
}
```

**Safety Features**:

- Confirmation dialogs prevent accidental changes
- Unsubscribe is reversible (users can resubscribe anytime)
- Preference changes logged for audit trail
- Clear visual feedback on current status

## Email Types

VibeApps sends the following types of emails:

1. **Daily Admin Status Email** (line 106) - Daily platform metrics and health report for administrators
2. **Daily User Engagement Email** (line 141) - Personalized activity summary for users with recent engagement
3. **Weekly Digest: Most Vibes This Week** (line 189) - Weekly leaderboard of top submissions by vibes
4. **Welcome Onboarding Email** (line 217) - New user welcome and platform introduction
5. **Inbox Message Notifications** (line 261) - Direct message notifications for users
6. **@Mention Notifications** (line 292) - Daily digest of @username mentions in comments and judge notes
7. **Admin Report Notifications** (line 326) - Immediate alerts when submissions are reported

## Chronological Implementation Plan

1. Environment & Dependencies
   - Create Resend account and set `RESEND_API_KEY`.
   - Confirm Convex deployment environment variables are set (Convex URL, Clerk webhook secret).
   - Use the Convex Resend Component (@convex-dev/resend) per `https://github.com/get-convex/resend`, including event webhooks.

2. Schema & Settings
   - Add `emailSettings` (with `weeklyDigestEmails`), `emailLogs`, `dailyEngagementSummary`, `dailyMetrics`.
   - Add `emailUnsubscribeTokens`, `broadcastEmails`, and `appSettings` with `emailsEnabled` flag.
   - Ensure existing domain tables have needed indexes (see Schema section); prefer `withIndex` over `filter`.

3. Email Templates & Style
   - Implement HTML templates in `convex/emails/templates.ts` matching app style (black/white, no emojis).
   - Standardize footer: settings link + one‑click unsubscribe link.

4. Core Email Sender
   - Use Convex Resend Component wrapper in `convex/sendEmails.ts` and route `/resend-webhook` in `convex/http.ts` for event intake.
   - Enforce from `VibeApps Updates <alerts@updates.vibeapps.dev>` and subject prefix `VibeApps Updates:` via helper.
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

- **Domain**: vibeapps.dev hosted on Netlify; email subdomain updates.vibeapps.dev
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

**Purpose**: Notify users when their content receives engagement

**Frequency**: Once daily at 6:00 PM user's timezone (defaulting to PST)

**Recipients**: Users who:

- Have submitted apps to the platform
- Received at least one engagement (vote, rating, comment, bookmark) on their content OR received mentions/replies

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

- Only send if they received any engagement OR mentions OR replies to their comments
- Group all events for the user into a single daily email
- Include unsubscribe link and a link to notification settings
- Emails are sent regardless of user activity status

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

[View Weekly Leaderboard] (links to LeaderboardPage.tsx)
```

**Notes**:

- Calculated over rolling 7-day window (Mon 00:00:00 to Sun 23:59:59 PST).
- Ties broken by recent activity, then creation time.
- Respect `appSettings.emailsEnabled` and per-user `emailSettings.weeklyDigestEmails`.
- Links to weekly leaderboard page (LeaderboardPage.tsx) showing weekly rankings.
- Emails are sent regardless of user activity status.

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
- Rate limit: Max 5 message notification emails per day per user
- Emails are sent regardless of user activity status

### 6. @Mention Notifications (Daily Digest Approach)

**Purpose**: Notify users of @username mentions in daily engagement emails instead of individual emails to reduce noise

**Integration**: Mentions are included in daily engagement emails alongside other user activity

**Content Structure** (within daily engagement email):

```
You were mentioned 3 times today:

• John Doe mentioned you in a comment on "My Awesome App"
  "Hey @username, great work on this project..."

• Jane Smith mentioned you in a judge note on "Cool Tool"
  "I think @username would love this feature..."

[View all 3 mentions →] (links to notifications page)
```

**Rate Limiting**:

- Maximum 10 mentions shown per daily email
- Link to notifications page if more than 10 mentions
- Users can disable mention notifications via `emailSettings.mentionNotifications`
- Mentions are aggregated daily, not sent individually
- Emails are sent regardless of user activity status

**Benefits**:

- Reduces email noise for active users
- Consolidates all daily activity in one email
- Maintains mention functionality without overwhelming users
- Links to notifications page for full mention history

### 7. Admin Report Notifications

**Purpose**: Notify admin and manager users when a submission is reported by users

**Trigger**: When a user reports a submission via "Report this Submission" on StoryDetail.tsx

**Recipients**: All users with admin or manager role in the system

**Content Structure**:

```
Subject: New Report: [StoryTitle]

Hey [AdminName],

A submission has been reported and requires review:

Story: [StoryTitle]
Reported by: [ReporterName]
Reason: [ReportReason]

[Review Report in Admin Dashboard]

- The VibeApps Team
```

**Conditions**:

- Send immediately when report is created
- Only send to users with admin or manager role
- Include link to admin dashboard report management
- Rate limit: No limit for admin notifications (critical for moderation)

**Email Type**: `admin_report_notification`

**Implementation Notes**:

- Uses the existing alerts notification system
- Notifications appear in both header dropdown and notifications page for admins/managers
- Email integration will be added when Resend email system is implemented
- Future: When adminroles.prd is implemented, will check Clerk JWT claims for roles instead of database role field

Integration Hook (outline):

```typescript
// In convex/reports.ts after creating a report and generating alerts via alerts.createReportNotifications
await ctx.scheduler.runAfter(
  0,
  internal.emails.notifications.sendAdminReportEmail,
  {
    storyId: args.storyId,
    reportId: newReportId,
  },
);

// internal.emails.notifications.sendAdminReportEmail should:
// - fetch admin user ids via internal.alerts.getAdminUserIds or a settings source
// - render the template (subject/html) and call resend action per recipient
// - log each send to emailLogs as admin_report_notification
```

## Database Schema Updates

### New Tables Required

```typescript
// convex/schema.ts additions (current)

export default defineSchema({
  // ... existing tables ...

  // Email notification preferences for users
  emailSettings: defineTable({
    userId: v.id("users"),
    unsubscribedAt: v.optional(v.number()),
    dailyEngagementEmails: v.optional(v.boolean()),
    messageNotifications: v.optional(v.boolean()),
    marketingEmails: v.optional(v.boolean()),
    weeklyDigestEmails: v.optional(v.boolean()),
    mentionNotifications: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
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
      v.literal("admin_report_notification"),
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

#### Convex Resend Component usage

We use the official component wrapper in `convex/sendEmails.ts` and mount the webhook at `/resend-webhook` in `convex/http.ts`.

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
RESEND_FROM_DOMAIN=updates.vibeapps.dev
ADMIN_EMAIL=alerts@updates.vibeapps.dev

# Existing Convex/Clerk vars
VITE_CONVEX_URL=https://xxx.convex.cloud
CLERK_WEBHOOK_SECRET=whsec_xxx
```

## Email Templates Design

### Visual Design Standards (match app style)

- **Brand Colors**: #292929 (primary), #f9f9f9 (surface light), #ffffff (background)
- **Typography**: Arial, sans-serif for cross-client compatibility
- **Layout**: Maximum 600px width for mobile compatibility
- **Logo**: VibeApps logo (android-chrome-512x512.png) at top left of all emails, 48x48px, linking to homepage
- **CTA Buttons**: Consistent styling with #292929 background
- **Footer**: Standard unsubscribe and settings links plus comprehensive contact/social footer with:
  - Contact link to GitHub issues (https://github.com/waynesutton/vibeapps/issues)
  - Social media links (Twitter: @convex_dev, LinkedIn: convex-dev)
  - Open source project information
  - Legal address: Convex 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA
- **Icons/Emojis**: Do not use emojis to keep consistent with app and deliverability

### Content Guidelines

- **Tone**: Professional but friendly, community-focused
- **Length**: Concise, scannable content with clear hierarchy
- **Personalization**: Use first names, relevant user data
- **CTAs**: Clear, actionable next steps
- **Value**: Always provide clear value to the recipient
- **Accessibility**: Sufficient contrast, descriptive link text, no image-only CTAs
- **Links**: All story links use proper slugs (/s/{slug}), user profile links use usernames (/{username})
- **Graceful Fallbacks**: Links handle logged-out users by redirecting to sign-in page with return URL
- **Unsubscribe**: All emails include List-Unsubscribe headers and one-click unsubscribe functionality
- **Footer**: Standardized footer with contact links, social media, open source info, and legal information
- **Mention Rate Limiting**: Daily engagement emails include maximum 10 mentions to prevent spam
- **Manage Email Preferences Link**: All emails use a consistent smart link pattern that:
  - Directs to user's profile page if they have a username: `https://vibeapps.dev/{username}`
  - Directs to username setup page if authenticated but no username: `https://vibeapps.dev/set-username`
  - Directs to sign-in page with redirect if not authenticated: `https://vibeapps.dev/sign-in?redirect_url=...`
  - Implemented as: `${userUsername ? \`https://vibeapps.dev/${userUsername}\` : userId ? "https://vibeapps.dev/set-username" : "https://vibeapps.dev/sign-in?redirect_url=" + encodeURIComponent("https://vibeapps.dev/profile")}`
  - This ensures users can always access email preferences from the "Manage Profile & Account" section on their profile page

## Implementation Timeline ✅ COMPLETED

### Phase 1: Foundation ✅ COMPLETED

- [x] Set up Resend account and API integration
- [x] Implement basic email templates and sending functions
- [x] Create email settings schema and management
- [x] Set up environment variables and configuration

### Phase 2: Admin Emails ✅ COMPLETED

- [x] Implement daily metrics calculation
- [x] Create admin email template and sending logic
- [x] Set up cron job for daily admin emails
- [x] Test admin email delivery and content

### Phase 3: Welcome Emails ✅ COMPLETED

- [x] Integrate welcome email with user signup flow
- [x] Test welcome email triggering via Clerk webhook
- [x] Implement email tracking and logging
- [x] Create unsubscribe mechanism

### Phase 4: User Engagement Emails ✅ COMPLETED

- [x] Implement daily engagement calculation
- [x] Create user engagement email templates
- [x] Set up cron jobs for engagement processing and emails
- [x] Test engagement email delivery and personalization

### Phase 5: Admin & Testing Features ✅ COMPLETED

- [x] Admin broadcast email system with user search
- [x] Global email kill switch functionality
- [x] Force logout system for email sync
- [x] Test email functionality for admins
- [x] Email preferences UI in user profile

### Phase 6: Polish & Optimization ✅ COMPLETED

- [x] Email deliverability optimization (disabled test mode)
- [x] Performance monitoring and error handling
- [x] User settings UI in profile/settings pages
- [x] Comprehensive testing and bug fixes
- [x] Fixed all TypeScript and validator errors
- [x] Production deployment ready

### Phase 7: Template Enhancement & UX ✅ COMPLETED

- [x] Added VibeApps logo to all email templates (48x48px, top-left, linked to homepage)
- [x] Fixed all email links to use proper story slugs and user profile URLs
- [x] Enhanced manage preferences links to handle logged-out users gracefully
- [x] Added comprehensive footer with contact, social, and legal information
- [x] Updated weekly digest to reference "Weekly Leaderboard" instead of "Full Leaderboard"
- [x] Implemented List-Unsubscribe headers for email client compliance
- [x] Fixed vibes count accuracy in all email templates
- [x] Enhanced broadcast email system with proper template integration

### Phase 8: Critical Bug Fixes ✅ COMPLETED

- [x] Fixed Resend headers format issue (converted from object to array format)
- [x] Updated schema to include `storySlug` field in `dailyEngagementSummary` table
- [x] Resolved ArgumentValidationError for List-Unsubscribe headers
- [x] Fixed schema validation errors for daily engagement processing
- [x] Ensured all email functions work with proper Convex Resend component integration

### Phase 9: Profile Link URL Fix ✅ COMPLETED

- [x] Fixed email template profile links to use correct username-based URLs
- [x] Changed from `/user/${userId}` format to `/${username}` format in all email templates
- [x] Updated email template conditions to check `userUsername` instead of `userId`
- [x] Fixed mention email template to include missing `userId` and `userUsername` parameters
- [x] Ensured all email functions pass `userUsername` parameter correctly to templates
- [x] **Username Setup Flow Fix**: Fixed fallback logic for users without usernames
  - **Problem**: New users receive emails before setting up usernames, causing broken profile links
  - **Solution**: Updated email template logic to redirect to `/set-username` for authenticated users without usernames
  - **Logic**: `userUsername ? /username : userId ? /set-username : /sign-in`
  - **Impact**: Welcome emails and other notifications now properly guide new users through username setup
  - **Welcome Email Enhancement**: Updated welcome email to specifically guide users to complete profile setup with username selection
- [x] **Admin Report Emails Consistency**: Extended smart link pattern to admin report notification emails
  - **Updated Templates**: `generateAdminUserReportEmail` and `generateReportNotificationEmail`
  - **Added Parameter**: `adminUserId` to both templates for consistent link generation
  - **Updated Logic**: Changed from unsubscribe-only link to smart "Manage email preferences" link
  - **Consistency**: All email templates now use the same intelligent fallback pattern for email preference management
  - **Documentation**: Updated PRD with comprehensive explanation of the smart link pattern

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

### Critical Fixes Applied

**Headers Format Issue (September 2025)**:

- **Problem**: Resend component expected headers as array format, but code was passing object format
- **Error**: `ArgumentValidationError: Value does not match validator. Path: .headers`
- **Solution**: Updated `convex/emails/resend.ts` to use array format:
  ```typescript
  emailData.headers = [
    {
      name: "List-Unsubscribe",
      value: `<https://vibeapps.dev/api/unsubscribe?token=${token}>`,
    },
    { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
  ];
  ```

**Schema Validation Error**:

- **Problem**: `dailyEngagementSummary` table missing `storySlug` field in schema
- **Error**: `Object contains extra field storySlug that is not in the validator`
- **Solution**: Updated schema to include `storySlug: v.optional(v.string())` in `storyEngagements` array

**Profile URL Format Issue (September 2025)**:

- **Problem**: Email templates were generating incorrect profile URLs using userId instead of username
- **Error**: Links like `https://vibeapps.dev/user/ks71bgz29jgvx28xsgjtdhx8b97rgbjj` instead of `https://vibeapps.dev/someusername`
- **Root Cause**: VibeApps uses `/${username}` URL format for profiles, not `/user/${userId}`
- **Solution**: Updated all email templates in `convex/emails/templates.ts`:
  - Changed URL construction from `https://vibeapps.dev/user/${args.userId}` to `https://vibeapps.dev/${args.userUsername}`
  - Updated conditions to check `args.userUsername` instead of `args.userId`
  - Fixed mention email template to pass missing `userUsername` parameter
  - Verified all email functions correctly pass `userUsername` to templates

### Rate Limiting

- **Resend Limits**: Respect Resend API rate limits (100 emails/second)
- **User Limits**: Max 1 engagement email per user per day
- **Admin Limits**: Max 1 admin email per day
- **Message Limits**: Max 5 message notifications per user per day
- **Mention Limits**: Max 10 mentions per daily engagement email (prevents spam)
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
- https://github.com/get-convex/resend
