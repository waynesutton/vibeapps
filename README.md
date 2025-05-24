# Vibe Apps – The place to share and discover new apps built by vibe coders.

### About

Vibe Apps is a real-time feed of apps built by vibe coders. It's where you go to show off what you've built with tools like Convex.dev, Cursor, Bolt, Windsurf, Lovable, and Tempo—and see what others are pushing live.

Powered by Convex, the site runs fast, syncs in real time, and makes it easy to:
• Submit your app
• Browse and vote on what's trending
• Leave feedback or get inspired

Whether it's a weekend build, a fresh SaaS idea, or something weird and experimental—drop it here. Vibe Apps is for developers who build in public and ship for fun.

## Features

### For Users

#### 🚀 Submission Features

- **Submit Your Applications**: Easily share your innovative applications with the community. Provide custom titles, detailed descriptions, and catchy taglines.
- **Visual Showcase**: Upload up to 4 screenshots per submission to visually represent your app's interface and functionality.
- **Social Integration**: Link your submissions to announcements on platforms like LinkedIn, Twitter/X, Blue Sky, and Reddit to broaden your reach.
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
- **Verified Users**: Trusted community members are marked with blue verification checkmarks next to their names, helping you identify credible contributors and high-quality submissions.

### For Administrators

#### 🛠️ Content Management & Moderation

- **Comprehensive Moderation Tools**: Maintain a high-quality and safe platform.
  - **Review Queues**: Separate moderation queues for reported submissions and comments.
  - **Content Actions**: Hide, show, archive, or delete inappropriate or irrelevant content.
  - **Custom Messages**: Add admin-defined messages to submissions, which appear on the frontend (e.g., for clarifications or warnings).
  - **Filter & Search**: Efficiently navigate and manage the moderation queue.

#### 👥 User Management & Verification

- **User Moderation Tools**: Comprehensive user management capabilities.
  - **User Search & Filtering**: Search across all users by name, email, or username with real-time filtering by status (banned, paused, verified).
  - **User Actions**: Ban, unban, pause, unpause, or delete user accounts with confirmation dialogs.
  - **User Verification System**: Verify trusted community members with blue checkmarks that appear next to their names throughout the platform.
    - **Verify/Unverify**: Mark users as verified to build trust and credibility in the community.
    - **Verification Filtering**: Filter users by verification status to manage verified members efficiently.
    - **Visual Indicators**: Verified users display a distinctive blue checkmark badge on their profiles and next to their submissions.
  - **Profile Navigation**: Click on user names to view their public profiles directly from the admin interface.
  - **User Statistics**: View user join dates and activity metrics for informed moderation decisions.

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
- **Icons**: Lucid React
- **Routing**: React Router v6
- **Date Handling**: date-fns
- **Rich Text**: React Markdown for comment formatting
- **UI Components**: Radix UI primitives for accessible components
- **Database**: Convex for real-time data synchronization
- **Authentication**: Clerk auth system

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

## Admin Setup

To access the admin dashboard at `/admin`, you need to set up the admin role in Clerk for your user account.

### Setting Up Admin Role

1. **Go to the Clerk Dashboard**: Navigate to your Clerk application dashboard at [https://dashboard.clerk.com](https://dashboard.clerk.com)

2. **Navigate to Users**: In the left sidebar, click on "Users" to view all registered users

3. **Select Your User**: Find and click on your user account that you want to make an admin

4. **Edit User Metadata**:

   - Scroll down to the "Metadata" section
   - Click on "Public metadata"
   - Add the following JSON:

   ```json
   {
     "role": "admin"
   }
   ```

   - Click "Save" to apply the changes

5. **Sign Out and Sign Back In**: For the role changes to take effect, sign out of your Vibe Apps application and sign back in

6. **Access Admin Dashboard**: You should now be able to access the admin dashboard at `/admin`

### Admin Features Available

Once you have admin access, you can:

- Moderate content (approve/hide submissions and comments)
- Manage users (ban, verify, view profiles)
- Create and manage custom forms
- Configure site settings and default behaviors
- Manage tags and categories
- View platform analytics and metrics

### Troubleshooting Admin Access

If you can't access the admin dashboard after setting the role:

- Ensure you've signed out and back in after setting the metadata
- Check that the JSON is properly formatted in the Clerk dashboard
- Verify the role is set as "admin" (case-sensitive)
- Check your browser's developer console for any authentication errors

For more details on Clerk's role-based access control, visit the [Clerk RBAC documentation](https://clerk.com/docs/references/nextjs/basic-rbac).

## Project Structure

```
vibeapps/
├── convex/ # Convex backend functions, schema, and configuration
│   ├── _generated/ # Auto-generated Convex files
│   ├── schema.ts # Database schema definition
│   ├── http.ts # (Optional) HTTP action definitions
│   ├── crons.ts # (Optional) Cron job definitions
│   └── ... (other .ts files for queries, mutations, actions)
├── public/ # Static assets (favicon, images, etc.)
├── src/ # React frontend application code
│   ├── components/
│   │   ├── admin/ # Admin dashboard components
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── ContentModeration.tsx
│   │   │   ├── FormBuilder.tsx
│   │   │   ├── FormResults.tsx
│   │   │   ├── Forms.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── TagManagement.tsx
│   │   │   ├── UserModeration.tsx
│   │   │   ├── ReportManagement.tsx
│   │   │   ├── NumbersView.tsx
│   │   │   └── ConvexBoxSettingsForm.tsx
│   │   ├── ui/ # General UI components (buttons, inputs, etc.)
│   │   ├── Layout.tsx
│   │   ├── StoryList.tsx
│   │   ├── StoryDetail.tsx
│   │   ├── StoryForm.tsx
│   │   ├── Comment.tsx
│   │   ├── CommentForm.tsx
│   │   ├── SearchResults.tsx
│   │   ├── Footer.tsx
│   │   ├── ConvexBox.tsx
│   │   └── UserSyncer.tsx
│   ├── lib/ # Utility functions and helpers (utils.ts, constants.ts)
│   ├── pages/ # Top-level page components
│   │   ├── HomePage.tsx
│   │   ├── SubmitPage.tsx
│   │   ├── StoryPage.tsx
│   │   ├── SearchPage.tsx
│   │   ├── SignInPage.tsx
│   │   ├── SignUpPage.tsx
│   │   ├── UserProfilePage.tsx
│   │   ├── AdminPage.tsx
│   │   ├── SetUsernamePage.tsx
│   │   ├── NavTestPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── types/ # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx # Main application component
│   ├── main.tsx # React application entry point
│   └── index.css # Global styles and Tailwind CSS setup
├── .DS_Store # macOS specific (usually in .gitignore)
├── .env.local # Local environment variables (in .gitignore)
├── .gitignore
├── bun.lockb # Bun lockfile
├── clerk-admin-fix.MD
├── components.json # shadcn/ui configuration
├── eslint.config.js
├── files.MD # Detailed codebase file overview
├── following-plan.MD
├── index.html # Main HTML entry point for Vite
├── llms.txt
├── package-lock.json # NPM lockfile
├── package.json # Project dependencies and scripts
├── postcss.config.js
├── README.md # This file
├── tailwind.config.js
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Future Features

Based on the project's task list, upcoming enhancements include:

- **Community Engagement**: Actively seeking feedback and app submissions from "vibe coders."
- **Email Integration (Resend)**: Setting up Resend for transactional emails, such as password resets, after domain configuration.
- **Team Collaboration & Launch**: Sharing the platform with the team and preparing for a public launch.
- **Pinned Posts**: Adding a feature to pin important posts in the sidebar of the story list.
- **Navigation Icons**: Testing and implementing icons for improved navigation.
- **Admin/Frontend Chat**: Integrating a chat box for communication within the admin dashboard and on the frontend.

## Understanding Convex

Learn more about the concepts and best practices behind Convex:

- [Convex Overview](https://docs.convex.dev/understanding/)
- [Development Workflow](https://docs.convex.dev/understanding/workflow)
- [Best Practices](https://docs.convex.dev/understanding/best-practices/)
- [TypeScript Best Practices](https://docs.convex.dev/understanding/best-practices/typescript)
- [Environment Variables](https://docs.convex.dev/production/environment-variables)
- [AI Code Generation](https://docs.convex.dev/ai)

## Hosting on Netlify

The Vibe Apps platform is hosted on Netlify, leveraging its robust infrastructure for continuous deployment and global content delivery.

For more detailed instructions on Convex and Netlify, visit the [Convex deployment guide](https://docs.convex.dev/production/hosting/).

## 📝 License

This project is open source and available under the MIT License.
