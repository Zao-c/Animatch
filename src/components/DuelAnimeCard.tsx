"use client";

import React from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { getAnimeDisplaySubtitle, getAnimeDisplayTitle, getAnimeImageFitMode } from "@/lib/anime-display";
import { getAniScore } from "@/lib/ranking-display";
import type { PublicAnimeWithScore, RankingScoreDistribution } from "@/lib/client-api";

export function DuelAnimeCard({
  anime,
  side,
  disabled,
  actionLabel,
  shortcut,
  onPick,
  scoreDistribution,
  highlighted = false,
  className = ""
}: {
  anime: PublicAnimeWithScore;
  side: "left" | "right";
  disabled: boolean;
  actionLabel: string;
  shortcut?: string;
  onPick: () => void;
  scoreDistribution: RankingScoreDistribution;
  highlighted?: boolean;
  className?: string;
}) {
  const title = getAnimeDisplayTitle(anime);
  const subtitle = getAnimeDisplaySubtitle(anime);
  const coverUrl = getAnimeCoverUrl(anime, { intent: "hero" });
  const coverUrlFallback = getAnimeCoverUrl(anime, { intent: "export" });
  const secondarySrc = coverUrlFallback !== coverUrl ? coverUrlFallback : null;
  const coverFit = getAnimeImageFitMode(anime);
  const animeType = anime.display?.animeType ?? anime.animeType;
  const aniScore = getAniScore(anime.eloScore, scoreDistribution);
  const sideLabel = side === "left" ? "LEFT" : "RIGHT";

  function handlePick() {
    if (!disabled) {
      onPick();
    }
  }

  return (
    <AppCard
      className={`flex h-full flex-col overflow-hidden p-2 transition duration-anime hover:border-anime-cyan/35 hover:shadow-anime-focus sm:p-4 ${
        disabled ? "opacity-70" : ""
      } ${
        highlighted
          ? "border-anime-amber/60 shadow-[0_0_0_2px_rgba(246,196,83,0.28),0_24px_80px_rgba(246,196,83,0.16)]"
          : ""
      } ${className}`}
    >
      <div className="relative">
        <AnimeCover
          src={coverUrl}
          secondarySrc={secondarySrc}
          title={title}
          size="lg"
          fit={coverFit}
          animeId={anime.id}
          className="rounded-xl border-cyan-200/10 sm:rounded-2xl"
        />
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-slate-950/18 via-transparent to-transparent sm:rounded-2xl" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
          <AppBadge tone={side === "left" ? "source" : "status"}>
            {sideLabel}
          </AppBadge>
          {animeType ? <AppBadge tone="muted">{animeType}</AppBadge> : null}
          {anime.year ? <AppBadge tone="muted">{anime.year}</AppBadge> : null}
        </div>
      </div>

      <div className="mt-2 sm:mt-4">
        <h2 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 tracking-tight text-white/78 sm:min-h-[3.25rem] sm:text-xl sm:leading-7">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 line-clamp-1 text-[11px] text-slate-400/50 sm:mt-2 sm:text-xs">{subtitle}</p> : null}
        {anime.display?.isOverridden ? (
          <div className="mt-3">
            <AppBadge tone="source">已手动修正</AppBadge>
          </div>
        ) : null}
      </div>

      <details
        className="relative mb-4 mt-4 hidden rounded-xl border border-white/10 bg-slate-950/28 px-3 py-2 text-sm text-slate-500 sm:block"
        onClick={(e) => e.stopPropagation()}
      >
        <summary className="cursor-pointer select-none text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          详细指标
        </summary>
        <div className="absolute left-0 right-0 top-full z-20 mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-anime-panel">
          <Metric label="AniScore" value={aniScore.label} />
          <Metric label="对决" value={String(anime.compareCount)} />
          <Metric label="Elo" value={anime.eloScore.toFixed(0)} muted />
        </div>
      </details>

      <AppButton
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          handlePick();
        }}
        variant="primary"
        size="lg"
        className="mt-auto w-full"
      >
        {shortcut ? <ShortcutKey>{shortcut}</ShortcutKey> : null}
        <span>{actionLabel}</span>
      </AppButton>
    </AppCard>
  );
}

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="mr-2 rounded-md border border-slate-950/20 bg-slate-950/20 px-1.5 py-0.5 text-[11px] font-black leading-none text-slate-950">
      {children}
    </kbd>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/42 px-2 py-2 text-center">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-bold ${muted ? "text-slate-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
