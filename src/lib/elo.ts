export type EloResult = "LEFT_WIN" | "RIGHT_WIN" | "DRAW";

export interface UpdateEloParams {
  leftElo: number;
  rightElo: number;
  leftCompareCount: number;
  rightCompareCount: number;
  leftUncertainty: number;
  rightUncertainty: number;
  result: EloResult;
}

export interface UpdateEloResult {
  leftEloAfter: number;
  rightEloAfter: number;
  leftUncertaintyAfter: number;
  rightUncertaintyAfter: number;
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function expectedScore(ratingA: number, ratingB: number): number {
  assertFiniteNumber(ratingA, "ratingA");
  assertFiniteNumber(ratingB, "ratingB");

  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function getKFactor(compareCount: number, uncertainty: number): number {
  assertFiniteNumber(compareCount, "compareCount");
  assertFiniteNumber(uncertainty, "uncertainty");

  const normalizedCompareCount = Math.max(0, compareCount);
  const normalizedUncertainty = Math.max(0, uncertainty);
  const base =
    normalizedCompareCount < 10 ? 40 : normalizedCompareCount < 30 ? 24 : 16;
  const uncertaintyBoost = clamp(normalizedUncertainty / 250, 0.75, 1.5);

  return base * uncertaintyBoost;
}

export function updateUncertainty(uncertainty: number): number {
  assertFiniteNumber(uncertainty, "uncertainty");

  return Math.max(80, Math.max(0, uncertainty) * 0.94);
}

export function updateElo(params: UpdateEloParams): UpdateEloResult {
  assertFiniteNumber(params.leftElo, "leftElo");
  assertFiniteNumber(params.rightElo, "rightElo");
  assertFiniteNumber(params.leftCompareCount, "leftCompareCount");
  assertFiniteNumber(params.rightCompareCount, "rightCompareCount");
  assertFiniteNumber(params.leftUncertainty, "leftUncertainty");
  assertFiniteNumber(params.rightUncertainty, "rightUncertainty");

  const leftExpected = expectedScore(params.leftElo, params.rightElo);
  const rightExpected = expectedScore(params.rightElo, params.leftElo);
  const leftK = getKFactor(params.leftCompareCount, params.leftUncertainty);
  const rightK = getKFactor(params.rightCompareCount, params.rightUncertainty);
  const [leftScore, rightScore] = resultToScores(params.result);

  return {
    leftEloAfter: params.leftElo + leftK * (leftScore - leftExpected),
    rightEloAfter: params.rightElo + rightK * (rightScore - rightExpected),
    leftUncertaintyAfter: updateUncertainty(params.leftUncertainty),
    rightUncertaintyAfter: updateUncertainty(params.rightUncertainty)
  };
}

function resultToScores(result: EloResult): [number, number] {
  switch (result) {
    case "LEFT_WIN":
      return [1, 0];
    case "RIGHT_WIN":
      return [0, 1];
    case "DRAW":
      return [0.5, 0.5];
  }
}
