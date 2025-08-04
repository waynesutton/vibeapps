# Codebase Files

## Root Directory Structure

- `vibeapps/`: The root directory of the project.

## Backend (Convex)

- `convex/`: Directory for Convex backend functions, schema, and configuration.
  - `_generated/`: Auto-generated Convex files (API definitions, data model types based on `schema.ts`).
    - `api.d.ts` & `api.js`: Generated API definitions for all functions
    - `dataModel.d.ts`: Generated TypeScript types for database schema
    - `server.d.ts` & `server.js`: Generated server-side definitions
  - `schema.ts`: Defines the database schema including tables for `stories`, `comments`, `users`, `tags`, `settings`, `forms`, `formSubmissions`, `votes`, `reports`, `follows`, `bookmarks`, `storyRatings`, and judging system tables (`judgingGroups`, `judgingCriteria`, `judgingGroupSubmissions`, `judges`, `judgeScores`).
  - `auth.config.js` & `auth.ts`: Convex authentication configuration and functions
  - `adminFollowsQueries.ts`: Admin-specific queries for managing user follows
  - `adminQueries.ts`: General admin dashboard queries for metrics and content management
  - `bookmarks.ts`: Functions for user bookmarking system
  - `clerk.ts`: Clerk authentication integration with Convex
  - `comments.ts`: Comment system queries and mutations
  - `convexBoxConfig.ts`: Configuration for the ConvexBox notification system
  - `follows.ts`: User following system functions
  - `forms.ts`: Dynamic form builder backend functions
  - `http.ts`: HTTP actions for handling external requests
  - `judgingGroups.ts`: Judging group management with public/private access and password protection
  - `judgingCriteria.ts`: Judging criteria and scoring questions management
  - `judgingGroupSubmissions.ts`: Submission assignment and management within judging groups
  - `judges.ts`: Judge registration, session management, and progress tracking
  - `judgeScores.ts`: Score submission, calculation, and results generation with CSV export
  - `reports.ts`: User reporting system for content moderation
  - `settings.ts`: Site-wide settings management
  - `stories.ts`: Core app submission functions (queries, mutations, actions), including admin tag management
  - `storyFormFields.ts`: Form field definitions for story submissions
  - `storyRatings.ts`: App rating and review system
  - `tags.ts`: Tag system for categorizing apps
  - `users.ts`: User management including verification system
  - `utils.ts`: Utility functions for backend operations
  - `validators.ts`: Input validation schemas
  - `README.md`: Backend documentation and setup instructions
  - `tsconfig.json`: TypeScript configuration for Convex functions

## Frontend (React)

- `src/`: Directory for the React frontend application code.
  - `components/`: Reusable React components organized by functionality.
    - `admin/`: Admin dashboard components for content and user management.
      - `AdminDashboard.tsx`: Main admin interface with navigation and overview - `ContentModeration.tsx`: Interface for moderating user-submitted content with tag management capabilities and judging group assignment
      - `ConvexBoxSettingsForm.tsx`: Form for configuring site-wide notification box
      - `CreateJudgingGroupModal.tsx`: Modal for creating new judging groups with public/private settings
      - `FormBuilder.tsx`: Dynamic form creation interface for admins
      - `FormFieldManagement.tsx`: Component for managing individual form fields
      - `FormResults.tsx`: Display and analysis of form submission data
      - `Forms.tsx`: Management interface for all created forms
      - `Judging.tsx`: Main judging system management interface with group creation and results access
      - `JudgingCriteriaEditor.tsx`: Interface for defining scoring criteria and questions for judging groups
      - `JudgingResultsDashboard.tsx`: Comprehensive results dashboard with rankings, analytics, and CSV export
      - `NumbersView.tsx`: Analytics dashboard showing key metrics
      - `ReportManagement.tsx`: Interface for reviewing and managing user reports
      - `Settings.tsx`: Site-wide settings configuration panel
      - `TagManagement.tsx`: Interface for creating and managing app tags
      - `UserModeration.tsx`: User management with verification controls and search
    - `ui/`: Base UI components following shadcn/ui patterns.
      - `AlertDialog.tsx`: Reusable alert dialog component
      - `AuthRequiredDialog.tsx`: Dialog for prompting user authentication
      - `button.tsx`: Customizable button component
      - `checkbox.tsx`: Styled checkbox input
      - `dialog.tsx`: Base dialog/modal component
      - `input.tsx`: Styled text input component
      - `label.tsx`: Form label component
      - `select.tsx`: Dropdown select component
      - `textarea.tsx`: Multi-line text input component
    - `Comment.tsx`: Individual comment display component
    - `CommentForm.tsx`: Form for adding new comments to apps
    - `ConvexBox.tsx`: Dismissible notification/announcement box
    - `Footer.tsx`: Application footer with links and information
    - `Layout.tsx`: Main application layout managing shared state and navigation
    - `ProtectedLayout.tsx`: Layout wrapper requiring authentication
    - `PublicForm.tsx`: Public-facing form component for submissions
    - `PublicResultsViewer.tsx`: Component for viewing form results publicly
    - `ResendForm.tsx`: Email form component using Resend service
    - `SearchResults.tsx`: Component for displaying search results
    - `StoryDetail.tsx`: Detailed view of individual app submissions
    - `StoryForm.tsx`: Form for submitting new app stories
    - `StoryList.tsx`: Grid/list view of app submissions
    - `TopCategoriesOfWeek.tsx`: Weekly trending categories with interactive selection
    - `UserSyncer.tsx`: Component for synchronizing Clerk user data with Convex
    - `WeeklyLeaderboard.tsx`: Display of top-performing apps and creators
  - `pages/`: Top-level page components mapped to routes.
    - `JudgingGroupPage.tsx`: Public judging group page with judge registration and password entry
    - `JudgingInterfacePage.tsx`: Judge scoring interface with progress tracking and submission evaluation
    - `NavTestPage.tsx`: Development page for testing navigation components
    - `NotFoundPage.tsx`: 404 error page with navigation back to home
    - `PublicJudgingResultsPage.tsx`: Public results viewing with password protection for private groups
    - `SetUsernamePage.tsx`: Onboarding page for new users to set username
    - `SignInPage.tsx`: Clerk-powered sign-in page
    - `SignOutPage.tsx`: User sign-out confirmation page
    - `SignUpPage.tsx`: Clerk-powered user registration page
    - `TagPage.tsx`: Tag-specific content browsing page
    - `UserProfilePage.tsx`: Public user profile with verification badge display
  - `lib/`: Utility functions and configuration.
    - `utils.ts`: General utility functions and helpers
  - `types/`: TypeScript type definitions.
    - `index.ts`: Centralized type definitions for the application
  - `App.tsx`: Main application component with routing and providers
  - `main.tsx`: React application entry point
  - `index.css`: Global styles and Tailwind CSS configuration
  - `vite-env.d.ts`: Vite-specific TypeScript environment definitions

## Static Assets

- `public/`: Static assets served directly by the web server.
  - `_redirects`: Netlify redirect configuration for SPA routing
  - `robots.txt`: Search engine crawler instructions
  - `sitemap.xml`: Site structure information for search engines
  - `favicon.*`: Various favicon formats for different devices
  - `apple-touch-icon-*`: iOS home screen icons in multiple sizes
  - `android-chrome-*`: Android app icons
  - `mstile-*`: Windows tile icons
  - `vibe-apps-open-graph-image*.png`: Social media preview images

## Configuration Files

- `components.json`: shadcn/ui component library configuration
- `eslint.config.js`: ESLint code linting configuration
- `postcss.config.js`: PostCSS configuration for CSS processing
- `tailwind.config.js`: Tailwind CSS customization and theme configuration
- `tsconfig.json`: Base TypeScript configuration
- `tsconfig.app.json`: TypeScript configuration for frontend application
- `tsconfig.node.json`: TypeScript configuration for Node.js build processes
- `vite.config.ts`: Vite build tool and development server configuration

## Package Management

- `package.json`: Project metadata, dependencies, and npm scripts
- `package-lock.json`: NPM dependency lock file
- `bun.lockb`: Bun package manager lock file (primary package manager)

## Documentation

- `README.md`: Main project documentation with setup instructions
- `changelog.MD`: Developer-friendly log of new features and changes
- `clerk-admin-fix.MD`: Documentation for Clerk admin-related fixes
- `clerksubmit.md`: Clerk submission process documentation
- `following-plan.MD`: Planning document for user following system
- `files.MD`: This file - comprehensive codebase structure overview
- `judgingsetup.md`: Product Requirements Document (PRD) for the judging system implementation
- `llms.txt`: LLM-related notes and configurations
- `TASK.MD`: Current development tasks and to-do items
- `themss.MD`: Theme and styling documentation

## Build and Deployment

- `index.html`: Main HTML entry point for Vite application
- `robots.txt`: Additional robots.txt in root directory
- Various configuration files for build processes and deployment

## Key Features Implemented

### User Management

- Clerk authentication integration
- User verification system with blue checkmarks
- Profile management and public profiles
- Username setting for new users

### Content System

- App story submissions with rich metadata
- Comment system with threading
- Tag-based categorization
- Bookmarking and favorites
- Rating and review system

### Admin Features

- Comprehensive admin dashboard
- Content moderation workflows
- User management and verification
- Custom form builder
- Judging system management
- Report management system
- Site-wide settings control
- Analytics and metrics tracking

### Judging System

- Public and private judging groups with password protection
- Custom scoring criteria with 1-5 rating scales
- Judge registration and session management
- Real-time progress tracking for judges
- Comprehensive results dashboard with rankings
- CSV export functionality for results
- Public results pages with optional password protection
- Admin workflow for submission assignment to judging groups

### Social Features

- User following system
- Weekly leaderboards
- Trending categories
- Search and discovery
- Real-time updates

### Technical Features

- Real-time database with Convex
- Type-safe backend functions
- Responsive modern UI
- SEO optimization
- Progressive Web App capabilities
