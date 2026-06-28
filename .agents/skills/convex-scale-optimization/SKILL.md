---
name: convex-scale-optimization
description: Patterns for scaling read-heavy Convex apps to millions of users. Use when optimizing bandwidth, reducing query costs, fixing slow queries, creating digest tables, replacing reactive subscriptions with one-shot fetches, adding compound indexes, debouncing writes, rate-controlling backfills, or running npx convex insights. Trigger when users mention "scale", "bandwidth", "performance", "optimize", "slow queries", "expensive queries", "digest table", "denormalize", or "thundering herd" in the context of Convex.
---

# Scaling Convex Apps

Patterns that took ClawHub from 9TB/day to 600GB/day while serving 1M+ weekly users. Apply these after you have real traffic and confirmed product market fit. Do not use for premature optimization.

Source: https://stack.convex.dev/optimizing-openclaw

## The optimization loop

Run this cycle until the remaining warnings are OCC contention, not bandwidth.

```
1. npx convex insights --prod  → find the top bandwidth consumer
2. Read the function            → understand why it's expensive
3. Fix it                       → usually a data model change
4. npx convex deploy            → live in production, zero downtime
5. Check the dashboard          → is it flat? Go to 1.
```

## Pattern 1: One-shot fetches for public pages

Reactive subscriptions (`useQuery`, `usePaginatedQuery`) re-execute on every write to the read set. For public catalog pages with many readers and frequent background writes, this causes massive amplification.

Replace with `convex.query()` for pages where real-time updates are not needed.

```tsx
// Reactive subscription: re-executes on every write to the read set
const results = usePaginatedQuery(
  api.skills.listPublicPage, args, { initialNumItems: 25 }
)

// One-shot fetch: no subscription, no amplification
const convex = useConvex();
const result = await convex.query(
  api.skills.listPublicPage, { cursor, numItems: 25, sort, dir }
)
```

Manage pagination state in React with `useState` and a generation counter to cancel stale requests.

| Pattern           | Use when                                                                |
|-------------------|-------------------------------------------------------------------------|
| useQuery          | Data is collaboratively edited and every client needs immediate updates |
| usePaginatedQuery | Real-time paginated data with small, bounded page counts                |
| convex.query()    | Many readers, mostly-static data (catalogs, listings, search results)   |

## Pattern 2: Digest tables (denormalization)

Convex returns full documents with no field projections. If your document is 3KB but your listing only needs 200 bytes, you read 15x more than necessary. Joins inside loops compound this.

```tsx
// Expensive: three tables, ~195KB per page of 25 items
for (const skill of skills) {
  const version = await ctx.db.get(skill.latestVersionId)  // 6KB each
  const owner = await ctx.db.get(skill.ownerUserId)         // 1KB each
}
```

Create a lightweight digest table with only the fields your hot path needs, including denormalized fields from joined tables.

```ts
// convex/schema.ts
skillSearchDigest: defineTable({
  skillId: v.id("skills"),
  slug: v.string(),
  displayName: v.string(),
  summary: v.optional(v.string()),
  statsDownloads: v.number(),
  ownerHandle: v.optional(v.string()),     // from users table
  ownerImage: v.optional(v.string()),      // from users table
  latestVersionSummary: v.optional(v.object({ /* minimal fields */ })),
}).index("by_downloads", ["statsDownloads"])
```

Query reads one table, no joins:

```ts
const page = await ctx.db
  .query("skillSearchDigest")
  .withIndex("by_downloads")
  .order("desc")
  .take(25)
```

Result: 195KB per page down to 20KB. A 10x reduction with no UI change.

## Pattern 3: Compare before writing

Sync digest tables using Triggers from `convex-helpers`. But always compare before writing. This was the single highest-impact fix on ClawHub.

```ts
import { Triggers } from "convex-helpers/server/triggers";

const triggers = new Triggers<DataModel>();

triggers.register("skills", async (ctx, change) => {
  if (change.newDoc) {
    await upsertSkillSearchDigest(ctx, change.newDoc);
  } else {
    await deleteSkillSearchDigest(ctx, change.oldDoc._id);
  }
});

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
```

Inside the upsert, always diff first:

```ts
const existing = await ctx.db.get(digestId);
const changed = DIGEST_KEYS.some((key) => existing[key] !== newFields[key]);
if (!changed) return; // no write = no invalidation
```

Without this, a cron updating stats for 500 skills fires 500 trigger writes. Each write invalidates every active subscriber. Each subscriber re-reads its full page. Cost is `500 writes x subscribers x docs_per_subscriber`. With change detection, most no-op updates become zero-cost.

## Pattern 4: Compound indexes over JS filtering

If you filter documents after the query returns them, you read documents just to throw them away.

```ts
// Scans every document, filters in JS
const allSkills = await ctx.db.query("skills")
  .withIndex("by_active_updated", (q) => q.eq("softDeletedAt", undefined));
const skills = allSkills.filter((skill) => !skill.isSuspicious);

// Database skips non-matching docs entirely
const skills = await ctx.db.query("skills")
  .withIndex("by_nonsuspicious_updated", (q) =>
    q.eq("softDeletedAt", undefined).eq("isSuspicious", false)
  )
```

Audit your codebase for `.filter()` and `if (doc.field) continue` inside query loops. Each one is a candidate for a compound index.

## Pattern 5: Rate-control backfills

When backfilling a new digest table, each batch of writes invalidates active subscribers. Spread writes with a delay between batches.

```ts
if (!batch.isDone) {
  await ctx.scheduler.runAfter(
    1000,
    internal.maintenance.backfillDigest,
    { cursor: batch.continueCursor, batchSize: 100, delayMs: 1000 }
  );
}
```

Add a stop flag: check a control document at the top of each batch so you can halt a runaway backfill.

## Pattern 6: Split heavy mutations

Mutations that read more than 8MB hit Convex transaction limits. Split into Action, Query, Mutation.

```ts
// Hits transaction limits
export const computeLeaderboard = internalMutation({
  handler: async (ctx) => {
    const allSkills = await ctx.db.query("skills").collect();
  },
});

// Action orchestrates, query reads, mutation writes
export const computeLeaderboard = internalAction({
  handler: async (ctx) => {
    const data = await ctx.runQuery(internal.skills.readLeaderboardData);
    const results = computeRankings(data);
    await ctx.runMutation(internal.skills.writeLeaderboardResults, { results });
  },
});
```

Note: each mutation in this pattern runs atomically by itself, but the mutations called from an action do not commit together atomically.

## Quick audit checklist

Run through these when optimizing an existing Convex app:

- [ ] Run `npx convex insights --prod` and identify the top bandwidth consumers
- [ ] Replace `useQuery`/`usePaginatedQuery` with `convex.query()` on public catalog pages
- [ ] Audit `ctx.db.get()` calls inside loops. Can the data live in a digest table?
- [ ] Search for `.filter()` after queries. Replace with compound indexes.
- [ ] Check crons and triggers for unconditional writes. Add change detection.
- [ ] Verify backfill jobs have delay between batches and a stop flag
- [ ] Check for mutations reading more than 8MB. Split into action/query/mutation.

## Key definitions

**Read set**: Every document your query touches becomes part of its read set. For reactive queries, a write to any document in the read set re-executes the entire query.

**Denormalization**: Storing a copy of data from one table inside another so the hot read path avoids joins. Tradeoff: keep the copy in sync.

**Thundering herd**: A batch write fires N triggers. Each trigger write invalidates every active subscriber. Each subscriber re-reads its full page. Cost multiplies as `N x subscribers x docs_per_subscriber`.

**Compound index**: An index on multiple fields. The database walks the B-tree to the first match and scans forward, skipping non-matching documents instead of reading and filtering.

## When NOT to apply these patterns

- Fewer than thousands of documents and moderate traffic
- Early stage prototyping before product market fit
- Collaborative features where every client needs immediate real-time updates
- Internal tools with low concurrent user counts

Ship first. Optimize after you have users.

## Further reading

- [Optimizing OpenClaw (source post)](https://stack.convex.dev/optimizing-openclaw)
- [Queries that Scale](https://docs.convex.dev/production/best-practices/)
- [Triggers (convex-helpers)](https://github.com/get-convex/convex-helpers)
- [Custom Functions](https://docs.convex.dev/functions)
- [Convex Insights CLI](https://docs.convex.dev/dashboard)
