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
- Users can delete their own messages (soft delete, only removed from their view)
- Users can delete individual conversations from their inbox (soft delete, only removed from their view)
- Users can clear their entire inbox (soft delete all conversations at once)
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
- As a logged in user I can delete my own messages (removes message from my view only)
- As a logged in user I can delete a conversation from my inbox (removes entire conversation from my view only)
- As a logged in user I can clear my entire inbox (removes all conversations from my view at once)
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
- `dmMessages`: with optional parentMessageId for threading and deletedBy array for soft deletes
- `dmDeletedConversations`: track which users deleted which conversations (soft delete)
- `dmReads`: track last read time per user per conversation
- `dmReports`: message and user reports with status tracking
- `dmRateLimits`: track hourly and daily message counts
- `users.inboxEnabled`: boolean flag (default true)
- `appSettings`: admin-configurable rate limits
- `alerts`: new types "message" and "dm_report"

### Detailed Schema Definitions

```typescript
// convex/schema.ts additions

export default defineSchema({
  // ... existing tables ...

  // Direct message conversations between users
  dmConversations: defineTable({
    userAId: v.id("users"),
    userBId: v.id("users"),
    lastMessageId: v.optional(v.id("dmMessages")),
    lastActivityTime: v.number(),
  })
    .index("by_userA_userB", ["userAId", "userBId"])
    .index("by_userA_activity", ["userAId", "lastActivityTime"])
    .index("by_userB_activity", ["userBId", "lastActivityTime"]),

  // Individual messages within conversations
  dmMessages: defineTable({
    conversationId: v.id("dmConversations"),
    senderId: v.id("users"),
    content: v.string(), // Max 2000 characters
    parentMessageId: v.optional(v.id("dmMessages")), // For threading
    deletedBy: v.optional(v.array(v.id("users"))), // Track which users deleted this message
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_time", ["conversationId", "_creationTime"])
    .index("by_parent", ["parentMessageId"]),

  // Track deleted conversations per user (soft delete)
  dmDeletedConversations: defineTable({
    conversationId: v.id("dmConversations"),
    userId: v.id("users"),
  })
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),

  // Track read status per user per conversation
  dmReads: defineTable({
    conversationId: v.id("dmConversations"),
    userId: v.id("users"),
    lastReadTime: v.number(),
  })
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),

  // Reports for messages and users
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
    .index("by_reported_user", ["reportedUserId"]),

  // Rate limiting tracking
  dmRateLimits: defineTable({
    userId: v.id("users"),
    recipientId: v.optional(v.id("users")), // For per-recipient limits
    windowStart: v.number(),
    messageCount: v.number(),
    limitType: v.union(
      v.literal("hourly_per_recipient"),
      v.literal("daily_global"),
    ),
  })
    .index("by_user_type_window", ["userId", "limitType", "windowStart"])
    .index("by_user_recipient_window", [
      "userId",
      "recipientId",
      "windowStart",
    ]),

  // Update users table to include inbox toggle
  users: defineTable({
    // ... existing fields ...
    inboxEnabled: v.optional(v.boolean()), // Default true
  }),

  // Update appSettings to include DM rate limits
  appSettings: defineTable({
    // ... existing fields ...
    dmHourlyLimitPerRecipient: v.optional(v.number()), // Default 10
    dmDailyLimitGlobal: v.optional(v.number()), // Default 100
  }),

  // Update alerts for new message types
  alerts: defineTable({
    // ... existing fields ...
    type: v.union(
      // ... existing types ...
      v.literal("message"),
      v.literal("dm_report"),
    ),
  }),
});
```

## Convex server functions

### Core Messaging (`convex/dm.ts`)

- `toggleInboxEnabled`: mutation for user to enable/disable inbox
- `getInboxEnabled`: query to check user's inbox status
- `checkRateLimit`: internal query for rate limit validation
- `recordMessageSend`: internal mutation to track sends
- `upsertConversation`: mutation to create or fetch conversation
- `sendMessage`: mutation with threading and @mention support
- `deleteMessage`: mutation for user to delete their own message (soft delete)
- `deleteConversation`: mutation for user to delete a conversation from their view
- `clearInbox`: mutation for user to delete all conversations at once
- `reportMessageOrUser`: mutation to report content
- `listConversations`: query with unread counts (filters out deleted conversations)
- `listMessages`: paginated query with thread enrichment (filters out messages deleted by current user)
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
- Delete options: overflow menu on messages and conversations
- Clear inbox: button to delete all conversations at once (with confirmation)
- Report: overflow menu on messages
- Mobile: stack layout

### Frontend Components Structure

```
src/components/messages/
├── ConversationList.tsx      # List of conversations with unread counts
├── ConversationView.tsx      # Individual conversation interface
├── MessageBubble.tsx         # Individual message component with delete option
├── MessageInput.tsx          # Compose new message with @mention
├── MessageThread.tsx         # Threaded reply view
├── DeleteMessageModal.tsx    # Confirm message deletion
├── DeleteConversationModal.tsx  # Confirm conversation deletion
├── ClearInboxModal.tsx       # Confirm clearing entire inbox
└── ReportMessageModal.tsx    # Report inappropriate message
```

### @Mention Integration

```typescript
// Use existing MentionTextarea component
import { MentionTextarea } from "../ui/MentionTextarea";

// In MessageInput.tsx
<MentionTextarea
  value={messageContent}
  onChange={setMessageContent}
  placeholder="Type a message... Use @username to mention someone"
  maxLength={2000}
  disabled={sending}
/>

// Process mentions on send
const handleSend = async () => {
  // Extract mentions using existing utility from mentions.ts
  const mentionedUsers = await extractMentions(messageContent);

  await sendMessage({
    conversationId,
    content: messageContent,
    mentionedUsers, // Will trigger mention notifications
  });
};
```

### Real-time Updates

```typescript
// Real-time conversation list (excludes deleted conversations)
const conversations = useQuery(
  api.dm.listConversations,
  isSignedIn ? {} : "skip",
);

// Real-time messages in conversation (excludes messages deleted by current user)
const messages = useQuery(
  api.dm.listMessages,
  selectedConversationId ? { conversationId: selectedConversationId } : "skip",
);

// Real-time unread count for badge
const unreadCount = useQuery(api.dm.getUnreadCount, isSignedIn ? {} : "skip");
```

### Deletion UI Patterns

```typescript
// MessageBubble.tsx - Delete own message
{isOwnMessage && (
  <button
    onClick={() => setShowDeleteModal(true)}
    className="text-red-600 hover:text-red-800">
    Delete
  </button>
)}

// ConversationList.tsx - Delete conversation
<button
  onClick={() => setShowDeleteConversationModal(true)}
  className="text-red-600 hover:text-red-800">
  Delete Conversation
</button>

// InboxHeader.tsx - Clear entire inbox
<button
  onClick={() => setShowClearInboxModal(true)}
  className="text-red-600 hover:text-red-800">
  Clear Inbox ({conversationCount})
</button>

// Confirmation modals show clear warnings
<DeleteMessageModal
  message="This will remove this message from your view. The other person will still see it."
  onConfirm={handleDelete}
/>

<ClearInboxModal
  message={`This will remove all ${count} conversations from your inbox. This cannot be undone.`}
  onConfirm={handleClearInbox}
/>
```

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

## Message and Conversation Deletion

### Deletion Behavior

All deletions are **soft deletes** that only affect the user's own view:

#### Message Deletion

- Users can delete their own messages only
- Deleted messages are removed from the deleting user's view
- Other participants still see the message normally
- `deletedBy` array tracks which users deleted the message
- Queries filter out messages where current user is in `deletedBy`
- Deleted messages remain in database for admin reports and moderation

#### Conversation Deletion

- Users can delete conversations from their inbox
- Deleted conversations are removed from the deleting user's conversation list
- Other participant still sees the conversation normally
- Record created in `dmDeletedConversations` table
- Queries filter out conversations deleted by current user
- New messages to deleted conversations will restore them in the user's inbox

#### Clear Inbox

- Batch operation to delete all conversations at once
- Creates `dmDeletedConversations` records for all active conversations
- Shows confirmation modal with count of conversations to be cleared
- Cannot be undone (user must wait for new messages to restore conversations)
- Does not affect other users' views of conversations

### Implementation Details

```typescript
// Delete message mutation
export const deleteMessage = mutation({
  args: { messageId: v.id("dmMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    // Only sender can delete
    if (message.senderId !== identity.subject) {
      throw new Error("You can only delete your own messages");
    }

    // Add user to deletedBy array
    const deletedBy = message.deletedBy ?? [];
    await ctx.db.patch(args.messageId, {
      deletedBy: [...deletedBy, identity.subject],
    });

    return null;
  },
});

// Delete conversation mutation
export const deleteConversation = mutation({
  args: { conversationId: v.id("dmConversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if already deleted
    const existing = await ctx.db
      .query("dmDeletedConversations")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", identity.subject),
      )
      .first();

    if (existing) return null; // Already deleted

    // Create deletion record
    await ctx.db.insert("dmDeletedConversations", {
      conversationId: args.conversationId,
      userId: identity.subject,
    });

    return null;
  },
});

// Clear inbox mutation
export const clearInbox = mutation({
  args: {},
  returns: v.object({ deletedCount: v.number() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get all active conversations
    const conversations = await ctx.db
      .query("dmConversations")
      .filter((q) =>
        q.or(
          q.eq(q.field("userAId"), identity.subject),
          q.eq(q.field("userBId"), identity.subject),
        ),
      )
      .collect();

    let deletedCount = 0;

    for (const conversation of conversations) {
      // Check if not already deleted
      const existing = await ctx.db
        .query("dmDeletedConversations")
        .withIndex("by_conversation_user", (q) =>
          q
            .eq("conversationId", conversation._id)
            .eq("userId", identity.subject),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("dmDeletedConversations", {
          conversationId: conversation._id,
          userId: identity.subject,
        });
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});
```

## Rate Limits

Admin configurable via `appSettings`:

- `dmHourlyLimitPerRecipient`: default 10 messages/hour per recipient
- `dmDailyLimitGlobal`: default 100 messages/day site-wide

Enforced before every message send with clear error messages.

## Technical Considerations

### Performance Optimization

- **Message pagination**: Load messages in chunks of 50
- **Conversation virtualization**: Virtual scrolling for large conversation lists
- **Optimistic updates**: Immediate UI updates with error handling
- **Debounced typing**: Prevent excessive re-renders

### Real-time Features

- **Convex reactivity**: Automatic UI updates for new messages
- **Message delivery status**: Visual indicators for sent messages
- **Unread tracking**: Per-conversation read status
- **Live conversation updates**: Real-time last message and timestamp

### Data Management

- **Message retention**: Consider auto-delete after 1 year (configurable)
- **Text message limits**: 2000 characters per message
- **Rate limiting enforcement**: Server-side validation before every send
- **Conversation limits**: Monitor active conversation counts per user
- **Soft deletion**: Messages and conversations use soft deletes (per-user view only)
- **Query filtering**: All queries automatically filter deleted items for current user
- **Deletion cleanup**: Consider periodic cleanup of messages deleted by all participants
- **Restore on new message**: Deleted conversations automatically restore when new messages arrive

## Implementation Phases

### Phase 1: Backend Foundation (Week 1)

- [ ] Database schema implementation in `convex/schema.ts`
- [ ] Add `deletedBy` field to dmMessages table
- [ ] Add `dmDeletedConversations` table for soft deletes
- [ ] Core messaging functions in `convex/dm.ts`
- [ ] Rate limiting logic and tracking
- [ ] Inbox toggle functionality
- [ ] Basic conversation and message CRUD operations
- [ ] Message deletion (soft delete for sender)
- [ ] Conversation deletion (soft delete per user)
- [ ] Clear inbox functionality

### Phase 2: UI Components (Week 2)

- [ ] ConversationList component with real-time updates
- [ ] ConversationView with message display
- [ ] MessageBubble with delete option for own messages
- [ ] MessageInput with @mention autocomplete
- [ ] MessageThread for reply view
- [ ] DeleteMessageModal with confirmation
- [ ] DeleteConversationModal with confirmation
- [ ] ClearInboxModal with confirmation and count
- [ ] Profile page inbox icon and toggle
- [ ] Message button on profiles

### Phase 3: Admin & Moderation (Week 3)

- [ ] Report message/user functionality
- [ ] Admin moderation dashboard at `/admin/inbox-moderation`
- [ ] Admin functions in `convex/admin/dm.ts`
- [ ] Immediate admin email notifications for reports
- [ ] Report status management

### Phase 4: Email & Alerts (Week 4)

- [ ] Alert creation for new messages
- [ ] Daily email integration showing inbox activity count
- [ ] DM report email template and sending
- [ ] Alert linking to conversation

### Phase 5: Testing & Polish (Week 5)

- [ ] End-to-end testing of all flows
- [ ] Mobile responsiveness optimization
- [ ] Performance testing with large datasets
- [ ] Rate limit testing and tuning
- [ ] Bug fixes and edge case handling

## Migration & Deployment

### Database Migration

1. **Schema deployment**: Add new tables to Convex schema
2. **Default settings**: Set `inboxEnabled: true` for existing users
3. **Index creation**: Ensure all required indexes are built
4. **Rate limit defaults**: Configure initial rate limits in appSettings

### Feature Rollout

1. **Admin testing**: Enable for admin users first
2. **Beta group**: Limited user testing for feedback
3. **Gradual rollout**: Percentage-based feature flags if needed
4. **Full deployment**: All users with monitoring
5. **Monitoring**: Track message volume, errors, and user adoption

## Success Metrics

### User Engagement

- **Inbox adoption**: Percentage of users with inbox enabled vs disabled
- **Daily active messengers**: Users sending or receiving messages daily
- **Messages per active user**: Average messages sent per active user
- **Conversation length**: Average number of messages per conversation
- **Return rate**: Users returning to messaging feature within 7 days
- **Deletion rates**: Percentage of messages deleted, conversations deleted, inbox clears
- **Conversation restoration**: How often deleted conversations are restored by new messages

### Privacy & Safety

- **Rate limit effectiveness**: Percentage of users hitting rate limits
- **Report response time**: Average time to resolve message reports
- **Report volume**: Number of reports per 1000 messages
- **Admin action rate**: Percentage of reports resulting in action (hide/ban)
- **User blocking**: Adoption of inbox disable feature

### Technical Performance

- **Message delivery time**: Real-time latency for message delivery
- **Query performance**: Database query response times
- **Uptime**: System availability for messaging features
- **Error rates**: Message send/receive failure rates
- **Pagination performance**: Load time for conversation and message lists

## Out of Scope

- Group conversations
- File uploads
- Message search
- Read receipts
- Reactions
- Message editing

## Future Enhancements

- Read receipts (opt-in)
- Typing indicators
- File attachments
- Voice messages
- Block user functionality
- Conversation archiving (different from deletion, keeps for later)
- Undo deletion (time-limited window to restore deleted messages/conversations)
- Export conversation history before deletion
- Bulk message selection and deletion
- Auto-delete old messages after X days (user configurable)
- Delete for everyone (hard delete, removes from both sides)
