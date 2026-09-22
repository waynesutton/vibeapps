# AI judge sponsor stack detection and AgentMail component fix

Created: 2026-09-22 05:40 UTC
Last Updated: 2026-09-22 05:58 UTC
Status: Done

## Problem

Two related gaps in the AI judge repo scanner, both visible the moment an All Gas Hackathon submission uses AgentMail.

1. AgentMail as a Convex component was mis-named. `COMMUNITY_COMPONENT_PACKAGES` in `convex/aiJudgeAnalysis.ts` mapped Firecrawl, Exa, Context.dev, Browser Use, and agent-ready, but not `@agentmail/convex`. The package is not under `@convex-dev/*`, so `canonicalComponentName` returned null for the package.json path, and `nameFromConfigImport` fell through to the raw string `"@agentmail/convex"` because the last import segment is `convex`, not `*-convex`. Meanwhile `extractComponentsUsed` recorded `components.agentmail` as `"agentmail"`, and the normalizer could not match `agentmailconvex` to `agentmail`.

   The prompt then said AgentMail was both "Used in code: agentmail" and "Installed but not referenced: @agentmail/convex", both labeled authoritative. The hackathon.md cross-check also lowercased `componentsInstalled` and looked for the claimed name, so `components: agentmail` in a team's log raised a false "not found in the repo scan" discrepancy.

2. Sponsor usage outside a component was invisible. The hackathon's Sponsor stack criterion asks whether OpenAI, Firecrawl, and AgentMail "do real work in your product." The scanner only saw sponsors shipped as Convex components. A team calling the `agentmail` or `firecrawl` npm SDK, or hitting the REST API with an API key from `process.env`, produced zero signal. OpenAI has no component at all, so it was never counted. Organizers also asked to see when a team used a model provider other than OpenAI; `detectAiModelEvidence` collected model id literals but only knew `gpt-`, `o1` to `o9`, `chatgpt-`, `claude-`, and `text-embedding-`, and never named a provider.

## Root cause

- Community component packages need an explicit map entry because the scanner cannot infer a canonical name from an arbitrary npm scope. AgentMail shipped its component after the map was last updated.
- The scanner was designed around Convex facts (schema, functions, components). Sponsor SDKs and API keys are not Convex facts, so nothing collected them.

## Solution

### Part A: component name resolution

- Added `"@agentmail/convex": "agentmail"` to `COMMUNITY_COMPONENT_PACKAGES`. Both `canonicalComponentName` (package.json) and `nameFromConfigImport` (convex.config.ts import) read this map, so one entry fixes both paths and `extractComponentsUsed` pairs `components.agentmail` with the installed name.
- `nameFromConfigImport` now resolves `@scope/convex` imports to the scope name, so future `@sponsor/convex` packages work without a map edit.

### Part B: sponsor stack and model provider evidence

Recorded-only facts, modeled on `detectAiModelEvidence`. The rubric stays "Best Use of Convex"; the sponsor stack is a human criterion. The facts exist so the model can reference them in reasoning and judges can see them at a glance.

New `detectSponsorStack(manifestRaws, fileContentsByPath, componentsUsed, aiModel)` in `convex/aiJudgeAnalysis.ts` returns one `SponsorEvidence` per sponsor with at least one signal:

| Sponsor | component | sdk | api_key | http | gateway |
| --- | --- | --- | --- | --- | --- |
| AgentMail | `components.agentmail` used | `agentmail` dep or import | `AGENTMAIL_API_KEY` in convex/ source | `api.agentmail.to` or `.eu` | |
| Firecrawl | `components.firecrawl` used | `firecrawl` or `@mendable/firecrawl-js` dep or import | `FIRECRAWL_API_KEY` | `api.firecrawl.dev` | |
| OpenAI | | `openai` or `@ai-sdk/openai` dep or import | `OPENAI_API_KEY` | `api.openai.com` | `convexGateway` used with an `openai/` or `gpt-` family model id |

Deps come from every fetched manifest (root plus workspace package.json files), code signals from fetched `convex/` source after `stripComments`, `_generated` excluded. The `firecrawl` npm SDK stays out of `componentsInstalled` (it is not a component), so a team on the raw SDK gets sponsor credit but not component credit.

`detectAiModelEvidence` gained a `manifestRaws` argument and returns `modelProvidersDetected` from three sources: provider SDK deps (`@anthropic-ai/sdk`, `@google/genai`, `@mistralai/mistralai`, `groq-sdk`, `@ai-sdk/*`, `@openrouter/ai-sdk-provider`, `openai`), API key env vars referenced in code (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`), and model ids (gateway `provider/model` first segment, or bare id families: `claude-` Anthropic, `gemini-` Google, `mistral-` `mixtral-` `codestral-` Mistral, `grok-` xAI, `llama-` Meta, `deepseek-` DeepSeek). `looksLikeModelId` was widened to those families, so `gemini-` and `grok-` literals are no longer dropped.

### Prompt

- New `SPONSOR STACK EVIDENCE` section after `AI MODEL EVIDENCE` when the repo was fetched. Every sponsor is listed yes or no with the matched signals, so the model can never infer usage that was not measured.
- `AI MODEL EVIDENCE` gained a "Model providers referenced" line.
- A fixed rule in `buildSystemPrompt` (not part of the editable body, so custom prompts cannot remove it) tells the model to name what these sections show in `overallReasoning`, never claim an integration they do not show, and never move any rubric score because of sponsor usage.

### Storage and API

Mirrors `usesAiGateway` and `aiModelIdsDetected`:

- `convex/schema.ts` `aiJudgeResults`: `modelProvidersDetected` (array of strings) and `sponsorStack` (array of `{ sponsor, via[], evidence }`). Both optional. An empty array means the repo was scanned and nothing was found; `undefined` means the repo was not fetched.
- `convex/aiJudge.ts`: exported `sponsorEvidenceValidator`; both fields added to `aiResultValidator`, the enriched result mapping used by the public and validated results queries, `getGroupAiReportData`, and `saveResult`.
- `convex/aiJudgeAnalysis.ts`: `RepoContext` carries both, `analyzeSubmission` passes them to `saveResult`.

### UI

- `src/components/admin/AIJudgeResults.tsx`: green chips per sponsor (`AgentMail (component, API key)`) with the evidence in the tooltip, plus a neutral `models: Anthropic, OpenAI` chip, in the card header row and the compare view. Markdown export adds `Sponsor stack` and `Model providers` lines to the per-submission brief and the Convex team recap; the recap overview and stats table gain cohort counts. Stats tab gains a "Sponsor stack" card and the AI Gateway card's subtitle lists model providers.
- `src/pages/AIJudgeResultsPage.tsx`: same chips beside the auth and AI Gateway chips.

## Files changed

- `convex/aiJudgeAnalysis.ts`
- `convex/aiJudge.ts`
- `convex/schema.ts`
- `src/components/admin/AIJudgeResults.tsx`
- `src/pages/AIJudgeResultsPage.tsx`
- `prds/ai-judge-sponsor-stack-detection.md`
- `changelog.md`, `files.md`, `TASK.MD`

## Edge cases

- Comments: `process.env.OPENAI_API_KEY` in a `//` comment does not count; source is stripped first.
- `_generated` files are excluded so the generated `components` object never registers as usage.
- Monorepos: workspace manifests that contain a `convex/` directory are already fetched; deps are collected across all of them.
- SDK import without a manifest hit (manifest outside the fetched set) still registers `sdk` from the `from "agentmail"` import.
- Previously analyzed rows keep `@agentmail/convex` in `componentsDetected` until re-run; results are recomputed per run, so no migration.
- Groups with a custom prompt body get the new sponsor rule automatically because it is appended in `buildSystemPrompt`, not in the editable body.

## Verification

- `npm run typecheck` (app, `tsc -b`) and `npm run typecheck:convex`: zero errors.
- `eslint` on the five touched files: zero errors (one pre-existing unused-variable warning in `AIJudgeResultsPage.tsx`).
- `npx convex dev --once`: schema deployed to dev.
- Temporary `internalQuery` (deleted afterward) ran `detectAiModelEvidence` and `detectSponsorStack` against three synthetic repos:
  - A: `@agentmail/convex` + `components.agentmail`, `firecrawl` dep, `convexGateway("openai/gpt-5")`, `ANTHROPIC_API_KEY`, `model: "gemini-2.5-pro"`, and `OPENAI_API_KEY` inside a comment. Result: AgentMail via component, Firecrawl via sdk, OpenAI via gateway only (the comment was ignored), providers Anthropic, Google, OpenAI, `usesAiGateway: true`.
  - B: `agentmail` and `openai` deps, `from "agentmail"`, `AGENTMAIL_API_KEY`, `fetch("https://api.agentmail.to/...")`, `model: "gpt-4o"`. Result: AgentMail via sdk, api_key, http; OpenAI via sdk; provider OpenAI; no components.
  - C: only `@mistralai/mistralai`. Result: no sponsors, provider Mistral.

## Task completion log

- 2026-09-22 05:41 UTC: map entry and `@scope/convex` fallback
- 2026-09-22 05:47 UTC: detectors, RepoContext, prompt section, fixed rule, saveResult wiring
- 2026-09-22 05:50 UTC: schema and aiJudge.ts plumbing; convex typecheck clean
- 2026-09-22 05:53 UTC: admin and public UI chips, exports, stats
- 2026-09-22 05:54 UTC: typecheck, lint, dev deploy, synthetic harness run and removed
- 2026-09-22 05:58 UTC: docs synced
