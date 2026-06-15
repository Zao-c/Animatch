"use client";

import React from "react";
import type { PublicAnime } from "@/lib/client-api";
import { formatAnimeSource } from "@/lib/anime-source";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { labelAnimeTag } from "@/lib/anime-tag-dictionary";
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
  const coverUrl = getAnimeCoverUrl(anime, { intent: "thumbnail" });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex w-full gap-4 rounded-2xl border p-3 text-left backdrop-blur-xl transition ${
        selected
          ? "border-cyan-300/60 bg-cyan-300/12 shadow-[0_0_26px_rgba(3,218,197,0.14)]"
          : "border-white/10 bg-slate-950/45 hover:border-cyan-300/25 hover:bg-white/[0.07]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <AnimeCover
        src={coverUrl}
        title={title}
        size="md"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1 py-1">
        <h3 className="line-clamp-2 text-base font-semibold text-white">{title}</h3>
        {anime.titleCn ? (
          <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{anime.title}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
          {anime.bangumiScore !== null ? <span>评分 {anime.bangumiScore}</span> : null}
          {anime.bangumiRank !== null ? <span>排名 #{anime.bangumiRank}</span> : null}
          {anime.year !== null ? <span>{anime.year}</span> : null}
          {anime.animeType !== null ? <span>{anime.animeType}</span> : null}
          {anime.bgmId !== null ? (
            <span>BGM {anime.bgmId}</span>
          ) : (
            <span className="text-slate-500">{formatAnimeSource(anime.source)}</span>
          )}
        </div>
        {anime.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {anime.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-slate-300"
              >
                {labelAnimeTag(tag)}
              </span>
            ))}
          </div>
        ) : null}
        {actionLabel ? (
          <div className="mt-4 text-sm font-medium text-cyan-300">{actionLabel}</div>
        ) : null}
      </div>
    </button>
  );
}
