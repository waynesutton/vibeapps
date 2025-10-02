# Content Moderation Archive System PRD

## Overview

This document outlines the archive functionality for the Content Moderation section in the Admin Dashboard. The archive system allows admins to hide submissions from the default moderation list while keeping them accessible through a dedicated "Archived Only" view.

## Feature Requirements

### Archive Functionality

**Purpose**: Allow admins to archive submissions to declutter the content moderation interface without permanently deleting content.

**Scope**:

- Archive functionality applies to **submissions (stories) only**
- Comments do **not** support archiving
- Archived submissions are hidden from all default views
- Archived submissions remain accessible via "Archived Only" filter
- Archive state is reversible (unarchive functionality)

### User Interface

**Archive Controls**:

- Archive button on each submission in content moderation list
- Unarchive button appears for archived submissions
- "Archived Only" option in status filter dropdown
- Archive buttons located alongside other moderation actions (Approve, Reject, Hide, etc.)

**Filter Behavior**:

- "All (Active)" - Shows all non-archived submissions
- "Pending" - Shows pending non-archived submissions
- "Approved" - Shows approved non-archived submissions
- "Rejected" - Shows rejected non-archived submissions
- "Hidden Only" - Shows hidden non-archived submissions
- "Archived Only" - Shows only archived submissions

## Database Schema

### Stories Table Update

```typescript
// convex/schema.ts
stories: defineTable({
  // ... existing fields
  isArchived: v.optional(v.boolean()), // Archive flag
  // ... other fields
});
```

**Notes**:

- `isArchived` is optional to support existing submissions without migration
- `undefined` is treated as "not archived" (false)
- Only `isArchived: true` marks a submission as archived

## Backend Implementation

### Mutations

**Archive Story** (`convex/stories.ts`):

```typescript
export const archiveStory = mutation({
  args: { storyId: v.id("stories") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.patch(args.storyId, { isArchived: true });
    return { success: true };
  },
});
```

**Unarchive Story** (`convex/stories.ts`):

```typescript
export const unarchiveStory = mutation({
  args: { storyId: v.id("stories") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    await ctx.db.patch(args.storyId, { isArchived: false });
    return { success: true };
  },
});
```

### Query Filtering

**List All Stories Admin** (`convex/stories.ts`):

Updated `listAllStoriesAdmin` to handle `isArchived` filtering:

```typescript
args: {
  paginationOpts: paginationOptsValidator,
  filters: v.object({
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    )),
    isHidden: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()), // Archive filter
    // ... other filters
  }),
  // ... other args
}
```

**Filtering Logic**:

- When `filters.isArchived === true`: Show only archived submissions
- When `filters.isArchived` is undefined or false: Exclude archived submissions
- Filter applied: `s.isArchived !== true` (includes `undefined` values)

## Frontend Implementation

### Component Changes

**ContentModeration.tsx** (`src/components/admin/ContentModeration.tsx`):

#### Status Filter Type

```typescript
type StatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "hidden"
  | "archived"; // Added archived
```

#### Story Filters Logic

```typescript
const storyFilters = useMemo(() => {
  const convexFilters: any = {};

  // Handle archive filter - only set when explicitly viewing archived
  if (statusFilter === "archived") {
    convexFilters.isArchived = true;
  } else {
    // For all other views, don't set isArchived filter
    // This allows submissions without isArchived field to appear
    if (statusFilter === "hidden") {
      convexFilters.isHidden = true;
    } else if (statusFilter !== "all") {
      convexFilters.status = statusFilter;
      convexFilters.isHidden = false;
    } else {
      convexFilters.isHidden = undefined;
    }
  }

  // ... date range and tag filters

  return convexFilters;
}, [statusFilter, selectedTagIds, startDate, endDate]);
```

#### Comment Filters Logic (Critical Fix)

```typescript
const commentFilters = useMemo(() => {
  const convexFilters: any = {};

  // Comments don't support "archived" filter - that's only for stories
  if (statusFilter === "archived") {
    // Don't set any status filter for comments when viewing archived
    // (comments don't have isArchived field)
  } else if (statusFilter === "hidden") {
    convexFilters.isHidden = true;
  } else if (statusFilter !== "all") {
    convexFilters.status = statusFilter;
    convexFilters.isHidden = false;
  } else {
    convexFilters.isHidden = undefined;
  }

  // ... date range filters

  return convexFilters;
}, [statusFilter, selectedTagIds, startDate, endDate]);
```

#### UI Elements

**Status Filter Dropdown**:

```typescript
<SelectContent>
  <SelectItem value="all">All (Active)</SelectItem>
  <SelectItem value="pending">Pending</SelectItem>
  <SelectItem value="approved">Approved</SelectItem>
  <SelectItem value="rejected">Rejected</SelectItem>
  <SelectItem value="hidden">Hidden Only</SelectItem>
  <SelectItem value="archived">Archived Only</SelectItem>
</SelectContent>
```

**Archive/Unarchive Buttons**:

```typescript
{item.type === "story" && (
  <>
    {(item as StoryWithDetails).isArchived ? (
      <Button
        variant="outline"
        size="sm"
        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
        onClick={() => handleAction("unarchive", item)}
      >
        <FileX className="w-4 h-4 mr-1" /> Unarchive
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
        onClick={() => handleAction("archive", item)}
      >
        <FileX className="w-4 h-4 mr-1" /> Archive
      </Button>
    )}
  </>
)}
```

## Critical Bug and Fix

### The Problem

When selecting "Archived Only" from the status filter dropdown, a React error occurred:

```
ArgumentValidationError: Value does not match validator.
Path: .filters.status
Value: "archived"
Validator: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
```

### Root Cause

The `commentFilters` useMemo hook was passing `status: "archived"` to the `listAllCommentsAdmin` query. However:

1. **Comments don't support archiving** - only stories/submissions have the `isArchived` field
2. The comment status validator only accepts: `"pending" | "approved" | "rejected"`
3. When `statusFilter === "archived"`, the code incorrectly tried to pass this to comments query
4. This caused a validator mismatch and crashed the component

### The Solution

Modified `commentFilters` to handle the "archived" status specially:

```typescript
// Comments don't support "archived" filter - that's only for stories
if (statusFilter === "archived") {
  // Don't set any status filter for comments when viewing archived
  // (comments don't have isArchived field)
} else if (statusFilter === "hidden") {
  convexFilters.isHidden = true;
} else if (statusFilter !== "all") {
  convexFilters.status = statusFilter;
  convexFilters.isHidden = false;
}
```

**Key Points**:

- When `statusFilter === "archived"`, comments don't set any filter
- This prevents the invalid "archived" value from being passed to the validator
- Archive filtering only applies to stories, not comments
- Comments tab remains functional when "Archived Only" filter is selected

## Design Decisions

### Why Comments Don't Support Archiving

**Rationale**:

1. **Comments are contextual** - They exist in relation to submissions
2. **Submission-level archiving** - When a submission is archived, its comments go with it
3. **Simpler data model** - Reduces complexity and maintains clarity
4. **Admin workflow** - Admins moderate at submission level, not individual comments
5. **Less common need** - Comment-level archiving is rarely needed in practice

### Archive vs Hidden vs Rejected

**Archive**:

- Purpose: Organize and declutter moderation queue
- Visibility: Only visible in "Archived Only" view
- Reversible: Can be unarchived
- Use case: Submissions that have been fully processed

**Hidden**:

- Purpose: Hide inappropriate content from public
- Visibility: Visible in "Hidden Only" view and all status views
- Reversible: Can be unhidden
- Use case: Violations that shouldn't be deleted

**Rejected**:

- Purpose: Mark submissions as not meeting guidelines
- Visibility: Visible in "Rejected" and "All" views
- Status-based: Part of approval workflow
- Use case: Submissions that don't meet quality standards

## Testing Checklist

### Archive Functionality

- [ ] Archive a submission - verify it disappears from "All (Active)" view
- [ ] Archive a submission - verify it appears in "Archived Only" view
- [ ] Unarchive a submission - verify it returns to appropriate status view
- [ ] Archive button only appears on submissions, not comments
- [ ] Archive/unarchive triggers toast notifications

### Filter Behavior

- [ ] "All (Active)" excludes archived submissions
- [ ] "Pending" excludes archived submissions
- [ ] "Approved" excludes archived submissions
- [ ] "Rejected" excludes archived submissions
- [ ] "Hidden Only" excludes archived submissions
- [ ] "Archived Only" shows only archived submissions
- [ ] Comments tab works correctly with all filters including "Archived Only"

### Edge Cases

- [ ] Existing submissions without `isArchived` field display correctly
- [ ] Switching between tabs (Submissions/Comments) with "Archived Only" selected works
- [ ] Multiple admins can archive/unarchive simultaneously without conflicts
- [ ] Archive state persists across page refreshes

## Future Enhancements

### Potential Improvements

**Bulk Archive**:

- Archive multiple submissions at once
- Archive based on date range or criteria
- Scheduled auto-archiving for old content

**Archive Metadata**:

- Track who archived and when
- Add archive reason/notes
- Archive history log

**Advanced Filtering**:

- Combine archive with other filters
- Search within archived submissions
- Export archived submission list

**Comment-Level Archiving** (if needed):

- Add `isArchived` field to comments table
- Update comment queries to handle archive filtering
- Add archive controls to comment moderation

## Related Files

**Backend**:

- `convex/schema.ts` - Stories table with `isArchived` field
- `convex/stories.ts` - Archive/unarchive mutations and filtered queries

**Frontend**:

- `src/components/admin/ContentModeration.tsx` - Archive UI and filter logic

## References

- Original implementation discussion and bug fix
- Convex schema best practices: https://docs.convex.dev/database/schemas
- Convex mutation functions: https://docs.convex.dev/functions/mutation-functions
- React useMemo hook: https://react.dev/reference/react/useMemo

---

**Document History**:

- Created: January 2, 2025
- Last Updated: January 2, 2025
- Status: Implemented and Fixed
