## Mentions PRD

### Goal

- Add logged user @mentions across comments and judging notes so users can reference other logged user profiles
- Enforce a hard limit of 30 mentions per actor per calendar day across the whole site
- Keep the system typesafe end to end with Convex validators and indexes
- Prepare clean integration points for future daily mention emails described in addresend.md

### Scope

- Surfaces
  - Comments on `StoryDetail.tsx`
  - Judging notes and replies on `JudgingInterfacePage.tsx`
- Actors and targets
  - Actor must be an authenticated Convex user document
  - Target must be an existing Convex user document resolved from a visible handle
- Out of scope for v1
  - Real time suggestions UI for autocompletion
  - Edits that retroactively add or remove mentions
  - Push or email notifications now the PRD only defines data and hooks for a later email fanout

### Constraints and decisions

- Handle format will reuse `users.username` as the canonical mention token `@username`
- We will enforce uniqueness of `users.username` at write time in existing user flows not in this PRD
- A single content body may include multiple handles we will de duplicate per target user within that body
- Rate limit is per actor per calendar day in the app timezone we will store a `date` field as `YYYY-MM-DD` for indexed counting
- If an actor attempts more than the remaining daily quota we will record as many as allowed and drop the rest without failing the parent action
- For judging notes the judge must resolve to a `users` row via `judges.userId` if not present the note will not emit mentions

### Chronological implementation plan

1. Schema updates

- Add `mentions` table for durable mention events and future email fanout
  - Fields
    - `actorUserId: v.id("users")` who wrote the content
    - `targetUserId: v.id("users")` who was mentioned
    - `context: v.union(v.literal("comment"), v.literal("judge_note"))`
    - `sourceId: v.union(v.id("comments"), v.id("submissionNotes"))` id of comment or note
    - `storyId: v.id("stories")` always present for both contexts
    - `groupId: v.optional(v.id("judgingGroups"))` present for judge notes
    - `contentExcerpt: v.string()` first N chars for moderation and email previews max 240 chars
    - `date: v.string()` calendar date `YYYY-MM-DD` for indexed rate limiting and digest queries
  - Indexes
    - `by_actor_and_date: ["actorUserId", "date"]` for fast quota checks
    - `by_target_and_date: ["targetUserId", "date"]` for future daily email rollups
    - `by_context_and_source: ["context", "sourceId"]` for debugging and idempotency checks

2. Core mention utilities in `convex/mentions.ts`

- Parser new function using the new Convex syntax
  - `extractHandles` internalQuery
    - args `{ text: v.string() }`
    - returns `v.array(v.string())` de duplicated list of handle tokens without `@`
    - regex limited to `[a-zA-Z0-9_\.]` to match current usernames style

- Resolver new function
  - `resolveHandlesToUsers` internalQuery
    - args `{ handles: v.array(v.string()) }`
    - returns `v.array(v.object({ handle: v.string(), userId: v.id("users") }))`
    - uses `users.by_username` index and skips unknown handles

- Quota counter new function
  - `getActorDailyCount` internalQuery
    - args `{ actorUserId: v.id("users"), date: v.string() }`
    - returns `v.number()` using `withIndex("by_actor_and_date")`

- Recorder new function
  - `recordMentions` internalMutation
    - args
      - `actorUserId: v.id("users")`
      - `resolvedTargets: v.array(v.object({ handle: v.string(), userId: v.id("users") }))`
      - `context: v.union(v.literal("comment"), v.literal("judge_note"))`
      - `sourceId: v.union(v.id("comments"), v.id("submissionNotes"))`
      - `storyId: v.id("stories")`
      - `groupId: v.optional(v.id("judgingGroups"))`
      - `contentExcerpt: v.string()`
      - `date: v.string()`
    - behavior
      - remove self mentions where `targetUserId === actorUserId`
      - compute `remaining = max(30 - currentDailyCount, 0)` and truncate the targets array
      - insert one `mentions` row per allowed target
      - returns `{ inserted: v.number(), skippedSelf: v.number(), skippedQuota: v.number() }`

3. Integration with comments flow in `convex/comments.ts`

- In the existing add comment mutation after inserting the comment
  - fetch the actor userId from auth or existing logic
  - call `internal.mentions.extractHandles` with the raw `content`
  - early return if zero handles
  - call `internal.mentions.resolveHandlesToUsers`
  - build `contentExcerpt = content.slice(0, 240)` and `date = new Date().toISOString().split("T")[0]`
  - call `internal.mentions.recordMentions` with context `"comment"`, `sourceId` as the new comment id and the current `storyId`
  - do not block the parent mutation on mention failures this can be wrapped in a try and logged

4. Integration with judging notes in `convex/judgingGroupSubmissions.ts`

- In the existing `addSubmissionNote` mutation after inserting the note
  - if the judge row has `userId` then treat that as `actorUserId`, otherwise skip mention processing
  - repeat the same sequence used for comments with context `"judge_note"`, passing `groupId` and `storyId`

5. Client side minimal enhancements

- No UI changes are required for v1 mentions will be plain text at write time and rendered as links at read time
- Rendering
  - In `StoryDetail.tsx` and `JudgingInterfacePage.tsx` highlight `@username` tokens and wrap them with a link to `/username` using the existing username route scheme
  - This is a presentational change and does not require Convex calls

6. Types and validators summary

- All new functions use the new Convex function syntax and explicit `args` and `returns` validators
- Prefer `withIndex` for all reads from `mentions` to avoid full table scans
- Use `v.null()` where a function intentionally returns nothing

7. Safety and abuse controls

- Daily quota of 30 mentions per actor enforced server side by `recordMentions`
- Self mention is ignored and not counted toward the quota
- Unknown handles are ignored and not counted
- If the parent content is deleted later we will retain mention rows for audit they can be pruned by a future cleanup job

8. Email integration ✅ FULLY IMPLEMENTED

- **Daily digest approach**: Mentions are included in daily engagement emails to reduce noise and improve user experience
- **Rate limiting**: Users receive a maximum of 10 mentions per daily email, with a link to view all mentions on the notifications page
- **Production ready**: The `mentions.by_target_and_date` index is used to fetch daily mentions for each user in the email system
- **Email preferences**: Users can disable mention notifications via `emailSettings.mentionNotifications` or unsubscribe from all daily emails
- **Template integration**: Mentions appear in the daily engagement email template with author names, story titles, and content excerpts
- **Link generation**: Mentions in emails link back to the notifications page for full mention history
- **Profile URL fix**: Email templates now generate correct profile links using `/${username}` format instead of `/user/${userId}`
- **Phase 11 improvements**: Enhanced daily email system now includes inbox messages alongside mentions, comments, and engagement (see `addresend.md` Phase 11 for details)

9. Metrics and admin visibility

- Simple admin query can aggregate total mentions per day and top mentioned users using the indexed reads on `by_target_and_date`
- A future admin page can paginate `mentions` ordered by `_creationTime` for moderation

### Acceptance criteria

- Creating a comment with `@alice @bob` by a logged user results in up to two `mentions` records when both usernames exist and the actor has quota remaining
- Creating a judging note with `@carol` by a judge linked to a user creates one `mentions` record linked to the note source and group
- Exceeding the 30 daily limit silently records only the first remaining mentions and drops the rest the parent write still succeeds
- Rendering on both target pages converts `@username` into profile links without breaking existing styling

---

## ✅ IMPLEMENTATION STATUS: COMPLETED

### What Was Implemented

#### 1. **Core Schema & Functions** ✅

- **Schema**: Added `mentions` table with proper indexes for quota enforcement and future email rollups
- **Core utilities**: Created `convex/mentions.ts` with extract, resolve, record functions
- **User search**: Added `searchUsersForMentions` query for autocomplete functionality

#### 2. **Backend Integration** ✅

- **Comments flow**: Integrated mentions processing in `convex/comments.ts`
- **Judging notes flow**: Integrated mentions processing in `convex/judgingGroupSubmissions.ts`
- **Quota enforcement**: 30 mentions per user per day with server-side validation

#### 3. **Frontend Features** ✅

- **Link rendering**: Added `renderTextWithMentions` utility and integrated in both surfaces
- **Autocomplete**: Built LinkedIn-style `MentionTextarea` component with real-time user search
- **UI Integration**: Replaced textareas in `CommentForm` and `JudgingInterfacePage`

### Key Features Delivered

#### **LinkedIn-Style Autocomplete** 🎯

- **Real-time search**: As you type `@username`, dropdown appears with matching users
- **Keyboard navigation**: Arrow keys, Enter/Tab to select, Escape to close
- **Visual design**: User avatars, real names, hover states, selected highlighting
- **Performance optimized**: Up to 10 results, debounced search, efficient queries

#### **Smart Context Detection** 🔍

- **Intelligent parsing**: Only triggers on `@` at start of word or line
- **Clean insertion**: Automatically adds space after username
- **Focus management**: Maintains cursor position and textarea focus

#### **Complete Integration** 🔄

- **Comments**: Full autocomplete in story comment threads
- **Judging notes**: Autocomplete in both main notes and replies
- **Link rendering**: All existing and new mentions render as profile links

### Technical Fixes Applied

#### **TypeScript Issues** 🔧

- **Field mapping**: Fixed `profileImageUrl` → `imageUrl` to match user schema
- **Optional fields**: Added proper handling for `username` being optional
- **Type safety**: Used non-null assertions after filtering undefined values

#### **Convex Query Optimization** ⚡

- **Efficient search**: Uses `by_username` index for exact matches first
- **Fallback search**: Full collection scan only when needed
- **User filtering**: Excludes banned users from autocomplete results

#### **UI/UX Enhancements** ✨

- **Dropdown positioning**: Proper z-index and overflow handling
- **Loading states**: Graceful handling when no users found
- **Accessibility**: Keyboard navigation and proper focus management

#### **Email Template Fixes** 📧

- **Profile URL format**: Fixed mention email templates to use correct `/${username}` URLs
- **Template parameters**: Added missing `userId` and `userUsername` parameters to mention email template
- **URL consistency**: Ensured all email profile links match the app's URL structure
- **Username setup flow**: Fixed fallback logic to redirect users without usernames to `/set-username` instead of sign-in
- **New user experience**: Welcome and mention emails now properly guide new users through username setup process

### How It Works

1. **User types `@`** in comment or judging note textarea
2. **Autocomplete activates** with real-time user search
3. **Dropdown shows** up to 10 matching users with avatars/names
4. **User selects** via keyboard or mouse click
5. **Username inserted** with proper spacing and focus maintained
6. **Server processes** mentions on submit with quota enforcement
7. **Links render** for all mentions in the UI

### Performance & Security

- **Search optimized**: Index-based lookups with collection fallback
- **Quota enforced**: 30 mentions/day limit server-side
- **User filtering**: Banned users excluded from autocomplete
- **Efficient queries**: Limited results, proper indexes used

### Future Integration Ready

- **Email system**: `mentions` table designed for daily digest emails
- **Admin visibility**: Indexes support admin queries and moderation
- **Audit trail**: Full mention history preserved for compliance

**Status**: ✅ **Production ready** - Full LinkedIn-style @mention system with autocomplete, quota enforcement, and seamless UX integration!

### Technical references

- Users schema fields in `convex/schema.ts` include `username` and index `by_username` which will be used for handle resolution
- Comments are stored in `comments` table and judging notes in `submissionNotes` table both already present with usable indexes

### Pseudocode outlines for new functions

```ts
// convex/mentions.ts
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const extractHandles = internalQuery({
  args: { text: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const set = new Set<string>();
    const re = /(^|\s)@([a-zA-Z0-9_.]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(args.text))) set.add(m[2]);
    return Array.from(set);
  },
});

export const resolveHandlesToUsers = internalQuery({
  args: { handles: v.array(v.string()) },
  returns: v.array(v.object({ handle: v.string(), userId: v.id("users") })),
  handler: async (ctx, args) => {
    const results: Array<{ handle: string; userId: any }> = [];
    for (const h of args.handles) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", h))
        .unique();
      if (u) results.push({ handle: h, userId: u._id });
    }
    return results as any;
  },
});

export const recordMentions = internalMutation({
  args: {
    actorUserId: v.id("users"),
    resolvedTargets: v.array(
      v.object({ handle: v.string(), userId: v.id("users") }),
    ),
    context: v.union(v.literal("comment"), v.literal("judge_note")),
    sourceId: v.union(v.id("comments"), v.id("submissionNotes")),
    storyId: v.id("stories"),
    groupId: v.optional(v.id("judgingGroups")),
    contentExcerpt: v.string(),
    date: v.string(),
  },
  returns: v.object({
    inserted: v.number(),
    skippedSelf: v.number(),
    skippedQuota: v.number(),
  }),
  handler: async (ctx, args) => {
    const targets = args.resolvedTargets.filter(
      (t) => t.userId !== args.actorUserId,
    );

    const currentCount = await ctx.db
      .query("mentions")
      .withIndex("by_actor_and_date", (q) =>
        q.eq("actorUserId", args.actorUserId).eq("date", args.date),
      )
      .count();

    const remaining = Math.max(30 - currentCount, 0);
    let inserted = 0;
    for (const t of targets.slice(0, remaining)) {
      await ctx.db.insert("mentions", {
        actorUserId: args.actorUserId,
        targetUserId: t.userId,
        context: args.context,
        sourceId: args.sourceId as any,
        storyId: args.storyId,
        groupId: args.groupId,
        contentExcerpt: args.contentExcerpt,
        date: args.date,
      });
      inserted++;
    }
    return {
      inserted,
      skippedSelf: args.resolvedTargets.length - targets.length,
      skippedQuota: Math.max(targets.length - remaining, 0),
    };
  },
});
```
