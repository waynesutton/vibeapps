# Content Moderation Advanced Filters

## Overview

Enhanced filtering system for the Content Moderation dashboard that allows admins to filter submissions by admin messages, pin status (current and historical), and judging group membership. These filters work in combination with existing filters (status, date range, tags) to provide granular control over submission management.

## Implementation Status

✅ **Fully Implemented** (October 15, 2025)

All schema changes, backend queries, and frontend UI completed and tested.

## Features

### 1. Admin Message Filter

**Purpose**: Find submissions that have custom admin messages attached.

**Filter Type**: Checkbox

**Behavior**:

- When checked, shows only submissions where `customMessage` field is defined and non-empty
- Admin messages are displayed in the moderation UI with dark background
- Useful for tracking submissions that require special notes or instructions

**Use Cases**:

- Review all submissions with admin communication
- Audit admin message consistency
- Track special cases requiring attention

### 2. Currently Pinned Filter

**Purpose**: Show submissions that are currently pinned to the top of the feed.

**Filter Type**: Checkbox

**Behavior**:

- When checked, shows only submissions where `isPinned === true`
- Pinned submissions appear with pin icon in moderation UI
- Useful for reviewing what's currently featured

**Use Cases**:

- Audit currently featured content
- Review pinned submission quality
- Manage featured content rotation

### 3. Was Pinned Before Filter

**Purpose**: Find submissions that were ever pinned in the past, even if currently unpinned.

**Filter Type**: Checkbox

**Schema Addition**: `wasPinned: v.optional(v.boolean())` in `stories` table

**Behavior**:

- When checked, shows submissions where `wasPinned === true`
- Field automatically set when admin pins a submission
- Persists even after unpinning
- Useful for finding previously featured content

**Use Cases**:

- Review previously featured content
- Analyze what types of content get pinned
- Track historical feature decisions

### 4. Judging Group Filter

**Purpose**: Show submissions that are part of a specific judging group.

**Filter Type**: Dropdown selector

**Behavior**:

- Dropdown shows all judging groups with submission counts
- "All groups" option clears the filter
- When specific group selected, shows only submissions in that group
- Queries `judgingGroupSubmissions` table for membership

**Use Cases**:

- Review submissions in specific competitions
- Moderate hackathon entries by event
- Cross-reference judging groups with other filters

## Technical Architecture

### Schema Changes

**File**: `convex/schema.ts`

Added to `stories` table:

```typescript
wasPinned: v.optional(v.boolean()), // Track if story was ever pinned in the past
```

**Rationale**: Separate field from `isPinned` to maintain historical context. This allows admins to see which submissions were previously featured even after unpinning.

### Backend Changes

#### Pin History Tracking

**File**: `convex/stories.ts`

Modified `toggleStoryPinStatus` mutation:

```typescript
const newPinnedStatus = !story.isPinned;
await ctx.db.patch(args.storyId, {
  isPinned: newPinnedStatus,
  // Track if story was ever pinned
  wasPinned: newPinnedStatus ? true : story.wasPinned,
});
```

**Behavior**: When pinning a story, `wasPinned` is set to `true` and never cleared, even when unpinning. This creates a permanent history of pin actions.

#### Admin Query Filters

**File**: `convex/stories.ts`

Enhanced `listAllStoriesAdmin` query with four new filters:

**Validator Update** (line 1722-1725):

```typescript
hasMessage: v.optional(v.boolean()),
isPinned: v.optional(v.boolean()),
wasPinned: v.optional(v.boolean()),
judgingGroupId: v.optional(v.id("judgingGroups")),
```

**Filter Implementation** (lines 1837-1870):

1. **hasMessage Filter**:

```typescript
if (args.filters.hasMessage) {
  initialStories = initialStories.filter(
    (story) => story.customMessage && story.customMessage.trim() !== "",
  );
}
```

2. **isPinned Filter**:

```typescript
if (args.filters.isPinned) {
  initialStories = initialStories.filter((story) => story.isPinned === true);
}
```

3. **wasPinned Filter**:

```typescript
if (args.filters.wasPinned) {
  initialStories = initialStories.filter((story) => story.wasPinned === true);
}
```

4. **judgingGroupId Filter**:

```typescript
if (args.filters.judgingGroupId) {
  const groupSubmissions = await ctx.db
    .query("judgingGroupSubmissions")
    .withIndex("by_groupId", (q) =>
      q.eq("groupId", args.filters.judgingGroupId!),
    )
    .collect();
  const storyIdsInGroup = new Set(groupSubmissions.map((sub) => sub.storyId));
  initialStories = initialStories.filter((story) =>
    storyIdsInGroup.has(story._id),
  );
}
```

**Performance Note**: Judging group filter uses indexed query on `by_groupId` for efficient lookups, avoiding table scans.

### Frontend Changes

**File**: `src/components/admin/ContentModeration.tsx`

#### State Management

Added filter state variables (lines 77-81):

```typescript
const [hasMessage, setHasMessage] = useState(false);
const [isPinned, setIsPinned] = useState(false);
const [wasPinned, setWasPinned] = useState(false);
const [selectedJudgingGroupIdFilter, setSelectedJudgingGroupIdFilter] =
  useState<Id<"judgingGroups"> | null>(null);
```

#### Filter Logic Integration

Updated `storyFilters` useMemo (lines 207-219):

```typescript
// Add advanced filters
if (hasMessage) {
  convexFilters.hasMessage = true;
}
if (isPinned) {
  convexFilters.isPinned = true;
}
if (wasPinned) {
  convexFilters.wasPinned = true;
}
if (selectedJudgingGroupIdFilter) {
  convexFilters.judgingGroupId = selectedJudgingGroupIdFilter;
}
```

Added filter dependencies to useMemo array to ensure re-filtering on changes.

#### UI Implementation

**Advanced Filters Section** (lines 2078-2145):

**Visual Design**:

- Container: `bg-[#F4F2EE]` rounded border matching site design
- Positioned between date range filters and tag filters
- Only visible for submissions (hidden for comments)

**Checkboxes**:

- Three checkboxes with consistent styling
- Labels: "Has Admin Message", "Currently Pinned", "Was Pinned Before"
- Tailwind classes for checkbox styling match bulk selection checkboxes

**Judging Group Dropdown**:

- Uses Radix UI Select component for consistency
- Shows all groups with submission counts
- "All groups" option clears filter (value: "all")
- Label: "In Judging Group"

**Filter Clearing** (lines 723-727):

```typescript
// Clear advanced filters when switching away from submissions
setHasMessage(false);
setIsPinned(false);
setWasPinned(false);
setSelectedJudgingGroupIdFilter(null);
```

Ensures filters reset when switching to comments tab.

## Filter Combinations

All advanced filters work in combination with existing filters:

**Example Combinations**:

- Pinned + Has Message = Featured submissions with special notes
- Was Pinned Before + Specific Tag = Previously featured AI apps
- In Judging Group + Has Message = Competition entries with admin notes
- Date Range + Currently Pinned = Content pinned in specific time period
- Status: Approved + Currently Pinned = Published featured content

**Logic**: Filters are applied sequentially using AND logic, progressively narrowing results.

## User Experience

### Filter Workflow

1. Admin navigates to Admin Dashboard → Content Moderation
2. Selects "Submissions" tab
3. Scrolls to "Advanced Filters" section (below date range)
4. Toggles desired checkboxes and/or selects judging group
5. Results update reactively via Convex queries
6. Combines with other filters for precise filtering

### Visual Feedback

- Active filters show checked state
- Selected judging group displayed in dropdown
- Filter section only appears for submissions
- Filters automatically clear when switching to comments

### Performance

- All filters use in-memory operations on pre-fetched results
- Judging group filter uses indexed database query
- No noticeable performance impact with typical dataset sizes
- Results update smoothly with reactive queries

## Technical Details

### Type Safety

All implementations use proper TypeScript types:

- Filter state: `boolean` for checkboxes, `Id<"judgingGroups"> | null` for dropdown
- Convex validators: `v.boolean()` and `v.id("judgingGroups")`
- Frontend casting: `value as Id<"judgingGroups">` for type safety

### Radix UI Select Fix

**Issue**: Radix UI `SelectItem` doesn't accept empty string as value
**Solution**: Use `"all"` as default value instead of `""`
**Implementation**:

```typescript
value={selectedJudgingGroupIdFilter || "all"}
onValueChange={(value) =>
  setSelectedJudgingGroupIdFilter(
    value === "all" ? null : (value as Id<"judgingGroups">),
  )
}
```

### Data Flow

1. User toggles filter in UI
2. State updates trigger useMemo recalculation
3. useMemo builds `convexFilters` object
4. `usePaginatedQuery` receives new filters
5. Backend query applies filters sequentially
6. Results stream back to frontend
7. UI updates with filtered submissions

## Testing Checklist

- [x] Schema change compiles without errors
- [x] Pin toggle sets `wasPinned` field correctly
- [x] "Has Admin Message" filter works correctly
- [x] "Currently Pinned" filter shows only pinned submissions
- [x] "Was Pinned Before" filter shows historical pins
- [x] Judging group dropdown loads all groups
- [x] Judging group filter shows correct submissions
- [x] Multiple filters combine correctly
- [x] Filters clear when switching to comments
- [x] All existing features continue to work
- [x] No TypeScript or linting errors
- [x] Radix UI Select error fixed

## Files Modified

1. **convex/schema.ts**
   - Added `wasPinned` field to stories table

2. **convex/stories.ts**
   - Updated `toggleStoryPinStatus` mutation to track pin history
   - Enhanced `listAllStoriesAdmin` query with four new filters
   - Added filter logic for all new filter types

3. **src/components/admin/ContentModeration.tsx**
   - Added state management for four new filters
   - Updated `storyFilters` useMemo with filter logic
   - Added "Advanced Filters" UI section
   - Updated filter clearing logic in useEffect

## Future Enhancements

### Potential Additions

1. **Filter Presets**
   - Save common filter combinations
   - Quick access to frequently used filters
   - Share filter presets between admins

2. **Advanced Judging Filters**
   - Filter by judging status (pending, completed, skip)
   - Filter by assigned judge
   - Filter by average judge score range

3. **Message Content Search**
   - Search within admin messages
   - Filter by message keywords
   - Message template categories

4. **Pin History Timeline**
   - View when submissions were pinned/unpinned
   - Track who pinned/unpinned
   - Pin duration analytics

5. **Export Filtered Results**
   - Export current filter results to CSV
   - Include filter criteria in export
   - Scheduled exports with saved filters

## Design Decisions

### Why Checkboxes?

**Decision**: Use checkboxes instead of radio buttons or dropdown

**Rationale**:

- Allows multiple filter combinations (e.g., pinned AND has message)
- More flexible than single-selection controls
- Matches user request for checkbox-style filters
- Consistent with other multi-select patterns in the app

### Why Separate Pinned Filters?

**Decision**: Separate "Currently Pinned" and "Was Pinned Before" instead of single control

**Rationale**:

- Different use cases for each filter
- Currently pinned = active content management
- Was pinned before = historical analysis
- Both can be active simultaneously for different insights
- Schema supports efficient queries for both

### Why Judging Group Dropdown?

**Decision**: Use dropdown instead of multiple checkboxes

**Rationale**:

- Many judging groups would clutter UI with checkboxes
- Typically admins want to filter by ONE group at a time
- Dropdown shows submission counts for context
- More scalable as groups increase

### Filter Order

**Decision**: Place after date range, before tag filter

**Rationale**:

- Logical flow: Type → Status → Search → Date Range → **Advanced** → Tags
- Advanced filters are supplementary to main filters
- Grouped together in dedicated section
- Visual separation with background color

## Maintenance Notes

### Database Migration

**No migration required** for `wasPinned` field:

- New optional field, defaults to undefined
- Only set to `true` when story is pinned
- Existing submissions without field work correctly
- Filter handles undefined as "never pinned"

### Backwards Compatibility

All changes maintain backwards compatibility:

- Optional schema field doesn't break existing queries
- New filters are opt-in (unchecked by default)
- Existing moderation features unchanged
- No breaking changes to API

### Performance Monitoring

**Watch for**:

- Judging group query performance with large groups
- Filter combination performance with many submissions
- Memory usage with multiple active filters

**Optimization opportunities**:

- Cache judging group memberships
- Implement filter result caching
- Add database indexes if queries slow down

## References

- Content Moderation Archive: `prds/content-moderation-archive.md`
- Judging System Setup: `prds/judgingsetup.md`
- Admin Roles: `prds/adminroles.md`
- Convex Best Practices: https://docs.convex.dev/understanding/best-practices/typescript
