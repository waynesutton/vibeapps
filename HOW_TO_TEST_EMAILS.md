# How to Test Daily User Engagement Emails

Let's cook! Here's a simple, step-by-step guide to test and debug the daily user email system.

## Quick Test (3 Steps)

### Step 1: Check Current Status

Run this mutation in your Convex dashboard:

```
testDailyEmail.debugDailyUserEmails
```

This will show you:

- ✅ How many engagement summaries exist for today
- ✅ How many mentions exist for today
- ✅ How many emails were already sent today
- ✅ How many users have email addresses
- ✅ How many users have disabled email notifications
- ✅ **A clear interpretation** telling you exactly why emails aren't sending

### Step 2: If No Engagement Data, Process It

If the debug shows `NO ENGAGEMENT DATA`, run this to process today's engagement:

```
testDailyEmail.testDailyUserEmails
```

This will:

1. Process all engagement for today (votes, comments, ratings, bookmarks)
2. Wait 5 seconds
3. Send emails to all qualifying users

### Step 3: Check the Results

Run the debug function again to see:

- How many emails were sent
- Who received emails
- Email delivery status

## What You'll See

### Scenario A: No Engagement Data

```json
{
  "interpretation": {
    "reason": "NO ENGAGEMENT DATA - Users need to receive votes/comments/mentions before emails can be sent"
  }
}
```

**What this means**: No users received any engagement (votes, comments, ratings, bookmarks, mentions) on their submissions today. This is **normal** if:

- It's early in the day
- Users haven't been active
- No new votes/comments happened today

**Solution**: Either wait for real engagement, or create test engagement by:

1. Having one user submit an app
2. Having another user vote/comment on it
3. Running `testDailyUserEmails` to process and send

### Scenario B: Emails Already Sent

```json
{
  "interpretation": {
    "reason": "EMAILS ALREADY SENT TODAY - Check the emailLogs list above"
  },
  "emailLogs": [
    {
      "recipientEmail": "user@example.com",
      "status": "sent",
      "sentAt": "2025-09-30T18:00:00.000Z"
    }
  ]
}
```

**What this means**: The system is working! Emails were sent. Check the `emailLogs` array to see who received them.

### Scenario C: Ready to Send

```json
{
  "interpretation": {
    "reason": "READY TO SEND - You can run testDailyUserEmails to trigger the emails"
  },
  "engagementSummariesCount": 3
}
```

**What this means**: There's engagement data but emails haven't been sent yet. Run `testDailyUserEmails` to send them.

## Other Test Functions Available

### Test Admin Email

```
testDailyEmail.testDailyAdminEmail
```

Sends the daily admin report to all admin users immediately.

### Test Weekly Digest

```
testDailyEmail.testWeeklyDigest
```

Sends the weekly "Most Vibes" digest to all users immediately.

## Understanding the Cron Schedule

The automated crons run at:

- **5:30 PM PST** (1:30 UTC next day) - `process daily engagement`
  - Scans all stories for today's votes/comments/ratings/bookmarks
  - Creates `dailyEngagementSummary` records
- **6:00 PM PST** (2:00 UTC next day) - `daily user emails`
  - Reads the engagement summaries
  - Sends emails to qualifying users

## Common Issues

### Issue: "No engagement data"

**Reason**: Users haven't received any votes/comments today
**Solution**: This is normal. Wait for real engagement or create test data.

### Issue: "Emails already sent"

**Reason**: The cron already ran today or you ran the test twice
**Solution**: This is working correctly. Each user only gets one email per day.

### Issue: "Users with disabled emails"

**Reason**: Some users have unsubscribed or disabled daily emails
**Solution**: This is expected. Users can manage preferences on their profile page.

## How to Create Test Engagement

1. **Create User A**: Sign up with one account
2. **Submit App**: User A submits an app
3. **Create User B**: Sign up with another account (different email)
4. **Create Engagement**: User B votes/comments on User A's app
5. **Run Test**: Call `testDailyUserEmails`
6. **Check Email**: User A should receive an engagement email

## Expected Email Content

When working, the email includes:

- New votes on your apps
- New ratings on your apps
- New comments on your apps
- New bookmarks on your apps
- New followers
- Mentions in comments
- Replies to your comments
- Featured/pinned notifications
- Admin messages

## Verifying the System is Working

The system is working correctly if:

- ✅ Admin emails send successfully (`testDailyAdminEmail` works)
- ✅ Welcome emails send successfully (new user signup triggers email)
- ✅ Debug function shows correct data counts
- ✅ When engagement exists, `testDailyUserEmails` sends emails

The daily user emails specifically need **actual engagement data** to work. If no users received votes/comments today, there's nothing to email about - and that's by design!

## Need More Help?

Check the Convex logs in your dashboard under "Logs" to see detailed execution traces of the cron jobs and email sends.
