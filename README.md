# Vibe Apps – The place to share and discover new apps built by the vibe coding community.

### About

Discover and share vibe coding apps built with Convex Chef, Cursor, Bolt, Windsurf, Tempo and more. Vibe Apps is powered by Convex.dev.

Vibe Apps is the home for vibe coding projects — a real-time community platform where developers share and explore creative apps built with tools like Convex Chef, Cursor, Bolt, Windsurf, Lovable, Tempo and more. Submit your app, vote on others, drop comments, and discover what the community is cooking. Built on Convex for real-time interaction.

## Features

### For Users

#### Submission Features

- **Submit Applications**: Share your applications with custom titles, descriptions, and tags
  - Upload up to 4 screenshots per submission
  - Link to announcements from LinkedIn, Twitter/X, Bluesky, and Reddit
  - Add custom taglines and project descriptions
  - Select relevant tags from a curated list
  - One submission per day limit to maintain quality

#### Browsing & Discovery

- **Flexible Viewing Options**:
  - Toggle between grid and list views
  - Grid view shows screenshots and descriptions
  - List view focuses on titles and engagement metrics
- **Advanced Filtering**:
  - Filter submissions by tags (AI, SaaS, Hackathon, etc.)
  - Sort by time periods (Today, This Week, This Month, This Year)
  - Paginated navigation with customizable items per page
- **Search Functionality**:
  - Expandable search interface
  - Full-text search across submissions and comments
  - Clean, icon-based search trigger
  - Real-time search results

#### Engagement Features

- **Interactive Elements**:
  - Upvote submissions to show appreciation
  - Comment on submissions with Markdown support
  - Nested comment replies with moderation
  - Name required for commenting
  - View comment counts and submission stats
- **Social Features**:
  - Share submissions via direct links
  - Follow discussion threads
  - View submission timestamps and author info

### For Administrators

#### Content Management

- **Content Moderation**:
  - Review and manage reported content
  - Add custom messages to submissions that appear on the frontend
  - Hide/Show submissions and comments
  - Archive submissions and comments
  - Delete inappropriate content
  - Separate moderation queues for submissions and comments
  - Filter and search through moderation queue

#### Feature: Form Management

- **Form Builder**:
  - Create custom forms with multiple field types:
    - Short text
    - Long text
    - URL
    - Email
    - Yes/No
    - Dropdown
    - Multi-select
  - Set required fields
  - Add custom validation
  - Preview forms before publishing
- **Form Administration**:
  - Toggle form visibility (public/private)
  - Generate shareable form URLs
  - View form submissions
  - Export form data to CSV
  - Organize forms with custom titles and slugs

#### Results Management

- **Form Results**:
  - View submissions by form
  - Sort and filter results
  - Export results to CSV by form
  - Toggle result visibility
  - Share result pages with custom URLs
  - Group and organize results by form
  - Track submission counts and metrics

#### Tag Management

- **Tag System**:
  - Control which tags appear in the header
  - Add, remove, and manage available tags
  - Toggle tag visibility in the header navigation
  - Organize content with custom tag categories

#### Site Settings

- **Global Configuration**:
  - Set default view mode (grid/list)
  - Configure submissions per page
  - Manage anonymous submission settings
  - Control anonymous comment settings
  - Customize site-wide preferences

## Technical Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS with custom color scheme
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Date Handling**: date-fns
- **Rich Text**: React Markdown for comment formatting
- **UI Components**: Radix UI primitives for accessible components
- **Database**: Convex for real-time data synchronization
- **Authentication**: Built-in Convex auth system

## Color Scheme

The application uses a carefully crafted color palette:

- Background: `#F8F7F7`
- Text: `#525252`
- Headers: `#2A2825`
- Secondary Text: `#787672`
- Accent Background: `#F4F0ED`
- Border Color: `#D5D3D0`

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
.
├── src/
│   ├── components/         # React components
│   │   ├── admin/         # Admin dashboard components
│   │   │   ├── ContentModeration.tsx
│   │   │   ├── FormBuilder.tsx
│   │   │   ├── FormResults.tsx
│   │   │   ├── Forms.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── TagManagement.tsx
│   │   ├── Comment.tsx
│   │   ├── CommentForm.tsx
│   │   ├── ConvexBox.tsx
│   │   ├── Footer.tsx
│   │   ├── Layout.tsx
│   │   ├── SearchResults.tsx
│   │   ├── StoryDetail.tsx
│   │   ├── StoryForm.tsx
│   │   └── StoryList.tsx
│   ├── convex/            # Convex backend functions
│   │   ├── schema.ts      # Database schema
│   │   └── _generated/    # Generated types
│   ├── types/             # TypeScript type definitions
│   ├── App.tsx           # Main application component
│   ├── index.css         # Global styles
│   └── main.tsx          # Application entry point
├── public/               # Static assets
└── config files         # Various configuration files
```

## Understanding Convex

Learn more about the concepts and best practices behind Convex:

- [Convex Overview](https://docs.convex.dev/understanding/)
- [Development Workflow](https://docs.convex.dev/understanding/workflow)
- [Best Practices](https://docs.convex.dev/understanding/best-practices/)
- [TypeScript Best Practices](https://docs.convex.dev/understanding/best-practices/typescript)
- [Environment Variables](https://docs.convex.dev/production/environment-variables)
- [AI Code Generation](https://docs.convex.dev/ai)

## Hosting on

For more detailed instructions, visit the [Convex deployment guide](https://docs.convex.dev/production/hosting/).

## 📝 License

This project is open source and available under the MIT License.# vibeapps
