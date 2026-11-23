import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/app-error";
import { DEFAULT_TIER_CONFIG } from "@/lib/tier-config";
import { rankSongs, songSnapshot } from "./engine";
import { emptySongDocument, MAX_BOARD_AUDIO_BYTES, MAX_EVENTS, MAX_TRACKS, type SongBoardView, type SongDocument, type SongTrack, type SongDecision } from "./types";
import { objectInput, revisionInput, textInput } from "./validation";
import { discardAudio } from "./audio-storage";
import { cleanSongCovers, songCoverReferences } from "./cover-storage";
import type { SongSnapshot } from "./types";
import { selectedSongIds, songBulkPatch, changeSongCandidates } from "./bulk";
import { applySongTierLayout, resetSongTierLayout, SONG_EDITABLE_TIERS } from "./tier-layout";
import { publicSongDocument } from "./publication";

export async function ownedSongBoard(userId: string, id: string) {
  const board = await prisma.songBoard.findFirst({ where: { id, ownerId: userId } });
  if (!board) throw new AppError("曲单不存在或没有访问权限", 404);
  return board;
}
type StoredBoard = Awaited<ReturnType<typeof ownedSongBoard>>;
export function boardView(board: StoredBoard): SongBoardView {
  return { id: board.id, title: board.title, revision: board.revision, document: board.document as unknown as SongDocument,
    shareToken: board.shareToken, updatedAt: board.updatedAt.toISOString(), templateId: board.templateId ?? null, templateRevision: board.templateRevision ?? null };
}
export async function createSongBoard(userId: string, value: unknown) {
  const input = objectInput(value);
  const title = textInput(input.title, "曲单名称", 80, true);
  if (await prisma.songBoard.count({ where: { ownerId: userId, templateId: null } }) >= 30) throw new AppError("最多创建30个曲单", 400);
  // New playlists are discoverable by default. No private/uploaded audio is published.
  const board = await prisma.$transaction(async transaction => {
    const created = await transaction.songBoard.create({ data: { ownerId: userId, title,
      document: emptySongDocument() as unknown as Prisma.InputJsonValue } });
    if (input.isPublic !== false) await transaction.songTemplate.create({ data: {
      ownerId: userId, sourceBoardId: created.id, title,
      document: emptySongDocument() as unknown as Prisma.InputJsonValue
    } });
    return created;
  });
  return boardView(board);
}
export async function deleteSongBoard(userId: string, id: string, value: unknown) {
  const revision = revisionInput(objectInput(value).revision);
  const board = await ownedSongBoard(userId, id);
  if (revision !== board.revision) throw new AppError("曲单已更新，请重新载入后删除", 409);
  await prisma.$transaction(async transaction => {
    // Retire, do not delete, the published template. SongBoard.templateId uses
    // onDelete:SetNull; deleting a template would silently turn every participant
    // run into an editable "creator" board, changing its permissions and identity.
    // SongTemplate.sourceBoardId uses onDelete:SetNull instead, so deleting only
    // the source board leaves a detached, inactive template to anchor old runs.
    // Both operations are transactional: a revision conflict rolls back the retirement.
    await transaction.songTemplate.updateMany({
      where: { sourceBoardId: id, ownerId: userId },
      data: { active: false }
    });
    const removed = await transaction.songBoard.deleteMany({ where: { id, ownerId: userId, revision } });
    if (removed.count !== 1) throw new AppError("曲单已更新，请重新载入后删除", 409);
  });
  const document = board.document as unknown as SongDocument;
  await Promise.all(document.tracks.map(t => t.source.kind === "upload" ? discardAudio(t.source.key) : Promise.resolve()));
  await cleanSongCovers(songCoverReferences(document, board.snapshot as unknown as SongSnapshot | null), new Set());
  return { deleted: true };
}
export async function saveSongBoard(board: StoredBoard, expectedRevision: number, document: SongDocument,
  extra: { title?: string; shareToken?: string | null; snapshot?: Prisma.InputJsonValue | typeof Prisma.DbNull } = {}, syncPublic = true) {
  if (expectedRevision !== board.revision) throw new AppError("曲单已在其他页面更新，请重新载入后再操作", 409);
  await prisma.$transaction(async transaction => {
    const changed = await transaction.songBoard.updateMany({ where: { id: board.id, ownerId: board.ownerId, revision: expectedRevision },
      data: { document: document as unknown as Prisma.InputJsonValue, revision: { increment: 1 }, ...extra } });
    if (changed.count !== 1) throw new AppError("曲单已在其他页面更新，请重新载入后再操作", 409);
    if (syncPublic && !board.templateId) {
      const template = await transaction.songTemplate.findUnique({ where: { sourceBoardId: board.id } });
      if (template) await transaction.songTemplate.update({ where: { id: template.id }, data: {
        title: extra.title ?? board.title,
        document: publicSongDocument(document, template.document as unknown as SongDocument) as unknown as Prisma.InputJsonValue,
        revision: { increment: 1 }
      } });
    }
  });
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
  if (board.templateId) throw new AppError("参与者不能修改公共曲单的歌曲，请联系创建者", 403);
  const document = board.document as unknown as SongDocument;
  const previous = document.tracks.find(t => t.id === track.id);
  if (!previous && document.tracks.length >= MAX_TRACKS) throw new AppError(`每份曲单最多${MAX_TRACKS}首歌`, 400);
  const bytes = document.tracks.filter(t => t.id !== track.id).reduce((sum, t) => sum + (t.source.kind === "upload" ? t.source.bytes : 0), 0);
  if (track.source.kind === "upload" && bytes + track.source.bytes > MAX_BOARD_AUDIO_BYTES) throw new AppError("本曲单音频已达到2 GB上限", 400);
  const result = await saveSongBoard(board, revision, { ...document,
    tracks: previous ? document.tracks.map(t => t.id === track.id ? track : t) : [...document.tracks, track] });
  if (previous?.source.kind === "upload" && (track.source.kind !== "upload" || track.source.key !== previous.source.key)) await discardAudio(previous.source.key);
  return result;
}
export async function changeSongBoard(userId: string, id: string, value: unknown) {
  const input = objectInput(value);
  const revision = revisionInput(input.revision);
  const board = await ownedSongBoard(userId, id);
  // A participant owns their votes and selected range, not the publisher's song metadata.
  const participantActions = ["candidateSelection", "candidates", "vote", "undo", "restore", "tier", "tierLayout", "tierReset", "publish", "unpublish", "matchMode"];
  if (board.templateId && !participantActions.includes(String(input.action)))
    throw new AppError("这是一份公共曲单的个人对决记录，不能修改原曲单歌曲或名称", 403);
  const document = structuredClone(board.document) as unknown as SongDocument;
  // A target deleted by another tab is a revision conflict first. Returning 400
  // here would hide the reload action and strand a preserved bulk-edit draft.
  if (["bulkEdit", "candidateSelection", "candidates", "tierLayout", "tierReset"].includes(String(input.action)) && revision !== board.revision) {
    throw new AppError("曲单已在其他页面更新，请重新载入后再操作", 409);
  }
  const extra: Parameters<typeof saveSongBoard>[3] = {};
  let removedAudio: string | null = null;
  switch (input.action) {
    case "matchMode": {
      if (input.mode !== "classic" && input.mode !== "quick") throw new AppError("对决模式不正确", 400);
      document.matchMode = input.mode;
      break;
    }
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
    case "tierLayout":
      applySongTierLayout(document, input.rows);
      break;
    case "tierReset":
      resetSongTierLayout(document);
      break;
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
      if (document.manualOrder) for (const tierId of SONG_EDITABLE_TIERS) {
        document.manualOrder[tierId] = (document.manualOrder[tierId] ?? []).filter(id => id !== track.id);
      }
      break;
    }
    case "publish":
      extra.shareToken = board.shareToken ?? randomUUID();
      extra.snapshot = songSnapshot(board.title, document) as unknown as Prisma.InputJsonValue;
      break;
    case "unpublish": extra.shareToken = null; extra.snapshot = Prisma.DbNull; break;
    default: throw new AppError("不支持的操作", 400);
  }
  const result = await saveSongBoard(board, revision, document, extra, ["bulkEdit", "candidateSelection", "candidates", "rename", "remove"].includes(String(input.action)));
  if (removedAudio) await discardAudio(removedAudio);
  return result;
}
