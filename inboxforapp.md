# Inbox & Messaging System PRD - VibeApps

## Overview

This document outlines the implementation of a real-time messaging and notification system for VibeApps, similar to Facebook Messenger. The system will allow logged-in users to send direct messages to each other, receive real-time notifications, and manage their messaging preferences from their profile page.

## Current System Analysis

### Existing Infrastructure

- **Authentication**: Clerk Auth with user sync to Convex database
- **Real-time Database**: Convex with live reactivity
- **User Management**: Comprehensive user system with profiles, follows, and settings
- **Navigation**: React Router with profile pages at `/{username}`
- **UI Components**: Custom components with Tailwind CSS and shadcn/ui patterns

### User Profile Integration

- Profile pages at `/{username}` with tab system (votes, ratings, comments, bookmarks, followers, following)
- Settings management at `/user-settings`
- Mini dashboard with stats and activity counts
- Real-time queries with automatic updates

## Feature Requirements

### Core Messaging Features

#### 1. Direct Messages

- **One-on-one conversations** between authenticated users
- **Real-time message delivery** using Convex reactivity
- **Message history** with pagination for older messages
- **Message status indicators**: sent, delivered, read
- **Text-only messages** with @username mention support (no file attachments or rich formatting)
- **Message editing**: Users can edit their own sent messages within 24 hours
- **Message deletion**: Users can delete their own sent messages at any time
- **@Username mentions** with autocomplete and notification integration
- **Message search** within conversations

#### 2. Notification System

- **Real-time notifications** for new messages (appears in header dropdown and notifications page)
- **Badge counters** showing unread message count in navigation
- **Desktop notifications** (browser permission required)
- **Email notifications** for new messages (separate from daily engagement emails)
- **Notification grouping** by conversation
- **Mark as read/unread** functionality
- **@Mention notifications** integrated with existing mention system

#### 3. Privacy & Blocking Features

- **Message blocking**: Block users from sending messages
- **Privacy settings**: Control who can message you (everyone, followers only, nobody)
- **Report messaging**: Report inappropriate messages to admins (triggers immediate admin email notifications)
- **Conversation deletion**: Delete entire conversations
- **Spam prevention**: Rate limiting to prevent message abuse

#### 4. Rate Limiting & Spam Prevention

- **New conversation limit**: Users can start maximum 10 new conversations per 30 minutes
- **Message frequency limit**: Maximum 50 messages per conversation per hour
- **Mention limit**: Maximum 5 @mentions per message
- **Blocked user prevention**: Cannot message users who have blocked you
- **Report rate limit**: Maximum 5 message reports per user per day

### Inbox Management (Profile Integration)

#### 5. Inbox Interface

- **New tab in user profile**: "Inbox" tab alongside existing tabs
- **Conversation list**: Shows all conversations with preview of last message
- **Unread indicators**: Visual badges for unread conversations
- **Search conversations**: Find specific conversations or messages
- **Conversation sorting**: By last activity, unread status, or alphabetical

#### 6. Settings & Preferences

- **Privacy controls**: Who can message you
- **Notification preferences**: Email, desktop, mobile push
- **Blocked users management**: View and unblock users
- **Message settings**: Auto-delete old messages, read receipts
- **Do not disturb**: Temporary message blocking

## Database Schema Design

### New Tables Required

```typescript
// convex/schema.ts additions

export default defineSchema({
  // ... existing tables ...

  // Direct message conversations between users
  conversations: defineTable({
    // Array of exactly 2 user IDs (for direct messages)
    participantIds: v.array(v.id("users")), // Always length 2 for DMs
    lastMessageId: v.optional(v.id("messages")), // Reference to most recent message
    lastActivityTime: v.number(), // Timestamp for sorting conversations
    isActive: v.boolean(), // False if conversation is deleted by all participants
  })
    .index("by_participants", ["participantIds"]) // Find conversation between two users
    .index("by_participant", ["participantIds"]) // Find all conversations for a user
    .index("by_lastActivity", ["lastActivityTime"]), // Sort by recent activity

  // Individual messages within conversations
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(), // Message text content (text only, max 2000 characters)
    messageType: v.union(
      v.literal("text"), // Only text messages supported
      v.literal("system"), // For system messages like "User blocked"
    ),
    isDeleted: v.boolean(), // Soft delete for sender
    editedAt: v.optional(v.number()), // If message was edited (within 24 hours)
    originalContent: v.optional(v.string()), // Original content before editing
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_time", ["conversationId", "_creationTime"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["conversationId", "isDeleted"],
    }),

  // Track read status for each user in conversations
  messageReads: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadMessageId: v.optional(v.id("messages")), // Last message this user has read
    lastReadTime: v.number(), // When they last read messages
  })
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),

  // User messaging preferences and privacy settings
  messageSettings: defineTable({
    userId: v.id("users"),
    whoCanMessage: v.union(
      v.literal("everyone"),
      v.literal("followers"),
      v.literal("nobody"),
    ),
    emailNotifications: v.boolean(),
    desktopNotifications: v.boolean(),
    readReceipts: v.boolean(), // Whether to send read receipts
    doNotDisturb: v.boolean(), // Temporary message blocking
    doNotDisturbUntil: v.optional(v.number()), // Auto-disable DND timestamp
  }).index("by_user", ["userId"]),

  // Blocked users for messaging
  messageBlocks: defineTable({
    blockerId: v.id("users"), // User who blocked
    blockedId: v.id("users"), // User who was blocked
    reason: v.optional(v.string()), // Optional reason for blocking
  })
    .index("by_blocker_blocked", ["blockerId", "blockedId"])
    .index("by_blocker", ["blockerId"])
    .index("by_blocked", ["blockedId"]),

  // Reports for inappropriate messages (admin moderation)
  messageReports: defineTable({
    reporterId: v.id("users"),
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("dismissed"),
      v.literal("action_taken"),
    ),
    adminNotes: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_reporter", ["reporterId"])
    .index("by_message", ["messageId"]),

  // Rate limiting for messaging
  messagingRateLimit: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("new_conversation"), // Track new conversations started
      v.literal("message_send"), // Track messages sent per conversation
      v.literal("message_report"), // Track message reports
    ),
    conversationId: v.optional(v.id("conversations")), // For per-conversation limits
    windowStart: v.number(), // Start of the rate limit window
    count: v.number(), // Current count in this window
  })
    .index("by_user_type_window", ["userId", "type", "windowStart"])
    .index("by_user_conversation_type", ["userId", "conversationId", "type"]),
});
```

## Backend Functions (Convex)

### File Structure

```
convex/
├── messages.ts          # Core messaging functions
├── messageSettings.ts   # User preferences and privacy
├── messageReports.ts    # Admin moderation functions
└── messageNotifications.ts # Notification system
```

### Core Functions Overview

#### `convex/messages.ts`

```typescript
// Public Queries
export const getConversations = query(...) // Get user's conversation list
export const getMessages = query(...) // Get messages in conversation with pagination
export const getUnreadCount = query(...) // Get total unread message count
export const searchMessages = query(...) // Search within conversations

// Public Mutations
export const sendMessage = mutation(...) // Send a new message (with rate limiting and @mention support)
export const editMessage = mutation(...) // Edit message (sender only, within 24 hours)
export const deleteMessage = mutation(...) // Delete message (sender only)
export const markAsRead = mutation(...) // Mark messages as read
export const deleteConversation = mutation(...) // Delete entire conversation
export const reportMessage = mutation(...) // Report inappropriate message to admins

// Internal Functions
export const createConversation = internalMutation(...) // Create new conversation
export const updateLastActivity = internalMutation(...) // Update conversation activity
```

#### `convex/messageSettings.ts`

```typescript
// Public Queries
export const getMessageSettings = query(...) // Get user's messaging preferences
export const getBlockedUsers = query(...) // Get list of blocked users
export const canUserMessage = query(...) // Check if user A can message user B

// Public Mutations
export const updateMessageSettings = mutation(...) // Update messaging preferences
export const blockUser = mutation(...) // Block a user
export const unblockUser = mutation(...) // Unblock a user

// Internal Functions
export const checkRateLimit = internalQuery(...) // Check if user can send messages/start conversations
export const updateRateLimit = internalMutation(...) // Update rate limit counters
```

#### `convex/messageReports.ts`

```typescript
// Public Mutations
export const reportMessage = mutation(...) // Report inappropriate message (with rate limiting)

// Admin Queries/Mutations (require admin role)
export const getMessageReports = query(...) // Get pending reports
export const reviewReport = mutation(...) // Mark report as reviewed
export const takeActionOnReport = mutation(...) // Take action (delete, ban, etc.)

// Internal Functions
export const sendReportNotificationEmails = internalAction(...) // Send immediate admin emails
```

#### `convex/messageNotifications.ts`

```typescript
// Public Queries
export const getMessageNotifications = query(...) // Get user's message notifications
export const getUnreadMessageCount = query(...) // Get unread message notification count

// Internal Functions
export const createMessageNotification = internalMutation(...) // Create notification for new message
export const createMentionNotification = internalMutation(...) // Create notification for @mention in message
export const sendMessageEmailNotification = internalAction(...) // Send email notification for new messages (separate from daily digest)
```

## Frontend Implementation

### User Profile Integration

#### Inbox Tab Addition

Update `src/pages/UserProfilePage.tsx`:

```typescript
// Add inbox to mini dashboard (for own profile only)
{isOwnProfile && (
  <button
    onClick={() => handleMiniDashboardClick("inbox")}
    className="flex flex-col items-center p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
    <Mail className="w-6 h-6 mb-1 text-gray-600" />
    <span className="text-xl font-bold text-[#292929]">{unreadMessageCount ?? 0}</span>
    <span className="text-xs text-gray-500 mt-0.5">Messages</span>
  </button>
)}

// Add inbox tab to navigation
{isOwnProfile && (
  <button
    onClick={() => setActiveTab("inbox")}
    className={`py-2 px-4 text-sm font-medium focus:outline-none flex items-center ${
      activeTab === "inbox"
        ? "border-b-2 border-[#292929] text-[#292929]"
        : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }`}>
    <Mail className="w-4 h-4 mr-1" />
    Inbox {unreadMessageCount > 0 && `(${unreadMessageCount})`}
  </button>
)}
```

### New Components Required

#### 1. Message Components

```
src/components/messages/
├── ConversationList.tsx      # List of conversations
├── ConversationView.tsx      # Individual conversation interface
├── MessageBubble.tsx         # Individual message component with edit/delete options
├── MessageInput.tsx          # Compose new message with @mention autocomplete
├── MessageEditForm.tsx       # Edit message form (24-hour window)
├── MessageSearch.tsx         # Search within conversations
└── ReportMessageModal.tsx    # Report inappropriate message modal
```

#### 2. Settings Components

```
src/components/messages/settings/
├── MessagePrivacySettings.tsx   # Who can message you controls
├── NotificationSettings.tsx     # Email/desktop notification preferences
├── BlockedUsersList.tsx         # Manage blocked users
└── MessagePreferences.tsx       # General messaging settings
```

#### 3. Navigation Updates

Update header/layout to include:

- **Message notification badge** in navigation
- **Quick message dropdown** for recent conversations
- **Global unread counter** in user menu

### Key Frontend Features

#### Real-time Updates

```typescript
// Real-time conversation list
const conversations = useQuery(
  api.messages.getConversations,
  isSignedIn ? {} : "skip",
);

// Real-time messages in conversation
const messages = useQuery(
  api.messages.getMessages,
  selectedConversationId ? { conversationId: selectedConversationId } : "skip",
);

// Real-time unread count for badge
const unreadCount = useQuery(
  api.messages.getUnreadCount,
  isSignedIn ? {} : "skip",
);

// Integration with existing notification system
const messageNotifications = useQuery(
  api.alerts.listForPage,
  isSignedIn ? {} : "skip",
);
```

#### Message Privacy Enforcement & Rate Limiting

```typescript
// Check if user can send message before showing compose UI
const canMessage = useQuery(api.messageSettings.canUserMessage,
  targetUserId ? { targetUserId } : "skip"
);

// Check rate limits for new conversations and message sending
const rateLimitStatus = useQuery(api.messageSettings.checkRateLimit,
  { type: "new_conversation" }
);

// Show appropriate message based on privacy settings and rate limits
if (canMessage === false) {
  return <div>This user has restricted who can message them.</div>;
}

if (rateLimitStatus?.exceeded) {
  return <div>You've reached the limit for new conversations. Please try again in {rateLimitStatus.waitTime} minutes.</div>;
}
```

#### @Mention Integration

```typescript
// Use existing MentionTextarea component from src/components/ui/MentionTextarea.tsx
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

## Privacy & Security Features

### Message Privacy Controls

1. **Everyone**: Any authenticated user can send messages
2. **Followers Only**: Only users you follow can message you
3. **Nobody**: No one can send new messages (existing conversations remain)

### Blocking System

- **Immediate effect**: Blocked users cannot send new messages
- **Existing conversations**: Previous messages remain visible but new messages are blocked
- **Mutual blocking**: If User A blocks User B, their conversation becomes read-only for both
- **Unblocking**: Restores ability to send messages

### Content Moderation & Admin Integration

- **User reporting**: Report inappropriate messages to admins with rate limiting (5 reports per day)
- **Immediate admin emails**: Admins receive instant email notifications for message reports (via adminalerrtemails.md system)
- **Admin review**: Admins can review reported messages in admin dashboard
- **Integration with existing alerts**: Message reports appear in admin notification system
- **Message deletion**: Admins can delete messages and ban users for violations
- **User blocking**: Automatic prevention of messages from blocked users

## Implementation Phases

### Phase 1: Core Messaging (Week 1-2)

- [ ] Database schema implementation with rate limiting tables
- [ ] Basic send/receive message functions with text-only support
- [ ] Message edit/delete functionality (24-hour edit window)
- [ ] Conversation list and message view components
- [ ] Integration with user profile inbox tab
- [ ] Real-time message updates
- [ ] @Mention autocomplete integration using existing MentionTextarea

### Phase 2: Privacy & Settings (Week 3)

- [ ] Rate limiting implementation (10 new conversations per 30 minutes, 50 messages per hour per conversation)
- [ ] Message privacy controls (everyone/followers/nobody)
- [ ] User blocking functionality
- [ ] Message settings interface in profile
- [ ] Read receipts and message status

### Phase 3: Advanced Features (Week 4)

- [ ] Message search functionality within conversations
- [ ] Desktop notifications for new messages
- [ ] Email notification system for new messages (separate from daily digest, using existing Resend infrastructure)
- [ ] Message reporting system with immediate admin email notifications
- [ ] Integration with existing notification system (alerts appear in header dropdown and notifications page)

### Phase 4: Polish & Optimization (Week 5)

- [ ] Performance optimization for large conversation lists
- [ ] Message pagination and infinite scroll
- [ ] Advanced notification settings
- [ ] Mobile responsiveness optimization
- [ ] Comprehensive testing and bug fixes

## Technical Considerations

### Performance Optimization

- **Message pagination**: Load messages in chunks of 50
- **Conversation virtualization**: Virtual scrolling for large conversation lists
- **Debounced typing indicators**: Real-time typing status with debouncing
- **Optimistic updates**: Immediate UI updates with error handling

### Real-time Features

- **Convex reactivity**: Automatic UI updates for new messages
- **Presence indicators**: Show online/offline status (optional)
- **Typing indicators**: Show when someone is typing
- **Message delivery status**: Sent, delivered, read indicators

### Data Management

- **Message retention**: Auto-delete messages older than 1 year (configurable)
- **Text message limits**: 2000 characters per message (no file attachments)
- **Conversation limits**: Max 1000 active conversations per user
- **Rate limiting**: Comprehensive spam prevention
  - Max 10 new conversations per 30 minutes
  - Max 50 messages per conversation per hour
  - Max 5 @mentions per message
  - Max 5 message reports per day per user

## Admin Dashboard Integration

### Message Moderation Panel

Add to existing admin dashboard at `/admin`:

```typescript
// Add to AdminDashboard.tsx navigation under Users tab
<Tabs.Trigger
  value="message-reports"
  className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#292929] data-[state=active]:border-b-2 data-[state=active]:border-[#292929] focus:outline-none focus:z-10 whitespace-nowrap"
>
  Message Reports
</Tabs.Trigger>

// New component: MessageReportsPanel.tsx
export function MessageReportsPanel() {
  const reports = useQuery(api.messageReports.getMessageReports);
  // Display reported messages with admin actions
  // Integration with existing ReportManagement.tsx patterns
  // Shows message content, reporter info, and moderation actions
}
```

### Admin Actions

- **Review reported messages**: View message content, conversation context, and reporter information
- **Delete messages**: Remove inappropriate content from conversations
- **Ban users from messaging**: Temporary or permanent messaging bans (integrate with existing user moderation)
- **Block conversations**: Prevent further messages between specific users
- **Export conversation data**: For legal compliance or investigation
- **Email notifications**: Immediate admin email alerts for all message reports (using adminalerrtemails.md system)

## Migration & Deployment

### Database Migration

1. **Schema deployment**: Add new tables to Convex schema
2. **Default settings**: Create default message settings for existing users
3. **Index creation**: Ensure all required indexes are built
4. **Data validation**: Verify schema constraints and relationships

### Feature Rollout

1. **Staged deployment**: Enable for admin users first
2. **Beta testing**: Limited user group testing
3. **Gradual rollout**: Percentage-based feature flags
4. **Full deployment**: All users with monitoring

### Monitoring & Analytics

- **Message volume**: Track messages sent/received per day
- **User adoption**: Percentage of users using messaging
- **Performance metrics**: Query response times and real-time latency
- **Abuse detection**: Monitor reported messages and blocking patterns

## Future Enhancements

### Advanced Messaging Features

- **Group messages**: Multi-user conversations (future phase)
- **Message reactions**: Emoji reactions to messages
- **Voice messages**: Audio message recording and playback
- **Video calls**: Integration with WebRTC for video chat
- **Message scheduling**: Send messages at specific times

### AI Integration

- **Smart replies**: Suggested responses using AI
- **Translation**: Auto-translate messages between languages
- **Content moderation**: AI-powered inappropriate content detection
- **Chatbots**: AI assistants for common questions

### Mobile App Integration

- **Push notifications**: Native mobile push notifications
- **Offline support**: Cache messages for offline viewing
- **Native file picker**: Camera and gallery integration
- **Background sync**: Sync messages when app is closed

## Success Metrics

### User Engagement

- **Daily active messagers**: Users sending/receiving messages daily
- **Messages per user**: Average messages sent per active user
- **Conversation length**: Average number of messages per conversation
- **Return users**: Users returning to messaging feature

### Privacy & Safety

- **Blocking usage**: Percentage of users using blocking features
- **Report response time**: Average time to resolve message reports
- **Privacy setting adoption**: Usage of different privacy levels
- **Abuse prevention**: Reduction in inappropriate message reports

### Technical Performance

- **Message delivery time**: Real-time latency for message delivery
- **Query performance**: Database query response times
- **Uptime**: System availability for messaging features
- **Error rates**: Message send/receive failure rates

---

This comprehensive PRD provides a complete roadmap for implementing a Facebook Messenger-like messaging system within the existing VibeApps platform, leveraging Convex's real-time capabilities and integrating seamlessly with the current user profile and navigation structure.
