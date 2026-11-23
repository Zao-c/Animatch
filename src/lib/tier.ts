import type { TierRowConfig } from "./tier-config";
import { matchTierRow } from "./tier-config";

export type Tier = string;

export interface TierScore {
  animeId: string;
  eloScore: number;
  manualTier?: string | null;
  manualRank?: number | null;
  manualLocked?: boolean;
  compareCount?: number;
  uncertainty?: number;
}

export type TierList<T extends TierScore = TierScore> = Record<string, T[]>;

export function buildTierList<T extends TierScore>(
  scores: T[],
  rows: TierRowConfig[]
): TierList<T> {
  const result = emptyTierList<T>(rows);
  const automaticScores: T[] = [];

  for (const score of scores) {
    validateTierScore(score);

    const matchedRow = score.manualLocked === true ? matchTierRow(score.manualTier, rows) : undefined;

    if (matchedRow !== undefined) {
      result[matchedRow.id].push(score);
    } else {
      automaticScores.push(score);
    }
  }

  const sortedAutomaticScores = [...automaticScores].sort(
    (a, b) => b.eloScore - a.eloScore || a.animeId.localeCompare(b.animeId)
  );

  sortedAutomaticScores.forEach((score, index) => {
    const tierId = tierForPercentile(index, sortedAutomaticScores.length, rows);
    result[tierId].push(score);
  });

  for (const row of rows) {
    result[row.id].sort((a, b) => compareTierItems(a, b, rows));
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

export function emptyTierList<T extends TierScore>(rows: TierRowConfig[]): TierList<T> {
  const result: TierList<T> = {};
  for (const row of rows) {
    result[row.id] = [];
  }
  return result;
}

const DEFAULT_FIVE_PERCENTILE_CUTOFFS = [0.1, 0.3, 0.6, 0.85];

function tierForPercentile(
  index: number,
  total: number,
  rows: TierRowConfig[]
): string {
  if (total <= 0 || rows.length === 0) {
    return rows.length > 0 ? rows[rows.length - 1].id : "d";
  }

  const percentile = index / total;

  if (rows.length === 5) {
    for (let i = 0; i < DEFAULT_FIVE_PERCENTILE_CUTOFFS.length; i++) {
      if (percentile < DEFAULT_FIVE_PERCENTILE_CUTOFFS[i]) {
        return rows[i].id;
      }
    }
    return rows[4].id;
  }

  const bucketSize = 1 / rows.length;
  const bucketIndex = Math.min(rows.length - 1, Math.floor(percentile / bucketSize));
  return rows[bucketIndex].id;
}

function compareTierItems<T extends TierScore>(
  a: T,
  b: T,
  rows: TierRowConfig[]
): number {
  const aRow = a.manualLocked === true ? matchTierRow(a.manualTier, rows) : undefined;
  const bRow = b.manualLocked === true ? matchTierRow(b.manualTier, rows) : undefined;
  const aManual = aRow !== undefined;
  const bManual = bRow !== undefined;

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
