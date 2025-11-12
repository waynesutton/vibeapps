# Resend Email Integration for React + Convex Apps

**Status**: Production-ready implementation guide based on VibeApps successful deployment

## Overview

This PRD provides a comprehensive guide for integrating Resend email functionality into React applications using Convex.dev as the backend. Based on the successful implementation in VibeApps, this guide covers everything from initial setup to production deployment with real-world best practices and lessons learned.

## What Worked Well

### 1. Convex Resend Component Integration
- **Seamless Integration**: The `@convex-dev/resend` component provides excellent type safety and integration with Convex's real-time capabilities
- **Test Mode Support**: Built-in test mode for development, easy production toggle
- **Component Architecture**: Clean separation between email sending logic and business logic

### 2. Comprehensive Email System Architecture
- **Modular Design**: Separate files for templates, sending logic, queries, and cron jobs
- **Type Safety**: Full TypeScript integration with Convex validators
- **Error Handling**: Robust error handling with detailed logging and fallback mechanisms

### 3. Production-Ready Features
- **Duplicate Prevention**: Date-based duplicate prevention that automatically resets daily
- **Global Kill Switch**: Admin controls for enabling/disabling email system
- **Unsubscribe Management**: Complete unsubscribe token system with one-click unsubscribe
- **Email Preferences**: Granular user preferences for different email types

### 4. Admin Management Interface
- **Comprehensive UI**: Full admin dashboard for email management
- **Testing Tools**: Built-in email testing and verification system
- **Broadcast System**: Admin broadcast functionality with user search and targeting
- **Analytics**: Email sending logs and analytics

## What Didn't Work Well (Lessons Learned)

### 1. Initial Setup Complexity
- **Environment Configuration**: Multiple environment variables and domain setup required
- **Clerk Integration**: Complex JWT claims configuration for user email access
- **Domain Verification**: Resend domain verification process can be time-consuming

### 2. Cron Job Timing Issues
- **Timezone Handling**: PST/UTC conversion in cron jobs caused initial confusion
- **Race Conditions**: Daily processing and user email sending needed careful sequencing
- **Testing Limitations**: Difficult to test cron jobs in development environment

### 3. Email Template Management
- **HTML Complexity**: Managing complex HTML templates in TypeScript strings
- **Responsive Design**: Ensuring email templates work across all email clients
- **Content Updates**: Updating email content required code changes and deployment

## Implementation Guide

### Phase 1: Core Setup

#### 1.1 Dependencies Installation

```bash
npm install @convex-dev/resend
```

#### 1.2 Convex Configuration

**File: `convex/convex.config.ts`**
```typescript
import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";

const app = defineApp();
app.use(resend);

export default app;
```

#### 1.3 Environment Variables

**Required Environment Variables:**
```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxx

# Email Configuration
EMAIL_FROM_ADDRESS=alerts@yourdomain.com
EMAIL_FROM_NAME=Your App Name
EMAIL_SUBJECT_PREFIX=Your App Updates:
```

#### 1.4 Resend Instance Setup

**File: `convex/sendEmails.ts`**
```typescript
import { components, internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { internalMutation, internalAction, mutation } from "./_generated/server";
import { v } from "convex/values";

export const resend: Resend = new Resend(components.resend, {
  testMode: process.env.NODE_ENV === "development", // Enable test mode in development
});

// Subject prefix helper
export const withSubjectPrefix = (subject: string): string => {
  const prefix = process.env.EMAIL_SUBJECT_PREFIX || "App Updates:";
  return `${prefix} ${subject}`;
};
```

### Phase 2: Database Schema

#### 2.1 Email-Related Tables

**File: `convex/schema.ts`**
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Email preferences per user
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

  // Track email sends to prevent duplicates and for analytics
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
      v.literal("admin_report_notification"),
    ),
    recipientEmail: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("skipped")),
    resendMessageId: v.optional(v.string()),
    sentAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_user_and_type", ["userId", "emailType"])
    .index("by_recipient", ["recipientEmail"])
    .index("by_type_and_date", ["emailType", "sentAt"]),

  // Unsubscribe tokens for one-click unsubscribe
  emailUnsubscribeTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    purpose: v.union(
      v.literal("all"),
      v.literal("daily_engagement"),
      v.literal("message_notifications"),
      v.literal("marketing"),
      v.literal("weekly_digest"),
      v.literal("mentions"),
    ),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // App settings for global email controls
  appSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});
```

### Phase 3: Core Email Infrastructure

#### 3.1 Email Sending Action

**File: `convex/emails/resend.ts`**
```typescript
"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { resend, withSubjectPrefix } from "../sendEmails";

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
      v.literal("admin_report_notification"),
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
    try {
      // Check global kill switch
      const emailsEnabled = await ctx.runQuery(
        internal.settings.getBooleanInternal,
        { key: "emailsEnabled" }
      );

      if (emailsEnabled === false) {
        console.log("Emails globally disabled, skipping send");
        return { success: false, error: "Emails globally disabled" };
      }

      // Prepare email data
      const emailData: any = {
        to: args.to,
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        subject: withSubjectPrefix(args.subject),
        html: args.html,
      };

      // Add unsubscribe headers if token provided
      if (args.unsubscribeToken) {
        emailData.headers = [
          {
            name: "List-Unsubscribe",
            value: `<https://yourdomain.com/api/unsubscribe?token=${args.unsubscribeToken}>`,
          },
          {
            name: "List-Unsubscribe-Post",
            value: "List-Unsubscribe=One-Click",
          },
        ];
      }

      // Send via Resend
      const result = await resend.sendEmail(ctx, emailData);

      // Log the send attempt
      await ctx.runMutation(internal.emails.queries.insertEmailLog, {
        userId: args.userId,
        emailType: args.emailType,
        recipientEmail: args.to,
        status: "sent",
        resendMessageId: String(result),
        metadata: args.metadata,
      });

      return {
        success: true,
        messageId: String(result),
      };
    } catch (error: any) {
      console.error("Email send error:", error);
      
      // Log failed attempt
      await ctx.runMutation(internal.emails.queries.insertEmailLog, {
        userId: args.userId,
        emailType: args.emailType,
        recipientEmail: args.to,
        status: "failed",
        metadata: { error: error.message },
      });

      return {
        success: false,
        error: error.message,
      };
    }
  },
});
```

#### 3.2 Email Templates

**File: `convex/emails/templates.ts`**
```typescript
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const generateWelcomeEmail = internalQuery({
  args: {
    userName: v.string(),
    userEmail: v.string(),
    unsubscribeToken: v.optional(v.string()),
  },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
  }),
  handler: async (ctx, args) => {
    const subject = "Welcome to Our App!";
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Welcome, ${args.userName}!</h1>
            <p>Thank you for joining our app. We're excited to have you on board!</p>
            
            <div style="margin: 30px 0;">
              <a href="https://yourdomain.com" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Get Started
              </a>
            </div>
            
            ${args.unsubscribeToken ? `
              <p style="font-size: 12px; color: #666; margin-top: 40px;">
                <a href="https://yourdomain.com/api/unsubscribe?token=${args.unsubscribeToken}">Unsubscribe</a>
              </p>
            ` : ''}
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  },
});
```

### Phase 4: Cron Jobs and Automation

#### 4.1 Cron Configuration

**File: `convex/crons.ts`**
```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily admin email at 9:00 AM PST
crons.cron(
  "daily admin email",
  "0 17 * * *", // 9:00 AM PST = 17:00 UTC
  internal.emails.daily.sendDailyAdminEmail,
  {}
);

// Send user engagement emails at 6:00 PM PST
crons.cron(
  "daily user emails",
  "0 2 * * *", // 6:00 PM PST = 2:00 UTC next day
  internal.emails.daily.sendDailyUserEmails,
  {}
);

// Weekly digest Monday 9:00 AM PST
crons.cron(
  "weekly digest",
  "0 17 * * MON", // Monday 9:00 AM PST = 17:00 UTC
  internal.emails.weekly.sendWeeklyDigest,
  {}
);

export default crons;
```

### Phase 5: Frontend Integration

#### 5.1 Admin Email Management Component

**File: `src/components/admin/EmailManagement.tsx`**
```typescript
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function EmailManagement() {
  const [emailToggling, setEmailToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queries
  const emailsEnabled = useQuery(api.settings.getBoolean, { key: "emailsEnabled" });
  const emailStats = useQuery(api.emails.queries.getEmailStats);

  // Mutations
  const toggleEmails = useMutation(api.settings.setBoolean);
  const sendTestEmail = useMutation(api.sendEmails.sendTestEmail);

  const handleToggleEmails = async () => {
    setEmailToggling(true);
    try {
      await toggleEmails({
        key: "emailsEnabled",
        value: !emailsEnabled,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailToggling(false);
    }
  };

  const handleSendTest = async () => {
    try {
      await sendTestEmail({
        to: "admin@yourdomain.com",
        subject: "Test Email",
        html: "<p>This is a test email from your app.</p>",
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Email System Control</h2>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="font-medium">Global Email System</h3>
            <p className="text-sm text-gray-600">
              {emailsEnabled ? "Emails are enabled" : "Emails are disabled"}
            </p>
          </div>
          <button
            onClick={handleToggleEmails}
            disabled={emailToggling}
            className={`px-4 py-2 rounded-md font-medium ${
              emailsEnabled
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {emailToggling ? "Toggling..." : emailsEnabled ? "Disable" : "Enable"}
          </button>
        </div>

        <div className="mt-4">
          <button
            onClick={handleSendTest}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Send Test Email
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
```

### Phase 6: Production Considerations

#### 6.1 Domain Setup
1. **Resend Domain Verification**: Add your domain to Resend dashboard
2. **DNS Configuration**: Set up SPF, DKIM, and DMARC records
3. **Subdomain Strategy**: Use dedicated subdomain for email sending (e.g., `updates.yourdomain.com`)

#### 6.2 Environment Configuration
```bash
# Production Environment Variables
RESEND_API_KEY=re_prod_xxxxxxxxx
EMAIL_FROM_ADDRESS=alerts@updates.yourdomain.com
EMAIL_FROM_NAME=Your App Name
EMAIL_SUBJECT_PREFIX=Your App Updates:
NODE_ENV=production
```

#### 6.3 Monitoring and Analytics
- **Email Logs**: Track all email sends, failures, and user engagement
- **Unsubscribe Rates**: Monitor unsubscribe patterns
- **Delivery Rates**: Track email delivery success rates
- **User Engagement**: Monitor email open and click rates

## Best Practices

### 1. Email Design
- **Mobile-First**: Design emails for mobile devices first
- **Consistent Branding**: Use consistent colors, fonts, and styling
- **Clear CTAs**: Make call-to-action buttons prominent and clear
- **Fallback Content**: Ensure emails work even with images disabled

### 2. Performance
- **Template Caching**: Cache email templates when possible
- **Batch Processing**: Process multiple emails in batches for better performance
- **Rate Limiting**: Respect Resend's rate limits and implement backoff strategies

### 3. User Experience
- **Granular Preferences**: Allow users to control which emails they receive
- **Easy Unsubscribe**: Provide one-click unsubscribe functionality
- **Email Previews**: Show users what emails will look like before sending

### 4. Security
- **Token Security**: Use secure, random tokens for unsubscribe links
- **Input Validation**: Validate all email inputs and sanitize HTML content
- **Rate Limiting**: Implement rate limiting for email sending functions

## Common Pitfalls to Avoid

### 1. Testing Issues
- **Test Mode**: Always use test mode in development
- **Cron Testing**: Test cron jobs thoroughly before production deployment
- **Email Client Testing**: Test emails across different email clients

### 2. Configuration Mistakes
- **Environment Variables**: Double-check all environment variables are set correctly
- **Domain Configuration**: Ensure domain verification is complete before production
- **Cron Timing**: Verify cron job timing calculations for your timezone

### 3. User Experience Problems
- **Duplicate Emails**: Implement proper duplicate prevention
- **Unsubscribe Issues**: Test unsubscribe functionality thoroughly
- **Email Preferences**: Make sure user preferences are respected

## Migration Strategy

### From Existing Email Systems
1. **Data Migration**: Export existing email preferences and user data
2. **Gradual Rollout**: Start with non-critical emails (welcome, notifications)
3. **A/B Testing**: Test new system alongside existing system
4. **User Communication**: Inform users about email system changes

### Scaling Considerations
1. **Database Indexing**: Ensure proper indexes for email queries
2. **Caching Strategy**: Implement caching for frequently accessed data
3. **Queue Management**: Consider queue systems for high-volume email sending
4. **Monitoring**: Set up comprehensive monitoring and alerting

## Conclusion

This implementation provides a robust, production-ready email system for React + Convex applications. The modular architecture allows for easy customization and extension, while the comprehensive error handling and logging ensure reliable operation in production environments.

The key to success is following the phased approach, thoroughly testing each component, and implementing proper monitoring and analytics from the start. With this foundation, you can build a sophisticated email system that enhances user engagement and provides valuable insights into user behavior.
