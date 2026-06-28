# Create a PRD

Use this skill before any multi-file feature, architectural decision, or complex bug fix.

Activate with: `@create-prd`

## Location and naming

- All PRDs live in `prds/` folder
- File name: `prds/<feature-or-problem-slug>.md`
- Extension is always `.md`, not `.prd`
- Use kebab-case for the filename (e.g., `prds/adding-email-auth.md`)

## Template

Copy and fill in this template:

```markdown
# [Feature or problem name]

## Summary

1-2 sentence description of what this is and why it matters.

## Problem

What is broken or missing. Include symptoms, error messages, or user-facing impact.

## Root cause (for bugs)

What actually caused it. Do not skip this for bugs.

## Proposed solution

How to fix or build it. Be specific about the approach chosen and why.

## Files to change

- `path/to/file.ts` - what changes and why
- `convex/schema.ts` - if schema changes are needed

## Edge cases and gotchas

Anything non-obvious that came up during analysis. This section saves the next session.

## Verification

How to confirm the fix or feature works:

- [ ] Step 1
- [ ] Step 2

## Related

Links to related PRDs, issues, or external docs if any.
```

## When to create a PRD

- 3+ files will change
- Schema changes are involved
- Architectural decisions are being made (auth, hosting, data model)
- A bug required significant investigation to diagnose
- A feature needs to be referenced later as a migration guide or implementation reference

## When to skip a PRD

- Single file bug fix obvious from logs or types
- Typo, CSS tweak, or label change
- Copy change to markdown content

## After creating the PRD

1. Add the feature tasks to `TASK.md` under `## To Do` as checkable items
2. Reference the PRD path in the TASK.md entry if useful
3. Begin implementation only after the plan is clear
