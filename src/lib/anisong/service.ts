import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/app-error";
import { DEFAULT_TIER_CONFIG } from "@/lib/tier-config";
import { rankSongs, songSnapshot } from "./engine";
import { emptySongDocument, MAX_EVENTS, MAX_TRACKS, type SongBoardView, type SongDocument, type SongTrack, type SongDecision } from "./types";
import { objectInput, revisionInput, textInput } from "./validation";
import { discardAudio } from "./audio-storage";
import { cleanSongCovers, songCoverReferences } from "./cover-storage";
import type { SongSnapshot } from "./types";
import { selectedSongIds, songBulkPatch, changeSongCandidates } from "./bulk";

export async function ownedSongBoard(userId: string, id: string) {
  const board = await prisma.songBoard.findFirst({ where: { id, ownerId: userId } });
  if (!board) throw new AppError("曲单不存在或没有访问权限", 404);
  return board;
}
type StoredBoard = Awaited<ReturnType<typeof ownedSongBoard>>;
export function boardView(board: StoredBoard): SongBoardView {
  return { id: board.id, title: board.title, revision: board.revision, document: board.document as unknown as SongDocument,
    shareToken: board.shareToken, updatedAt: board.updatedAt.toISOString() };
}
export async function createSongBoard(userId: string, value: unknown) {
  const input = objectInput(value);
  const title = textInput(input.title, "曲单名称", 80, true);
  if (await prisma.songBoard.count({ where: { ownerId: userId } }) >= 30) throw new AppError("最多创建30个曲单", 400);
  const board = await prisma.songBoard.create({ data: { ownerId: userId, title,
    document: emptySongDocument() as unknown as Prisma.InputJsonValue } });
  return boardView(board);
}
export async function deleteSongBoard(userId: string, id: string, value: unknown) {
  const revision = revisionInput(objectInput(value).revision);
  const board = await ownedSongBoard(userId, id);
  if (revision !== board.revision) throw new AppError("曲单已更新，请重新载入后删除", 409);
  const removed = await prisma.songBoard.deleteMany({ where: { id, ownerId: userId, revision } });
  if (removed.count !== 1) throw new AppError("曲单已更新，请重新载入后删除", 409);
  const document = board.document as unknown as SongDocument;
  await Promise.all(document.tracks.map(t => t.source.kind === "upload" ? discardAudio(t.source.key) : Promise.resolve()));
  await cleanSongCovers(songCoverReferences(document, board.snapshot as unknown as SongSnapshot | null), new Set());
  return { deleted: true };
}
export async function saveSongBoard(board: StoredBoard, expectedRevision: number, document: SongDocument,
  extra: { title?: string; shareToken?: string | null; snapshot?: Prisma.InputJsonValue | typeof Prisma.DbNull } = {}) {
  if (expectedRevision !== board.revision) throw new AppError("曲单已在其他页面更新，请重新载入后再操作", 409);
  const changed = await prisma.songBoard.updateMany({ where: { id: board.id, ownerId: board.ownerId, revision: expectedRevision },
    data: { document: document as unknown as Prisma.InputJsonValue, revision: { increment: 1 }, ...extra } });
  if (changed.count !== 1) throw new AppError("曲单已在其他页面更新，请重新载入后再操作", 409);
  const nextSnapshot = extra.snapshot === Prisma.DbNull ? null : extra.snapshot ?? board.snapshot;
  await cleanSongCovers(
    songCoverReferences(board.document as unknown as SongDocument, board.snapshot as unknown as SongSnapshot | null),
    songCoverReferences(document, nextSnapshot as unknown as SongSnapshot | null)
  );
  // Return exactly this write, not a newer concurrent mutation.
  return boardView({ ...board, ...extra, snapshot: board.snapshot, document: document as unknown as Prisma.JsonValue,
    revision: expectedRevision + 1, updatedAt: new Date() });
}
export async function addSongTrack(board: StoredBoard, revision: number, track: SongTrack) {
  const document = board.document as unknown as SongDocument;
  const previous = document.tracks.find(t => t.id === track.id);
  if (!previous && document.tracks.length >= MAX_TRACKS) throw new AppError(`每份曲单最多${MAX_TRACKS}首歌`, 400);
  const bytes = document.tracks.filter(t => t.id !== track.id).reduce((sum, t) => sum + (t.source.kind === "upload" ? t.source.bytes : 0), 0);
  if (track.source.kind === "upload" && bytes + track.source.bytes > 250 * 1024 * 1024) throw new AppError("本曲单音频已达到250 MB上限", 400);
  const result = await saveSongBoard(board, revision, { ...document,
    tracks: previous ? document.tracks.map(t => t.id === track.id ? track : t) : [...document.tracks, track] });
  if (previous?.source.kind === "upload" && (track.source.kind !== "upload" || track.source.key !== previous.source.key)) await discardAudio(previous.source.key);
  return result;
}
export async function changeSongBoard(userId: string, id: string, value: unknown) {
  const input = objectInput(value);
  const revision = revisionInput(input.revision);
  const board = await ownedSongBoard(userId, id);
  const document = structuredClone(board.document) as unknown as SongDocument;
  // A target deleted by another tab is a revision conflict first. Returning 400
  // here would hide the reload action and strand a preserved bulk-edit draft.
  if (["bulkEdit", "candidateSelection", "candidates"].includes(String(input.action)) && revision !== board.revision) {
    throw new AppError("曲单已在其他页面更新，请重新载入后再操作", 409);
  }
  const extra: Parameters<typeof saveSongBoard>[3] = {};
  let removedAudio: string | null = null;
  switch (input.action) {
    case "bulkEdit": {
      const ids = new Set(selectedSongIds(input.trackIds, document.tracks));
      const patch = songBulkPatch(input.patch);
      document.tracks = document.tracks.map(track => ids.has(track.id) ? { ...track, ...patch } : track);
      break;
    }
    case "candidateSelection": {
      const ids = selectedSongIds(input.trackIds, document.tracks);
      document.candidateIds = changeSongCandidates(document, ids, input.mode);
      break;
    }
    case "vote": {
      const eventId = textInput(input.eventId, "操作编号", 80, true);
      // An identical retry after a lost response is safe; payload reuse is rejected.
      const previous = document.events.find(e => e.id === eventId);
      if (previous) {
        if (previous.leftId !== input.leftId || previous.rightId !== input.rightId || previous.result !== input.result) throw new AppError("操作编号已使用", 409);
        return boardView(board);
      }
      if (document.events.length >= MAX_EVENTS) throw new AppError("本曲单已完成5000次操作，请导出榜单后新建曲单", 400);
      const active = rankSongs(document).active.map(s => s.animeId);
      const leftId = textInput(input.leftId, "歌曲编号", 80, true);
      const rightId = textInput(input.rightId, "歌曲编号", 80, true);
      if (leftId === rightId || !active.includes(leftId) || !active.includes(rightId)) throw new AppError("请选择两首参与对决的歌曲", 400);
      if (!["LEFT_WIN", "RIGHT_WIN", "DRAW", "SKIP", "LEFT_UNSEEN", "RIGHT_UNSEEN"].includes(String(input.result))) throw new AppError("对决选择不正确", 400);
      document.events.push({ id: eventId, leftId, rightId, result: input.result as SongDecision });
      break;
    }
    case "undo":
      if (!document.events.length) throw new AppError("没有可撤回的对决", 400);
      document.events.pop();
      break;
    case "restore": {
      const trackId = textInput(input.trackId, "歌曲编号", 80, true);
      if (!document.tracks.some(t => t.id === trackId)) throw new AppError("歌曲不存在", 404);
      document.events = document.events.filter(e => !(e.result === "LEFT_UNSEEN" && e.leftId === trackId) && !(e.result === "RIGHT_UNSEEN" && e.rightId === trackId));
      break;
    }
    case "tier": {
      const trackId = textInput(input.trackId, "歌曲编号", 80, true);
      if (!document.tracks.some(t => t.id === trackId)) throw new AppError("歌曲不存在", 404);
      if (input.tier === null) delete document.manualTiers[trackId];
      else {
        if (!DEFAULT_TIER_CONFIG.rows.some(r => r.id === input.tier)) throw new AppError("档位不正确", 400);
        document.manualTiers[trackId] = String(input.tier);
      }
      break;
    }
    case "rename": extra.title = textInput(input.title, "曲单名称", 80, true); break;
    case "candidates": {
      if (input.trackIds === null) document.candidateIds = null;
      else {
        if (!Array.isArray(input.trackIds) || input.trackIds.length < 2 || input.trackIds.length > MAX_TRACKS ||
          input.trackIds.some(id => typeof id !== "string" || !document.tracks.some(t => t.id === id))) throw new AppError("请选择至少两首曲单中的歌曲", 400);
        document.candidateIds = [...new Set(input.trackIds as string[])];
        if (document.candidateIds.length < 2) throw new AppError("请选择至少两首不同的歌曲", 400);
      }
      break;
    }
    case "remove": {
      const track = document.tracks.find(t => t.id === input.trackId);
      if (!track) throw new AppError("歌曲不存在", 404);
      if (track.source.kind === "upload") removedAudio = track.source.key;
      document.tracks = document.tracks.filter(t => t.id !== track.id);
      if (document.candidateIds) document.candidateIds = document.candidateIds.filter(id => id !== track.id);
      document.events = document.events.filter(e => e.leftId !== track.id && e.rightId !== track.id);
      delete document.manualTiers[track.id];
      break;
    }
    case "publish":
      extra.shareToken = board.shareToken ?? randomUUID();
      extra.snapshot = songSnapshot(board.title, document) as unknown as Prisma.InputJsonValue;
      break;
    case "unpublish": extra.shareToken = null; extra.snapshot = Prisma.DbNull; break;
    default: throw new AppError("不支持的操作", 400);
  }
  const result = await saveSongBoard(board, revision, document, extra);
  if (removedAudio) await discardAudio(removedAudio);
  return result;
}
