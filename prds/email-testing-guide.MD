# Email System Testing Guide

## Overview

This guide explains how to test that your Resend email system fetches fresh data from the database for scheduled emails.

**📖 Related Documentation:**

- **`TESTING_SUMMARY.md`** - Comprehensive email testing system documentation with all fixes and features
- **`EMAIL_DATE_RANGE_FIX.md`** - Detailed explanation of date range bug fix and testing improvements
- **`addresend.md`** - Complete Resend integration documentation (see Phase 11 for recent improvements)

## Quick Testing Methods

### Method 1: Admin Dashboard UI (Recommended - No Convex Dashboard Required!)

The email testing panel is now built into your Admin Dashboard!

1. **Access the testing panel**:
   - Sign in as an admin user
   - Navigate to **Admin Dashboard** → **Emails** tab
   - Scroll down to the **Email System Testing** section

2. **View current database state**:
   - See real-time counts for Stories, Users, Votes, Comments
   - Check last email sent timestamp
   - View data freshness status indicator

3. **Test emails with one click**:
   - Click **"Test Admin Email"** to trigger admin metrics email
   - Click **"Test Engagement Email"** to process user engagement
   - Click **"Test Weekly Digest"** to send weekly leaderboard
   - Wait a few seconds for confirmation
   - Check your email inbox to verify content

4. **What happens when you test**:
   - System takes snapshot of current database
   - Triggers email with fresh data
   - **Shows date range being tested** (e.g., "Today: 2025-10-11")
   - **Displays activity warnings** if no data found for that date range
   - Shows success/failure message with detailed metrics
   - Auto-verifies email logs after sending
   - You receive actual email in your inbox

5. **Enhanced Testing Features** (Phase 11 improvements):
   - **Date Range Display**: See exactly which date range is being tested
   - **Activity Warnings**: Get alerts if no activity found (e.g., "⚠️ No activity on this date")
   - **Inbox Message Integration**: Daily emails now include inbox message notifications
   - **Accurate Date Calculations**: Fixed critical date range bug for correct activity reporting

6. **No Convex Dashboard access needed** - Everything works directly in the app!

### Method 2: Convex Dashboard (Optional - For Advanced Debugging Only)

**Note:** Admin dashboard testing (Method 1) is the recommended approach. Use this method only if you need to debug function execution directly.

**Test Functions:**

These functions are now admin-protected public functions (not internal):

- `api.testEmailFreshness.testEmailDataFreshness` - Trigger test emails
- `api.testEmailFreshness.verifyEmailLogFreshness` - Check email logs
- `api.testEmailFreshness.compareEmailDataWithDatabase` - Compare state

You can call these from Convex Dashboard if needed, but they require admin authentication.

### Method 3: Existing Test Utilities (For Development)

**Clear Email Logs (for repeated testing):**

1. Admin Dashboard → Emails section
2. Click "Clear Today's Email Logs"
3. This removes duplicate prevention
4. You can now re-test emails multiple times today

**Manual Cron Triggers:**

Run these functions directly from Convex Dashboard:

```typescript
// Daily Admin Email
internal.emails.daily.sendDailyAdminEmail
{ "date": "2025-10-11" } // Use today's date

// Process User Engagement
internal.emails.daily.processUserEngagement
{ "date": "2025-10-11" }

// Send User Emails
internal.emails.daily.sendDailyUserEmails
{ "date": "2025-10-11" }

// Weekly Digest
internal.emails.weekly.sendWeeklyDigest
{ "date": "2025-10-11" }
```

## Verifying Data Freshness

### What to Check

**1. Database State Before Email:**

- Go to Convex Dashboard → **Data** tab
- Note current counts:
  - Stories count
  - Users count
  - Votes count
  - Comments count

**2. Trigger Test Email:**

- Use Method 2 above
- Watch logs for data snapshot

**3. Check Email Content:**

- Open received email
- Verify numbers match database state
- Check that metrics are current

**4. Check Email Logs:**

```typescript
// Query emailLogs table in Convex Dashboard
// Filter by:
// - emailType = "daily_admin"
// - sentAt > [recent timestamp]
// Verify:
// - status = "sent"
// - sentAt is recent
// - metadata contains current counts
```

### Example Test Flow

**Testing Daily Admin Email:**

```bash
# 1. Check current state
Convex Dashboard → Data → stories table → count: 150
Convex Dashboard → Data → users table → count: 89

# 2. Run test function
Convex Dashboard → Functions →
  internal.testEmailFreshness.testEmailDataFreshness
  Args: { "emailType": "daily_admin" }

# 3. Watch logs
📊 Current database state: {
  totalStories: 150,
  totalUsers: 89,
  totalVotes: 423,
  totalComments: 89
}
🚀 Triggering daily admin email...

# 4. Check inbox
Subject: VibeApps Daily Report - 2025-10-11
Content shows:
- New Apps Submitted: 150 ✅ (matches!)
- Total Platform Users: 89 ✅ (matches!)

# 5. Verify in emailLogs
Convex Dashboard → Data → emailLogs
Latest entry:
- emailType: "daily_admin"
- status: "sent"
- sentAt: [just now]
- metadata: { contains snapshot }
```

## Common Issues & Solutions

### Issue: Emails Not Sending

**Check 1: Global Email Toggle**

```typescript
// Query in Convex Dashboard
appSettings table → key: "emailsEnabled" → valueBoolean: true
```

**Check 2: Cron Jobs Running**

```bash
Convex Dashboard → Crons tab
Verify all email crons are active:
- "daily admin email" - 0 9 * * *
- "daily user emails" - 0 18 * * *
- "weekly most vibes" - 0 9 * * MON
```

**Check 3: Resend API Key**

```bash
Convex Dashboard → Settings → Environment Variables
RESEND_API_KEY=re_xxxxxxx (must be set)
```

### Issue: Old Data in Emails

**Problem**: Email shows data from yesterday

**Solution**:

1. Check cron timing - emails may be scheduled for specific times
2. Verify `date` parameter passed to functions
3. Run test function to force immediate processing:
   ```typescript
   internal.emails.daily.processUserEngagement
   { "date": "2025-10-11" } // Today's date
   ```

### Issue: Duplicate Emails

**Problem**: Same email sent multiple times

**Solution**:

- This is expected during testing
- Clear logs between tests:
  ```typescript
  // Admin Dashboard → Clear Today's Email Logs
  // Or manually delete from emailLogs table
  ```

## Monitoring in Production

### Daily Checks

**Check Email Logs:**

```typescript
// Run daily to verify emails sent
internal.testEmailFreshness.compareEmailDataWithDatabase;

// Review output:
// - Last email time (should be within 24 hours)
// - Data freshness status
// - System health notes
```

**Check Convex Logs:**

```bash
Convex Dashboard → Logs
Filter by:
- Function: "internal.emails"
- Time: Last 24 hours
Look for:
- ✅ "Sending email to [user]"
- ✅ "Email sent successfully"
- ❌ Any error messages
```

### Weekly Review

1. **Email Deliverability:**
   - Check `emailLogs` table
   - Count: sent vs failed
   - Target: >95% success rate

2. **Data Accuracy:**
   - Compare email content with database
   - Run freshness test
   - Verify metrics are current

3. **User Engagement:**
   - Check open rates (if tracking enabled)
   - Monitor unsubscribe rates
   - Review user feedback

## Advanced Testing

### Test with Real User Activity

```typescript
// 1. Create test activity
// In your app:
// - Create new story
// - Vote on stories
// - Add comments

// 2. Process engagement immediately
Convex Dashboard → Functions →
  internal.emails.daily.processUserEngagement
  Args: { "date": "2025-10-11" }

// 3. Send test email
  internal.emails.daily.sendDailyUserEmails
  Args: { "date": "2025-10-11" }

// 4. Check email contains your test activity
```

### Test Weekly Digest Calculation

```typescript
// 1. Add votes to stories this week
// (use your app UI)

// 2. Test leaderboard calculation
Convex Dashboard → Functions →
  internal.emails.weekly.computeWeeklyMostVibes
  Args: {
    "weekStartMs": 1728345600000, // Monday 00:00:00
    "weekEndMs": 1728950400000,   // Sunday 23:59:59
    "limit": 10
  }

// 3. Verify output shows stories with most votes

// 4. Send digest
  internal.emails.weekly.sendWeeklyDigest
  Args: { "date": "2025-10-11" }
```

## Automated Testing Script

For regular testing, you can create a script:

```bash
#!/bin/bash
# test-emails.sh

echo "Testing Email System..."

# Test admin email
convex run internal.testEmailFreshness.testEmailDataFreshness \
  '{ "emailType": "daily_admin" }'

echo "Waiting 10 seconds..."
sleep 10

# Verify logs
convex run internal.testEmailFreshness.verifyEmailLogFreshness \
  '{ "emailType": "daily_admin", "lookbackMinutes": 5 }'

echo "Check your email inbox!"
```

## Support

If emails are not fetching fresh data:

1. Check Convex logs for errors
2. Verify database queries in email functions
3. Run test functions and compare output
4. **Review comprehensive testing documentation**:
   - See `TESTING_SUMMARY.md` for complete testing system overview
   - See `EMAIL_DATE_RANGE_FIX.md` for date range calculation details
   - See `addresend.md` Phase 11 for recent bug fixes
5. Check GitHub issues: https://github.com/waynesutton/vibeapps/issues

## Summary

✅ **Quick Test**: Use the **Email System Testing** panel in Admin Dashboard → Emails tab (No Convex Dashboard required!)

✅ **One-Click Testing**: Click test buttons to trigger emails with current database state

✅ **Real-Time Monitoring**: View current database metrics and email freshness status

✅ **Enhanced Visibility** (Phase 11): Date range display and activity warnings for better debugging

✅ **Inbox Integration**: Daily emails now include inbox message notifications with sender info

✅ **Admin-Only**: All testing features require admin role for security

✅ **In-App Experience**: Everything works directly in your app - no external tools needed

✅ **Comprehensive Documentation**: See `TESTING_SUMMARY.md` and `EMAIL_DATE_RANGE_FIX.md` for detailed guides

The email system fetches fresh data each time cron jobs run or when manually triggered. The testing panel confirms this by taking database snapshots before sending emails and showing you the results in real-time with date ranges and activity warnings.
