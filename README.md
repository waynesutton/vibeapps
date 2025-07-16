# VibeApps

A modern social network platform for app creators to showcase their projects, built with React, TypeScript, Convex, and Clerk Auth.

## Features

- **App Submissions**: Users can submit their apps with title, description, URL, video demos, and screenshots
- **Optional Email Collection**: Hidden email field for hackathon notifications and communication
- **Tag System**: Categorize apps with existing tags or create new ones during submission
- **User Authentication**: Secure login/signup with Clerk Auth
- **User Verification**: Blue checkmark verification system for verified users
- **Admin Dashboard**: Comprehensive content moderation with approval/rejection workflows and detailed author information
- **User Management**: Admin interface for user verification, moderation, and profile management
- **Content Moderation**: Report management system with admin review capabilities
- **Custom Forms**: Dynamic form builder for collecting user data and submissions
- **Following System**: Users can follow other creators and see their activity
- **Real-time Updates**: Live updates powered by Convex database
- **Responsive Design**: Clean, modern UI that works on all devices
- **Search & Discovery**: Full-text search across apps and users
- **Comment System**: Threaded comments on app submissions
- **Bookmarking**: Save favorite apps for later viewing
- **Rating System**: Users can rate and review submitted apps
- **Weekly Leaderboards**: Discover trending apps and top creators
- **ConvexBox**: Dismissible notification system for announcements

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

### For Admins

- Content moderation dashboard
- User management and verification
- Custom form builder
- Report management
- Site-wide settings
- Analytics and metrics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
