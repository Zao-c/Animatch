import { makePairKey } from "./pair-key";
import type { RankingProgressStage } from "./ranking-progress";

export interface ScoreItem {
  animeId: string;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
  tier?: string;
  rank?: number;
  isHidden?: boolean;
  manualLocked?: boolean;
}

export type PairCandidateReasonKey =
  | "cold_start"
  | "low_exposure"
  | "elo_close"
  | "tier_boundary"
  | "new_pair"
  | "recent_repeat_penalty"
  | "manual_lock_penalty"
  | "same_or_neighbor_rank"
  | "random_jitter";

export type PairCandidateReason = {
  key: PairCandidateReasonKey;
  value: number;
  note?: string;
};

export type PairCandidateScore = {
  leftAnimeId: string;
  rightAnimeId: string;
  total: number;
  reasons: PairCandidateReason[];
};

export interface PairPriorityParams {
  a: ScoreItem;
  b: ScoreItem;
  hasCompared: boolean;
  isRecentPair: boolean;
  stage?: RankingProgressStage;
}

export interface PickedPair {
  leftAnimeId: string;
  rightAnimeId: string;
  reason: string;
  selectedPairDebug?: {
    total: number;
    reasons: PairCandidateReason[];
  };
}

export interface PickNextPairOptions {
  stage?: RankingProgressStage;
  random?: () => number;
}

interface RankedScoreItem extends ScoreItem {
  rankIndex: number;
  percentile: number;
}

interface PairingWeights {
  coldStart: number;
  lowExposure: number;
  eloClose: number;
  tierBoundary: number;
  newPair: number;
  recentRepeatPenalty: number;
  manualLockOnePenalty: number;
  manualLockBothPenalty: number;
  rankNeighbor: number;
  randomJitter: number;
  targetExposure: number;
}

const TIER_BOUNDARIES = [0.1, 0.3, 0.6, 0.85] as const;

const STAGE_WEIGHTS: Record<RankingProgressStage, PairingWeights> = {
  EMPTY: {
    coldStart: 260,
    lowExposure: 120,
    eloClose: 100,
    tierBoundary: 20,
    newPair: 90,
    recentRepeatPenalty: -600,
    manualLockOnePenalty: -70,
    manualLockBothPenalty: -160,
    rankNeighbor: 30,
    randomJitter: 8,
    targetExposure: 2
  },
  DRAFTING: {
    coldStart: 280,
    lowExposure: 130,
    eloClose: 115,
    tierBoundary: 40,
    newPair: 90,
    recentRepeatPenalty: -650,
    manualLockOnePenalty: -70,
    manualLockBothPenalty: -160,
    rankNeighbor: 40,
    randomJitter: 8,
    targetExposure: 2
  },
  DRAFT_READY: {
    coldStart: 170,
    lowExposure: 95,
    eloClose: 175,
    tierBoundary: 120,
    newPair: 70,
    recentRepeatPenalty: -800,
    manualLockOnePenalty: -70,
    manualLockBothPenalty: -160,
    rankNeighbor: 80,
    randomJitter: 7,
    targetExposure: 4
  },
  RELIABLE: {
    coldStart: 140,
    lowExposure: 85,
    eloClose: 190,
    tierBoundary: 145,
    newPair: 65,
    recentRepeatPenalty: -850,
    manualLockOnePenalty: -80,
    manualLockBothPenalty: -180,
    rankNeighbor: 95,
    randomJitter: 7,
    targetExposure: 4
  },
  HIGH_CONFIDENCE: {
    coldStart: 80,
    lowExposure: 45,
    eloClose: 155,
    tierBoundary: 190,
    newPair: 45,
    recentRepeatPenalty: -1000,
    manualLockOnePenalty: -90,
    manualLockBothPenalty: -220,
    rankNeighbor: 140,
    randomJitter: 5,
    targetExposure: 6
  }
};

export function getPairPriority(params: PairPriorityParams): number {
  if (params.isRecentPair) {
    validateScoreItem(params.a);
    validateScoreItem(params.b);
    return Number.NEGATIVE_INFINITY;
  }

  return scorePairCandidate({
    ...params,
    stage: params.stage ?? "DRAFTING",
    random: () => 0
  }).total;
}

export function scorePairCandidate(params: PairPriorityParams & {
  stage?: RankingProgressStage;
  random?: () => number;
  rankedScores?: RankedScoreItem[];
}): PairCandidateScore {
  validateScoreItem(params.a);
  validateScoreItem(params.b);

  if (params.a.animeId === params.b.animeId) {
    return invalidCandidate(params.a.animeId, params.b.animeId);
  }

  if (params.a.isHidden === true || params.b.isHidden === true) {
    return invalidCandidate(params.a.animeId, params.b.animeId);
  }

  const stage = params.stage ?? "DRAFTING";
  const weights = STAGE_WEIGHTS[stage];
  const rankedScores =
    params.rankedScores ?? rankScores([params.a, params.b]);
  const rankedA = rankedScores.find((score) => score.animeId === params.a.animeId);
  const rankedB = rankedScores.find((score) => score.animeId === params.b.animeId);
  const left = rankedA ?? { ...params.a, rankIndex: 0, percentile: 0.5 };
  const right = rankedB ?? { ...params.b, rankIndex: 1, percentile: 0.5 };
  const reasons = [
    coldStartReason(left, right, rankedScores, weights),
    lowExposureReason(left, right, weights),
    eloCloseReason(left, right, weights),
    tierBoundaryReason(left, right, weights),
    newPairReason(params.hasCompared, weights),
    recentRepeatPenaltyReason(params.isRecentPair, weights),
    manualLockPenaltyReason(left, right, weights),
    rankNeighborReason(left, right, rankedScores.length, weights),
    randomJitterReason(params.random ?? Math.random, weights)
  ].filter((reason): reason is PairCandidateReason => reason !== null);
  const total = reasons.reduce((sum, reason) => sum + reason.value, 0);

  return {
    leftAnimeId: params.a.animeId,
    rightAnimeId: params.b.animeId,
    total,
    reasons
  };
}

export function pickNextPair(
  scores: ScoreItem[],
  comparedPairKeys: ReadonlySet<string>,
  recentPairKeys: ReadonlySet<string>,
  options: PickNextPairOptions = {}
): PickedPair | null {
  const visibleScores = scores.filter((score) => score.isHidden !== true);

  if (visibleScores.length < 2) {
    return null;
  }

  const rankedScores = rankScores(visibleScores);
  const stage = options.stage ?? "DRAFTING";
  const candidates = buildCandidates({
    scores: rankedScores,
    comparedPairKeys,
    recentPairKeys,
    stage,
    random: options.random ?? Math.random
  });
  const nonRecentCandidates = candidates.filter(
    (candidate) => !recentPairKeys.has(makePairKey(candidate.leftAnimeId, candidate.rightAnimeId))
  );
  const selected =
    selectCandidate(nonRecentCandidates) ??
    selectCandidate(candidates) ??
    fallbackPair(visibleScores);

  if (selected === null) {
    return null;
  }

  return {
    leftAnimeId: selected.leftAnimeId,
    rightAnimeId: selected.rightAnimeId,
    reason: describeCandidate(selected),
    selectedPairDebug: {
      total: selected.total,
      reasons: selected.reasons
    }
  };
}

export function buildCandidates(params: {
  scores: RankedScoreItem[];
  comparedPairKeys: ReadonlySet<string>;
  recentPairKeys: ReadonlySet<string>;
  stage: RankingProgressStage;
  random: () => number;
}): PairCandidateScore[] {
  const candidates: PairCandidateScore[] = [];

  for (let leftIndex = 0; leftIndex < params.scores.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < params.scores.length; rightIndex += 1) {
      const left = params.scores[leftIndex];
      const right = params.scores[rightIndex];
      const pairKey = makePairKey(left.animeId, right.animeId);
      const candidate = scorePairCandidate({
        a: left,
        b: right,
        hasCompared: params.comparedPairKeys.has(pairKey),
        isRecentPair: params.recentPairKeys.has(pairKey),
        stage: params.stage,
        random: params.random,
        rankedScores: params.scores
      });

      if (candidate.total > Number.NEGATIVE_INFINITY) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

export function makeUnorderedPairKey(leftAnimeId: string, rightAnimeId: string): string {
  return makePairKey(leftAnimeId, rightAnimeId);
}

function rankScores(scores: ScoreItem[]): RankedScoreItem[] {
  const sorted = [...scores].sort(
    (a, b) => b.eloScore - a.eloScore || a.animeId.localeCompare(b.animeId)
  );
  const denominator = Math.max(1, sorted.length);

  return sorted.map((score, index) => ({
    ...score,
    rankIndex: index,
    percentile: (index + 0.5) / denominator
  }));
}

function coldStartReason(
  left: RankedScoreItem,
  right: RankedScoreItem,
  scores: RankedScoreItem[],
  weights: PairingWeights
): PairCandidateReason | null {
  const leftCold = left.compareCount < 2;
  const rightCold = right.compareCount < 2;

  if (!leftCold && !rightCold) {
    return null;
  }

  const medianElo = scores[Math.floor(scores.length / 2)]?.eloScore ?? 1500;
  const coldCount = Number(leftCold) + Number(rightCold);
  const stablePartner =
    coldCount === 1 && (leftCold ? right.compareCount : left.compareCount) >= 2 ? 0.35 : 0;
  const partner = leftCold && !rightCold ? right : rightCold && !leftCold ? left : null;
  const medianPartner =
    partner === null ? 0 : Math.max(0, 1 - Math.abs(partner.eloScore - medianElo) / 300) * 0.25;
  const coldPairMultiplier = coldCount === 2 ? 0.65 : 1;
  const value = weights.coldStart * (coldPairMultiplier + stablePartner + medianPartner);

  return {
    key: "cold_start",
    value,
    note:
      coldCount === 2
        ? "both items have fewer than 2 comparisons"
        : "one item has fewer than 2 comparisons"
  };
}

function lowExposureReason(
  left: RankedScoreItem,
  right: RankedScoreItem,
  weights: PairingWeights
): PairCandidateReason | null {
  const leftExposure = Math.max(0, weights.targetExposure - left.compareCount) / weights.targetExposure;
  const rightExposure =
    Math.max(0, weights.targetExposure - right.compareCount) / weights.targetExposure;
  const exposure = (leftExposure + rightExposure) / 2;

  if (exposure <= 0) {
    return null;
  }

  return {
    key: "low_exposure",
    value: exposure * weights.lowExposure,
    note: `target=${weights.targetExposure}`
  };
}

function eloCloseReason(
  left: RankedScoreItem,
  right: RankedScoreItem,
  weights: PairingWeights
): PairCandidateReason {
  const eloDiff = Math.abs(left.eloScore - right.eloScore);
  const closeness = Math.max(0, 1 - eloDiff / 400);

  return {
    key: "elo_close",
    value: closeness * weights.eloClose,
    note: `eloDiff=${eloDiff.toFixed(1)}`
  };
}

function tierBoundaryReason(
  left: RankedScoreItem,
  right: RankedScoreItem,
  weights: PairingWeights
): PairCandidateReason | null {
  const leftBoundary = nearestBoundary(left.percentile);
  const rightBoundary = nearestBoundary(right.percentile);
  const leftScore = boundaryCloseness(leftBoundary.distance);
  const rightScore = boundaryCloseness(rightBoundary.distance);
  const sameBoundaryBonus =
    leftBoundary.boundary === rightBoundary.boundary ? Math.min(leftScore, rightScore) * 0.4 : 0;
  const score = (leftScore + rightScore) / 2 + sameBoundaryBonus;

  if (score <= 0) {
    return null;
  }

  return {
    key: "tier_boundary",
    value: score * weights.tierBoundary,
    note: `boundary=${leftBoundary.boundary.toFixed(2)}`
  };
}

function newPairReason(hasCompared: boolean, weights: PairingWeights): PairCandidateReason | null {
  if (hasCompared) {
    return null;
  }

  return {
    key: "new_pair",
    value: weights.newPair
  };
}

function recentRepeatPenaltyReason(
  isRecentPair: boolean,
  weights: PairingWeights
): PairCandidateReason | null {
  if (!isRecentPair) {
    return null;
  }

  return {
    key: "recent_repeat_penalty",
    value: weights.recentRepeatPenalty,
    note: "recent 50 comparisons"
  };
}

function manualLockPenaltyReason(
  left: RankedScoreItem,
  right: RankedScoreItem,
  weights: PairingWeights
): PairCandidateReason | null {
  const lockCount = Number(left.manualLocked === true) + Number(right.manualLocked === true);

  if (lockCount === 0) {
    return null;
  }

  return {
    key: "manual_lock_penalty",
    value: lockCount === 2 ? weights.manualLockBothPenalty : weights.manualLockOnePenalty,
    note: lockCount === 2 ? "both items are manually locked" : "one item is manually locked"
  };
}

function rankNeighborReason(
  left: RankedScoreItem,
  right: RankedScoreItem,
  totalScores: number,
  weights: PairingWeights
): PairCandidateReason | null {
  const rankDistance = Math.abs(left.rankIndex - right.rankIndex);
  const nearWindow = Math.max(2, Math.ceil(totalScores * 0.12));
  const closeness = Math.max(0, 1 - rankDistance / nearWindow);

  if (closeness <= 0) {
    return null;
  }

  return {
    key: "same_or_neighbor_rank",
    value: closeness * weights.rankNeighbor,
    note: `rankDistance=${rankDistance}`
  };
}

function randomJitterReason(random: () => number, weights: PairingWeights): PairCandidateReason {
  const normalized = Math.min(1, Math.max(0, random()));

  return {
    key: "random_jitter",
    value: normalized * weights.randomJitter
  };
}

function nearestBoundary(percentile: number): { boundary: number; distance: number } {
  return TIER_BOUNDARIES.map((boundary) => ({
    boundary,
    distance: Math.abs(percentile - boundary)
  })).sort((a, b) => a.distance - b.distance)[0];
}

function boundaryCloseness(distance: number): number {
  return Math.max(0, 1 - distance / 0.08);
}

function selectCandidate(candidates: PairCandidateScore[]): PairCandidateScore | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort(
    (a, b) =>
      b.total - a.total ||
      makePairKey(a.leftAnimeId, a.rightAnimeId).localeCompare(
        makePairKey(b.leftAnimeId, b.rightAnimeId)
      )
  )[0];
}

function fallbackPair(scores: ScoreItem[]): PairCandidateScore | null {
  const visibleScores = scores.filter((score) => score.isHidden !== true);

  if (visibleScores.length < 2) {
    return null;
  }

  return {
    leftAnimeId: visibleScores[0].animeId,
    rightAnimeId: visibleScores[1].animeId,
    total: 0,
    reasons: [
      {
        key: "random_jitter",
        value: 0,
        note: "fallback pair"
      }
    ]
  };
}

function describeCandidate(candidate: PairCandidateScore): string {
  const reasonText = candidate.reasons
    .map((reason) => `${reason.key}=${reason.value.toFixed(1)}`)
    .join("; ");

  return `pairing=v2; total=${candidate.total.toFixed(1)}; ${reasonText}`;
}

function invalidCandidate(leftAnimeId: string, rightAnimeId: string): PairCandidateScore {
  return {
    leftAnimeId,
    rightAnimeId,
    total: Number.NEGATIVE_INFINITY,
    reasons: []
  };
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
