# Vibe Apps – The place to share and discover new apps built by vibe coders.

### About

Vibe Apps is a real-time feed of apps built by vibe coders. It’s where you go to show off what you’ve built with tools like Convex.dev, Cursor, Bolt, Windsurf, Lovable, and Tempo—and see what others are pushing live.

Powered by Convex, the site runs fast, syncs in real time, and makes it easy to:
• Submit your app
• Browse and vote on what’s trending
• Leave feedback or get inspired

Whether it’s a weekend build, a fresh SaaS idea, or something weird and experimental—drop it here. Vibe Apps is for developers who build in public and ship for fun.

## Features

### For Users

#### 🚀 Submission Features

- **Submit Your Applications**: Easily share your innovative applications with the community. Provide custom titles, detailed descriptions, and catchy taglines.
- **Visual Showcase**: Upload up to 4 screenshots per submission to visually represent your app's interface and functionality.
- **Social Integration**: Link your submissions to announcements on platforms like LinkedIn, Twitter/X, Bluesky, and Reddit to broaden your reach.
- **Categorize with Tags**: Select relevant tags from a curated list (e.g., AI, SaaS, Hackathon, Productivity, Social) to help users discover your app.
- **Submission Cadence**: A limit of one submission per day per user helps maintain content quality and ensures diverse visibility.

#### 🧭 Browsing & Discovery

- **Flexible Viewing Options**: Tailor your browsing experience.
  - **Grid View**: Offers a visual overview with screenshots and brief descriptions.
  - **List View**: Focuses on titles, authors, and key engagement metrics (votes, comments).
  - **Vibe View**: (Assumed unique view, potentially emphasizing trending or highly interactive content).
- **Advanced Filtering & Sorting**: Narrow down your search with precision.
  - **Filter by Tags**: Discover apps in specific categories like "AI", "SaaS", "Games", etc.
  - **Sort by Time Period**: Find the latest or most popular apps from "Today", "This Week", "This Month", "This Year", or "All Time".
  - **Sort by Engagement**: Discover trending apps by sorting based on "Most Vibes (Votes)" within selected time periods.
- **Efficient Navigation**: Paginated results with customizable items per page for smooth browsing.
- **Powerful Search Functionality**:
  - **Expandable Interface**: A clean, icon-based search trigger expands into a full search bar.
  - **Full-Text Search**: Comprehensive search across submission titles, descriptions, tags, and even comments.
  - **Real-Time Results**: Get instant feedback as you type your query.

#### ❤️ Engagement Features

- **Interactive Elements**: Engage with submissions and the community.
  - **Upvote (Vibe)**: Show appreciation and boost the visibility of apps you like with an upvote.
  - **Comment System**: Leave feedback, ask questions, or share your thoughts on submissions.
    - **Markdown Support**: Format your comments with Markdown for clarity and expression.
    - **Nested Replies**: Engage in threaded discussions with nested comment replies.
    - **Moderation**: Comments are subject to moderation to maintain a healthy community.
    - **Name Required**: Users must provide a name (or use their profile) for commenting, fostering accountability.
  - **View Metrics**: See comment counts and upvote statistics for each submission.
- **Social Sharing**: Easily share interesting submissions via direct links.
- **Stay Informed**: View submission timestamps and author information to know who built what, and when.

### For Administrators

#### 🛠️ Content Management & Moderation

- **Comprehensive Moderation Tools**: Maintain a high-quality and safe platform.
  - **Review Queues**: Separate moderation queues for reported submissions and comments.
  - **Content Actions**: Hide, show, archive, or delete inappropriate or irrelevant content.
  - **Custom Messages**: Add admin-defined messages to submissions, which appear on the frontend (e.g., for clarifications or warnings).
  - **Filter & Search**: Efficiently navigate and manage the moderation queue.

#### 📝 Form Management

- **Dynamic Form Builder**: Create custom forms for various purposes (e.g., surveys, feedback, applications).
  - **Multiple Field Types**: Design forms with short text, long text, URL, email, yes/no choice, dropdown selections, and multi-select options.
  - **Customization**: Set fields as required and add custom validation rules.
  - **Live Preview**: Preview forms as they are being built before publishing.
- **Form Administration**: Manage all aspects of your forms.
  - **Visibility Control**: Toggle forms between public and private states.
  - **Shareable Links**: Generate unique, shareable URLs for each form.
  - **Submission Tracking**: View and manage all submissions received through each form.
  - **Data Export**: Export form submission data to CSV for analysis or record-keeping.
  - **Organization**: Keep forms organized with custom titles and slugs.

#### 📊 Results Management (for Custom Forms)

- **View Submissions**: Access and review all data submitted through custom forms, organized by form.
- **Sort & Filter**: Easily sort and filter form results for better analysis.
- **Export Capabilities**: Export results to CSV, specific to each form.
- **Visibility Control**: Manage the visibility of form result pages.
- **Shareable Result Pages**: Create custom URLs to share specific form result views (with appropriate permissions).
- **Metrics**: Track submission counts and other relevant metrics for each form.

#### #️⃣ Tag Management

- **Centralized Tag System**: Manage the taxonomy of the platform effectively.
  - **Header Tag Control**: Decide which tags appear prominently in the site header for quick filtering.
  - **CRUD Operations**: Add new tags, remove obsolete ones, and manage existing tag details.
  - **Visibility Toggle**: Control the visibility of tags in the header navigation.
  - **Categorization**: Organize content effectively with custom tag categories if needed.

#### ⚙️ Site Settings

- **Global Configuration Panel**: Customize the overall behavior and appearance of the Vibe Apps platform.
  - **Default View Mode**: Set the default view (grid, list, or vibe) for browsing submissions.
  - **Pagination Settings**: Configure the default number of submissions displayed per page.
  - **Anonymous Access**: Manage settings for anonymous submissions and comments (e.g., allow, disallow, require moderation).
  - **Site-wide Preferences**: Control other global preferences and feature toggles.

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
- Headers: `#292929`
- Secondary Text: `#545454`
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
│   │   │   ├── AdminDashboard.tsx         # Admin control panel, navigation, and overview statistics
│   │   │   ├── ContentModeration.tsx      # Content moderation queue, report handling, and visibility controls
│   │   │   ├── FormBuilder.tsx            # Custom form creation, field management, and preview
│   │   │   ├── FormResults.tsx            # Form submission viewing, filtering, and CSV export
│   │   │   ├── Forms.tsx                  # Form management interface, visibility controls, and export
│   │   │   ├── Settings.tsx               # Global site settings and feature toggles
│   │   │   └── TagManagement.tsx          # Tag creation, deletion, and organization
│   │   ├── Comment.tsx                    # Displays a single comment with markdown rendering and reply support
│   │   ├── CommentForm.tsx                # Form for adding new comments or replies, with validation
│   │   ├── ConvexBox.tsx                  # Convex integration notice and dismissible notification
│   │   ├── Footer.tsx                     # Application footer with links and about modal
│   │   ├── Layout.tsx                     # Main application layout, header, navigation, view mode controls
│   │   ├── SearchResults.tsx              # Displays search results, filtering, and empty state handling
│   │   ├── StoryDetail.tsx                # Displays details of a single story, handles rating, comments, and metadata
│   │   ├── StoryForm.tsx                  # Form for submitting new stories, handles file upload and validation
│   │   └── StoryList.tsx                  # Displays a list or grid of stories, handles pagination, sorting, and filtering
│   ├── convex/            # Convex backend functions
│   │   ├── schema.ts      # Database schema
│   │   └── _generated/    # Generated types
│   ├── types/             # TypeScript type definitions
│   ├── App.tsx           # Main application component
│   ├── index.css         # Global styles
│   └── main.tsx          # Application entry point
├── public/               # Static assets
├── files.md              # Overview of codebase structure
├── changelog.md          # Developer-friendly changelog of new features added
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
