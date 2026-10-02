# Research chat: rules, rubric, and organizer context

Created: 2026-10-02 07:22 UTC
Last Updated: 2026-10-02 07:26 UTC
Status: Done

## Problem

The judging research chat knows every submission, score, and AI result, but not the rules of the event. Its group overview carries the name, description, dates, counts, score scale, and human criteria with descriptions cut to 200 characters. It never sees the AI judge rubric (built in, custom, mirrored, disabled criteria, weights), the AI judge prompt, the submit page copy and links, the How to judge organizer notes, the custom question definitions, judges per submission, or shortlist settings. There is no dedicated rules field, so rules written outside VibeApps (Luma, Devpost, Notion) never reach it either.

## Root cause

`buildOverviewDoc` in `convex/lib/researchDossier.ts` only reads a handful of `judgingGroups` fields and clips criterion descriptions. Nothing else about how the group is judged is passed to the model.

## Proposed solution

- New `buildRulesDoc(gc)` in `convex/lib/researchDossier.ts`, a "Rules and rubric" document built live from the group:
  - Organizer rules and context: a new optional `judgingGroups.researchContext` (Markdown, 20k cap) admins paste in the Research section. Also the deprecated `hackathonRules` when present.
  - Submit page title, description, and links.
  - How to judge: public page URL when on, judging deadline, judges per submission, contact, assignments, private repo note, notes, links. Never the access code note.
  - Judge queue mode and below the cut visibility.
  - Human criteria with full descriptions, weights, and scale.
  - AI judge rubric from `getRubricForGroup` (same source as the analysis), each with its weight, plus disabled criteria, frontend platform weights, second opinion, AI review visible to judges, agent scores advisory, and whether the system prompt is custom (custom body included, clipped).
  - Custom submission questions with type, required, and options.
- System prompt includes the rules doc on every turn (live). Overview drops its clipped criteria list in favor of it.
- Indexer writes it as a `rules` research doc so it is searchable.
- `research.setContext` mutation (same permissions, trims, caps, idempotent, marks the index stale, logs activity). `getStatus` returns the context.
- UI: "Rules and context" textarea in the Research settings card with character count and Save.

## Files to change

- `convex/schema.ts`: `researchContext` on `judgingGroups`; `rules` kind on `researchDocs`.
- `convex/lib/researchDossier.ts`: `buildRulesDoc`, overview trim.
- `convex/researchIndex.ts`: write the rules doc in `finalizeIndex`.
- `convex/researchAgent.ts`: rules in `loadRunContext` and the system prompt.
- `convex/research.ts`: `setContext`, context in `getStatus`.
- `src/components/admin/research/GroupResearchSection.tsx`: context editor.

## Edge cases

- Group with no criteria, no AI judge, or no submit page copy: sections are omitted, never empty headings.
- AI judge off: rubric section says so in one line.
- Every AI criterion disabled: `getRubricForGroup` falls back to the full list, matching the analysis.
- Context over 20k characters: rejected with a readable `ConvexError`.
- Saving unchanged context: early return, no log entry.
- Passwords and access codes never included.

## Verification

- `npm run typecheck:convex`, `npm run typecheck`, `npm run lint`, `npx convex dev --once`.
- On dev: save context, refresh the index, and search for the `rules` doc.

## Task completion log

- 2026-10-02 07:22 UTC: PRD created.
- 2026-10-02 07:26 UTC: Implemented. Typecheck, lint (0 errors), and `convex dev --once` pass. On the dev group the rules doc indexed with the saved context, submit page, judging setup, criteria, and the full AI rubric, and ranked first for a rules search. Test context cleared afterward.
