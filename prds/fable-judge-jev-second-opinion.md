# Fable as the AI judge, Jev as a second opinion and spam classifier

Created: 2026-09-22 05:45 UTC
Last Updated: 2026-09-22 06:45 UTC
Status: Done

## Problem

The AI judge and spam check both routed through one hardcoded gateway model id in `convex/lib/llm.ts` (`DEFAULT_LLM_MODEL`). Switching models meant a code change and redeploy. The Convex AI gateway now serves two models worth using here that the app could not reach:

- `anthropic/claude-fable-5`, a chat model that reads the screenshot, writes reasoning, and returns the JSON the judge already parses.
- `typesafe/jev-1.13`, a decisions model on `POST /alpha/decisions` that answers choice, score, and boolean questions with probability distributions and no prose.

Judges got one number per criterion with no signal for how sure the model was. Spam verdicts came back as a JSON `confidence` the chat model made up, which is what the auto mark threshold gates on.

## Proposed solution

Keep one judge and one written review per submission (Fable). Add Jev where a calibrated distribution is worth more than prose.

1. `AI_JUDGE_MODEL` typed env var picks the chat model at run time, Fable as the fallback. No redeploy to switch.
2. Per group toggle `aiSecondOpinionEnabled` (same shape as `aiIncludeHumanCriteria`). When on, after Fable's JSON parses, Jev scores the same rubric from a text only, truncated copy of the prompt state and the result is stored as `secondOpinion`. Advisory only: it never changes Fable's scores, the total, or the ranking. Jev failing never fails the review.
3. Site wide spam setting `jevClassifierEnabled` (default off). When on, Jev answers one choice question (spam, suspicious, clean) plus five boolean flags that become the reasons list. `confidence` is the probability Jev assigned to the chosen verdict, so the auto mark threshold gates on a real number. Falls back to the chat model, then the heuristic, on any error.

## Why Jev is not the primary judge

Jev cannot take images, has a 32k token window, and returns no prose. The judge needs the screenshot, the full repo context, and written reasoning per criterion. Fable does all three. Jev adds a second, differently shaped signal that flags where a human should look.

## Files changed

- `package.json`, `package-lock.json`: `ai` and `@convex-dev/ai-sdk-provider` bumped so `experimental_evaluate` and `convexGateway.evaluationModel` exist.
- `convex/convex.config.ts`: `AI_JUDGE_MODEL: v.optional(v.string())` typed env.
- `convex/lib/llm.ts`: `FALLBACK_LLM_MODEL`, `JEV_MODEL`, `resolveLlmModel`, `providerOf`, `evaluateRubric`, `classifySpam`, `peakProbability`, `rubricLevels`.
- `convex/schema.ts`: `judgingGroups.aiSecondOpinionEnabled`, `aiJudgeResults.secondOpinion`.
- `convex/aiJudge.ts`: `updateAiSecondOpinionEnabled` mutation, flag on `getSubmissionForAnalysis`, `secondOpinion` through `saveResult`, `aiResultValidator`, `enrichResults`.
- `convex/judgingGroups.ts`: `getGroupDetails` returns `aiSecondOpinionEnabled`.
- `convex/aiJudgeAnalysis.ts`: `buildSecondOpinionState`, gated Jev pass after Fable parse inside try/catch.
- `convex/spamCheck.ts`: `spamJevClassifierEnabled` appSettings key, `getSpamAnalysisConfigInternal` replaces `getSpamPromptInternal`.
- `convex/spamCheckAnalysis.ts`: Jev first path with chat then heuristic fallback.
- `src/components/admin/judging/GroupAiSection.tsx`: `SecondOpinionBlock` toggle.
- `src/components/admin/AIJudgeResults.tsx`: `SecondOpinionScore` next to each criterion, disagreement flag at a 2.5 point gap.
- `src/components/admin/SpamCheck.tsx`: "Use Jev for the verdict" automation toggle.
- `src/components/admin/AdminDocs.tsx`: model switching, second opinion, Jev spam classifier.

## Edge cases

- Jev state over 32k tokens: the repo files section is truncated to `JEV_STATE_MAX_CHARS` and `secondOpinion.truncated` records it so the UI can hint at it.
- Screenshot note in the Jev state is rewritten to say no image was attached, so Jev is never told to judge a UI it cannot see.
- Jev returns no distribution: rubric confidence is omitted; spam confidence is reported as 50 so the auto mark threshold does not fire on a fake certainty.
- Jev returns a clean verdict with no flags: reasons list gets "No spam flags raised" so the row is not blank.
- Rubric key of any shape: Jev question ids are positional (`q0`, `q1`, ...) and mapped back to keys.
- Toggle off after results exist: stored `secondOpinion` stays on old rows; new runs skip Jev.

## Verification

- App `tsc -b` and convex `tsc` zero errors; eslint zero errors on touched files (pre-existing warnings only).
- `npx convex dev --once` deployed to acoustic-goldfinch-461.
- Temp internal action (deleted after) called all three gateway paths live:
  - `evaluateRubric` on a two criterion rubric returned `typesafe/jev-1.13` scores 5.7 and 5.5 with confidence 0.89 each.
  - `classifySpam` on a clean state returned `clean` at 99 with probabilities `{clean: 0.99, suspicious: 0.01, spam: 0}` and no flags.
  - `classifySpam` on a casino keyword state with a parked URL and 404 repo returned `spam` at 100 and all five flags.
  - `callLlm` to `anthropic/claude-fable-5` returned text. Note: Fable spends output tokens on reasoning before visible text, so a 5 token budget returned empty; real callers use 512+.

## Task completion log

- 2026-09-22 05:50 UTC - Packages bumped, `AI_JUDGE_MODEL` env, `evaluateRubric` and `classifySpam` helpers.
- 2026-09-22 06:05 UTC - Schema, aiJudge backend, analysis Jev pass, admin toggle and results column.
- 2026-09-22 06:20 UTC - Spam classifier setting, Jev path with fallbacks, SpamCheck toggle, AdminDocs.
- 2026-09-22 06:40 UTC - Typecheck, lint, dev deploy, live gateway smoke test on all three paths. Temp action removed.
