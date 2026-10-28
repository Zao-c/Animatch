export const SONG_KINDS = ["OP", "ED", "INSERT", "OTHER"] as const;
export type SongKind = typeof SONG_KINDS[number];
export const KIND_LABELS: Record<SongKind, string> = { OP: "OP", ED: "ED", INSERT: "插入曲", OTHER: "其他" };
export const MAX_TRACKS = 64;
export const MAX_EVENTS = 5000;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_SONG_COVER_BYTES = 5 * 1024 * 1024;
export type SongSource =
  | { kind: "upload"; key: string; mime: string; bytes: number }
  | { kind: "url"; url: string }
  | { kind: "none" };
export type SongTrack = {
  id: string;
  title: string;
  artist: string;
  anime: string;
  kind: SongKind;
  year: number | null;
  quarter: number | null;
  tags: string[];
  clipStart: number;
  clipLength: number;
  source: SongSource;
  coverUrl?: string | null;
};
export type SongDecision = "LEFT_WIN" | "RIGHT_WIN" | "DRAW" | "SKIP" | "LEFT_UNSEEN" | "RIGHT_UNSEEN";
export type SongEvent = { id: string; leftId: string; rightId: string; result: SongDecision };
export type SongDocument = {
  version: 1;
  tracks: SongTrack[];
  events: SongEvent[];
  manualTiers: Record<string, string>;
  candidateIds: string[] | null;
};
export type SongBoardView = {
  id: string;
  title: string;
  revision: number;
  document: SongDocument;
  shareToken: string | null;
  updatedAt: string;
};
export type SongSnapshot = {
  version: 1;
  title: string;
  capturedAt: string;
  comparisons: number;
  rows: { id: string; label: string; color: string; songs: { id: string; title: string; artist: string; anime: string; kind: SongKind; manual: boolean; coverUrl?: string | null }[] }[];
};
export const emptySongDocument = (): SongDocument => ({ version: 1, tracks: [], events: [], manualTiers: {}, candidateIds: null });
