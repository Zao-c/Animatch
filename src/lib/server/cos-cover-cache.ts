import crypto from "crypto";
import { readFile, stat } from "fs/promises";
import sharp from "sharp";
import COS from "cos-nodejs-sdk-v5";
import { prisma } from "../db";
import {
  isLocalUploadPublicPath,
  localUploadPublicPathToFilePath
} from "../anime-cover-upload";
import { getDispatcher } from "./outbound-fetch";
import { readLimitedBody } from "./read-limited-body";

export interface CacheableAnimeCover {
  id: string;
  bgmId: number | null;
  title?: string | null;
  cachedCoverUrl?: string | null;
  imageUrl?: string | null;
  imageSmallUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
  thumbnailUrl?: string | null;
  cachedCoverKey?: string | null;
  cachedCoverSourceUrl?: string | null;
}

export interface CoverCacheResult {
  url: string;
  key: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string;
}

/** Where a cacheable cover comes from: a remote URL or a locally uploaded file. */
export type CoverSource =
  | { kind: "remote"; url: string }
  | { kind: "local"; publicPath: string };

interface CosCoverConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  publicBaseUrl: string | null;
  prefix: string;
  objectAcl: string | null;
}

interface BackgroundCosCacheState {
  running: boolean;
  queue: CacheableAnimeCover[];
  queuedAnimeIds: Set<string>;
  droppedCount: number;
}

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 6500;
const MAX_BACKGROUND_QUEUE = 2000;
const BACKGROUND_CONCURRENCY = 2;
const DEFAULT_COVER_PREFIX = "animatch/covers";
const retryAfterByAnimeId = new Map<string, number>();

export type CosCoverBackgroundQueueResult =
  | "queued"
  | "duplicate"
  | "fresh"
  | "overflow"
  | "unconfigured"
  | "no-source";

declare global {
  // eslint-disable-next-line no-var
  var __animatchCosCoverCacheState: BackgroundCosCacheState | undefined;
}

export function isCosCoverCacheConfigured(): boolean {
  return getCosCoverConfig() !== null;
}

export function cacheAnimeCoverToCosBackground(
  anime: CacheableAnimeCover | null | undefined
): CosCoverBackgroundQueueResult {
  if (!anime) return "no-source";
  if (!getCosCoverConfig()) return "unconfigured";
  const source = pickCoverSource(anime);
  if (!source) return "no-source";
  if (hasFreshCachedCover(anime, coverSourceKey(source))) return "fresh";
  if ((retryAfterByAnimeId.get(anime.id) ?? 0) > Date.now()) return "duplicate";

  const state = getBackgroundState();
  if (state.queuedAnimeIds.has(anime.id)) return "duplicate";
  if (state.queue.length >= MAX_BACKGROUND_QUEUE) {
    state.droppedCount += 1;
    console.warn("[COS cover cache] queue overflow", {
      animeId: anime.id,
      bgmId: anime.bgmId,
      queueLength: state.queue.length,
      droppedCount: state.droppedCount
    });
    return "overflow";
  }

  state.queuedAnimeIds.add(anime.id);
  state.queue.push(anime);

  if (!state.running) {
    void drainBackgroundQueue(state);
  }

  return "queued";
}

export function cacheAnimeCoversToCosBackground(
  animes: Array<CacheableAnimeCover | null | undefined>
): Record<CosCoverBackgroundQueueResult, number> {
  const summary = createQueueSummary();
  for (const anime of animes) {
    summary[cacheAnimeCoverToCosBackground(anime)] += 1;
  }
  return summary;
}

export async function cacheAnimeCoverToCos(
  anime: CacheableAnimeCover,
  options: { force?: boolean } = {}
): Promise<CoverCacheResult | null> {
  const config = getCosCoverConfig();
  if (!config) return null;

  const source = pickCoverSource(anime);
  if (!source) return null;
  const sourceKey = coverSourceKey(source);
  if (!options.force && hasFreshCachedCover(anime, sourceKey)) return null;

  const downloaded = await loadSourceImage(source);
  const prepared = await prepareCoverObject(source, downloaded);

  const contentHash = crypto.createHash("sha256").update(prepared.body).digest("hex");
  const key = buildCoverKey(config.prefix, anime, sourceKey, contentHash, prepared.extension);
  await putCosObject(config, key, prepared.body, prepared.contentType);

  const url = buildPublicUrl(config, key);
  const previousKey = anime.cachedCoverKey ?? null;
  await prisma.anime.update({
    where: { id: anime.id },
    data: {
      cachedCoverUrl: url,
      cachedCoverKey: key,
      cachedCoverSourceUrl: sourceKey,
      cachedCoverContentHash: contentHash,
      cachedCoverWidth: prepared.width,
      cachedCoverHeight: prepared.height,
      cachedCoverFormat: prepared.format,
      cachedCoverBytes: prepared.body.byteLength,
      cachedCoverAt: new Date(),
      imageStatus: "OK"
    }
  });

  // Keys embed the content hash, so a refresh would otherwise leave the old object behind.
  if (previousKey !== null && previousKey !== key) {
    await deleteCosObject(config, previousKey);
  }

  return {
    url,
    key,
    width: prepared.width,
    height: prepared.height,
    bytes: prepared.body.byteLength,
    format: prepared.format
  };
}

export async function deleteAnimeCoverCosObject(anime: {
  cachedCoverKey?: string | null;
}): Promise<void> {
  const config = getCosCoverConfig();
  if (!config || !anime.cachedCoverKey) return;
  await deleteCosObject(config, anime.cachedCoverKey);
}

const COS_CONTENT_TYPES: Record<string, { contentType: string; extension: string }> = {
  png: { contentType: "image/png", extension: "png" },
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  webp: { contentType: "image/webp", extension: "webp" },
  gif: { contentType: "image/gif", extension: "gif" },
  avif: { contentType: "image/avif", extension: "avif" }
};

/**
 * Uploaded art is mirrored byte-for-byte so the CDN copy looks exactly like the
 * user's file; only remote catalog covers are downscaled to save bandwidth.
 */
async function prepareCoverObject(source: CoverSource, downloaded: Buffer) {
  if (source.kind === "local") {
    const meta = await sharp(downloaded).metadata();
    const format = meta.format ?? "png";
    const type = COS_CONTENT_TYPES[format] ?? { contentType: "image/png", extension: "png" };
    return {
      body: downloaded,
      contentType: type.contentType,
      extension: type.extension,
      format,
      width: meta.width ?? null,
      height: meta.height ?? null
    };
  }

  const processed = await sharp(downloaded)
    .rotate()
    .resize({
      width: 600,
      height: 900,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return {
    body: processed.data,
    contentType: "image/webp",
    extension: "webp",
    format: "webp",
    width: processed.info.width ?? null,
    height: processed.info.height ?? null
  };
}

function getBackgroundState(): BackgroundCosCacheState {
  globalThis.__animatchCosCoverCacheState ??= {
    running: false,
    queue: [],
    queuedAnimeIds: new Set(),
    droppedCount: 0
  };

  return globalThis.__animatchCosCoverCacheState;
}

function createQueueSummary(): Record<CosCoverBackgroundQueueResult, number> {
  return {
    queued: 0,
    duplicate: 0,
    fresh: 0,
    overflow: 0,
    unconfigured: 0,
    "no-source": 0
  };
}

async function drainBackgroundQueue(state: BackgroundCosCacheState): Promise<void> {
  state.running = true;

  try {
    while (state.queue.length > 0) {
      const batch = state.queue.splice(0, BACKGROUND_CONCURRENCY);

      await Promise.allSettled(
        batch.map(async (anime) => {
          try {
            await cacheAnimeCoverToCos(anime);
            retryAfterByAnimeId.delete(anime.id);
          } catch (error) {
            retryAfterByAnimeId.set(anime.id, Date.now() + 60000);
            if (retryAfterByAnimeId.size > MAX_BACKGROUND_QUEUE) {
              retryAfterByAnimeId.delete(retryAfterByAnimeId.keys().next().value!);
            }
            console.warn("[COS cover cache] failed", {
              animeId: anime.id,
              bgmId: anime.bgmId,
              message: error instanceof Error ? error.message : "Unknown error"
            });
          } finally {
            state.queuedAnimeIds.delete(anime.id);
          }
        })
      );
    }
  } finally {
    state.running = false;
  }
}

function getCosCoverConfig(): CosCoverConfig | null {
  const secretId = process.env.COS_SECRET_ID?.trim();
  const secretKey = process.env.COS_SECRET_KEY?.trim();
  const bucket = process.env.COS_BUCKET?.trim();
  const region = process.env.COS_REGION?.trim();

  if (!secretId || !secretKey || !bucket || !region) {
    return null;
  }

  return {
    secretId,
    secretKey,
    bucket,
    region,
    publicBaseUrl: trimTrailingSlash(process.env.COS_PUBLIC_BASE_URL?.trim() || null),
    prefix: normalizePrefix(process.env.COS_COVER_PREFIX ?? DEFAULT_COVER_PREFIX),
    objectAcl: normalizeAcl(process.env.COS_OBJECT_ACL ?? "public-read")
  };
}

/**
 * Resolves the first cacheable cover source, in the same field priority the
 * display layer uses. Local uploads (custom items, anime cover uploads) are
 * cacheable too, so user-uploaded art also lands on COS instead of staying on
 * the application disk.
 */
export function pickCoverSource(anime: CacheableAnimeCover): CoverSource | null {
  const candidates = [
    anime.imageLargeUrl,
    anime.imageMediumUrl,
    anime.imageUrl,
    anime.imageSmallUrl,
    anime.thumbnailUrl
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    if (isLocalUploadPublicPath(value)) {
      return { kind: "local", publicPath: value };
    }
    if (/^https?:\/\//i.test(value) && !isCosObjectUrl(value)) {
      return { kind: "remote", url: value };
    }
  }

  return null;
}

/** Stable identifier stored in cachedCoverSourceUrl to detect stale covers. */
export function coverSourceKey(source: CoverSource): string {
  return source.kind === "remote" ? source.url : source.publicPath;
}

function hasFreshCachedCover(anime: CacheableAnimeCover, sourceKey: string): boolean {
  return Boolean(anime.cachedCoverUrl && anime.cachedCoverSourceUrl === sourceKey);
}

async function loadSourceImage(source: CoverSource): Promise<Buffer> {
  if (source.kind === "remote") {
    return downloadImage(source.url);
  }

  const filePath = localUploadPublicPathToFilePath(source.publicPath);
  if (filePath === null) {
    throw new Error("local upload path is invalid");
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (fileStat === null) {
    throw new Error("local upload is missing");
  }
  if (fileStat.size > MAX_SOURCE_BYTES) {
    throw new Error("source image is too large");
  }

  return readFile(filePath);
}

async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const dispatcher = await getDispatcher(url).catch(() => undefined);
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      signal: controller.signal,
      headers: {
        "user-agent": "AniMatchCoverCache/1.0"
      }
    };
    if (dispatcher !== undefined) {
      fetchOptions.dispatcher = dispatcher;
    }

    const response = await fetch(url, {
      ...fetchOptions
    });

    if (!response.ok) {
      throw new Error(`source image returned ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_SOURCE_BYTES) {
      throw new Error("source image is too large");
    }

    return await readLimitedBody(response, MAX_SOURCE_BYTES, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function putCosObject(config: CosCoverConfig, key: string, body: Buffer, contentType: string): Promise<void> {
  const cos = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey
  });

  return new Promise((resolve, reject) => {
    const params: COS.PutObjectParams = {
        Bucket: config.bucket,
        Region: config.region,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable"
    };
    if (config.objectAcl) {
      params.ACL = config.objectAcl as COS.ObjectACL;
    }

    cos.putObject(
      params,
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

function buildCoverKey(
  prefix: string,
  anime: CacheableAnimeCover,
  sourceUrl: string,
  contentHash: string,
  extension = "webp"
): string {
  const sourcePart = anime.bgmId ? `bangumi-${anime.bgmId}` : anime.id;
  const hash = crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
  return `${prefix}/${safeKeyPart(sourcePart)}/${hash}-${contentHash.slice(0, 12)}.${extension}`;
}

function deleteCosObject(config: CosCoverConfig, key: string): Promise<void> {
  const cos = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey
  });

  return new Promise((resolve) => {
    cos.deleteObject(
      { Bucket: config.bucket, Region: config.region, Key: key },
      (error) => {
        // Losing an orphan cleanup must never break the cache refresh.
        if (error) {
          console.warn("[COS cover cache] failed to delete stale object", {
            key,
            message: error.message
          });
        }
        resolve();
      }
    );
  });
}

function buildPublicUrl(config: CosCoverConfig, key: string): string {
  const base = config.publicBaseUrl ?? `https://${config.bucket}.cos.${config.region}.myqcloud.com`;
  return `${base}/${encodeCosKey(key)}`;
}

function encodeCosKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function normalizePrefix(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_COVER_PREFIX;
}

function trimTrailingSlash(value: string | null): string | null {
  return value ? value.replace(/\/+$/g, "") : null;
}

function normalizeAcl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return null;
  return trimmed;
}

function safeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
}

function isCosObjectUrl(url: string): boolean {
  return /\.cos\.[a-z0-9-]+\.myqcloud\.com\//i.test(url);
}
