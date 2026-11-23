export interface RankingScoreDistribution {
  count: number;
  mean: number;
  median: number;
  std: number;
}

export type RankingDisplayScore = {
  elo: number;
  score10: number;
  label: string;
};

const FALLBACK_STD = 120;

export function buildScoreDistribution(scores: number[]): RankingScoreDistribution {
  const finiteScores = scores.filter((score) => Number.isFinite(score));

  if (finiteScores.length === 0) {
    return {
      count: 0,
      mean: 1500,
      median: 1500,
      std: FALLBACK_STD
    };
  }

  const sorted = [...finiteScores].sort((a, b) => a - b);
  const mean = finiteScores.reduce((sum, score) => sum + score, 0) / finiteScores.length;
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];
  const variance =
    finiteScores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / finiteScores.length;
  const std = Math.sqrt(variance);

  return {
    count: finiteScores.length,
    mean,
    median,
    std: std < 25 ? FALLBACK_STD : std
  };
}

export function getAniScore(
  elo: number,
  distribution: RankingScoreDistribution
): RankingDisplayScore {
  const safeElo = Number.isFinite(elo) ? elo : distribution.mean;
  const safeStd = distribution.std > 0 ? distribution.std : FALLBACK_STD;
  const baseline = distribution.count < 3 ? 1500 : distribution.mean;
  const score10 = roundToOneDecimal(clamp(5.7 + ((safeElo - baseline) / safeStd) * 1.4, 1, 10));

  return {
    elo: safeElo,
    score10,
    label: `${score10.toFixed(1)} / 10`
  };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
