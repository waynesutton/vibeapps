---
name: convex-return-validators
description: Guide for when to use and when not to use return validators in Convex functions. Use this skill whenever the user is writing Convex queries, mutations, or actions and needs guidance on return value validation. Also trigger when the user asks about Convex type safety, runtime validation, AI-generated Convex code, Convex AI rules, Convex security best practices, or when they're debugging return type issues in Convex functions. Trigger this skill when users mention "validators", "returns", "return type", or "exact types" in the context of Convex development. Also trigger when writing or reviewing Convex AI rules or prompts that instruct LLMs how to write Convex code.
---

# When to and when not to use return validators in Convex

Convex recently updated its guidance on return validators. The old rule was "always add a `returns` validator." The new guidance is: **prefer simple TypeScript types and inference by default. Use `returns:` when you actually want Convex to enforce an exact runtime contract.**

Return validators aren't bad. The word "always" was doing damage.

## What is a return validator?

Convex lets you validate arguments coming into a function using `args` and return values going out using `returns`. A return validator declares the return shape, and Convex checks it at runtime.

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getUserPreview = query({
  args: { userId: v.id("users") },
  returns: v.object({
    name: v.string(),
  }),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    return { name: user.name };
  },
});
```

If the returned value doesn't match, you get a runtime error instead of silently returning unexpected data. Object validators don't allow extra properties — returning extra fields will fail validation at runtime.

## Why the old "always" rule existed

The original motivation was more about TypeScript pain than runtime correctness. Convex projects can hit circular type problems because functions reference generated `api` or `internal` objects, and those references become part of the generated types. Types reference types reference types until TypeScript gives up.

The thinking: if the model always declared return validators, it would reduce reliance on inferred return types and break the cycle. In practice, it only helps in specific circumstances.

## Why "always" causes problems

In real codebases, and especially in agentic AI workflows, the "always" rule creates predictable failure modes:

### Verbosity and copy-paste fragility

LLMs don't reuse validators. They copy-paste shapes inline. You end up with return validators like this on every function:

```typescript
export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("activityLog"),
      _creationTime: v.number(),
      action: v.string(),
      userId: v.id("users"),
      userName: v.string(),
      projectId: v.id("projects"),
      entityType: v.string(),
      entityId: v.string(),
      metadata: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    // ...
  },
});
```

It works, but once that shape is copy-pasted across multiple functions, a schema change stops being a "change one place" job. You update a field, chase compile errors, chase runtime validation errors, then update a bunch of validators that are almost-the-same-but-not-quite.

### Token inefficiency for AI

Every extra hundred tokens matters when the model is trying to keep the codebase in working memory and plan multi-step changes. Verbosity translates into slower iterations and more "oops, I forgot a field" cycles.

### Hallucination risk

Asking a model to reproduce a schema as a validator increases the chance it invents fields, misses fields, or picks the wrong validator type. TypeScript catches a lot of this, but catching things later is still slower than not introducing the problem.

### System field duplication

Unless you're using helper utilities, return validators drag you into re-declaring `_id` and `_creationTime` over and over. If you want heavy validator usage, look at the validator utilities in [convex-helpers](https://github.com/get-convex/convex-helpers).

Convex already provides ergonomic type helpers like `Doc<>` and `WithoutSystemFields`, so a lot of the time you can keep code tidier by leaning on normal TypeScript types and inference.

## The "exact type" problem — where return validators shine

TypeScript is structurally typed, which means it doesn't have true exact types. A function can claim it returns a `User` but still accidentally return extra fields.

This becomes more likely once `any` gets involved, or when consuming untyped external API data:

```typescript
// WITHOUT return validator — extra field leaks silently
export const getUser = query({
  args: {},
  handler: async (ctx): Promise<User> => {
    return {
      id: "123",
      name: "Alice",
      email: "alice@example.com", // Extra field — no error!
    } as any;
  },
});

// WITH return validator — Convex catches extra field at runtime
export const getUser = query({
  args: {},
  returns: v.object({
    id: v.string(),
    name: v.string(),
  }),
  handler: async (ctx) => {
    return {
      id: "123",
      name: "Alice",
      email: "alice@example.com", // Runtime error!
    } as any;
  },
});
```

That guarantee is real and valuable. It's just not needed everywhere, and using it everywhere comes with costs.

## When you SHOULD use return validators

Return validators are useful when you need **runtime enforcement of an exact contract**, not just TypeScript typechecking.

### Components codegen
There are cases where inference isn't available and the validator becomes the contract.

### Static codegen workflows
With static codegen, functions don't have return type inference and will default to `v.any()` if they don't have a `returns` validator.

### OpenAPI generation
You often want the server to enforce the contract you're generating client types from. Missing validators get treated as `any`, which makes the resulting spec less useful.

### When `any` or unvalidated external data is involved
If there's a realistic chance you'll accidentally return data you didn't intend to expose, return validators catch that. For external API calls, it's usually better to validate the data at the boundary (inside an action right after the fetch). But belt-and-braces is fair too.

## When you should NOT use return validators

### Standard queries and mutations with good TypeScript types
If your handler's return type is already well-typed via inference or explicit TypeScript annotations, the return validator adds verbosity without meaningful safety.

### AI-generated code in agentic workflows
This is counterintuitive, but the "always" rule was actively harming AI code quality. LLMs produce better Convex code when they can lean on TypeScript inference instead of reproducing schema shapes as validators. Fewer tokens, fewer hallucinations, faster iteration.

### Rapid prototyping
When the return shape is still changing, return validators slow you down. Add them once the shape stabilizes and you need the runtime contract.

### Internal functions
Functions using `internalQuery`, `internalMutation`, or `internalAction` aren't exposed to clients. TypeScript inference is usually sufficient.

## Updated guidance for AI rules and prompts

If you're writing Convex AI rules (for Claude, Cursor, Copilot, or any agentic tool), update the guidance:

**Old rule:** "Always add a `returns` validator to queries and mutations."

**New rule:** "Prefer simple TypeScript types and inference by default. Use `returns:` when you actually want Convex to enforce an exact runtime contract — such as components codegen, static codegen, OpenAPI generation, or when handling `any`/unvalidated external data."

When AI does use return validators, encourage it to:
- Reuse shared validators from a central file instead of copy-pasting shapes inline
- Use `.pick()`, `.omit()`, `.extend()` on object validators to derive return types
- Use `Doc<"tableName">` and `WithoutSystemFields` for TypeScript types when validators aren't needed
- Use validator utilities from `convex-helpers` to reduce system field duplication

## Decision framework

| Scenario | Use `returns:`? | Why |
|---|---|---|
| Components codegen | **Yes** | Inference not available, validator is the contract |
| Static codegen | **Yes** | Functions default to `v.any()` without it |
| OpenAPI generation | **Yes** | Missing validators become `any` in the spec |
| `any` or unvalidated external data | **Yes** | Catches accidental data leakage at runtime |
| Standard queries with good TS types | **No** | TypeScript inference is sufficient |
| AI/LLM-generated code (default) | **No** | Reduces verbosity, tokens, and hallucination risk |
| Internal functions | **No** | Not client-facing, inference is fine |
| Rapid prototyping | **No** | Add later when shape stabilizes |

## Further reading

- Original blog post: https://stack.convex.dev/when-to-and-when-not-to-use-return-validators
- Convex validation docs: https://docs.convex.dev/functions/validation
- Convex TypeScript docs (Doc<>, WithoutSystemFields): https://docs.convex.dev/generated-api/server#doc
- Static codegen docs: https://docs.convex.dev/production/best-practices/static-codegen
- OpenAPI docs: https://docs.convex.dev/http-api/openapi
- convex-helpers validator utilities: https://github.com/get-convex/convex-helpers
