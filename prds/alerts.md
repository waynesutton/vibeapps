# Alerts notifications PRD

## Overview

This PRD defines an in product alerts notifications system that integrates with existing Convex flows and the mentions and Resend email PRDs. It adds a header alerts icon with a dropdown, unread state with a black dot, a View all page, and backend primitives to record and fetch alerts without introducing TypeScript errors. All reads use indexes and the new Convex function syntax.

## Goals and scope

- Provide a lightweight in app alerts experience that matches the profile dropdown size and style. The alerts dropdown appears to the left side of the profile icon.
- Show an unread black dot on the alerts icon when there are unread alerts.
- Dropdown shows the five most recent alerts, with a View all button at the bottom.
- Clicking View all navigates to the notifications page and clears the unread state.
- Notifications page shows the most recent twenty alerts for the logged in user.
- Alert types included in v1
  - A user vibes votes on your app with links to the actor and the app
  - A user comments on your app with links to the actor and the app
  - A user rates your app with links to the actor and the app
  - A user follows you with a link to the actor
  - A judge completes judging of your app with message text only no judge identity and no judge link
- Logged out users see a site styled popup prompting log in when visiting the notifications page.
- Designed to work with the existing mentions system and future Resend emails fanout without blocking UI.

## Chronological plan

1. Data model
   - Add `alerts` table and indexes in `convex/schema.ts`.
   - Add `appSettings` key `alertsEnabled` optional for kill switch reuse if desired later.
2. Backend API
   - Create `convex/alerts.ts` with queries and mutations
     - `listRecentForDropdown` last five
     - `listForPage` last twenty paginated later
     - `getUnreadCount` or `hasUnread` for icon dot
     - `markAllAsRead` for the current user
     - `createAlert` internalMutation used by other modules
3. Integration hooks in existing flows
   - After successful actions add a non blocking scheduler call to `internal.alerts.createAlert`
     - Votes in `convex/stories.ts` vote mutation
     - Ratings in `convex/stories.ts` or `convex/storyRatings.ts` rate mutation
     - Comments in `convex/comments.ts` add mutation
     - Follows in `convex/follows.ts`
     - Judging completion in `convex/judgeScores.ts` or `convex/judgingGroupSubmissions.ts` when marked completed
   - Skip generating alerts when actor equals recipient
4. UI components
   - Add alerts bell icon in `src/components/Layout.tsx` next to the profile menu aligned left of the profile avatar
   - Create `src/components/AlertsDropdown.tsx` matching profile dropdown size and style
   - Add route and page `src/pages/NotificationsPage.tsx` that lists twenty recent alerts for logged in users and shows a login prompt modal for logged out users
5. Read state logic
   - When the dropdown opens do not auto mark as read
   - When the View all button is clicked call `markAllAsRead`
   - Optionally mark a single alert as read on click to navigate
6. Future email fanout optional
   - The PRD defines optional hooks to Resend actions. Implementation will follow `addresend.md` later.

## Data model

Add a new table in `convex/schema.ts` following Convex guidelines. Index on recipient and read state for efficient queries. Keep message content minimal and compute display strings in queries where possible.

```ts
// convex/schema.ts additions
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ...existing tables...

  alerts: defineTable({
    recipientUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")), // null for system events like judged
    type: v.union(
      v.literal("vote"),
      v.literal("comment"),
      v.literal("rating"),
      v.literal("follow"),
      v.literal("judged"),
    ),
    storyId: v.optional(v.id("stories")),
    commentId: v.optional(v.id("comments")),
    ratingValue: v.optional(v.number()),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient", ["recipientUserId"]) // paginate and order by _creationTime desc
    .index("by_recipient_and_isRead", ["recipientUserId", "isRead"]),
});
```

Notes

- Use `_creationTime` default ordering to fetch most recent items.
- `isRead` enables efficient unread checks and updates. `readAt` tracks when the alert was cleared.

## Backend API `convex/alerts.ts`

Implement using the new function syntax and validators. All functions return minimal shapes safe for UI. Do not include large embedded docs.

```ts
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./utils";

export const listRecentForDropdown = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("alerts"),
      _creationTime: v.number(),
      type: v.union(
        v.literal("vote"),
        v.literal("comment"),
        v.literal("rating"),
        v.literal("follow"),
        v.literal("judged"),
      ),
      isRead: v.boolean(),
      actorUserId: v.optional(v.id("users")),
      storyId: v.optional(v.id("stories")),
      commentId: v.optional(v.id("comments")),
      ratingValue: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return [];
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_recipient", (q) => q.eq("recipientUserId", me._id))
      .order("desc")
      .take(5);
    return alerts;
  },
});

export const listForPage = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("alerts"),
      _creationTime: v.number(),
      type: v.union(
        v.literal("vote"),
        v.literal("comment"),
        v.literal("rating"),
        v.literal("follow"),
        v.literal("judged"),
      ),
      isRead: v.boolean(),
      actorUserId: v.optional(v.id("users")),
      storyId: v.optional(v.id("stories")),
      commentId: v.optional(v.id("comments")),
      ratingValue: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return [];
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_recipient", (q) => q.eq("recipientUserId", me._id))
      .order("desc")
      .take(20);
    return alerts;
  },
});

export const hasUnread = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return false;
    const count = await ctx.db
      .query("alerts")
      .withIndex("by_recipient_and_isRead", (q) =>
        q.eq("recipientUserId", me._id).eq("isRead", false),
      )
      .take(1);
    return count.length > 0;
  },
});

export const markAllAsRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { user: me } = await requireAuth(ctx);
    if (!me) return null;
    const toUpdate = await ctx.db
      .query("alerts")
      .withIndex("by_recipient_and_isRead", (q) =>
        q.eq("recipientUserId", me._id).eq("isRead", false),
      )
      .collect();
    for (const a of toUpdate) {
      await ctx.db.patch(a._id, { isRead: true, readAt: Date.now() });
    }
    return null;
  },
});

export const createAlert = internalMutation({
  args: {
    recipientUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    type: v.union(
      v.literal("vote"),
      v.literal("comment"),
      v.literal("rating"),
      v.literal("follow"),
      v.literal("judged"),
    ),
    storyId: v.optional(v.id("stories")),
    commentId: v.optional(v.id("comments")),
    ratingValue: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("alerts", {
      recipientUserId: args.recipientUserId,
      actorUserId: args.actorUserId,
      type: args.type,
      storyId: args.storyId,
      commentId: args.commentId,
      ratingValue: args.ratingValue,
      isRead: false,
    });
    return null;
  },
});
```

## Integration points

Hook into existing mutations after successful writes. Use non blocking scheduling where appropriate to avoid slowing down user writes.

- Votes `convex/stories.ts` vote mutation
  - After recording a vote for a story insert alert for `story.userId` if actor is not owner
- Ratings `convex/storyRatings.ts` or `convex/stories.ts` rate mutation
  - After recording a rating insert alert with `ratingValue`
- Comments `convex/comments.ts` add mutation
  - After inserting a comment insert alert for the story owner and include `commentId`
- Follows `convex/follows.ts`
  - After follow creation insert alert for `targetUserId`
- Judging completion `convex/judgeScores.ts` or `convex/judgingGroupSubmissions.ts`
  - When a submission transitions to completed insert a `judged` alert for the story owner with no judge identity and no judge link

Recommended pattern

```ts
await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
  recipientUserId,
  actorUserId, // omit for judged
  type: "comment",
  storyId,
  commentId,
});
```

## UI specifications

Header icon and dot

- Add an alerts bell icon in `src/components/Layout.tsx` positioned to the left of the profile icon
- Show a small black dot when `hasUnread` is true fetched with a reactive Convex query

Dropdown

- Component `src/components/AlertsDropdown.tsx`
- Width, padding, border, shadow, and radius match the profile dropdown for visual consistency
- List items show most recent five alerts with compact rows
- Row rendering rules
  - vote
    - “{actorName} vibed your app” with links to actor profile and the app
  - comment
    - “{actorName} commented on {appTitle}” with links to actor profile and the app `StoryDetail.tsx`
  - rating
    - “{actorName} rated your app {N} stars on {appTitle}” with links to actor profile and the app
  - follow
    - “{actorName} started following you” with link to actor profile
  - judged
    - “Your app has been judged” plain text no judge identity and no judge link
- Footer contains a full width View all button. On click
  - call `markAllAsRead`
  - navigate to `/notifications`

Notifications page `src/pages/NotificationsPage.tsx`

- Logged in users
  - Show twenty most recent alerts via `listForPage` in descending `_creationTime`
  - Tabs or filters are out of scope for v1
- Logged out users
  - Show a centered modal styled consistently with the site
  - Black primary buttons with white text and a link to login

UI theming and layout match

- Page background uses site standard background `bg-[#F4F2EE]` [[memory:7364720]]
- Wrap with existing `Layout` and standard container `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Cards use `bg-white rounded-lg border border-[#D8E1EC]`
- Text colors follow site tokens `#292929` for headings, `#525252` for body, `#545454` for meta
- Buttons use `bg-[#292929] text-white hover:bg-[#525252]` and `variant="outline"` where appropriate
- Spacing and typography align with profile dropdown and cards across the app
- Use `lucide-react` icons for consistency and existing Tailwind classes used in `StoryDetail.tsx`
- Empty state and loading skeleton match site pattern shallow grey backgrounds and subtle borders
- Mobile behavior full width page, dropdown positioned relative to the header with proper z index

Accessibility and motion

- Keyboard navigation in the dropdown
- Focus trap inside the dropdown when open
- Reduced motion friendly transitions

## Read state rules

- Opening the dropdown does not change read state
- Clicking View all marks all as read for the current user
- Optionally mark a single alert as read after navigating from a dropdown item in a later iteration

## Error handling and safety

- All backend functions include validators for args and returns
- Integration hooks must skip when actor equals recipient to avoid self alerts
- Respect indexes on reads to avoid table scans

## Future email integration hooks

- Optional fanout via Resend in a later phase as defined in `addresend.md`
- When we implement email fanout extend `createAlert` caller sites to also call `internal.emails.notifications.*` actions according to per user preferences

## Testing checklist

- Create a vote and see an alert for the owner
- Create a rating and see an alert for the owner with the correct star value
- Create a comment and see an alert for the owner with working links
- Follow a user and see an alert for the target user
- Mark a submission as judged and see a judged alert with no judge identity
- Verify unread dot appears when any unread alerts exist and clears after View all
- Verify dropdown shows five items and page shows twenty
- Verify logged out users get a login prompt on the notifications page

## References

- Convex function syntax and validators `https://docs.convex.dev/functions`
- Convex queries and indexes `https://docs.convex.dev/functions/query-functions`
- TypeScript best practices `https://docs.convex.dev/understanding/best-practices/typescript`
- Mentions PRD `mentions.md`
- Resend PRD `addresend.md`
