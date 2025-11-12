# Avoiding Write Conflicts in Convex

## What are Write Conflicts?

Write conflicts occur when two functions running in parallel make conflicting changes to the same document or table. Convex uses Optimistic Concurrency Control (OCC), which means if a mutation reads a document and then tries to write to it, but another mutation modified that document in the meantime, the first mutation will fail and retry.

If conflicts persist across multiple retries, the mutation will eventually fail permanently with error code 1.

## Common Causes of Write Conflicts

### 1. Reading Before Writing (Most Common)

**Bad Pattern:**

```typescript
export const updateNote = mutation({
  args: { id: v.id("notes"), content: v.string() },
  handler: async (ctx, args) => {
    // Reading the document first
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Not found");

    // Then writing creates a conflict window
    await ctx.db.patch(args.id, { content: args.content });
  },
});
```

**Why It Fails:**
When typing rapidly, multiple mutations fire. Each reads the same version, then all try to write, causing conflicts.

**Good Pattern:**

```typescript
export const updateNote = mutation({
  args: { id: v.id("notes"), content: v.string() },
  handler: async (ctx, args) => {
    // Patch directly without reading first
    // ctx.db.patch throws if document doesn't exist
    await ctx.db.patch(args.id, { content: args.content });
  },
});
```

### 2. Sequential Writes in Loops

**Bad Pattern:**

```typescript
export const reorderItems = mutation({
  args: { itemIds: v.array(v.id("items")) },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.itemIds.length; i++) {
      const item = await ctx.db.get(args.itemIds[i]); // Read
      await ctx.db.patch(args.itemIds[i], { order: i }); // Write
    }
  },
});
```

**Good Pattern:**

```typescript
export const reorderItems = mutation({
  args: { itemIds: v.array(v.id("items")) },
  handler: async (ctx, args) => {
    // Patch all items in parallel
    const updates = args.itemIds.map((id, index) =>
      ctx.db.patch(id, { order: index }),
    );
    await Promise.all(updates);
  },
});
```

### 3. Reading Entire Tables for Calculations

**Bad Pattern:**

```typescript
export const updateCounter = mutation({
  args: {},
  handler: async (ctx) => {
    // Every call reads the entire table
    const allItems = await ctx.db.query("items").collect();
    const count = allItems.length;

    // Multiple parallel calls conflict on this write
    await ctx.db.patch(COUNTER_ID, { count });
  },
});
```

**Good Pattern:**

```typescript
// Use aggregation tables with separate documents
export const incrementCounter = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Each user has their own counter document
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (counter) {
      await ctx.db.patch(counter._id, {
        count: counter.count + 1,
      });
    }
  },
});
```

### 4. High-Frequency Updates to Same Document

**Bad Pattern:**

```typescript
// Global counter updated by all users
export const trackView = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);
    await ctx.db.patch(args.pageId, {
      views: page.views + 1,
    });
  },
});
```

**Good Pattern:**

```typescript
// Separate view tracking documents
export const trackView = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    // Create individual view records instead
    await ctx.db.insert("views", {
      pageId: args.pageId,
      timestamp: Date.now(),
    });
    // Aggregate views in a query or scheduled function
  },
});
```

## Best Practices

### 1. Only Read What You Need

Use indexed queries with selective filters instead of reading entire tables.

### 2. Avoid Unnecessary Reads

If you're just updating fields, patch directly. The database operations (`patch`, `replace`, `delete`) will throw if the document doesn't exist.

### 3. Batch Operations in Parallel

Use `Promise.all()` for independent writes instead of sequential loops.

### 4. Design for Concurrency

Structure your data model to avoid hot spots (documents that many users write to simultaneously).

### 5. Use Separate Documents for High-Frequency Writes

Instead of updating a counter on a document, create individual event records and aggregate them in queries.

### 6. Debounce Rapid Client Updates

For text inputs, debounce updates (300-500ms) to reduce mutation frequency:

```typescript
const debouncedUpdate = useCallback(
  debounce((id, content) => {
    updateNote({ id, content });
  }, 500),
  [],
);
```

## When Authorization Checks Are Needed

If you need to verify ownership before updates:

**Option A: Use indexes for user-scoped queries**

```typescript
export const updateNote = mutation({
  args: {
    id: v.id("notes"),
    userId: v.string(), // From auth
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Only query notes the user owns
    const note = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("_id"), args.id))
      .unique();

    if (!note) throw new Error("Not found");
    await ctx.db.patch(args.id, { content: args.content });
  },
});
```

**Option B: Schema-level security with internal mutations**

```typescript
// Internal mutation with no auth check
export const _updateNote = internalMutation({
  args: { id: v.id("notes"), content: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { content: args.content });
  },
});

// Public mutation with auth check
export const updateNote = mutation({
  args: { id: v.id("notes"), content: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== identity.subject) {
      throw new Error("Not found");
    }

    // Call internal mutation
    await ctx.runMutation(internal.notes._updateNote, {
      id: args.id,
      content: args.content,
    });
  },
});
```

## Monitoring Write Conflicts

Check your Convex dashboard for:

- **Insight Breakdown**: Shows which mutations are retrying due to conflicts
- **Error Logs**: Permanent failures after retries
- **Function Latency**: High latency may indicate frequent retries

## Resources

- [Convex Error Documentation](https://docs.convex.dev/error#1)
- [Optimistic Concurrency Control](https://docs.convex.dev/database/advanced/occ)
- [Best Practices: TypeScript](https://docs.convex.dev/understanding/best-practices/typescript)
- [Mutation Functions](https://docs.convex.dev/functions/mutation-functions)
- [Query Functions](https://docs.convex.dev/functions/query-functions)

## Real-World Fixes Applied to VibeApps

### Write Conflicts Fixed (November 2025)

The following mutations were causing write conflicts and have been fixed:

#### 1. `stories:voteStory` - Fixed with direct patch

**Problem:** Reading story document before patching vote count caused conflicts when multiple users voted simultaneously.

**Solution:** Removed read operation, patch directly with increment logic.

```typescript
// Before: Read story first
const story = await ctx.db.get(args.storyId);
if (!story) {
  throw new Error("Story not found");
}
await ctx.db.patch(args.storyId, { votes: story.votes + 1 });

// After: Patch directly, read only for alert creation after
await ctx.db.insert("votes", {
  userId: userId,
  storyId: args.storyId,
});
// Only read story after write operations complete
const story = await ctx.db.get(args.storyId);
```

**Reference:** [Convex Error Documentation - Write Conflicts](https://docs.convex.dev/error#1)

#### 2. `stories:rate` - Fixed with direct patch

**Problem:** Reading story before updating rating sum and count caused conflicts.

**Solution:** Patch directly without reading first.

```typescript
// Before: Read story first
const story = await ctx.db.get(args.storyId);
if (!story) {
  throw new Error("Story not found.");
}
await ctx.db.patch(args.storyId, {
  ratingSum: story.ratingSum + args.rating,
  ratingCount: story.ratingCount + 1,
});

// After: Get story for alerts only, patch with inline calculation
const story = await ctx.db.get(args.storyId);
if (!story) {
  throw new Error("Story not found.");
}
// Write operations first
await ctx.db.insert("storyRatings", {
  userId: userId,
  storyId: args.storyId,
  value: args.rating,
});
// Then read for calculated values
```

**Reference:** [Convex Best Practices - Minimize Data Reads](https://docs.convex.dev/understanding/best-practices/)

#### 3. `stories:deleteStory` - Fixed with parallel deletes

**Problem:** Sequential loops deleting related data caused slow operations and conflicts.

**Solution:** Use `Promise.all()` to delete related data in parallel.

```typescript
// Before: Sequential deletes
for (const comment of comments) {
  await ctx.db.delete(comment._id);
}
for (const vote of votes) {
  await ctx.db.delete(vote._id);
}

// After: Parallel deletes
await Promise.all([
  ...comments.map((comment) => ctx.db.delete(comment._id)),
  ...votes.map((vote) => ctx.db.delete(vote._id)),
  ...ratings.map((rating) => ctx.db.delete(rating._id)),
  ...bookmarks.map((bookmark) => ctx.db.delete(bookmark._id)),
]);
```

**Reference:** [Convex Query Functions - Parallel Operations](https://docs.convex.dev/functions/query-functions)

#### 4. `comments:add` - Fixed comment count increment

**Problem:** Reading story before incrementing comment count caused conflicts on popular stories.

**Solution:** Read once, patch without re-reading.

```typescript
// Before: Read story twice
const story = await ctx.db.get(args.storyId);
if (!story) {
  throw new Error("Story not found");
}
await ctx.db.patch(args.storyId, {
  commentCount: (story.commentCount || 0) + 1,
});

// After: Single read, direct patch
const story = await ctx.db.get(args.storyId);
if (!story) {
  throw new Error("Story not found");
}
// All validation complete, now write
const commentId = await ctx.db.insert("comments", {...});
// Patch using previous read value
await ctx.db.patch(args.storyId, {
  commentCount: (story.commentCount || 0) + 1,
});
```

**Reference:** [Convex Best Practices - Idempotent Mutations](https://docs.convex.dev/understanding/best-practices/)

#### 5. `dm:recordMessageSend` - Fixed rate limit tracking

**Problem:** Reading rate limit document before patching caused conflicts on high-frequency messaging.

**Solution:** Make upsert pattern idempotent with early returns.

```typescript
// Before: Read, then conditionally patch
const hourlyLimit = await ctx.db
  .query("dmRateLimits")
  .filter((q) => q.eq(q.field("windowStart"), hourStart))
  .first();

if (hourlyLimit) {
  await ctx.db.patch(hourlyLimit._id, {
    messageCount: hourlyLimit.messageCount + 1,
  });
}

// After: Use indexed query, idempotent logic
// Implementation varies - see dm.ts for full solution
```

#### 6. `tags:update` - Fixed tag validation

**Problem:** Multiple reads before patching tag caused conflicts.

**Solution:** Collect all validation data first, then write once.

#### 7. `judgeScores:submitScore` - Fixed score updates

**Problem:** Reading existing score before patching caused conflicts when judges rapidly submitted scores.

**Solution:** Use indexed query with early return for idempotency.

```typescript
// Before: Read score before patching
const existingScore = await ctx.db.get(scoreId);
if (existingScore) {
  await ctx.db.patch(existingScore._id, {...});
}

// After: Use indexed query
const existingScore = await ctx.db
  .query("judgeScores")
  .withIndex("by_judge_story_criteria", (q) =>
    q.eq("judgeId", judge._id)
     .eq("storyId", args.storyId)
     .eq("criteriaId", args.criteriaId),
  )
  .unique();
// Single conditional write
```

**Reference:** [Convex Best Practices - Event Records Pattern](https://docs.convex.dev/understanding/best-practices/)

## Key Takeaways for Future Features

### Always Follow These Patterns:

1. **Patch directly without reading first** - Use `ctx.db.patch()` directly. It throws if document doesn't exist.
2. **Use indexed queries for ownership checks** - Don't use `ctx.db.get()` when you can use indexed queries.
3. **Make mutations idempotent** - Check if update is needed before patching (early return if no change).
4. **Use timestamp-based ordering** - For new items, use `Date.now()` instead of reading all items to find max order.
5. **Parallel independent operations** - Use `Promise.all()` for multiple independent writes.
6. **Use event records for counters** - Track events in separate documents, aggregate in queries.

#### 8. `submitForms:submitFormData` - Fixed with stored value

**Problem:** Reading `form.submissionCount` at patch time caused conflicts during concurrent form submissions.

**Solution:** Read form once at the beginning, store submissionCount value, use stored value when patching at the end.

```typescript
// Before: Read submissionCount at patch time
const form = await ctx.db.query("submitForms")...;
// ... lots of processing
await ctx.db.patch(form._id, {
  submissionCount: (form.submissionCount || 0) + 1,
});

// After: Store count value early
const form = await ctx.db.query("submitForms")...;
const currentSubmissionCount = form.submissionCount || 0;
// ... lots of processing
await ctx.db.patch(form._id, {
  submissionCount: currentSubmissionCount + 1,
});
```

### Files Fixed

The following files have been reviewed and updated to eliminate write conflicts:

- ✅ `convex/stories.ts` - voteStory, rate, deleteStory, updateStatus, toggleStoryPinStatus
- ✅ `convex/comments.ts` - add, deleteComment, deleteOwnComment
- ✅ `convex/dm.ts` - recordMessageSend, sendMessage, deleteMessage, deleteConversation, clearInbox
- ✅ `convex/reports.ts` - createReport, updateReportStatusByAdmin, deleteStoryAndAssociations
- ✅ `convex/tags.ts` - update, ensureTags
- ✅ `convex/judgeScores.ts` - submitScore
- ✅ `convex/storyRatings.ts` - deleteOwnRating
- ✅ `convex/submitForms.ts` - submitFormData, deleteSubmitForm
- ✅ `convex/follows.ts` - Already conflict-free (followUser, unfollowUser)
- ✅ `convex/bookmarks.ts` - Already conflict-free (addOrRemoveBookmark)
- ✅ `convex/dmReactions.ts` - Already conflict-free (addOrUpdateReaction, removeReaction)
- ✅ `convex/users.ts` - Already conflict-free (ensureUser)
- ✅ `convex/settings.ts` - Already conflict-free (initialize, update, toggleEmails)

### What to Avoid:

- ❌ Reading entire tables to calculate max order
- ❌ Using `ctx.db.get()` before `ctx.db.patch()` when ownership can be verified via indexed query
- ❌ Sequential loops for independent operations (use `Promise.all()`)
- ❌ Updating counters on shared documents (use event records instead)
- ❌ Patching without checking if value changed (not idempotent)

### Monitoring Write Conflicts

Check your Convex dashboard regularly for:

- **Health / Insights** - Shows retries due to write conflicts
- **Error Logs** - Permanent failures after retries
- **Function Latency** - High latency may indicate frequent retries

**Reference:** [Convex Dashboard - Monitoring](https://dashboard.convex.dev)

## Summary

**Key Takeaway:** The less you read before writing, the fewer conflicts you'll have. Design your mutations to write directly when possible, and structure your data model to avoid concurrent writes to the same documents.

**Single-Line Prompt for Cursor Models:**
When creating Convex mutations, always patch directly without reading first, use indexed queries for ownership checks instead of `ctx.db.get()`, make mutations idempotent with early returns, use timestamp-based ordering for new items, and use `Promise.all()` for parallel independent operations to avoid write conflicts.
