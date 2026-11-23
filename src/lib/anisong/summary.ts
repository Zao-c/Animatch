import { rankSongs } from "./engine";
import type { SongDocument } from "./types";

export type SongBoardSummary = {
  id: string;
  title: string;
  updatedAt: string;
  templateId: string | null;
  trackCount: number;
  playableCount: number;
  covers: string[];
  progress: number;
  canStart: boolean;
};

/** Return enough data for lobby cards without exposing full vote ledgers or audio keys. */
export function songBoardSummary(board: {
  id: string; title: string; updatedAt: Date; templateId: string | null; document: unknown;
}): SongBoardSummary {
  const document = board.document as SongDocument;
  const ranking = rankSongs(document);
  const covers: string[] = [];
  const seen = new Set<string>();
  for (const track of document.tracks) {
    if (track.coverUrl && !seen.has(track.coverUrl)) {
      covers.push(track.coverUrl);
      seen.add(track.coverUrl);
      if (covers.length === 5) break;
    }
  }
  return {
    id: board.id, title: board.title, updatedAt: board.updatedAt.toISOString(),
    templateId: board.templateId,
    trackCount: document.tracks.length,
    playableCount: document.tracks.filter(track => track.source.kind !== "none" || Boolean(track.itunes)).length,
    covers,
    progress: ranking.progress.effectiveComparisons,
    canStart: ranking.active.length >= 2
  };
}
