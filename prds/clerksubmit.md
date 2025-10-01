# Clerk Authentication Implementation Documentation

## Current Submit Button & Route Protection

### Navigation Submit Button (Layout.tsx)

The submit button in the main navigation uses Clerk's `SignedIn` and `SignedOut` components:

**For Non-Signed Users:**

- Shows `SignInButton` with modal mode
- Button text: "Submit" with plus icon
- Opens Clerk sign-in modal when clicked

**For Signed Users:**

- Shows `Link` to `/submit` route
- Same styling and text as non-signed version
- Direct navigation to submit form

### Route Protection (/submit)

The `/submit` route is protected using `ProtectedLayout` component:

- Wraps route in `SignedIn` component for authenticated users
- Uses `SignedOut` with `RedirectToSignIn` for unauthenticated users
- Automatically redirects non-signed users to Clerk sign-in page

### Footer Links

Footer contains conditional sign-in/sign-out buttons:

- Non-signed users: `SignInButton` with modal mode
- Signed users: Sign out button that calls `signOut()`

## User Action Authentication Requirements

### Voting/Upvoting (StoryDetail.tsx & StoryList.tsx)

**Current Implementation:**

- Checks `isSignedIn` status before allowing vote
- Redirects to `/sign-in` page if not authenticated
- Uses `navigate("/sign-in")` for redirection
- No popup notifications, direct redirect

### Rating (StoryDetail.tsx)

**Current Implementation:**

- Checks `isSignedIn` status before allowing rating
- Redirects to `/sign-in` page if not authenticated
- Uses `navigate("/sign-in")` for redirection
- Also prevents re-rating with alert for already-rated users

### Commenting (CommentForm.tsx & StoryDetail.tsx)

**Current Implementation:**

- `CommentForm.tsx`: Uses `toast.error("Please sign in to comment.")` then `navigate("/sign-in")`
- `StoryDetail.tsx`: Direct `navigate("/sign-in")` in `handleCommentSubmit`
- Form is disabled for non-signed users
- Shows "Sign in to write your comment..." placeholder

### Bookmarking (StoryList.tsx & StoryDetail.tsx)

**Current Implementation:**

- `StoryList.tsx`: Uses `alert("Please sign in to bookmark stories.")`
- `StoryDetail.tsx`: Uses `toast.error("Please sign in to bookmark stories.")`
- Shows non-clickable bookmark icon for non-signed users
- No redirection, just notification

## Convex Backend Authentication

### Protected Mutations

All user actions (vote, rate, comment, bookmark) use Convex mutations that require authentication:

- `requireAuth()` or `getAuthenticatedUserId()` functions
- Throws errors if user not authenticated or not found in database
- User sync handled by `UserSyncer` component on sign-in

### Query Skipping

Queries use conditional skipping pattern:

```typescript
useQuery(api.someQuery, isSignedIn ? { args } : "skip");
```

## Admin Protection

Admin routes and queries use:

- `useConvexAuth()` hook for auth state
- `requireAdminRole()` in Convex functions
- Conditional query skipping based on `isAuthenticated` status
- Loading states while auth is being determined
