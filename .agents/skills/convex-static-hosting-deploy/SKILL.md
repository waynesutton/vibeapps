---
name: convex-static-hosting-deploy
description: Router for Convex static-hosting deploy requests. Prefer deploydev for /deploydev and deployprod for /deployprod.
---

# Convex Static Hosting Deploy Router

Use this router when the user asks about Convex static-hosting deployment but does not clearly choose dev or production.

Source of truth:

- Component repo: `https://github.com/get-convex/static-hosting`
- Component docs: `https://www.convex.dev/components/static-hosting`

## Route By Intent

- `/deploydev`, deploy dev, upload dev, development static hosting -> `.agents/skills/deploydev/SKILL.md`
- `/deployprod`, deploy prod, deploy production, production static hosting -> `.agents/skills/deployprod/SKILL.md`

## Portable Rules

- These skills are app-agnostic. Do not assume any specific app name or Convex URL.
- Prefer scripts already defined in the current repo's `package.json`.
- If scripts are missing, use direct Convex static-hosting commands and discover the component name from `convex/convex.config.ts`.
- Keep dev and production deploy flows separate.
- Never publish a dev Convex URL as canonical metadata.

## If Intent Is Ambiguous

Ask one concise question:

```text
Do you want the development static-hosting deploy or the production deploy?
```
