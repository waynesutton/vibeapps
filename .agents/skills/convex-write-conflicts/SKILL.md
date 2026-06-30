---
name: convex-write-conflicts
description: Diagnose and permanently fix Convex OCC "Retried due to write conflicts in table X" errors. Use when an Insight or log shows a mutation retrying on the same hot document, especially heartbeat/last-active/counter style writes.
---

# Fixing Convex write conflicts (OCC)

Convex uses optimistic concurrency control. A mutation is retried when a
document it read or wrote changed during execution. If parallel mutations keep
fighting over the same document, you see:

> Retried due to write conflicts in table `X`

Reference: https://docs.convex.dev/error#1

## How to read the Insight

In the Convex dashboard Insight Breakdown, look at:

- Table name in the title (which table is hot)
- Conflicting Document ID (one specific row is usually the culprit)
- Conflicting Function ("Self" means the mutation conflicts with other calls to itself)
- Recent Events timestamps (bursts within the same second = many parallel calls on one row)

A single repeated document ID + "Self" + same-second bursts means: too many
parallel writes to one hot document.

## Root cause patterns

1. Heartbeat / "last active" timestamp written on every tick.
2. Counters incremented on a single document.
3. A mutation that reads a whole table then writes one row (any insert elsewhere conflicts).
4. A mutation called in a loop from an action.

## The fix (in priority order)

1. Do not write on every call. Gate the write behind a staleness threshold so
   most calls become read-only no-ops. Read-only calls do not cause write
   conflicts, and a losing write retry reads the fresh value and early-returns.

   ```ts
   const ACTIVITY_UPDATE_THRESHOLD_MS = 2 * 60 * 1000;

   if (args.lastActiveAt - doc.lastActiveAt >= ACTIVITY_UPDATE_THRESHOLD_MS) {
     await ctx.db.patch(doc._id, { lastActiveAt: args.lastActiveAt });
   }
   ```

2. Read only what you need. Use `withIndex` instead of `collect()` over a table,
   so the read set is small and conflicts are less likely.

3. Spread writes across documents. For true high-throughput counters use the
   Sharded Counter component instead of one row.

4. De-synchronize clients. Add jitter to client intervals so heartbeats from
   many tabs/clients do not fire in lockstep:

   ```ts
   const intervalMs = 60000 + Math.floor(Math.random() * 15000);
   ```

5. Do not call a mutation many times in an action loop.

## Reference fix in this repo

`convex/judges.ts` -> `updateActivity` was retrying ~1.6K times on one judge row.
Fix: 2-minute server-side staleness threshold (writes become rare no-ops) plus
jittered client heartbeat in `src/pages/JudgingInterfacePage.tsx`. This is the
canonical pattern for any "last active" or heartbeat write in this codebase.

## Verify the fix

1. Deploy and watch Health -> Insights for the function. The retry count should
   stop climbing and the warning should clear within a couple hours (Insight
   data lags).
2. Confirm the feature still works (activity still updates, just less often).
3. Threshold precision is intentionally coarse; activity tracking only needs
   minute-level accuracy.
