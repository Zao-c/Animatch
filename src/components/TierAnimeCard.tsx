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
      className={`w-44 shrink-0 overflow-hidden rounded-2xl border border-anime-border bg-slate-950/58 shadow-anime-panel transition duration-anime hover:border-anime-cyan/30 ${
        editable ? "cursor-grab active:cursor-grabbing" : ""
      } ${className}`}
    >
      <AnimeCover
        src={coverUrl}
        secondarySrc={item.imageSmallUrl ?? item.imageMediumUrl ?? item.imageLargeUrl}
        title={title}
        size="md"
        fit={coverFit}
        className="h-56 w-full rounded-none border-0"
      />
      <div className="p-3">
        <div className="flex min-h-10 flex-wrap items-start gap-1.5">
          {item.manualLocked ? <AppBadge tone="tier">Locked</AppBadge> : null}
          {item.display?.isOverridden ? <AppBadge tone="source">Edited</AppBadge> : null}
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white">{title}</h3>
        <p className="mt-2 text-sm font-bold text-cyan-100">{aniScore.label}</p>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          <span>Elo {item.eloScore.toFixed(0)}</span>
          <span>·</span>
          <span>对决 {item.compareCount}</span>
          <span>·</span>
          <span>胜 {item.winCount}</span>
        </div>
      </div>
    </div>
  );
}
