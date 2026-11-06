"use client";

import { MatchChoiceCard } from "./MatchPresentation";
import { getAnimeDisplaySubtitle, getAnimeDisplayTitle } from "@/lib/anime-display";
import { getMatchArtwork } from "@/lib/match-artwork";
import { getAniScore } from "@/lib/ranking-display";
import type { PublicAnimeWithScore, RankingScoreDistribution } from "@/lib/client-api";

export function DuelAnimeCard({ anime, side, disabled, actionLabel, onPick, scoreDistribution, highlighted = false, className = "" }: {
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
  const artwork = getMatchArtwork(anime);
  const aniScore = getAniScore(anime.eloScore, scoreDistribution);
  return <MatchChoiceCard title={title} src={artwork.src} secondarySrc={artwork.secondarySrc} fallbackSrcs={artwork.fallbackSrcs} animeId={anime.id}
    fit={artwork.fit} side={side} actionLabel={actionLabel} disabled={disabled} onPick={onPick} highlighted={highlighted} className={className}
    details={<>{subtitle && <p className="mb-2 text-slate-400">{subtitle}</p>}<p>AniScore {aniScore.label} · 对决 {anime.compareCount} 次 · Elo {anime.eloScore.toFixed(0)}</p>{anime.display?.isOverridden && <p className="text-cyan-200">作品信息已手动修正</p>}</>} />;
}
