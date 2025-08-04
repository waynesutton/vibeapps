# VibeApps

A modern social network platform for app creators to showcase their projects, built with React, TypeScript, Convex, and Clerk Auth.

## Features

### Core Platform Features

- **App Submissions**: Users can submit their apps with title, description, URL, video demos, and screenshots
- **Anonymous Submissions**: Support for non-authenticated app submissions with email collection
- **Dynamic Form Fields**: Configurable form fields for submissions (LinkedIn, Twitter, GitHub, etc.)
- **Tag System**: Categorize apps with existing tags or create new ones during submission
- **User Authentication**: Secure login/signup with Clerk Auth
- **User Verification**: Blue checkmark verification system for verified users
- **User Profiles**: Custom username pages with activity feeds and stats
- **Following System**: Users can follow other creators and see their activity
- **Real-time Updates**: Live updates powered by Convex database
- **Responsive Design**: Clean, modern UI that works on all devices
- **Search & Discovery**: Full-text search across apps and users with advanced filtering

### Content & Engagement

- **Comment System**: Threaded comments on app submissions with moderation
- **Bookmarking**: Save favorite apps for later viewing
- **Rating System**: 1-5 star rating system for submitted apps
- **Voting System**: Upvote apps to show appreciation
- **Weekly Leaderboards**: Discover trending apps and top creators
- **Top Categories**: Weekly trending categories and tags

### Admin & Moderation

- **Admin Dashboard**: Comprehensive content moderation with approval/rejection workflows
- **User Management**: Admin interface for user verification, moderation, and profile management
- **Content Moderation**: Report management system with admin review capabilities
- **Tag Management**: Create, edit, and organize tags with custom styling
- **Settings Management**: Site-wide configuration and customization
- **Analytics Dashboard**: Detailed metrics and user engagement tracking
- **ConvexBox**: Dismissible notification system for announcements

### Custom Forms & Data Collection

- **Dynamic Form Builder**: Create custom forms with various field types
- **Form Management**: Public/private forms with configurable access
- **Form Results**: View and export form submissions
- **Field Configuration**: Customizable form fields with validation

### Comprehensive Judging System

- **Judging Groups**: Create public or private judging competitions
- **Custom Criteria**: Define scoring questions with 1-5 star ratings
- **Judge Management**: Session-based judge authentication and tracking
- **Submission Management**: Add/remove submissions from judging groups
- **Real-time Scoring**: Live score submission and progress tracking
- **Results Dashboard**: Comprehensive results with rankings and analytics
- **CSV Export**: Export detailed judging results and scores
- **Public Results**: Optional public results pages with password protection
- **Judge Collaboration**: Notes and comments system for judges
- **Status Tracking**: Pending/Completed/Skip status for submissions

### Email Integration (Resend)

- **Email Collection**: Integrated email capture for notifications
- **Form Submissions**: Email notifications for form completions
- **Admin Notifications**: Daily reports and system updates

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Clerk Auth
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with shadcn/ui patterns
- **Package Manager**: Bun
- **Deployment**: Netlify (with \_redirects for SPA routing)

## Project Structure

```
vibeapps/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── admin/          # Admin dashboard components
│   │   └── ui/             # Base UI components
│   ├── pages/              # Top-level page components
│   ├── lib/                # Utility functions and helpers
│   └── types/              # TypeScript type definitions
├── convex/                 # Backend functions and schema
│   ├── schema.ts           # Database schema definition
│   ├── auth.ts             # Authentication functions
│   └── *.ts                # Query/mutation functions
└── public/                 # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Convex account
- Clerk account

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd vibeapps
```

2. Install dependencies

```bash
bun install
```

3. Set up environment variables

```bash
cp .env.example .env.local
```

Add your Convex and Clerk credentials to `.env.local`:

```
VITE_CONVEX_URL=your_convex_url
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

4. Set up Convex

```bash
bunx convex dev
```

5. Run the development server

```bash
bun dev
```

### Admin Setup

After initial setup, the first registered user will need to be granted admin privileges through the Convex dashboard or by manually updating the database.

## Key Features

### For Users

- Submit and showcase apps
- Follow other creators
- Comment and rate apps
- Bookmark favorites
- Search and discover content
- User verification system

### For Judges

- **Access Control**: Join public judging groups or enter private groups with passwords
- **Custom Scoring**: Rate submissions using configurable 1-5 star criteria
- **Detailed Evaluation**: Score submissions against multiple custom questions
- **Progress Tracking**: Track judging status (pending/completed/skip) across all submissions
- **Collaboration**: Add notes and comments for other judges to see
- **Real-time Updates**: See live scoring progress and submission status
- **Session Management**: Secure session-based authentication without requiring accounts

### For Admins

- **Content Moderation**: Approve/reject submissions with custom messages
- **User Management**: Verify users, manage bans/pauses, and profile administration
- **Tag Management**: Create and customize tags with colors, emojis, and ordering
- **Custom Form Builder**: Create dynamic forms with various field types and validation
- **Judging System**: Create and manage judging groups, criteria, and competitions
- **Report Management**: Review and resolve user-reported content
- **Analytics Dashboard**: Comprehensive metrics on users, submissions, engagement
- **Site Configuration**: Manage view modes, submission limits, and platform settings
- **Email Integration**: Configure Resend integration for notifications
- **ConvexBox Management**: Control platform-wide notification banners

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
