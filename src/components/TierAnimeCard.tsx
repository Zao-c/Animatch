"use client";

import React, { useRef, useState, type DragEvent } from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { getAnimeCoverUrl, getAnimeSourceCoverCandidates } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle, getAnimeImageFitMode } from "@/lib/anime-display";
import { smartCoverUrl } from "@/lib/smart-cover-url";
import { getAniScore } from "@/lib/ranking-display";
import type { RankingScoreDistribution, TierListItem } from "@/lib/client-api";

export type TierMoveOption = {
  id: string;
  label: string;
};

export function TierAnimeCard({
  item,
  editable,
  disabled = false,
  exportMode = false,
  compact = false,
  scoreDistribution,
  onDragStart,
  onDragEnd,
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
  disabled?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  scoreDistribution: RankingScoreDistribution;
  onDragStart: () => void;
  onDragEnd?: () => void;
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
  const smartUrl = smartCoverUrl(coverUrl, item.source, "card");
  const secondaryUrl = smartUrl !== coverUrl ? coverUrl : getAnimeSourceCoverCandidates(item).find((url) => url !== coverUrl);
  const coverFit = smartUrl !== coverUrl ? "cover" : getAnimeImageFitMode(item);
  const aniScore = getAniScore(item.eloScore, scoreDistribution);
  const [controlsOpen, setControlsOpen] = useState(false);
  const adjustButtonRef = useRef<HTMLButtonElement>(null);
  const canDrag = editable && !exportMode && !disabled;

  return (
      <div
        data-tier-anime-id={item.animeId}
        draggable={canDrag}
        onDragStart={(event) => {
          if (!canDrag) { event.preventDefault(); return; }
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          if (canDrag) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!canDrag) return;
          event.preventDefault();
          event.stopPropagation();
          onDropBefore();
        }}
        className={`group w-full min-w-0 overflow-hidden rounded-lg border border-white/[0.08] bg-[#14161b] transition duration-anime hover:border-white/25 ${
          canDrag ? "cursor-grab active:cursor-grabbing" : ""
        } ${className}`}
      >
        <div className="relative">
          <AnimeCover
            src={smartUrl}
            secondarySrc={secondaryUrl}
            fallbackSrcs={[coverUrl, ...getAnimeSourceCoverCandidates(item)].filter((url): url is string => !!url)}
            title={title}
            size="md"
            fit={coverFit}
            className="aspect-[2/3] h-auto w-full rounded-none border-0"
          />
          {compact ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 pb-1.5 pt-5 text-[11px] font-semibold leading-4 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="line-clamp-2">{title}</span>
            </span>
          ) : null}
        </div>
        <div className={compact ? "p-1.5" : "p-2 sm:p-2.5"}>
          {!compact && (item.manualLocked || item.display?.isOverridden) ? <div className="mb-1 flex flex-wrap items-start gap-1.5">
            {item.manualLocked ? <AppBadge tone="tier">已手动排序</AppBadge> : null}
            {item.display?.isOverridden ? <AppBadge tone="source">自定义</AppBadge> : null}
          </div> : null}
          <h3 title={title} className={compact ? "line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 text-zinc-200" : "line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white"}>
            {title}
          </h3>
          {!compact ? <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="whitespace-nowrap text-xs font-bold text-zinc-200 sm:text-sm">{aniScore.label}</p>
            <p className="whitespace-nowrap text-xs text-zinc-400">{item.compareCount} 场</p>
          </div> : null}
        {editable && !exportMode && onMoveToTier ? (
          <div
            data-tier-controls={item.animeId}
            className="mt-3 scroll-mt-72 scroll-mb-8 cursor-default sm:scroll-mt-48"
            onPointerDown={(event) => event.stopPropagation()}
            onDragStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Escape" || !controlsOpen) return;
              event.preventDefault();
              event.stopPropagation();
              setControlsOpen(false);
              adjustButtonRef.current?.focus();
            }}
          >
            <button
              ref={adjustButtonRef}
              id={`tier-adjust-${item.animeId}`}
              type="button"
              disabled={disabled}
              aria-label={`调整 ${title} 的位置`}
              aria-expanded={controlsOpen}
              aria-controls={`tier-controls-${item.animeId}`}
              onClick={() => setControlsOpen((value) => !value)}
              className="hidden min-h-11 w-full items-center justify-between gap-1 rounded-lg border border-white/15 bg-white/[0.04] px-2 text-xs font-semibold text-slate-100 transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-35 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
            >
              调整位置 <span aria-hidden="true">{controlsOpen ? "▴" : "▾"}</span>
            </button>
            <div
              id={`tier-controls-${item.animeId}`}
              className={`space-y-2 [@media(hover:hover)_and_(pointer:fine)]:mt-2 ${controlsOpen ? "" : "[@media(hover:hover)_and_(pointer:fine)]:hidden"}`}
            >
              <label className="sr-only" htmlFor={`tier-move-${item.animeId}`}>
                将 {title} 移至其他 Tier
              </label>
              <select
                id={`tier-move-${item.animeId}`}
                disabled={disabled}
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    onMoveToTier(event.target.value);
                    event.target.value = "";
                  }
                }}
                className="min-h-11 w-full rounded-lg border border-white/15 bg-[#14161b] px-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/20"
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
                  id={`tier-earlier-${item.animeId}`}
                  type="button"
                  onClick={onMoveEarlier}
                  disabled={disabled || !canMoveEarlier || onMoveEarlier === undefined}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-base text-slate-100 transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={`将 ${title} 在本 Tier 内前移`}
                  title="在本 Tier 内前移"
                >
                  &larr;
                </button>
                <button
                  id={`tier-later-${item.animeId}`}
                  type="button"
                  onClick={onMoveLater}
                  disabled={disabled || !canMoveLater || onMoveLater === undefined}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-base text-slate-100 transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={`将 ${title} 在本 Tier 内后移`}
                  title="在本 Tier 内后移"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
