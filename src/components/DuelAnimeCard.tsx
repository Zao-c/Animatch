"use client";

import React from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { getAniScore } from "@/lib/ranking-display";
import type { PublicAnimeWithScore, RankingScoreDistribution } from "@/lib/client-api";

export function DuelAnimeCard({
  anime,
  side,
  disabled,
  actionLabel,
  onPick,
  scoreDistribution,
  highlighted = false,
  className = ""
}: {
  anime: PublicAnimeWithScore;
  side: "left" | "right";
  disabled: boolean;
  actionLabel: string;
  onPick: () => void;
  scoreDistribution: RankingScoreDistribution;
  highlighted?: boolean;
  className?: string;
}) {
  const title = anime.display?.title ?? anime.titleCn ?? anime.title;
  const subtitle = anime.display?.subtitle ?? (anime.titleCn ? anime.title : null);
  const coverUrl = getAnimeCoverUrl(anime, { intent: "hero" });
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
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={handlePick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlePick();
        }
      }}
      className={`group overflow-hidden p-4 transition duration-anime hover:border-anime-cyan/35 hover:shadow-anime-focus ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      } ${
        highlighted
          ? "border-anime-amber/60 shadow-[0_0_0_2px_rgba(246,196,83,0.28),0_24px_80px_rgba(246,196,83,0.16)]"
          : ""
      } ${className}`}
    >
      <div className="relative">
        <AnimeCover
          src={coverUrl}
          secondarySrc={anime.imageMediumUrl ?? anime.imageSmallUrl ?? anime.imageLargeUrl}
          title={title}
          size="lg"
          className="rounded-2xl border-cyan-200/10"
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-slate-950/82 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <AppBadge tone={side === "left" ? "source" : "status"}>
            {sideLabel}
          </AppBadge>
          {animeType ? <AppBadge tone="muted">{animeType}</AppBadge> : null}
          {anime.year ? <AppBadge tone="muted">{anime.year}</AppBadge> : null}
        </div>
      </div>

      <div className="mt-5">
        <h2 className="line-clamp-2 text-2xl font-black tracking-tight text-white">
          {title}
        </h2>
        {subtitle ? <p className="mt-2 line-clamp-1 text-sm text-slate-400">{subtitle}</p> : null}
        {anime.display?.isOverridden ? (
          <div className="mt-3">
            <AppBadge tone="source">已手动修正</AppBadge>
          </div>
        ) : null}
      </div>

      <details className="mt-5 rounded-2xl border border-anime-border bg-slate-950/42 px-3 py-2 text-sm text-slate-400">
        <summary className="cursor-pointer select-none text-xs font-semibold text-slate-300">
          详细指标
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2">
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
        className="mt-5 w-full"
      >
        {actionLabel}
      </AppButton>
    </AppCard>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-center">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-bold ${muted ? "text-slate-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
