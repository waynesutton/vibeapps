# Judging group research chat

Created: 2026-10-02 06:45 UTC
Last Updated: 2026-10-02 07:05 UTC
Status: Completed

## Problem

Organizers pick winners by jumping between Results, AI results, Judge tracking, and every submission's repo, live app, video, and socials. Nothing answers cross cutting questions like "compare the human top 10 with the AI top 10" or "who should win overall and why" in one place, scoped to a single judging group.

## Proposed solution

A new **Research** section in each judging group workspace (`/admin/judging/:slug?section=research`).

- Off by default. An admin flips a toggle and the group is indexed into `researchDocs`: one Markdown dossier per submission (links, team, form answers, human scores and comments, notes, completion, AI judge scores, reasoning, repo and git facts, URL check, social proof, video transcript excerpt) plus overview and leaderboard docs (human, AI, combined).
- Indexing runs as a self scheduling internal mutation (`researchIndex.indexBatch`), 20 submissions per transaction, with live progress.
- A streaming chat (`researchAgent.respond`) uses AI SDK `streamText` with `convexGateway(model)` and tools:
  - `search_submissions` (full text search over dossiers)
  - `get_submissions` (live dossiers built from current data)
  - `get_leaderboard` (human, ai, combined)
  - `web_search` (Firecrawl component search, Context.dev fallback)
  - `read_url` (Firecrawl scrape, Context.dev fallback)
- Threads are shared across every admin with access to the group. Each answer has copy, download as Markdown, tool steps, sources, and model label. Whole threads export as Markdown.
- Model picker from a curated gateway allowlist (`convex/lib/researchModels.ts`) plus a Default option. Default resolves from optional `AI_RESEARCH_MODEL`, then `AI_JUDGE_MODEL`, then Claude Fable 5.
- Staleness: judge score, agent score, AI result, and membership mutations call `markResearchStale`, which flags the index so the UI offers a Refresh. Leaderboards and dossiers fetched by tools are always built live, so staleness only affects full text search.
- Rate limit: 40 questions per admin per hour, bursts of 15 (rate limiter component).

## Files to change

- `convex/schema.ts`: `researchEnabled`, `researchModel` on `judgingGroups`; new `researchIndexes`, `researchDocs`, `researchThreads`, `researchMessages` tables.
- `convex/convex.config.ts`: optional `AI_RESEARCH_MODEL` env.
- New `convex/lib/researchModels.ts`, `convex/lib/researchDossier.ts`.
- New `convex/researchIndex.ts`, `convex/research.ts`, `convex/researchAgent.ts`.
- Stale hooks: `convex/judgeScores.ts`, `convex/agentJudges.ts`, `convex/aiJudge.ts`, `convex/judgingGroupSubmissions.ts`. Admin score edits in `convex/adminJudgeTracking.ts` are not hooked (rare, and leaderboards are live).
- `convex/judgingGroups.ts` `deleteGroup`: research cleanup.
- `src/pages/AdminJudgingGroupPage.tsx`: Research sidebar section.
- New `src/components/admin/research/`: `GroupResearchSection.tsx`, `ResearchThreadList.tsx`, `ResearchChat.tsx`, `ResearchMessageView.tsx`, `researchExport.ts`.

## Edge cases

- Group with zero submissions: index completes with an overview only; chat still works.
- Toggle off while indexing: batches check `researchEnabled` and stop.
- Toggle off (confirm dialog): index docs deleted in batches; threads are kept and reappear when research is turned back on.
- Stop while streaming: `appendChunk` returns a stop flag, the action aborts the stream and keeps partial text.
- Action crash: message marked failed with an error, Retry regenerates.
- Unknown model id from the client: rejected server side.
- Web keys missing or provider errors: tool returns an error string, model continues.
- Large groups: digest roster capped; detail comes from tools.
- Permissions: requires `judging.results` and `judging.ai` (full admins bypass).
- Group delete: research rows removed with the group.

## Verification

- `npm run typecheck:convex`, `npm run typecheck`, `npm run lint`, `npx convex dev --once`.
- Toggle on, watch progress, ask comparison questions, verify links and scores match Results and AI results.
- Stop, Retry, copy, download, thread export, stale banner after a score change, toggle off.

## Task completion log

- 2026-10-02 06:45 UTC: PRD created.
- 2026-10-02 07:05 UTC: Shipped schema, indexer, public API, streaming agent, and UI. Typecheck, Convex typecheck, lint, and dev push pass. On dev: enable indexed 6 of 6 submissions, full text search and dossiers return expected content with no emails, refresh keeps docs, live combined leaderboard matches Results and AI results ranks. Live model answer still needs a signed in browser test.
