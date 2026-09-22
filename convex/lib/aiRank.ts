import type { Doc, Id } from "../_generated/dataModel";

/**
 * Single source of truth for how AI judge results are scored and ranked.
 *
 * Used by the admin AI results view, the public AI results page, the
 * shortlist helpers, and the judge interface badges, so every surface shows
 * the same rank for the same submission. Nothing here is stored: weights and
 * admin score edits both stay consistent because every read recomputes.
 */

// Frontend checker: preset custom criterion key. The detected hosting
// platform's weight multiplies this criterion's weight only.
export const FRONTEND_CHECKER_KEY = "frontend-checker";

type Weight = { key: string; weight: number };

// Weighted score derived from stored criteriaScores plus the group's current
// aiRubricWeights (default weight 1 per key, so it equals totalScore when no
// weights are set).
export function computeWeightedScore(
  criteriaScores: Array<{ key: string; score: number }> | undefined,
  weights: Array<Weight> | undefined,
  frontend?: {
    platform?: string;
    platformWeights?: Array<Weight>;
  },
): number | undefined {
  if (!criteriaScores || criteriaScores.length === 0) return undefined;
  const weightByKey = new Map((weights ?? []).map((w) => [w.key, w.weight]));
  const platformWeight = frontend?.platform
    ? ((frontend.platformWeights ?? []).find((w) => w.key === frontend.platform)
        ?.weight ?? 1)
    : 1;
  const total = criteriaScores.reduce((sum, cs) => {
    const base = weightByKey.get(cs.key) ?? 1;
    const multiplier =
      cs.key === FRONTEND_CHECKER_KEY ? base * platformWeight : base;
    return sum + cs.score * multiplier;
  }, 0);
  return Math.round(total * 100) / 100;
}

// Minimal shape the comparator needs. Callers map their own richer rows
// onto this so the tiebreak order lives in exactly one place.
export type AiRankable = {
  weightedScore?: number;
  totalScore?: number;
  componentsUsed?: Array<string>;
  criteriaScores?: Array<{ key: string; score: number }>;
  _creationTime: number;
};

// Higher weighted score first (totalScore when weights are absent), then
// more components used, then a higher depth criterion, then the earliest
// submission. Deterministic so ranks never shuffle between reads.
export function compareAiResults(a: AiRankable, b: AiRankable): number {
  const scoreDiff =
    (b.weightedScore ?? b.totalScore ?? -1) -
    (a.weightedScore ?? a.totalScore ?? -1);
  if (scoreDiff !== 0) return scoreDiff;
  const componentDiff =
    (b.componentsUsed?.length ?? 0) - (a.componentsUsed?.length ?? 0);
  if (componentDiff !== 0) return componentDiff;
  const depthDiff = depthScore(b) - depthScore(a);
  if (depthDiff !== 0) return depthDiff;
  return a._creationTime - b._creationTime;
}

function depthScore(r: AiRankable): number {
  return r.criteriaScores?.find((cs) => cs.key === "depth")?.score ?? 0;
}

export type AiRankEntry = {
  rank: number; // 1 based position among completed results
  total: number; // How many completed results were ranked
  averageScore?: number; // Mean of criterion scores, 1 to 10
  weightedScore?: number; // Score the rank is based on
};

/**
 * Rank every completed AI result for a group. Rows that are not completed
 * or have no scores are skipped. Pass only rows whose story is still valid
 * for judging so the total matches what admins see in AI results.
 */
export function rankCompletedAiResults(
  rows: Array<Doc<"aiJudgeResults">>,
  group:
    | Pick<Doc<"judgingGroups">, "aiRubricWeights" | "aiFrontendWeights">
    | null
    | undefined,
): Map<Id<"stories">, AiRankEntry> {
  const scored = rows
    .filter((row) => row.status === "completed" && row.criteriaScores)
    .map((row) => ({
      storyId: row.storyId,
      averageScore: row.averageScore,
      totalScore: row.totalScore,
      componentsUsed: row.componentsUsed,
      criteriaScores: row.criteriaScores,
      _creationTime: row._creationTime,
      weightedScore: computeWeightedScore(
        row.criteriaScores,
        group?.aiRubricWeights,
        {
          platform: row.frontendHosting?.platform,
          platformWeights: group?.aiFrontendWeights,
        },
      ),
    }))
    .sort(compareAiResults);

  const byStory = new Map<Id<"stories">, AiRankEntry>();
  scored.forEach((row, index) => {
    byStory.set(row.storyId, {
      rank: index + 1,
      total: scored.length,
      averageScore: row.averageScore,
      weightedScore: row.weightedScore,
    });
  });
  return byStory;
}
