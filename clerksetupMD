# Clerk Authentication Setup Guide for VibeApps

This guide outlines the steps to integrate Clerk authentication into the VibeApps project, enabling user roles, protected actions, and profile management based on the specified requirements.

## 1. Project Setup

### 1.1 Install Clerk Dependencies

Add the necessary Clerk libraries to your project for both frontend (React) and backend (Convex).

```bash
bun add @clerk/clerk-react @clerk/clerk-sdk-node convex @clerk/themes
# or
npm install @clerk/clerk-react @clerk/clerk-sdk-node convex @clerk/themes
# or
yarn add @clerk/clerk-react @clerk/clerk-sdk-node convex @clerk/themes
```

### 1.2 Configure Clerk Environment Variables

1.  Sign up for a Clerk account at [https://clerk.com/](https://clerk.com/).
2.  Create a new Clerk application in the Clerk dashboard.
3.  Navigate to **API Keys** in your Clerk application dashboard.
4.  Copy the **Publishable Key** and **Secret Key**.
5.  Set these keys as environment variables in your Convex deployment:

    - Go to your Convex project dashboard -> Settings -> Environment Variables.
    - Add `CLERK_PUBLISHABLE_KEY` with your Publishable Key.
    - Add `CLERK_SECRET_KEY` with your Secret Key.
    - Add `CLERK_JWT_ISSUER_DOMAIN` which can also be found in the Clerk dashboard under API Keys -> JWT Templates -> Issuer. It will look like `https://your-app-name.clerk.accounts.dev`.

6.  Add the **Publishable Key** to your frontend environment variables (e.g., in a `.env` file used by Vite):

    ```env
    # .env
    VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    ```

### 1.3 Configure Convex Auth

Modify `convex/auth.config.js` (or create it if it doesn't exist) to configure Clerk as the authentication provider:

```javascript
// convex/auth.config.js
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex", // This should match the Audience ('aud') claim in your Clerk JWT template
    },
  ],
};
```

_Ensure the `applicationID` here matches the "Audience" field set in your Clerk JWT template. Often, this is simply "convex"._

## 2. Frontend Integration (React/Vite)

### 2.1 Initialize Clerk Provider

Wrap your main application component (likely in `src/main.tsx` or `src/App.tsx`) with the `ClerkProvider`.

```typescript
// src/main.tsx or src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Or your main CSS file
import { ClerkProvider } from '@clerk/clerk-react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!publishableKey) {
  throw new Error("Missing Publishable Key. Make sure VITE_CLERK_PUBLISHABLE_KEY is set in your .env file.");
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
);
```

_Note: You might need to adjust imports and component structure based on your specific project layout._

### 2.2 Implement Sign-in/Sign-up Flow

Use Clerk's pre-built components (`<SignIn />`, `<SignUp />`, `<UserButton />`) or hooks (`useSignIn`, `useSignUp`, `useUser`, `useAuth`) to handle user authentication flows.

- **Login/Signup Pages:** Create routes/pages for signing in and signing up using `<SignIn />` and `<SignUp />`.
- **User Button:** Add `<UserButton afterSignOutUrl="/" />` to your layout (e.g., header) to show user status and provide sign-out functionality.

### 2.3 Protect Routes and Components

Use Clerk's helper components (`<SignedIn>`, `<SignedOut>`) or the `useAuth` hook to conditionally render UI elements or entire routes based on authentication status.

**Example: Protected Route (using react-router-dom)**

```typescript
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Outlet } from "react-router-dom"; // Or your routing library's equivalent

function ProtectedLayout() {
  return (
    <>
      <SignedIn>
        {/* Render the protected content for signed-in users */}
        <Outlet />
      </SignedIn>
      <SignedOut>
        {/* Redirect signed-out users to the sign-in page */}
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

// In your router setup:
<Route element={<ProtectedLayout />}>
  <Route path="/submit" element={<SubmitPage />} />
  <Route path="/profile" element={<ProfilePage />} />
  {/* Add other protected routes here */}
</Route>
```

**Example: Conditionally Rendering a Comment Button**

```typescript
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button"; // Assuming Shadcn UI

function CommentSection() {
  // ... other component logic

  return (
    <div>
      {/* ... display comments */}
      <SignedIn>
        <Button onClick={handleOpenCommentForm}>Add Comment</Button>
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
           <Button>Sign in to Comment</Button>
        </SignInButton>
      </SignedOut>
    </div>
  );
}
```

## 3. Backend Integration (Convex)

### 3.1 Update Schema for User Data

Modify your `convex/schema.ts` to store user-related information. Link submissions and comments to users.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ... existing tables (forms, votes, etc.)

  users: defineTable({
    // Basic user info, Clerk handles the primary profile
    name: v.string(),
    // Store Clerk User ID for linking
    clerkId: v.string(),
    // Optional: Store roles
    roles: v.optional(v.array(v.string())),
  }).index("by_clerk_id", ["clerkId"]), // Index for efficient lookup

  submissions: defineTable({
    // ... other submission fields
    userId: v.id("users"), // Link to the users table
    formId: v.id("forms"), // Link to the specific form
    // ... submission data
  })
    .index("by_user", ["userId"])
    .index("by_form", ["formId"]),

  comments: defineTable({
    // ... other comment fields
    text: v.string(),
    userId: v.id("users"), // Link to the users table
    submissionId: v.optional(v.id("submissions")), // Link to submission if applicable
    formId: v.optional(v.id("forms")), // Link to form if applicable (e.g., general form comments)
  })
    .index("by_user", ["userId"])
    .index("by_submission", ["submissionId"])
    .index("by_form", ["formId"]),

  // ... other tables like votes, potentially linking to userId as well
  votes: defineTable({
    userId: v.id("users"),
    submissionId: v.id("submissions"),
    value: v.number(), // e.g., 1 for upvote, -1 for downvote
  }).index("by_user_submission", ["userId", "submissionId"]), // Unique index potentially
});
```

### 3.2 Create User on First Login (Webhook or Mutation)

You need a way to create a user record in your Convex `users` table the first time a user signs up via Clerk. Two common approaches:

- **Clerk Webhook:** (Recommended for robustness) Set up a Clerk webhook for `user.created` events. Create a Convex HTTP endpoint (`convex/http.ts`) to receive this webhook and insert the user into your `users` table using their `clerkId`. This requires exposing the HTTP endpoint publicly.
- **Authenticated Mutation:** Create a Convex mutation (e.g., `ensureUser`) that checks if a user exists based on their Clerk ID (obtained from `ctx.auth.getUserIdentity()`) and creates one if not. Call this mutation from the frontend after a successful sign-in/sign-up.

**Example: `ensureUser` Mutation**

```typescript
// convex/users.ts
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api"; // If using internal query for lookup
import { v } from "convex/values";

// Helper to get user identity (consider placing in a shared file)
async function getUserId(ctx: any): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null; // Or throw new Error("User not authenticated"); depends on context
  }
  // Check if user exists in your DB
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (user) {
    return user._id;
  }
  return null;
}

export const ensureUser = mutation({
  args: {}, // No args needed, gets info from identity
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called ensureUser without authentication");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existingUser) {
      // Optional: Update user data if needed (e.g., name change)
      // if (existingUser.name !== identity.name) {
      //   await ctx.db.patch(existingUser._id, { name: identity.name });
      // }
      return existingUser._id;
    }

    // Create new user if they don't exist
    const userId = await ctx.db.insert("users", {
      name: identity.name ?? "Anonymous", // Use Clerk name or fallback
      clerkId: identity.subject, // Clerk User ID
      // Initialize roles if applicable, e.g., default 'member'
      // roles: ['member'],
    });

    return userId;
  },
});
```

_Call `ensureUser` from your frontend after login._

### 3.3 Secure Convex Functions (Mutations/Queries/Actions)

Modify your Convex functions to require authentication where necessary.

**Example: Submitting a Form (Mutation)**

```typescript
// convex/submissions.ts (or similar)
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel"; // Import Id type

// Helper function (consider placing in a shared utils file)
async function getAuthenticatedUserId(ctx: any): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("User not authenticated");
  }
  // Find the user document ID based on the Clerk ID (subject)
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    // This case should ideally be handled by ensureUser, but good to check
    throw new Error("User record not found for authenticated user.");
  }
  return user._id;
}

export const submitFormData = mutation({
  args: {
    formId: v.id("forms"),
    // ... other form data fields with validators
    submissionData: v.object({
      /* ... your fields */
    }),
  },
  returns: v.id("submissions"),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx); // This throws if not authenticated

    // Proceed with inserting the submission, linking it to the userId
    const submissionId = await ctx.db.insert("submissions", {
      formId: args.formId,
      userId: userId, // Link to the authenticated user
      // ... spread args.submissionData or map fields
    });

    return submissionId;
  },
});
```

**Example: Deleting a Comment (Mutation)**

```typescript
// convex/comments.ts (or similar)
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
// Import helper if used: import { getAuthenticatedUserId } from "./users";

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx); // Throws if not authenticated

    const comment = await ctx.db.get(args.commentId);

    if (!comment) {
      throw new Error("Comment not found");
    }

    // Check if the authenticated user is the author of the comment
    if (comment.userId !== userId) {
      throw new Error("User not authorized to delete this comment");
    }

    await ctx.db.delete(args.commentId);
    return null;
  },
});
```

_Apply similar logic to voting, modifying submissions, etc._

### 3.4 Implement Role-Based Access Control (Admin)

1.  **Assign Roles:**

    - **Manual:** Add an admin interface (see step 4) or directly modify the `roles` field in the `users` table in the Convex dashboard for specific users.
    - **Clerk Metadata:** Store the role in Clerk's user metadata (`publicMetadata` or `privateMetadata`). Sync this metadata to your Convex `users` table via the webhook or `ensureUser` mutation.

2.  **Check Roles in Convex Functions:** Create a helper function to check user roles within your mutations/queries.

**Example: Role Check Helper**

```typescript
// convex/users.ts or convex/utils.ts
import { Id } from "./_generated/dataModel";

// Assumes user doc has a `roles: string[]` field
export async function requireAdminRole(ctx: any): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("User not found.");
  }

  if (!user.roles || !user.roles.includes("admin")) {
    throw new Error("Admin privileges required.");
  }
}
```

**Example: Using Role Check in an Admin Function**

```typescript
// convex/adminActions.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminRole } from "./users"; // Import the helper

export const deleteAnySubmission = mutation({
  args: { submissionId: v.id("submissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminRole(ctx); // Check for admin role first

    // Proceed with admin action
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      console.warn(`Admin attempted to delete non-existent submission: ${args.submissionId}`);
      return null; // Or throw, depending on desired behavior
    }
    await ctx.db.delete(args.submissionId);
    console.log(`Admin deleted submission: ${args.submissionId}`);
    return null;
  },
});
```

## 4. Admin Dashboard

1.  **Create Admin Route:** Set up a route like `/admin` in your frontend router.
2.  **Protect Admin Route:** Use the Clerk `<SignedIn>` component combined with a frontend check for the admin role (fetched from your Convex `users` table via a query). Alternatively, attempt to call an admin-only Convex query on route load and redirect if it fails due to permissions.
3.  **Build Admin UI:** Create components to display data and perform admin actions (e.g., view all users, delete submissions/comments, manage forms). These components will call the admin-specific Convex mutations/queries you created (e.g., `adminActions.deleteAnySubmission`).

**Example: Protecting Admin Route (Frontend Check)**

```typescript
// convex/users.ts - Add a query to get user roles
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getUserRoles = query({
  args: {},
  returns: v.union(v.null(), v.object({ roles: v.array(v.string()) })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return user ? { roles: user.roles ?? [] } : null;
  },
});

// src/components/AdminRouteGuard.tsx
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api"; // Adjust path
import { SignedIn, useUser } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";
import { LoadingSpinner } from "./LoadingSpinner"; // Your loading component

function AdminRouteGuard() {
  const { isSignedIn, isLoaded: isClerkLoaded } = useUser();
  const userData = useQuery(api.users.getUserRoles); // Fetch roles
  const isLoading = !isClerkLoaded || userData === undefined; // Wait for Clerk and Convex

  if (isLoading) {
    return <LoadingSpinner />; // Show loading indicator
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />; // Redirect if not signed in
  }

  const isAdmin = userData?.roles?.includes("admin");

  if (!isAdmin) {
    return <Navigate to="/" replace />; // Redirect if not admin
  }

  // User is signed in and is an admin
  return <Outlet />;
}

// In your router:
<Route element={<AdminRouteGuard />}>
  <Route path="/admin" element={<AdminDashboardPage />} />
  {/* Other admin routes */}
</Route>
```

## 5. Profile Features

1.  **Profile Page Route:** Create a route like `/profile/:userId` or `/profile/me`.
2.  **Fetch User Data:** Create Convex queries to fetch a user's submissions and comments based on their `userId`.
3.  **Display Data:** Build UI components to display the fetched submissions and comments.
4.  **Modify/Delete Functionality:**
    - Add "Edit" buttons to submissions, linking to an edit form/page. Use a Convex mutation similar to `submitFormData` but using `ctx.db.patch` or `ctx.db.replace`, ensuring the authenticated user owns the submission.
    - Add "Delete" buttons to comments, calling the `deleteComment` mutation created earlier. Ensure these buttons only appear for the comment author.

**Example: Query for User's Submissions**

```typescript
// convex/submissions.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getUserSubmissions = query({
  args: { userId: v.id("users") }, // Could also fetch based on logged-in user implicitly
  returns: v.array(
    v.object({
      /* ...submission fields... */
    })
  ),
  handler: async (ctx, args) => {
    // Optional: Add check to ensure only the user themselves or an admin can view?
    // const identity = await ctx.auth.getUserIdentity(); ... check logic ...

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc") // Or desired order
      .collect(); // Collect all for the profile page

    // You might want to join with form data here if needed
    return submissions;
  },
});
```

## 6. Public Forms

- **Form Viewing:** Ensure your Convex query for fetching form definitions (`getForm`) does _not_ require authentication.
- **Result Viewing:** Ensure your Convex query for fetching form results/submissions (`getFormSubmissions`) does _not_ require authentication.
- **Form Submission:**
  - Create a _separate_ Convex mutation for _public_ submissions (e.g., `submitPublicFormData`).
  - This public mutation should _not_ call `getAuthenticatedUserId`.
  - It should accept the necessary form data.
  - It will insert a submission _without_ a `userId`. Modify the schema (`submissions` table) to make `userId: v.optional(v.id("users"))`).
  - Use this public mutation in your public form component.

**Example: Public Submission Mutation**

```typescript
// convex/submissions.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const submitPublicFormData = mutation({
  // This is a public mutation, no auth check needed here
  args: {
    formId: v.id("forms"),
    submissionData: v.object({
      /* ... your fields */
    }),
  },
  returns: v.id("submissions"),
  handler: async (ctx, args) => {
    // No userId is associated with this submission
    const submissionId = await ctx.db.insert("submissions", {
      formId: args.formId,
      userId: null, // Explicitly set to null or omit if schema allows undefined
      // ... spread args.submissionData or map fields
    });
    return submissionId;
  },
});
```

Remember to update your schema (`convex/schema.ts`) to allow `userId` to be optional in the `submissions` table: `userId: v.optional(v.id("users"))`. Also adjust queries fetching submissions to handle cases where `userId` might be null.

This guide provides a comprehensive structure. You'll need to adapt the specific code snippets, table names, field names, and UI components to match your exact project implementation. Remember to test each feature thoroughly.
