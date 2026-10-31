import { AppError } from "@/lib/app-error";
import { DEFAULT_TIER_CONFIG } from "@/lib/tier-config";
import { rankSongs } from "./engine";
import type { SongDocument } from "./types";

export const SONG_EDITABLE_TIERS = DEFAULT_TIER_CONFIG.rows.map(row => row.id);
export const SONG_TIER_LAYOUT_ROWS = [...SONG_EDITABLE_TIERS, "pending"];

/** Validate a complete, fresh visible layout before ever mutating stored data. */
export function applySongTierLayout(document: SongDocument, value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("分档布局格式不正确", 400);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== SONG_TIER_LAYOUT_ROWS.length || Object.keys(input).some(key => !SONG_TIER_LAYOUT_ROWS.includes(key))) {
    throw new AppError("分档布局必须包含全部档位和待比较区", 400);
  }
  const ranking = rankSongs(document);
  const active = new Set(ranking.active.map(score => score.animeId));
  const baseline = new Map<string, string>();
  for (const tierId of SONG_EDITABLE_TIERS) for (const score of ranking.tiers[tierId]) baseline.set(score.animeId, tierId);
  for (const score of ranking.pending) baseline.set(score.animeId, "pending");
  const seen = new Set<string>();
  const rows: Record<string, string[]> = {};
  for (const tierId of SONG_TIER_LAYOUT_ROWS) {
    const ids = input[tierId];
    if (!Array.isArray(ids) || ids.length > 64 || ids.some(id => typeof id !== "string")) throw new AppError("分档内容无效", 400);
    rows[tierId] = ids;
    for (const id of ids) {
      if (!active.has(id) || !baseline.has(id) || seen.has(id)) throw new AppError("歌曲不属于当前参赛范围或重复出现", 400);
      if (tierId === "pending" && baseline.get(id) !== "pending") throw new AppError("已比较歌曲不能移回待比较区", 400);
      seen.add(id);
    }
  }
  if (seen.size !== baseline.size) throw new AppError("分档缺少歌曲，请重新载入", 400);
  // Explicitly moved songs become manual placements; untouched automatic songs remain automatic.
  for (const tierId of SONG_EDITABLE_TIERS) {
    for (const id of rows[tierId]) {
      if (baseline.get(id) !== tierId) document.manualTiers[id] = tierId;
    }
  }
  // Do not lose previously saved ordering for excluded songs outside the current scope.
  const previous = document.manualOrder ?? {};
  document.manualOrder = Object.fromEntries(SONG_EDITABLE_TIERS.map(tier => [
    tier, [...rows[tier], ...(Array.isArray(previous[tier]) ? previous[tier].filter(id => !active.has(id)) : [])]
  ]));
}

/** Reset visible items only; exclusions and unheard items keep their own preferences. */
export function resetSongTierLayout(document: SongDocument): void {
  const selected = new Set(rankSongs(document).active.map(score => score.animeId));
  for (const id of selected) delete document.manualTiers[id];
  if (document.manualOrder) {
    for (const tierId of SONG_EDITABLE_TIERS) document.manualOrder[tierId] = (document.manualOrder[tierId] ?? []).filter(id => !selected.has(id));
    if (Object.values(document.manualOrder).every(row => row.length === 0)) delete document.manualOrder;
  }
}
