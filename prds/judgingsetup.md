# Submission Judging System PRD

## Overview

The Submission Judging System is a comprehensive judging platform integrated with the VibeApps admin dashboard. This feature functions as a lightweight judging CRM, allowing administrators to organize submissions into judging groups, define scoring criteria, and enable external judges to score submissions through a dedicated judging interface.

**Current Status**: ✅ Fully Implemented and Production-Ready

## System Architecture

### Data Models

#### 1. Judging Groups (`judgingGroups` table)

```typescript
judgingGroups: defineTable({
  name: v.string(), // Display name for the judging group
  slug: v.string(), // URL-friendly identifier
  description: v.optional(v.string()), // Optional description of the group
  isPublic: v.boolean(), // Public (shareable link) or private access
  password: v.optional(v.string()), // Password for private groups (hashed)
  resultsIsPublic: v.optional(v.boolean()), // Whether results page is public
  resultsPassword: v.optional(v.string()), // Separate password for results page (hashed)
  isActive: v.boolean(), // Whether judging is currently active
  startDate: v.optional(v.number()), // Optional judging start time
  endDate: v.optional(v.number()), // Optional judging end time
  createdBy: v.id("users"), // Admin who created the group
})
  .index("by_slug", ["slug"])
  .index("by_isPublic", ["isPublic"])
  .index("by_isActive", ["isActive"]);
```

#### 2. Judging Criteria (`judgingCriteria` table)

```typescript
judgingCriteria: defineTable({
  groupId: v.id("judgingGroups"), // Associated judging group
  question: v.string(), // The judging question/criteria
  description: v.optional(v.string()), // Optional clarification/description
  weight: v.optional(v.number()), // Optional weighting factor (default 1.0)
  order: v.number(), // Display order
}).index("by_groupId_order", ["groupId", "order"]);
```

#### 3. Group Submissions (`judgingGroupSubmissions` table)

```typescript
judgingGroupSubmissions: defineTable({
  groupId: v.id("judgingGroups"), // Associated judging group
  storyId: v.id("stories"), // Submission being judged
  addedBy: v.id("users"), // Admin who added the submission
  addedAt: v.number(), // When it was added to the group
})
  .index("by_groupId", ["groupId"])
  .index("by_storyId", ["storyId"])
  .index("by_groupId_storyId", ["groupId", "storyId"]); // Unique constraint
```

#### 4. Judges (`judges` table)

```typescript
judges: defineTable({
  name: v.string(), // Judge's name (lowercase for matching)
  email: v.optional(v.string()), // Optional email for communication
  groupId: v.id("judgingGroups"), // Associated judging group
  sessionId: v.string(), // Unique session identifier for authentication
  lastActiveAt: v.number(), // Last activity timestamp
  userId: v.optional(v.id("users")), // Optional link to authenticated user profile
})
  .index("by_groupId", ["groupId"])
  .index("by_sessionId", ["sessionId"])
  .index("by_userId", ["userId"]);
```

#### 5. Judge Scores (`judgeScores` table)

```typescript
judgeScores: defineTable({
  judgeId: v.id("judges"), // Judge who gave the score
  groupId: v.id("judgingGroups"), // Associated judging group
  storyId: v.id("stories"), // Submission being scored
  criteriaId: v.id("judgingCriteria"), // Specific criteria being scored
  score: v.number(), // Score (1-10 scale)
  comments: v.optional(v.string()), // Optional comments from judge
  isHidden: v.optional(v.boolean()), // Admin can hide scores from public results
})
  .index("by_judge_story_criteria", ["judgeId", "storyId", "criteriaId"]) // Unique constraint
  .index("by_groupId_storyId", ["groupId", "storyId"])
  .index("by_storyId", ["storyId"]);
```

#### 6. Submission Statuses (`submissionStatuses` table) - **NEW**

```typescript
submissionStatuses: defineTable({
  groupId: v.id("judgingGroups"), // Associated judging group
  storyId: v.id("stories"), // Submission being tracked
  status: v.union(
    v.literal("pending"),
    v.literal("completed"),
    v.literal("skip"),
  ), // Current judging status
  assignedJudgeId: v.optional(v.id("judges")), // Judge assigned when completed
  lastUpdatedBy: v.optional(v.id("judges")), // Judge who last updated
  lastUpdatedAt: v.number(), // When status was last updated
})
  .index("by_groupId", ["groupId"])
  .index("by_groupId_storyId", ["groupId", "storyId"]) // Unique constraint
  .index("by_status", ["status"])
  .index("by_assignedJudgeId", ["assignedJudgeId"]);
```

#### 7. Submission Notes (`submissionNotes` table) - **NEW**

```typescript
submissionNotes: defineTable({
  groupId: v.id("judgingGroups"), // Associated judging group
  storyId: v.id("stories"), // Submission the note is about
  judgeId: v.id("judges"), // Judge who wrote the note
  content: v.string(), // Note content (supports @mentions)
  replyToId: v.optional(v.id("submissionNotes")), // For threaded replies
})
  .index("by_groupId_storyId", ["groupId", "storyId"])
  .index("by_replyToId", ["replyToId"])
  .index("by_judgeId", ["judgeId"]);
```

### API Endpoints

#### Admin Dashboard Endpoints

##### Judging Group Management

- `judgingGroups.listGroups` (query) - List all judging groups with submission/judge counts
- `judgingGroups.createGroup` (mutation) - Create new judging group with password protection
- `judgingGroups.updateGroup` (mutation) - Update group details including results visibility
- `judgingGroups.deleteGroup` (mutation) - Delete group and all associated data (scores, judges, criteria, notes)
- `judgingGroups.getGroupWithDetails` (query) - Get group with criteria and metadata
- `judgingGroups.getGroupBySlug` (query) - Get group by slug for admin tracking page

##### Criteria Management

- `judgingCriteria.getGroupCriteria` (query) - Get all criteria for a specific group with ordering
- `judgingCriteria.saveCriteria` (mutation) - Bulk save/update criteria for a group
- `judgingCriteria.deleteCriteria` (mutation) - Delete specific criteria
- `judgingCriteria.reorderCriteria` (mutation) - Update criteria display order

##### Submission Management

- `judgingGroupSubmissions.addSubmissions` (mutation) - Add submissions to group with status initialization
- `judgingGroupSubmissions.removeSubmission` (mutation) - Remove submission and associated statuses
- `judgingGroupSubmissions.getGroupSubmissions` (query) - Get submissions with full details (tags, images, video)
- `judgingGroupSubmissions.updateSubmissionStatus` (mutation) - Update submission status (pending/completed/skip)
- `judgingGroupSubmissions.getSubmissionStatusForJudge` (query) - Check if judge can score submission
- `judgingGroupSubmissions.getSubmissionStatuses` (query) - Get all submission statuses with judge info

##### Judge Collaboration & Notes - **NEW**

- `judgingGroupSubmissions.addSubmissionNote` (mutation) - Add note or reply to submission (supports @mentions)
- `judgingGroupSubmissions.getSubmissionNotes` (query) - Get threaded notes with replies for submission

##### Judge Tracking & Analytics - **NEW**

- `adminJudgeTracking.getGroupJudgeTracking` (query) - Get comprehensive judge activity and statistics
- `adminJudgeTracking.getJudgeDetailedScores` (query) - Get all scores for specific judge with story/criteria details
- `adminJudgeTracking.updateJudgeScore` (mutation) - Admin override to edit judge's score
- `adminJudgeTracking.toggleScoreVisibility` (mutation) - Hide/show scores from public results
- `adminJudgeTracking.deleteJudgeScore` (mutation) - Delete individual score with status reset logic
- `adminJudgeTracking.deleteJudge` (mutation) - Delete judge and all their scores/notes
- `adminJudgeTracking.getJudgeTrackingExportData` (query) - Export comprehensive CSV data with notes
- `adminJudgeTracking.getSubmissionNoteCounts` (query) - Get note counts per submission

##### Scoring & Analytics

- `judgeScores.getGroupScores` (query) - Get all scores with analytics (only completed submissions)
- `judgeScores.getSubmissionScores` (query) - Get detailed scores for a submission by judge and criteria
- `judgeScores.getGroupJudgeDetails` (query) - Get all judges with their scores and comments
- `judgeScores.exportScores` (query) - Export scores data for CSV download

#### Public Judging Endpoints

##### Group Access

- `judgingGroups.getPublicGroup` (query) - Get public group details by slug (respects inactive status for non-admins)
- `judgingGroups.validatePassword` (mutation) - Validate password for private group access
- `judgingGroups.getPublicGroupForResults` (query) - Get group info for results page
- `judgingGroups.validateResultsPassword` (mutation) - Validate separate results page password

##### Judge Registration & Session Management - **ENHANCED**

- `judges.registerJudge` (mutation) - Register/re-register judge with conflict prevention
  - Checks for existing judges by userId (authenticated users) or name (anonymous)
  - Links authenticated users to judge profiles automatically
  - Returns existing session if judge already registered
  - Optimized to reduce write conflicts with throttled updates
- `judges.getJudgeSession` (query) - Get judge details with group information
- `judges.updateActivity` (mutation) - Update judge's last active timestamp (throttled)
- `judges.isSessionValid` (query) - Verify judge session is still valid

##### Scoring & Progress

- `judgeScores.submitScore` (mutation) - Submit/update score for a criteria (1-10 scale)
  - Validates score range and criteria ownership
  - Checks judging period and group active status
  - Creates or updates existing scores
- `judgeScores.getJudgeSubmissionScores` (query) - Get judge's scores for specific submission
- `judges.getJudgeProgress` (query) - Get judge's progress with accurate completion tracking
  - Filters to only show available submissions (pending/skip/completed by this judge)
  - Calculates completion based on submission statuses, not individual scores
  - Returns per-submission progress and overall percentage

##### Public Results - **NEW**

- `judgeScores.getPublicGroupScores` (query) - Get public results with rankings (only completed submissions, excludes hidden scores)
- `judgeScores.getPublicGroupJudgeDetails` (query) - Get public judge scores and comments (password protected)

### Integration Points

#### Content Moderation Integration

**Location**: `src/components/admin/ContentModeration.tsx`

Add new action button in the submission actions section (around line 522):

```typescript
{/* Add to Judging Group Button */}
<Button
  variant="outline"
  size="sm"
  onClick={() => handleShowJudgingGroupSelector(item._id as Id<"stories">)}
>
  <Scale className="w-4 h-4 mr-1" /> Add to Judging
</Button>
```

**New State Variables**:

```typescript
const [showJudgingGroupSelector, setShowJudgingGroupSelector] =
  useState<Id<"stories"> | null>(null);
const [selectedJudgingGroupId, setSelectedJudgingGroupId] =
  useState<Id<"judgingGroups"> | null>(null);
```

**Integration Functions**:

- `handleShowJudgingGroupSelector` - Show judging group dropdown
- `handleAddToJudgingGroup` - Add submission to selected group
- `handleCancelJudgingGroupSelector` - Cancel group selection

#### Admin Dashboard Integration

**Location**: `src/components/admin/AdminDashboard.tsx`

**Update AdminTab Type**:

```typescript
type AdminTab =
  | "content"
  | "tags"
  | "form-fields"
  | "forms"
  | "reports"
  | "numbers"
  | "users"
  | "settings"
  | "judging";
```

**Add Tab Configuration**:

```typescript
{ value: "judging", label: "Judging" },
```

**Add Tab Content**:

```typescript
<Tabs.Content value="judging" className="focus:outline-none">
  <Judging />
</Tabs.Content>
```

### UI Flow & Components

#### Admin Dashboard Flow

1. **Judging Section** (`src/components/admin/Judging.tsx`) - **ENHANCED**
   - Main judging management interface
   - List of all judging groups with status indicators (public/private, active/inactive)
   - Shows submission count and judge count for each group
   - Actions: Create, Edit, View Results, Track Judges, Delete
   - Quick links to group management, results dashboard, and tracking page

2. **Judging Group Management** (`src/components/admin/JudgingGroupManagement.tsx`) - **ENHANCED**
   - Create/edit judging group form
   - Group settings: name, slug (URL-friendly), description
   - Toggle for public/private access with password field
   - Toggle for active/inactive status
   - **NEW**: Separate results visibility controls:
     - Toggle for public results or password-protected results
     - Optional resultsPassword field
   - Date range picker for judging period (start/end dates)
   - Link sharing with automatic copy-to-clipboard

3. **Judging Criteria Editor** (`src/components/admin/JudgingCriteriaEditor.tsx`)
   - Dynamic form to add/edit/reorder judging questions
   - Each criteria includes:
     - Question text
     - Weight (for weighted scoring)
     - Display order
   - Drag-and-drop reordering
   - Preview of how judges will see the criteria
   - Delete criteria with confirmation

4. **Judging Submissions Manager** (`src/components/admin/JudgingSubmissionsManager.tsx`) - **ENHANCED**
   - List submissions in the group with thumbnails
   - Shows submission status (pending/completed/skip)
   - Add submissions with search and filter
   - Remove submissions from group
   - View submission statuses with assigned judge info
   - **NEW**: Shows which submissions have collaboration notes

5. **Judging Results Dashboard** (`src/components/admin/JudgingResultsDashboard.tsx`) - **ENHANCED**
   - **Overall Rankings**:
     - Ranked list with weighted total scores
     - Only shows completed submissions
     - Expandable cards showing per-criteria breakdown
     - Displays submission details (title, author, image)
   - **Criteria Performance**:
     - Average score per criteria across all submissions
     - Visual performance indicators
   - **Judge Details Section**:
     - All judges listed with their scores and comments
     - Color-coded by judge
     - Filter by judge or submission
   - **CSV Export**:
     - Comprehensive data export button
     - Includes all scores, comments, and metadata

6. **Judge Tracking Dashboard** (`src/components/admin/JudgeTracking.tsx`) - **NEW (Dedicated Page: `/admin/judging/:slug/tracking`)**
   - **Judge Activity Table**:
     - Judge name, email, registration time, last active
     - Total scores submitted, completion percentage
     - Actions: View Scores, View Notes, Link/Unlink User, Delete
   - **Detailed Judge Scores Modal**:
     - Shows all scores from specific judge
     - Displays submission, criteria, score, and comments
     - Actions for each score:
       - Edit (admin override)
       - Toggle visibility (hide from public results)
       - Delete (with automatic status reset)
   - **Judge Collaboration Notes Modal** - **NEW**:
     - View all notes from specific judge
     - Threaded display with indentation for replies
     - @mention highlighting
     - Admin can add replies
     - Sticky note visual design with judge name labels
   - **Submission Note Counts**:
     - Shows which submissions have notes
     - Click to view all notes for submission
   - **CSV Export** - **COMPREHENSIVE**:
     - Exports detailed data including:
       - Judge info (name, email, registration, activity)
       - All scores with full details
       - Judge comments on scores
       - Collaboration notes with threaded replies
       - Formatted with blank rows between submissions

#### Public Judging Flow

1. **Group Access Page** (`src/pages/JudgingGroupPage.tsx`) - **ENHANCED**
   - Displays group name and description
   - Shows judging period (start/end dates) if configured
   - Password entry form for private groups with validation
   - Judge registration form:
     - Name input (required, case-insensitive for matching)
     - Optional email for communication
     - Auto-links to authenticated user account
     - Prevents duplicate registrations
     - Returns existing session if already registered
   - Redirects to judging interface on successful registration

2. **Judging Interface** (`src/pages/JudgingInterfacePage.tsx`) - **EXTENSIVELY ENHANCED**
   - **Header Section**:
     - Group name and description
     - Judge name with session indicator
     - Progress display: "Scored X of Y submissions (Z%)"
     - Current submission status badge (pending/completed/skip)
   - **Submission Display**:
     - Large featured image or video player with playback controls
     - Title, author name, creation date
     - Full content with formatted text and embedded media
     - **NEW**: Tags displayed as colored badges
     - Additional images in responsive gallery grid
   - **Criteria Scoring Section**:
     - Each criteria displayed in order with:
       - Question text and weight indicator
       - Number input for score (1-10 range with validation)
       - Optional comments textarea
       - Auto-save on input with debounce (500ms)
       - Visual feedback for save status
   - **Submission Status Controls** - **NEW**:
     - "Mark as Completed" button (updates status, moves to next pending)
     - "Skip Submission" button (marks as skip, moves to next)
     - Status badge with color coding
     - Validation: Can only score pending or self-completed submissions
   - **Judge Collaboration Notes** - **NEW**:
     - View all notes from all judges on current submission
     - Add new note with @mention support (@judgeName auto-completion)
     - Reply to existing notes (threaded display with indentation)
     - Real-time updates via Convex reactivity
     - Sticky note visual design with judge name and timestamp
   - **Navigation Controls**:
     - Previous/Next buttons (cycles through available submissions)
     - "Jump to Submission" dropdown with status indicators
     - Search bar to filter submissions by title
     - Progress tracking synced with available submissions (filters by status)
   - **Auto-save & Validation**:
     - Scores auto-save on change
     - Validates score range (1-10)
     - Checks judging period (start/end dates)
     - Checks if group is active
     - Toast notifications for save status and errors

3. **Public Judging Results Page** (`src/pages/PublicJudgingResultsPage.tsx`) - **NEW**
   - **Access Control**:
     - Shows results immediately if resultsIsPublic is true
     - Shows password prompt if resultsIsPublic is false
     - Validates resultsPassword (separate from group password)
   - **Results Display Component** (`src/components/PublicJudgingResultsDashboard.tsx`):
     - Overall rankings with weighted scores
     - Per-criteria breakdown for each submission
     - Judge details with scores and comments
     - CSV export available
     - Only shows completed submissions
     - Excludes scores marked as hidden by admin
   - Same visual layout as admin results dashboard

### Authentication & Permissions

#### Admin Access

- Extends existing `requireAdminRole` function from `convex/users.ts`
- All admin judging functions require admin role verification
- Maintains existing Clerk JWT integration
- **NEW**: Admin can access inactive groups and view/edit all data
- **NEW**: Admin can link/unlink judges to user accounts for tracking

#### Judge Access - **ENHANCED**

- Session-based authentication using secure session IDs stored in localStorage
- No user accounts required for judges (anonymous judging)
- **NEW**: Authenticated users automatically linked to judge profiles via userId
- **NEW**: Existing judges prevented from re-registering (checks by userId or name)
- Access granted via group link + optional password
- **NEW**: Session validation with activity tracking (lastActiveAt)
- **NEW**: Judges can only score pending or self-completed submissions
- **NEW**: Judges can view and add notes on submissions (@mention support)

#### Access Control Matrix - **UPDATED**

| Function                   | Admin | Judge             | Public                   |
| -------------------------- | ----- | ----------------- | ------------------------ |
| Create/Edit Groups         | ✓     | ✗                 | ✗                        |
| View Group Results (Admin) | ✓     | ✗                 | ✗                        |
| View Public Results        | ✓     | ✓                 | ✓ (if resultsIsPublic)   |
| View Protected Results     | ✓     | ✓ (with password) | ✓ (with resultsPassword) |
| Access Public Group        | ✓     | ✓                 | ✓                        |
| Access Private Group       | ✓     | ✓ (with password) | ✗                        |
| Access Inactive Group      | ✓     | ✗                 | ✗                        |
| Submit Scores              | ✓     | ✓                 | ✗                        |
| View All Judge Scores      | ✓     | ✗                 | ✗                        |
| Edit Judge Scores          | ✓     | ✗                 | ✗                        |
| Hide/Delete Scores         | ✓     | ✗                 | ✗                        |
| Add Submission Notes       | ✓     | ✓                 | ✗                        |
| View All Submission Notes  | ✓     | ✓                 | ✗                        |
| Reply to Notes             | ✓     | ✓                 | ✗                        |
| Export CSV (Admin)         | ✓     | ✗                 | ✗                        |
| Export CSV (Public)        | ✗     | ✗                 | ✓ (if on public results) |
| Delete Judges/Notes        | ✓     | ✗                 | ✗                        |

### Routing Structure

#### Admin Routes - **UPDATED**

- `/admin?tab=judging` - Main judging dashboard (list all groups)
- `/admin/judging/:slug` - Group management page (criteria, submissions, results)
- `/admin/judging/:slug/results` - **DEPRECATED** (now part of group management page)
- `/admin/judging/:slug/tracking` - **NEW**: Judge tracking dashboard with comprehensive analytics

#### Public Routes - **UPDATED**

- `/judging/:slug` - Public group access (password entry, judge registration)
- `/judging/:slug/judge/:sessionId` - **UPDATED**: Judging interface with enhanced features
- `/judging/:slug/results` - **NEW**: Public results page (with optional password protection)

### Technical Implementation Notes

#### Database Design Considerations - **ENHANCED**

- All indexes are optimized for common query patterns
- **NEW**: Composite indexes for efficient submission status lookups (`by_groupId_storyId`, `by_assignedJudgeId`)
- **NEW**: Threaded notes support with `replyToId` index for conversation chains
- Unique constraints prevent duplicate submissions in groups
- **NEW**: Judge-story-criteria composite index ensures one score per judge per criteria (`by_judge_story_criteria`)
- Soft deletion pattern for maintaining data integrity
- **NEW**: Graceful handling of deleted references (judges, stories, criteria) in queries to prevent crashes
- System fields (`_id`, `_creationTime`) automatically managed by Convex

#### Security Considerations - **ENHANCED**

- Password hashing for private groups using standard crypto libraries (bcrypt or similar)
- **NEW**: Separate password protection for results page (hashed independently)
- Rate limiting on score submissions
- Session validation for judge access with activity tracking
- **NEW**: Auto-cleanup of stale sessions (lastActiveAt tracking)
- Input sanitization for all user-provided content
- **NEW**: @mention validation to prevent XSS attacks
- Admin-only mutations protected by `requireAdminRole` checks

#### Performance Optimizations - **ENHANCED**

- Paginated queries for large submission lists
- Cached score calculations for real-time updates
- Efficient indexing for sorting and filtering operations
- **NEW**: Throttled activity updates to reduce write conflicts (5-minute intervals)
- **NEW**: Debounced score auto-save on frontend (500ms)
- **NEW**: Optimized judge registration with conflict detection before writes
- **NEW**: Batch data fetching for CSV export to minimize query overhead
- **NEW**: Frontend useMemo hooks to prevent unnecessary re-renders

#### Error Handling - **ENHANCED**

- Graceful handling of invalid group access (404 redirects)
- Validation for score ranges (1-10) with user-friendly error messages
- Conflict resolution for concurrent score updates
- **NEW**: Skip deleted judges/stories/criteria in queries instead of throwing errors
- **NEW**: Automatic submission status reset when scores hidden/deleted (`checkAndResetSubmissionStatus` helper)
- **NEW**: Toast notifications for all user actions (success/error feedback)
- Comprehensive error messages for debugging
- **NEW**: Validation for judging periods (start/end dates) before allowing score submission
- **NEW**: Group active status enforcement (inactive groups show error to non-admin judges)

#### Key Bug Fixes Implemented - **NEW SECTION**

1. **Deleted Data Handling**:
   - Fixed crashes when exporting CSV with deleted judges, stories, or criteria
   - Updated all queries to gracefully skip orphaned data using optional chaining
   - Added `|| null` checks to prevent undefined reference errors

2. **Progress Calculation Fix**:
   - Changed from counting individual criteria scores to checking `submissionStatuses` table
   - Ensures progress accurately reflects submission completion, not partial scoring
   - Frontend filters submissions by status to match backend logic

3. **Submission Status Consistency**:
   - Added `checkAndResetSubmissionStatus` helper in `adminJudgeTracking.ts`
   - Automatically resets submission to "pending" if completed submission's scores are hidden/deleted
   - Prevents inconsistent state where submission marked complete but has no visible scores

4. **Date Display Fix**:
   - Added `_creationTime` to `getGroupSubmissions` return data
   - Fixed "Invalid Date" errors on judging interface

5. **Deleted Submission Handling**:
   - All queries filter out submissions where story is null
   - Prevents server errors when accessing groups with removed submissions

6. **Judge Registration Conflicts**:
   - Added checks for existing judges by `userId` (authenticated) or `name` (anonymous)
   - Returns existing session instead of creating duplicate judge records
   - Optimized to reduce write conflicts during registration

### CSV Export Format - **NEW SECTION**

The comprehensive CSV export feature in the Judge Tracking Dashboard provides a detailed breakdown of all judging data in a human-readable format.

#### Export Data Structure

Each row in the CSV includes the following columns:

1. **Judge Information**:
   - Judge Name
   - Judge Email
   - Registration Date & Time
   - Last Active Date & Time

2. **Submission Details**:
   - Submission Title
   - Submission Author

3. **Scoring Data**:
   - Criteria Question
   - Score (1-10)
   - Score Comments (judge's feedback on specific criteria)

4. **Collaboration Data**:
   - Submission Notes (threaded notes with replies)
   - Note Author
   - Note Content
   - Note Type (note vs. reply)

#### Export Formatting

- **Blank rows** separate different submissions for readability
- **Quoted fields** preserve commas and special characters in content
- **Date formatting**: Readable timestamps (e.g., "10/5/2025, 3:45 PM")
- **Nested replies** indicated by "Reply to [Author]" prefix
- **@mentions** preserved in note content
- **NULL handling**: Gracefully skips deleted judges, stories, or criteria

#### Export Query: `adminJudgeTracking.getJudgeTrackingExportData`

This query:

1. Fetches all scores for the group
2. For each score, retrieves judge, story, and criteria details
3. Fetches all submission notes and threaded replies
4. Skips any scores with deleted references (prevents crashes)
5. Returns structured data ready for CSV conversion

#### Frontend CSV Generation

Component: `src/components/admin/JudgeTracking.tsx`

The `handleExportCSV` function:

1. Calls the export query
2. Converts data to CSV format with proper escaping
3. Triggers browser download with dynamic filename
4. Shows success/error toast notifications

### Key Helper Functions - **NEW SECTION**

#### `checkAndResetSubmissionStatus` (convex/adminJudgeTracking.ts)

**Purpose**: Ensures submission status consistency when scores are modified or deleted.

**Logic**:

1. Checks if submission is marked as "completed"
2. Counts remaining non-hidden scores for that judge
3. If score count < total criteria count, resets status to "pending"
4. Called after: `toggleScoreVisibility`, `deleteJudgeScore`, `updateJudgeScore`

**Why needed**: Prevents completed submissions from having incomplete scoring data, ensuring accurate progress tracking.

#### Throttled Activity Updates (convex/judges.ts)

**Function**: `updateActivity`

**Throttling Logic**:

- Only updates `lastActiveAt` if more than 5 minutes have passed
- Reduces write contention and improves performance
- Still maintains accurate activity tracking for admin monitoring

**Called from**: Frontend judge pages on component mount and periodic intervals

#### Judge Registration Conflict Prevention (convex/judges.ts)

**Function**: `registerJudge`

**Conflict Detection**:

1. Checks for existing judge by `userId` (if authenticated)
2. Falls back to check by `name.toLowerCase()` (if anonymous)
3. Returns existing `sessionId` instead of creating duplicate
4. Only creates new judge if no match found

**Benefits**: Prevents duplicate judge records, maintains session continuity, reduces write conflicts

### Multi-Judge Submission Availability System - **UPDATED**

#### Overview

The judging system supports multiple judges working simultaneously on the same group. All judges can see all submissions in the group, but they can only edit submissions that are pending, skipped, or completed by themselves.

#### How Submission Availability Works - **UPDATED October 12, 2025**

**Core Principle**: All judges see ALL submissions in the group for transparency. However, judges can only edit submissions that are:

- **Pending**: Not yet completed by anyone
- **Skip**: Marked as skip (editable by all judges)
- **Completed by this judge**: Judge can edit their own completed submissions

**Read-Only Access**: Judges can VIEW submissions completed by other judges but cannot edit the scores or change their status.

#### Submission Statuses (convex/submissionStatuses table)

Each submission in a judging group has a status:

- **`pending`**: Available for any judge to score
- **`completed`**: Scored by a specific judge (stored in `assignedJudgeId`)
- **`skip`**: Marked as skip (available again if judge changes mind)

#### Backend Logic: Determining Edit Permissions - **UPDATED**

**File**: `convex/judges.ts`  
**Function**: `getJudgeProgress` (lines 344-482)

**New Approach (October 12, 2025)**: Instead of filtering submissions, the backend now returns ALL submissions with edit permission flags:

```typescript
// Get ALL submissions for the group (no filtering)
const submissions = await ctx.db
  .query("judgingGroupSubmissions")
  .withIndex("by_groupId", (q) => q.eq("groupId", judge.groupId))
  .collect();

// Get submission statuses to determine edit permissions
const submissionStatuses = await ctx.db
  .query("submissionStatuses")
  .withIndex("by_groupId", (q) => q.eq("groupId", judge.groupId))
  .collect();

// Calculate progress for ALL submissions with edit flags
const submissionProgress = submissions.map((submission) => {
  const submissionStatus = submissionStatuses.find(
    (s) => s.storyId === submission.storyId,
  );

  // Determine if judge can edit this submission
  let canEdit = true;
  let completedBy: string | undefined = undefined;

  if (submissionStatus) {
    if (submissionStatus.status === "completed") {
      // Can only edit if they're the assigned judge
      canEdit = submissionStatus.assignedJudgeId === judge._id;

      // Get the name of the judge who completed it
      if (submissionStatus.assignedJudgeId) {
        const assignedJudge = await ctx.db.get(
          submissionStatus.assignedJudgeId,
        );
        if (assignedJudge) {
          completedBy = assignedJudge.name;
        }
      }
    }
    // "pending" and "skip" are always editable by all judges
  }

  return {
    storyId: submission.storyId,
    storyTitle: story.title,
    criteriaScored,
    totalCriteria,
    isComplete:
      submissionStatus?.status === "completed" &&
      submissionStatus?.assignedJudgeId === judge._id,
    canEdit, // NEW: Indicates if this judge can edit
    completedBy, // NEW: Name of judge who completed (if any)
  };
});
```

**Key Changes**:

1. **No filtering**: All submissions returned to frontend
2. **Edit permissions**: `canEdit` flag determines if judge can edit scores
3. **Transparency**: `completedBy` shows which judge completed the submission
4. **Status tracking**: `isComplete` still tracks this judge's completion for progress

#### Frontend Implementation: Display All Submissions - **UPDATED**

**File**: `src/pages/JudgingInterfacePage.tsx`  
**Lines**: 85-87

**New Approach (October 12, 2025)**: Frontend now displays ALL submissions without filtering:

```typescript
// Show ALL submissions in the group (no filtering)
// The backend determines edit permissions via canEdit field
const submissions = allSubmissions;
```

**UI Controls Based on Edit Permissions**:

1. **Scoring Criteria (lines 1370-1379)**:

   ```typescript
   <div
     className={`space-y-6 ${
       submissionStatus &&
       submissionStatus.status === "completed" &&
       submissionStatus.assignedJudgeName &&
       judgeSession &&
       submissionStatus.assignedJudgeName !== judgeSession.name
         ? "opacity-50 pointer-events-none" // Disable if completed by another judge
         : ""
     }`}
   >
   ```

2. **Status Notice (lines 729-739)**:

   ```typescript
   {!submissionStatus.canJudge &&
     submissionStatus.status === "completed" && (
       <div className="mt-2">
         <p className="text-xs text-gray-600">
           This submission has been completed by{" "}
           {submissionStatus.assignedJudgeName || "another judge"}.
           You can view it but cannot edit the scores.
         </p>
       </div>
     )}
   ```

3. **Search Results Dropdown (lines 543-551)**:
   ```typescript
   {progressInfo?.isComplete && (
     <CheckCircle className="w-3 h-3 text-green-600" />
   )}
   {!progressInfo?.canEdit && (
     <span className="text-xs text-gray-500">
       (by {progressInfo?.completedBy})
     </span>
   )}
   ```

**Why this approach?**

- **Full transparency**: All judges see the same total submission count
- **Clear status**: Judges know which submissions are completed by others
- **Edit restrictions**: UI prevents editing while maintaining visibility
- **Better collaboration**: Judges can see overall group progress

#### Progress Calculation: Group-Wide Completion Tracking - **UPDATED**

**File**: `src/pages/JudgingInterfacePage.tsx`  
**Lines**: 345-347

**New Approach (October 12, 2025)**: Progress now shows submissions completed by ANY judge in the group:

```typescript
const currentSubmission = submissions[currentSubmissionIndex];
// Count submissions completed by ANY judge in the group (not just this judge)
const completedSubmissions =
  judgeProgress?.submissionProgress.filter((s) => s.completedBy).length || 0;
```

**Changed Logic**:

1. **Before**: `filter((s) => s.isComplete)` - only counted submissions completed by THIS judge
2. **After**: `filter((s) => s.completedBy)` - counts submissions completed by ANY judge
3. **Result**: All judges see the same group-wide completion count

**Progress Display**:

```
Progress: 5/20 submissions
```

Where:

- **5** = Submissions completed by ANY judge in the group
- **20** = Total submissions in the group

**Individual Progress Tracking**:

- **Individual completion percentage**: Still calculated based on THIS judge's completed submissions
- **Header progress bar**: Shows individual judge's completion percentage
- **Submission counter**: Shows group-wide total for transparency

#### Checking If a Judge Can Score a Submission

**File**: `convex/judgingGroupSubmissions.ts`  
**Function**: `getSubmissionStatusForJudge` (lines 68-121)

Before allowing scoring, the system checks:

```typescript
// Find the submission status
const submissionStatus = await ctx.db
  .query("submissionStatuses")
  .withIndex("by_groupId_storyId", (q) =>
    q.eq("groupId", args.groupId).eq("storyId", args.storyId),
  )
  .unique();

// Determine if this judge can score this submission
let canJudge = true;

if (submissionStatus) {
  if (submissionStatus.status === "completed") {
    // Can only judge if they're the assigned judge
    canJudge = submissionStatus.assignedJudgeId === args.judgeId;
  }
  // "pending" and "skip" are always available to all judges
}
```

**Used by**: Frontend to disable scoring UI if judge cannot score the submission

#### Marking a Submission as Completed

**File**: `convex/judgingGroupSubmissions.ts`  
**Function**: `updateSubmissionStatus` (lines 25-66)

When a judge clicks "Mark as Completed":

```typescript
await ctx.db.patch(existingStatus._id, {
  status: "completed" as const,
  assignedJudgeId: args.judgeId,
  lastUpdatedBy: args.judgeId,
  lastUpdatedAt: Date.now(),
});
```

**Effects**:

1. Submission status changes to "completed"
2. `assignedJudgeId` is set to the current judge
3. **All other judges** immediately lose access to this submission
4. Only the assigned judge can edit their scores or change status back to "pending"

#### Navigation and Progress Synchronization - **UPDATED**

**File**: `src/pages/JudgingInterfacePage.tsx`  
**Lines**: 344-356

**New Approach (October 12, 2025)**: Navigation works with ALL submissions, progress shows group-wide completion:

```typescript
const currentSubmission = submissions[currentSubmissionIndex];
// Count submissions completed by ANY judge in the group (not just this judge)
const completedSubmissions =
  judgeProgress?.submissionProgress.filter((s) => s.completedBy).length || 0;

const nextSubmission = () => {
  setCurrentSubmissionIndex((prev) =>
    prev < submissions.length - 1 ? prev + 1 : prev,
  );
};
```

**Result**:

- Progress bar shows: "Progress: 5/20 submissions" (group-wide count)
- Navigation shows: "Submission 1 of 20" (all submissions)
- Completion percentage: Based on THIS judge's completed submissions
- All judges see the same total (20) for transparency

#### Key Files Involved in This System - **UPDATED**

| File                                 | Purpose                                           | Key Functions/Lines                                                                                     |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `convex/judges.ts`                   | Calculate judge progress with edit permissions    | `getJudgeProgress` (lines 344-482) - Returns ALL submissions with `canEdit` and `completedBy` flags     |
| `convex/judgingGroupSubmissions.ts`  | Manage submission statuses and check judge access | `updateSubmissionStatus` (lines 25-66)<br/>`getSubmissionStatusForJudge` (lines 68-121)                 |
| `src/pages/JudgingInterfacePage.tsx` | Display all submissions with edit restrictions    | Direct assignment (line 87)<br/>Progress counter (lines 345-347)<br/>UI disable logic (lines 1370-1379) |
| `convex/schema.ts`                   | Define submission status data model               | `submissionStatuses` table definition                                                                   |
| `convex/adminJudgeTracking.ts`       | Reset statuses when scores deleted/hidden         | `checkAndResetSubmissionStatus` (lines 10-58)                                                           |

#### Example Multi-Judge Scenario - **UPDATED**

**Setup**: 3 judges (Alice, Bob, Carol) judging 10 submissions

**Initial State**:

- All 10 submissions have status "pending"
- **All judges see all 10 submissions** (full visibility)
- Progress: 0/10 submissions completed

**Alice marks Submission #1 as completed**:

- Submission #1 status → "completed" (assigned to Alice)
- **All judges still see all 10 submissions** (new behavior)
- Alice: Can edit Submission #1 (her own)
- Bob: Can VIEW Submission #1 but cannot edit (read-only, shows "by Alice")
- Carol: Can VIEW Submission #1 but cannot edit (read-only, shows "by Alice")
- **Progress for all judges**: 1/10 submissions completed

**Bob marks Submission #2 as completed**:

- Submission #2 status → "completed" (assigned to Bob)
- **All judges see all 10 submissions**
- Alice: Can edit #1, can VIEW #2 (read-only, shows "by Bob")
- Bob: Can edit #2, can VIEW #1 (read-only, shows "by Alice")
- Carol: Can VIEW #1 and #2 (both read-only with judge names)
- **Progress for all judges**: 2/10 submissions completed

**Alice changes Submission #1 back to "pending"**:

- Submission #1 status → "pending" (assignedJudgeId cleared)
- **All judges see all 10 submissions**
- **All judges can now edit Submission #1** (pending = editable by all)
- **Progress for all judges**: 1/10 submissions completed

#### Why This Design? - **UPDATED**

**Advantages of New Approach (October 12, 2025)**:

1. **Full transparency**: All judges see the complete list of submissions
2. **Group-wide visibility**: Judges know exactly what's been completed by the team
3. **Better coordination**: No confusion about which submissions still need scoring
4. **Progress tracking**: Everyone sees the same total submission count
5. **Read-only access**: Judges can view others' work without being able to modify it
6. **Prevents duplicate work**: Edit restrictions prevent conflicts while maintaining visibility
7. **Real-time sync**: Changes propagate immediately via Convex reactivity
8. **Flexibility**: Judges can still un-complete their own submissions to revise

**Previous Approach (Before October 12, 2025)**:

- Submissions were filtered per judge (hidden if completed by others)
- Each judge saw different totals
- Less transparency about group progress
- Confusion when submission counts didn't match

**Trade-offs**:

- Judges can see submissions they can't edit (might be confusing initially)
- UI must clearly indicate read-only vs editable submissions
- Requires clear visual indicators for completion status

### Future Enhancements (Potential Features)

#### Completed Features (Previously Out of Scope)

- ✅ Weighted scoring algorithms (now implemented)
- ✅ Real-time scoring updates (via Convex reactivity)
- ✅ Advanced analytics and reporting (Judge Tracking Dashboard, CSV Export)
- ✅ Submission assignment to specific judges (via submission statuses)

#### Still Out of Scope

- Email notifications for judges (reminder emails, completion notifications)
- Judge invitation management system with email invites
- Bulk judge import from CSV
- Real-time collaboration indicators (show when other judges are viewing/scoring)
- Advanced filtering and sorting in admin dashboards
- Judge performance analytics (time spent per submission, scoring patterns)
- Anonymous judge mode (hide judge names from other judges)
- Multi-language support for judging interface
- Mobile app for judging on-the-go
- API webhooks for external integrations
- Custom scoring scales (beyond 1-10)
- Automated judge assignment algorithms
- Conflict of interest detection and management

### Recent Updates & Changelog Integration

#### October 12, 2025

- **Multi-Judge Submission Visibility Enhancement**: Changed judging system to show ALL submissions to all judges
  - Backend now returns all submissions with `canEdit` and `completedBy` flags
  - Frontend removed submission filtering logic
  - Progress counter shows group-wide completion (any judge)
  - UI disables scoring for submissions completed by other judges
  - Search dropdown enhanced to show completion status and judge names
  - Improved transparency and collaboration between judges

#### October 10, 2025

- Added dedicated Judge Tracking page at `/admin/judging/:slug/tracking`
- Enhanced judge notes with sticky note visual design
- Improved navigation between group management, results, and tracking
- Added breadcrumb navigation across all admin judging pages

#### October 5, 2025

- Implemented judge notes viewing and moderation in Judge Tracking
- Added ability for admins to view and reply to judge collaboration notes
- Added comprehensive CSV export with notes and threaded replies
- Enhanced export to include all judge activity and submission data

#### October 2, 2025

- Added tags display to Judging Interface page (colored badges)
- Fixed server errors when accessing judging groups with deleted submissions
- Fixed judging progress calculation to use `submissionStatuses` table
- Aligned submission counters between progress bar and navigation

#### October 1, 2025

- Fixed "Invalid Date" display on judging interface by adding `_creationTime` field
- Improved date formatting across all judging interfaces

#### Earlier Implementations

- Submission statuses system for tracking completion
- Judge collaboration notes with @mention support
- Public results page with password protection
- Score visibility toggle for admin moderation
- Comprehensive judge tracking and analytics
- Session-based authentication for judges
- Optimized registration to prevent conflicts

### Database Schema Changes

**New Tables Added**:

1. `submissionStatuses` - Track completion status of submissions per group
2. `submissionNotes` - Store judge collaboration notes with threading support

**Modified Tables**:

1. `judgingGroups` - Added `resultsIsPublic` and `resultsPassword` fields
2. `judges` - Added optional `userId` field for linking authenticated users
3. `judgeScores` - Added `isHidden` field for admin moderation

**Impact**: These changes are additive and do not break existing functionality. All new fields are optional or have sensible defaults.

### Backward Compatibility

- ✅ All existing admin functionality preserved
- ✅ No impact on public-facing submission flow (stories, comments, etc.)
- ✅ Maintains existing authentication patterns (Clerk JWT for admin, session-based for judges)
- ✅ New tables do not conflict with existing schemas
- ✅ Optional fields in modified tables maintain backward compatibility
- ✅ Existing judging groups continue to work without modification
- ⚠️ Database migration required to add new tables and fields (handled by Convex schema push)

### System Integration Points

#### Existing Systems Used

1. **Clerk Authentication** - For admin access control
2. **Convex Auth** - For user identity in judge linking
3. **Story System** - Submissions are stories from the main content system
4. **User System** - For linking judges to user accounts and fetching usernames
5. **Tag System** - For displaying submission tags in judging interface

#### Integration Touch Points

- Content Moderation → Add to Judging Group button
- Admin Dashboard → Judging tab
- Story submission form → Can be judged after creation
- User profiles → Can be linked to judge accounts

This PRD now reflects the complete, production-ready Submission Judging System as implemented in Vibe Apps, including all recent enhancements, bug fixes, and integration with existing platform features.
