import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/app-error";
import { audioDirectory, detectAudio } from "../audio-storage";
import { MAX_AUDIO_BYTES, type SongTrack } from "../types";
import { resolveNetease } from "../netease/api";
import { downloadPublicAudio } from "./download";
import { cosAudioObjectExists, getCosAudioObject, isCosAudioConfigured, putCosAudioObject } from "./cos-audio";
import { encodeSongPreview } from "./preview-audio";
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
    const key = `${sha256}.${format.extension}`;
    const isCos = isCosAudioConfigured();
    const cosOriginalExists = previous?.storageProvider === "cos" && await cosAudioObjectExists(previous.key);
    const localOriginalExists = previous?.storageProvider !== "cos" && previous ? (await stat(path.join(publicAudioDirectory(), previous.key)).catch(() => null))?.isFile() === true : false;
    const originalExists = isCos ? cosOriginalExists : (cosOriginalExists || localOriginalExists);
    const previewExists = previous?.previewKey === previous?.key || Boolean(previous?.previewKey && (isCos ? previous.storageProvider === "cos" && await cosAudioObjectExists(previous.previewKey) : (await stat(path.join(publicAudioDirectory(), previous.previewKey)).catch(() => null))?.isFile()));
    if (previous && originalExists && previewExists) return previous;
    const encoded = await encodeSongPreview(key, bytes);
    const preview = encoded ?? { key, mime: format.mime, bytes };
    const quota = Math.max(250 * 1024 * 1024, Number(process.env.ANISONG_PUBLIC_AUDIO_QUOTA_BYTES) || 5 * 1024 * 1024 * 1024);
    if (encoded && !previous?.previewBytes) {
      const used = (await prisma.songAudioAsset.aggregate({ _sum: { bytes: true, previewBytes: true } }))._sum;
      if ((used.bytes ?? 0) + (used.previewBytes ?? 0) + (previous ? 0 : bytes.length) + encoded.bytes.length > quota) throw new AppError("公共音频池存储已满，请联系管理员", 507);
    } else if (!previous) {
      const used = (await prisma.songAudioAsset.aggregate({ _sum: { bytes: true, previewBytes: true } }))._sum;
      if ((used.bytes ?? 0) + (used.previewBytes ?? 0) + bytes.length > quota) throw new AppError("公共音频池存储已满，请联系管理员", 507);
    }
    if (isCos) {
      if (previous && previous.storageProvider !== "local" && previous.storageProvider !== "cos") throw new AppError("公共音频存储位置无效", 500);
      // COS keys are content-addressed, so retrying a failed DB write is safe and cannot replace different audio.
      if (!originalExists) await putCosAudioObject(key, format.mime, bytes);
      if (encoded) await putCosAudioObject(encoded.key, encoded.mime, encoded.bytes);
      const data = { key, storageProvider: "cos", mime: format.mime, bytes: bytes.length, previewKey: preview.key, previewMime: preview.mime, previewBytes: preview.bytes.length, isPreview };
      if (previous) return prisma.songAudioAsset.update({ where: { id: previous.id }, data });
      return prisma.songAudioAsset.upsert({ where: { sha256 }, update: data, create: { sha256, ...data } });
    }
    await mkdir(publicAudioDirectory(), { recursive: true });
    if (!originalExists) await writeFile(path.join(publicAudioDirectory(), key), bytes, { flag: "wx", mode: 0o600 }).catch(error => { if (error.code !== "EEXIST") throw error; });
    if (encoded) await writeFile(path.join(publicAudioDirectory(), encoded.key), encoded.bytes, { flag: "wx", mode: 0o600 }).catch(error => { if (error.code !== "EEXIST") throw error; });
    const data = { key, mime: format.mime, bytes: bytes.length, previewKey: preview.key, previewMime: preview.mime, previewBytes: preview.bytes.length, isPreview };
    if (previous) {
      return prisma.songAudioAsset.update({ where: { id: previous.id }, data: { ...data, storageProvider: "local" } });
    }
    return prisma.songAudioAsset.upsert({ where: { sha256 }, update: data, create: { sha256, ...data } });
  });
}
export async function ingestSongAudio(track: SongTrack, cookie: string) {
  if (track.source.kind === "pool") {
    const asset = await prisma.songAudioAsset.findUnique({ where: { id: track.source.assetId } });
    if (!asset) throw new AppError("公共音频文件缺失，请补充音频", 404);
    if (asset.storageProvider === "cos") {
      if (!(await cosAudioObjectExists(asset.key))) throw new AppError("公共音频文件缺失，请补充音频", 404);
      if (asset.previewKey && (asset.previewKey === asset.key || await cosAudioObjectExists(asset.previewKey))) return asset;
      const localFile = path.join(publicAudioDirectory(), asset.key);
      const localBytes = await readFile(localFile).catch(async () => getCosAudioObject(asset.key));
      return storePublicAudio(localBytes, asset.isPreview);
    }
    const file = path.join(publicAudioDirectory(), asset.key);
    if (!(await stat(file).catch(() => null))?.isFile()) throw new AppError("公共音频文件缺失，请补充音频", 404);
    if (asset.previewKey && (asset.previewKey === asset.key || (await stat(path.join(publicAudioDirectory(), asset.previewKey)).catch(() => null))?.isFile())) return asset;
    return storePublicAudio(await readFile(file), asset.isPreview);
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
