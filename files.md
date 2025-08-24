# VibeApps Codebase Files

## Root Directory Structure

### Configuration Files

- `package.json`: Project dependencies and scripts configuration
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript configuration files
- `vite.config.ts`: Vite build tool configuration
- `tailwind.config.js`: Tailwind CSS styling configuration
- `postcss.config.js`: PostCSS configuration for CSS processing
- `eslint.config.js`: ESLint code quality and style configuration
- `components.json`: shadcn/ui components configuration
- `bun.lockb`: Bun package manager lock file

### Documentation Files

- `README.md`: Main project documentation and setup guide
- `changelog.MD`: Developer-friendly changelog of new features
- `files.MD`: This file - comprehensive codebase documentation
- `TASK.MD`: Project task and feature requirements
- `addresend.md`: Resend email integration PRD and requirements
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

### Authentication & User Management

- `convex/clerk.ts`: Clerk authentication integration with Convex
- `convex/users.ts`: User management functions (queries, mutations, admin functions)

### Core App Features

- `convex/stories.ts`: App submission functions (create, update, approve, search)
- `convex/comments.ts`: Comment system queries and mutations
- `convex/votes.ts`: Voting system for app submissions
- `convex/bookmarks.ts`: User bookmarking system functions
- `convex/storyRatings.ts`: 1-5 star rating system for apps
- `convex/follows.ts`: User following system functions
- `convex/tags.ts`: Tag management and categorization system

### Admin & Moderation

- `convex/adminQueries.ts`: General admin dashboard queries for metrics and content
- `convex/adminFollowsQueries.ts`: Admin-specific queries for managing user follows
- `convex/reports.ts`: User reporting system for content moderation
- `convex/settings.ts`: Site-wide settings and configuration management

### Custom Forms System

- `convex/forms.ts`: Dynamic form builder backend functions
- `convex/storyFormFields.ts`: Configurable form fields for story submissions

### Comprehensive Judging System

- `convex/judgingGroups.ts`: Judging group management with public/private access
- `convex/judgingCriteria.ts`: Judging criteria and scoring questions management
- `convex/judgingGroupSubmissions.ts`: Submission assignment within judging groups
- `convex/judges.ts`: Judge registration, session management, and progress tracking
- `convex/judgeScores.ts`: Score submission, calculation, and results with CSV export

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
- `src/vite-env.d.ts`: Vite environment type definitions

### Core Components

- `src/components/Layout.tsx`: Main layout wrapper with navigation and structure
- `src/components/ProtectedLayout.tsx`: Authentication-protected layout wrapper
- `src/components/Footer.tsx`: Site footer with links and information
- `src/components/UserSyncer.tsx`: Clerk-Convex user synchronization component

### Story/App Submission Features

- `src/components/StoryForm.tsx`: Main app submission form with validation
- `src/components/ResendForm.tsx`: Resend integration form for email collection
- `src/components/YCHackForm.tsx`: YC AI Hackathon submission form (based on ResendForm)
- `src/components/StoryDetail.tsx`: Detailed app view with comments, ratings, voting
- `src/components/StoryList.tsx`: List/grid view of app submissions

### User Interaction Components

- `src/components/Comment.tsx`: Individual comment display component
- `src/components/CommentForm.tsx`: Comment creation and editing form

### Discovery & Navigation

- `src/components/SearchResults.tsx`: Search results display component
- `src/components/WeeklyLeaderboard.tsx`: Top users and trending content
- `src/components/TopCategoriesOfWeek.tsx`: Trending categories and tags

### Admin Dashboard Components

- `src/components/admin/AdminDashboard.tsx`: Main admin dashboard overview
- `src/components/admin/ContentModeration.tsx`: Content approval/rejection interface
- `src/components/admin/UserModeration.tsx`: User management and verification
- `src/components/admin/TagManagement.tsx`: Tag creation and customization
- `src/components/admin/Settings.tsx`: Site-wide settings configuration
- `src/components/admin/NumbersView.tsx`: Analytics and metrics dashboard
- `src/components/admin/ReportManagement.tsx`: User report review and resolution

### Form Management Components

- `src/components/admin/Forms.tsx`: Dynamic form management interface
- `src/components/admin/FormBuilder.tsx`: Form creation and field configuration
- `src/components/admin/FormResults.tsx`: Form submission results and export
- `src/components/admin/FormFieldManagement.tsx`: Story form field configuration
- `src/components/PublicForm.tsx`: Public-facing form display

### Judging System Components

- `src/components/admin/Judging.tsx`: Main judging group management interface
- `src/components/admin/CreateJudgingGroupModal.tsx`: Judging group creation modal
- `src/components/admin/JudgingCriteriaEditor.tsx`: Scoring criteria management
- `src/components/admin/JudgingResultsDashboard.tsx`: Admin results and analytics
- `src/components/PublicJudgingResultsDashboard.tsx`: Public-facing results display
- `src/components/PublicResultsViewer.tsx`: Public results viewer component

### Notification & Configuration

- `src/components/ConvexBox.tsx`: Dismissible notification banner system
- `src/components/admin/ConvexBoxSettingsForm.tsx`: ConvexBox configuration

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
- `src/pages/JudgingInterfacePage.tsx`: Individual submission judging interface
- `src/pages/PublicJudgingResultsPage.tsx`: Public judging results page
- `src/pages/NotFoundPage.tsx`: 404 error page
- `src/pages/NavTestPage.tsx`: Navigation testing page

### Utilities & Types

- `src/lib/utils.ts`: Shared utility functions and helpers
- `src/types/index.ts`: TypeScript type definitions for the frontend

## Static Assets (public Directory)

### Icons & Favicons

- Various favicon sizes and formats for different devices
- Apple touch icons for iOS devices
- Microsoft tile icons for Windows
- `favicon.svg`: SVG favicon for modern browsers

### Configuration Files

- `_redirects`: Netlify routing configuration for SPA
- `robots.txt`: Search engine crawling instructions
- `sitemap.xml`: Site structure for search engines

### Graphics

- `vibe-apps-open-graphi-image.png`: Social media preview image
- `vibe-apps-open-graphi-image-v1.png`: Alternative social preview

## Build & Development Files

- `index.html`: Main HTML template for the SPA
- Various TypeScript path configurations for different environments
