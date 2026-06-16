"use client";

import React, { type DragEvent } from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle, shouldUseContainCover } from "@/lib/anime-display";
import { getAniScore } from "@/lib/ranking-display";
import type { RankingScoreDistribution, TierListItem } from "@/lib/client-api";

export function TierAnimeCard({
  item,
  editable,
  exportMode = false,
  scoreDistribution,
  onDragStart,
  onDropBefore,
  className = ""
}: {
  item: TierListItem;
  editable: boolean;
  exportMode?: boolean;
  scoreDistribution: RankingScoreDistribution;
  onDragStart: () => void;
  onDropBefore: () => void;
  className?: string;
}) {
  const title = getAnimeDisplayTitle(item);
  const coverUrl = getAnimeCoverUrl(item, { intent: "display" });
  const coverFit = shouldUseContainCover(item) ? "contain" : "cover";
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
        secondarySrc={item.imageSmallUrl ?? item.imageMediumUrl ?? item.imageLargeUrl}
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
      </div>
    </div>
  );
}
