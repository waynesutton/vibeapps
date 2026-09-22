# AI judge reads human criteria, sees the live UI, and stays consistent through edits

Created: 2026-09-21 22:10 UTC
Last Updated: 2026-09-21 22:35 UTC
Status: Complete

## Problem

The AI judge only knew the built in six criteria plus admin typed custom criteria. The questions human judges score in the Criteria editor were invisible to it, so an event that asked humans "is the onboarding clear" got no AI signal on that question. Organizers also wanted the AI to see the live app UI, not just page text, and asked why agent judge keys exist next to the built in AI judge. Separately, the legacy edit modal saved only the six built in weights and would wipe any custom weight it did not know about.

## Solution

1. Live mirror of human criteria. A per group toggle `aiIncludeHumanCriteria` adds every `judgingCriteria` row to the AI rubric at run time under a stable key `human-<criteriaId>`. The question becomes the label; the description (or question) plus a note about the human scale becomes the rubric description. The AI scores it 1 to 10 like every other criterion. Human `weight` and `scoreScale` are untouched; the AI weight lives in `aiRubricWeights` under the same key.
2. Read time consistency. Human criteria are read fresh in `getSubmissionForAnalysis`, `getAiPromptConfig`, and both weight and custom criteria mutations, so an edit to a question flows through on the next run and weight validation never rejects a mirrored key. Deleting a criterion (single delete or bulk save) prunes its `human-<id>` weight and disabled flag from the group. Stored results keep the label and score from their run.
3. Live app screenshot. The existing Firecrawl scrape requests `formats: ["markdown", "screenshot"]`. The screenshot URL (https only) is attached to the model as a file part (`mediaType: "image"`) on the first attempt. The retry drops the image, so a bad image can never fail a review. `sourcesUsed.screenshot` records whether the image was used.
4. Prompt rules that a custom prompt cannot remove: `human-` criteria are judged from the same evidence a human would use; UI questions are never scored from Convex feature counts alone; a screenshot informs UI judgments only and never Convex facts; a missing screenshot never lowers a score.
5. Admin UI. Rubric weights lists mirrored rows tagged `human` with weight input and On/Off pill. Custom AI criteria gets a read only "Human judging criteria" block at the top with the toggle, each question and description, and the "Humans 1 to N, AI 1 to 10" note. The system prompt card shows what `{{rubric}}` expands to with `custom` and `human` tags. Preset Add buttons now count real custom criteria instead of `rubricDefs.length - 6`.
6. Legacy modal fix. `EditJudgingGroupModal` merges the group's stored non built in weights into the payload before saving, so custom and human weights survive.
7. Docs. AdminDocs explains human criteria in the AI rubric, the screenshot, the Convex AI gateway (no provider keys are read anymore), and the difference between the AI judge and agent judges.

## Files changed

- `convex/schema.ts`: `aiIncludeHumanCriteria` on `judgingGroups`, `sourcesUsed.screenshot` on `aiJudgeResults`, `by_criteriaId` index on `judgeScores`
- `convex/aiJudge.ts`: `HUMAN_CRITERION_PREFIX`, `humanCriterionKey`, `humanCriteriaToRubric`, `getRubricForGroup(group, humanCriteria)`, `getHumanCriteriaForGroup`, `updateAiIncludeHumanCriteria`, human keys in weight and custom validators, reserved prefix check, `source` on `getAiPromptConfig` rubric rows, human data on `getSubmissionForAnalysis`, `screenshot` on every `sourcesUsed` shape
- `convex/aiJudgeAnalysis.ts`: mirrored rubric, fixed prompt rules, Firecrawl screenshot, `LIVE APP SCREENSHOT` user section, image on first attempt only, `sourcesUsed.screenshot`
- `convex/lib/llm.ts`: optional `imageUrl` builds a multipart user message
- `convex/judgingCriteria.ts`: `pruneAiSettingsForDeletedCriteria` on delete and bulk save, `criterionHasScores` indexed delete guard replacing two `.filter` scans
- `convex/judgingGroups.ts`: `getGroupWithDetails` returns `aiIncludeHumanCriteria`
- `src/components/admin/judging/groupSection.tsx`: `HUMAN_CRITERION_PREFIX`, `humanCriterionKey` mirror
- `src/components/admin/judging/GroupAiSection.tsx`: human rows in Rubric weights, `HumanCriteriaMirrorBlock`, rubric preview with tags, custom count fix, card keys include the toggle and criteria ids
- `src/components/admin/EditJudgingGroupModal.tsx`: preserve non built in weights
- `src/components/admin/AdminDocs.tsx`: AI judge, Criteria and weights, Agent judges, Spam check, Environment variables sections

## Edge cases

- Toggle on with zero human criteria: rubric unchanged, block shows an empty state pointing to the Criteria section.
- Toggle off: stored `human-<id>` weights stay so flipping back restores them; validators only accept human keys while the toggle is on, so saving weights while off prunes them.
- Human criterion edited mid event: next run uses the new text; stored results keep the label from their run.
- Human criterion deleted: weights and disabled flags pruned, results keep history, `computeWeightedScore` defaults a missing weight to 1.
- Custom criterion key starting with `human-` is rejected.
- Firecrawl not configured, no screenshot, or a non https screenshot value: identical behavior to today.
- Image request fails or the model returns unparseable JSON with the image: retry runs text only.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit` and `npx tsc -p convex/tsconfig.json --noEmit`: zero errors. `npx convex dev --once` pushed to the dev deployment.
- Temporary internal mutation (deleted afterward) on a dev group with two human criteria: toggle off gives the six built in keys; toggle on gives eight with `human-<id>` keys, question labels, and the 1 to 5 scale note; a disabled human key is excluded while the other stays; deleting a criterion prunes only its weight and disabled flag; pruning to empty clears both fields.
- Real run of `aiJudgeAnalysis:analyzeSubmission` on an existing dev result with the mirror on: result completed with a `human-<id>` score for "is it cool", `sourcesUsed.screenshot: true`, no AI SDK deprecation warning after switching to the file part. Toggle restored to off afterward.

## Out of scope

- Human criterion weights. `judgingCriteria.weight` is stored (default 1) but no human ranking query in `judgeScores.ts` reads it; human results are plain sums and averages of the 1 to 5 or 1 to 10 scores. Decision for this event: keep human scoring unweighted, weights apply to the AI judge only. The admin docs were corrected to say so instead of adding a weight input that would do nothing.
- Whisper transcription for direct media files and caption less YouTube videos.
- The Browser Use component for interactive UI exploration.
