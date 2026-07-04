import React from "react";
import { AppBadge } from "./ui/AppBadge";
import { AppCard } from "./ui/AppCard";
import type { RankingProgress } from "@/lib/client-api";

export function RankingProgressCard({
  progress,
  compact = false
}: {
  progress: RankingProgress;
  compact?: boolean;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(progress.progressRatio * 100)));
  const overTargetCount = Math.max(
    0,
    progress.effectiveComparisons - progress.highConfidenceTarget
  );

  return (
    <AppCard className={compact ? "p-4" : "p-5"}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="tier">榜单阶段</AppBadge>
            <AppBadge tone="status">{progress.stageLabel}</AppBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {buildProgressCopy(progress)}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            你可以随时查看 Tier List，也可以继续对决提高准确度。
          </p>
        </div>
        <div className="min-w-48">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">有效对决进度</p>
              <p className="mt-1 text-2xl font-black text-white">
                {formatProgressCount(progress)}
              </p>
            </div>
            <p className="text-sm font-bold text-cyan-100">{percent}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {progress.remainingToNextStage > 0
              ? `继续 ${progress.remainingToNextStage} 场可${progress.nextTargetLabel}`
              : progress.nextTargetLabel}
          </p>
          {overTargetCount > 0 ? (
            <p className="mt-1 text-xs font-semibold text-cyan-100">
              已超过目标 {overTargetCount} 场
            </p>
          ) : null}
        </div>
      </div>
    </AppCard>
  );
}

function buildProgressCopy(progress: RankingProgress): string {
  if (progress.stage === "EMPTY") {
    return "当前作品不足，至少需要 2 个作品才能开始生成榜单。";
  }

  if (progress.stage === "HIGH_CONFIDENCE") {
    return "当前榜单已达到高可信度，继续对决会进一步微调边界。";
  }

  return `当前榜单已完成 ${progress.effectiveComparisons} / ${copyTarget(progress)} 场有效对决，${stageCopy(progress.stage)}。`;
}

function formatProgressCount(progress: RankingProgress): string {
  if (progress.effectiveComparisons > progress.highConfidenceTarget) {
    return `${progress.effectiveComparisons} 场 / 目标 ${progress.highConfidenceTarget}`;
  }

  return `${progress.effectiveComparisons} / ${progress.highConfidenceTarget}`;
}

function stageCopy(stage: RankingProgress["stage"]): string {
  switch (stage) {
    case "DRAFTING":
      return "正在生成初稿";
    case "DRAFT_READY":
      return "已可生成初稿";
    case "RELIABLE":
      return "已达到较可信";
    case "EMPTY":
    case "HIGH_CONFIDENCE":
      return "";
  }
}

function copyTarget(progress: RankingProgress): number {
  switch (progress.stage) {
    case "DRAFTING":
      return progress.draftTarget;
    case "DRAFT_READY":
      return progress.reliableTarget;
    case "RELIABLE":
    case "HIGH_CONFIDENCE":
      return progress.highConfidenceTarget;
    case "EMPTY":
      return 0;
  }
}
