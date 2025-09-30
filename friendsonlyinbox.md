# Inbox Messaging System PRD

## Overview

This PRD defines one to one direct messages with opt-in inbox control. The inbox icon is always visible on all user profiles next to the follow button. Each user controls whether their inbox is enabled or disabled via a toggle on their own profile. Messaging is available to anyone when the recipient's inbox is enabled, regardless of follow status. The feature integrates with existing VibeApps stack (Clerk auth, Convex backend, alerts, Resend emails) with comprehensive rate limiting and admin moderation.

## Why this matters

User-controlled inbox availability creates a clear consent gate that reduces spam while remaining open and accessible. Users decide who can message them by toggling their inbox on or off. Rate limiting prevents abuse. Admin moderation handles reports without compromising user privacy. The always-visible inbox icon creates discoverability while maintaining user control.

## Scope

- One to one messages only with optional threading support
- Inbox icon always visible on all user profiles next to follow button
- Inbox toggle shows only on own profile (to the right of inbox icon)
- Message button shows when recipient's inbox is enabled (regardless of follow status)
- Visual states: grayed out icon for disabled inbox, black icon for enabled inbox
- @mentions supported within inbox conversations
- Rate limiting: messages per hour per recipient, messages per day site-wide (configurable in admin)
- Admin moderation dashboard for reported messages and users
- Admins cannot see messages unless reported
- Users can report messages or users within inbox
- Reports trigger immediate email to admins and managers
- Alerts fire on new inbox messages for recipient
- Alerts link to inbox conversation
- Daily email rollup mentions inbox activity but never shows message content
- No per-message or per-mention email notifications for inbox
- Real-time sync via Convex queries
- Only authenticated users can access their own conversations and messages
- No group messages in v1
- No file uploads in v1

## User stories

### User Experience

- As a logged in user I see an Inbox icon on all user profiles including my own next to the follow button
- As a logged in user I see an inbox toggle on my own profile (to the right of inbox icon) to enable or disable my inbox
- As a logged in user viewing another profile, I see their inbox icon grayed out if disabled, black if enabled
- As a logged in user I see a Message button on profiles where the user has their inbox enabled (regardless of follow status)
- As a logged in user I can click Message to open or create a conversation with that user if their inbox is enabled
- As a logged in user I can optionally reply to specific messages creating a thread
- As a logged in user I can use @mentions within my inbox messages
- As a logged in user I can report a message or user from within the inbox
- As a logged in user I receive an alert when someone sends me a message
- As a logged in user I see inbox activity mentioned in my daily engagement email (without message content shown)
- As a logged in user I am rate limited to prevent spam (messages per hour per person, per day site-wide)

### Admin Experience

- As an admin I can configure rate limits for messages (per hour per recipient, per day per user)
- As an admin I can view the inbox moderation dashboard showing only reported messages and users
- As an admin I cannot see user messages unless they have been reported
- As an admin I receive an immediate email when a message or user is reported
- As an admin I can review reports and take action (hide message, ban user, dismiss report)

## Data model

All tables are defined in `convex/schema.ts` with proper indexes and validators. Key additions:

- `dmConversations`: normalized pair structure (userAId, userBId)
- `dmMessages`: with optional parentMessageId for threading
- `dmReads`: track last read time per user per conversation
- `dmReports`: message and user reports with status tracking
- `dmRateLimits`: track hourly and daily message counts
- `users.inboxEnabled`: boolean flag (default true)
- `appSettings`: admin-configurable rate limits
- `alerts`: new types "message" and "dm_report"

Full schema definitions provided in data model section of this PRD.

## Convex server functions

### Core Messaging (`convex/dm.ts`)

- `toggleInboxEnabled`: mutation for user to enable/disable inbox
- `getInboxEnabled`: query to check user's inbox status
- `checkRateLimit`: internal query for rate limit validation
- `recordMessageSend`: internal mutation to track sends
- `upsertConversation`: mutation to create or fetch conversation
- `sendMessage`: mutation with threading and @mention support
- `reportMessageOrUser`: mutation to report content
- `listConversations`: query with unread counts
- `listMessages`: paginated query with thread enrichment
- `markConversationRead`: mutation to update read state

### Admin Functions (`convex/admin/dm.ts`)

- `listDmReports`: query for moderation dashboard
- `updateReportStatus`: mutation to resolve reports
- `hideReportedMessage`: mutation for content moderation
- `updateDmRateLimits`: mutation to configure limits
- `getDmRateLimits`: query for current settings

## Email Integration (Resend)

### Daily Engagement Email Update

Add inbox activity section showing message count without content:

```
You received X new messages in your inbox. [View Inbox →]
```

### DM Report Email (Immediate)

- Subject: "VibeApps Updates: New Inbox Report - [type] Reported"
- Sent immediately to all admins and managers
- Includes reporter, reported user, reason, message preview (if applicable)
- Links to admin moderation dashboard
- Email type: `dm_report_notification`

No individual emails for:

- Per-message notifications
- @mentions within inbox

## UI Implementation

### UserProfilePage.tsx Updates

- Add inbox icon next to follow button (always visible)
- Show grayed out icon if inbox disabled, black if enabled
- Add inbox toggle on own profile only (to right of icon)
- Add Message button conditionally (only if recipient inbox enabled)
- Remove mutual follow requirement

### Inbox Page `/inbox`

- Left: conversation list with unread counts
- Right: message thread with composer
- Threading: reply button creates parent-child relationship
- @mention: autocomplete when typing @
- Report: overflow menu on messages
- Mobile: stack layout

### Admin Dashboard `/admin/inbox-moderation`

- List reported messages and users
- Show report context and status
- Action buttons: dismiss, hide message, ban user
- No access to unreported messages

## Authorization and Privacy

- Only message when recipient inbox enabled
- Rate limiting enforced server-side
- Only participants can send/view messages
- Admins cannot see unreported messages
- All functions require authentication
- Convex reactivity for real-time sync

## Rate Limits

Admin configurable via `appSettings`:

- `dmHourlyLimitPerRecipient`: default 10 messages/hour per recipient
- `dmDailyLimitGlobal`: default 100 messages/day site-wide

Enforced before every message send with clear error messages.

## Rollout Plan

1. Backend Foundation: schema, server functions
2. Rate Limiting & Settings: admin configuration
3. UI Implementation: profile updates, inbox page
4. Admin Moderation: dashboard and reporting
5. Email Integration: daily digest, report emails
6. Testing & Optimization: end-to-end validation

## Success Metrics

- Inbox enabled vs disabled rate
- Messages per active user
- Rate limit hit rate
- Report resolution time
- User satisfaction scores

## Out of Scope

- Group conversations
- File uploads
- Message search
- Read receipts
- Reactions
- Message editing/deletion

## Future Enhancements

- Read receipts (opt-in)
- Typing indicators
- File attachments
- Voice messages
- Block user functionality
- Conversation archiving
