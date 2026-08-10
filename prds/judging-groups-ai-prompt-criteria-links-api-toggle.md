# Judging groups: custom AI criteria, editable system prompt, links ledger, agent API toggle, hackathon log reading, docs

Created: 2026-08-09 06:15 UTC
Last Updated: 2026-08-09 06:35 UTC
Status: Done

## Problem

The judging group workspace is missing several admin controls and visibility features:

1. The AI judge rubric is fixed in code. Admins cannot add their own criteria (for example an explicit "components check") that the AI judge reads and scores.
2. The AI judge system prompt is hardcoded in `convex/aiJudgeAnalysis.ts`. Admins cannot view, edit, paste, or reset it per group.
3. Shareable links for a group (judge page, results, submit page, AI results, agent API) are scattered across sections with no lock state indicators. Admins need one realtime links ledger per group.
4. Agent judge API keys cannot be turned off per group. Once a key exists the HTTP API stays open until every key is revoked.
5. The AI judge does not read hackathon tracking files (`hackathon.md`, `changelog.md`, `task.md`, `files.md`), agent skills folders, or the published `/hackathon.json` manifest described in the hackathon setup flow (hackathon-setup-v2.md), so private repo or no repo teams get less fair reviews.
6. Admin docs do not explain in detail how judging groups, access, and all these options connect.

## Proposed solution

### Schema (`convex/schema.ts`, judgingGroups table)

- `aiJudgeSystemPrompt: v.optional(v.string())` - custom prompt body; absent = built-in default.
- `aiCustomCriteria: v.optional(v.array(v.object({ key, label, description })))` - extra rubric criteria appended to the built-in six.
- `agentKeysEnabled: v.optional(v.boolean())` - absent/true = agent HTTP API on; false = key creation blocked and every keyed call gets 403.

### Backend

- `convex/aiJudge.ts`
  - Export `DEFAULT_AI_JUDGE_PROMPT_BODY` (current prompt text with a `{{rubric}}` placeholder; the JSON response contract is always appended by the analysis and is not editable).
  - `getRubricForGroup` helper: built-in rubric + group custom criteria.
  - `updateAiCustomCriteria` mutation (judging.ai): validates keys (unique, lowercase slug, no clash with built-in), prunes stale rubric weights.
  - `updateAiSystemPrompt` mutation (judging.ai): trims, caps length, empty/null resets to default.
  - `getAiPromptConfig` query (judging.ai): returns default body, custom body, and the effective rubric for the editor UI.
  - `updateAiRubricWeights`: validate keys against built-in + custom criteria.
  - `getSubmissionForAnalysis`: also return `aiJudgeSystemPrompt` and `aiCustomCriteria`.
- `convex/aiJudgeAnalysis.ts`
  - `buildSystemPrompt(customBody, rubric)`: substitute `{{rubric}}`, append rubric block if the placeholder is missing, always append the JSON contract generated from the effective rubric.
  - `parseAnalysisResponse(text, rubric)`: validate against the effective rubric.
  - Fetch project log files from the repo root (`hackathon.md`, `changelog.md`, `task.md`, `files.md`, case-insensitive) and list `.agents/skills/*/SKILL.md` paths; include as a PROJECT LOG FILES section (self-reported context, facts still win).
  - Fetch `{live origin}/hackathon.json` published manifest; include as PUBLISHED HACKATHON MANIFEST section (important for private/no repo teams).
- `convex/agentJudges.ts`
  - `updateAgentKeysEnabled` mutation (judging.ai).
  - `storeAgentKey`: refuse creation when the group has the agent API disabled.
  - `getAgentContext`: return null when the group agent API is disabled (403 upstream).
- `convex/judgingGroups.ts`
  - `getGroupWithDetails`: expose `agentKeysEnabled`, `aiCustomCriteria`, `hasResultsPassword`, `hasCustomAiPrompt`.

### Frontend

- `src/components/admin/judging/GroupAiSection.tsx`
  - Custom criteria card with a one-click "Add components check" preset plus free-form criteria (label + description, auto key).
  - Rubric weights card includes custom criteria rows.
  - System prompt card: textarea seeded with custom or default prompt, save, paste-over, and "Reset to default" button.
  - Agent keys card: "Agent API" on/off toggle; create key UI hidden while off.
- New `src/components/admin/judging/GroupLinksSection.tsx` + sidebar entry in `src/pages/AdminJudgingGroupPage.tsx`
  - Realtime ledger of every shareable link with lock icons for password protected pages, public/private/password/disabled status pills, copy and open actions, plus the agent API base URL with its enabled state.
- `src/components/admin/AdminDocs.tsx`
  - Expanded "Judging groups" section documenting the whole workspace, how access permissions scope each section, links and lock states, and the new AI prompt/criteria/agent API options. AI judge and agent judges sections updated for the new features.

## Files to change

- convex/schema.ts
- convex/aiJudge.ts
- convex/aiJudgeAnalysis.ts
- convex/agentJudges.ts
- convex/judgingGroups.ts
- src/components/admin/judging/GroupAiSection.tsx
- src/components/admin/judging/GroupLinksSection.tsx (new)
- src/components/admin/judging/groupSection.tsx
- src/pages/AdminJudgingGroupPage.tsx
- src/components/admin/AdminDocs.tsx
- TASK.MD, changelog.md, files.md

## Edge cases

- Custom prompt without `{{rubric}}`: rubric block is appended so scoring keys always reach the model.
- Custom criteria removed after weights were saved: stale weight keys are pruned on criteria save; weight reads default missing keys to 1.
- Existing groups have `agentKeysEnabled` undefined: treated as enabled (no behavior change).
- Agent API disabled with live keys: keys stay stored, calls 403, re-enabling restores them.
- Custom criteria keys must not collide with built-in keys (schema, functions, realtime, advanced, depth, liveness).
- Results rows in `aiJudgeResults` already store criteria as an array of {key,label,score,reasoning}, so custom criteria need no schema change there.
- hackathon.json manifest fetch failures are silent (section omitted).

## Verification steps

- `npx tsc --noEmit` (app) and `npx convex dev --once` typecheck/deploy pass.
- Lints clean on all touched files.
- Manual: AI section shows prompt editor with default text, reset button restores default; custom criteria appear in weights list; links section reflects password/public toggles in realtime; agent API toggle blocks key creation.

## Task completion log

- 2026-08-09 06:15 UTC - PRD created, exploration complete.
- 2026-08-09 06:20 UTC - Schema fields added (aiJudgeSystemPrompt, aiCustomCriteria, agentKeysEnabled); aiJudge.ts mutations/query (updateAiCustomCriteria, updateAiSystemPrompt, getAiPromptConfig, getRubricForGroup, DEFAULT_AI_JUDGE_PROMPT_BODY) with weight validation against the effective rubric.
- 2026-08-09 06:25 UTC - aiJudgeAnalysis.ts: dynamic buildSystemPrompt with {{rubric}} substitution and always-appended JSON contract, rubric-aware parseAnalysisResponse, repo log file fetching (hackathon/changelog/task/files .md), agent skill path detection, and /hackathon.json manifest fetch from the live origin.
- 2026-08-09 06:28 UTC - agentJudges.ts updateAgentKeysEnabled + enforcement in storeAgentKey and getAgentContext; http.ts 403 message covers the disabled state; getGroupWithDetails exposes aiCustomCriteria, hasCustomAiPrompt, agentKeysEnabled.
- 2026-08-09 06:32 UTC - UI: GroupAiSection custom criteria editor with components check preset, system prompt editor with reset to default, agent API toggle, weights include custom criteria; new GroupLinksSection links ledger with lock icons wired into the workspace sidebar; AdminDocs expanded (workspace sections table, links ledger, access gates, AI judge context sources, custom criteria, prompt editing, agent API toggle).
- 2026-08-09 06:35 UTC - Verified: convex codegen typecheck clean, app tsc clean for all touched files (remaining errors pre-existing), zero lints. Docs synced.
- 2026-08-09 06:50 UTC - Follow-up: per-criterion on/off toggles in Rubric weights (new aiDisabledCriteria field; getRubricForGroup filters disabled keys with a non-empty guarantee; updateAiRubricWeights accepts disabledKeys and blocks disabling everything; updateAiCustomCriteria prunes stale disabled keys). Components check preset moved from the Custom criteria card into the Rubric weights card as a toggle row that adds the criterion immediately. AdminDocs updated. Verified: codegen + tsc clean, zero lints.
- 2026-08-09 07:05 UTC - Follow-up: Copy all + markdown export on the links ledger. GroupLinksSection now builds link entries as data, renders rows from them, and offers a header "Copy all" button (copies the full list as markdown with access states) and a ".md" download button (saves slug-links.md). AdminDocs Links ledger section updated. Verified: tsc clean, zero lints.
