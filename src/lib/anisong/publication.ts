import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { emptySongDocument, type SongDocument, type SongSource, type SongTrack } from "./types";

/** A public playlist contains metadata and *only* explicitly shareable audio.
 * Private uploaded files, arbitrary URLs and NetEase credentials/identifiers never cross this boundary.
 */
export function publicSongDocument(document: SongDocument, published?: SongDocument | null): SongDocument {
  const old = new Map((published?.tracks ?? []).map(track => [track.id, track]));
  const tracks: SongTrack[] = document.tracks.map(track => {
    const earlier = old.get(track.id);
    let source: SongSource = { kind: "none" };
    if (track.source.kind === "itunes") source = track.source;
    else if (track.source.kind === "pool" && earlier?.source.kind === "pool" && earlier.source.assetId === track.source.assetId) source = track.source;
    const { importKey: _unused, ...safe } = track;
    return { ...safe, source };
  });
  const ids = new Set(tracks.map(track => track.id));
  return { ...emptySongDocument(), tracks, candidateIds: document.candidateIds === null ? null : document.candidateIds.filter(id => ids.has(id)) };
}

export type SongVisibility = { isPublic: boolean; templateId: string | null; canManage: boolean };
export async function getSongVisibility(userId: string, boardId: string): Promise<SongVisibility> {
  const board = await prisma.songBoard.findFirst({ where: { id: boardId, ownerId: userId }, select: { id: true, templateId: true } });
  if (!board) throw new AppError("曲单不存在或没有访问权限", 404);
  const template = board.templateId
    ? await prisma.songTemplate.findUnique({ where: { id: board.templateId }, select: { id: true, active: true } })
    : await prisma.songTemplate.findUnique({ where: { sourceBoardId: board.id }, select: { id: true, active: true } });
  return { isPublic: Boolean(template?.active), templateId: template?.active ? template.id : null, canManage: !board.templateId };
}

export async function setSongVisibility(userId: string, boardId: string, makePublic: boolean): Promise<SongVisibility> {
  const board = await prisma.songBoard.findFirst({ where: { id: boardId, ownerId: userId } });
  if (!board) throw new AppError("曲单不存在或没有访问权限", 404);
  if (board.templateId) throw new AppError("公共曲单的个人对决记录不可重新发布，请分享原曲单链接", 400);
  const existing = await prisma.songTemplate.findUnique({ where: { sourceBoardId: boardId } });
  if (makePublic) {
    const document = publicSongDocument(board.document as unknown as SongDocument, existing?.document as unknown as SongDocument | undefined);
    await prisma.songTemplate.upsert({
      where: { sourceBoardId: boardId },
      create: { ownerId: userId, sourceBoardId: boardId, title: board.title, document: document as unknown as Prisma.InputJsonValue },
      update: { active: true, title: board.title, document: document as unknown as Prisma.InputJsonValue, revision: { increment: 1 } }
    });
  } else if (existing) {
    await prisma.songTemplate.update({ where: { id: existing.id }, data: { active: false } });
  }
  return getSongVisibility(userId, boardId);
}
