# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Latest Updates

### Enhanced Tag Management with Search & Numbered Ordering 🏷️

**Added**

- **Tag Search Functionality**: Added search input to quickly find tags in TagManagement
  - **Real-time Filtering**: Type to filter tags by name instantly
  - **Case-insensitive Search**: Works with any capitalization
  - **Maintains All Features**: Search works alongside all existing tag management features

- **Admin/User Tag Tracking**: Enhanced tag system to distinguish between admin and user-created tags
  - **Visual Indicators**: Green "(Admin)" and orange "(User)" labels for easy identification
  - **Smart Sorting**: Admin tags automatically appear first, then user tags
  - **Database Schema**: Added `createdByAdmin` field to track tag origin
  - **Automatic Detection**: Admin-created tags marked as admin, user submissions marked as user

- **Numbered Order System**: Replaced up/down arrow sorting with flexible number-based ordering
  - **0-999 Range**: Enter any number from 0-999 for precise ordering control
  - **Lower First**: Lower numbers appear first in display order
  - **Same Number Grouping**: Tags with same order number appear together
  - **Visual Input**: Clear order input field with validation
  - **Flexible Control**: Much more precise than simple up/down arrows

**Enhanced**

- **Tag Management Interface**: Improved admin tag management experience
  - **Better Layout**: Order input positioned prominently for easy access
  - **Clear Labels**: Visual indicators for admin/user origin and current order
  - **Comprehensive Help**: Updated legend with new ordering and indicator explanations
  - **Maintained Functionality**: All existing features (colors, icons, visibility) preserved

**Technical**

- Added `createdByAdmin` boolean field to tags schema
- Updated all tag mutations to handle admin/user tracking
- Enhanced `listAllAdmin` query with improved sorting logic
- Modified tag creation in user submissions to mark as user-created
- Added order validation (0-999) with input sanitization
- Updated TypeScript interfaces to include new field

## Previous Updates

### Enhanced Tag Selection with Search Dropdown 🔍

**Added**

- **All Tags Dropdown Search**: Added new search dropdown on StoryForm.tsx that includes ALL available tags (including hidden ones)
  - **Search Functionality**: Type to search and filter through all tags in the system
  - **Visual Tag Display**: Shows tag colors, emojis, and icons in both visible tags and dropdown
  - **Hidden Tag Access**: Users can now select tags that admins have hidden from the header display
  - **Smart Filtering**: Excludes already selected tags and new tags being created from search results
  - **Click Outside to Close**: Dropdown closes when clicking outside for better UX
  - **Performance Optimized**: Limited to 10 search results to maintain performance
  - **Consistent Styling**: Matches existing UI design patterns and color scheme

- **Selected Tags Display**: Added comprehensive tag selection management
  - **Visual Feedback**: Selected tags now appear in a dedicated "Selected Tags" section
  - **Tag Counter**: Shows current selection count with 10-tag maximum (e.g., "Selected Tags (3/10)")
  - **Remove Functionality**: Click X button on any selected tag to remove it
  - **Hidden Tag Indicators**: Shows "(Hidden)" label for tags not visible in header
  - **New Tag Indicators**: Shows "(New)" label for tags being created

- **10-Tag Selection Limit**: Implemented comprehensive tag limit enforcement
  - **Smart Validation**: Prevents selection beyond 10 total tags across all methods
  - **User Feedback**: Clear error messages when limit is reached
  - **UI Disabling**: Input fields and buttons disabled when at maximum
  - **Dynamic Placeholders**: Helpful placeholder text when limit reached

**Technical**

- Added new Convex query `listAllForDropdown` to fetch all tags including hidden ones
- Enhanced tag button styling to show custom colors, emojis, and icons when selected
- Added React state management for dropdown search and visibility
- Implemented click-outside handler to close dropdown automatically
- Added comprehensive tag limit validation across all selection methods
- Created unified selected tags display component with remove functionality

## Previous Updates

### Enhanced Admin Content Moderation Editing 🛠️

**Added**

- **Comprehensive Inline Editing**: Admins can now edit all submission data directly in Content Moderation without navigating away
  - **All Story Fields**: Title, URL, description, long description, submitter name, video URL, email
  - **Social Links**: LinkedIn, Twitter/X, GitHub, Chef Show URL, Chef App URL
  - **Tag Management**: Visual tag selector with ability to add new tags on the fly
  - **Screenshot Upload**: Full file upload functionality with preview, replace, and remove options
  - **Form Validation**: Required field validation with user-friendly error messages
  - **Organized Layout**: Grouped fields into logical sections (Basic Info, Social Links, Tags, Screenshot)
  - **Background Color**: Uses site standard `#F2F4F7` background for consistency

**Technical Implementation**

- Enhanced `src/components/admin/ContentModeration.tsx` with comprehensive edit form
- Added state management for tags, file uploads, and form data
- Integrated with existing `updateStoryAdmin` mutation and `generateUploadUrl` for file handling
- Added helper functions for tag management and file preview
- Maintained all existing moderation workflow functionality
- Removed admin edit functionality from `StoryDetail.tsx` component for cleaner separation of concerns

**User Experience Improvements**

- **Context Preservation**: Admins stay in moderation workflow without losing their place
- **Visual Feedback**: Real-time preview for screenshot uploads and tag selections
- **Error Handling**: Clear validation messages and upload status indicators
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### YC AI Hackathon Form 🚀

**Added**

- **New YC AI Hackathon Submission Form**: Created dedicated form at `/ychack` route for YC AI Hackathon submissions
  - Based on ResendForm component with updated branding and messaging
  - Removed "closed form" message and enabled active submissions
  - Updated all text references from "Resend" to "YC AI Hackathon"
  - Changed placeholder text to focus on AI usage instead of Resend integration
  - Auto-adds "ychackathon" tracking tag to submissions
  - Maintains all existing functionality (file uploads, dynamic fields, tag selection)
  - **Hidden Sidebar**: Removed WeeklyLeaderboard and TopCategoriesOfWeek sidebar components from YC Hackathon form page for focused submission experience

**Technical Details**

- Created `src/components/YCHackForm.tsx` component
- Added `/ychack` route to `src/App.tsx` routing configuration
- Updated form submission to use "ychackathon" tracking tag
- Fixed TypeScript linter errors and maintained type safety
- Preserved all existing form validation and submission logic

### GitHub Repository Field Made Optional 🔧

**Changed**

- **GitHub Repository Field**: Removed mandatory requirement for GitHub repository URL in both YCHackForm and StoryForm
  - Updated backend `storyFormFields` to ensure GitHub field is set to `isRequired: false`
  - Added `ensureGitHubFieldOptional` mutation to prevent future issues
  - All dynamic form fields (LinkedIn, Twitter, GitHub, Chef links) are now properly optional
  - Forms now respect the backend `isRequired` setting for all dynamic fields

**Technical Details**

- Added `ensureGitHubFieldOptional` internal mutation in `convex/storyFormFields.ts`
- Verified all form components use `required={field.isRequired}` from backend configuration
- Confirmed GitHub field and all other dynamic fields are set to optional in database
- **Frontend Override**: Added explicit `required={field.key === "githubUrl" ? false : field.isRequired}` in both YCHackForm and StoryForm to ensure GitHub field is never required regardless of backend configuration
- Removed unused `Github` import from YCHackForm component

### Admin Tag Management for Content Moderation 🏷️

**Added**

- **Tag Management in Content Moderation**: Admins can now add existing tags to submissions directly from the Content Moderation interface
  - Added "Add Tag" button for each submission in the moderation view
  - Interactive tag selector showing available tags with emoji/icon support
  - Prevents duplicate tags by filtering out already assigned tags
  - Real-time UI updates after adding tags
  - Follows existing admin authentication patterns

**Technical Details**

- Added `addTagsToStory` mutation in `convex/stories.ts` with admin role validation
- Updated `ContentModeration.tsx` to include tag management UI and functionality
- Uses existing `api.tags.listAllAdmin` query for fetching available tags
- Maintains existing design patterns and responsive layout

### Navigation Submit Button Authentication 🚀

**Changed**

- **Header Submit Button**: Updated navigation submit button to show popup authentication dialog for logged-out users
  - Signed-in users: Button navigates directly to `/submit` page
  - Signed-out users: Button shows AuthRequiredDialog popup with sign-in prompt
  - Maintains consistent design and user experience across the app
  - Keeps `/resend` anonymous submission route unaffected

**Technical Details**

- Replaced `Link` component with `button` element with conditional logic
- Added `AuthRequiredDialog` component to Layout for authentication prompts
- Updated submit button behavior to check `isSignedIn` status before navigation
- Non-intrusive popup allows users to continue browsing without forced redirects

### Enhanced Submission Forms & User Identity 👤

**Form Improvements**

- **Updated Tagline Field**: Changed "App Project Tagline or Description" to "App/Project Tagline" (kept required)
- **New Description Field**: Added optional long-form description textarea with structured placeholder:
  - What it does
  - Key Features
  - How you built it
  - How are you using Resend
- **New "Your Name" Field**: Added required name field above email in both StoryForm and ResendForm
  - Required for all submissions (authenticated and anonymous)
  - Improves user attribution and communication

**Display & Admin Improvements**

- **Better Author Attribution**: Stories now show submitter's name from "Your Name" field instead of "Anonymous User"
  - Authenticated users: Shows form name + links to profile
  - Anonymous users: Shows form name only
- **Enhanced Admin Panel**: ContentModeration now displays submitter name alongside email instead of "Unknown"
  - Shows both logged-in user data AND form input name for better identification

**Backend Changes**

- **Schema Updates**: Added `longDescription` and `submitterName` fields to stories table
- **Mutation Updates**: Both `submit` and `submitAnonymous` now handle the new fields
- **Type Safety**: Updated all validators and type definitions for new fields

### Anonymous Submission System 📝

**Added**

- **New Anonymous Submission Route**: `/resend` allows users to submit apps without creating an account
  - Dedicated ResendForm component for anonymous submissions
  - Email required for communication purposes
  - Same functionality as authenticated submissions (tags, screenshots, social links)
  - Submissions appear in main app feed and admin panel like regular submissions

**Backend Changes**

- **New `submitAnonymous` Mutation**: Handles submissions without authentication requirements
  - Rate limiting by email (10 submissions per day per email)
  - Auto-approval for anonymous submissions
  - Proper logging for anonymous submissions
- **Schema Update**: Made `userId` optional in stories table to support anonymous submissions
- **TypeScript Fixes**: Resolved type compatibility issues for optional userId in validators and queries

### Authentication UX Improvements 🔐

**Added**

- **New AuthRequiredDialog Component**: Beautiful popup modal for authentication prompts
  - Matches app's design system with consistent styling
  - Provides clear call-to-action for sign-in with Clerk modal integration
  - Includes "Maybe Later" option for non-intrusive UX

**Changed**

- **Submit Page Access**: Removed login requirement to access `/submit` page
  - All users can now view the submit form and see what's required
  - Authentication check happens at form submission instead of route protection
  - Shows popup dialog if user attempts to submit without signing in

- **User Action Authentication**: Replaced redirects with popup notifications
  - **Voting/Upvoting**: Now shows popup instead of redirecting to sign-in page
  - **Rating**: Shows popup dialog instead of redirect
  - **Commenting**: Shows popup dialog instead of redirect (in StoryDetail)
  - **Bookmarking**: Updated to use popup instead of alert messages

**Improved**

- **Better User Experience**: Users can explore the submit form before deciding to sign in
- **Consistent Authentication Flow**: All user actions now use the same popup pattern
- **Non-intrusive Prompts**: Users aren't forced to sign in immediately, can continue browsing

**Technical Details**

- Created `AuthRequiredDialog` component using Radix UI Dialog
- Updated authentication handling in `StoryDetail.tsx`, `StoryList.tsx`, and `StoryForm.tsx`
- Removed `ProtectedLayout` wrapper from `/submit` route in `App.tsx`
- Updated navigation submit button to show as link for all users
- Maintained all existing authentication requirements for backend mutations

### Email Field for Story Submissions ✨

- **Story Form**: Added optional email input field with description "Hidden and for hackathon notifications"
- **Database**: Added email field to stories table schema to store submission emails
- **Admin Panel**: Updated ContentModeration component to display submitter email addresses and author information
- **Backend**: Enhanced story submission mutation to handle email field storage
- **Type Safety**: Updated all validators and TypeScript types to include email field support

### Content Moderation Improvements 🔧

- **Author Display**: Fixed ContentModeration to properly show author names and usernames for both stories and comments
- **Comment Enhancement**: Updated comment admin queries to include author information (name and username)
- **Better Organization**: Improved display formatting to show submitter details before timestamps
- **Type Safety**: Fixed TypeScript issues with proper type assertions for author data

## Previous Updates

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
