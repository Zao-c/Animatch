import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/app-error";
import { getAnimeCoverUploadDir, localAnimeCoverPublicPathToFilePath } from "@/lib/anime-cover-upload";
import { ownedSongBoard, boardView } from "../service";
import { emptySongDocument, MAX_TRACKS, type SongDocument, type SongTemplateView, type SongTrack } from "../types";
import { revisionInput } from "../validation";
import { readNeteaseAccount } from "../netease/accounts";
import { ingestSongAudio } from "./audio-pool";
import { discardAudio } from "../audio-storage";
import { cleanSongCovers, songCoverReferences } from "../cover-storage";
import type { SongSnapshot } from "../types";

export function templateSummary(template: { id: string; title: string; revision: number; document: unknown; ownerId: string; owner: { name: string | null; username: string | null }; updatedAt: Date; sourceBoardId?: string | null }, userId?: string): SongTemplateView {
  const document = template.document as SongDocument;
  return { id: template.id, title: template.title, revision: template.revision, trackCount: document.tracks.length, playableCount: document.tracks.filter(t => t.source.kind === "pool" || t.itunes || t.source.kind === "itunes").length, poolCount: document.tracks.filter(t => t.source.kind === "pool").length, itunesCount: document.tracks.filter(t => t.itunes || t.source.kind === "itunes").length, ownerName: template.owner.name || template.owner.username || "曲单创建者", covers: [...new Set(document.tracks.flatMap(t => t.coverUrl ? [t.coverUrl] : []))].slice(0, 5), updatedAt: template.updatedAt.toISOString(), mine: template.ownerId === userId, ...(template.ownerId === userId && template.sourceBoardId ? { ownerBoardId: template.sourceBoardId } : {}) };
}
export function templateDocument(tracks: SongTrack[]): SongDocument {
  // Deliberately exclude the creator's votes, tiers, private URLs and import keys.
  return { ...emptySongDocument(), tracks: tracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, anime: t.anime, kind: t.kind, year: t.year, quarter: t.quarter, tags: [...t.tags], clipStart: t.clipStart, clipLength: t.clipLength, coverUrl: t.coverUrl ?? null, ...(t.itunes ? { itunes: { ...t.itunes } } : {}), source: t.source.kind === "pool" || t.source.kind === "itunes" ? { ...t.source } : { kind: "none" } })) };
}
async function publicCover(url: string | null | undefined) {
  if (!url?.startsWith("/uploads/anime-covers/song-")) return url ?? null;
  const file = localAnimeCoverPublicPathToFilePath(url); if (!file) return null;
  const info = await stat(file).catch(() => null); if (!info?.isFile() || info.size > 5 * 1024 * 1024) return null;
  const bytes = await readFile(file); const key = `shared-song-${createHash("sha256").update(bytes).digest("hex")}.webp`;
  await mkdir(getAnimeCoverUploadDir(), { recursive: true });
  await writeFile(path.join(getAnimeCoverUploadDir(), key), bytes, { flag: "wx" }).catch(error => { if (error.code !== "EEXIST") throw error; });
  return `/uploads/anime-covers/${key}`;
}
export async function publishSongTemplate(userId: string, boardId: string, input: Record<string, unknown>) {
  const revision = revisionInput(input.revision);
  if (input.shareAudioConfirmed !== true) throw new AppError("发布前请确认这些音频可以公开供他人使用", 400);
  const board = await ownedSongBoard(userId, boardId);
  if (board.templateId) throw new AppError("只能发布自己创建的曲单，不能重新发布别人的曲单", 403);
  if (board.revision !== revision) throw new AppError("曲单已更新，请重新载入后发布", 409);
  const document = structuredClone(board.document) as unknown as SongDocument;
  const selected = document.tracks.filter(t => document.candidateIds === null || document.candidateIds.includes(t.id));
  if (selected.length < 2) throw new AppError("公共曲单至少需要两首参赛歌曲", 400);
  const previous = await prisma.songTemplate.findUnique({ where: { sourceBoardId: boardId } });
  const templateId = previous?.id ?? randomUUID();
  const account = selected.some(t => t.source.kind === "netease") ? await readNeteaseAccount(userId) : {};
  const warnings: { trackId: string; title: string; message: string }[] = [];
  const prepared: SongTrack[] = [];
  for (const track of selected) {
    const next = { ...track, coverUrl: await publicCover(track.coverUrl) };
    try {
      const asset = await ingestSongAudio(track, account.cookie || "");
      if (asset) next.source = { kind: "pool", assetId: asset.id };
      else if (!track.itunes && track.source.kind !== "itunes") warnings.push({ trackId: track.id, title: track.title, message: "尚未补充公共音频或 iTunes 匹配" });
    } catch (error) { warnings.push({ trackId: track.id, title: track.title, message: error instanceof AppError ? error.message : "音频入池失败，请上传文件后重新发布" }); }
    prepared.push(next);
  }
  const published = templateDocument(prepared);
  const playableIds = published.tracks.filter(t => t.source.kind === "pool" || t.itunes || t.source.kind === "itunes").map(t => t.id);
  if (playableIds.length < 2) throw new AppError("至少补充两首公共音频或 iTunes 匹配后才能发布。已成功入池的文件会保留供重试复用。", 422);
  if (playableIds.length !== published.tracks.length) published.candidateIds = playableIds;
  const nextDocument = { ...document, tracks: document.tracks.map(track => prepared.find(t => t.id === track.id) ?? track) };
  const result = await prisma.$transaction(async transaction => {
    const changed = await transaction.songBoard.updateMany({ where: { id: boardId, ownerId: userId, revision }, data: { revision: { increment: 1 }, document: nextDocument as unknown as Prisma.InputJsonValue } });
    if (changed.count !== 1) throw new AppError("曲单已更新，请重新载入后发布", 409);
    const template = await transaction.songTemplate.upsert({ where: { id: templateId }, create: { id: templateId, ownerId: userId, sourceBoardId: boardId, title: board.title, document: published as unknown as Prisma.InputJsonValue }, update: { title: board.title, document: published as unknown as Prisma.InputJsonValue, active: true, revision: { increment: 1 } } });
    const saved = await transaction.songBoard.findUniqueOrThrow({ where: { id: boardId } });
    return { board: boardView(saved), template: { id: template.id, revision: template.revision }, warnings, poolCount: published.tracks.filter(t => t.source.kind === "pool").length, itunesCount: published.tracks.filter(t => t.itunes || t.source.kind === "itunes").length };
  });
  // Public files and shared cover copies have independent lifetimes.
  await Promise.all(document.tracks.filter(t => t.source.kind === "upload" && nextDocument.tracks.find(n => n.id === t.id)?.source.kind === "pool").map(t => t.source.kind === "upload" ? discardAudio(t.source.key) : Promise.resolve()));
  await cleanSongCovers(songCoverReferences(document, board.snapshot as unknown as SongSnapshot | null), songCoverReferences(nextDocument, board.snapshot as unknown as SongSnapshot | null));
  return result;
}
/** A range belongs to one participant; changing it never edits the public source. */
export function selectedPublicSongIds(value: unknown, available: string[]): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_TRACKS || value.some(id => typeof id !== "string"))
    throw new AppError("请至少选择两首参赛歌曲", 400);
  const ids = [...new Set(value as string[])];
  const allowed = new Set(available);
  if (ids.length < 2 || ids.some(id => !allowed.has(id))) throw new AppError("参赛范围包含无效或已移除的歌曲，请刷新页面", 400);
  return ids.length === available.length ? null : ids;
}

export async function startSongTemplate(userId: string, templateId: string, input: { candidateIds?: unknown } = {}) {
  const template = await prisma.songTemplate.findFirst({ where: { id: templateId, active: true } });
  if (!template) throw new AppError("公共曲单不存在或已下架", 404);
  // The creator already owns the source board. Do not create a second personal
  // run merely because they entered via the public URL or called the start API.
  const existing = template.ownerId === userId && template.sourceBoardId
    ? (await prisma.songBoard.findFirst({ where: { id: template.sourceBoardId, ownerId: userId } })
      ?? await prisma.songBoard.findUnique({ where: { ownerId_templateId: { ownerId: userId, templateId } } }))
    : await prisma.songBoard.findUnique({ where: { ownerId_templateId: { ownerId: userId, templateId } } });
  const publicIds = (template.document as unknown as SongDocument).tracks.map(track => track.id);
  if (publicIds.length < 2) throw new AppError("曲单至少需要两首歌曲才能开始对决", 422);
  const hasSelection = Object.prototype.hasOwnProperty.call(input, "candidateIds");
  const selected = hasSelection ? selectedPublicSongIds(input.candidateIds, publicIds) : undefined;
  if (existing) {
    if (!hasSelection) return boardView(existing);
    const doc = existing.document as unknown as SongDocument;
    const ids = doc.tracks.map(track => track.id);
    // Existing runs can reference an older publication. Never silently lose prior votes.
    const next = selectedPublicSongIds(input.candidateIds, ids);
    if (JSON.stringify(doc.candidateIds) === JSON.stringify(next)) return boardView(existing);
    const changed = await prisma.songBoard.updateMany({
      where: { id: existing.id, ownerId: userId, revision: existing.revision },
      data: { document: { ...doc, candidateIds: next } as unknown as Prisma.InputJsonValue, revision: { increment: 1 } }
    });
    if (!changed.count) throw new AppError("个人曲单刚刚更新，请重新进入后再调整范围", 409);
    return boardView({ ...existing, document: { ...doc, candidateIds: next } as unknown as Prisma.JsonValue, revision: existing.revision + 1, updatedAt: new Date() });
  }
  if (await prisma.songBoard.count({ where: { ownerId: userId, templateId: { not: null } } }) >= 200)
    throw new AppError("最多保留200份公共曲单对决进度，请先整理个人曲单", 400);
  const document = templateDocument((template.document as unknown as SongDocument).tracks);
  // All tracks remain eligible by default, including songs without a licensed preview.
  if (hasSelection) document.candidateIds = selected ?? null;
  const board = await prisma.songBoard.upsert({
    where: { ownerId_templateId: { ownerId: userId, templateId } },
    update: {},
    create: { ownerId: userId, templateId, templateRevision: template.revision, title: template.title, document: document as unknown as Prisma.InputJsonValue }
  });
  // If a concurrent request created the run first, honour the user's range through a retry.
  if (hasSelection && JSON.stringify((board.document as unknown as SongDocument).candidateIds) !== JSON.stringify(document.candidateIds))
    return startSongTemplate(userId, templateId, input);
  return boardView(board);
}
