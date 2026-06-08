import { makePairKey } from "./pair-key";
import { calculateRankingConfidence } from "./tier";

export type RecalibrationType = "SMART" | "RANGE" | "FOCUS";

export interface RecalibrationScore {
  animeId: string;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
  tier: string;
  rank: number;
  isHidden?: boolean;
}

export interface RecalibrationPair {
  leftAnimeId: string;
  rightAnimeId: string;
  priority: number;
  reason: string;
}

export interface RecalibrationNeed {
  confidenceScore: number;
  suggestedCount: number;
  unstableCount: number;
  lowDataCount: number;
}

const TIER_ORDER = ["S", "A", "B", "C", "D"];

export function buildRecalibrationQueue(params: {
  scores: RecalibrationScore[];
  comparedPairKeys: Set<string>;
  recentPairKeys: Set<string>;
  limit: number;
  type?: RecalibrationType;
  targetTier?: string;
  targetAnimeIds?: string[];
}): RecalibrationPair[] {
  const type = params.type ?? "SMART";
  const targetIds = new Set(params.targetAnimeIds ?? []);
  const candidates = filterScoresForType(params.scores, type, params.targetTier, targetIds)
    .filter((score) => score.isHidden !== true)
    .sort((a, b) => a.rank - b.rank);
  const pairs: RecalibrationPair[] = [];

  for (let leftIndex = 0; leftIndex < candidates.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      const pairKey = makePairKey(left.animeId, right.animeId);

      if (params.recentPairKeys.has(pairKey)) {
        continue;
      }

      if (type === "FOCUS" && !targetIds.has(left.animeId) && !targetIds.has(right.animeId)) {
        continue;
      }

      const priority = getRecalibrationPriority({
        left,
        right,
        hasCompared: params.comparedPairKeys.has(pairKey),
        isFocus: targetIds.has(left.animeId) || targetIds.has(right.animeId)
      });

      pairs.push({
        leftAnimeId: left.animeId,
        rightAnimeId: right.animeId,
        priority,
        reason: getRecalibrationReason(left, right, params.comparedPairKeys.has(pairKey), type)
      });
    }
  }

  return pairs
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        makePairKey(a.leftAnimeId, a.rightAnimeId).localeCompare(
          makePairKey(b.leftAnimeId, b.rightAnimeId)
        )
    )
    .slice(0, Math.max(0, Math.trunc(params.limit)));
}

export function getRecalibrationReason(
  left: RecalibrationScore,
  right: RecalibrationScore,
  hasCompared: boolean,
  type: RecalibrationType = "SMART"
): string {
  const eloDiff = Math.abs(left.eloScore - right.eloScore).toFixed(1);

  if (!hasCompared) {
    return `你还没直接比较过这两部，它们目前只差 ${eloDiff} 分。`;
  }

  if (type === "RANGE" && left.tier !== right.tier) {
    return `这是 ${left.tier}/${right.tier} 边界附近的关键对决。`;
  }

  if (left.compareCount < 5 || right.compareCount < 5) {
    return "这部作品比较次数较少，排名信心不足。";
  }

  return `它们目前 Elo 接近，只差 ${eloDiff} 分，适合继续校准。`;
}

export function estimateRecalibrationNeed(scores: RecalibrationScore[]): RecalibrationNeed {
  if (scores.length === 0) {
    return {
      confidenceScore: 0,
      suggestedCount: 0,
      unstableCount: 0,
      lowDataCount: 0
    };
  }

  const confidenceScore = calculateRankingConfidence(scores);
  const lowDataCount = scores.filter(
    (score) => score.compareCount < 5 || score.uncertainty > 250
  ).length;
  const sorted = [...scores].sort((a, b) => b.eloScore - a.eloScore);
  const unstableCount = sorted
    .slice(1)
    .filter((score, index) => Math.abs(sorted[index].eloScore - score.eloScore) < 25).length;
  const suggestedCount = Math.min(50, Math.max(0, lowDataCount * 2 + unstableCount));

  return {
    confidenceScore,
    suggestedCount,
    unstableCount,
    lowDataCount
  };
}

function filterScoresForType(
  scores: RecalibrationScore[],
  type: RecalibrationType,
  targetTier: string | undefined,
  targetIds: Set<string>
): RecalibrationScore[] {
  if (type === "FOCUS" && targetIds.size > 0) {
    return scores.filter((score) => {
      if (targetIds.has(score.animeId)) {
        return true;
      }

      return scores.some(
        (target) =>
          targetIds.has(target.animeId) &&
          (target.tier === score.tier ||
            Math.abs(target.rank - score.rank) <= 2 ||
            Math.abs(target.eloScore - score.eloScore) <= 80)
      );
    });
  }

  if (type === "RANGE" && targetTier !== undefined) {
    const targetIndex = TIER_ORDER.indexOf(targetTier);
    const allowedTiers = new Set(
      targetIndex < 0
        ? [targetTier]
        : [
            TIER_ORDER[targetIndex - 1],
            TIER_ORDER[targetIndex],
            TIER_ORDER[targetIndex + 1]
          ].filter((tier): tier is string => typeof tier === "string")
    );

    return scores.filter((score) => allowedTiers.has(score.tier));
  }

  return scores;
}

function getRecalibrationPriority(input: {
  left: RecalibrationScore;
  right: RecalibrationScore;
  hasCompared: boolean;
  isFocus: boolean;
}): number {
  const eloDiff = Math.abs(input.left.eloScore - input.right.eloScore);
  const avgUncertainty = (input.left.uncertainty + input.right.uncertainty) / 2;
  const avgCompareCount = (input.left.compareCount + input.right.compareCount) / 2;
  const sameTierBonus = input.left.tier === input.right.tier ? 60 : 0;
  const rankDistance = Math.abs(input.left.rank - input.right.rank);

  return (
    Math.max(0, 400 - eloDiff) +
    avgUncertainty * 0.35 +
    Math.max(0, 80 - avgCompareCount * 4) +
    (input.hasCompared ? 0 : 140) +
    sameTierBonus +
    Math.max(0, 50 - rankDistance * 8) +
    (input.isFocus ? 120 : 0)
  );
}
