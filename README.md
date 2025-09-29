# VibeApps

The community where you go to show off what you've built, and see what others are building. Built with React, TypeScript, Convex, and Clerk Auth.

## Features

### Core Platform Features

- **App Submissions**: Users can submit their apps with title, description, URL, video demos, and multiple screenshots
- **Multi-Image Gallery**: Support for up to 4 additional images with thumbnail navigation and modal Lightbox viewer
- **Anonymous Submissions**: Support for non-authenticated app submissions with email collection
- **Dynamic Form Fields**: Configurable form fields for submissions (LinkedIn, Twitter, GitHub, etc.)
- **Tag System**: Categorize apps with existing tags or create new ones during submission with enhanced search dropdown
- **User Authentication**: Secure login/signup with Clerk Auth
- **User Verification**: Blue checkmark verification system for verified users
- **User Profiles**: Custom username pages at /username with activity feeds, stats, and following system
- **Following System**: Users can follow other creators and see their activity in real-time
- **Real-time Updates**: Live updates powered by Convex database
- **Responsive Design**: Clean, modern UI that works on all devices
- **Search & Discovery**: Full-text search across apps and users with advanced filtering
- **Hackathon Team Support**: Team submissions with member information and custom forms

### Content & Engagement

- **Comment System**: Threaded comments on app submissions with 10-word minimum and moderation
- **Bookmarking**: Save favorite apps for later viewing with improved interface
- **Rating System**: 1-5 star rating system for submitted apps
- **Voting System**: Upvote apps to show appreciation
- **Weekly Leaderboards**: Discover trending apps and top creators in sidebar
- **Top Categories**: Weekly trending categories and tags
- **Related Apps**: Show 3 related products by tags below comments
- **User Reports**: Report inappropriate content with admin review system
- **Notification System**: Real-time notifications for votes, comments, ratings, follows, bookmarks, and admin reports

### Admin & Moderation

- **Admin Dashboard**: Comprehensive content moderation with approval/rejection workflows
- **User Management**: Admin interface for user verification, ban/pause users, and profile management
- **Content Moderation**: Report management system with admin review capabilities and image management
- **Tag Management**: Create, edit, and organize tags with custom styling, colors, emojis, and ordering
- **Settings Management**: Site-wide configuration and customization with view mode controls
- **Analytics Dashboard**: Detailed metrics and user engagement tracking
- **ConvexBox**: Dismissible notification system for announcements with custom styling
- **Image Management**: Admin can manage additional images for submissions
- **Admin Notifications**: Real-time notifications for admins and managers when users report submissions

### Custom Forms & Data Collection

- **Dynamic Form Builder**: Create custom forms with various field types and validation
- **Form Management**: Public/private forms with configurable access and submission tracking
- **Form Results**: View and export form submissions with search functionality
- **Field Configuration**: Customizable form fields with ordering and enable/disable toggles
- **Submit Form System**: Create specialized submission forms (e.g., YC AI Hackathon) with custom fields
- **Story Form Fields**: Dynamic configuration of submission form fields

### Comprehensive Judging System

- **Judging Groups**: Create public or private judging competitions with password protection
- **Custom Criteria**: Define scoring questions with 1-10 star ratings and weighted scoring
- **Judge Management**: Session-based judge authentication and tracking with progress monitoring
- **Submission Management**: Add/remove submissions from judging groups with search functionality
- **Real-time Scoring**: Live score submission and progress tracking across all submissions
- **Results Dashboard**: Comprehensive results with rankings, analytics, and CSV export
- **Public Results**: Optional public results pages with password protection
- **Judge Collaboration**: Notes and comments system for judges with threaded discussions
- **Status Tracking**: Pending/Completed/Skip status for submissions with assignment tracking
- **Submission Search**: Search submissions by name during judging process

### Email Integration (Resend) ✅ FULLY IMPLEMENTED

- **Complete Email Infrastructure**: Production-ready Resend integration using Convex Resend Component
- **Daily Admin Reports**: Automated daily metrics emails to admins at 9 AM PST with platform health data
- **Daily User Engagement**: Personalized daily digest emails including app engagement, new followers, and @mentions (max 10 per email)
- **Weekly Digest**: "Most Vibes This Week" leaderboard emails sent Mondays at 9 AM PST
- **Welcome Emails**: Automated onboarding emails for new user signups via Clerk webhooks
- **@Mentions Integration**: Mentions included in daily digest emails (rate-limited to reduce noise)
- **Admin Broadcast System**: Admin can send emails to all users or selected users with search functionality
- **Email Preferences**: Users can manage email preferences and unsubscribe from their profile page
- **Global Kill Switch**: Admin toggle to disable all email sending (`appSettings.emailsEnabled`)
- **Webhook Integration**: Resend webhook handler for email delivery tracking and status updates
- **Email Logging**: Complete audit trail of all email sends with delivery status tracking
- **Force Logout System**: Admin can force all users to re-login to sync missing email addresses
- **Test Email System**: Admin can send test emails and trigger daily/weekly emails manually for testing

## Recent Updates

- Submit Forms system expanded:
  - Admin create/edit modals for submit forms (`CreateSubmitFormModal`, `EditSubmitFormModal`)
  - Field-level management for submit forms (`SubmitFormFieldManagement`)
  - Dynamic public renderer for submit forms (`DynamicSubmitForm`)
- Judging: Public results dashboard and viewer (`PublicJudgingResultsDashboard`, `PublicResultsViewer`)
- ConvexBox: Settings UI (`ConvexBoxSettingsForm`) and config in `convex/convexBoxConfig.ts`
- User sync: Clerk ↔ Convex synchronization component (`UserSyncer`)

## What's needed

- Clerk roles for hackathon organizers to access judges section only in admin
- Alerts when an admin pins or posts a message to their own app
- Fix links used in weekly digest emails
- Inbox feature with email notifications
- Post notification emails via Resend (update `convex/emails/templates.ts`)
- User toggle to turn off email notifications in profile

## Tech Stack

- **Frontend**: React 18, TypeScript, `Vite`
- **Backend**: Convex (real-time database and `serverless` functions)
- **Authentication**: Clerk Auth
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with `shadcn/ui` patterns
- **Package Manager**: Bun
- **Deployment**: `Netlify` (with \_redirects for SPA routing)

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

- Node 18+ or Bun
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

- Submit and showcase apps with multiple images and team information
- Follow other creators and see their activity in real-time
- Comment and rate apps with enhanced moderation
- Bookmark favorites with improved interface
- Search and discover content with advanced filtering
- User verification system with blue checkmarks
- Report inappropriate content
- View related apps by tags
- Receive real-time notifications for votes, comments, ratings, follows, and bookmarks

### For Judges

- **Access Control**: Join public judging groups or enter private groups with passwords
- **Custom Scoring**: Rate submissions using configurable 1-10 star criteria
- **Detailed Evaluation**: Score submissions against multiple custom questions with weighted scoring
- **Progress Tracking**: Track judging status (pending/completed/skip) across all submissions
- **Collaboration**: Add notes and comments for other judges with threaded discussions
- **Real-time Updates**: See live scoring progress and submission status
- **Session Management**: Secure session-based authentication without requiring accounts
- **Submission Search**: Find submissions by name during the judging process

### For Admins

- **Content Moderation**: Approve/reject submissions with custom messages and image management
- **User Management**: Verify users, manage bans/pauses, and comprehensive profile administration
- **Tag Management**: Create and customize tags with colors, emojis, ordering, and search
- **Custom Form Builder**: Create dynamic forms with various field types and validation
- **Submit Form Management**: Create specialized submission forms like hackathon entries
- **Judging System**: Create and manage judging groups, criteria, and competitions with full control
- **Report Management**: Review and resolve user-reported content with detailed tracking
- **Analytics Dashboard**: Comprehensive metrics on users, submissions, engagement, and judging
- **Site Configuration**: Manage view modes, submission limits, and platform settings
- **Email Integration**: Configure Resend integration for notifications (in development)
- **ConvexBox Management**: Control platform-wide notification banners with custom styling
- **Image Gallery Management**: Manage multiple images for submissions with admin controls
- **Admin Notifications**: Receive real-time notifications when users report submissions with direct links to reported content

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
