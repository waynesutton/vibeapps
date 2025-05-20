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

### Changed

## [Unreleased] - YYYY-MM-DD
