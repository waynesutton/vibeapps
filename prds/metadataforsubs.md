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
- **Route (Convex exact match)**: `GET /meta/s`
- **Slug input**: Read from either query param `?slug=` or from the trailing path segment (see code)
- **Why**: Convex HTTP routes are exact-match paths, not parameterized. Register a fixed path and parse the slug from the request URL.
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

### Implementation Architecture (Final)

#### HTTP Action with HTML Generation (Convex)

```typescript
// convex/http.ts
http.route({
  path: "/meta/s",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    // Prefer explicit query param, fall back to last path segment
    let slug = url.searchParams.get("slug");
    if (!slug) {
      const parts = url.pathname.split("/");
      slug = parts[parts.length - 1] || "";
    }

    if (!slug) {
      return new Response("Missing slug", { status: 400 });
    }

    const story = await ctx.runQuery(internal.stories.getStoryMetadata, {
      slug,
    });
    if (!story) {
      return new Response("Story not found", { status: 404 });
    }

    const html = generateStoryHTML(story);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Cache for browsers and CDNs while allowing quick refreshes
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }),
});

function generateStoryHTML(story: {
  title: string;
  description: string;
  screenshotUrl: string | null;
  slug: string;
  url: string;
  authorName?: string;
}) {
  const imageUrl =
    story.screenshotUrl ||
    "https://vibeapps.dev/vibe-apps-open-graphi-image.png";
  const canonicalUrl = `https://vibeapps.dev/s/${story.slug}`;
  const siteName = "Vibe Apps";
  const twitterHandle = "@waynesutton";

  // Escape HTML characters in dynamic content to prevent XSS
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const safeTitle = escapeHtml(story.title);
  const safeDescription = escapeHtml(story.description);
  const safeAuthorName = story.authorName ? escapeHtml(story.authorName) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Basic SEO -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle} | ${siteName}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${twitterHandle}">
  <meta name="twitter:creator" content="${twitterHandle}">
  <meta name="twitter:title" content="${safeTitle} | ${siteName}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Redirect to actual app after a brief delay for crawlers -->
  <script>
    setTimeout(() => {
      window.location.href = "${canonicalUrl}";
    }, 100);
  </script>
</head>
<body>
  <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    ${safeAuthorName ? `<p>By ${safeAuthorName}</p>` : ""}
    <p><a href="${story.url}" target="_blank" rel="noopener noreferrer">Visit App →</a></p>
    <p><small>Redirecting to full page...</small></p>
  </div>
</body>
</html>`;
}
```

#### Story Metadata Query

```typescript
// convex/stories.ts
export const getStoryMetadata = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      title: v.string(),
      description: v.string(),
      screenshotUrl: v.union(v.string(), v.null()),
      slug: v.string(),
      url: v.string(),
      authorName: v.optional(v.string()),
      // Keep tags minimal for meta, names only if needed
      tags: v.optional(v.array(v.string())),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.neq(q.field("isHidden"), true),
        ),
      )
      .unique();

    if (!story) return null;

    // Resolve screenshot URL (main image for social sharing)
    const screenshotUrl = story.screenshotId
      ? await ctx.storage.getUrl(story.screenshotId)
      : null;

    // Get author info if available
    let authorName: string | undefined = undefined;
    if (story.userId) {
      const author = await ctx.db.get(story.userId);
      authorName = author?.name || story.submitterName;
    } else {
      authorName = story.submitterName;
    }

    return {
      title: story.title,
      description: story.description,
      screenshotUrl,
      slug: story.slug,
      url: story.url,
      authorName,
    };
  },
});
```

#### Deployment configuration (Final)

- Keep SPA fallback: `/* /index.html 200`
- Add Netlify Edge Function at `netlify/edge-functions/botMeta.ts` and map in `netlify.toml`:

```
[[edge_functions]]
path = "/s/*"
function = "botMeta"
```

- Edge function implementation (`netlify/edge-functions/botMeta.ts`):
  - Detects crawler User-Agents: `facebookexternalhit`, `Twitterbot`, `LinkedInBot`, `Slackbot`, `Discordbot`, `TelegramBot`, `WhatsApp`, `Pinterest`, `opengraph`, `opengraphbot`, `bot`, `crawler`, `embedly`, `vkshare`, `quora link preview`
  - For bots: Rewrites request to PROD Convex meta endpoint:
    - `https://whimsical-dalmatian-205.convex.site/meta/s?slug={slug}`
    - Fallback to DEV Convex if PROD returns 404:
      - `https://acoustic-goldfinch-461.convex.site/meta/s?slug={slug}`
  - For browsers: Calls `context.next()` → SPA serves `/s/{slug}` normally
  - On errors: Falls back to SPA to ensure users always get content

- Homepage meta tags (index.html): Use absolute URLs for images:
  - `og:image` and `twitter:image` set to `https://vibeapps.dev/vibe-apps-open-graphi-image.png`

### Data Requirements

#### Available Story Fields (from schema)

- `title: string` - Main story title
- `description: string` - Short tagline/description
- `longDescription?: string` - Detailed description (can be truncated for meta)
- `screenshotId?: Id<"_storage">` - Reference to main screenshot
- `additionalImageIds?: Array<Id<"_storage">>` - References to additional images (up to 4)
- `screenshotUrl: string | null` - Computed URL from screenshotId via ctx.storage.getUrl()
- `additionalImageUrls: string[]` - Computed URLs from additionalImageIds
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
- **Server Routes**: Add Convex HTTP action at `/meta/s` and proxy `/meta/s/*` to it
- **Redirects/Proxy**: Update deployment configuration (see above). For bot-only behavior, add an Edge Function to rewrite `/s/:slug` to `/meta/s/:slug` for crawlers.

#### Social Media Integration

- **Share URLs**: Continue using `/s/{slug}` format
- **Crawler Detection**: Implement via Edge Function policy to route crawlers to `/meta/s/{slug}` (user-agents list maintained in code)
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

## Implementation Checklist

### Step 1: Add HTTP Meta Route

1. **Update `convex/http.ts`**:
   - Add the `/meta/s` route with HTTP action
   - Include the `generateStoryHTML` function
   - Handle slug parsing from URL path or query parameter

2. **Add `getStoryMetadata` to `convex/stories.ts`**:
   - Create the internal query to fetch story data optimized for metadata
   - Resolve `screenshotUrl` from `screenshotId` using `ctx.storage.getUrl()`
   - Include author name resolution from user records

### Step 2: Update Deployment Configuration

3. **Update `_redirects` file** (Netlify):

   ```
   # Proxy meta requests to Convex HTTP action
   /meta/s/* https://YOUR_CONVEX_DEPLOYMENT.convex.site/meta/s?slug=:splat 200

   # Keep SPA behavior for everything else
   /* /index.html 200
   ```

4. **Optional: Add Edge Function** for bot-only behavior:
   - Detect crawler User-Agents (`facebookexternalhit`, `Twitterbot`, `LinkedInBot`, etc.)
   - Rewrite `/s/:slug` to `/meta/s/:slug` for crawlers only
   - Let users continue to get the SPA

### Step 3: Testing & Validation

5. **Test the meta endpoint directly**:
   - Visit `/meta/s/some-story-slug` and verify HTML contains correct meta tags
   - Confirm fallback to `/vibe-apps-open-graphi-image.png` when no screenshot

6. **Social media validation**:
   - Test URLs with Facebook's Sharing Debugger
   - Test with Twitter's Card Validator
   - Test with LinkedIn's Post Inspector
   - Test with opengraph.xyz

7. **Verify user experience unchanged**:
   - Ensure `/s/{slug}` still works normally for users
   - Confirm SPA navigation and client-side meta updates still function

### Step 4: Deployment

8. **Deploy to production**:
   - Push Convex functions with `npx convex deploy`
   - Update `_redirects` file in your static site deployment
   - Monitor for any 404s or errors in meta route requests

### Step 5: Monitor & Iterate

9. **Performance monitoring**:
   - Check response times for `/meta/s/*` requests
   - Monitor error rates and 404s
   - Verify CDN caching is working effectively

10. **Social media engagement tracking**:
    - Monitor click-through rates from social platforms
    - Track referral traffic from Facebook, Twitter, LinkedIn
    - A/B test different meta descriptions or images if needed

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

---

## ✅ IMPLEMENTATION STATUS: COMPLETED

### What Was Implemented:

1. **✅ HTTP Meta Route**: Added `/meta/s` endpoint in `convex/http.ts`
2. **✅ Story Metadata Query**: Added `getStoryMetadata` internal query in `convex/stories.ts`
3. **✅ HTML Generation**: Server-side HTML with proper Open Graph and Twitter Card tags
4. **✅ Fallback Images**: Default OG image when stories don't have screenshots
5. **✅ Deployment Config**: Updated `_redirects` for proper routing

### How It Works:

The implementation uses a three-layer approach:

1. **Edge Function (Bot Detection)**: `netlify/edge-functions/botMeta.ts` intercepts requests to `/s/*`
   - Detects social media crawlers via User-Agent strings
   - For bots: Rewrites request to Convex meta endpoint (`/meta/s?slug=...`)
   - For browsers: Passes through to SPA (`context.next()`)

2. **Convex HTTP Route**: `/meta/s` endpoint generates server-rendered HTML
   - Uses `getStoryMetadata` internal query to fetch story data
   - Generates complete HTML with Open Graph and Twitter Card meta tags
   - Includes HTML escaping for security (prevents XSS)
   - Returns cached HTML response

3. **React SPA**: Continues to work normally for browser users
   - Client-side meta tag updates via `StoryDetail.tsx` still function
   - Provides immediate updates during SPA navigation
   - No changes required to existing React components

**Meta Endpoint**: Available at `/meta/s/{slug}` for direct testing and validation

### Test URLs (Examples):

- **Story with Screenshot**: https://vibeapps.dev/s/test-4-images-v1
- **Story without Screenshot**: https://vibeapps.dev/s/convex
- **Meta Endpoint (prod)**: https://whimsical-dalmatian-205.convex.site/meta/s?slug=sandcastle

### Social Media Validators (Use canonical `/s/{slug}`):

- **Facebook**: https://developers.facebook.com/tools/debug/
- **Twitter**: https://cards-dev.twitter.com/validator
- **LinkedIn**: https://www.linkedin.com/post-inspector/

**Status**: ✅ Ready for production. Social media sharing now works properly with story-specific metadata!

---

## Tips for Other React SPAs with Convex

This implementation pattern works well for any React SPA using Convex that needs dynamic Open Graph metadata. Here are key learnings and tips:

### Architecture Pattern

The three-layer approach (Edge Function → Convex HTTP Action → React SPA) provides:

1. **Zero impact on user experience**: Browsers never see the meta endpoint
2. **Proper crawler support**: Social bots get server-rendered HTML
3. **Type safety**: Convex validators ensure correct data structures
4. **Performance**: Edge functions run at the edge, Convex queries are optimized

### Key Implementation Details

#### 1. Edge Function Bot Detection

Always detect bots via User-Agent strings. Common crawlers to handle:

```typescript
const bots = [
  "facebookexternalhit",  // Facebook
  "twitterbot",           // Twitter/X
  "linkedinbot",          // LinkedIn
  "slackbot",             // Slack
  "discordbot",           // Discord
  "telegrambot",          // Telegram
  "whatsapp",             // WhatsApp
  "pinterest",            // Pinterest
  "opengraph",            // Generic Open Graph crawlers
  "opengraphbot",
  "bot ",                 // Generic bot pattern
  "crawler",
  "embedly",              // Embedly
  "vkshare",              // VKontakte
  "quora link preview",   // Quora
];
```

**Important**: Always fall back to SPA on errors. Never break user experience.

#### 2. Convex HTTP Actions

Convex HTTP routes use exact path matching, not parameterized routes:

- ✅ Good: `/meta/s` with slug from query param or path parsing
- ❌ Bad: `/meta/s/:slug` (not supported)

Always parse parameters from the URL manually:

```typescript
const url = new URL(request.url);
let slug = url.searchParams.get("slug");
if (!slug) {
  const parts = url.pathname.split("/");
  slug = parts[parts.length - 1] || "";
}
```

#### 3. HTML Escaping

**Critical**: Always escape user-generated content in HTML templates to prevent XSS:

```typescript
const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};
```

Apply escaping to all dynamic content: titles, descriptions, author names, etc.

#### 4. Image URLs

Use absolute URLs for Open Graph images. Convex storage URLs are already absolute, but always provide a fallback:

```typescript
const imageUrl = story.screenshotUrl || 
  "https://yourdomain.com/default-og-image.png";
```

**Image dimensions**: Open Graph images work best at 1200x630px. Twitter Cards support up to 1200x675px.

#### 5. Caching Strategy

Set appropriate cache headers for meta endpoints:

```typescript
headers: {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
}
```

- `max-age=60`: Browser cache for 60 seconds
- `s-maxage=300`: CDN cache for 5 minutes
- `stale-while-revalidate=600`: Serve stale content while revalidating for up to 10 minutes

This balances freshness with performance.

#### 6. Internal Queries for Metadata

Create lightweight internal queries that only fetch what's needed:

```typescript
export const getStoryMetadata = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      title: v.string(),
      description: v.string(),
      screenshotUrl: v.union(v.string(), v.null()),
      // ... only essential fields
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Use indexed queries for performance
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    
    // Resolve storage URLs
    const screenshotUrl = story.screenshotId
      ? await ctx.storage.getUrl(story.screenshotId)
      : null;
    
    return { /* minimal data */ };
  },
});
```

**Don't fetch**: Comments, ratings, full user objects, or other heavy data.

#### 7. Deployment Configuration

For Netlify, configure edge functions in `netlify.toml`:

```toml
[[edge_functions]]
path = "/s/*"
function = "botMeta"
```

Keep SPA fallback in `_redirects`:

```
/* /index.html 200
```

Edge functions run before redirects, so bot detection happens first.

#### 8. Testing Strategy

Test with real crawler User-Agents:

```bash
# Test Facebook crawler
curl -H "User-Agent: facebookexternalhit/1.1" \
  https://yourdomain.com/s/your-slug

# Test Twitter crawler
curl -H "User-Agent: Twitterbot/1.0" \
  https://yourdomain.com/s/your-slug
```

Use validation tools:
- Facebook: https://developers.facebook.com/tools/debug/
- Twitter: https://cards-dev.twitter.com/validator
- LinkedIn: https://www.linkedin.com/post-inspector/
- Generic: https://www.opengraph.xyz/

#### 9. Error Handling

Always handle errors gracefully:

```typescript
try {
  const story = await ctx.runQuery(internal.stories.getStoryMetadata, { slug });
  if (!story) {
    return new Response("Story not found", { status: 404 });
  }
  return new Response(generateStoryHTML(story), { /* headers */ });
} catch (error) {
  console.error("Error generating story metadata:", error);
  return new Response("Internal server error", { status: 500 });
}
```

In edge functions, fall back to SPA:

```typescript
try {
  // ... bot detection and meta fetch
} catch (e) {
  return context.next(); // Always fall back to SPA
}
```

#### 10. Type Safety

Use Convex validators throughout:

```typescript
// ✅ Good: Type-safe with validators
export const getStoryMetadata = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      title: v.string(),
      description: v.string(),
      // ...
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // TypeScript knows args.slug is string
    // Return type is validated
  },
});
```

### Common Pitfalls to Avoid

1. **Don't use client-side meta tag updates for crawlers**: They don't execute JavaScript
2. **Don't skip HTML escaping**: User content can contain XSS vectors
3. **Don't fetch heavy data**: Only get what's needed for meta tags
4. **Don't break user experience**: Always fall back to SPA on errors
5. **Don't use relative image URLs**: Always use absolute URLs for Open Graph
6. **Don't forget cache headers**: Set appropriate caching for performance
7. **Don't hardcode deployment URLs**: Use environment variables or config

### Alternative Approaches

If you're not using Netlify, you can:

- **Vercel**: Use Edge Middleware instead of Edge Functions
- **Cloudflare Pages**: Use Cloudflare Workers for bot detection
- **AWS Amplify**: Use Lambda@Edge functions
- **Direct Convex**: Skip edge function and proxy all `/s/*` requests (less efficient)

The edge function approach is preferred because it:
- Keeps user experience fast (no extra hop for browsers)
- Reduces Convex function calls (only bots hit Convex)
- Provides better caching (edge caching)

### Performance Considerations

- Edge functions run at the edge (low latency)
- Convex queries are optimized with indexes
- HTML generation is fast (simple string templating)
- Caching reduces load on Convex

Expected performance:
- Edge function: < 10ms
- Convex query: 50-200ms (depending on data)
- HTML generation: < 5ms
- Total: < 250ms for bot requests

### Maintenance

Keep the bot User-Agent list updated as new crawlers emerge. Monitor:
- Social media platform updates
- New sharing platforms
- Search engine crawlers (if needed)

Check Convex logs for 404s or errors in meta route requests. Monitor edge function execution times.

---

**Summary**: This pattern provides a production-ready solution for dynamic Open Graph metadata in React SPAs using Convex. The key is separating bot traffic (server-rendered HTML) from browser traffic (SPA) while maintaining type safety and performance.
