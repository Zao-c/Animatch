import { makePairKey } from "@/lib/pair-key";
import type { ScoreItem } from "@/lib/ranking-pairing";
import type { SongEvent } from "./types";

const valid = new Set(["LEFT_WIN", "RIGHT_WIN", "DRAW"]);
type Scored = ScoreItem;

function graph(scores: Scored[], events: SongEvent[]) {
  const ids = new Set(scores.map(s => s.animeId));
  const parent = new Map([...ids].map(id => [id, id]));
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p); parent.set(id, root); return root;
  };
  const compared = new Set<string>();
  for (const e of events) {
    if (!valid.has(e.result) || !ids.has(e.leftId) || !ids.has(e.rightId) || e.leftId === e.rightId) continue;
    compared.add(makePairKey(e.leftId, e.rightId));
    parent.set(find(e.leftId), find(e.rightId));
  }
  return { find, compared, components: new Set([...ids].map(find)).size };
}

/** Descriptive coverage only; do not present this as statistical confidence. */
export function quickMatchProgress(scores: Scored[], events: SongEvent[]) {
  const active = scores.filter(s => !s.isHidden);
  const total = active.length;
  const { components } = graph(active, events);
  const covered = active.filter(s => s.compareCount >= 2).length;
  return {
    total, covered, components,
    suggestedBudget: Math.ceil(total * 1.65),
    readyForDraft: total >= 2 && covered === total && components === 1
  };
}

/** Prefer exposure and graph connections, then compare near the same Tier boundary.
 * Existing Elo and all recorded votes remain unchanged. */
export function chooseQuickSongPair<T extends Scored>(scores: T[], events: SongEvent[], random: () => number): [string, string] | null {
  const active = scores.filter(s => !s.isHidden);
  if (active.length < 2) return null;
  const { find, compared, components } = graph(active, events);
  const recent = new Set(events.slice(-12).map(e => makePairKey(e.leftId, e.rightId)));
  const coverage = active.some(s => s.compareCount < 2) || components > 1;
  const ranked = [...active].sort((a,b) => b.eloScore - a.eloScore || a.animeId.localeCompare(b.animeId));
  const rank = new Map(ranked.map((s,i) => [s.animeId,i]));
  const boundary = (index: number) => Math.min(...[.1,.3,.6,.85].map(p => Math.abs(index / Math.max(1,ranked.length - 1) - p)));
  const state: { best: { pair: [string,string]; weight: number } | null } = { best: null };
  function consider(a: T, b: T) {
    if (a.animeId === b.animeId) return;
    const key = makePairKey(a.animeId,b.animeId);
    const cross = find(a.animeId) !== find(b.animeId);
    const low = Math.max(0,3-a.compareCount) + Math.max(0,3-b.compareCount);
    const dist = Math.abs(a.eloScore-b.eloScore);
    const edge = Math.min(boundary(rank.get(a.animeId)!),boundary(rank.get(b.animeId)!));
    const value = coverage
      ? (cross ? 1500 : 0) + (a.compareCount < 2 ? 500 : 0) + (b.compareCount < 2 ? 500 : 0) + low * 35 - Math.min(200,dist)*.25
      : 220/(1+dist/70) + Math.max(0,1-edge*24)*130 + low*70;
    const weight = value - (recent.has(key) ? 3000 : 0) - (compared.has(key) ? 120 : 0) + random()*3;
    if (!state.best || weight > state.best.weight) state.best = { pair: [a.animeId,b.animeId],weight };
  }
  if (coverage) {
    // 256–1000 song pools must not enumerate every possible pair on every
    // vote. Consider the most under-exposed anchors against the entire pool.
    // Scanning all opponents still finds cross-component links, while limiting
    // work to O(24*n) instead of O(n²) for large annual playlists.
    const anchors = active.length > 128
      ? [...active].sort((a,b) => a.compareCount - b.compareCount || a.animeId.localeCompare(b.animeId)).slice(0, 24)
      : active;
    if (active.length > 128) {
      for (const first of anchors) for (const second of active) consider(first, second);
    } else {
      for (let i=0;i<active.length;i++) for (let j=i+1;j<active.length;j++) consider(active[i],active[j]);
    }
  } else {
    for(let i=0;i<ranked.length;i++) {
      for(let j=i+1;j<Math.min(ranked.length,i+13);j++) consider(ranked[i],ranked[j]);
      consider(ranked[i],ranked[Math.floor(random()*ranked.length)]);
    }
  }
  return state.best?.pair ?? null;
}
