"use client";

import React, { type DragEvent } from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import type { TierListItem } from "@/lib/client-api";

export function TierAnimeCard({
  item,
  editable,
  onDragStart,
  onDropBefore,
  className = ""
}: {
  item: TierListItem;
  editable: boolean;
  onDragStart: () => void;
  onDropBefore: () => void;
  className?: string;
}) {
  const title = item.display?.title ?? item.titleCn ?? item.title;
  const coverUrl = getAnimeCoverUrl(item, { intent: "display" });

  return (
    <div
      draggable={editable}
      onDragStart={onDragStart}
      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
      onDrop={(event) => {
        event.stopPropagation();
        onDropBefore();
      }}
      className={`w-56 shrink-0 rounded-2xl border border-white/10 bg-slate-950/58 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition hover:border-cyan-300/30 ${
        editable ? "cursor-grab active:cursor-grabbing" : ""
      } ${className}`}
    >
      <div className="flex gap-3">
        <AnimeCover
          src={coverUrl}
          secondarySrc={item.imageSmallUrl ?? item.imageMediumUrl ?? item.imageLargeUrl}
          title={title}
          size="sm"
          className="shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.manualLocked ? <AppBadge tone="tier">Locked</AppBadge> : null}
            {item.display?.isOverridden ? <AppBadge tone="source">Edited</AppBadge> : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-white">{title}</h3>
          <p className="mt-2 text-xs text-slate-400">Elo {item.eloScore.toFixed(1)}</p>
          <p className="mt-1 text-xs text-slate-500">对决 {item.compareCount}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] text-slate-400">
        <span>胜 {item.winCount}</span>
        <span>负 {item.lossCount}</span>
        <span>平 {item.drawCount}</span>
        <span>未看 {item.unseenCount}</span>
      </div>
    </div>
  );
}
