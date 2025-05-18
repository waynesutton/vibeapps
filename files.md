# Codebase Files

- `convex/`: Directory for Convex backend functions and schema.
  - `schema.ts`: Defines the database schema including tables for `stories`, `comments`, `users`, `tags`, `settings`, `forms`, `formSubmissions`, `votes`, and `reports`.
  - `stories.ts`: Contains Convex queries and mutations for managing story submissions, including creation, listing, retrieval by slug, voting, and generating upload URLs for screenshots.
  - `comments.ts`: Contains Convex queries and mutations for managing comments on stories, including adding new comments and listing comments by story.
  - `users.ts`: Manages user-specific data and profiles, potentially linking with Clerk authentication.
  - `tags.ts`: Handles CRUD operations for tags, including listing tags for header navigation and managing tag visibility.
  - `settings.ts`: Manages global site settings, such as default view mode, items per page, and anonymous posting configurations.
  - `forms.ts`: Backend logic for creating, managing, and retrieving custom forms built with the form builder.
  - `formSubmissions.ts`: Handles storage and retrieval of data submitted through custom forms.
  - `votes.ts`: Manages upvotes for stories and potentially comments.
  - `reports.ts`: Handles content reporting functionality for moderation.
  - `crons.ts`: Defines scheduled tasks, like daily digests or cleanup operations.
  - `http.ts`: Defines HTTP endpoints for external integrations or webhook handling.
  - `_generated/`: Auto-generated Convex files (API definitions, data model types based on `schema.ts`).
- `src/`: Directory for React frontend code.
  - `components/`: Reusable React components.
    - `Layout.tsx`: Main application layout, including header (with site title, submission link, view mode toggles, category/tag dropdown, sort dropdown, search), navigation, and footer. Manages global state like view mode and selected tags.
    - `StoryList.tsx`: Displays a list or grid of stories (submissions). Handles pagination, sorting by time periods and votes, and filtering by tags.
    - `StoryDetail.tsx`: Displays the detailed view of a single story, including its content, screenshots, author information, engagement metrics (votes, comments), and the comment section.
    - `StoryForm.tsx`: Form for users to submit new applications/stories, including fields for title, description, tagline, up to 4 screenshots, links to social announcements (LinkedIn, Twitter/X, Bluesky, Reddit), and tag selection. Implements a one submission per day limit.
    - `Comment.tsx`: Displays a single comment, supports Markdown rendering, shows author, timestamp, and allows for nested replies and upvoting.
    - `CommentForm.tsx`: Form for adding new comments or replying to existing ones. Requires user name and supports Markdown.
    - `SearchResults.tsx`: Displays results from the full-text search across submissions and comments. Includes filtering options and handles empty states.
    - `Footer.tsx`: Application footer, containing links (e.g., About, GitHub), copyright information, and potentially a modal for more details about the app.
    - `ConvexBox.tsx`: A dismissible notification or informational box, possibly related to Convex integration or site announcements.
    - `UserSyncer.tsx`: Component responsible for synchronizing Clerk user data with the Convex database.
    - `admin/`: Components related to the admin dashboard.
      - `AdminDashboard.tsx`: Main entry point for the admin section. Provides navigation to various admin panels (Content Moderation, Form Management, Tag Management, Site Settings, User Moderation, Report Management, ConvexBox Settings) and displays overview statistics.
      - `ContentModeration.tsx`: Interface for administrators to review and manage reported content (submissions and comments). Allows actions like hiding/showing, archiving, or deleting content, and adding custom messages to submissions.
      - `FormBuilder.tsx`: Component for creating and editing custom forms. Allows admins to define form fields (short text, long text, URL, email, yes/no, dropdown, multi-select), set required fields, add custom validation, and preview forms.
      - `FormResults.tsx`: Displays submissions received through the custom forms. Allows admins to view submissions by form, sort/filter results, and export data to CSV.
      - `Forms.tsx`: Management interface for all created forms. Admins can toggle form visibility (public/private), generate shareable form URLs, view submission counts, and organize forms.
      - `Settings.tsx`: Panel for administrators to configure global site settings. This includes default view mode (grid/list), submissions per page, anonymous submission/comment permissions, and other site-wide preferences.
      - `TagManagement.tsx`: Interface for managing the tag system. Admins can add, remove, and edit available tags, control which tags appear in the header navigation, and organize tags into categories.
      - `UserModeration.tsx`: Interface for administrators to manage users, such as banning, muting, or changing user roles.
      - `ReportManagement.tsx`: Interface for administrators to manage user-submitted reports about content or users.
      - `NumbersView.tsx`: A component to display key metrics or numbers in the admin dashboard.
      - `ConvexBoxSettingsForm.tsx`: A form for configuring settings related to the `ConvexBox` component, likely managed within the admin panel.
  - `pages/`: Contains top-level page components that are mapped to routes.
    - `HomePage.tsx`: Renders the main view, likely embedding `StoryList`.
    - `SubmitPage.tsx`: Renders the `StoryForm` for new submissions.
    - `StoryPage.tsx`: Renders `StoryDetail` for a specific story.
    - `SearchPage.tsx`: Renders `SearchResults`.
    - `SignInPage.tsx`: Clerk sign-in page.
    - `SignUpPage.tsx`: Clerk sign-up page.
    - `UserProfilePage.tsx`: Displays a user's public profile.
    - `AdminPage.tsx`: Renders the `AdminDashboard`.
    - `SetUsernamePage.tsx`: Allows new users to set their initial username.
    - `NavTestPage.tsx`: A blank page with header/footer for testing navigation components.
  - `hooks/`: Custom React hooks.
  - `lib/`: Utility functions and helper modules.
    - `utils.ts`: General utility functions.
    - `constants.ts`: Application-wide constants.
  - `types/`: TypeScript type definitions for data structures used throughout the application (e.g., `Story`, `Comment`, `User`, `Tag`, `Form`, `SiteSettings`).
    - `index.ts`: Exports all type definitions.
  - `App.tsx`: Main application component that sets up React Router, Convex provider, Clerk provider, and renders the `Layout` and page components.
  - `main.tsx`: Entry point of the React application. Initializes the Convex client and renders the `App` component.
  - `index.css`: Global CSS styles and Tailwind CSS setup, including the custom color scheme.
- `.env.local`: Local environment variables, including `VITE_CONVEX_URL` and Clerk keys.
- `package.json`: Project dependencies (React, Convex, Clerk, Tailwind CSS, Lucide React, date-fns, React Markdown, Radix UI) and scripts (dev, build, preview).
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript configuration files.
- `vite.config.ts`: Vite build configuration.
- `tailwind.config.js`: Tailwind CSS configuration, defining the custom color scheme and typography.
- `postcss.config.js`: PostCSS configuration.
- `eslint.config.js`: ESLint configuration for code linting.
- `README.md`: Project overview, features, technical stack, setup instructions, and project structure.
- `features.md`: Tracks implemented and planned application features.
- `prompts.md`: History of prompts given during development (for internal tracking).
- `files.md`: This file - a detailed overview of the codebase structure and file purposes.
- `changelog.md`: Developer-friendly changelog of new features and notable changes.
- `clerk-setup.md`, `clerk-setup2.md`, `clerksetup2-reac.md`: Notes related to Clerk integration. (These might be temporary or internal notes)
- `components.json`: Likely related to a component library or UI configuration (e.g., for shadcn/ui if used).
- `index.html`: The main HTML file for the Vite project.
- `bun.lockb`: Bun lockfile for managing dependencies.
- `package-lock.json`: NPM lockfile.
- `.gitignore`: Specifies intentionally untracked files that Git should ignore.

## Root Configuration Files

### `package.json`

- Lists project dependencies (e.g., `convex`, `react`, `tailwindcss`, `@clerk/clerk-react`).
- Defines scripts for common tasks: `dev` (start development server), `build` (create production build), `preview` (serve production build locally).
- Contains project metadata like name, version, and description.

### `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`

- Configure the TypeScript compiler (`tsc`).
- `tsconfig.json`: Base configuration, often extended by more specific ones.
- `tsconfig.app.json`: TypeScript settings specific to the frontend application code (e.g., JSX settings, DOM library).
- `tsconfig.node.json`: TypeScript settings for Node.js environments, potentially for scripts or server-side aspects if any outside Convex.

### `vite.config.ts`

- Configuration file for Vite, the frontend build tool.
- Sets up plugins (e.g., `@vitejs/plugin-react` for React support).
- Defines development server options (port, proxy rules).
- Configures the build process (output directory, minification).

### `tailwind.config.js`

- Configures Tailwind CSS, a utility-first CSS framework.
- Defines the custom color palette (Background: `#F8F7F7`, Text: `#525252`, Headers: `#2A2825`, etc.).
- Customizes theme aspects like fonts, spacing, and breakpoints.
- Enables Tailwind plugins (e.g., `@tailwindcss/typography`).

### `postcss.config.js`

- Configuration for PostCSS, a tool for transforming CSS with JavaScript plugins.
- Typically includes `tailwindcss` and `autoprefixer` plugins.

### `eslint.config.js` (or `.eslintrc.js`, `.eslintrc.json`)

- Configuration for ESLint, a static code analysis tool for identifying and reporting on patterns in JavaScript and TypeScript.
- Defines linting rules, parser options (for TypeScript, JSX), and plugins (e.g., for React, a11y).

## Source Files (`src/`)

### Core Application Files

#### `src/main.tsx`

- The main entry point for the React application.
- Initializes the ConvexReactClient with the `VITE_CONVEX_URL`.
- Wraps the `App` component with `ConvexProvider` and `ClerkProvider`.
- Renders the root React component into the DOM.
- Imports global styles from `index.css`.

#### `src/App.tsx`

- The root React component of the application.
- Sets up client-side routing using `react-router-dom` (`BrowserRouter`, `Routes`, `Route`).
- Defines the overall page structure, often including the main `Layout` component that wraps page content.
- Maps URL paths to specific page components (e.g., `HomePage`, `StoryPage`, `AdminPage`).

#### `src/index.css`

- Contains global CSS styles and Tailwind CSS directives (`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`).
- Defines custom CSS variables or base styles if needed, complementing Tailwind's utilities.
- Imports custom fonts if used.

### Component Files (`src/components/`)

#### Layout and Core Components

##### `src/components/Layout.tsx`

- Provides the consistent structure for most pages (header, main content area, footer).
- Includes the main navigation, search functionality, view mode toggles (list/grid/vibe), tag and sort period filters.
- Manages user authentication status display (Sign In button or UserButton via Clerk).
- Passes context (like `viewMode`, `selectedTagId`, `sortPeriod`) to child routes via `Outlet` context.

##### `src/components/Footer.tsx`

- Renders the site footer.
- Contains links to informational pages (e.g., About, Terms of Service), social media, or GitHub repository.
- May include a copyright notice and an "About" modal dialog.

##### `src/components/StoryList.tsx`

- Responsible for displaying a collection of stories/submissions.
- Supports multiple view modes:
  - Grid view: Shows screenshots and descriptions.
  - List view: Focuses on titles and engagement metrics.
  - Vibe view: (Assumed to be another distinct layout, possibly more visual or interactive).
- Implements pagination to navigate through large sets of stories.
- Allows sorting by various criteria (e.g., creation time, number of votes) and time periods (Today, Week, Month, Year, All Time).
- Filters stories based on selected tags.

##### `src/components/StoryDetail.tsx`

- Displays all information for a single story/submission.
- Shows title, tagline, full description, and uploaded screenshots.
- Displays author/submitter information and submission timestamp.
- Includes interactive elements for upvoting.
- Contains the `Comment` section for user discussions.

##### `src/components/StoryForm.tsx`

- Provides the interface for users to submit new applications/stories.
- Includes input fields for:
  - Title, Tagline, Description (rich text or markdown).
  - Links to social media announcements (LinkedIn, X/Twitter, Bluesky, Reddit).
  - Selection of relevant tags from a predefined list.
- Handles file uploads for up to 4 screenshots per submission.
- Enforces submission limits (e.g., one per day).
- Performs client-side and server-side validation.

#### Comment System

##### `src/components/Comment.tsx`

- Renders an individual comment.
- Supports Markdown for rich text formatting in comments.
- Displays the commenter's name and the time of the comment.
- Allows for replying to the comment, creating nested threads.
- May include options to upvote or report the comment.

##### `src/components/CommentForm.tsx`

- A form for users to write and submit new comments or replies.
- Includes a text area for the comment content (supporting Markdown).
- Requires the user to provide a name if not logged in (or uses the logged-in user's name).
- Handles the submission of the comment to the backend.

#### Admin Components (`src/components/admin/`)

##### `src/components/admin/AdminDashboard.tsx`

- The central hub for all administrative functions.
- Provides navigation (e.g., sidebar or tabs) to different admin sections: Content Moderation, Form Management, Tag Management, Site Settings, User Moderation, Report Management, ConvexBox Settings.
- May display summary statistics or an overview of site activity relevant to admins.

##### `src/components/admin/ContentModeration.tsx`

- Allows administrators to manage user-generated content.
- Displays queues of reported submissions and comments.
- Provides tools to review, approve, hide, show, archive, or delete content.
- Admins can add custom messages to submissions that are visible on the frontend.

##### `src/components/admin/FormBuilder.tsx`

- An interface for administrators to create and customize forms.
- Supports various field types: short text, long text, URL, email, yes/no, dropdown, multi-select.
- Allows setting fields as required and defining custom validation rules.
- Provides a preview of the form as it's being built.

##### `src/components/admin/FormResults.tsx`

- Enables administrators to view and manage data collected through the custom forms.
- Lists submissions for each form.
- Allows sorting and filtering of results.
- Provides an option to export form submission data to CSV format.
- Admins can toggle the visibility of results or share result pages with custom URLs.

##### `src/components/admin/Forms.tsx`

- A dashboard for managing all existing custom forms.
- Admins can view a list of forms, edit them, delete them.
- Toggle the visibility of forms (making them public or private).
- Generate and copy shareable URLs for each form.
- View statistics like the number of submissions per form.

##### `src/components/admin/Settings.tsx`

- Allows administrators to configure global settings for the application.
- Options may include:
  - Default view mode (grid/list/vibe) for `StoryList`.
  - Number of items per page for pagination.
  - Settings for anonymous submissions (allow/disallow, moderation rules).
  - Settings for anonymous comments.
  - Other site-wide preferences or feature toggles.

##### `src/components/admin/TagManagement.tsx`

- Provides tools for managing the tags used to categorize submissions.
- Admins can add new tags, edit existing tags (name, description), and delete tags.
- Control which tags are prominently displayed in the header navigation or filtering options.
- Organize tags, possibly into categories, for better discovery.

##### `src/components/admin/UserModeration.tsx`

- Interface for administrators to manage users.
- Allows actions like viewing user details, banning users, muting users, or changing user roles/permissions.

##### `src/components/admin/ReportManagement.tsx`

- Enables administrators to review and act upon reports submitted by users regarding content (stories, comments) or other users.
- Provides tools to dismiss reports, take action based on reports (e.g., moderate content, warn/ban user), and track report statuses.

##### `src/components/admin/NumbersView.tsx`

- A dedicated component within the admin dashboard to display important numerical data, statistics, or key performance indicators (KPIs) at a glance.

##### `src/components/admin/ConvexBoxSettingsForm.tsx`

- A form within the admin settings area that allows administrators to configure the properties and behavior of the `ConvexBox` component. This might include its content, visibility rules, or appearance.

#### Utility Components

##### `src/components/ConvexBox.tsx`

- A general-purpose UI component, likely a dismissible notification or information box.
- Could be used to display announcements, tips, or information about Convex integration.
- Its content and visibility would be controlled dynamically.

##### `src/components/UserSyncer.tsx`

- A component that runs for signed-in users to ensure their Clerk user data (like username, profile picture) is synchronized with their corresponding user document in the Convex database. This is crucial for keeping user information consistent across authentication and application data layers.

#### Search Components

##### `src/components/SearchResults.tsx`

- Displays the results of a user's search query.
- Fetches and renders submissions and comments that match the search term.
- May offer further filtering or sorting options for the search results.
- Handles cases where no results are found, displaying an appropriate message.

### Page Components (`src/pages/`)

- Each file in this directory typically corresponds to a top-level view or page accessible via a specific URL route.
  - `HomePage.tsx`: The main landing page, likely displaying `StoryList`.
  - `SubmitPage.tsx`: Hosts the `StoryForm` for new submissions.
  - `StoryPage.tsx`: Displays a single story using `StoryDetail`.
  - `SearchPage.tsx`: Shows search results using `SearchResults`.
  - `SignInPage.tsx`, `SignUpPage.tsx`: Clerk authentication pages.
  - `UserProfilePage.tsx`: Displays a user's public profile.
  - `SetUsernamePage.tsx`: Allows new users to set their initial username.
  - `NavTestPage.tsx`: A blank page with header/footer for testing navigation components.
  - `AdminPage.tsx`: The entry point for the admin section, usually rendering `AdminDashboard` and handling admin-specific routing or layout.

### Type Definitions (`src/types/`)

#### `src/types/index.ts`

- Centralizes all custom TypeScript type definitions and interfaces used across the frontend.
- Defines shapes for data objects like:
  - `Story`: Includes fields for title, description, screenshots, author ID, tags, vote count, etc.
  - `Comment`: Includes content, author ID, parent comment ID (for threading), timestamp.
  - `User`: Represents user profiles, possibly with fields like username, avatar URL, linked Clerk ID.
  - `Tag`: Defines the structure for tags (e.g., `_id`, `name`, `isHidden`, `isHeaderTag`).
  - `Form`: Represents the structure of a custom form (fields, title, slug).
  - `FormField`: Defines types for different form fields (text, URL, dropdown, etc.).
  - `FormSubmission`: The structure of data submitted through a form.
  - `SiteSettings`: Typed definition for the global site settings object.
  - `Vote`, `Report`: Types for voting and reporting data.

### Environment Types (`src/vite-env.d.ts`)

- Contains type declarations for environment variables accessed via `import.meta.env` in Vite projects.
- Ensures TypeScript understands the shape and types of variables like `VITE_CONVEX_URL`.
- Can also include other global type augmentations if needed.
