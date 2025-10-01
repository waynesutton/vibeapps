# Admin Alert Emails PRD - VibeApps

## Overview

This document outlines the comprehensive admin alert email system for VibeApps, building on the existing Resend email infrastructure to provide immediate email notifications to administrators and managers when users report content or when critical moderation events occur.

## Email System Integration

This admin alert system leverages the fully implemented email infrastructure documented in `addresend.md`:

**Duplicate Prevention**:

- Uses date-based duplicate prevention (automatic reset at midnight PST)
- Admins won't receive duplicate notifications for the same report
- No manual intervention required - system handles duplicates automatically

**Comprehensive Logging**:

- All admin alert emails logged with detailed metadata
- Tracking includes: report ID, story ID, reporter ID, reason
- Convex logs show send status, recipient count, and any errors

**Testing & Development**:

- Admin test utility `clearTodaysEmailLogs` available for development
- Accessible via Admin Dashboard → Emails → "Clear Today's Email Logs"
- Safe for testing - only affects current day's logs

**Production Ready**:

- Automatic daily reset means emails work correctly in production
- No need to manually clear logs or reset states
- System self-manages duplicate prevention

## Current System Analysis

### Existing Alert Infrastructure

- **Alerts System**: `convex/alerts.ts` with comprehensive notification types including "report" alerts
- **Report Management**: `convex/reports.ts` with `createReport` mutation that creates admin notifications
- **Admin Dashboard**: `src/components/admin/ReportManagement.tsx` with full report review interface
- **Email Infrastructure**: Complete Resend integration with `convex/emails/resend.ts` core sending system
- **Admin Identification**: `getAdminUserIds` helper function in `convex/alerts.ts` for targeting admin/manager users

### Current Report Flow

1. User reports submission via "Report this Submission" button on `StoryDetail.tsx`
2. `createReport` mutation in `convex/reports.ts` creates report record
3. `createReportNotifications` in `convex/alerts.ts` creates alerts for all admin/manager users
4. Email notifications sent via `convex/emails/reports.ts` (partially implemented)
5. Admins see notifications in header dropdown and `/notifications` page
6. Admins review reports in `/admin` → Users → Reports tab

### Email System Integration

- **Resend Component**: `convex/sendEmails.ts` with proper subject prefix and from address
- **Email Templates**: `convex/emails/templates.ts` with template generation system
- **Email Logging**: `convex/emails/queries.ts` with comprehensive logging and tracking
- **Global Kill Switch**: `appSettings.emailsEnabled` controls all email sending
- **Unsubscribe System**: Token-based unsubscribe with `convex/emails/linkHelpers.ts`

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

### 2. User Report Notifications (Future Enhancement)

**Purpose**: Notify admins when users report other users for inappropriate behavior

**Trigger**: When user reporting system is extended to include user reports

**Content Structure**:

```
Subject: VibeApps Updates: User Report - [ReportedUserName]

Hey [AdminName],

A user has been reported for inappropriate behavior:

👤 Reported User: [ReportedUserName] (@[ReportedUsername])
👤 Reported by: [ReporterName] (@[ReporterUsername])
⚠️ Reason: [ReportReason]
💬 Context: [ReportContext]

[Review User Profile] [Admin Dashboard]

Please review this user report and take appropriate action.

- The VibeApps Team
```

### 3. Message Report Notifications (Inbox Integration)

**Purpose**: Notify admins when users report inappropriate direct messages

**Trigger**: When inbox message reporting is implemented (from `inboxforapp.md`)

**Content Structure**:

```
Subject: VibeApps Updates: Message Report - Inappropriate Content

Hey [AdminName],

An inappropriate message has been reported:

👤 Sender: [SenderName] (@[SenderUsername])
👤 Reported by: [RecipientName] (@[RecipientUsername])
⚠️ Reason: [ReportReason]
💬 Message Preview: "[MessagePreview...]"
🕐 Sent: [MessageTimestamp]

[Review in Admin Dashboard] [View Conversation]

Please review this message report and take appropriate moderation action.

- The VibeApps Team
```

**Email Type**: `admin_message_report_notification`

## Database Schema Updates

### Existing Schema (Already Implemented)

```typescript
// convex/schema.ts - Already exists
alerts: defineTable({
  recipientUserId: v.id("users"),
  actorUserId: v.optional(v.id("users")),
  type: v.union(
    // ... existing types ...
    v.literal("report"), // ✅ Already exists
  ),
  storyId: v.optional(v.id("stories")),
  // ... other fields
});

emailLogs: defineTable({
  emailType: v.union(
    // ... existing types ...
    v.literal("admin_report_notification"), // ✅ Already exists
  ),
  // ... other fields
});
```

### Required Schema Extensions

```typescript
// convex/schema.ts - Add to existing emailLogs emailType union
emailLogs: defineTable({
  emailType: v.union(
    // ... existing types ...
    v.literal("admin_user_report_notification"), // New
    v.literal("admin_message_report_notification"), // New
  ),
  // ... other fields
});

// Add to existing alerts type union
alerts: defineTable({
  type: v.union(
    // ... existing types ...
    v.literal("user_report"), // New for user reports
    v.literal("message_report"), // New for message reports
  ),
  // ... existing fields ...
  reportedUserId: v.optional(v.id("users")), // New field for user reports
  messageId: v.optional(v.id("messages")), // New field for message reports
});
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
 * Send user report notification emails (future enhancement)
 */
export const sendUserReportNotificationEmails = internalAction({
  args: {
    reporterUserId: v.id("users"),
    reportedUserId: v.id("users"),
    reportId: v.id("userReports"), // Future table
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Implementation for user reporting system
    // Similar structure to story reports
    return null;
  },
});

/**
 * Send message report notification emails (inbox integration)
 */
export const sendMessageReportNotificationEmails = internalAction({
  args: {
    reporterUserId: v.id("users"),
    messageId: v.id("messages"), // From inbox system
    reportId: v.id("messageReports"), // Future table
    adminUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Implementation for message reporting system
    // Integration with inbox system from inboxforapp.md
    return null;
  },
});
```

#### `convex/emails/templates.ts` (Add New Template)

```typescript
/**
 * Generate admin report notification email template
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
```

## Integration Points

### 1. Enhanced Report Creation

Update `convex/reports.ts` to ensure email notifications:

```typescript
// In createReport mutation - already partially implemented
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
```

### 2. Inbox Message Reports Integration

When inbox system is implemented (from `inboxforapp.md`):

```typescript
// In convex/messages.ts (future file)
export const reportMessage = mutation({
  args: {
    messageId: v.id("messages"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    // ... validation logic ...

    // Create message report
    const reportId = await ctx.db.insert("messageReports", {
      messageId: args.messageId,
      reporterUserId: user._id,
      reason: args.reason,
      status: "pending",
    });

    // Get admin users
    const adminUserIds = await getAdminUserIds(ctx);

    // Send immediate email notifications
    await ctx.scheduler.runAfter(
      0,
      internal.emails.reports.sendMessageReportNotificationEmails,
      {
        reporterUserId: user._id,
        messageId: args.messageId,
        reportId: reportId,
        adminUserIds: adminUserIds,
      },
    );

    return reportId;
  },
});
```

### 3. User Report System (Future Enhancement)

```typescript
// In convex/userReports.ts (future file)
export const reportUser = mutation({
  args: {
    reportedUserId: v.id("users"),
    reason: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Similar pattern to story reports
    // Create user report and send admin notifications
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

## References

- Current Alerts System: `convex/alerts.ts`
- Report Management: `convex/reports.ts` and `src/components/admin/ReportManagement.tsx`
- Email Infrastructure: `convex/emails/resend.ts` and `convex/sendEmails.ts`
- Resend Integration PRD: `addresend.md`
- Admin Dashboard: `src/components/admin/AdminDashboard.tsx`
