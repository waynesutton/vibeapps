# Convex filter query refactor

Created: 2026-08-31 18:58 UTC
Last Updated: 2026-09-21 04:50 UTC
Status: Paused

Paused on 2026-09-21. The team member email fix it blocked is tracked in
`prds/admin-team-member-email-fix.md`. Resume with step 1 (fix the guard)
before any query rewrites.

## Problem

A `convex-lint` guard rejects any agent write to a Convex file that contains a
`.filter()` call on a database query. The guard scans the whole file and
collapses whitespace before matching, so multi-line `q.and(...)` forms count as
well. The practical effect is that roughly 20 files under `convex/` cannot be
edited by an agent at all, including `stories.ts`, `users.ts`, `tags.ts`,
`comments.ts`, `judgeScores.ts`, and `alerts.ts`.

This blocked a one-line production hotfix on 2026-08-31. The team member email
bug in `updateStoryAdmin` needed about 15 lines changed in `stories.ts` and had
to be applied by hand instead.

## Root cause

Two separate things are tangled together.

1. The guard is a blanket file-level block, not a diff-level one. It fires on a
   comment change in a file whose queries it dislikes.
2. The codebase genuinely does use `.filter()` on database queries in 14 places
   in `stories.ts` alone. Some are harmless, some are real full table scans.

Only the second is a code problem. Most of the flagged sites already narrow
through an index first and cost nothing.

## Inventory for convex/stories.ts

Fourteen call sites, grouped by the work each needs.

### Group A, index-narrowed already, move the predicate to TypeScript

Zero risk. The index does the narrowing, `.filter()` only trims a handful of
rows. Replace with an array `.filter()` after `.collect()`.

| Line | Query | Narrowed by |
| --- | --- | --- |
| 173 | comments, drop hidden | `by_storyId_status` |
| 907 | submissionLogs, match email | `by_user_time` |
| 1991 | stories, exclude self on slug collision | `by_slug` |
| 467 | stories, status and isHidden | `by_slug` |
| 2747 | stories, status and isHidden | `by_slug` |

### Group B, an existing index covers it

`stories` already has `by_status_isHidden` and `by_status_isHidden_votes`, so
these need no schema change.

| Line | Query | Target index |
| --- | --- | --- |
| 316, 355, 379 | `listApproved` feed | `by_status_isHidden` |
| 2432 | `listApprovedStoriesWithDetails` | `by_status_isHidden` |
| 2530 | `getRelatedStoriesByTags` | `by_status` |
| 2647 | `getApprovedCountByTag` | `by_status_isHidden` |

### Group C, already a full scan, no regression either way

| Line | Query | Note |
| --- | --- | --- |
| 2092 | `listAllStoriesAdmin` dynamic conditions | Collects the table today. Moving the conditions to TypeScript changes nothing. |

### Group D, needs a new index

| Line | Query | Needed |
| --- | --- | --- |
| 2348, 2349 | stories by email and creation time, anonymous rate limit in `submitDynamic` | `.index("by_email", ["email"])` on `stories`, or reuse `submissionLogs.by_user_time` the way `submitAnonymous` does |
| 2373 | tags by name | None, `tags.by_name` already exists |

## Correctness trap, do not skip this

Several Group B sites filter with `q.neq(q.field("isHidden"), true)`. That
predicate matches documents where `isHidden` is `false` **and** documents where
`isHidden` is absent. The obvious index rewrite is
`q.eq("status", "approved").eq("isHidden", false)`, which silently drops any
legacy story whose `isHidden` field was never set.

These are public read paths. Getting this wrong makes submissions vanish from
the homepage feed, related stories, and the tag counts.

Before rewriting any Group B site, count the affected rows:

```
stories where isHidden === undefined
```

If the count is zero, the `eq("isHidden", false)` rewrite is safe. If it is not
zero, backfill `isHidden: false` on those documents first, in its own deploy,
and confirm the count is zero before touching the queries.

## Proposed solution

Sequenced so each step is independently verifiable and revertible.

1. Fix the guard first. Scope it to warn rather than block writes, or limit it
   to changed lines. Without this, every step below is blocked from agent edits
   and the problem recurs on the next hotfix.
2. Land the pending team member fix in `stories.ts`. Unrelated to this refactor
   but currently gated behind the same block.
3. Run the `isHidden === undefined` count. Backfill if needed, in its own
   deploy, and verify.
4. Convert Group A and Group C. Behavior-identical, no schema change. Safe to
   ship together.
5. Convert Group B one query at a time, homepage feed last. Compare result
   counts before and after for each.
6. Decide Group D. Preference is reusing `submissionLogs.by_user_time` for the
   rate limiter so `submitDynamic` matches `submitAnonymous`, rather than adding
   a `stories.by_email` index for a rate limit check.
7. Repeat for the other flagged files, worst offenders first.

## Files to change

- `convex/schema.ts`, only if Group D takes the new index route
- `convex/stories.ts`, all 14 sites
- `convex/users.ts`, `convex/tags.ts`, `convex/comments.ts`,
  `convex/judgeScores.ts`, `convex/dm.ts`, `convex/judges.ts`,
  `convex/reports.ts`, `convex/adminJudgeTracking.ts`, `convex/alerts.ts`,
  `convex/forms.ts`, `convex/agentJudges.ts`, `convex/judgingCriteria.ts`,
  `convex/judgingGroups.ts`, `convex/storyFormFields.ts`,
  `convex/submitForms.ts`, `convex/migrations.ts`, `convex/emails/daily.ts`,
  `convex/emails/helpers.ts`, `convex/testUserReportEmail.ts` in later passes

## Edge cases

- `isHidden` absent versus `false`, described above. The main hazard.
- `listApproved` paginates manually over a collected array. Switching to an
  index changes the natural ordering, and pinned-first sorting happens in
  TypeScript afterward. Verify pinned submissions still lead the feed.
- `getRelatedStoriesByTags` collects every approved story before filtering by
  tag. An index helps the scan but the shape stays O(all approved). Worth a
  separate look, out of scope here.
- Group A rewrites that end in `.first()` become `.take(2)` plus a TypeScript
  find, so self-exclusion still works when a slug collides.
- `submitDynamic` builds its story object as `any`. Changing the rate limit
  source there is a behavior change to anonymous submission throttling, so it
  needs its own verification.

## Verification steps

- `npx tsc --noEmit` clean after each step.
- For each converted query, compare the result count against the old
  implementation on the same data before removing the old path.
- Homepage feed: confirm item count, ordering, and that pinned submissions stay
  on top.
- `getBySlug`: confirm a hidden and a rejected story still 404 rather than
  render.
- `getApprovedCountByTag`: confirm counts match the feed length per tag.
- Anonymous submission rate limit: confirm the eleventh submission in a day is
  still rejected.
- Convex dashboard: check the affected functions for reduced documents scanned
  and no new warnings.

## Task completion log

- 2026-08-31 18:58 UTC - PRD drafted. Inventory of all 14 `stories.ts` call
  sites complete, grouped by required work. No code changed yet.
