export type Tier = "S" | "A" | "B" | "C" | "D";

export interface TierScore {
  animeId: string;
  eloScore: number;
  manualTier?: string | null;
  manualRank?: number | null;
  manualLocked?: boolean;
  compareCount?: number;
  uncertainty?: number;
}

export type TierList<T extends TierScore = TierScore> = Record<Tier, T[]>;

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];

export function buildTierList<T extends TierScore>(scores: T[]): TierList<T> {
  const result = emptyTierList<T>();
  const automaticScores: T[] = [];

  for (const score of scores) {
    validateTierScore(score);

    if (score.manualLocked === true && isTier(score.manualTier)) {
      result[score.manualTier].push(score);
    } else {
      automaticScores.push(score);
    }
  }

  const sortedAutomaticScores = [...automaticScores].sort(
    (a, b) => b.eloScore - a.eloScore || a.animeId.localeCompare(b.animeId)
  );

  sortedAutomaticScores.forEach((score, index) => {
    result[tierForPercentile(index, sortedAutomaticScores.length)].push(score);
  });

  for (const tier of TIERS) {
    result[tier].sort(compareTierItems);
  }

  return result;
}

export function calculateScoreConfidence(
  compareCount: number,
  uncertainty: number
): number {
  assertFiniteNumber(compareCount, "compareCount");
  assertFiniteNumber(uncertainty, "uncertainty");

  const compareConfidence = Math.min(1, Math.max(0, compareCount) / 30);
  const uncertaintyConfidence =
    1 - Math.min(1, Math.max(0, uncertainty - 80) / 420);

  return clampToPercent((compareConfidence * 0.6 + uncertaintyConfidence * 0.4) * 100);
}

export function calculateRankingConfidence(scores: TierScore[]): number {
  if (scores.length === 0) {
    return 0;
  }

  for (const score of scores) {
    validateTierScore(score);
  }

  const scoreConfidence =
    scores.reduce(
      (sum, score) =>
        sum +
        calculateScoreConfidence(score.compareCount ?? 0, score.uncertainty ?? 350),
      0
    ) / scores.length;
  const sorted = [...scores].sort((a, b) => b.eloScore - a.eloScore);
  const adjacentDiffs = sorted
    .slice(1)
    .map((score, index) => Math.abs(sorted[index].eloScore - score.eloScore));
  const averageDiff =
    adjacentDiffs.length === 0
      ? 0
      : adjacentDiffs.reduce((sum, diff) => sum + diff, 0) / adjacentDiffs.length;
  const separationConfidence = Math.min(100, (averageDiff / 100) * 100);

  return clampToPercent(scoreConfidence * 0.75 + separationConfidence * 0.25);
}

function emptyTierList<T extends TierScore>(): TierList<T> {
  return {
    S: [],
    A: [],
    B: [],
    C: [],
    D: []
  };
}

function isTier(value: string | null | undefined): value is Tier {
  return TIERS.includes(value as Tier);
}

function tierForPercentile(index: number, total: number): Tier {
  if (total <= 0) {
    return "D";
  }

  const percentile = index / total;

  if (percentile < 0.1) {
    return "S";
  }

  if (percentile < 0.3) {
    return "A";
  }

  if (percentile < 0.6) {
    return "B";
  }

  if (percentile < 0.85) {
    return "C";
  }

  return "D";
}

function compareTierItems(a: TierScore, b: TierScore): number {
  const aManual = a.manualLocked === true && isTier(a.manualTier);
  const bManual = b.manualLocked === true && isTier(b.manualTier);

  if (aManual && bManual) {
    return (
      (a.manualRank ?? Number.MAX_SAFE_INTEGER) -
        (b.manualRank ?? Number.MAX_SAFE_INTEGER) ||
      b.eloScore - a.eloScore ||
      a.animeId.localeCompare(b.animeId)
    );
  }

  if (aManual !== bManual) {
    return aManual ? -1 : 1;
  }

  return b.eloScore - a.eloScore || a.animeId.localeCompare(b.animeId);
}

function validateTierScore(score: TierScore): void {
  if (!score.animeId.trim()) {
    throw new Error("animeId is required");
  }

  assertFiniteNumber(score.eloScore, "eloScore");

  if (score.compareCount !== undefined) {
    assertFiniteNumber(score.compareCount, "compareCount");
  }

  if (score.uncertainty !== undefined) {
    assertFiniteNumber(score.uncertainty, "uncertainty");
  }
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function clampToPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
