# VibeApps Codebase Files

## Root Directory Structure

### Configuration Files

- `package.json`: Project dependencies and scripts configuration
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript configuration files
- `vite.config.ts`: `Vite` build tool configuration
- `tailwind.config.js`: Tailwind CSS styling configuration
- `postcss.config.js`: PostCSS configuration for CSS processing
- `eslint.config.js`: ESLint code quality and style configuration
- `components.json`: `shadcn/ui` components configuration
- `bun.lockb`: Bun package manager lock file

### Documentation Files

- `README.md`: Main project documentation and setup guide
- `changelog.MD`: Developer-friendly change log of new features
- `files.MD`: This file - comprehensive codebase documentation
- `TASK.MD`: Project task and feature requirements
- `mentions.md`: @Mentions system PRD and implementation documentation
- `addresend.md`: Resend email integration PRD and requirements
- `metadataforsubs.md`: Server-side metadata generation PRD for social sharing
- `inboxforapp.md`: Inbox messaging system PRD (planned feature)
- `following-plan.MD`: User following system implementation plan
- `judgingsetup.md`: Judging system setup and configuration guide
- `clerk-admin-fix.MD`: Clerk authentication admin setup documentation
- `clerksubmit.md`: Clerk submission integration documentation
- `themss.MD`: Theme and styling documentation
- `llms.txt`: LLM context and training documentation
- `robots.txt`: Search engine crawling configuration

## Backend (Convex Directory)

### Core Backend Files

- `convex/_generated/`: Auto-generated Convex files (API definitions, data model types)
  - `api.d.ts` & `api.js`: Generated API definitions for all functions
  - `dataModel.d.ts`: Generated TypeScript types for database schema
  - `server.d.ts` & `server.js`: Generated server-side definitions
- `convex/schema.ts`: Database schema definition with all tables and indexes
- `convex/auth.config.js` & `convex/auth.ts`: Convex authentication configuration
- `convex/tsconfig.json`: TypeScript configuration for Convex functions
- `convex/README.md`: Convex-specific documentation
- `convex/migrations.ts`: Data/backfill helpers and migration utilities

### Authentication & User Management

- `convex/clerk.ts`: Clerk authentication integration with Convex
- `convex/users.ts`: User management functions (queries, mutations, admin functions, mention search)
- `convex/mentions.ts`: @Mentions system core utilities (extract, resolve, record, quota enforcement)

### Core App Features

- `convex/stories.ts`: App submission functions (create, update, approve, search) with multi-image support
- `convex/comments.ts`: Comment system queries and mutations with @mentions integration and validation
- `convex/votes.ts`: Voting system for app submissions
- `convex/bookmarks.ts`: User bookmarking system functions with improved interface
- `convex/storyRatings.ts`: 1-5 star rating system for apps
- `convex/follows.ts`: User following system functions with real-time updates
- `convex/tags.ts`: Tag management and categorization system with enhanced dropdown search support
- `convex/reports.ts`: User reporting system for content moderation

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

- `convex/judgingGroups.ts`: Judging group management with public/private access and password protection
- `convex/judgingCriteria.ts`: Judging criteria and scoring questions management with 1-10 star ratings
- `convex/judgingGroupSubmissions.ts`: Submission assignment within judging groups with @mentions in notes and search functionality
- `convex/judges.ts`: Judge registration, session management, and progress tracking with status updates
- `convex/judgeScores.ts`: Score submission, calculation, and results with CSV export and weighted scoring

### Utilities & Configuration

- `convex/utils.ts`: Shared utility functions for backend operations
- `convex/validators.ts`: Input validation schemas for functions
- `convex/convexBoxConfig.ts`: Configuration for ConvexBox notification system
- `convex/http.ts`: HTTP actions for handling external requests

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
- `src/components/StoryDetail.tsx`: Detailed app view with comments, ratings, voting, and image gallery
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

### Admin Dashboard Components

- `src/components/admin/AdminDashboard.tsx`: Main admin dashboard overview with comprehensive navigation
- `src/components/admin/ContentModeration.tsx`: Content approval/rejection interface with image management
- `src/components/admin/UserModeration.tsx`: User management, verification, and ban/pause functionality
- `src/components/admin/TagManagement.tsx`: Tag creation and customization with colors, emojis, and ordering
- `src/components/admin/Settings.tsx`: Site-wide settings configuration with view mode controls
- `src/components/admin/NumbersView.tsx`: Analytics and metrics dashboard with detailed tracking
- `src/components/admin/ReportManagement.tsx`: User report review and resolution with status tracking
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

- `src/components/admin/Judging.tsx`: Main judging group management interface with comprehensive controls
- `src/components/admin/CreateJudgingGroupModal.tsx`: Judging group creation modal with password protection
- `src/components/admin/JudgingCriteriaEditor.tsx`: Scoring criteria management with 1-10 star ratings
- `src/components/admin/JudgingResultsDashboard.tsx`: Admin results and analytics with CSV export
- `src/components/PublicJudgingResultsDashboard.tsx`: Public-facing results display with password protection
- `src/components/PublicResultsViewer.tsx`: Public results viewer component

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

### Page Components (src/pages/)

- `src/pages/SignInPage.tsx`: User sign-in page
- `src/pages/SignUpPage.tsx`: User registration page
- `src/pages/SignOutPage.tsx`: User sign-out confirmation
- `src/pages/SetUsernamePage.tsx`: Username setup for new users
- `src/pages/UserProfilePage.tsx`: User profile display and management
- `src/pages/TagPage.tsx`: Tag-specific app listings
- `src/pages/JudgingGroupPage.tsx`: Judge interface for scoring submissions
- `src/pages/JudgingInterfacePage.tsx`: Individual submission judging interface with @mention autocomplete in notes
- `src/pages/PublicJudgingResultsPage.tsx`: Public judging results page
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
