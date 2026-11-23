import { AppError } from "@/lib/app-error";
import { MAX_TRACKS, type SongDocument, type SongTrack } from "./types";
import { objectInput, trackInput } from "./validation";

export const BULK_SONG_FIELDS = ["anime", "kind", "year", "quarter", "tags"] as const;
export type SongBulkPatch = Partial<Pick<SongTrack, typeof BULK_SONG_FIELDS[number]>>;

export function selectedSongIds(value: unknown, tracks: SongTrack[]): string[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_TRACKS || value.some(id => typeof id !== "string" || !tracks.some(t => t.id === id))) {
    throw new AppError("请选择当前曲单中的歌曲；歌曲可能已被移除，请重新载入", 400);
  }
  return [...new Set(value as string[])];
}
export function songBulkPatch(value: unknown): SongBulkPatch {
  const input = objectInput(value);
  const keys = Object.keys(input);
  if (!keys.length || keys.some(key => !(BULK_SONG_FIELDS as readonly string[]).includes(key))) throw new AppError("请选择要批量修改的动画、类型、年份、季度或标签", 400);
  if (keys.includes("kind") && input.kind == null) throw new AppError("歌曲类型不能为空", 400);
  // Use the same constraints as single-song editing; only explicitly chosen fields survive.
  const validated = trackInput({ ...input, title: "批量编辑" });
  return Object.fromEntries(keys.map(key => [key, validated[key as keyof SongBulkPatch]])) as SongBulkPatch;
}
export function changeSongCandidates(document: SongDocument, trackIds: string[], mode: unknown): string[] | null {
  if (mode !== "include" && mode !== "exclude") throw new AppError("参赛范围操作不正确", 400);
  if (mode === "include" && document.candidateIds === null) return null;
  const selected = new Set(trackIds);
  const current = new Set(document.candidateIds ?? document.tracks.map(t => t.id));
  const next = document.tracks.filter(t => mode === "include" ? current.has(t.id) || selected.has(t.id) : current.has(t.id) && !selected.has(t.id)).map(t => t.id);
  if (next.length < 2) throw new AppError("参赛范围至少需保留两首歌曲", 400);
  return next;
}
