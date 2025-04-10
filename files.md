# Project Files Documentation

## Root Configuration Files

### `package.json`
- Project configuration and dependencies
- Scripts for development, building, and deployment
- Package management and versioning

### `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- TypeScript configuration files
- Compiler options and module settings
- Path aliases and type checking rules

### `vite.config.ts`
- Vite build tool configuration
- Plugin setup (React, TypeScript)
- Development server settings

### `tailwind.config.js`
- Tailwind CSS configuration
- Custom color scheme
- Typography plugin setup

### `postcss.config.js`
- PostCSS configuration
- Tailwind and Autoprefixer setup

### `eslint.config.js`
- ESLint configuration
- TypeScript and React specific rules
- Code style enforcement

## Source Files

### Core Application Files

#### `src/main.tsx`
- Application entry point
- React root rendering
- Global style imports

#### `src/App.tsx`
- Main application component
- Router configuration
- Global layout structure
- Mock data management

#### `src/index.css`
- Global styles
- Tailwind imports
- Custom CSS variables
- Font imports (Inter, Space Mono)

### Component Files

#### Layout and Core Components

##### `src/components/Layout.tsx`
- Main application layout
- Navigation structure
- View mode toggling
- Tag filtering
- Search functionality
- Header and footer integration

##### `src/components/Footer.tsx`
- Site footer component
- About modal dialog
- External links (GitHub, Convex, Flow)
- Modal dialog using Radix UI

##### `src/components/StoryList.tsx`
- Displays submissions in grid/list view
- Pagination controls
- Submission card rendering
- Vote and comment display
- Sort and filter functionality

##### `src/components/StoryDetail.tsx`
- Individual submission view
- Comment section
- Voting interface
- Rating system
- Metadata display

##### `src/components/StoryForm.tsx`
- Submission creation form
- Image upload handling
- Tag selection
- Social media links
- Form validation

#### Comment System

##### `src/components/Comment.tsx`
- Individual comment display
- Markdown rendering
- Reply functionality
- Vote handling
- Timestamp formatting

##### `src/components/CommentForm.tsx`
- Comment creation interface
- Markdown editor
- Author name handling
- Reply context
- Form validation

#### Admin Components

##### `src/components/admin/AdminDashboard.tsx`
- Admin control panel
- Navigation between admin features
- Overview statistics
- Tab-based interface
- Access control

##### `src/components/admin/ContentModeration.tsx`
- Content moderation queue
- Report handling
- Content visibility controls
- Custom message management
- Sort and filter options

##### `src/components/admin/FormBuilder.tsx`
- Custom form creation
- Field type management
- Form preview
- Validation setup
- Field configuration

##### `src/components/admin/FormResults.tsx`
- Form submission viewing
- Result filtering and sorting
- CSV export
- Results grouping
- Visibility controls

##### `src/components/admin/Forms.tsx`
- Form management interface
- Form visibility controls
- URL sharing
- Form deletion
- Export functionality

##### `src/components/admin/Settings.tsx`
- Global site settings
- User preferences
- System configuration
- Feature toggles
- Default values

##### `src/components/admin/TagManagement.tsx`
- Tag creation and deletion
- Tag visibility controls
- Header tag management
- Tag organization
- Batch operations

#### Utility Components

##### `src/components/ConvexBox.tsx`
- Convex integration notice
- Dismissible notification
- External link handling
- Persistence state

#### Search Components

##### `src/components/SearchResults.tsx`
- Search results display
- Result filtering
- Dynamic updates
- Empty state handling
- Result count display

### Type Definitions

#### `src/types/index.ts`
- TypeScript interfaces and types for:
  - Stories (title, content, author, metadata)
  - Comments (content, author, threading)
  - Users (profile, permissions)
  - Forms (fields, validation)
  - Tags (name, visibility)
  - Form fields (types, validation)
  - Form submissions (data, metadata)
  - Rating system (values, counts)

### Environment Types

#### `src/vite-env.d.ts`
- Vite environment type declarations
- Global type augmentations
- Environment variable types
- Module declarations