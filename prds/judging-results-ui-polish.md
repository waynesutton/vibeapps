# Judging results UI polish

Created: 2026-09-23 16:15 UTC
Last Updated: 2026-09-23 16:20 UTC
Status: Done

## Problem

The admin AI results page (`?section=ai-results`) looks broken:

- Fact chips (URL live, hosting, sponsors, models, fork, built in window) sit in a flex row with no wrap, so pills squeeze into multi line blobs and overflow past the card edge.
- The row header uses `flex-wrap justify-between`, so the score block and actions drop to a random spot below the content.
- Action buttons use three different sizes (Shortlist, Brief, bare chevron).
- Every shared `Button` with an icon renders the icon on its own line ("Re-run AI Review", "Shortlist top 10", "Copy Markdown").

Related judging views have similar issues.

## Root causes

1. `src/components/ui/button.tsx` is not `inline-flex`. Tailwind preflight makes SVGs `display: block`, so icons stack above labels.
2. The same file's `size="sm"` regex (`px-4 py-2 text-sm`) never matches the base string, so small buttons keep default padding and text size.
3. AI results chip row is `flex items-center gap-3` without `flex-wrap`, and chips have no `whitespace-nowrap`/truncate.
4. `JudgingResultsDashboard` criteria bars divide by 5 while groups use a 1 to 10 `scoreScale`, so bars overflow past 100%.
5. CSV export wraps values in quotes but never escapes inner quotes, so titles or comments with `"` corrupt columns.
6. Purple badges (no purple rule) and blue selected tabs (design system says flip polarity with `bg-cta text-on-cta`) in results and tracking.

## Solution

- Button: `inline-flex items-center justify-center`, explicit size map (`sm` = `h-8 px-3 text-xs`, `icon` = square), visible focus ring.
- AI results row: header with rank, title block, and score top right; sources line and chip line wrap under the title; a hairline footer toolbar holds `via provider` meta plus Shortlist, Brief, Details with one shared button style (`h-8`).
- Shared `FactChip` with tones (neutral, good, warn, bad, info) including dark theme variants, nowrap plus truncate with full text in `title`.
- Criteria score picker wraps on narrow widths.
- Results dashboard: bars use `scoreScale` and clamp to 100%, CSV quotes escaped, neutral Agent badge, polarity flip for selected judge tab, gaps and `min-w-0` on long text rows.
- Judge tracking: purple accents to tokens, selected judge tab polarity flip.

## Files

- `src/components/ui/button.tsx`
- `src/components/admin/AIJudgeResults.tsx`
- `src/components/admin/JudgingResultsDashboard.tsx`
- `src/components/admin/JudgeTracking.tsx`

## Edge cases

- Buttons passing `w-full` or `h-11` still work (inline-flex plus justify-center).
- Rows with status failed or pending have no score; toolbar still shows Retry/Shortlist.
- Very long sponsor labels truncate inside the card instead of overflowing.
- Filtering keeps original rank numbers.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`
- Visual check of `/admin/judging/<slug>?section=ai-results`, `results`, `tracking` at desktop and narrow width, light and dark themes.

## Task completion log

- 2026-09-23 16:15 UTC PRD created
- 2026-09-23 16:20 UTC All fixes shipped; `tsc` clean; browser verified light and dark on AI results and Results
