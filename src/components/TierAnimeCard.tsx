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
      className={`w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 shadow-anime-panel transition duration-anime hover:-translate-y-0.5 hover:border-anime-cyan/30 ${
        editable ? "cursor-grab active:cursor-grabbing" : ""
      } ${className}`}
    >
      <AnimeCover
        src={coverUrl}
        secondarySrc={secondaryUrl}
        title={title}
        size="md"
        fit={coverFit}
        className="h-52 w-full rounded-none border-0"
      />
      <div className="p-3">
        <div className="flex min-h-6 flex-wrap items-start gap-1.5">
          {item.manualLocked ? <AppBadge tone="tier">Locked</AppBadge> : null}
          {item.display?.isOverridden ? <AppBadge tone="source">Edited</AppBadge> : null}
        </div>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white">
          {title}
        </h3>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-sm font-black text-cyan-100">{aniScore.label}</p>
          <p className="text-[11px] text-slate-500">{item.compareCount} battles</p>
        </div>
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
