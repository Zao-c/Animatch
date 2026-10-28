import { updateElo } from "@/lib/elo";
import { pickNextPair, type ScoreItem } from "@/lib/ranking-pairing";
import { makePairKey } from "@/lib/pair-key";
import { buildRankingProgress } from "@/lib/ranking-progress";
import { buildTierList } from "@/lib/tier";
import { DEFAULT_TIER_CONFIG } from "@/lib/tier-config";
import type { SongDocument, SongTrack, SongSnapshot } from "./types";

export type SongScore = ScoreItem & { track: SongTrack; manualTier: string | null; manualLocked: boolean };

// Derive scores exclusively from the ledger: undo and reload cannot drift from the votes.
export function rankSongs(document: SongDocument) {
  const selected = new Set(document.candidateIds ?? document.tracks.map(t => t.id));
  const scores = new Map<string, SongScore>(document.tracks.map(track => [track.id, {
    animeId: track.id, track, eloScore: 1500, uncertainty: 350, compareCount: 0,
    isHidden: false, manualTier: document.manualTiers[track.id] ?? null,
    manualLocked: Boolean(document.manualTiers[track.id])
  }]));
  let effectiveComparisons = 0;
  for (const event of document.events) {
    const left = scores.get(event.leftId);
    const right = scores.get(event.rightId);
    if (!left || !right || left === right) continue;
    if (event.result === "LEFT_UNSEEN") { left.isHidden = true; continue; }
    if (event.result === "RIGHT_UNSEEN") { right.isHidden = true; continue; }
    if (event.result === "SKIP") continue;
    if (!selected.has(left.animeId) || !selected.has(right.animeId)) continue;
    const next = updateElo({ leftElo: left.eloScore, rightElo: right.eloScore,
      leftCompareCount: left.compareCount, rightCompareCount: right.compareCount,
      leftUncertainty: left.uncertainty, rightUncertainty: right.uncertainty, result: event.result });
    left.eloScore = next.leftEloAfter;
    right.eloScore = next.rightEloAfter;
    left.uncertainty = next.leftUncertaintyAfter;
    right.uncertainty = next.rightUncertaintyAfter;
    left.compareCount++;
    right.compareCount++;
    effectiveComparisons++;
  }
  const all = [...scores.values()].sort((a, b) => b.eloScore - a.eloScore || a.animeId.localeCompare(b.animeId));
  const active = all.filter(s => !s.isHidden && selected.has(s.animeId));
  // Unheard/uncompared songs must never acquire a fabricated automatic tier.
  const ranked = active.filter(s => s.compareCount > 0 || s.manualLocked);
  const pending = active.filter(s => s.compareCount === 0 && !s.manualLocked);
  const progress = buildRankingProgress({ totalItems: active.length, effectiveComparisons });
  const tiers = buildTierList(ranked, DEFAULT_TIER_CONFIG.rows);
  // Equal automatic ratings share the median tier of their group, not an ID-dependent rank.
  const automatic = ranked.filter(s => !s.manualLocked);
  const groups = new Map<number, SongScore[]>();
  for (const score of automatic) {
    const key = Math.round(score.eloScore * 1e6);
    groups.set(key, [...(groups.get(key) ?? []), score]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const middle = group[Math.floor(group.length / 2)];
    const target = DEFAULT_TIER_CONFIG.rows.find(row => tiers[row.id].some(s => s.animeId === middle.animeId))!.id;
    const ids = new Set(group.map(s => s.animeId));
    for (const row of DEFAULT_TIER_CONFIG.rows) tiers[row.id] = tiers[row.id].filter(s => !ids.has(s.animeId));
    tiers[target].push(...group);
  }
  for (const row of DEFAULT_TIER_CONFIG.rows) tiers[row.id].sort((a, b) => Number(b.manualLocked) - Number(a.manualLocked) || b.eloScore - a.eloScore || a.animeId.localeCompare(b.animeId));
  return { scores: all, active, pending, hidden: all.filter(s => s.isHidden && selected.has(s.animeId)),
    excluded: all.filter(s => !selected.has(s.animeId)),
    tiers, progress };
}

export function nextSongPair(document: SongDocument, random: () => number = Math.random) {
  const ranking = rankSongs(document);
  const compared = new Set(document.events.filter(e => ["LEFT_WIN", "RIGHT_WIN", "DRAW"].includes(e.result))
    .map(e => makePairKey(e.leftId, e.rightId)));
  const recent = new Set(document.events.slice(-12).map(e => makePairKey(e.leftId, e.rightId)));
  const pair = pickNextPair(ranking.active, compared, recent, { stage: ranking.progress.stage, random });
  if (!pair) return null;
  const left = document.tracks.find(t => t.id === pair.leftAnimeId)!;
  const right = document.tracks.find(t => t.id === pair.rightAnimeId)!;
  return random() < 0.5 ? { left, right } : { left: right, right: left };
}

export function songSnapshot(title: string, document: SongDocument): SongSnapshot {
  const ranking = rankSongs(document);
  const rows = [...DEFAULT_TIER_CONFIG.rows.map(row => ({ ...row, scores: ranking.tiers[row.id] })),
    { id: "pending", label: "待比较", color: "#64748b", scores: ranking.pending },
    { id: "hidden", label: "未听过", color: "#475569", scores: ranking.hidden }];
  return { version: 1, title, capturedAt: new Date().toISOString(), comparisons: ranking.progress.effectiveComparisons,
    rows: rows.map(row => ({ id: row.id, label: row.label, color: row.color, songs: row.scores.map(s => ({
      id: s.track.id, title: s.track.title, artist: s.track.artist, anime: s.track.anime, kind: s.track.kind, manual: s.manualLocked
    })) })) };
}
