---
name: sec-check
description: Security review checklist for Convex functions, auth logic, public queries, admin routes, webhooks, uploads, components, and AI-generated code. Use when reviewing code that touches user data, PII, or access control, or before any deploy of an app with auth.
---

# Security Review Skill

Use this skill when reviewing Convex functions, auth logic, public query shapes, admin routes, webhooks, uploads, component boundaries, or any AI generated code that touches user data.

## When to use it

Reach for this skill when:

- a mutation writes user or admin data
- a public query returns package or user data
- an internal function should be separated from a public wrapper
- a form collects names, emails, or other contact info
- a webhook, upload, or API key flow is added
- AI generated code needs a security pass before shipping
- auth was just added to an app that already has public functions
- a Convex component is installed or authored
- an app with restricted sign-in is about to deploy

## The public-by-default trap

This is the failure mode that leaks entire databases. Learn it first.

- Every `query`, `mutation`, and `action` imported from `_generated/server` is callable by anyone with the deployment URL. No frontend, no session, no sign-in required. `curl` is enough.
- Sign-in gating is not authorization. Restricting who can create a session (`beforeSessionCreation`, domain-restricted OAuth, an email allowlist) controls sign-in only. It does nothing to the function API. An app can have perfect sign-in rules and still serve every table to an unauthenticated caller.
- Frontend gating is not authorization. `<Authenticated>` components, route guards, and login walls make the app look locked in a browser. The function API does not go through the browser. Never pass a review based on what the UI shows.
- Function names are discoverable. Assume an attacker can enumerate every public function and its argument shape. Security through obscure names is not security.
- Real incident for scale: an internal tool shipped with 232 public functions and 2 that referenced `ctx.auth`. An outside researcher pulled 28 collections of internal data with nothing but the URL. Every one of those functions had validators and indexes. Validators validate shape, not callers.

## Audit the full public surface

Do this on every review of an app with auth, not just when something looks sensitive.

1. List every public function: `rg -n "= (query|mutation|action)\(" convex/ --type ts` (exclude `internal*` builders).
2. Count how many enforce auth in the handler, directly via `ctx.auth.getUserIdentity()` or through an authed wrapper.
3. Every gap is a finding. A public function either enforces auth or carries an explicit comment saying it is intentionally public, with a trimmed return shape to match.
4. If the ratio is lopsided (hundreds public, a handful checking auth), stop and fix structurally before reviewing anything else.

## Auth and ownership checks

- Call `ctx.auth.getUserIdentity()` before authenticated writes.
- Never trust client supplied user ids for ownership.
- Prefer indexed ownership checks over fetch then compare patterns.
- Use `internalQuery`, `internalMutation`, and `internalAction` for sensitive backend work.
- Keep public wrappers thin. Do auth and access checks there, then call internal functions.
- Return generic `Not found` style errors when you should not reveal existence.
- Prefer enforcement by construction over per-function discipline. Create a `convex/access.ts` that exports `authedQuery`, `authedMutation`, and `authedAction` built with `customQuery`/`customMutation`/`customAction` from `convex-helpers/server/customFunctions`, each running a `requireUser` check before the handler. New functions import from `./access`, never from `_generated/server`, unless intentionally public. One structural decision beats hundreds of chances to forget.
- When retrofitting auth onto an existing app, codemod every file to the authed builders, then hand-review the short list of functions that should stay public. Do not audit function by function hoping to catch them all.
- If the app gates on email domain, check membership in the handler too, not just at session creation. A session created before a policy change, or through a normalization bug, outlives the sign-in check.

## Data exposure rules

- Public queries should return public safe shapes only.
- Strip PII like email, name, Discord handle, internal notes, AI review details, or admin metadata unless the caller is allowed to see them.
- Add explicit return validators on public functions so the response shape stays tight.
- Intentionally public queries must never return raw documents. Define an explicit projection validator and map to it, stripping owner ids, assignee lists, internal links, spend amounts, and system fields the public page does not render.
- Derive frontend types from the projection with `FunctionReturnType<typeof api.module.fn>` so the client cannot silently depend on fields you later strip.
- Mutations should return minimal data, usually ids or `null`, not the submitted object.
- Treat everything returned by a query as visible in browser DevTools and WebSocket traffic.

## Sensitive integrations

- Keep secrets in server side environment variables only.
- Validate webhook signatures before processing.
- Restrict CORS for sensitive endpoints.
- Validate upload types and file sizes server side.
- Do not send user PII into AI prompts when it is not required for the task.
- Use simple actor labels like `AI` or `System`, not fake email addresses, for automated actions.
- Run `npm audit` as part of the review. Auth libraries matter most: a known `@auth/core` issue allowed email normalization and homoglyph bypasses, which directly defeats email-domain gating. Upgrade `@convex-dev/auth` and `@auth/core` together and re-run the audit until clean.

## Component boundaries

Convex components are sandboxed, which changes where auth lives. Per the [authoring docs](https://docs.convex.dev/components/authoring):

- `ctx.auth` is not available inside a component. Authenticate in the app function first, then pass identifiers like `userId` into the component. Review every `ctx.runQuery`/`ctx.runMutation` into `components.*` and confirm the calling app function did the auth check before the call.
- Component functions are not exposed to clients. The app's own public functions wrap them, so the wrapper is where authorization must happen. A safe component behind an unguarded public wrapper is still a leak.
- Component HTTP actions have no `ctx.auth` and no app environment variables. If a component route needs to authenticate users, the handler belongs in the app's `convex/http.ts`, mounted from the component's client code.
- Component HTTP routes are only reachable when the app passes `httpPrefix` at install time in `convex.config.ts`. Review every `httpPrefix` as a deliberate expansion of the public HTTP surface and check what those routes serve.
- Components declare their own environment variables and cannot read the app's. When an app passes secrets to a component, confirm it passes only what the component needs.

## AI generated code checks

- Watch for missing `returns` validators.
- Watch for public `query` or `mutation` usage where `internal*` should be used.
- Watch for `ctx.db.get()` plus client supplied ids in ownership checks.
- Watch for full objects returned from public queries or mutations.
- Watch for vague or over detailed error messages that leak internal state.
- Watch for public functions with no auth reference at all. AI agents reliably add validators and indexes because the rules demand them, and reliably skip handler auth because nothing demands it. Assume every generated public function is open until you see the check.
- Watch for auth configured but never enforced: an `auth.config.ts`, a users table, a sign-in flow, and a backend that never asks. Wiring a provider is not the same as gating functions.
- Watch for scheduler and cron targets using `api.*` references where `internal.*` is required.

## Verification checklist

- Open the browser network panel and inspect WebSocket or XHR responses for sensitive fields.
- Hard refresh after deploying security changes so cached subscriptions do not fool the test.
- Verify public queries exclude PII and internal metadata.
- Verify admin queries require auth and admin checks before returning full data.
- Verify mutations return minimal data.
- Verify any new action or integration logs full errors only on the server side.
- Probe the deployed API unauthenticated, exactly as an attacker would. `curl` the deployment's query endpoint with no auth token for each gated function and confirm it throws an auth error instead of returning data:

```bash
curl -s "https://<deployment>.convex.cloud/api/query" \
  -H "Content-Type: application/json" \
  -d '{"path": "module:functionName", "args": {}, "format": "json"}'
```

- Pass type-correct arguments when probing. Argument validation runs before the handler, so a call with wrong args fails with `ArgumentValidationError` and never reaches the auth check. That result proves nothing about authorization.
- Probe the intentionally public functions too and confirm they return only the projected shape.
- Source review and black-box probing catch different halves. Do both. The deployed surface is the truth; code that looks gated but is not deployed yet, or an old deploy still serving open functions, only shows up in the probe.
