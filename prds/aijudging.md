# AI Judging System for Judging Groups

## Overview

Add OpenAI-powered AI judging capabilities to analyze submissions in judging groups and recommend top 3 winners based on the group's custom criteria. This is an admin-only advisory tool that provides AI recommendations without modifying actual judge scores or submission status.

## Core Functionality

### What It Does

The AI judging system reads all submissions in a judging group, evaluates them against the group's specific criteria, and provides recommendations on the top 3 submissions with detailed reasoning. This helps admins and moderators get an objective AI perspective on submissions before finalizing results.

### What It Does NOT Do

- Does not save AI scores to the `judgeScores` table
- Does not mark submissions as judged by AI
- Does not affect submission status (pending, completed, skip)
- Does not replace human judges
- Does not modify any existing scoring or tracking data

## User Flow

### Admin Initiates AI Judging

1. Admin navigates to the Judging Groups admin page
2. Selects a judging group to analyze
3. Clicks new "AI Analysis" button/tab
4. System displays loading state while AI processes submissions
5. Results appear showing:
   - Top 3 recommended submissions with rankings
   - AI scores for each criterion (1-10 scale)
   - Detailed reasoning for each submission
   - Comparison with human judge scores (if available)

### Viewing AI Recommendations

Admins can:

- See AI reasoning for each criterion score
- Compare AI recommendations vs human judge rankings
- Export AI analysis report
- Re-run analysis if submissions or criteria change
- View analysis history with timestamps

## Technical Architecture

### New Convex Files

#### `convex/aiJudging.ts`

**Purpose**: Core AI judging logic with OpenAI integration

**Key Functions**:

```typescript
// Admin-only action to run AI analysis on a judging group
export const analyzeJudgingGroup = action({
  args: {
    groupId: v.id("judgingGroups"),
  },
  returns: v.object({
    analysisId: v.string(),
    timestamp: v.number(),
    topThree: v.array(
      v.object({
        rank: v.number(), // 1, 2, or 3
        storyId: v.id("stories"),
        storyTitle: v.string(),
        storySlug: v.string(),
        totalScore: v.number(), // AI total score
        averageScore: v.number(), // AI average across criteria
        criteriaScores: v.array(
          v.object({
            criteriaId: v.id("judgingCriteria"),
            question: v.string(),
            score: v.number(), // 1-10
            reasoning: v.string(),
          }),
        ),
        overallReasoning: v.string(),
      }),
    ),
    metadata: v.object({
      groupName: v.string(),
      totalSubmissions: v.number(),
      criteriaCount: v.number(),
      modelUsed: v.string(),
      processingTime: v.number(), // milliseconds
    }),
  }),
  handler: async (ctx, args) => {
    // 1. Verify admin role
    // 2. Fetch judging group details
    // 3. Fetch all criteria for the group
    // 4. Fetch all submissions with full details
    // 5. Build system prompt with criteria
    // 6. Process submissions through OpenAI
    // 7. Parse and structure results
    // 8. Return top 3 recommendations
  },
});

// Query to get submission details for AI analysis (internal use)
export const getSubmissionsForAIAnalysis = internalQuery({
  args: {
    groupId: v.id("judgingGroups"),
  },
  returns: v.array(
    v.object({
      _id: v.id("stories"),
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      longDescription: v.optional(v.string()),
      url: v.string(),
      videoUrl: v.optional(v.string()),
      screenshotUrl: v.optional(v.string()),
      additionalImageUrls: v.array(v.string()),
      linkedinUrl: v.optional(v.string()),
      twitterUrl: v.optional(v.string()),
      githubUrl: v.optional(v.string()),
      chefShowUrl: v.optional(v.string()),
      chefAppUrl: v.optional(v.string()),
      tags: v.array(v.string()),
      teamName: v.optional(v.string()),
      teamMemberCount: v.optional(v.number()),
      votes: v.number(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Fetch and format all submission data
    // Similar to getGroupSubmissions but optimized for AI consumption
  },
});

// Store AI analysis results for history/caching
export const saveAIAnalysis = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    analysisId: v.string(),
    results: v.any(), // Full analysis results object
    modelUsed: v.string(),
    processingTime: v.number(),
  },
  returns: v.id("aiJudgingAnalysis"),
  handler: async (ctx, args) => {
    // Save analysis to new aiJudgingAnalysis table
  },
});

// Get past AI analyses for a group
export const getGroupAIHistory = query({
  args: {
    groupId: v.id("judgingGroups"),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiJudgingAnalysis"),
      analysisId: v.string(),
      timestamp: v.number(),
      modelUsed: v.string(),
      processingTime: v.number(),
      topThreeIds: v.array(v.id("stories")),
    }),
  ),
  handler: async (ctx, args) => {
    // Fetch analysis history
  },
});
```

### New Database Schema

Add to `convex/schema.ts`:

```typescript
aiJudgingAnalysis: defineTable({
  groupId: v.id("judgingGroups"),
  analysisId: v.string(), // UUID for this specific analysis run
  timestamp: v.number(),
  modelUsed: v.string(), // e.g., "gpt-4-turbo"
  processingTime: v.number(),
  results: v.any(), // Full structured results object
  adminUserId: v.id("users"), // Who ran the analysis
})
  .index("by_groupId", ["groupId"])
  .index("by_timestamp", ["timestamp"]),
```

### Frontend Components

#### `src/components/admin/AIJudgingAnalysis.tsx`

**Purpose**: Admin UI for running and viewing AI analysis

**Features**:

- Button to trigger AI analysis
- Loading state with progress indicator
- Results display:
  - Top 3 submissions in ranked order
  - Expandable details for each submission
  - Criterion-by-criterion scores and reasoning
  - Visual comparison with human judge scores
- Export functionality
- Analysis history viewer

**Key Components**:

```typescript
interface AIJudgingAnalysisProps {
  groupId: Id<"judgingGroups">;
  groupName: string;
  onBack: () => void;
}

export function AIJudgingAnalysis({
  groupId,
  groupName,
  onBack,
}: AIJudgingAnalysisProps) {
  // Component implementation
}
```

### OpenAI Integration Strategy

#### System Prompt Structure

```typescript
const buildSystemPrompt = (criteria: Criteria[], groupName: string) => {
  return `You are an expert judge for the "${groupName}" competition.

Your task: Analyze submissions and score them against specific criteria.

JUDGING CRITERIA:
${criteria
  .map(
    (c, idx) => `
${idx + 1}. ${c.question}
   ${c.description ? `Description: ${c.description}` : ""}
   Weight: ${c.weight || 1}
   Score Range: 1-10 (1=Poor, 10=Exceptional)
`,
  )
  .join("\n")}

SCORING GUIDELINES:
- Score each criterion independently on a 1-10 scale
- 1-3: Does not meet expectations
- 4-6: Meets basic expectations
- 7-8: Exceeds expectations
- 9-10: Exceptional, industry-leading

For each submission, you must:
1. Analyze all provided content (description, features, technical details, team info)
2. Score each criterion objectively
3. Provide clear reasoning for each score
4. Consider innovation, execution quality, and alignment with criteria

Return scores as structured JSON with detailed reasoning for each criterion.`;
};
```

#### Submission Data Format for AI

```typescript
const formatSubmissionForAI = (submission: Submission) => {
  return {
    id: submission._id,
    title: submission.title,
    description: submission.description,
    detailedDescription: submission.longDescription,
    url: submission.url,
    hasVideo: !!submission.videoUrl,
    hasScreenshots:
      !!submission.screenshotUrl || submission.additionalImageUrls.length > 0,
    technologies: submission.tags,
    team: submission.teamName
      ? {
          name: submission.teamName,
          size: submission.teamMemberCount,
        }
      : null,
    links: {
      github: submission.githubUrl,
      linkedin: submission.linkedinUrl,
      twitter: submission.twitterUrl,
    },
    communityEngagement: {
      votes: submission.votes,
    },
  };
};
```

#### Processing Logic

```typescript
// Process submissions in batches to avoid token limits
const BATCH_SIZE = 5; // Analyze 5 submissions at a time
const MAX_RETRIES = 3;

async function processSubmissions(
  submissions: Submission[],
  criteria: Criteria[],
  systemPrompt: string,
): Promise<AIAnalysisResult[]> {
  const results = [];

  for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
    const batch = submissions.slice(i, i + BATCH_SIZE);

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            task: "Score these submissions against the criteria",
            submissions: batch.map(formatSubmissionForAI),
            returnFormat: "Return JSON array with scores and reasoning",
          }),
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent scoring
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    // Parse and validate response
    const batchResults = parseAIResponse(response);
    results.push(...batchResults);
  }

  return results;
}
```

### Integration with Existing Admin Dashboard

#### Update `src/components/admin/Judging.tsx`

Add new view option:

```typescript
const [currentView, setCurrentView] = useState<
  "list" | "criteria" | "results" | "tracking" | "ai-analysis"
>("list");
```

Add button in group actions:

```typescript
<button
  onClick={() => handleViewAIAnalysis(group._id, group.name)}
  className="flex flex-col items-center gap-1 p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md transition-colors min-w-[70px]"
  title="View AI analysis"
>
  <Sparkles className="w-4 h-4" />
  <span className="text-xs">AI Analysis</span>
</button>
```

## Data Flow

### Analysis Request Flow

1. **Admin triggers analysis**
   - Click "AI Analysis" in admin dashboard
   - Frontend calls `analyzeJudgingGroup` action

2. **Backend processing**
   - Verify admin role via `requireAdminRole`
   - Fetch judging group details
   - Fetch all criteria with weights
   - Query all submissions via `getSubmissionsForAIAnalysis`
   - Build system prompt with criteria context
   - Format submissions for AI consumption

3. **OpenAI processing**
   - Send batches of submissions to GPT-4
   - Parse structured JSON responses
   - Validate scores and reasoning
   - Handle errors and retries

4. **Results compilation**
   - Aggregate all submission scores
   - Calculate weighted totals
   - Rank submissions by total score
   - Extract top 3
   - Generate comparison with human scores (if available)

5. **Storage and display**
   - Save analysis to `aiJudgingAnalysis` table
   - Return results to frontend
   - Display in admin UI
   - Enable export

### Performance Considerations

**Expected Processing Time**:

- 5 submissions: ~30-45 seconds
- 10 submissions: ~60-90 seconds
- 20 submissions: ~2-3 minutes
- 50+ submissions: Consider background job

**Cost Estimation**:

- Using GPT-4 Turbo: ~$0.01-0.03 per submission analyzed
- Batch processing reduces costs
- Cache results to avoid re-analysis

**Optimization Strategies**:

- Process submissions in parallel batches
- Cache analysis results by `analysisId`
- Use streaming for real-time progress updates
- Implement retry logic for API failures
- Add rate limiting to prevent abuse

## Security and Access Control

### Admin-Only Access

All AI judging functions require admin role:

```typescript
export const analyzeJudgingGroup = action({
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    // ... rest of implementation
  },
});
```

### Data Privacy

- AI receives only public submission data
- No personal judge information sent to AI
- Analysis results stored securely
- Export logs AI analysis actions for audit

### Rate Limiting

```typescript
// Limit AI analyses per group per time period
const RATE_LIMIT = {
  maxAnalysesPerHour: 5,
  maxAnalysesPerDay: 20,
};

// Check before processing
const recentAnalyses = await ctx.db
  .query("aiJudgingAnalysis")
  .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
  .filter(
    (q) => q.gt(q.field("timestamp"), Date.now() - 3600000), // Last hour
  )
  .collect();

if (recentAnalyses.length >= RATE_LIMIT.maxAnalysesPerHour) {
  throw new Error("Rate limit exceeded. Please try again later.");
}
```

## Environment Variables

Add to Convex environment:

```bash
OPENAI_API_KEY=sk-...  # OpenAI API key for AI judging
```

Add to `package.json`:

```json
{
  "dependencies": {
    "openai": "^4.79.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0"
  }
}
```

## UI/UX Design

### AI Analysis Dashboard

**Header Section**:

- Group name and description
- "Run AI Analysis" primary button
- Last analysis timestamp
- Processing status indicator

**Results Section** (after analysis):

```
┌─────────────────────────────────────────────┐
│ AI Recommended Winners                      │
│                                             │
│ 🥇 1st Place: [Submission Title]           │
│    Total Score: 89.5/100                    │
│    [View Details ▼]                         │
│                                             │
│ 🥈 2nd Place: [Submission Title]           │
│    Total Score: 86.2/100                    │
│    [View Details ▼]                         │
│                                             │
│ 🥉 3rd Place: [Submission Title]           │
│    Total Score: 83.8/100                    │
│    [View Details ▼]                         │
└─────────────────────────────────────────────┘
```

**Expanded Submission Details**:

```
┌─────────────────────────────────────────────┐
│ [Submission Title]                          │
│ Score: 89.5/100 | Rank: #1                 │
│                                             │
│ Criterion Scores:                           │
│ • Innovation (Weight: 2x): 9/10 ⭐⭐⭐⭐⭐⭐⭐⭐⭐  │
│   "Demonstrates novel approach to..."       │
│                                             │
│ • Technical Execution (Weight: 1x): 8/10    │
│   "Well-implemented with clean code..."     │
│                                             │
│ • Impact (Weight: 2x): 9/10                 │
│   "Solves a significant problem for..."     │
│                                             │
│ Overall AI Assessment:                      │
│ "This submission stands out due to its      │
│  innovative approach and strong technical   │
│  execution..."                              │
│                                             │
│ Comparison with Human Judges:               │
│ Human Avg: 87.3/100 (Δ +2.2)               │
│ Agreement: High ✓                           │
└─────────────────────────────────────────────┘
```

**Action Buttons**:

- Export AI Report (CSV/PDF)
- View All Submissions (shows full ranking)
- Compare with Human Results
- Re-run Analysis
- View Analysis History

### Loading States

```
┌─────────────────────────────────────────────┐
│ Analyzing Submissions...                    │
│                                             │
│ [████████░░░░░░░░] 50%                     │
│                                             │
│ Status: Processing 15 of 30 submissions    │
│ Estimated time remaining: 45 seconds        │
│                                             │
│ Current: Evaluating "Submission Title"     │
│ Against criteria: 3 of 5 complete          │
└─────────────────────────────────────────────┘
```

### Error States

```
┌─────────────────────────────────────────────┐
│ ⚠️ Analysis Failed                          │
│                                             │
│ Unable to complete AI analysis due to:      │
│ • API rate limit exceeded                   │
│                                             │
│ Suggestions:                                │
│ • Wait 10 minutes and try again            │
│ • Contact admin if issue persists          │
│                                             │
│ [Retry] [View Partial Results] [Cancel]    │
└─────────────────────────────────────────────┘
```

## Edge Cases and Error Handling

### Scenarios to Handle

1. **No submissions in group**
   - Show message: "No submissions to analyze"
   - Disable AI analysis button

2. **No criteria defined**
   - Show warning: "Please define judging criteria first"
   - Link to criteria editor

3. **Incomplete submission data**
   - AI works with available data
   - Notes missing information in reasoning

4. **API failures**
   - Retry logic with exponential backoff
   - Save partial results if possible
   - Clear error messages to admin

5. **Token limit exceeded**
   - Process in smaller batches
   - Reduce submission detail level
   - Use longer context model if needed

6. **Concurrent analyses**
   - Lock group during analysis
   - Queue additional requests
   - Show status to other admins

### Error Messages

```typescript
const ERROR_MESSAGES = {
  RATE_LIMIT: "Rate limit exceeded. Please try again in {minutes} minutes.",
  NO_SUBMISSIONS: "This judging group has no submissions to analyze.",
  NO_CRITERIA: "Please define judging criteria before running AI analysis.",
  API_ERROR: "OpenAI service temporarily unavailable. Please try again.",
  INSUFFICIENT_DATA:
    "Some submissions have incomplete data. Analysis may be limited.",
  ALREADY_RUNNING: "An analysis is already in progress for this group.",
};
```

## Testing Strategy

### Unit Tests

```typescript
// Test AI prompt generation
describe("buildSystemPrompt", () => {
  it("should include all criteria in prompt", () => {
    const criteria = [
      { question: "Innovation", description: "Novel approach", weight: 2 },
      { question: "Execution", description: "Quality", weight: 1 },
    ];
    const prompt = buildSystemPrompt(criteria, "Test Group");
    expect(prompt).toContain("Innovation");
    expect(prompt).toContain("Weight: 2");
  });
});

// Test submission formatting
describe("formatSubmissionForAI", () => {
  it("should format submission with all fields", () => {
    const submission = mockSubmission();
    const formatted = formatSubmissionForAI(submission);
    expect(formatted).toHaveProperty("title");
    expect(formatted).toHaveProperty("technologies");
  });
});

// Test score parsing
describe("parseAIResponse", () => {
  it("should parse valid AI response", () => {
    const response = mockOpenAIResponse();
    const parsed = parseAIResponse(response);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].scores).toBeDefined();
  });
});
```

### Integration Tests

1. **Full analysis flow**
   - Create test judging group
   - Add test submissions
   - Run AI analysis
   - Verify results structure
   - Check database records

2. **Error handling**
   - Test with invalid API key
   - Test with rate limiting
   - Test with malformed data

3. **Performance**
   - Test with 5, 10, 20, 50 submissions
   - Measure processing time
   - Verify batch processing

### Manual Testing Checklist

- [ ] Run analysis on group with 5 submissions
- [ ] Verify top 3 recommendations make sense
- [ ] Check criterion-by-criterion reasoning
- [ ] Compare with human judge scores
- [ ] Test export functionality
- [ ] Verify analysis history saves correctly
- [ ] Test rate limiting
- [ ] Test error states (invalid API key, network errors)
- [ ] Verify admin-only access control
- [ ] Test on different group with different criteria

## Deployment Plan

### Phase 1: Core Implementation (Week 1)

1. Set up OpenAI integration
   - Add API key to environment
   - Install dependencies
   - Create basic action structure

2. Implement backend functions
   - `analyzeJudgingGroup` action
   - `getSubmissionsForAIAnalysis` query
   - `saveAIAnalysis` mutation

3. Add database schema
   - Create `aiJudgingAnalysis` table
   - Add indexes

### Phase 2: Frontend UI (Week 2)

1. Create `AIJudgingAnalysis` component
   - Results display
   - Loading states
   - Error handling

2. Integrate with admin dashboard
   - Add navigation
   - Add button in group list
   - Connect to backend

3. Implement export functionality

### Phase 3: Testing and Refinement (Week 3)

1. Internal testing
   - Test with various group sizes
   - Verify scoring accuracy
   - Performance testing

2. UI/UX refinement
   - Improve loading indicators
   - Better error messages
   - Polish design

3. Documentation
   - Admin guide
   - API documentation
   - Troubleshooting guide

### Phase 4: Production Release (Week 4)

1. Beta testing with select admins
2. Gather feedback
3. Final adjustments
4. Full production release
5. Monitor usage and costs

## Success Metrics

### Adoption Metrics

- Number of judging groups using AI analysis
- Frequency of AI analysis runs
- Admin satisfaction score

### Quality Metrics

- Agreement rate between AI and human judges
- AI ranking correlation with final results
- Admin trust in AI recommendations

### Performance Metrics

- Average processing time per submission
- API success rate
- Cost per analysis

### Usage Patterns

- Most common group sizes analyzed
- Frequency of re-runs
- Export usage

## Future Enhancements

### Phase 2 Features

1. **Real-time Streaming**
   - Stream results as they're processed
   - Show submission-by-submission progress
   - Improve perceived performance

2. **Custom AI Instructions**
   - Allow admins to add custom judging guidelines
   - Group-specific AI personality
   - Additional context for specific competitions

3. **Batch Processing**
   - Schedule analysis for later
   - Background processing for large groups
   - Email results when complete

4. **Advanced Analytics**
   - Trend analysis across multiple analyses
   - Identify scoring patterns
   - Flag potential biases

5. **AI Judge Persona**
   - Create multiple judge personas
   - Get diverse perspectives
   - Simulate panel discussions

6. **Confidence Scores**
   - AI expresses confidence in each score
   - Highlight uncertain evaluations
   - Suggest where human review is critical

### Experimental Features

1. **Submission Feedback Generator**
   - AI generates constructive feedback for all submissions
   - Help participants improve
   - Optional: Make available to submitters

2. **Criteria Validation**
   - AI suggests improvements to criteria
   - Identifies ambiguous or overlapping criteria
   - Recommends additional criteria

3. **Judge Assistance Mode**
   - AI helps human judges during scoring
   - Suggests scores based on criteria
   - Highlights aspects to consider

## Cost Analysis

### OpenAI API Costs (GPT-4 Turbo)

**Input Tokens** (Prompt + Submission Data):

- System prompt: ~500 tokens
- Per submission: ~1,000 tokens (varies by detail level)
- Batch of 5: ~5,500 tokens total

**Output Tokens** (Scores + Reasoning):

- Per submission: ~800 tokens
- Batch of 5: ~4,000 tokens total

**Cost per Batch (5 submissions)**:

- Input: 5,500 tokens × $0.01/1K = $0.055
- Output: 4,000 tokens × $0.03/1K = $0.120
- **Total: ~$0.175 per batch of 5**

**Cost Examples**:

- 10 submissions: ~$0.35
- 25 submissions: ~$0.88
- 50 submissions: ~$1.75
- 100 submissions: ~$3.50

**Monthly Estimates** (based on usage):

- 10 groups, 20 submissions each, analyzed 2x/month: ~$14/month
- 50 groups, 15 submissions each, analyzed 3x/month: ~$78/month

### Cost Optimization

1. **Caching**: Store results, avoid re-analyzing unchanged submissions
2. **Batch size optimization**: Find sweet spot between speed and cost
3. **Model selection**: Use GPT-3.5 for simpler groups (50-70% cost reduction)
4. **Progressive analysis**: Analyze top candidates in detail, others briefly

## Documentation

### Admin User Guide

Create comprehensive guide covering:

- When to use AI judging (best practices)
- How to interpret AI recommendations
- Understanding AI reasoning
- Comparing AI vs human scores
- Exporting and sharing results
- Limitations and considerations

### API Documentation

Document all new Convex functions:

- Function signatures
- Parameter descriptions
- Return value structures
- Error codes
- Example usage
- Rate limits

### Troubleshooting Guide

Common issues and solutions:

- API key configuration
- Rate limit errors
- Incomplete results
- Performance issues
- Cost management

## Compliance and Ethics

### AI Usage Transparency

- Clearly label AI-generated recommendations
- Explain AI is advisory only
- Document AI model version used
- Provide access to full AI reasoning

### Fairness Considerations

- AI should not have final decision power
- Multiple perspectives (AI + human) preferred
- Regular bias audits of AI recommendations
- Allow appeals/overrides of AI suggestions

### Data Privacy

- No personal information sent to OpenAI
- Comply with OpenAI's data usage policies
- Data retention policies for AI analyses
- User consent for AI processing (if required)

## Rollout Strategy

### Internal Rollback

1. **Alpha Testing** (Admins only)
   - Test with existing judging groups
   - Gather feedback on accuracy
   - Refine prompts and processing

2. **Beta Testing** (Select moderators)
   - Expand to trusted moderators
   - Test with diverse group types
   - Monitor costs and performance

3. **General Availability**
   - Release to all admins/moderators
   - Monitor usage closely
   - Gather feedback continuously

### Feature Flag

Implement feature flag for gradual rollout:

```typescript
const AI_JUDGING_ENABLED = await ctx.db
  .query("settings")
  .first()
  .then((s) => s?.enableAIJudging ?? false);

if (!AI_JUDGING_ENABLED) {
  throw new Error("AI judging is not enabled for this deployment");
}
```

## Conclusion

The AI Judging System provides admins with an objective, AI-powered perspective on submissions without replacing human judgment. By analyzing submissions against group-specific criteria and providing detailed reasoning, it helps admins make more informed decisions while maintaining full control over final results.

The system is designed to be:

- **Non-invasive**: Doesn't modify existing scores or statuses
- **Transparent**: Full reasoning for all recommendations
- **Flexible**: Works with any criteria configuration
- **Secure**: Admin-only access with proper authentication
- **Scalable**: Handles groups of various sizes efficiently
- **Cost-effective**: Optimized for reasonable API costs

This feature represents a powerful tool for enhancing the judging process while respecting the importance of human decision-making in competitions.
