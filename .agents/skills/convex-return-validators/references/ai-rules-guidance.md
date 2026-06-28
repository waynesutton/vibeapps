# Updated Convex AI rules for return validators

## What changed

The Convex team removed the "always add return validators" guidance from their AI rules. If you have Convex AI rules or system prompts that tell LLMs to always add `returns:` validators, update them.

## Why the old rule hurt AI code quality

Three failure modes kept showing up in agentic workflows:

**1. Copy-paste verbosity.** LLMs don't create shared validator files. They inline the full shape on every function. A 10-field return object copy-pasted across 8 functions is 80 lines of validators that all need to stay in sync.

**2. Token bloat.** Every validator the AI reads and writes burns tokens. In agentic workflows where the model re-reads files to plan multi-step changes, those extra tokens compound. Slower iterations, more mistakes.

**3. Hallucinated fields.** Asking a model to reproduce a schema as a validator is asking it to recall and rewrite a data shape from memory. It will invent fields, miss fields, or use wrong types. TypeScript catches some of this, but the damage (wasted cycles) is already done.

## Updated AI rules template

Replace the old "always add returns" rule with this:

```
## Return validators

Use simple TypeScript types and inference by default.
Do NOT add a `returns:` validator unless one of these applies:

- The function is part of a Convex component (inference not available)
- You're using static codegen (functions default to v.any() without returns)
- You're generating an OpenAPI spec (missing validators become any)
- The handler deals with `any`, type assertions, or unvalidated external data
- You explicitly want Convex to enforce an exact runtime contract

When you do use return validators:
- Define shared validators in a central file and import them
- Use .pick(), .omit(), .extend() to derive return shapes from base validators
- Use convex-helpers validator utilities to avoid re-declaring system fields
- Never copy-paste inline validator shapes across multiple functions

When you don't use return validators:
- Use Doc<"tableName"> for full document return types
- Use WithoutSystemFields for insert shapes
- Let TypeScript inference handle the return type
```

## Examples for AI prompts

### Prompt that produces good code (no return validator needed)

```
Write a Convex query that fetches all tasks for a user, sorted by creation time.
Use TypeScript inference for the return type — no returns validator needed.
```

### Prompt that should use a return validator

```
Write a Convex query that calls an external API and returns a subset of the response.
Since we're dealing with unvalidated external data, add a returns validator
to enforce the exact shape.
```

### Prompt for a component function

```
Write a Convex component query for a rate limiter.
Since this is a component (no inference available), add a returns validator
as the type contract.
```
