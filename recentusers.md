# Recent Vibers - Product Requirements Document

## Overview

Create a "Recent Vibers" sidebar component that displays the 25 most recently joined users as small profile avatars with hover card functionality and profile linking.

## Feature Summary

A new sidebar section called "Recent Vibers" will be positioned below the "Top Categories This Week" component, showing circular profile avatars of the 25 newest users who have joined the platform in chronological order (newest first).

## Component Placement

The Recent Vibers component will be displayed in the same locations where TopCategoriesOfWeek and WeeklyLeaderboard components are currently shown:

- **Primary Location**: Main layout sidebar (`src/components/Layout.tsx` lines 741-746)
- **Display Logic**: Shows when `showSidebar` is true (same condition as existing sidebar components)
- **Order**: Positioned third in the sidebar stack:
  1. WeeklyLeaderboard
  2. TopCategoriesOfWeek
  3. **RecentVibers** (new)

## Technical Requirements

### Backend (Convex)

Create a new query function in `convex/users.ts`:

```typescript
export const getRecentVibers = query({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      username: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      isVerified: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    // Query users ordered by creation time (newest first)
    // Filter out banned users
    // Return user data needed for avatar display and ProfileHoverCard
  },
});
```

**Query Logic:**

- Order by `_creationTime` descending (newest users first)
- Filter out users where `isBanned` is true
- Limit to the specified number (default 25)
- Only return users who have usernames (required for profile linking)
- Include fields needed for avatar display and ProfileHoverCard integration

### Frontend Component

Create `src/components/RecentVibers.tsx`:

**Props:**

- No props needed (self-contained component)

**Layout:**

- White rounded container matching existing sidebar components
- Header: "Recent Vibers" (consistent with other sidebar titles)
- Grid layout for avatars (5 columns x 5 rows for 25 users)
- Responsive design for mobile/tablet

**Avatar Specifications:**

- Size: 40px x 40px circular avatars
- Gap: 8px between avatars
- Image handling: User's `imageUrl` or fallback to initials
- Fallback styling: Same as ProfileHoverCard (dark background with white initials)

**Interaction Behavior:**

- **Click**: Navigate to user's profile page (`/${username}`)
- **Hover**: Trigger ProfileHoverCard component
- **Loading State**: Show skeleton placeholders
- **Empty State**: "No recent vibers yet" message

### Integration with ProfileHoverCard

Reuse the existing ProfileHoverCard component:

- Pass `username` prop to ProfileHoverCard
- Maintain 500ms hover delay
- Handle mouse enter/leave events properly
- Ensure hover card positioning works within sidebar constraints

### Styling Requirements

- Container: `bg-white rounded-lg border border-[#D8E1EC]` (matches existing sidebar components)
- Padding: `p-4` (consistent with other sidebar components)
- Title: `text-md font-normal text-[#292929] mb-3` (matches existing titles)
- Avatar grid: `grid grid-cols-5 gap-2` for optimal layout
- Loading state: Subtle skeleton animation
- Empty state: `text-sm text-[#545454]` (matches existing empty states)

## User Experience

### Visual Design

- Clean grid layout of circular profile pictures
- Consistent spacing and alignment
- Smooth hover transitions
- Loading states that don't cause layout shift

### Accessibility

- Alt text for profile images
- Keyboard navigation support
- Screen reader friendly labels
- Focus indicators for interactive elements

### Performance

- Efficient query with proper indexing
- Lazy loading of ProfileHoverCard data
- Optimized image loading for avatars
- Minimal re-renders

## Success Metrics

- Component renders without errors
- ProfileHoverCard integration works seamlessly
- Navigation to user profiles functions correctly
- Performance remains optimal with 25 user avatars
- Responsive design works across all screen sizes

## Implementation Order

1. Create backend query function (`getRecentVibers`)
2. Build RecentVibers component with basic layout
3. Integrate ProfileHoverCard functionality
4. Add to Layout.tsx sidebar
5. Implement loading and empty states
6. Add responsive design optimizations
7. Performance testing and optimization

## Edge Cases

- Users without profile images (show initials)
- Users without usernames (exclude from display)
- Banned users (filter out)
- Network loading failures (graceful fallback)
- Very long user names (truncate in hover card)

## Future Enhancements

- Add "View All Users" link at bottom
- Include user join date in hover card
- Add animation when new users join
- Consider user activity indicators
