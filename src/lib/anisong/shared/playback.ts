import path from "node:path";
import { stat } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/app-error";
import type { SongAudioProvider, SongPlayback, SongTrack } from "../types";
import { publicAudioDirectory } from "./audio-pool";
import { readNeteaseAccount } from "../netease/accounts";
import { resolveNetease } from "../netease/api";
import { lookupItunes } from "../itunes/api";
export async function resolveSongPlayback(track: SongTrack, boardId: string, userId: string, provider: SongAudioProvider): Promise<SongPlayback> {
  const base = { provider, expiresAt: Date.now() + 3600000, trial: false, start: track.clipStart, length: track.clipLength };
  if (provider === "pool") {
    if (track.source.kind !== "pool") throw new AppError("这首歌尚未保存到公共音频池", 422);
    const asset = await prisma.songAudioAsset.findUnique({ where: { id: track.source.assetId } });
    if (!asset || !(await stat(path.join(publicAudioDirectory(), asset.key)).catch(() => null))?.isFile()) throw new AppError("公共音频暂时缺失，请尝试 iTunes 或反馈给曲单创建者", 404);
    return { ...base, url: `/api/anisong/audio-pool/${asset.id}`, trial: asset.isPreview };
  }
  if (provider === "itunes") {
    const reference = track.itunes ?? (track.source.kind === "itunes" ? track.source : null);
    if (!reference) throw new AppError("这首歌尚未匹配 iTunes 版本", 422);
    const song = await lookupItunes(reference.id, reference.country);
    if (!song.previewUrl) throw new AppError("这个 iTunes 版本暂时没有试听音频", 422);
    return { ...base, url: song.previewUrl, trial: true, start: 0, length: Math.min(30, track.clipLength), expiresAt: Date.now() + 5 * 60000, storeUrl: song.reference.storeUrl };
  }
  if (track.source.kind === "upload") return { ...base, url: `/api/anisong/boards/${boardId}/audio/${track.id}` };
  if (track.source.kind === "url") return { ...base, url: track.source.url };
  if (track.source.kind === "netease") {
    const account = await readNeteaseAccount(userId);
    return { ...base, ...await resolveNetease(track.source.id, account.cookie || "") };
  }
  throw new AppError("此曲目没有可用的原音源", 422);
}
