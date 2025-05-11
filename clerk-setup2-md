To make your Convex user table read admin role metadata from Clerk, you need to implement a system that stores Clerk user information in your Convex database. Here's how to do it:

## 1. Set up your user schema in Convex

First, define a schema for your users table that includes a field for the admin role:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // this is the Clerk ID, stored in the tokenIdentifier field
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()), // This will store the admin role
  }).index("by_token", ["tokenIdentifier"]),
});
```

## 2. Create a mutation to store user data

You'll need a mutation that captures the user metadata from Clerk, including the admin role:

```typescript
// convex/users.ts
import { mutation } from "./_generated/server";

export const updateProfile = mutation({
  args: {
    role: v.optional(v.string()),
    // Add other user fields as needed
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called updateProfile without authentication present");
    }

    // Check if we've already stored this identity before
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (user !== null) {
      // Update existing user with new role information
      await ctx.db.patch(user._id, {
        role: args.role,
        // Update other fields as needed
      });
      return user._id;
    }

    // If it's a new identity, create a new user
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      role: args.role,
      // Add other fields as needed
    });
  },
});
```

## 3. Implement approache to get the admin role from Clerk

### Option 2: Webhook approach (recommended)

Set up a webhook in Clerk to automatically update user data in Convex when it changes:

1. Configure a webhook endpoint in Clerk as described in the [Convex documentation](https://docs.convex.dev/auth/database-auth#set-up-webhooks)
2. Create an action in Convex to handle the webhook and update user data

This approach ensures your Convex database stays in sync with Clerk's user data automatically.

## 4. Query for users with admin role

Once you have the admin role stored in your users table, you can query for it:

```typescript
// convex/users.ts
import { query } from "./_generated/server";

export const getAdminUsers = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
  },
});
```

By following these steps, you'll have a Convex user table that stores and can query the admin role metadata from Clerk.

[Stack: User Authentication with Clerk and Convex](https://stack.convex.dev/user-authentication-with-clerk-and-convex#integrating-clerk-with-convex) provides more details on integrating Clerk with Convex.
