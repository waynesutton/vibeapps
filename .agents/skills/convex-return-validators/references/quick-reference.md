# Convex Return Validators Quick Reference

## The updated rule

**Old:** Always add a `returns` validator.
**New:** Prefer TypeScript types and inference by default. Use `returns:` when you need runtime enforcement of an exact contract.

## Syntax

```typescript
import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

export const myFunction = query({
  args: { /* argument validators */ },
  returns: /* return validator here */,
  handler: async (ctx, args) => {
    // your logic
  },
});
```

## Common return validator patterns

### Return a single value
```typescript
returns: v.string()
returns: v.number()
returns: v.boolean()
returns: v.null()
returns: v.id("tableName")
```

### Return an object
```typescript
returns: v.object({
  name: v.string(),
  count: v.number(),
  active: v.boolean(),
})
```

### Return an array
```typescript
returns: v.array(v.object({
  _id: v.id("tasks"),
  title: v.string(),
}))
```

### Return a union (multiple possible shapes)
```typescript
returns: v.union(
  v.object({ type: v.literal("success"), data: v.string() }),
  v.object({ type: v.literal("error"), message: v.string() })
)
```

### Return nullable
```typescript
returns: v.nullable(v.object({
  name: v.string(),
}))
// equivalent to v.union(v.object({...}), v.null())
```

## Validator composition (reduces duplication)

```typescript
const base = v.object({
  name: v.string(),
  email: v.string(),
  secret: v.string(),
});

base.pick("name", "email")       // only name + email
base.omit("secret")              // everything except secret
base.partial()                   // all fields become optional
base.extend({ age: v.number() }) // add new fields
```

## TypeScript alternatives (use these by default)

```typescript
import { Doc } from "./_generated/dataModel";

// Use Doc<> for full document types
type User = Doc<"users">;

// Use WithoutSystemFields for insert/update shapes
import { WithoutSystemFields } from "convex/server";
type NewUser = WithoutSystemFields<Doc<"users">>;
```

## What return validators enforce at runtime

1. Exact object shapes (extra fields cause errors)
2. Correct types (string vs number, etc.)
3. Required vs optional fields
4. Valid union discriminants
5. No `undefined` values (not valid in Convex)

## What return validators DON'T help with

1. TypeScript inference (already works without them)
2. Business logic correctness
3. Authorization (your handler's job)
4. Performance
