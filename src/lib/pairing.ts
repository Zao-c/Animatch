import { makePairKey } from "./pair-key";

export interface ScoreItem {
  animeId: string;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
  tier?: string;
  rank?: number;
  isHidden?: boolean;
}

export interface PairPriorityParams {
  a: ScoreItem;
  b: ScoreItem;
  hasCompared: boolean;
  isRecentPair: boolean;
}

export interface PickedPair {
  leftAnimeId: string;
  rightAnimeId: string;
  reason: string;
}

interface CandidatePair extends PickedPair {
  priority: number;
}

export function getPairPriority(params: PairPriorityParams): number {
  validateScoreItem(params.a);
  validateScoreItem(params.b);

  if (params.a.animeId === params.b.animeId) {
    return Number.NEGATIVE_INFINITY;
  }

  if (params.a.isHidden === true || params.b.isHidden === true) {
    return Number.NEGATIVE_INFINITY;
  }

  if (params.isRecentPair) {
    return Number.NEGATIVE_INFINITY;
  }

  const eloDiff = Math.abs(params.a.eloScore - params.b.eloScore);
  const avgUncertainty = (params.a.uncertainty + params.b.uncertainty) / 2;
  const avgCompareCount = (params.a.compareCount + params.b.compareCount) / 2;
  const sameTierBonus =
    params.a.tier !== undefined && params.a.tier === params.b.tier ? 60 : 0;
  const rankDistance =
    params.a.rank !== undefined && params.b.rank !== undefined
      ? Math.abs(params.a.rank - params.b.rank)
      : undefined;
  const adjacentRankBonus =
    rankDistance === undefined ? 0 : Math.max(0, 40 - rankDistance * 10);

  return (
    Math.max(0, 400 - eloDiff) +
    avgUncertainty * 0.4 +
    Math.max(0, 80 - avgCompareCount * 4) +
    (params.hasCompared ? 0 : 120) +
    sameTierBonus +
    adjacentRankBonus
  );
}

export function pickNextPair(
  scores: ScoreItem[],
  comparedPairKeys: ReadonlySet<string>,
  recentPairKeys: ReadonlySet<string>
): PickedPair | null {
  if (scores.length < 2) {
    return null;
  }

  const candidates: CandidatePair[] = [];

  for (let leftIndex = 0; leftIndex < scores.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < scores.length; rightIndex += 1) {
      const a = scores[leftIndex];
      const b = scores[rightIndex];
      const pairKey = makePairKey(a.animeId, b.animeId);
      const priority = getPairPriority({
        a,
        b,
        hasCompared: comparedPairKeys.has(pairKey),
        isRecentPair: recentPairKeys.has(pairKey)
      });

      if (priority > Number.NEGATIVE_INFINITY) {
        candidates.push({
          leftAnimeId: a.animeId,
          rightAnimeId: b.animeId,
          priority,
          reason: describePairReason(a, b, comparedPairKeys.has(pairKey), priority)
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const topCandidates = candidates
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        makePairKey(a.leftAnimeId, a.rightAnimeId).localeCompare(
          makePairKey(b.leftAnimeId, b.rightAnimeId)
        )
    )
    .slice(0, 20);
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return {
    leftAnimeId: selected.leftAnimeId,
    rightAnimeId: selected.rightAnimeId,
    reason: selected.reason
  };
}

function describePairReason(
  a: ScoreItem,
  b: ScoreItem,
  hasCompared: boolean,
  priority: number
): string {
  const reasons = [
    `priority=${priority.toFixed(2)}`,
    `eloDiff=${Math.abs(a.eloScore - b.eloScore).toFixed(2)}`,
    hasCompared ? "repeat-pair" : "new-pair"
  ];

  if (a.tier !== undefined && a.tier === b.tier) {
    reasons.push(`same-tier=${a.tier}`);
  }

  return reasons.join("; ");
}

function validateScoreItem(score: ScoreItem): void {
  if (!score.animeId.trim()) {
    throw new Error("animeId is required");
  }

  assertFiniteNumber(score.eloScore, "eloScore");
  assertFiniteNumber(score.uncertainty, "uncertainty");
  assertFiniteNumber(score.compareCount, "compareCount");
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}
