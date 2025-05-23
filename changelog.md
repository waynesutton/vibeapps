# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [YYYY-MM-DD] - Update TopCategoriesOfWeek Navigation

- **Fixed**: Clicking tags in "Top Categories This Week" no longer leads to a 404 page.
- **Updated**: `TopCategoriesOfWeek.tsx` now uses a button-based interaction model similar to the header tags. Clicking a category updates a shared `selectedTagId` state and navigates to the home page to display filtered content.
- **Changed**: `TopCategoriesOfWeek.tsx` now requires `selectedTagId` and `setSelectedTagId` props to be passed from its parent component to manage the shared selection state.

## [Unreleased]

### Added

- **Follow/Following Feature**: Implemented a comprehensive follow and following system.
  - **Backend**:
    - Added `follows` table to `convex/schema.ts`.
    - Created `convex/follows.ts` with mutations (`followUser`, `unfollowUser`) and queries (`getFollowers`, `getFollowing`, `getFollowStats`, `isFollowing`).
    - Updated `convex/users.ts` to include follower/following counts and status in user profiles.
    - Created `convex/adminFollowsQueries.ts` with queries for admin dashboard statistics (`getTopUsersByFollowers`, `getTopUsersByFollowing`, `getTotalFollowRelationships`).
  - **Frontend**:
    - Updated `src/pages/UserProfilePage.tsx` to display follow/unfollow buttons, follower/following counts, and new tabs for follower/following lists.
    - Updated `src/components/admin/NumbersView.tsx` to display top followers/following users and total follow relationships.
- Updated `files.md` with comprehensive descriptions for all files and directories, aligning with `README.md` features.
- Initial project setup.
- Detailed file documentation in `files.md` for all components, including admin dashboard and utility files.
- Expanded admin dashboard components: `AdminDashboard.tsx`, `ContentModeration.tsx`, `FormBuilder.tsx`, `FormResults.tsx`, `Forms.tsx`, `Settings.tsx`, `TagManagement.tsx`.
- Improved descriptions for all frontend and backend files.
- Created a new blank page at `/navtest` for testing navigation components. This page includes the standard header and footer with an empty main content area.
- Created a 404 Not Found page (`src/pages/NotFoundPage.tsx`) with a design inspired by the provided example, featuring a search bar and a link to the homepage.
- Updated application routing in `src/App.tsx` to display the new 404 page for any undefined routes.
- ConvexBox logo now links to the specified URL if provided.
- Created `public/robots.txt` to guide search engine crawlers.
- Created `public/sitemap.xml` to help search engines understand site structure.

### Changed

## [2024-12-XX] - User Moderation Enhancements

### Changed

- **User Moderation Dashboard**: Updated `src/components/admin/UserModeration.tsx` to display the 20 most recent users by default (increased from 15).
- **Search Functionality**: Implemented backend search across all users in `convex/users.ts` - the `listAllUsersAdmin` function now supports searching through all users by name, email, or username instead of only client-side filtering on loaded results.
- **User Profile Navigation**: Added clickable user names in the User Moderation table that navigate to user profiles.

### Technical Details

- Updated `listAllUsersAdmin` query in `convex/users.ts` to handle search queries by collecting all users and filtering server-side when a search term is provided.
- Removed client-side filtering in favor of backend search to enable searching across all users.
- Added React Router navigation support to user moderation component.
- Enhanced user experience with hover effects on clickable user names.
- Fixed user profile navigation to use username-based URLs (`/{username}`) instead of ID-based URLs (`/profile/{id}`) to match the routing system.
- Added visual feedback for users without usernames (grayed out, non-clickable).

## [Unreleased] - YYYY-MM-DD
