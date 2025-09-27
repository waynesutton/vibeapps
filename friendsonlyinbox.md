# Friends only inbox PRD

## Overview

This PRD defines one to one direct messages that unlock only when two users follow each other. The feature mirrors the feel of Twitter mutual follows messaging, scoped to the existing VibeApps stack with Clerk auth, Convex backend, alerts notifications, and planned Resend daily emails.

## Why this matters

Mutual follow is a clear consent gate that reduces spam. It keeps messages relevant and expected while reusing existing follow and alert primitives already in the codebase.

## Scope

- One to one messages only
- Message button shows only when both sides follow each other
- Inbox entry point visible on profile near Follow or Message
- Alerts fire on each new incoming message for the recipient
- Alerts link to the inbox conversation
- Daily email rollup includes message notifications after Resend integration
- No group messages
- No file uploads in v1
- Real-time sync via Convex queries; no client-only messages
- Only authenticated users can access their own conversations and messages

## Existing building blocks

- Follows table and indexes support fast direction checks
- Alerts system supports user notifications and linking to detail views
- User profiles and Follow button exist in `UserProfilePage.tsx`
- Resend PRD covers message notification email types and limits

## User stories

- As a logged in user I see a Message button on a profile only if we follow each other
- As a logged in user I can click Message to open or create a private conversation with that user
- As a recipient I get a new alert when someone sends me a message
- As a recipient I can click the alert and land in my inbox on that conversation
- As a user I can open my inbox from my profile to browse conversation threads with people who have messaged me

## UI changes

Profile page `UserProfilePage.tsx` header actions

- Show Message button when mutual follow is true for viewer and profile owner
- Place an Inbox button next to the Follow or Message button that routes to `/inbox`

Inbox page

- New route `/inbox`
- Left column shows conversations sorted by latest activity time
- Right pane shows selected conversation messages with a simple composer
- Mobile stacks into a single column with a conversation list then thread view

Message reporting

- In the thread view, each message bubble has an overflow menu with Report
- Report opens a modal to select or enter a reason, then submits

Notifications

- Alerts entry created on each new message for the recipient
- Alerts item links to `/inbox?c=<conversationId>`

## Data model

Tables are purpose built for direct messages with two participants only. Use a normalized pair to avoid array equality issues and to index correctly.

New tables in `convex/schema.ts`

```ts
// Direct message conversations between two users
dmConversations: defineTable({
  userAId: v.id("users"), // lower lexical id of the two participants
  userBId: v.id("users"), // higher lexical id of the two participants
  lastMessageId: v.optional(v.id("dmMessages")),
  lastActivityTime: v.number(),
  isActive: v.boolean(),
})
  .index("by_pair", ["userAId", "userBId"]) // unique pair
  .index("by_userA", ["userAId"]) // list user conversations
  .index("by_userB", ["userBId"]),

// Messages within a conversation
dmMessages: defineTable({
  conversationId: v.id("dmConversations"),
  senderId: v.id("users"),
  content: v.string(),
})
  .index("by_conversation_time", ["conversationId", "_creationTime"]),

// Read state per user per conversation
dmReads: defineTable({
  conversationId: v.id("dmConversations"),
  userId: v.id("users"),
  lastReadTime: v.number(),
  lastReadMessageId: v.optional(v.id("dmMessages")),
})
  .index("by_conversation_user", ["conversationId", "userId"])
  .index("by_user", ["userId"]),
```

DM abuse reports in `convex/schema.ts`

```ts
dmReports: defineTable({
  conversationId: v.id("dmConversations"),
  messageId: v.id("dmMessages"),
  reporterUserId: v.id("users"),
  reportedUserId: v.id("users"),
  reason: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("reviewed"),
    v.literal("action_taken"),
  ),
})
  .index("by_status", ["status"])
  .index("by_conversation", ["conversationId"])
  .index("by_reporter", ["reporterUserId"])
  .index("by_reported", ["reportedUserId"]),
```

Alerts type update in `convex/alerts.ts`

```ts
type: v.union(
  v.literal("vote"),
  v.literal("comment"),
  v.literal("rating"),
  v.literal("follow"),
  v.literal("judged"),
  v.literal("bookmark"),
  v.literal("report"),
  v.literal("message"), // new
  v.literal("dm_report"), // new for admin notifications on DM reports
),
```

Optional DM alert linkage fields in `convex/alerts.ts`

```ts
dmConversationId: v.optional(v.id("dmConversations")),
dmMessageId: v.optional(v.id("dmMessages")),
```

## Convex server functions

Mutual follow check `convex/follows.ts`

```ts
export const isMutualFollow = query({
  args: { otherUserId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) return false;

    const aFollowsB = await ctx.db
      .query("follows")
      .withIndex("by_followerId_followingId", (q) =>
        q.eq("followerId", user._id).eq("followingId", args.otherUserId),
      )
      .unique();

    const bFollowsA = await ctx.db
      .query("follows")
      .withIndex("by_followerId_followingId", (q) =>
        q.eq("followerId", args.otherUserId).eq("followingId", user._id),
      )
      .unique();

    return !!aFollowsB && !!bFollowsA;
  },
});
```

Create or fetch conversation `convex/dm.ts`

```ts
export const upsertConversation = mutation({
  args: { otherUserId: v.id("users") },
  returns: v.id("dmConversations"),
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) throw new Error("Not authenticated");

    // gate on mutual follow
    const mutual = await ctx.runQuery(internal.follows.isMutualFollow, {
      otherUserId: args.otherUserId,
    });
    if (!mutual) throw new Error("Messaging requires mutual follow");

    const [aId, bId] =
      String(user._id) < String(args.otherUserId)
        ? [user._id, args.otherUserId]
        : [args.otherUserId, user._id];

    const existing = await ctx.db
      .query("dmConversations")
      .withIndex("by_pair", (q) => q.eq("userAId", aId).eq("userBId", bId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("dmConversations", {
      userAId: aId,
      userBId: bId,
      lastActivityTime: Date.now(),
      isActive: true,
    });
  },
});
```

Send message `convex/dm.ts`

```ts
export const sendMessage = mutation({
  args: { conversationId: v.id("dmConversations"), content: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) throw new Error("Not authenticated");

    const convo = await ctx.db.get(args.conversationId);
    if (!convo) throw new Error("Conversation not found");
    const isParticipant =
      user._id === convo.userAId || user._id === convo.userBId;
    if (!isParticipant) throw new Error("Not a participant");

    const msgId = await ctx.db.insert("dmMessages", {
      conversationId: convo._id,
      senderId: user._id,
      content: args.content.trim(),
    });

    await ctx.db.patch(convo._id, {
      lastMessageId: msgId,
      lastActivityTime: Date.now(),
    });

    const recipientId =
      user._id === convo.userAId ? convo.userBId : convo.userAId;

    // alert for recipient
    await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
      recipientUserId: recipientId,
      actorUserId: user._id,
      type: "message",
    });

    return null;
  },
});
```

Report a message `convex/dm.ts`

```ts
export const reportMessage = mutation({
  args: {
    conversationId: v.id("dmConversations"),
    messageId: v.id("dmMessages"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) throw new Error("Not authenticated");

    const convo = await ctx.db.get(args.conversationId);
    if (!convo) throw new Error("Conversation not found");
    const isParticipant =
      user._id === convo.userAId || user._id === convo.userBId;
    if (!isParticipant) throw new Error("Not a participant");

    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.conversationId !== convo._id)
      throw new Error("Message not in conversation");

    const reportedUserId = msg.senderId;

    await ctx.db.insert("dmReports", {
      conversationId: convo._id,
      messageId: msg._id,
      reporterUserId: user._id,
      reportedUserId,
      reason: args.reason.slice(0, 500),
      status: "pending",
    });

    // Notify admins
    const adminUserIds = await getAdminUserIds(ctx);
    for (const adminId of adminUserIds) {
      await ctx.db.insert("alerts", {
        recipientUserId: adminId,
        actorUserId: user._id,
        type: "dm_report",
        dmConversationId: convo._id as any,
        dmMessageId: msg._id as any,
        isRead: false,
      });
    }

    return null;
  },
});
```

List conversations for viewer `convex/dm.ts`

```ts
export const listConversations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("dmConversations"),
      otherUserId: v.id("users"),
      lastActivityTime: v.number(),
      lastMessagePreview: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const { user } = await requireAuth(ctx);
    if (!user) return [];

    const a = await ctx.db
      .query("dmConversations")
      .withIndex("by_userA", (q) => q.eq("userAId", user._id))
      .collect();
    const b = await ctx.db
      .query("dmConversations")
      .withIndex("by_userB", (q) => q.eq("userBId", user._id))
      .collect();
    const all = [...a, ...b];
    // map to other user and preview content by lastMessageId
    const result = [] as Array<any>;
    for (const c of all) {
      let preview: string | undefined;
      if (c.lastMessageId) {
        const m = await ctx.db.get(c.lastMessageId);
        preview = m?.content;
      }
      result.push({
        _id: c._id,
        otherUserId: user._id === c.userAId ? c.userBId : c.userAId,
        lastActivityTime: c.lastActivityTime,
        lastMessagePreview: preview,
      });
    }
    return result.sort((x, y) => y.lastActivityTime - x.lastActivityTime);
  },
});
```

List messages for a conversation `convex/dm.ts`

```ts
export const listMessages = query({
  args: {
    conversationId: v.id("dmConversations"),
    limit: v.number(),
    cursor: v.union(v.null(), v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: null };
    const convo = await ctx.db.get(args.conversationId);
    if (!convo) return { page: [], isDone: true, continueCursor: null };
    const isParticipant =
      user._id === convo.userAId || user._id === convo.userBId;
    if (!isParticipant) return { page: [], isDone: true, continueCursor: null };

    return await ctx.db
      .query("dmMessages")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate({ numItems: args.limit, cursor: args.cursor });
  },
});
```

Mark read `convex/dm.ts`

```ts
export const markConversationRead = mutation({
  args: { conversationId: v.id("dmConversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireAuth(ctx);
    if (!user) return null;
    const now = Date.now();
    const existing = await ctx.db
      .query("dmReads")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();
    if (existing) await ctx.db.patch(existing._id, { lastReadTime: now });
    else
      await ctx.db.insert("dmReads", {
        conversationId: args.conversationId,
        userId: user._id,
        lastReadTime: now,
      });
    return null;
  },
});
```

## Authorization and privacy

- Only allow upsertConversation when mutual follow is true
- Only allow sendMessage for participants in the conversation
- Only list conversations for the current user
- Only list messages for conversations where the viewer is a participant
- All DM queries and mutations require authentication via `requireAuth`
- No server function returns messages or conversations for non participants
- Use Convex reactivity on queries so message lists and conversations auto sync

## Notifications and daily emails

Runtime notifications

- On sendMessage create an alert of type message for the recipient
- Alerts are visible in the existing notifications list and page

Daily emails

- Add message notifications into the daily engagement email as described in `addresend.md`
- Respect `emailSettings.messageNotifications` preference
- Rate limit to five message emails per recipient per day in the mailer layer

Admin emails

- Include DM report counts in the daily admin email (pending, reviewed)
- Optional immediate email to admins on each DM report using existing email pipeline

## Rate limits and abuse control

- Limit sendMessage to fifty messages per hour per conversation
- Future setting to mute a conversation or block a user
- Limit `reportMessage` submissions to ten per day per reporter

## Rollout plan

- Add schema and types
- Add server functions and unit tests
- Gate the Message button on mutual follow
- Ship inbox route and basic UI
- Add alert type message and wire the notification link to the inbox
- Hook message events into daily email when Resend integration lands

## Success metrics

- Percentage of mutual pairs that start a conversation
- Unread message count over time trending down after alerts
- Delivery of alerts and time to open the conversation

## Out of scope

- Group conversations
- File uploads and images
- Search across messages
- Reactions and typing indicators
