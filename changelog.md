# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Change Log](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Latest Updates

### [Fixed] - October 2, 2025

**Judging Group Error Handling**

- Fixed server error when accessing judging groups with deleted submissions
  - **Root Cause**: Query threw an error when a story referenced in judgingGroupSubmissions no longer existed
  - **Impact**: Judges saw blank page with "Server Error" when trying to access groups with deleted stories
  - **Fix Applied**: Updated `getJudgeProgress` query to gracefully handle missing stories
  - Query now skips submissions where story has been deleted or archived
  - Progress calculations now based only on submissions with valid stories
  - No more server crashes when stories are removed from system

**Judging Progress Calculation & Display**

- Fixed judging progress calculation to accurately reflect completion status
  - **Root Cause**: Progress was calculated based on individual criterion scores rather than submission completion status
  - **Impact**: Judges saw incorrect progress percentages and misaligned submission counts
  - **Fix Applied**: Updated `getJudgeProgress` query to check `submissionStatuses` table for completed submissions
  - Progress now correctly counts submissions with status "completed" assigned to current judge
  - Completion percentage now based on completed submissions count, not individual scores
- Fixed submission navigation counter alignment
  - **Root Cause**: Frontend showed all submissions while progress showed only available ones
  - **Impact**: "Submission X of Y" counter didn't match progress "X/Y submissions" display
  - **Fix Applied**: Added `useMemo` hook to filter submissions based on judge's available list
  - Only shows submissions with status: pending, skip, or completed by current judge
  - Submissions completed by other judges are now hidden from judge's view
  - Navigation counter and progress display now properly synchronized

**Technical Implementation**

- **Backend Changes** (`convex/judges.ts`):
  - Modified `isComplete` logic to check `submissionStatuses` table
  - Changed from `criteriaScored === totalCriteria` to `submissionStatus?.status === "completed" && submissionStatus?.assignedJudgeId === judge._id`
  - Updated `completionPercentage` calculation to count completed submissions instead of scores
  - Formula changed from `(completedScores / totalScores)` to `(completedSubmissionsCount / totalSubmissions)`

- **Frontend Changes** (`src/pages/JudgingInterfacePage.tsx`):
  - Added `useMemo` hook to filter `allSubmissions` based on `judgeProgress.submissionProgress`
  - Creates `availableSubmissionIds` Set from judge's available submissions
  - Filters submissions to only show those available to current judge
  - Reordered `judgeProgress` query before `submissions` filter to fix dependency order

**User Benefits**

- Accurate progress tracking reflects actual completion status
- No confusion between progress percentage and submission counter
- Judges only see submissions they should be judging
- Previously completed submissions correctly counted in progress
- Clean, consistent judging experience across all metrics

### [Enhanced] - October 2, 2025

**Inbox User Blocking & Reporting**

- Added user blocking feature in inbox conversations
  - Block button (Ban icon) in conversation header next to report and delete buttons
  - Block/unblock toggle functionality with custom modal confirmations
  - Blocked users cannot send messages to users who blocked them
  - Clean error banner displays "You have been blocked by this user" instead of console errors
  - Icon styled in light grey (#787672) with hover to black (#292929)
  - Real-time block status checking and UI updates
  - Custom modals match site design (black/white, clean typography)

- Enhanced user reporting in inbox
  - User reports from inbox now integrate with admin UserReportManagement dashboard
  - Reports appear in both dmReports and userReports tables
  - Automatic email notifications sent to all admins and managers when users are reported
  - Uses existing admin email notification system (bypasses global email toggle)
  - Prevents self-reporting with validation
  - Report submissions include reason and timestamp
  - Custom report modal with textarea (500 character limit) replaces browser prompts
  - Clean, site-matching UI design for all modals and confirmations

**Database Schema**

- Added blockedUsers table with indexes:
  - by_blocker_blocked: Check if specific user is blocked
  - by_blocker: Get all users blocked by someone
  - by_blocked: Get all users who blocked someone

**UI Improvements**

- Redesigned Inbox page with messenger-style 3-column layout
  - **Left Column**: Conversations list with improved card design and rounded borders
  - **Middle Column**: Messages area with cleaner chat bubbles and improved typography
  - **Right Column**: Community sidebar featuring "Most Vibes This Week", "Recent Vibers", and "Top Categories This Week" (visible on XL screens)
  - Changed from full-viewport fixed layout to container-based layout with `h-[calc(100vh-12rem)]`
  - Updated color scheme to match site design system using `#292929`, `#D8E1EC`, `#F2F4F7`, `#787672`
  - Improved conversation list items with better spacing and unread badge styling
  - Enhanced message input with rounded corners and refined button styling
  - Better visual hierarchy with consistent borders and background colors
  - Responsive design: Single column on mobile, 2 columns on tablet, 3 columns on desktop (XL+)

**Features**

- Added report user functionality in inbox
  - Report button (Flag icon) in conversation header next to delete button
  - Click to report a user for inappropriate behavior
  - Provides prompt for detailed reason
  - Reports submitted to admin moderation queue
  - Icon styled in light grey (#787672) with hover to black
  - Uses existing `reportMessageOrUser` mutation for admin review

- Enhanced inbox conversation deletion and sync behavior
  - Conversations use soft delete (hidden from your view, not deleted from database)
  - When you delete a conversation, **all existing messages are marked as deleted** and hidden from your view
  - **NEW: Message sync fixed** - When someone sends you a message after you deleted the conversation, it automatically reappears in your inbox
  - `sendMessage` mutation now checks and removes recipient's deletion record when sending
  - **Only NEW messages** (sent after you deleted) will be visible - old messages stay hidden
  - Fresh conversation experience when restarting chats after deletion
  - Real-time conversation restoration when receiving new messages

- Clickable usernames and @mentions in inbox
  - @username mentions in chat messages are now clickable links
  - Usernames in conversation list (left sidebar) are clickable with hover underline
  - Username in chat header (top of conversation) is clickable
  - All username links navigate directly to user profiles
  - Links styled in blue for @mentions, standard text color for names
  - No hover cards, just clean direct links to profiles

**Bug Fixes**

- Fixed missing input box when starting new conversation after deletion
  - **Root cause**: `upsertConversation` was only removing the other user's deletion record, not your own
  - Now removes **both** current user's and recipient's deletion records when restarting conversation
  - Added new `getConversation` query to fetch individual conversation details as fallback
  - Uses fallback query when conversation not yet in `listConversations` (timing issue)
  - Input box and conversation header now render immediately when starting new chat
  - Prevents "undefined" conversation state when navigating from profile "Message" button
  - Fixed useEffect dependency array warning by removing unstable navigate function

- Fixed deleted conversations still appearing in inbox
  - Added automatic clearing of selected conversation when it no longer exists in the list
  - Navigation now uses `replace: true` to properly clear the URL state
  - Conversation automatically disappears from view immediately after deletion
  - Added useEffect hook to monitor conversation list and auto-clear stale selections

- Fixed deleted conversations showing old messages when restarted
  - When deleting a conversation, all messages are now marked as deleted for that user
  - Old messages from deleted conversations no longer appear when someone messages you again
  - Creates true "fresh start" experience for restarted conversations
  - Both `deleteConversation` and `clearInbox` now properly hide all existing messages

- Fixed "Not authenticated" errors in inbox
  - Added authentication check before calling `markConversationRead` mutation
  - Made mutation gracefully handle unauthenticated state during page load
  - Prevents error spam in console when opening inbox before Clerk auth finishes loading
  - Mutation now silently returns null instead of throwing errors when user not authenticated

- Fixed inbox page scrolling behavior
  - Updated conversation list and messages area to have independent scrolling with `overflow-hidden` and `overflow-y-auto`
  - Changed auto-scroll behavior from "smooth" to "auto" with `block: "end"` to prevent triggering page scroll
  - Both conversation list and chat window now scroll independently within their containers
  - Page no longer scrolls when clicking messages or sending new messages

### [Fixed] - October 1, 2025

**Bug Fixes**

- Fixed "Invalid Date" display on judging interface page by adding `_creationTime` field to submission data
  - Updated `getGroupSubmissions` query to include `_creationTime` in return validator
  - Submission dates now display correctly showing when apps were originally submitted

### Inbox Messaging System ✅ FULLY IMPLEMENTED

**Added - Complete Direct Messaging Infrastructure**

- **Direct Messaging System**: Users can now send text-only direct messages to each other with comprehensive features
  - **Conversation Management**: Automatic conversation creation with participant tracking
  - **Real-time Updates**: Live message updates powered by Convex subscriptions
  - **Message Threading**: Chronological message display with smooth scrolling
  - **Character Limit**: 2000 character maximum per message for focused communication
  - **No File Attachments**: Simplified text-only messaging for clarity and moderation

- **@Mentions Integration**: Full mention support within direct messages
  - **Autocomplete**: LinkedIn-style @username autocomplete using MentionTextarea component
  - **Profile Links**: @mentions render as clickable profile links
  - **Mention Notifications**: Mentioned users receive notifications (future enhancement)
  - **Quota Enforcement**: Uses existing mention system quotas

- **Edit & Delete Functionality**: Message management capabilities
  - **24-Hour Edit Window**: Users can edit their messages within 24 hours of sending
  - **Edit History Tracking**: System records when messages are edited with timestamps
  - **Delete Anytime**: Users can delete their own messages at any time
  - **Visual Indicators**: Edited messages show "(edited)" label
  - **Edit UI**: Inline edit form with cancel option and character counter

- **Rate Limiting & Spam Prevention**: Comprehensive anti-spam measures
  - **New Conversation Limit**: 10 new conversations per 30 minutes per user
  - **Message Limit**: 50 messages per hour per user
  - **Automatic Reset**: Rate limit windows reset after time period expires
  - **User Feedback**: Clear error messages when rate limits are reached
  - **Database Tracking**: Rate limit tracking stored in dedicated table

- **Admin Reporting Integration**: Content moderation support
  - **Report Messages**: Users can report inappropriate direct messages
  - **Admin Dashboard**: Reports appear in admin content moderation panel
  - **Context Preservation**: Reports include full message context
  - **Admin Actions**: Admins can review and take action on reported messages
  - **Email Alerts**: Admin alert emails for reported messages (future enhancement)

- **Notification System**: Real-time inbox notifications
  - **Inbox Badge**: Inbox icon shows badge with unread message count
  - **Notification Alerts**: Users receive notifications for new messages
  - **Read Status**: Messages marked as read when conversation is viewed
  - **Persistent Indicator**: Unread count persists until messages are viewed

- **Email Notifications**: Separate inbox email system
  - **New Message Emails**: Users receive email notifications for new messages
  - **Independent System**: Inbox emails separate from daily digest
  - **Email Preferences**: Users can control inbox email settings
  - **Rate Limiting**: Email notification rate limiting to prevent spam

**Technical Implementation**

- **Database Schema**: Added complete messaging schema in `convex/schema.ts`
  - `directMessages` table with message content, edit tracking, and timestamps
  - `conversations` table with participant management and last message tracking
  - `messageRateLimits` table for spam prevention
  - Indexes: `by_conversation`, `by_sender`, `by_participants` for efficient queries
- **Backend Functions**: Complete messaging API in `convex/dm.ts`
  - `getOrCreateConversation`: Conversation initialization with participant validation
  - `sendMessage`: Message sending with rate limiting and validation
  - `getConversation`: Conversation retrieval with participant verification
  - `getMessages`: Message listing with pagination support
  - `editMessage`: Message editing with 24-hour window enforcement
  - `deleteMessage`: Soft delete with ownership validation
  - `markAsRead`: Read status tracking for notifications
  - `getConversations`: Conversation list with unread counts
  - `getUnreadCount`: Unread message counter for badge display
  - Rate limiting helpers and validation functions

- **Frontend Components**: Full-featured inbox interface in `src/pages/InboxPage.tsx`
  - **Responsive Layout**: Split-view design with conversation list and message thread
  - **Conversation List**: Shows all conversations with last message preview
  - **Message Thread**: Displays all messages in chronological order
  - **Message Composer**: MentionTextarea with @mention autocomplete
  - **Edit Interface**: Inline editing with cancel and save options
  - **Delete Confirmation**: Dialog confirmation before message deletion
  - **Loading States**: Skeleton loaders for better UX
  - **Error Handling**: Toast notifications for errors and success
  - **Mobile Responsive**: Works seamlessly on all device sizes

- **Navigation & Access**: Seamless integration with existing app
  - **Header Link**: "Inbox" navigation link with unread badge in header
  - **Protected Route**: Inbox page requires authentication
  - **Direct URLs**: Support for deep linking to specific conversations
  - **Profile Integration**: Message users directly from profile pages (future)

- **Notification Integration**: Enhanced notification system
  - Updated `convex/alerts.ts` to support message notifications
  - Added "message" type to notification schema
  - Badge display in header with unread count
  - Notification creation on new message receipt

**User Benefits**

- **Direct Communication**: Users can communicate privately without leaving the platform
- **Spam Protection**: Rate limiting ensures quality conversations
- **Content Control**: Edit/delete functionality gives users message control
- **Moderation**: Admin reporting keeps the platform safe
- **Real-time Experience**: Instant message delivery and notifications
- **Privacy**: Conversations are private between participants only

**Testing Completed**

- [x] Conversation creation and message sending
- [x] Rate limiting enforcement (both conversation and message limits)
- [x] Edit functionality within 24-hour window
- [x] Delete functionality with confirmation
- [x] @Mention autocomplete and rendering
- [x] Admin reporting integration
- [x] Notification badge display
- [x] Email notification delivery
- [x] Mobile responsive design
- [x] Error handling and edge cases

### Enhanced Tag Selection in Submission Editing 🏷️ NEW

**Added - Advanced Tag Management for User Edits**

- **Enhanced Tag Selection**: Users can now search and add/remove tags when editing their submissions (matching StoryForm.tsx functionality)
  - **All Tags Dropdown Search**: Type to search through all tags including hidden ones
  - **Visual Tag Display**: Shows tag colors, emojis, and icons in both visible tags and dropdown
  - **Hidden Tag Access**: Users can select tags that admins have hidden from the header display
  - **Create New Tags**: Enter key or "Create new tag" button to add custom tags
  - **Smart Filtering**: Excludes already selected tags from search results
  - **Click Outside to Close**: Dropdown closes when clicking outside for better UX
  - **10-Tag Limit**: Comprehensive validation prevents selection beyond 10 total tags
  - **Selected Tags Display**: Dedicated section showing all selected tags with remove buttons
  - **Tag Counter**: Shows current selection count with maximum (e.g., "Selected Tags (3/10)")
  - **Visual Indicators**: "(New)" label for newly created tags, "(Hidden)" for hidden tags

- **Tag Change Tracking**: All tag modifications automatically tracked in submission changelog
  - Shows which tags were added (green)
  - Shows which tags were removed (red)
  - Displays tag names in easy-to-read format
  - Includes in overall edit history with timestamps

**Technical Implementation**

- **Frontend Updates**: Enhanced `StoryDetail.tsx` with comprehensive tag management
  - Added `allTags` query to fetch all tags including hidden ones
  - Added dropdown search state and handlers
  - Implemented `handleSelectFromDropdown` and `handleAddNewTag` functions
  - Added `handleRemoveNewTag` for managing new tag creation
  - Enhanced `toggleTag` with 10-tag limit validation
  - Added click-outside handler for dropdown auto-close
  - Replaced simple tag buttons with full dropdown search UI

- **State Management**: Added new state variables for tag editing
  - `dropdownSearchValue`: Tracks search input
  - `showDropdown`: Controls dropdown visibility
  - `newTagNames`: Manages newly created tags before submission

- **UI Components**: Comprehensive tag selection interface
  - Visual tag buttons with emoji/icon support
  - Dropdown search with 10-result limit for performance
  - Selected tags display section with remove functionality
  - Error messages for tag limit and validation
  - Consistent styling with existing design system

**User Benefits**

- **Enhanced Flexibility**: Search and select from all tags including hidden ones
- **Better UX**: Same powerful tag management as initial submission form
- **No Limitations**: Users can update tags just as easily as creating new submissions
- **Visual Feedback**: Clear indication of selected, new, and hidden tags
- **Change Tracking**: All tag modifications tracked in changelog for transparency

**Integration Notes**

- Works seamlessly with existing changelog system
- No breaking changes to existing tag functionality
- Maintains 10-tag limit across all tag selection methods
- Consistent with StoryForm.tsx tag management experience

### Submission Change Log Tracking 📝

**Added - Comprehensive Edit History Tracking**

- **New Feature**: Added detailed change log tracking for user submission edits
  - Always visible below the "Rate this app" section on story detail pages
  - Shows original submission date/time at the top with clear separator
  - Shows all edits made by the submission owner with date and time in user's local timezone
  - Displays friendly message when no changes have been made yet
  - Collapsible entries (closed by default) with clean toggle UI
  - Tracks text changes (title, tagline, description, name)
  - Tracks link changes (app URL, LinkedIn, Twitter/X, GitHub, etc.)
  - Tracks tag additions and removals
  - Notes video changes (indicates video was updated but doesn't show old/new)
  - Notes image changes (indicates screenshots or gallery images were updated)
- **Navigation Enhancements**:
  - Added "View Change Log" link in Project Links & Tags sidebar (desktop)
  - Added "View Change Log" link in mobile Project Links & Tags section
  - Added "View Change Log" button on Judging Interface page
  - All links use anchor navigation (#changelog) for smooth scrolling
  - Changelog section has scroll-mt-20 for proper positioning when navigating

**Technical Implementation**

- **Database Schema**: Added `changeLog` field to stories table in `convex/schema.ts`
  - Stores array of changelog entries with timestamps
  - Each entry includes textChanges, linkChanges, tagChanges, videoChanged, and imagesChanged
- **Mutation Updates**: Enhanced `updateOwnStory` mutation in `convex/stories.ts`
  - Compares old and new values for all fields
  - Creates detailed changelog entry for each edit
  - Automatically appends to existing changelog array
- **UI Component**: Added changelog section to StoryDetail component
  - Displays changes in an organized, readable format
  - Text changes show old (strikethrough red) and new (green) values
  - Link changes show old and new URLs
  - Tag changes list added and removed tags
  - Video and image changes show simple notification
  - Date/time formatted using browser's locale settings

**User Benefits**

- Transparency: Users can see full edit history of submissions
- Accountability: Track what changed and when
- Trust: Community can verify accuracy and authenticity of edits
- History: Preserve record of submission evolution over time

### Project Documentation Organization 📁

**Changed - PRD Files Reorganization**

- **Folder Structure**: Moved all PRD (Product Requirements Document) files from project root to dedicated `prds/` folder
  - **Improved Organization**: Cleaner root directory with better separation of documentation types
  - **Files Moved**: All `.md` and `.MD` PRD files now organized under `prds/` directory
  - **Preserved Files**: Core documentation remains in root: `README.md`, `changelog.MD`, `files.MD`, `TASK.MD`
  - **Better Navigation**: Easier to find feature specifications and implementation plans

**Technical Details**

- Created new `prds/` directory for all Product Requirements Documents
- Moved 17 PRD files from root to `prds/` folder:
  - `addresend.md`, `adminalerrtemails.md`, `adminroles.md`, `alerts.md`
  - `clerk-admin-fix.MD`, `clerksubmit.md`, `codeblocksinsubmit.md`
  - `following-plan.MD`, `friendsonlyinbox.md`, `howtojudge.md`
  - `judgingsetup.md`, `mentions.md`, `metadataforsubs.md`
  - `moreimages.md`, `newsubmit.md`, `recentusers.md`, `themss.MD`
- Updated documentation references to point to new `prds/` folder location
- No impact on application functionality or codebase

### Email Testing Improvements 🧪

**Added - Clear Email Logs for Testing**

- **New Feature**: Added ability to clear today's email logs for testing purposes
  - New mutation: `clearTodaysEmailLogs` in `convex/testDailyEmail.ts`
  - Allows clearing all email logs or specific email type logs from today
  - Enables re-testing of daily/weekly emails without waiting for the next day
  - Admin-only access with proper authorization checks
- **UI Enhancement**: Added "Clear Today's Email Logs" button in Email Management dashboard
  - Located in the "Test Emails" section
  - Shows confirmation dialog before clearing logs
  - Displays count of cleared logs on success
  - Orange button design to distinguish from test buttons

**Production vs Development Behavior**

- **Production**: Email system works automatically with no manual intervention
  - Date-based duplicate prevention resets at midnight PST automatically
  - Users receive daily/weekly emails without manual log clearing
  - Cron jobs run on schedule (9 AM, 6 PM PST) without conflicts
  - System self-manages duplicate prevention
- **Development**: Clear logs utility enables multiple tests per day
  - Admins can test emails repeatedly during development
  - Only affects today's logs - historical data preserved
  - Optional email type filtering for targeted testing
  - Helps debug email issues without waiting 24 hours

### Email System Debugging & Fixes ✅ COMPLETED

**Fixed - Weekly Digest & Daily User Engagement Emails**

- **Root Cause Analysis**: Identified why weekly digest and daily user engagement emails weren't sending
  - **Weekly Digest Issue**: Function was returning early if no apps had vibes, sending NO emails to anyone
  - **Daily User Emails Issue**: Lacked visibility into processing status and data generation
  - **Test Functions Issue**: 5-second delay was insufficient for processing completion
- **Comprehensive Logging Added**:
  - Weekly digest now logs: app count, user count, emails sent, emails skipped
  - Daily engagement now logs: engagement summaries found, mentions found, unique users to process, processing progress
  - Processing function now logs: stories found, authors processed, summaries created
  - All email sending functions now report final counts
- **Fixed Weekly Digest Logic**:
  - Removed early return when no apps have vibes - emails now sent regardless
  - Added detailed console logging at every stage
  - Added counters for emails sent vs skipped
  - Better visibility into why emails might be skipped
- **Enhanced Daily User Engagement**:
  - Added comprehensive logging for debugging
  - Better tracking of processing pipeline
  - Clear visibility into data generation
  - Improved skip reason tracking
- **Improved Test Functions**:
  - Increased delay from 5 seconds to 30 seconds for daily user email test
  - Added helpful messages directing admins to check Convex logs
  - Better error handling and user feedback
- **Removed "Online/Active" Restrictions**:
  - Removed all references to not sending emails if user is "currently online/active"
  - Updated PRD documentation (`addresend.md`) to clarify emails are sent regardless of activity status
  - Ensures all eligible users receive their emails without activity-based filtering

**Technical Implementation**

- **Files Modified**:
  - `convex/emails/weekly.ts`: Added logging, removed early return, added counters
  - `convex/emails/daily.ts`: Added comprehensive logging throughout processing and sending
  - `convex/testDailyEmail.ts`: Improved test reliability with longer delays and better messaging
  - `addresend.md`: Removed online/active check references, clarified email sending behavior
- **Logging Strategy**: All email functions now log at key decision points:
  - Data fetching (how many records found)
  - User processing (how many users to email)
  - Skip reasons (why emails were skipped)
  - Final results (emails sent vs skipped)
- **No Linter Errors**: All changes verified with no TypeScript or linting issues

**Testing Instructions**

1. Check Convex logs when cron jobs run or when using admin test buttons
2. Look for log messages like:
   - "Weekly digest: Found X apps with vibes"
   - "Daily user emails: Found X engagement summaries"
   - "Processing engagement for X unique authors"
   - "Created X engagement summaries"
   - "Weekly digest complete: X emails sent, Y skipped"
   - "Daily user emails complete: X emails sent, Y skipped"

### Bulk Selection & Actions for Content Moderation ✅ COMPLETED

**Added - Bulk Operations for Submissions Management**

- **Bulk Selection System**: Admins can now select multiple submissions at once for batch operations
  - **Checkbox Selection**: Each submission has a checkbox for individual selection
  - **Select All/Deselect All**: Quick toggle for all visible submissions on current page
  - **Visual Feedback**: Selected items highlighted with blue background
  - **Selection Counter**: Shows count of currently selected submissions

- **Bulk Actions Bar**: Appears automatically when submissions are selected
  - **Add Tag**: Apply a tag to all selected submissions at once
  - **Remove Tag**: Remove a tag from all selected submissions at once (NEW)
  - **Add to Judging Group**: Add multiple submissions to a judging group in one action
  - **Delete Selected**: Bulk delete with confirmation dialog
  - **Clear Selection**: Quick button to deselect all items

- **Smart State Management**:
  - Selections automatically clear when switching between Submissions and Comments tabs
  - Selections clear after completing bulk actions
  - Cancel buttons to exit action modes without applying changes
  - Success toasts show number of affected items

**Technical Implementation**

- **Backend**: Added `removeTagsFromStory` mutation in `convex/stories.ts` for bulk tag removal
- **Frontend**: Enhanced `ContentModeration.tsx` with:
  - Set-based selection state for efficient tracking
  - Separate action modes (tag, removeTag, judging)
  - Promise.all for parallel bulk operations
  - Toast notifications for user feedback
- **UI/UX**: Maintains all existing individual actions, fully additive feature
- **Performance**: Optimized bulk operations with parallel promise execution

### Email Template Profile Link Fixes ✅ COMPLETED

**Fixed - Email Profile URL Issues**

- **Profile Link Format Fix**: Fixed all email templates to use correct username-based URLs instead of userId-based URLs
  - **Problem**: Email templates were generating links like `/user/ks71bgz29jgvx28xsgjtdhx8b97rgbjj` instead of `/username`
  - **Solution**: Updated all email templates in `convex/emails/templates.ts` to use `/${username}` format
  - **Impact**: All email profile links now work correctly and match the app's URL structure

- **Username Setup Flow Enhancement**: Fixed email fallback logic for new users without usernames
  - **Problem**: New users receive welcome emails before completing username setup, causing broken profile links
  - **Root Cause**: Users created via Clerk don't immediately have usernames set in Convex database
  - **Solution**: Updated email template logic with three-tier fallback system:
    - If user has username: `https://vibeapps.dev/username` (direct to profile)
    - If user exists but no username: `https://vibeapps.dev/set-username` (setup flow)
    - If no user data: Sign-in page with redirect
  - **Welcome Email Enhancement**: Updated welcome email content to guide users through profile setup

- **Mention Email Template Fix**: Fixed missing parameters in mention email template
  - **Added**: `userId` and `userUsername` parameters to mention email template calls
  - **Fixed**: Template parameter validation errors in mention notification system

**Technical Implementation**

- **Files Updated**: `convex/emails/templates.ts`, `convex/emails/mentions.ts`
- **Logic Enhancement**: `userUsername ? /username : userId ? /set-username : /sign-in`
- **Template Consistency**: All email templates now use consistent URL generation logic
- **User Experience**: New users get properly guided through username setup process via email links

### Admin Alert Email System & Inbox Messaging PRDs ✅ COMPLETED

**Added - Comprehensive Admin Alert & Messaging System PRDs**

- **Admin Alert Emails PRD**: Created `adminalerrtemails.md` with complete specification for immediate admin email notifications
  - **Story Report Alerts**: Instant email notifications to all admin/manager users when content is reported
  - **Message Report Integration**: Future-ready system for inbox message report notifications
  - **User Report System**: Extensible framework for user-to-user reporting with admin alerts
  - **Email Templates**: Professional HTML templates with VibeApps branding and actionable admin links
  - **Integration Points**: Seamless integration with existing `convex/reports.ts` and alert system
  - **Rate Limiting**: No rate limits for critical admin notifications to ensure immediate delivery
  - **Resend Integration**: Built on existing email infrastructure with proper logging and tracking

- **Enhanced Inbox Messaging PRD**: Updated `inboxforapp.md` with comprehensive messaging system specification
  - **Text-Only Messages**: Simplified messaging with 2000 character limit (no file attachments)
  - **@Username Mentions**: Full integration with existing mention system and autocomplete
  - **Message Edit/Delete**: Users can edit messages within 24 hours and delete their own messages anytime
  - **Rate Limiting**: Comprehensive spam prevention (10 new conversations per 30 min, 50 messages per hour)
  - **Admin Integration**: Message reporting with immediate admin email notifications
  - **Real-time Notifications**: Integration with existing notification system in header dropdown
  - **Email Notifications**: Separate inbox email system (not part of daily digest emails)

**Technical Implementation**

- **Database Schema**: Complete schema design with rate limiting tables and message edit tracking
- **Backend Functions**: Detailed function specifications with TypeScript validation
- **Frontend Components**: Component architecture using existing UI patterns and MentionTextarea
- **Admin Dashboard**: Message moderation panel integrated with existing admin interface
- **Email System**: Leverages existing Resend infrastructure with new template types

**Documentation Updates**

- **files.MD**: Updated with new PRD files and enhanced feature descriptions
- **Enhanced Descriptions**: Added admin alert email integration and inbox messaging capabilities
- **Implementation Pointers**: Clear guidance for developers on where to implement new features

## Previous Updates

### Mobile UI Improvements ✅ COMPLETED

**Enhanced Mobile Experience**

- **Mobile Project Links & Tags**: Added dedicated mobile section for Project Links & Tags that appears above video demo on mobile devices while preserving desktop sidebar layout
- **Comment Length Adjustment**: Reduced minimum comment character requirement from 50 to 10 characters for better user experience
- **Mobile ProfileHoverCard**: Disabled ProfileHoverCard hover functionality in notifications dropdown on mobile devices to prevent UI conflicts
- **Responsive Design**: Maintained desktop functionality while improving mobile usability across story detail pages

## Previous Updates

### Recent Vibers Sidebar Component ✅ COMPLETED

**Added - User Discovery Feature**

- **Recent Vibers Component**: New sidebar section displaying 25 most recently joined users as circular profile avatars
- **Backend Query**: `getRecentVibers` function in `convex/users.ts` with proper filtering for banned users and username requirements
- **ProfileHoverCard Integration**: Seamless hover functionality showing user details with 500ms delay
- **Grid Layout**: 5x5 responsive grid with loading states and empty state handling
- **User Navigation**: Direct profile linking via username routes
- **Visual Design**: Consistent styling with existing sidebar components, verified badges, and smooth hover transitions
- **Accessibility**: Proper alt text, keyboard navigation, and screen reader support

### Enhanced ProfileHoverCard Support ✅ COMPLETED

**Added - Comment @Mentions Hover Cards**

- **@Mentions Integration**: All @username mentions in comments now display ProfileHoverCard on hover
- **Enhanced Mentions Utility**: Updated `renderTextWithMentions` function in `src/utils/mentions.tsx` to wrap mention links with ProfileHoverCard
- **Consistent UX**: Users can now hover over any @mention in comments to see profile details, bio, social links, and verification status
- **Smart Positioning**: ProfileHoverCard automatically adjusts position to prevent overflow on screen edges

### Resend Email Infrastructure Implementation ✅ COMPLETED

**Added - Production Ready Email System**

- **Complete Email Infrastructure**: Production-ready Resend integration using Convex Resend Component with `testMode: false`
- **Email Templates**: `convex/emails/templates.ts` with admin reports, welcome, engagement, weekly digest, and mention templates
- **Core Email Sending**: `convex/emails/resend.ts` with logging, global kill switch, and proper error handling
- **Daily Processing**: `convex/emails/daily.ts` for metrics calculation and user engagement processing with fixed validators
- **Weekly Digest**: `convex/emails/weekly.ts` for "Most Vibes This Week" computation and sending
- **Welcome Integration**: `convex/emails/welcome.ts` for new user onboarding emails
- **Email Database**: Complete schema with `emailLogs`, `dailyEngagementSummary`, `dailyMetrics`, `emailUnsubscribeTokens`, `broadcastEmails`, `appSettings`
- **Automated Cron Jobs**: Daily admin reports (9 AM PST), engagement processing (5:30 PM PST), user emails (6 PM PST), weekly digest (Monday 9 AM PST)
- **Webhook Handler**: `/resend-webhook` endpoint for email delivery tracking and status updates
- **Email Preferences UI**: Complete user profile integration with unsubscribe/resubscribe modal confirmations
- **Admin Controls**: Global email toggle, broadcast system with user search, and test email functionality
- **Force Logout System**: Admin can force all users to re-login to sync missing email addresses from Clerk
- **Email Testing**: Admin test buttons for daily/weekly emails and individual email sending

**Technical Fixes Applied**

- **Validator Errors**: Fixed `storeDailyMetrics` validator to include `date` field and proper field mapping
- **Resend Configuration**: Disabled test mode (`testMode: false`) to send to real email addresses
- **Function Separation**: Split Node.js actions from V8 queries/mutations across proper files
- **Type Safety**: Fixed all TypeScript errors with proper validators and return types
- **Email Extraction**: Fixed Clerk identity email extraction to prioritize `identity.email` over `identity.emailAddress`
- **User Search**: Fixed broadcast email user search with proper email filtering and debugging tools
- **Template Literal**: Fixed syntax errors in admin UI template literals

**Modified Files**

- `convex/schema.ts`: Added all email-related tables with proper indexes and validators
- `convex/sendEmails.ts`: Enforced subject prefix and from address, disabled test mode
- `convex/settings.ts`: Added public/internal queries for admin controls and global kill switch
- `convex/users.ts`: Integrated welcome email triggers and email sync debugging
- `convex/crons.ts`: Added all email cron jobs with proper scheduling
- `convex/http.ts`: Added Resend webhook handler with proper routing
- `src/pages/UserProfilePage.tsx`: Added email preferences with modern modal UI
- `src/components/admin/EmailManagement.tsx`: Complete admin email management interface
- `addresend.md`: Updated to reflect completed implementation status

### Resend Email PRD Alignment and Mentions Fanout (Docs)

**Added**

- `addresend.md`: Chronological plan, schemas, cron specs for daily admin report, daily user engagement digest, weekly “Most Vibes,” unsubscribe tokens, admin broadcast, global kill-switch
- @Mentions email notifications PRD aligned with `mentions.md` (comments and judging notes), distinct quotas (30/day creation vs 10/day email fanout)
- Alerts cross-reference: admin report notification email type `admin_report_notification` documented

**Modified**

- `README.md`: Email integration section updated to reflect Resend PRD and mentions emails
- `files.MD`: Synced descriptions for `addresend.md`, `alerts.ts`, and `http.ts` unsubscribe endpoint outline

**Notes**

- No runtime code changes in this entry; documentation only to prepare for Resend integration

### Admin Report Notifications System

**Added**

- Admin report notifications: Admin and manager users now receive notifications when users report submissions
- Report notifications appear in both the header dropdown and notifications page for admins/managers
- Email integration specifications added to `addresend.md` for future implementation
- Internal function to get all admin/manager users for notification targeting

**Modified**

- `convex/schema.ts`: Added "report" type to alerts type union
- `convex/alerts.ts`: Added validators and functions for report notifications
- `convex/reports.ts`: Added notification creation when users report submissions
- `src/pages/NotificationsPage.tsx`: Added handling for report notification display
- `src/components/Layout.tsx`: Added report notification text in dropdown
- `addresend.md`: Added admin report notification email specifications

### Enhanced Notification System

**Added**

- Bookmark notifications: Users now receive notifications when someone bookmarks their apps
- Vote notifications: Users receive notifications when someone votes/vibes their apps (already existed, verified working)
- Updated notification text in both the dropdown and notifications page to include bookmark actions

**Modified**

- `convex/schema.ts`: Added "bookmark" type to alerts type union
- `convex/alerts.ts`: Updated validators to include bookmark type
- `convex/bookmarks.ts`: Added notification creation when users bookmark apps
- `src/pages/NotificationsPage.tsx`: Added handling for bookmark notification display
- `src/components/Layout.tsx`: Added bookmark notification text in dropdown

## Previous Updates

### Submit Forms, Public Results, and ConvexBox

**Added**

- Admin submit form tooling:
  - `CreateSubmitFormModal`, `EditSubmitFormModal`
  - `SubmitFormFieldManagement` for per-form fields
- Public-facing submit form renderer: `DynamicSubmitForm`
- Public judging artifacts:
  - `PublicJudgingResultsDashboard`
  - `PublicResultsViewer`
- ConvexBox configuration UI: `ConvexBoxSettingsForm` and `convex/convexBoxConfig.ts`
- Clerk ↔ Convex synchronization: `UserSyncer`
- Backend utilities: `convex/migrations.ts`

**Changed**

- Documentation refresh:
  - README: Added Recent Updates section
  - files.MD: Synced file inventory and new modules
- Standardized terminology in docs: Lightbox, `Vite`, `shadcn/ui`, `Netlify`, Node 18 wording

**Technical**

- No schema changes; added UI and docs, plus non-breaking backend utilities

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

- **All Tags Dropdown Search**: Added new search dropdown on `StoryForm.tsx` that includes ALL available tags (including hidden ones)
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
  - Auto-adds `ychackathon` tracking tag to submissions
  - Maintains all existing functionality (file uploads, dynamic fields, tag selection)
  - **Hidden Sidebar**: Removed WeeklyLeaderboard and TopCategoriesOfWeek sidebar components from YC Hackathon form page for focused submission experience

**Technical Details**

- Created `src/components/YCHackForm.tsx` component (TypeScript React file)
- Added `/ychack` route to `src/App.tsx` routing configuration
- Updated form submission to use `ychackathon` tracking tag
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
- **New Description Field**: Added optional long-form description text area with structured placeholder:
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

### Planned

- Clerk roles for hackathon organizers to access judges section only in admin
- Alerts when an admin pins or posts a message to their own app
- Fix links used in weekly digest emails
- Inbox feature with email notifications
- Post notification emails via Resend (update `convex/emails/templates.ts`)
- User toggle to turn off email notifications in profile

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
