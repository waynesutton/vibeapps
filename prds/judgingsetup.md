# Submission Judging System PRD

## Overview

The Submission Judging System extends the existing admin dashboard with a comprehensive judging workflow that integrates seamlessly with the Content Moderation system. This feature functions as a lightweight judging CRM, allowing administrators to organize submissions into judging groups, define criteria, and enable external judges to score submissions.

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
  name: v.string(), // Judge's name
  email: v.optional(v.string()), // Optional email for communication
  groupId: v.id("judgingGroups"), // Associated judging group
  sessionId: v.string(), // Unique session identifier
  lastActiveAt: v.number(), // Last activity timestamp
})
  .index("by_groupId", ["groupId"])
  .index("by_sessionId", ["sessionId"]);
```

#### 5. Judge Scores (`judgeScores` table)

```typescript
judgeScores: defineTable({
  judgeId: v.id("judges"), // Judge who gave the score
  groupId: v.id("judgingGroups"), // Associated judging group
  storyId: v.id("stories"), // Submission being scored
  criteriaId: v.id("judgingCriteria"), // Specific criteria being scored
  score: v.number(), // Score (1-10)
  comments: v.optional(v.string()), // Optional comments from judge
})
  .index("by_judge_story_criteria", ["judgeId", "storyId", "criteriaId"]) // Unique constraint
  .index("by_groupId_storyId", ["groupId", "storyId"])
  .index("by_storyId", ["storyId"]);
```

### API Endpoints

#### Admin Dashboard Endpoints

##### Judging Group Management

- `judgingGroups.listGroups` (query) - List all judging groups for admin
- `judgingGroups.createGroup` (mutation) - Create new judging group
- `judgingGroups.updateGroup` (mutation) - Update group details
- `judgingGroups.deleteGroup` (mutation) - Delete group and all associated data
- `judgingGroups.getGroupWithDetails` (query) - Get group with criteria and submissions

##### Criteria Management

- `judgingCriteria.listByCroup` (query) - Get criteria for a specific group
- `judgingCriteria.saveCriteria` (mutation) - Bulk save/update criteria for a group
- `judgingCriteria.deleteCriteria` (mutation) - Delete specific criteria

##### Submission Management

- `judgingGroupSubmissions.addSubmissions` (mutation) - Add submissions to group
- `judgingGroupSubmissions.removeSubmission` (mutation) - Remove submission from group
- `judgingGroupSubmissions.listByGroup` (query) - Get submissions in a group with scores

##### Scoring & Analytics

- `judgeScores.getGroupScores` (query) - Get all scores for a group with analytics
- `judgeScores.getSubmissionScores` (query) - Get detailed scores for a submission
- `judgeScores.exportScores` (query) - Export scores data for download

#### Public Judging Endpoints

##### Group Access

- `judgingGroups.getPublicGroup` (query) - Get public group details by slug
- `judgingGroups.validatePassword` (mutation) - Validate password for private groups

##### Judge Registration

- `judges.registerJudge` (mutation) - Register judge for a group
- `judges.getJudgeSession` (query) - Get judge details by session ID

##### Scoring

- `judgeScores.submitScore` (mutation) - Submit/update score for a criteria
- `judgeScores.getJudgeProgress` (query) - Get judge's current progress

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

1. **Judging Section** (`src/components/admin/Judging.tsx`)
   - Main judging management interface
   - List of all judging groups with status indicators
   - Actions: Create, Edit, Delete, View Results

2. **Judging Group Management** (`src/components/admin/JudgingGroupManagement.tsx`)
   - Create/edit judging group form
   - Group settings: name, description, public/private, password, dates
   - Link sharing and password management

3. **Judging Criteria Editor** (`src/components/admin/JudgingCriteriaEditor.tsx`)
   - Dynamic form to add/edit/reorder judging questions
   - 1-10 scale rating interface preview
   - Weight assignment (optional)

4. **Judging Submissions Manager** (`src/components/admin/JudgingSubmissionsManager.tsx`)
   - List submissions in the group
   - Add/remove submissions
   - View current scores and judge progress

5. **Judging Results Dashboard** (`src/components/admin/JudgingResultsDashboard.tsx`)
   - Comprehensive scoring analytics
   - Submission rankings and detailed breakdowns
   - Export functionality

#### Public Judging Flow

1. **Group Access Page** (`src/pages/JudgingGroupPage.tsx`)
   - Password entry for private groups
   - Group information and instructions
   - Judge registration form

2. **Judging Interface** (`src/components/JudgingInterface.tsx`)
   - Submission display with media/links
   - Criteria scoring interface (1-10 point scale)
   - Progress tracking
   - Comments section

3. **Judge Progress** (`src/components/JudgeProgress.tsx`)
   - Overview of scoring progress
   - Completed vs remaining submissions
   - Option to review/edit previous scores

### Authentication & Permissions

#### Admin Access

- Extends existing `requireAdminRole` function from `convex/users.ts`
- All admin judging functions require admin role verification
- Maintains existing Clerk JWT integration

#### Judge Access

- Session-based authentication using secure session IDs
- No user accounts required for judges
- Access granted via group link + optional password

#### Access Control Matrix

| Function             | Admin | Judge             | Public |
| -------------------- | ----- | ----------------- | ------ |
| Create/Edit Groups   | ✓     | ✗                 | ✗      |
| View Group Results   | ✓     | ✗                 | ✗      |
| Access Public Group  | ✓     | ✓                 | ✓      |
| Access Private Group | ✓     | ✓ (with password) | ✗      |
| Submit Scores        | ✓     | ✓                 | ✗      |
| View All Scores      | ✓     | ✗                 | ✗      |

### Routing Structure

#### Admin Routes

- `/admin?tab=judging` - Main judging dashboard
- `/admin/judging/new` - Create new group
- `/admin/judging/:groupId/edit` - Edit group
- `/admin/judging/:groupId/criteria` - Manage criteria
- `/admin/judging/:groupId/submissions` - Manage submissions
- `/admin/judging/:groupId/results` - View results

#### Public Routes

- `/judging/:slug` - Public group access
- `/judging/:slug/judge` - Judging interface

### Technical Implementation Notes

#### Database Design Considerations

- All indexes are optimized for common query patterns
- Unique constraints prevent duplicate submissions in groups
- Soft deletion pattern for maintaining data integrity
- Created/updated timestamps for audit trails

#### Security Considerations

- Password hashing for private groups using standard crypto libraries
- Rate limiting on score submissions
- Session validation for judge access
- Input sanitization for all user-provided content

#### Performance Optimizations

- Paginated queries for large submission lists
- Cached score calculations for real-time updates
- Efficient indexing for sorting and filtering operations

#### Error Handling

- Graceful handling of invalid group access
- Validation for score ranges (1-10)
- Conflict resolution for concurrent score updates
- Comprehensive error messages for debugging

### Future Enhancements (Out of Scope)

- Email notifications for judges
- Real-time scoring updates via WebSocket
- Advanced analytics and reporting
- Judge invitation management system
- Submission assignment to specific judges
- Weighted scoring algorithms

### Backward Compatibility

- No changes to existing database schemas
- All existing admin functionality preserved
- No impact on public-facing submission flow
- Maintains existing authentication patterns

This PRD provides the foundation for implementing a robust judging system that integrates seamlessly with the existing Vibe Apps platform while maintaining all current functionality and design patterns.
