import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/app-error";
import { audioDirectory, detectAudio } from "../audio-storage";
import { MAX_AUDIO_BYTES, type SongTrack } from "../types";
import { resolveNetease } from "../netease/api";
import { downloadPublicAudio } from "./download";
export function publicAudioDirectory() { return process.env.ANISONG_PUBLIC_AUDIO_DIR || path.join(process.cwd(), "data/anisong-public-audio"); }
let ingestion = Promise.resolve();
async function serial<T>(work: () => Promise<T>): Promise<T> {
  const previous = ingestion; let release!: () => void; ingestion = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await work(); } finally { release(); }
}
export async function storePublicAudio(bytes: Uint8Array, isPreview = false) {
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new AppError("入池音频需在20 MB以内", 400);
  const format = detectAudio(bytes); if (!format) throw new AppError("音频格式不支持或文件无效", 400);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return serial(async () => {
    const previous = await prisma.songAudioAsset.findUnique({ where: { sha256 } });
    if (previous) {
      // Repair a missing file without creating another asset or changing its URL.
      await mkdir(publicAudioDirectory(), { recursive: true });
      await writeFile(path.join(publicAudioDirectory(), previous.key), bytes, { flag: "wx", mode: 0o600 }).catch(error => { if (error.code !== "EEXIST") throw error; });
      return previous;
    }
    const quota = Math.max(250 * 1024 * 1024, Number(process.env.ANISONG_PUBLIC_AUDIO_QUOTA_BYTES) || 5 * 1024 * 1024 * 1024);
    const used = (await prisma.songAudioAsset.aggregate({ _sum: { bytes: true } }))._sum.bytes ?? 0;
    if (used + bytes.length > quota) throw new AppError("公共音频池存储已满，请联系管理员", 507);
    const key = `${sha256}.${format.extension}`;
    await mkdir(publicAudioDirectory(), { recursive: true });
    await writeFile(path.join(publicAudioDirectory(), key), bytes, { flag: "wx", mode: 0o600 }).catch(error => { if (error.code !== "EEXIST") throw error; });
    return prisma.songAudioAsset.upsert({ where: { sha256 }, update: {}, create: { sha256, key, mime: format.mime, bytes: bytes.length, isPreview } });
  });
}
export async function ingestSongAudio(track: SongTrack, cookie: string) {
  if (track.source.kind === "pool") {
    const asset = await prisma.songAudioAsset.findUnique({ where: { id: track.source.assetId } });
    if (!asset || !(await stat(path.join(publicAudioDirectory(), asset.key)).catch(() => null))?.isFile()) throw new AppError("公共音频文件缺失，请补充音频", 404);
    return asset;
  }
  if (track.source.kind === "upload") {
    if (!/^[a-f0-9-]+\.(mp3|m4a|wav|ogg|flac)$/.test(track.source.key)) throw new AppError("音频文件无效", 400);
    const file = path.join(audioDirectory(), track.source.key); const info = await stat(file);
    if (info.size > MAX_AUDIO_BYTES) throw new AppError("音频超过20 MB", 413);
    return storePublicAudio(await readFile(file));
  }
  if (track.source.kind === "url") return storePublicAudio(await downloadPublicAudio(track.source.url));
  if (track.source.kind === "netease") {
    const playback = await resolveNetease(track.source.id, cookie);
    return storePublicAudio(await downloadPublicAudio(playback.url), playback.trial);
  }
  return null;
}
