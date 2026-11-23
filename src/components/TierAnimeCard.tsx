"use client";

import React, { type DragEvent } from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle, getAnimeImageFitMode } from "@/lib/anime-display";
import { getAniScore } from "@/lib/ranking-display";
import type { RankingScoreDistribution, TierListItem } from "@/lib/client-api";

export type TierMoveOption = {
  id: string;
  label: string;
};

export function TierAnimeCard({
  item,
  editable,
  exportMode = false,
  compact = false,
  scoreDistribution,
  onDragStart,
  onDropBefore,
  moveOptions = [],
  onMoveToTier,
  onMoveEarlier,
  onMoveLater,
  canMoveEarlier = false,
  canMoveLater = false,
  className = ""
}: {
  item: TierListItem;
  editable: boolean;
  exportMode?: boolean;
  compact?: boolean;
  scoreDistribution: RankingScoreDistribution;
  onDragStart: () => void;
  onDropBefore: () => void;
  moveOptions?: TierMoveOption[];
  onMoveToTier?: (tierId: string) => void;
  onMoveEarlier?: () => void;
  onMoveLater?: () => void;
  canMoveEarlier?: boolean;
  canMoveLater?: boolean;
  className?: string;
}) {
  const title = getAnimeDisplayTitle(item);
  const coverUrl = getAnimeCoverUrl(item, { intent: "display" });
  const secondaryUrl = getAnimeCoverUrl(item, { intent: "export" });
  const coverFit = getAnimeImageFitMode(item);
  const aniScore = getAniScore(item.eloScore, scoreDistribution);

  return (
    <div
      draggable={editable && !exportMode}
      onDragStart={onDragStart}
      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
      onDrop={(event) => {
        event.stopPropagation();
        onDropBefore();
      }}
      className={`w-full min-w-0 overflow-hidden rounded-xl border border-anime-border bg-anime-panel transition duration-anime hover:border-anime-cyan/30 ${
        editable ? "cursor-grab active:cursor-grabbing" : ""
      } ${className}`}
    >
      <AnimeCover
        src={coverUrl}
        secondarySrc={secondaryUrl}
        title={title}
        size="md"
        fit={coverFit}
        className="aspect-[2/3] h-auto w-full rounded-none border-0"
      />
      <div className={compact ? "p-1.5" : "p-2 sm:p-3"}>
        {!compact && (item.manualLocked || item.display?.isOverridden) ? <div className="mb-1 flex flex-wrap items-start gap-1.5">
          {item.manualLocked ? <AppBadge tone="tier">已手动排序</AppBadge> : null}
          {item.display?.isOverridden ? <AppBadge tone="source">自定义</AppBadge> : null}
        </div> : null}
        <h3 title={title} className={compact ? "line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 text-white" : "line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white"}>
          {title}
        </h3>
        {!compact ? <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="whitespace-nowrap text-xs font-black text-cyan-100 sm:text-sm">{aniScore.label}</p>
          <p className="whitespace-nowrap text-xs text-slate-400">{item.compareCount} 场</p>
        </div> : null}
        {editable && onMoveToTier ? (
          <div
            className="mt-3 space-y-2 [@media(hover:hover)_and_(pointer:fine)]:hidden"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <label className="sr-only" htmlFor={`tier-move-${item.animeId}`}>
              将 {title} 移至其他 Tier
            </label>
            <select
              id={`tier-move-${item.animeId}`}
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  onMoveToTier(event.target.value);
                  event.target.value = "";
                }
              }}
              className="min-h-11 w-full rounded-lg border border-white/15 bg-slate-900 px-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-anime-cyan/60 focus:ring-2 focus:ring-anime-cyan/30"
              aria-label={`将 ${title} 移至其他 Tier`}
            >
              <option value="">移动到 Tier</option>
              {moveOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onMoveEarlier}
                disabled={!canMoveEarlier || onMoveEarlier === undefined}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-base text-slate-100 transition hover:border-anime-cyan/40 hover:bg-anime-cyan/10 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={`将 ${title} 在本 Tier 内前移`}
                title="在本 Tier 内前移"
              >
                &larr;
              </button>
              <button
                type="button"
                onClick={onMoveLater}
                disabled={!canMoveLater || onMoveLater === undefined}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-base text-slate-100 transition hover:border-anime-cyan/40 hover:bg-anime-cyan/10 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={`将 ${title} 在本 Tier 内后移`}
                title="在本 Tier 内后移"
              >
                &rarr;
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
