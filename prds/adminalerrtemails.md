# Admin Alert Emails PRD - VibeApps

## Overview

This document outlines the comprehensive admin alert email system for VibeApps, building on the existing Resend email infrastructure to provide immediate email notifications to administrators, managers, and organizers when users report content, users, or direct messages, and when critical moderation events occur.

## Email System Integration

This admin alert system leverages the fully implemented email infrastructure documented in `addresend.md`:

**Duplicate Prevention**:

- Uses date-based duplicate prevention (automatic reset at midnight PST)
- Admins won't receive duplicate notifications for the same report on the same day
- No manual intervention required - system handles duplicates automatically
- Each report type (story, user, DM) tracked independently

**Comprehensive Logging**:

- All admin alert emails logged with detailed metadata in `emailLogs` table
- Tracking includes: report ID, story ID, reporter ID, reported user ID, reason, email type
- Convex logs show send status, recipient count, and any errors
- Metadata stored for debugging and audit trail

**Testing & Development**:

- Admin test utility `clearTodaysEmailLogs` available for development
- Accessible via Admin Dashboard → Emails → "Clear Today's Email Logs"
- Safe for testing - only affects current day's logs
- Can filter by specific email type for targeted testing
- **Enhanced Testing Panel**: Email testing panel shows date ranges and activity warnings for better debugging (see `prds/TESTING_SUMMARY.md`)
- **Comprehensive Documentation**: Testing guides available in `prds/TESTING_SUMMARY.md` and `prds/EMAIL_DATE_RANGE_FIX.md`

**Production Ready**:

- Automatic daily reset means emails work correctly in production
- No need to manually clear logs or reset states
- System self-manages duplicate prevention
- Works with existing Resend infrastructure and templates system
- **Recent Infrastructure Improvements** (Phase 11): Enhanced email system with date range bug fixes and inbox message integration (see `addresend.md` Phase 11)

## Current System Analysis

### Existing Alert Infrastructure

- **Alerts System**: `convex/alerts.ts` with comprehensive notification types including "report" alerts
- **Report Management**: `convex/reports.ts` with three report types:
  - `createReport`: Story/submission reports (✅ implemented with email)
  - `createUserReport`: User profile reports (✅ implemented, email pending)
  - DM reports: Future inbox feature (⏳ planned)
- **Admin Dashboards**:
  - `src/components/admin/ReportManagement.tsx`: Story report review interface
  - `src/components/admin/UserReportManagement.tsx`: User report review interface
  - Future: DM report moderation interface
- **Email Infrastructure**: Complete Resend integration with `convex/emails/resend.ts` core sending system
- **Admin Identification**: `getAdminUserIds` helper function in `convex/alerts.ts` for targeting admin/manager users
- **Role System**: Supports admin, manager, and organizer roles (from `adminroles.prd`)

### Current Report Flows

**Story Report Flow** (✅ Fully Implemented):

1. User reports submission via "Report this Submission" button on `StoryDetail.tsx`
2. `createReport` mutation in `convex/reports.ts` creates report record
3. `createReportNotifications` in `convex/alerts.ts` creates alerts for all admin/manager users
4. Email notifications sent via `convex/emails/reports.ts` → `sendReportNotificationEmails`
5. Admins see notifications in header dropdown and `/notifications` page
6. Admins review reports in `/admin` → Users → Reports tab

**User Report Flow** (⚠️ Partially Implemented):

1. User reports another user via "Report this User" button on `UserProfilePage.tsx`
2. `createUserReport` mutation in `convex/reports.ts` creates user report record
3. `createUserReportNotifications` in `convex/alerts.ts` creates alerts for all admin/manager users
4. **Email notifications TODO**: Need to implement `sendUserReportNotificationEmails` in `convex/emails/reports.ts`
5. Admins see notifications in header dropdown and `/notifications` page
6. Admins review reports in `/admin` → Users → User Reports tab

**DM Report Flow** (⏳ Future - from `friendsonlyinbox.md`):

1. User reports inappropriate message via inbox interface
2. `reportMessageOrUser` mutation creates DM report record
3. Alert notifications created for all admin/manager users
4. Immediate email notifications sent
5. Admins review in `/admin/inbox-moderation` dashboard
6. Admins can hide message, ban user, or dismiss report

### Email System Integration

- **Resend Component**: `convex/sendEmails.ts` with proper subject prefix "VibeApps Updates:" and from address `alerts@updates.vibeapps.dev`
- **Email Templates**: `convex/emails/templates.ts` with template generation system
- **Email Logging**: `convex/emails/queries.ts` with comprehensive logging and tracking
- **Global Kill Switch**: `appSettings.emailsEnabled` controls all email sending
- **Unsubscribe System**: Token-based unsubscribe with `convex/emails/linkHelpers.ts`
- **Role-Based Recipients**: Admin and manager roles receive all report emails; organizers do not receive report emails

## Admin Alert Email Requirements

### 1. Story/Content Report Notifications

**Purpose**: Immediately notify admins/managers when users report inappropriate content

**Trigger**: When `api.reports.createReport` mutation is called from `StoryDetail.tsx`

**Recipients**: All users with `role: "admin"` or `role: "manager"` in the system

**Timing**: Immediate (within 30 seconds of report submission)

**Rate Limiting**: No rate limiting for admin notifications (critical for moderation)

**Content Structure**:

```
Subject: VibeApps Updates: New Report - [StoryTitle]

Hey [AdminName],

A submission has been reported and requires immediate review:

📝 Submission: [StoryTitle]
👤 Reported by: [ReporterName] (@[ReporterUsername])
📧 Reporter Email: [ReporterEmail]
⚠️ Reason: [ReportReason]
🕐 Reported: [Timestamp]

Submission Details:
• URL: [StoryURL]
• Author: [StoryAuthor] (@[StoryAuthorUsername])
• Submitted: [StoryCreationDate]

[Review in Admin Dashboard]

This report requires admin attention. Please review and take appropriate action.

- The VibeApps Team
```

**Email Type**: `admin_report_notification`

### 2. User Report Notifications (⚠️ Implementation Needed)

**Purpose**: Notify admins and managers when users report other users for inappropriate behavior

**Trigger**: When `api.reports.createUserReport` mutation is called from `UserProfilePage.tsx`

**Recipients**: All users with `role: "admin"` or `role: "manager"` (not organizers)

**Timing**: Immediate (within 30 seconds of report submission)

**Rate Limiting**: No rate limiting for admin notifications (critical for moderation)

**Current Status**:

- ✅ Database table `userReports` exists in schema
- ✅ `createUserReport` mutation implemented in `convex/reports.ts`
- ✅ `createUserReportNotifications` mutation implemented in `convex/alerts.ts`
- ✅ UI implemented in `UserProfilePage.tsx` with report modal
- ✅ Admin dashboard for user reports at `src/components/admin/UserReportManagement.tsx`
- ⚠️ **Email integration missing** - need to implement `sendUserReportNotificationEmails`

**Content Structure**:

```
Subject: VibeApps Updates: User Report - [ReportedUserName]

Hey [AdminName],

A user has been reported and requires immediate review:

👤 Reported User: [ReportedUserName] (@[ReportedUsername])
👤 Reported by: [ReporterName] (@[ReporterUsername])
📧 Reporter Email: [ReporterEmail]
⚠️ Reason: [ReportReason]
🕐 Reported: [Timestamp]

User Details:
• Profile: https://vibeapps.dev/[ReportedUsername]
• User since: [JoinDate]
• Total Submissions: [SubmissionCount]
• Total Comments: [CommentCount]

[Review in Admin Dashboard] [View User Profile]

This report requires admin attention. Please review and take appropriate action.

- The VibeApps Team
```

**Email Type**: `admin_user_report_notification`

### 3. DM Report Notifications (⏳ Future - Inbox System)

**Purpose**: Notify admins and managers when users report inappropriate direct messages

**Trigger**: When `api.dm.reportMessageOrUser` mutation is called from inbox interface (from `friendsonlyinbox.md`)

**Recipients**: All users with `role: "admin"` or `role: "manager"` (not organizers)

**Timing**: Immediate (within 30 seconds of report submission)

**Rate Limiting**: No rate limiting for admin notifications (critical for moderation)

**Future Implementation** (when inbox system is built):

- ⏳ Database table `dmReports` in schema (defined in `friendsonlyinbox.md`)
- ⏳ `reportMessageOrUser` mutation in `convex/dm.ts`
- ⏳ Alert notification creation for admins/managers
- ⏳ Email integration via `sendDmReportNotificationEmails`
- ⏳ Admin moderation dashboard at `/admin/inbox-moderation`

**Content Structure**:

```
Subject: VibeApps Updates: DM Report - Inappropriate Message

Hey [AdminName],

An inappropriate direct message has been reported and requires immediate review:

👤 Sender: [SenderName] (@[SenderUsername])
👤 Reported by: [RecipientName] (@[RecipientUsername])
📧 Reporter Email: [ReporterEmail]
⚠️ Reason: [ReportReason]
💬 Message Preview: "[First 100 characters...]"
🕐 Sent: [MessageTimestamp]
🕐 Reported: [ReportTimestamp]

Conversation Context:
• Conversation ID: [ConversationId]
• Total messages in conversation: [MessageCount]
• Message ID: [MessageId]

[Review in Admin Dashboard] [View Full Conversation]

This report requires admin attention. You can hide the message, warn/ban the sender, or dismiss the report.

Note: You can only view reported messages, not all user conversations (privacy protection).

- The VibeApps Team
```

**Email Type**: `admin_dm_report_notification`

**Privacy Notes**:

- Admins can ONLY see messages that have been reported
- Full conversation context provided only for reported messages
- Sender and recipient profiles linked for moderation review
- Message preview limited to first 100 characters
- Uses same duplicate prevention as other admin emails

## Database Schema Updates

### Existing Schema (Already Implemented)

```typescript
// convex/schema.ts - Current state

// Reports table for story/submission reports
reports: defineTable({
  storyId: v.id("stories"),
  reporterUserId: v.id("users"),
  reason: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("resolved_hidden"),
    v.literal("resolved_deleted"),
    v.literal("dismissed"),
  ),
})
  .index("by_storyId", ["storyId"])
  .index("by_status", ["status"]);

// User reports table ✅ Already exists
userReports: defineTable({
  reportedUserId: v.id("users"),
  reporterUserId: v.id("users"),
  reason: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("resolved_warned"),
    v.literal("resolved_banned"),
    v.literal("resolved_paused"),
    v.literal("dismissed"),
  ),
})
  .index("by_reportedUserId", ["reportedUserId"])
  .index("by_status", ["status"]);

// Alerts system
alerts: defineTable({
  recipientUserId: v.id("users"),
  actorUserId: v.optional(v.id("users")),
  type: v.union(
    v.literal("follow"),
    v.literal("comment"),
    v.literal("rating"),
    v.literal("report"), // ✅ Used for all report types currently
    v.literal("mention"),
    v.literal("judge_score"),
    v.literal("form_submission"),
    v.literal("message"), // For future inbox
  ),
  storyId: v.optional(v.id("stories")),
  commentId: v.optional(v.id("comments")),
  isRead: v.boolean(),
  // ... other fields
});

// Email logs with current email types
emailLogs: defineTable({
  userId: v.optional(v.id("users")),
  emailType: v.union(
    v.literal("daily_admin"),
    v.literal("daily_engagement"),
    v.literal("welcome"),
    v.literal("message_notification"),
    v.literal("weekly_digest"),
    v.literal("mention_notification"),
    v.literal("admin_broadcast"),
    v.literal("admin_report_notification"), // ✅ Already exists for story reports
  ),
  recipientEmail: v.string(),
  sentAt: v.number(),
  resendMessageId: v.optional(v.string()),
  status: v.union(
    v.literal("sent"),
    v.literal("failed"),
    v.literal("delivered"),
  ),
  metadata: v.optional(v.any()),
})
  .index("by_user_type_date", ["userId", "emailType", "sentAt"])
  .index("by_type_date", ["emailType", "sentAt"])
  .index("by_resend_id", ["resendMessageId"]);
```

### Required Schema Extensions

```typescript
// convex/schema.ts - Add these to existing tables

// 1. Add new email types to emailLogs.emailType union
emailLogs: defineTable({
  emailType: v.union(
    // ... existing types ...
    v.literal("admin_user_report_notification"), // ⚠️ NEW - for user reports
    v.literal("admin_dm_report_notification"), // ⏳ FUTURE - for DM reports
  ),
  // ... rest of fields unchanged
});

// 2. Extend alerts type union (optional - currently using "report" for all)
alerts: defineTable({
  type: v.union(
    // ... existing types ...
    v.literal("report"), // Current catch-all
    // Optional future refinement:
    // v.literal("user_report"),
    // v.literal("dm_report"),
  ),
  // ... existing fields ...
});

// 3. DM Reports table (Future - from friendsonlyinbox.md)
dmReports: defineTable({
  reporterId: v.id("users"),
  reportedUserId: v.id("users"),
  messageId: v.optional(v.id("dmMessages")),
  conversationId: v.id("dmConversations"),
  reason: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("reviewed"),
    v.literal("action_taken"),
  ),
  adminNotes: v.optional(v.string()),
})
  .index("by_status", ["status"])
  .index("by_reporter", ["reporterId"])
  .index("by_reported_user", ["reportedUserId"]);
```

### Admin Role Integration (from `adminroles.prd`)

```typescript
// Note: Roles are managed via Clerk JWT claims, not Convex schema
// Users table already has optional role field for backwards compatibility
users: defineTable({
  // ... existing fields ...
  role: v.optional(v.string()), // "admin" | "manager" | "organizer"
  // Future: May be deprecated in favor of Clerk JWT claims only
});

// getAdminUserIds in convex/alerts.ts already filters for admin and manager roles
// Future: Will transition to reading from Clerk JWT claims via ctx.auth.getUserIdentity()
```

## Backend Implementation

### Enhanced Report Email System

#### `convex/emails/reports.ts` (Enhance Existing)

```typescript
/**
 * Send immediate email notifications to admins about story reports
 */
export const sendReportNotificationEmails = internalAction({
  args: {
    reporterUserId: v.id("users"),
    storyId: v.id("stories"),
    reportId: v.id("reports"),
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get comprehensive report details
    const report = await ctx.runQuery(
      internal.emails.reports.getReportDetails,
      {
        reportId: args.reportId,
      },
    );

    const story = await ctx.runQuery(internal.stories.getStoryById, {
      storyId: args.storyId,
    });

    const reporter = await ctx.runQuery(
      internal.emails.reports.getUserDetails,
      {
        userId: args.reporterUserId,
      },
    );

    if (!report || !story || !reporter) {
      console.error("Missing data for report notification email");
      return null;
    }

    // Send to each admin/manager
    for (const adminUserId of args.adminUserIds) {
      const admin = await ctx.runQuery(internal.emails.reports.getUserDetails, {
        userId: adminUserId,
      });

      if (!admin?.email) continue;

      // Generate unsubscribe token (admins can unsubscribe from non-critical emails)
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: adminUserId,
          purpose: "all",
        },
      );

      // Generate admin report email template
      const emailTemplate = await ctx.runQuery(
        internal.emails.templates.generateAdminReportEmail,
        {
          adminName: admin.name || "Admin",
          adminUsername: admin.username,
          reporterName: reporter.name || "Anonymous User",
          reporterUsername: reporter.username,
          reporterEmail: reporter.email,
          storyTitle: story.title,
          storyUrl: story.url,
          storyAuthor: story.authorName || "Unknown",
          storyAuthorUsername: story.authorUsername,
          reportReason: report.reason,
          reportTimestamp: report._creationTime,
          storyCreationTime: story._creationTime,
          dashboardUrl: `https://vibeapps.dev/admin?tab=users&subtab=reports`,
          unsubscribeToken,
        },
      );

      // Send via core Resend system
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: admin.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        emailType: "admin_report_notification",
        userId: adminUserId,
        unsubscribeToken,
        metadata: {
          reportId: args.reportId,
          storyId: args.storyId,
          reporterUserId: args.reporterUserId,
          reportReason: report.reason,
        },
      });
    }

    return null;
  },
});

/**
 * Send user report notification emails (⚠️ needs implementation)
 */
export const sendUserReportNotificationEmails = internalAction({
  args: {
    reporterUserId: v.id("users"),
    reportedUserId: v.id("users"),
    reportId: v.id("userReports"),
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get comprehensive report details
    const report = await ctx.runQuery(
      internal.emails.reports.getUserReportDetails,
      {
        reportId: args.reportId,
      },
    );

    const reportedUser = await ctx.runQuery(
      internal.emails.reports.getUserDetails,
      {
        userId: args.reportedUserId,
      },
    );

    const reporter = await ctx.runQuery(
      internal.emails.reports.getUserDetails,
      {
        userId: args.reporterUserId,
      },
    );

    if (!report || !reportedUser || !reporter) {
      console.error("Missing data for user report notification email");
      return null;
    }

    // Get reported user's stats for context
    const userStats = await ctx.runQuery(internal.emails.reports.getUserStats, {
      userId: args.reportedUserId,
    });

    // Send to each admin/manager
    for (const adminUserId of args.adminUserIds) {
      const admin = await ctx.runQuery(internal.emails.reports.getUserDetails, {
        userId: adminUserId,
      });

      if (!admin?.email) continue;

      // Generate unsubscribe token
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: adminUserId,
          purpose: "all",
        },
      );

      // Generate admin user report email template
      const emailTemplate = await ctx.runQuery(
        internal.emails.templates.generateAdminUserReportEmail,
        {
          adminName: admin.name || "Admin",
          adminUsername: admin.username,
          reporterName: reporter.name || "Anonymous User",
          reporterUsername: reporter.username,
          reporterEmail: reporter.email,
          reportedUserName: reportedUser.name || "Unknown User",
          reportedUsername: reportedUser.username,
          reportReason: report.reason,
          reportTimestamp: report._creationTime,
          userJoinDate: reportedUser._creationTime,
          submissionCount: userStats.submissionCount,
          commentCount: userStats.commentCount,
          dashboardUrl: `https://vibeapps.dev/admin?tab=users&subtab=user-reports`,
          profileUrl: `https://vibeapps.dev/${reportedUser.username}`,
          unsubscribeToken,
        },
      );

      // Send via core Resend system
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: admin.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        emailType: "admin_user_report_notification",
        userId: adminUserId,
        unsubscribeToken,
        metadata: {
          reportId: args.reportId,
          reportedUserId: args.reportedUserId,
          reporterUserId: args.reporterUserId,
          reportReason: report.reason,
        },
      });
    }

    return null;
  },
});

/**
 * Send DM report notification emails (⏳ future - inbox integration)
 */
export const sendDmReportNotificationEmails = internalAction({
  args: {
    reporterUserId: v.id("users"),
    reportedUserId: v.id("users"),
    messageId: v.id("dmMessages"), // From inbox system
    conversationId: v.id("dmConversations"),
    reportId: v.id("dmReports"),
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get report details
    const report = await ctx.runQuery(
      internal.emails.reports.getDmReportDetails,
      {
        reportId: args.reportId,
      },
    );

    // Get message content (first 100 chars for preview)
    const message = await ctx.runQuery(
      internal.emails.reports.getDmMessagePreview,
      {
        messageId: args.messageId,
      },
    );

    const sender = await ctx.runQuery(internal.emails.reports.getUserDetails, {
      userId: args.reportedUserId,
    });

    const reporter = await ctx.runQuery(
      internal.emails.reports.getUserDetails,
      {
        userId: args.reporterUserId,
      },
    );

    if (!report || !message || !sender || !reporter) {
      console.error("Missing data for DM report notification email");
      return null;
    }

    // Get conversation context
    const conversationStats = await ctx.runQuery(
      internal.emails.reports.getConversationStats,
      {
        conversationId: args.conversationId,
      },
    );

    // Send to each admin/manager
    for (const adminUserId of args.adminUserIds) {
      const admin = await ctx.runQuery(internal.emails.reports.getUserDetails, {
        userId: adminUserId,
      });

      if (!admin?.email) continue;

      // Generate unsubscribe token
      const unsubscribeToken = await ctx.runMutation(
        internal.emails.linkHelpers.generateUnsubscribeToken,
        {
          userId: adminUserId,
          purpose: "all",
        },
      );

      // Generate admin DM report email template
      const emailTemplate = await ctx.runQuery(
        internal.emails.templates.generateAdminDmReportEmail,
        {
          adminName: admin.name || "Admin",
          adminUsername: admin.username,
          senderName: sender.name || "Unknown User",
          senderUsername: sender.username,
          reporterName: reporter.name || "Anonymous User",
          reporterUsername: reporter.username,
          reporterEmail: reporter.email,
          messagePreview: message.content.substring(0, 100),
          messageTimestamp: message._creationTime,
          reportReason: report.reason,
          reportTimestamp: report._creationTime,
          conversationId: args.conversationId,
          messageCount: conversationStats.messageCount,
          messageId: args.messageId,
          dashboardUrl: `https://vibeapps.dev/admin/inbox-moderation`,
          unsubscribeToken,
        },
      );

      // Send via core Resend system
      await ctx.runAction(internal.emails.resend.sendEmail, {
        to: admin.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        emailType: "admin_dm_report_notification",
        userId: adminUserId,
        unsubscribeToken,
        metadata: {
          reportId: args.reportId,
          messageId: args.messageId,
          conversationId: args.conversationId,
          reportedUserId: args.reportedUserId,
          reporterUserId: args.reporterUserId,
          reportReason: report.reason,
        },
      });
    }

    return null;
  },
});
```

#### `convex/emails/templates.ts` (Add New Templates)

```typescript
/**
 * Generate admin report notification email template (✅ already implemented)
 */
export const generateAdminReportEmail = internalQuery({
  args: {
    adminName: v.string(),
    adminUsername: v.optional(v.string()),
    reporterName: v.string(),
    reporterUsername: v.optional(v.string()),
    reporterEmail: v.optional(v.string()),
    storyTitle: v.string(),
    storyUrl: v.string(),
    storyAuthor: v.optional(v.string()),
    storyAuthorUsername: v.optional(v.string()),
    reportReason: v.string(),
    reportTimestamp: v.number(),
    storyCreationTime: v.number(),
    dashboardUrl: v.string(),
    unsubscribeToken: v.string(),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = `New Report - ${args.storyTitle}`;

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
            <!-- VibeApps Logo -->
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px;">
            </div>

            <h1 style="color: #292929; margin-bottom: 10px;">Content Report Requires Review</h1>
            <p style="color: #666; margin-bottom: 30px;">A submission has been reported and needs immediate admin attention.</p>
            
            <!-- Report Summary -->
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #856404;">Report Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Submission:</td>
                  <td style="padding: 8px 0;">${args.storyTitle}</td>
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

            <!-- Submission Details -->
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #292929;">Submission Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">URL:</td>
                  <td style="padding: 8px 0;">
                    <a href="${args.storyUrl}" style="color: #292929; text-decoration: none;">${args.storyUrl}</a>
                  </td>
                </tr>
                ${
                  args.storyAuthor
                    ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Author:</td>
                  <td style="padding: 8px 0;">
                    ${args.storyAuthor}
                    ${args.storyAuthorUsername ? ` (@${args.storyAuthorUsername})` : ""}
                  </td>
                </tr>
                `
                    : ""
                }
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Submitted:</td>
                  <td style="padding: 8px 0;">${formatDate(args.storyCreationTime)}</td>
                </tr>
              </table>
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${args.dashboardUrl}" style="display: inline-block; background: #d63384; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 0 10px;">Review Report</a>
              <a href="https://vibeapps.dev/s/${args.storyTitle
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(
                  /^-|-$/g,
                  "",
                )}" style="display: inline-block; background: #292929; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 0 10px;">View Submission</a>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>Action Required:</strong> This report requires immediate admin review. Please log into the admin dashboard to investigate and take appropriate moderation action.
              </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                You received this email because you are an administrator at VibeApps.
              </p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                <a href="https://vibeapps.dev/api/unsubscribe?token=${args.unsubscribeToken}" style="color: #666;">Manage email preferences</a> | 
                <a href="https://vibeapps.dev/admin" style="color: #666;">Admin Dashboard</a>
              </p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                VibeApps • <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">Contact Support</a>
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
 * Generate admin user report notification email template (⚠️ new - needs implementation)
 */
export const generateAdminUserReportEmail = internalQuery({
  args: {
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
                <a href="https://vibeapps.dev/api/unsubscribe?token=${args.unsubscribeToken}" style="color: #666;">Manage email preferences</a> | 
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
 * Generate admin DM report notification email template (⏳ future)
 */
export const generateAdminDmReportEmail = internalQuery({
  args: {
    adminName: v.string(),
    adminUsername: v.optional(v.string()),
    senderName: v.string(),
    senderUsername: v.optional(v.string()),
    reporterName: v.string(),
    reporterUsername: v.optional(v.string()),
    reporterEmail: v.optional(v.string()),
    messagePreview: v.string(),
    messageTimestamp: v.number(),
    reportReason: v.string(),
    reportTimestamp: v.number(),
    conversationId: v.string(),
    messageCount: v.number(),
    messageId: v.string(),
    dashboardUrl: v.string(),
    unsubscribeToken: v.string(),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = `DM Report - Inappropriate Message`;

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

            <h1 style="color: #292929; margin-bottom: 10px;">DM Report Requires Review</h1>
            <p style="color: #666; margin-bottom: 30px;">An inappropriate direct message has been reported and needs immediate admin attention.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #856404;">Report Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Sender:</td>
                  <td style="padding: 8px 0;">
                    ${args.senderName}
                    ${args.senderUsername ? ` (@${args.senderUsername})` : ""}
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
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Message Sent:</td>
                  <td style="padding: 8px 0;">${formatDate(args.messageTimestamp)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #292929;">Reported:</td>
                  <td style="padding: 8px 0;">${formatDate(args.reportTimestamp)}</td>
                </tr>
              </table>
            </div>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #292929;">Message Preview</h3>
              <p style="padding: 10px; background: white; border-left: 3px solid #d63384; font-style: italic; color: #555;">
                "${args.messagePreview}${args.messagePreview.length >= 100 ? "..." : ""}"
              </p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Conversation ID:</td>
                  <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${args.conversationId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Total messages:</td>
                  <td style="padding: 8px 0;">${args.messageCount}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${args.dashboardUrl}" style="display: inline-block; background: #d63384; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 0 10px;">Review Report</a>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #856404;">
                <strong>Action Required:</strong> This report requires immediate admin review. You can hide the message, warn/ban the sender, or dismiss the report.
              </p>
              <p style="margin: 0; color: #856404; font-size: 12px;">
                <strong>Privacy Note:</strong> You can only view reported messages, not all user conversations.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                You received this email because you are an administrator at VibeApps.
              </p>
              <p style="color: #666; font-size: 12px; margin: 5px 0;">
                <a href="https://vibeapps.dev/api/unsubscribe?token=${args.unsubscribeToken}" style="color: #666;">Manage email preferences</a> | 
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
```

## Integration Points

### 1. Story Report Email Integration (✅ Implemented)

Story report emails are fully implemented in `convex/reports.ts`:

```typescript
// In createReport mutation - already fully implemented
const reportId = await ctx.db.insert("reports", {
  storyId: args.storyId,
  reporterUserId: user._id,
  reason: args.reason,
  status: "pending",
});

// Get all admin and manager user IDs
const adminUserIds = await getAdminUserIds(ctx);

// Create notifications and send emails (already exists)
if (adminUserIds.length > 0) {
  await ctx.scheduler.runAfter(0, internal.alerts.createReportNotifications, {
    reporterUserId: user._id,
    storyId: args.storyId,
    reportId: reportId,
    adminUserIds: adminUserIds,
  });
}

// internal.alerts.createReportNotifications calls:
// - internal.emails.reports.sendReportNotificationEmails
// - Which sends emails to all admin/manager users
```

### 2. User Report Email Integration (⚠️ Needs Email Implementation)

User reports exist but need email integration in `convex/alerts.ts`:

```typescript
// In convex/alerts.ts - createUserReportNotifications mutation
export const createUserReportNotifications = internalMutation({
  args: {
    reporterUserId: v.id("users"),
    reportedUserId: v.id("users"),
    reportId: v.id("userReports"),
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create notification for each admin/manager user
    for (const adminUserId of args.adminUserIds) {
      await ctx.db.insert("alerts", {
        recipientUserId: adminUserId,
        actorUserId: args.reporterUserId,
        type: "report",
        isRead: false,
      });
    }

    // ⚠️ ADD THIS: Send immediate email notifications to admins/managers
    await ctx.scheduler.runAfter(
      0,
      internal.emails.reports.sendUserReportNotificationEmails,
      {
        reporterUserId: args.reporterUserId,
        reportedUserId: args.reportedUserId,
        reportId: args.reportId,
        adminUserIds: args.adminUserIds,
      },
    );

    return null;
  },
});
```

### 3. DM Report Email Integration (⏳ Future - Inbox System)

When inbox system is implemented (from `friendsonlyinbox.md`):

```typescript
// In convex/dm.ts (future file from friendsonlyinbox.md)
export const reportMessageOrUser = mutation({
  args: {
    conversationId: v.id("dmConversations"),
    messageId: v.optional(v.id("dmMessages")),
    reportedUserId: v.id("users"),
    reason: v.string(),
  },
  returns: v.id("dmReports"),
  handler: async (ctx, args) => {
    // Validate user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Create DM report
    const reportId = await ctx.db.insert("dmReports", {
      reporterId: identity.subject as Id<"users">,
      reportedUserId: args.reportedUserId,
      messageId: args.messageId,
      conversationId: args.conversationId,
      reason: args.reason,
      status: "pending",
    });

    // Get admin and manager users (not organizers)
    const adminUserIds = await getAdminUserIds(ctx);

    // Create alert notifications for admins/managers
    for (const adminUserId of adminUserIds) {
      await ctx.db.insert("alerts", {
        recipientUserId: adminUserId,
        actorUserId: identity.subject as Id<"users">,
        type: "message_report", // or use "report"
        isRead: false,
      });
    }

    // Send immediate email notifications
    await ctx.scheduler.runAfter(
      0,
      internal.emails.reports.sendDmReportNotificationEmails,
      {
        reporterUserId: identity.subject as Id<"users">,
        reportedUserId: args.reportedUserId,
        messageId: args.messageId!,
        conversationId: args.conversationId,
        reportId: reportId,
        adminUserIds: adminUserIds,
      },
    );

    return reportId;
  },
});
```

## Admin Role System Integration (from `adminroles.prd`)

### Role-Based Email Recipients

Admin alert emails respect the role system from `adminroles.prd`:

**Recipients for Report Emails**:

- ✅ **Admin**: Receives all report emails (story, user, DM reports)
- ✅ **Manager**: Receives all report emails (story, user, DM reports)
- ❌ **Organizer**: Does NOT receive report emails (only has access to judging group management)

**Implementation in `convex/alerts.ts`**:

```typescript
// getAdminUserIds function filters for admin and manager roles only
export async function getAdminUserIds(
  ctx: QueryCtx | MutationCtx,
): Promise<Array<Id<"users">>> {
  // Current implementation: reads from users.role field
  const allAdmins = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("role"), "admin"))
    .collect();

  const allManagers = await ctx.db
    .query("users")
    .filter((q) => q.field("role"), "manager"))
    .collect();

  const allAdminIds = [
    ...allAdmins.map((u) => u._id),
    ...allManagers.map((u) => u._id),
  ];

  // Future: Will transition to reading from Clerk JWT claims
  // via ctx.auth.getUserIdentity() for role verification

  return allAdminIds;
}
```

**Future Enhancement (JWT Claims)**:

When `adminroles.prd` is fully implemented with Clerk JWT claims:

```typescript
// Future implementation will read roles from JWT claims
export async function getAdminUserIdsFromJWT(
  ctx: QueryCtx | MutationCtx,
): Promise<Array<Id<"users">>> {
  // Get all users with admin or manager role from JWT claims
  // This will require iterating through users and checking claims
  // or maintaining a server-side cache of admin/manager user IDs

  // For now, continue using database role field for backwards compatibility
  return getAdminUserIds(ctx);
}
```

### Typesafe Email Types

All email functions use proper Convex validators for typesafety:

```typescript
// In convex/emails/resend.ts - email type validator
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    emailType: v.union(
      v.literal("daily_admin"),
      v.literal("daily_engagement"),
      v.literal("welcome"),
      v.literal("message_notification"),
      v.literal("weekly_digest"),
      v.literal("mention_notification"),
      v.literal("admin_broadcast"),
      v.literal("admin_report_notification"), // Story reports
      v.literal("admin_user_report_notification"), // ⚠️ NEW
      v.literal("admin_dm_report_notification"), // ⏳ FUTURE
    ),
    userId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // ... implementation
  },
});
```

## Email Templates Design Standards

### Visual Design (Match App Style)

- **Brand Colors**: #292929 (primary), #d63384 (warning/reports), #f9f9f9 (background)
- **Logo**: VibeApps logo (48x48px) at top center, linked to homepage
- **Layout**: Maximum 600px width for mobile compatibility
- **Typography**: Arial, sans-serif for cross-client compatibility
- **Warning Design**: Yellow background (#fff3cd) with orange border for report summaries

### Content Guidelines

- **Tone**: Professional and urgent for admin notifications
- **Clarity**: Clear action items and next steps
- **Context**: Include all relevant information for quick decision making
- **Links**: Direct links to admin dashboard and specific review pages
- **Timestamps**: Use PST timezone for consistency
- **Accessibility**: Sufficient contrast and descriptive link text

## Technical Considerations

### Email Deliverability

- **Critical Priority**: Admin report emails have high priority for delivery
- **No Rate Limiting**: Admin notifications bypass normal rate limits
- **Retry Logic**: Enhanced retry logic for failed admin email sends
- **Monitoring**: Real-time alerts if admin emails fail to send

### Performance

- **Immediate Sending**: Admin emails sent within 30 seconds of report
- **Batch Processing**: Multiple admin recipients processed efficiently
- **Error Handling**: Graceful handling of individual admin email failures
- **Logging**: Comprehensive logging for admin email audit trail

### Privacy & Security

- **Admin Only**: Report details only sent to verified admin/manager users
- **Secure Links**: Admin dashboard links include proper authentication checks
- **Data Protection**: Reporter and reported user data handled securely
- **Audit Trail**: Complete logging of all admin email notifications

## Testing & Validation

### Admin Email Testing

1. **Report Submission Test**: Create test report and verify admin email delivery
2. **Multiple Admin Test**: Ensure all admin/manager users receive emails
3. **Email Content Test**: Verify all data fields populate correctly
4. **Link Testing**: Confirm all dashboard and submission links work properly
5. **Unsubscribe Test**: Test admin unsubscribe functionality
6. **Global Kill Switch**: Verify emails respect global email disable setting
7. **Testing Panel**: Use enhanced email testing panel in Admin Dashboard for better visibility (see `prds/TESTING_SUMMARY.md` for complete guide)

### Integration Testing

1. **Alert System**: Confirm notifications appear in admin dashboard and header
2. **Report Management**: Test admin report review workflow
3. **Email Logging**: Verify all admin emails are logged properly
4. **Error Handling**: Test behavior when admin users have no email addresses
5. **Performance**: Ensure admin emails don't delay report submission response

## Future Enhancements

### Advanced Admin Features

- **Severity Levels**: Different email templates for different report severities
- **Admin Assignment**: Route specific report types to specific admin users
- **Escalation Rules**: Auto-escalate unreviewed reports after time threshold
- **Digest Mode**: Option for admins to receive digest instead of immediate emails

### Analytics & Insights

- **Report Trends**: Weekly admin emails with report volume and trends
- **Response Times**: Track admin response time to reports
- **User Patterns**: Identify users who frequently report content
- **Content Analysis**: Analyze most commonly reported content types

### Mobile Integration

- **Push Notifications**: Complement emails with push notifications for admins
- **SMS Alerts**: Critical report notifications via SMS for urgent cases
- **Mobile Dashboard**: Optimized admin mobile interface for quick report review
- **Offline Sync**: Sync report notifications when admin comes back online

---

This comprehensive admin alert email system ensures administrators and managers are immediately notified of all content reports, enabling rapid response to moderation issues while maintaining the high-quality community standards of VibeApps.

## Implementation Summary

### Current Status

**✅ Fully Implemented**:

- Story/submission report emails with complete Resend integration
- Email infrastructure with logging, duplicate prevention, and testing utilities
- Admin and manager role-based recipients
- Story report email template matching app style
- Integration with existing alert system

**⚠️ Ready for Implementation** (All infrastructure exists):

- User report email integration - just needs email sending code added to `convex/alerts.ts`
- User report email template (`generateAdminUserReportEmail`)
- Helper queries for user stats (`getUserStats`, `getUserReportDetails`)

**⏳ Future** (Awaiting inbox system from `friendsonlyinbox.md`):

- DM report email integration
- DM report email template (`generateAdminDmReportEmail`)
- Inbox moderation dashboard
- DM-specific helper queries

### Implementation Checklist for User Report Emails

To complete user report email integration:

1. **Add email type to schema** (`convex/schema.ts`):
   - Add `v.literal("admin_user_report_notification")` to `emailLogs.emailType` union
2. **Add email type to resend validator** (`convex/emails/resend.ts`):
   - Add `v.literal("admin_user_report_notification")` to `emailType` validator in `sendEmail` action

3. **Implement email sending** (`convex/alerts.ts`):
   - Add `ctx.scheduler.runAfter` call in `createUserReportNotifications` to trigger email
4. **Implement email action** (`convex/emails/reports.ts`):
   - Add `sendUserReportNotificationEmails` internalAction (already outlined in this PRD)
5. **Implement email template** (`convex/emails/templates.ts`):
   - Add `generateAdminUserReportEmail` internalQuery (already outlined in this PRD)
6. **Implement helper queries** (`convex/emails/reports.ts`):
   - Add `getUserReportDetails` internal query
   - Add `getUserStats` internal query to get submission and comment counts

7. **Test the integration**:
   - Use "Clear Today's Email Logs" button in Admin Dashboard
   - Test reporting a user from UserProfilePage.tsx
   - Verify admin/manager users receive email notifications
   - Check email logs in Convex dashboard

### Key Design Principles

1. **Typesafe**: All validators use Convex `v.*` types for compile-time safety
2. **Role-Based**: Only admins and managers receive report emails (not organizers)
3. **Production Ready**: Uses existing Resend infrastructure with automatic daily reset
4. **Privacy Protected**: DM reports only show reported messages, not full conversations
5. **Consistent Design**: All email templates match VibeApps black/white aesthetic
6. **Comprehensive Logging**: All emails tracked in `emailLogs` with metadata
7. **Testable**: Admin utilities available for development and testing

### Future Enhancements

**Admin Roles (from `adminroles.prd`)**:

- Transition from database `role` field to Clerk JWT claims
- Maintain backwards compatibility during transition
- Update `getAdminUserIds` to read from JWT when ready

**Inbox System (from `friendsonlyinbox.md`)**:

- Implement DM reporting when inbox feature is built
- Add `/admin/inbox-moderation` dashboard for DM reports
- Integrate DM report emails using patterns from story/user reports

**Judging Reports** (potential future):

- Admin emails for inappropriate judge notes or scores
- Organizer-specific notifications for their judging groups
- Integration with judging system moderation

## References

- Current Alerts System: `convex/alerts.ts`
- Report Management:
  - `convex/reports.ts`
  - `src/components/admin/ReportManagement.tsx` (story reports)
  - `src/components/admin/UserReportManagement.tsx` (user reports)
- User Profile Reporting: `src/pages/UserProfilePage.tsx`
- Email Infrastructure:
  - `convex/emails/resend.ts` - Core sending system
  - `convex/sendEmails.ts` - Resend component wrapper
  - `convex/emails/templates.ts` - Email templates
  - `convex/emails/queries.ts` - Email logging
- Related PRDs:
  - `addresend.md` - Complete Resend integration documentation (includes Phase 11: recent improvements)
  - `TESTING_SUMMARY.md` - Comprehensive email testing system documentation
  - `EMAIL_DATE_RANGE_FIX.md` - Date range bug fix and testing improvements
  - `friendsonlyinbox.md` - Future DM system with reporting
  - `adminroles.prd` - Admin, manager, and organizer roles
- Admin Dashboard: `src/components/admin/AdminDashboard.tsx`
