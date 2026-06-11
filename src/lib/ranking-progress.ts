export type RankingProgressStage =
  | "EMPTY"
  | "DRAFTING"
  | "DRAFT_READY"
  | "RELIABLE"
  | "HIGH_CONFIDENCE";

export type ComparisonResultForProgress =
  | "LEFT_WIN"
  | "RIGHT_WIN"
  | "DRAW"
  | "SKIP"
  | "LEFT_UNSEEN"
  | "RIGHT_UNSEEN"
  | "BOTH_UNSEEN";

export type RankingProgress = {
  totalItems: number;
  effectiveComparisons: number;
  draftTarget: number;
  reliableTarget: number;
  highConfidenceTarget: number;
  progressRatio: number;
  stage: RankingProgressStage;
  stageLabel: string;
  nextTargetLabel: string;
  remainingToNextStage: number;
};

export function countEffectiveComparisons(results: ComparisonResultForProgress[]): number {
  return results.filter(
    (result) => result === "LEFT_WIN" || result === "RIGHT_WIN" || result === "DRAW"
  ).length;
}

export function buildRankingProgress(input: {
  totalItems: number;
  effectiveComparisons: number;
  comparedItems?: number;
  totalComparisons?: number;
  averageCompareCount?: number;
}): RankingProgress {
  const totalItems = Math.max(0, Math.trunc(input.totalItems));
  const effectiveComparisons = Math.max(0, Math.trunc(input.effectiveComparisons));
  const minimumTarget = totalItems < 2 ? 0 : Math.max(totalItems - 1, 1);
  const draftTarget = Math.max(minimumTarget, Math.ceil(totalItems * 1.5));
  const reliableTarget = Math.max(draftTarget, Math.ceil(totalItems * 3));
  const highConfidenceTarget = Math.max(reliableTarget, Math.ceil(totalItems * 5));

  if (totalItems < 2) {
    return {
      totalItems,
      effectiveComparisons,
      draftTarget,
      reliableTarget,
      highConfidenceTarget,
      progressRatio: 0,
      stage: "EMPTY",
      stageLabel: "作品不足",
      nextTargetLabel: "至少添加 2 个作品",
      remainingToNextStage: 0
    };
  }

  const stage = getStage(effectiveComparisons, draftTarget, reliableTarget, highConfidenceTarget);
  const nextTarget = getNextTarget(stage, draftTarget, reliableTarget, highConfidenceTarget);

  return {
    totalItems,
    effectiveComparisons,
    draftTarget,
    reliableTarget,
    highConfidenceTarget,
    progressRatio: clamp(effectiveComparisons / highConfidenceTarget, 0, 1),
    stage,
    stageLabel: labelForStage(stage),
    nextTargetLabel: nextLabelForStage(stage),
    remainingToNextStage:
      nextTarget === null ? 0 : Math.max(0, nextTarget - effectiveComparisons)
  };
}

function getStage(
  effectiveComparisons: number,
  draftTarget: number,
  reliableTarget: number,
  highConfidenceTarget: number
): RankingProgressStage {
  if (effectiveComparisons >= highConfidenceTarget) {
    return "HIGH_CONFIDENCE";
  }

  if (effectiveComparisons >= reliableTarget) {
    return "RELIABLE";
  }

  if (effectiveComparisons >= draftTarget) {
    return "DRAFT_READY";
  }

  return "DRAFTING";
}

function getNextTarget(
  stage: RankingProgressStage,
  draftTarget: number,
  reliableTarget: number,
  highConfidenceTarget: number
): number | null {
  switch (stage) {
    case "EMPTY":
      return null;
    case "DRAFTING":
      return draftTarget;
    case "DRAFT_READY":
      return reliableTarget;
    case "RELIABLE":
      return highConfidenceTarget;
    case "HIGH_CONFIDENCE":
      return null;
  }
}

function labelForStage(stage: RankingProgressStage): string {
  switch (stage) {
    case "EMPTY":
      return "作品不足";
    case "DRAFTING":
      return "初稿生成中";
    case "DRAFT_READY":
      return "初稿";
    case "RELIABLE":
      return "较可信";
    case "HIGH_CONFIDENCE":
      return "高可信";
  }
}

function nextLabelForStage(stage: RankingProgressStage): string {
  switch (stage) {
    case "EMPTY":
      return "至少添加 2 个作品";
    case "DRAFTING":
      return "达到初稿";
    case "DRAFT_READY":
      return "达到较可信";
    case "RELIABLE":
      return "达到高可信";
    case "HIGH_CONFIDENCE":
      return "已达到高可信度";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
