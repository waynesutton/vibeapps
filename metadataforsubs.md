# PRD: Server-Side Metadata Generation for Story Submissions

## Product Overview

Enable proper Open Graph and Twitter Card metadata for individual story submission pages (`/s/{slug}`) so that when users share these URLs on social media platforms, the shared links display the story's specific title, description, and screenshot instead of the default app metadata.

## Problem Statement

Currently, when users share story URLs like `/s/my-awesome-app`, social media platforms and Open Graph crawlers (such as opengraph.xyz, Facebook, Twitter, LinkedIn) display the default application metadata from `index.html` instead of the story-specific metadata. This occurs because:

1. The app is a Single Page Application (SPA) that serves the same `index.html` for all routes
2. Social media crawlers don't execute JavaScript, so they can't see the dynamic meta tag updates performed by `StoryDetail.tsx`
3. All story URLs return the same static HTML with default meta tags

## Success Criteria

1. **Proper Social Sharing**: When a story URL like `/s/awesome-react-app` is shared on social platforms, it displays:
   - Story title as the link title
   - Story description as the link description
   - Story screenshot as the preview image (with fallback to default)
   - Proper URL canonicalization

2. **SEO Improvement**: Search engines can properly index individual stories with unique titles and descriptions

3. **Open Graph Validation**: Tools like opengraph.xyz show story-specific metadata instead of default app metadata

4. **Performance**: Solution doesn't significantly impact page load times or server costs

## Technical Requirements

### Core Functionality

#### Server-Side Route Handler

- **Location**: `convex/http.ts`
- **Route**: `GET /meta/s/:slug`
- **Purpose**: Generate HTML with proper meta tags for story pages
- **Returns**: Complete HTML document with story-specific meta tags

#### Story Metadata API

- **Location**: New function in `convex/stories.ts`
- **Function**: `getStoryMetadata`
- **Input**: `{ slug: string }`
- **Output**: Metadata object with all necessary fields for meta tag generation
- **Type Safety**: Must use proper Convex validators and return types

#### Meta Tag Template System

- **Location**: Server-side HTML template
- **Purpose**: Generate complete HTML with story-specific meta tags
- **Fallbacks**: Handle missing screenshots, descriptions, etc.

### Required Meta Tags

#### Essential Open Graph Tags

```html
<meta property="og:title" content="{story.title} | Vibe Apps" />
<meta property="og:description" content="{story.description}" />
<meta property="og:image" content="{story.screenshotUrl || default}" />
<meta property="og:url" content="https://vibeapps.dev/s/{story.slug}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Vibe Apps" />
```

#### Essential Twitter Card Tags

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@waynesutton" />
<meta name="twitter:creator" content="@waynesutton" />
<meta name="twitter:title" content="{story.title} | Vibe Apps" />
<meta name="twitter:description" content="{story.description}" />
<meta name="twitter:image" content="{story.screenshotUrl || default}" />
```

#### Basic SEO Tags

```html
<title>{story.title} | Vibe Apps</title>
<meta name="description" content="{story.description}" />
<link rel="canonical" href="https://vibeapps.dev/s/{story.slug}" />
```

### Implementation Architecture

#### Option 1: HTTP Action with HTML Generation (Recommended)

```typescript
// convex/http.ts
http.route({
  path: "/meta/s/:slug",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.pathname.split("/").pop();

    const story = await ctx.runQuery(internal.stories.getStoryMetadata, {
      slug,
    });

    if (!story) {
      return new Response("Story not found", { status: 404 });
    }

    const html = generateStoryHTML(story);

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }),
});
```

#### Story Metadata Query

```typescript
// convex/stories.ts
export const getStoryMetadata = internalQuery({
  args: { slug: v.string() },
  returns: v.object({
    title: v.string(),
    description: v.string(),
    screenshotUrl: v.union(v.string(), v.null()),
    slug: v.string(),
    url: v.string(),
    authorName: v.optional(v.string()),
    tags: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Implementation similar to getBySlug but optimized for metadata only
  },
});
```

#### Deployment Configuration

- **Current**: `/* /index.html 200` (SPA fallback)
- **Required**: Update to handle both SPA routes and meta routes
- **New \_redirects**:

```
/meta/s/* /meta/s/:splat 200
/* /index.html 200
```

### Data Requirements

#### Available Story Fields (from schema)

- `title: string` - Main story title
- `description: string` - Short tagline/description
- `longDescription?: string` - Detailed description (can be truncated for meta)
- `screenshotId?: Id<"_storage">` - Reference to screenshot
- `screenshotUrl: string | null` - Computed URL from screenshotId
- `slug: string` - URL-friendly identifier
- `url: string` - External link to the actual app
- `submitterName?: string` - Author name
- `tags: Array<{ name: string }>` - Associated tags

#### Computed Fields Needed

- `authorDisplayName: string` - submitterName || authorName || "Anonymous"
- `metaDescription: string` - Truncated description (max 160 chars)
- `imageUrl: string` - screenshotUrl || "/vibe-apps-open-graphi-image.png"
- `canonicalUrl: string` - Full URL for the story page

### Error Handling & Fallbacks

#### Story Not Found

- Return 404 with basic HTML containing default meta tags
- Redirect to main app with error parameter

#### Missing Screenshot

- Fallback to default Open Graph image: `/vibe-apps-open-graphi-image.png`
- Ensure image dimensions are optimal (1200x630 for Open Graph)

#### Missing Description

- Fallback to default app description
- Use longDescription (truncated) if description is empty

#### Server Errors

- Graceful degradation to default meta tags
- Logging for debugging

### Performance Considerations

#### Caching Strategy

- Cache story metadata queries for 5 minutes
- Static HTML generation for frequently accessed stories
- CDN caching for meta route responses

#### Query Optimization

- Create dedicated lightweight query for metadata only
- Avoid fetching unnecessary fields (comments, ratings, etc.)
- Use indexes for efficient slug-based lookups

### Integration Points

#### Current StoryDetail Component

- **No Changes Required**: Continue using existing client-side meta tag updates
- **Benefit**: Provides immediate updates for SPA navigation
- **Compatibility**: Server-side meta tags for crawlers, client-side for user experience

#### Routing Updates

- **React Router**: No changes needed for `/s/:slug` routes
- **Server Routes**: Add new `/meta/s/:slug` routes for crawler-specific HTML
- **Redirects**: Update deployment configuration

#### Social Media Integration

- **Share URLs**: Continue using `/s/{slug}` format
- **Crawler Detection**: Automatic routing to `/meta/s/{slug}` for social crawlers
- **Testing**: Validate with Facebook Debugger, Twitter Card Validator, opengraph.xyz

## Testing Strategy

### Manual Testing

1. **Social Media Sharing**:
   - Share story URLs on Facebook, Twitter, LinkedIn
   - Verify correct title, description, and image appear

2. **Open Graph Validation**:
   - Test URLs with opengraph.xyz
   - Test with Facebook's Open Graph Object Debugger
   - Test with Twitter's Card Validator

3. **SEO Testing**:
   - Verify proper title and description in search results
   - Test canonical URL implementation

### Automated Testing

1. **Unit Tests**: Test metadata extraction and HTML generation
2. **Integration Tests**: Test HTTP action responses
3. **E2E Tests**: Validate meta tag presence in generated HTML

## Deployment Plan

### Phase 1: Infrastructure Setup

1. Implement HTTP action in `convex/http.ts`
2. Create `getStoryMetadata` query in `convex/stories.ts`
3. Add HTML template generation utility
4. Update deployment redirects configuration

### Phase 2: Testing & Validation

1. Deploy to staging environment
2. Test with various social media platforms
3. Validate Open Graph compliance
4. Performance testing and optimization

### Phase 3: Production Rollout

1. Deploy HTTP actions to production
2. Update DNS/CDN configuration if needed
3. Monitor performance and error rates
4. Social media validation and testing

## Future Enhancements

### Enhanced Metadata

- **Author Profile Links**: Include author social media profiles
- **Tag-based Keywords**: Generate meta keywords from story tags
- **Rich Snippets**: Add structured data for search engines

### Dynamic Image Generation

- **Screenshot Thumbnails**: Generate optimized preview images
- **Branded Templates**: Add Vibe Apps branding to shared images
- **Multi-format Support**: WebP, PNG fallbacks for different platforms

### Analytics Integration

- **Share Tracking**: Monitor social media engagement
- **Referrer Analysis**: Track traffic from different platforms
- **A/B Testing**: Test different meta descriptions and images

## Risk Assessment

### Technical Risks

- **Performance Impact**: Additional server requests for meta generation
  - _Mitigation_: Caching, query optimization
- **Deployment Complexity**: New routing requirements
  - _Mitigation_: Staged rollout, comprehensive testing

### Business Risks

- **SEO Impact**: Changes to URL structure or routing
  - _Mitigation_: Maintain existing URL patterns, add canonical tags
- **Social Media Compliance**: Platform-specific requirements changes
  - _Mitigation_: Regular testing, monitoring platform updates

## Success Metrics

### Primary Metrics

- **Social Share CTR**: Increase in click-through rates from social media
- **Open Graph Validation**: 100% pass rate on validation tools
- **Story Page Views**: Increase in traffic from social referrals

### Secondary Metrics

- **SEO Rankings**: Improved search engine visibility for story pages
- **User Engagement**: Time spent on story pages from social traffic
- **Server Performance**: Response times for meta route requests

## Conclusion

This PRD outlines a comprehensive solution for server-side metadata generation that will enable proper social media sharing for Vibe Apps story submissions. The solution leverages Convex's HTTP actions for server-side rendering while maintaining the existing SPA architecture and user experience.

The implementation is designed to be:

- **Type-safe**: Using Convex validators and TypeScript throughout
- **Performant**: Optimized queries and caching strategies
- **Maintainable**: Clean separation of concerns and fallback handling
- **Compatible**: Works alongside existing client-side functionality

Success will be measured through improved social media engagement, proper Open Graph validation, and enhanced SEO performance for individual story pages.
