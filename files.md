# VibeApps Codebase Files

## Root Directory Structure

### Configuration Files

- `package.json`: Project dependencies and scripts configuration
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript configuration files
- `vite.config.ts`: `Vite` build tool configuration
- `tailwind.config.js`: Tailwind CSS styling configuration
- `postcss.config.js`: PostCSS configuration for CSS processing
- `eslint.config.js`: ESLint code quality and style configuration (flat config; includes `@convex-dev/eslint-plugin` recommended rules for Convex best practices)
- `components.json`: `shadcn/ui` components configuration
- `bun.lockb`: Bun package manager lock file

### Documentation Files

- `README.md`: Main project documentation and setup guide
- `changelog.MD`: Developer-friendly change log of new features
- `files.MD`: This file - comprehensive codebase documentation
- `TASK.MD`: Project task and feature requirements
- `AGENTS.md`: Project context and conventions for coding agents
- `CLAUDE.md`: Project context for Claude-based agents
- `skills-lock.json`: Manifest of installed agent skills and their versions
- `llms.txt`: LLM context and training documentation
- `robots.txt`: Search engine crawling configuration

### Agent Skills (.agents/, .claude/)

- `.agents/skills/`: Shared agent skills (Convex quickstart, auth setup, component creation, migration helper, performance audit, plus design and workflow skills) for consistent agent behavior
- `.agents/skills/convex-write-conflicts/SKILL.md`: How to diagnose and permanently fix Convex OCC "Retried due to write conflicts" errors (staleness-threshold gate for heartbeat/last-active writes, indexed reads, client jitter); references the `judges.updateActivity` fix as the canonical example
- `.claude/skills/`: Claude-specific copies of the same Convex and tooling skills

### Product Requirements Documents (prds/)

All PRD files are now organized in the `prds/` folder for better project structure:

- `prds/mentions.md`: @Mentions system PRD and implementation documentation
- `prds/addresend.md`: Resend email integration PRD and requirements (daily admin/user digests, weekly digest, @mentions emails, unsubscribe, admin broadcast, alerts cross-ref)
- `prds/adminalerrtemails.md`: Admin alert email system PRD for immediate report notifications and moderation alerts
- `prds/metadataforsubs.md`: Server-side metadata generation PRD for social sharing
- `prds/friendsonlyinbox.md`: Inbox messaging system PRD with text-only messages, @mentions, rate limiting, edit/delete, and admin integration
- `prds/following-plan.MD`: User following system implementation plan
- `prds/judgingsetup.md`: Judging system setup and configuration guide
- `prds/multi-judge-submissions.md`: Multi-judge submissions feature (configurable N judges per submission, OCC-safe completion, per-judge score breakdown)
- `prds/clerk-admin-fix.MD`: Clerk authentication admin setup documentation
- `prds/clerksubmit.md`: Clerk submission integration documentation
- `prds/themss.MD`: Theme and styling documentation
- `prds/adminroles.md`: Admin roles and permissions documentation
- `prds/alerts.md`: Notification system documentation
- `prds/codeblocksinsubmit.md`: Code block support in submissions
- `prds/howtojudge.md`: Judging system user guide
- `prds/moreimages.md`: Multi-image gallery implementation
- `prds/newsubmit.md`: Enhanced submission form documentation
- `prds/recentusers.md`: Recent users sidebar feature
- `prds/TESTING_SUMMARY.md`: Comprehensive email testing system documentation and guide
- `prds/EMAIL_DATE_RANGE_FIX.md`: Detailed explanation of date range bug fix and email testing improvements

## Backend (Convex Directory)

### Core Backend Files

- `convex/_generated/`: Auto-generated Convex files (API definitions, data model types)
  - `api.d.ts` & `api.js`: Generated API definitions for all functions
  - `dataModel.d.ts`: Generated TypeScript types for database schema
  - `server.d.ts` & `server.js`: Generated server-side definitions
- `convex/schema.ts`: Database schema definition with all tables and indexes (includes `submissionJudgeCompletions` table for multi-judge OCC-safe completion tracking)
- `convex/auth.config.js` & `convex/auth.ts`: Convex authentication configuration
- `convex/tsconfig.json`: TypeScript configuration for Convex functions
- `convex/README.md`: Convex-specific documentation
- `convex/migrations.ts`: Data/backfill helpers and migration utilities

### Authentication & User Management

- `convex/clerk.ts`: Clerk authentication integration with Convex
- `convex/users.ts`: User management functions (queries, mutations, admin functions, mention search, recent vibers discovery, emoji theme preferences)
- `convex/mentions.ts`: @Mentions system core utilities (extract, resolve, record, quota enforcement)
- `convex/dm.ts`: Direct messaging system with conversations, messages, @mentions, edit/delete, rate limiting, and admin reporting integration
- `convex/dmReactions.ts`: Direct message emoji reactions system with predefined emojis and user reaction management

### Core App Features

- `convex/stories.ts`: App submission functions (create, update, approve, search) with multi-image support
- `convex/comments.ts`: Comment system queries and mutations with @mentions integration and validation
- `convex/votes.ts`: Voting system for app submissions
- `convex/bookmarks.ts`: User bookmarking system functions with improved interface and notification creation
- `convex/storyRatings.ts`: 1-5 star rating system for apps
- `convex/follows.ts`: User following system functions with real-time updates
- `convex/tags.ts`: Tag management and categorization system with enhanced dropdown search support, including per-view visibility flags (header, app detail page, app lists, archive)
- `convex/reports.ts`: User reporting system for content moderation with admin notification creation and immediate email alerts
- `convex/alerts.ts`: Comprehensive notification system for votes, comments, ratings, follows, bookmarks, admin reports, and future message notifications
  - Includes helper `getAdminUserIds` and `createReportNotifications` for admin/manager report alerts with email integration

### Admin & Moderation

- `convex/adminQueries.ts`: General admin dashboard queries for metrics and content
- `convex/adminFollowsQueries.ts`: Admin-specific queries for managing user follows
- `convex/reports.ts`: User reporting system for content moderation
- `convex/settings.ts`: Site-wide settings and configuration management

### Custom Forms System

- `convex/forms.ts`: Dynamic form builder backend functions
- `convex/storyFormFields.ts`: Configurable form fields for story submissions
- `convex/submitForms.ts`: Submit form management system for specialized forms (hackathons, etc.)

### Comprehensive Judging System

- `convex/judgingGroups.ts`: Judging group management with public/private access, password protection, configurable `judgesPerSubmission` for multi-judge mode, required-tag backfill in `updateGroup` (stories carrying a newly set required tag are auto-included for judging), and auto-include backfill by multiple tags + submission date range (`autoIncludeTagIds`/`autoIncludeMatchMode` any|all/`autoIncludeStartDate`/`autoIncludeEndDate`, also returned from `getGroupWithDetails`)
- `convex/judgingCriteria.ts`: Judging criteria and scoring questions management with 1-10 star ratings
- `convex/judgingGroupSubmissions.ts`: Submission assignment within judging groups with @mentions in notes, search functionality, status tracking, `markJudgeCompleted` mutation for multi-judge OCC-safe completion, required-tag inclusion (`ensureStoryInGroup`/`syncStoryToTaggedGroups` helpers + `syncRequiredTagSubmissions` admin mutation) so any story carrying a group's required tag is judged and counted, multi-tag + date-range auto-include (`storyMatchesAutoInclude` helper supporting any/all match modes, `syncStoryToTaggedGroups` honors auto-include criteria, `syncAutoIncludeSubmissions` admin mutation), and `exportGroupSubmissions` admin query that returns flattened submission rows (custom form info, links, tags, hackathon team info; no images) for CSV download
- `convex/judges.ts`: Judge registration, session management, and group-wide progress tracking with canEdit/completedBy flags for multi-judge transparency and edit permission enforcement
- `convex/judgeScores.ts`: Score submission, calculation, results with CSV export, weighted scoring, and `getSubmissionJudgeBreakdown` query for per-judge score breakdown with after-self reveal rule
- `convex/adminJudgeTracking.ts`: Admin utilities for judge monitoring, submission status management, and comprehensive CSV export of judge activity including individual scores, total scores per submission, submissions, criteria, and comments

### Email System (Resend Integration) ✅ FULLY IMPLEMENTED

- `convex/emails/templates.ts`: Email templates for all email types (admin, welcome, engagement, weekly, mentions, admin reports)
- `convex/emails/resend.ts`: Core email sending with Resend API, logging, and global kill switch (applies to all email types, including admin reports)
- `convex/emails/daily.ts`: Daily metrics calculation and user engagement processing with fixed validators
- `convex/emails/weekly.ts`: Weekly digest computation and sending functionality
- `convex/emails/welcome.ts`: Welcome email integration for new user onboarding
- `convex/emails/reports.ts`: Admin report notification emails with immediate delivery for content moderation
- `convex/emails/queries.ts`: V8 runtime queries for email data (separated from Node.js actions)
- `convex/emails/helpers.ts`: Helper queries for email processing and data fetching
- `convex/emails/broadcast.ts`: Admin broadcast email system with user search, tag-based targeting (send to everyone who used a tag, filterable by submission status), recipient counts, and batch processing
- `convex/sendEmails.ts`: Convex Resend Component wrapper with subject prefix and from address enforcement
- `convex/emailSettings.ts`: User email preferences management with unsubscribe functionality
- `convex/testDailyEmail.ts`: Admin testing functions for daily/weekly email triggers with clear logs utility
- `convex/crons.ts`: Email cron jobs (daily admin, engagement processing, weekly digest)

### Utilities & Configuration

- `convex/utils.ts`: Shared utility functions for backend operations
- `convex/validators.ts`: Input validation schemas for functions
- `convex/convexBoxConfig.ts`: Configuration for ConvexBox notification system
- `convex/http.ts`: HTTP actions for handling external requests and Resend webhook handler
- `convex/settings.ts`: Global app settings including email kill switch and admin controls

## Frontend (src Directory)

### Main Application Files

- `src/main.tsx`: React application entry point
- `src/App.tsx`: Main app component with routing configuration
- `src/index.css`: Global CSS styles and Tailwind imports
- `src/vite-env.d.ts`: `Vite` environment type definitions

### Core Components

- `src/components/Layout.tsx`: Main layout wrapper with navigation and structure
- `src/components/ProtectedLayout.tsx`: Authentication-protected layout wrapper
- `src/components/Footer.tsx`: Site footer with links and information
- `src/components/UserSyncer.tsx`: Clerk-Convex user synchronization component
- `src/components/DynamicSubmitForm.tsx`: Public dynamic submit form renderer

### Story/App Submission Features

- `src/components/StoryForm.tsx`: Main app submission form with validation, enhanced tag search dropdown, and multi-image upload support
- `src/components/ResendForm.tsx`: Resend integration form for email collection
- `src/components/YCHackForm.tsx`: YC AI Hackathon submission form with team information support
- `src/components/StoryDetail.tsx`: Detailed app view with comments, ratings, voting, image gallery, and sticky sidebar for project links and tags
- `src/components/StoryList.tsx`: List/grid view of app submissions
- `src/components/ImageGallery.tsx`: Multi-image gallery component with thumbnail navigation and modal Lightbox

### User Interaction Components

- `src/components/Comment.tsx`: Individual comment display component with @mention link rendering
- `src/components/CommentForm.tsx`: Comment creation and editing form with @mention autocomplete
- `src/components/ui/MentionTextarea.tsx`: LinkedIn-style @mention autocomplete textarea component

### Discovery & Navigation

- `src/components/SearchResults.tsx`: Search results display component
- `src/components/WeeklyLeaderboard.tsx`: Top users and trending content
- `src/components/TopCategoriesOfWeek.tsx`: Trending categories and tags
- `src/components/RecentVibers.tsx`: Recent user avatars sidebar with ProfileHoverCard integration

### Admin Dashboard Components

- `src/components/admin/AdminDashboard.tsx`: Main admin dashboard overview with comprehensive navigation including Email Management tab
- `src/components/admin/ContentModeration.tsx`: Content approval/rejection interface with image management
- `src/components/admin/UserModeration.tsx`: User management, verification, and ban/pause functionality
- `src/components/admin/TagManagement.tsx`: Tag creation and customization with colors, emojis, and ordering. Per-tag toggles control visibility in the header, on the app detail page, and on app card lists, plus archive. Save and drag-and-drop reorder persist only changed tags in parallel (fast with large tag sets); includes paginated list with selectable page size (5-200), synced top and bottom pagination controls, and search across all tags
- `src/components/admin/Settings.tsx`: Site-wide settings configuration with view mode controls
- `src/components/admin/NumbersView.tsx`: Analytics and metrics dashboard with detailed tracking
- `src/components/admin/ReportManagement.tsx`: User report review and resolution with status tracking and email notification integration
- `src/components/admin/EmailManagement.tsx`: Complete email system management with global toggle, broadcast emails (all users, selected users, or everyone who used a tag), user search, testing tools, and admin alert configuration
- `src/components/admin/SubmitFormFieldManagement.tsx`: Manage fields for a specific submit form
- `src/components/admin/CreateSubmitFormModal.tsx`: Modal to create new submit forms
- `src/components/admin/EditSubmitFormModal.tsx`: Modal to edit existing submit forms

### Form Management Components

- `src/components/admin/Forms.tsx`: Dynamic form management interface
- `src/components/admin/FormBuilder.tsx`: Form creation and field configuration
- `src/components/admin/FormResults.tsx`: Form submission results and export
- `src/components/admin/FormFieldManagement.tsx`: Story form field configuration
- `src/components/admin/SubmitFormManagement.tsx`: Submit form management for specialized forms
- `src/components/admin/SubmitFormBuilder.tsx`: Submit form creation and configuration
- `src/components/PublicForm.tsx`: Public-facing form display

### Judging System Components

- `src/components/admin/Judging.tsx`: Main judging group management interface with comprehensive controls, including a per-group "Export CSV" action that fetches submissions on demand and downloads custom submit form info (no images)
- `src/components/admin/CreateJudgingGroupModal.tsx`: Judging group creation modal with password protection
- `src/components/admin/EditJudgingGroupModal.tsx`: Comprehensive editing modal for judging group settings including access controls, custom submission page configuration, admin-selectable required submission fields, password management, a "Sync existing submissions with this tag" backfill button, an auto-populate section (searchable multi-tag selector with removable chips, any/all "Tag match rule", Start/End submission date range, and "Sync matching submissions" button via `syncAutoIncludeSubmissions`), and all group settings
- `src/components/admin/JudgingCriteriaEditor.tsx`: Scoring criteria management with 1-10 star ratings
- `src/components/admin/JudgingResultsDashboard.tsx`: Admin results and analytics with CSV export
- `src/components/admin/JudgeTracking.tsx`: Comprehensive judge tracking dashboard with breadcrumb navigation, Stats Overview, Judge Activity section with expandable judge details and score moderation tools, Judge Scores & Comments tabbed interface showing detailed scoring per judge with submission grouping, floating scroll buttons, notes viewing, and CSV export of comprehensive judge activity data
- `src/components/PublicJudgingResultsDashboard.tsx`: Public-facing results display showing overall stats, rankings, and criteria performance (Judge Scores & Comments section moved to admin JudgeTracking)
- `src/components/PublicResultsViewer.tsx`: Public results viewer component
- `src/pages/JudgingInterfacePage.tsx`: Individual submission judging interface with comprehensive filtering (tag dropdown, judged status filter), search functionality, group-wide progress tracking, edit permissions based on completion status, read-only views of others' completed submissions, and @mention autocomplete in notes. Filters work together to help judges find specific submissions efficiently.

### Notification & Configuration

- `src/components/ConvexBox.tsx`: Dismissible notification banner system with custom styling
- `src/components/admin/ConvexBoxSettingsForm.tsx`: ConvexBox configuration with image upload support

### UI Components (src/components/ui/)

- `src/components/ui/button.tsx`: Reusable button component
- `src/components/ui/input.tsx`: Form input component
- `src/components/ui/textarea.tsx`: Multi-line text input
- `src/components/ui/select.tsx`: Dropdown selection component
- `src/components/ui/checkbox.tsx`: Checkbox input component
- `src/components/ui/label.tsx`: Form label component
- `src/components/ui/dialog.tsx`: Modal dialog component
- `src/components/ui/AlertDialog.tsx`: Alert and confirmation dialogs
- `src/components/ui/AuthRequiredDialog.tsx`: Authentication requirement modal

### Hooks (src/hooks/)

- `src/hooks/useDialog.tsx`: Imperative message/confirm dialog helper backed by MessageDialog and AlertDialog
- `src/hooks/useEscapeKey.ts`: Shared hook that closes an open overlay when the Escape key is pressed (window keydown subscription gated on open state)

### Page Components (src/pages/)

- `src/pages/SignInPage.tsx`: User sign-in page
- `src/pages/SignUpPage.tsx`: User registration page
- `src/pages/SignOutPage.tsx`: User sign-out confirmation
- `src/pages/SetUsernamePage.tsx`: Username setup for new users
- `src/pages/UserProfilePage.tsx`: User profile display and management with email preferences and unsubscribe functionality
- `src/pages/TagPage.tsx`: Tag-specific app listings
- `src/pages/JudgingGroupPage.tsx`: Judge interface for scoring submissions with session management
- `src/pages/JudgingGroupSubmitPage.tsx`: Public custom submission page for a judging group (Luma-style layout) with password gating, configurable layout, locked required tag, and admin-selectable required fields
- `src/pages/JudgingInterfacePage.tsx`: Individual submission judging interface with comprehensive filtering (tag dropdown, judged status filter), search functionality, group-wide progress tracking, edit permissions based on completion status, read-only views of others' completed submissions, and @mention autocomplete in notes. Filters work together to help judges find specific submissions efficiently.
- `src/pages/PublicJudgingResultsPage.tsx`: Public judging results page with password protection
- `src/pages/NotificationsPage.tsx`: User notifications page with comprehensive alert system for all interaction types
- `src/pages/InboxPage.tsx`: Direct messaging inbox with conversation view, message threads, @mentions, edit/delete, and real-time updates
- `src/pages/NotFoundPage.tsx`: 404 error page
- `src/pages/NavTestPage.tsx`: Navigation testing page

### Utilities & Types

- `src/lib/utils.ts`: Shared utility functions and helpers
- `src/utils/mentions.tsx`: @Mention link rendering utility for converting @username to profile links
- `src/types/index.ts`: TypeScript type definitions for the frontend

## Static Assets (public Directory)

### Icons & Favicon

- Various favicon sizes and formats for different devices
- Apple touch icons for iOS devices
- Microsoft tile icons for Windows
- `favicon.svg`: SVG favicon for modern browsers

### Configuration Files

- `_redirects`: `Netlify` routing configuration for SPA
- `robots.txt`: Search engine crawling instructions
- `sitemap.xml`: Site structure for search engines

### Graphics

- `vibe-apps-open-graphi-image.png`: Social media preview image
- `vibe-apps-open-graphi-image-v1.png`: Alternative social preview

## Build & Development Files

- `index.html`: Main HTML template for the SPA
- Various TypeScript path configurations for different environments

## What's needed (pointers)

- Clerk organizer role access to judges section:
  - Backend: `convex/auth.ts`, `convex/auth.config.js`, role checks in admin queries
  - Frontend: gating in `src/components/admin/Judging.tsx`, `src/components/admin/AdminDashboard.tsx`
- Admin moderation to make app post by approval only:
  - Backend: `convex/stories.ts`, add auto-approval toggle in `convex/settings.ts`
  - Frontend: `src/components/admin/Settings.tsx` to add toggle control
