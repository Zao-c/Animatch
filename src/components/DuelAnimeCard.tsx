"use client";

import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import type { PublicAnimeWithScore } from "@/lib/client-api";

export function DuelAnimeCard({
  anime,
  side,
  disabled,
  actionLabel,
  onPick,
  className = ""
}: {
  anime: PublicAnimeWithScore;
  side: "left" | "right";
  disabled: boolean;
  actionLabel: string;
  onPick: () => void;
  className?: string;
}) {
  const title = anime.display?.title ?? anime.titleCn ?? anime.title;
  const subtitle = anime.display?.subtitle ?? (anime.titleCn ? anime.title : null);
  const coverUrl =
    anime.display?.coverUrl ??
    anime.imageLargeUrl ??
    anime.imageMediumUrl ??
    anime.thumbnailUrl ??
    anime.imageUrl;
  const animeType = anime.display?.animeType ?? anime.animeType;

  return (
    <AppCard
      className={`group overflow-hidden p-4 transition duration-200 hover:border-cyan-300/35 hover:shadow-[0_0_45px_rgba(3,218,197,0.16)] ${className}`}
    >
      <div className="relative">
        <AnimeCover
          src={coverUrl}
          secondarySrc={anime.imageLargeUrl ?? anime.imageMediumUrl ?? anime.imageUrl}
          title={title}
          size="lg"
          className="rounded-2xl border-cyan-200/10"
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-slate-950/82 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <AppBadge tone={side === "left" ? "source" : "status"}>
            {side === "left" ? "LEFT" : "RIGHT"}
          </AppBadge>
          {animeType ? <AppBadge tone="muted">{animeType}</AppBadge> : null}
          {anime.year ? <AppBadge tone="muted">{anime.year}</AppBadge> : null}
          <AppBadge tone="muted">{anime.source}</AppBadge>
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

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric label="Elo" value={anime.eloScore.toFixed(1)} />
        <Metric label="对决" value={String(anime.compareCount)} />
        <Metric label="不确定性" value={anime.uncertainty.toFixed(0)} />
      </div>

      <AppButton
        type="button"
        disabled={disabled}
        onClick={onPick}
        variant="primary"
        size="lg"
        className="mt-5 w-full"
      >
        {actionLabel}
      </AppButton>
    </AppCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-center">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}
