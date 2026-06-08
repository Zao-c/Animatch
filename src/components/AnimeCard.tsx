"use client";

import type { PublicAnime } from "@/lib/client-api";
import { AnimeCover } from "./AnimeCover";

export function AnimeCard({
  anime,
  onClick,
  selected = false,
  disabled = false,
  actionLabel
}: {
  anime: PublicAnime;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  actionLabel?: string;
}) {
  const title = anime.titleCn ?? anime.title;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex w-full gap-4 rounded-lg border p-3 text-left transition ${
        selected
          ? "border-cyan-400 bg-cyan-400/10"
          : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <AnimeCover
        src={anime.imageMediumUrl ?? anime.imageUrl ?? anime.imageSmallUrl}
        title={title}
        size="md"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1 py-1">
        <h3 className="line-clamp-2 text-base font-semibold text-white">{title}</h3>
        {anime.titleCn ? (
          <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{anime.title}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-300">
          {anime.bangumiScore !== null ? <span>评分 {anime.bangumiScore}</span> : null}
          {anime.bangumiRank !== null ? <span>排名 #{anime.bangumiRank}</span> : null}
          <span>BGM {anime.bgmId}</span>
        </div>
        {actionLabel ? (
          <div className="mt-4 text-sm font-medium text-cyan-300">{actionLabel}</div>
        ) : null}
      </div>
    </button>
  );
}
