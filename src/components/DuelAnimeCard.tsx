"use client";

import { MatchChoiceCard } from "./MatchPresentation";
import { getAnimeCoverUrl, getAnimeSourceCoverCandidates } from "@/lib/anime-cover-url";
import { getAnimeDisplaySubtitle, getAnimeDisplayTitle } from "@/lib/anime-display";
import { smartCoverUrl } from "@/lib/smart-cover-url";
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
  const coverUrl = getAnimeCoverUrl(anime, { intent: "hero" });
  // Match is a tall card: use the same 2:3 derivative as the pool artwork wall.
  // Keep the original as a fallback if the thumbnail endpoint is unavailable.
  const matchCoverUrl = smartCoverUrl(coverUrl, anime.source, "match");
  const isSmartCover = matchCoverUrl !== coverUrl;
  const secondarySrc = isSmartCover
    ? coverUrl
    : getAnimeSourceCoverCandidates(anime).find((url) => url !== coverUrl);
  const aniScore = getAniScore(anime.eloScore, scoreDistribution);
  return <MatchChoiceCard title={title} src={matchCoverUrl} secondarySrc={secondarySrc} fallbackSrcs={getAnimeSourceCoverCandidates(anime)} animeId={anime.id}
    fit={isSmartCover ? "cover" : "contain"} side={side} actionLabel={actionLabel} disabled={disabled} onPick={onPick} highlighted={highlighted} className={className}
    details={<>{subtitle && <p className="mb-2 text-slate-400">{subtitle}</p>}<p>AniScore {aniScore.label} · 对决 {anime.compareCount} 次 · Elo {anime.eloScore.toFixed(0)}</p>{anime.display?.isOverridden && <p className="text-cyan-200">作品信息已手动修正</p>}</>} />;
}
