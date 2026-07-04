import crypto from "crypto";
import sharp from "sharp";
import COS from "cos-nodejs-sdk-v5";
import { prisma } from "../db";
import { getDispatcher } from "./outbound-fetch";

interface CacheableAnimeCover {
  id: string;
  bgmId: number | null;
  title?: string | null;
  cachedCoverUrl?: string | null;
  imageUrl?: string | null;
  imageSmallUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
  thumbnailUrl?: string | null;
  cachedCoverSourceUrl?: string | null;
}

interface CoverCacheResult {
  url: string;
  key: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string;
}

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
}

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 6500;
const MAX_BACKGROUND_QUEUE = 160;
const BACKGROUND_CONCURRENCY = 2;
const DEFAULT_COVER_PREFIX = "animatch/covers";

declare global {
  // eslint-disable-next-line no-var
  var __animatchCosCoverCacheState: BackgroundCosCacheState | undefined;
}

export function isCosCoverCacheConfigured(): boolean {
  return getCosCoverConfig() !== null;
}

export function cacheAnimeCoverToCosBackground(anime: CacheableAnimeCover | null | undefined): void {
  if (!anime || !getCosCoverConfig()) return;
  const sourceUrl = pickSourceCoverUrl(anime);
  if (!sourceUrl || hasFreshCachedCover(anime, sourceUrl)) return;

  const state = getBackgroundState();
  if (state.queuedAnimeIds.has(anime.id)) return;
  if (state.queue.length >= MAX_BACKGROUND_QUEUE) return;

  state.queuedAnimeIds.add(anime.id);
  state.queue.push(anime);

  if (!state.running) {
    void drainBackgroundQueue(state);
  }
}

export function cacheAnimeCoversToCosBackground(animes: Array<CacheableAnimeCover | null | undefined>): void {
  for (const anime of animes) {
    cacheAnimeCoverToCosBackground(anime);
  }
}

export async function cacheAnimeCoverToCos(
  anime: CacheableAnimeCover,
  options: { force?: boolean } = {}
): Promise<CoverCacheResult | null> {
  const config = getCosCoverConfig();
  if (!config) return null;

  const sourceUrl = pickSourceCoverUrl(anime);
  if (!sourceUrl) return null;
  if (!options.force && hasFreshCachedCover(anime, sourceUrl)) return null;

  const downloaded = await downloadImage(sourceUrl);
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

  const contentHash = crypto.createHash("sha256").update(processed.data).digest("hex");
  const key = buildCoverKey(config.prefix, anime, sourceUrl, contentHash);
  await putCosObject(config, key, processed.data, "image/webp");

  const url = buildPublicUrl(config, key);
  await prisma.anime.update({
    where: { id: anime.id },
    data: {
      cachedCoverUrl: url,
      cachedCoverKey: key,
      cachedCoverSourceUrl: sourceUrl,
      cachedCoverContentHash: contentHash,
      cachedCoverWidth: processed.info.width ?? null,
      cachedCoverHeight: processed.info.height ?? null,
      cachedCoverFormat: "webp",
      cachedCoverBytes: processed.data.byteLength,
      cachedCoverAt: new Date(),
      imageStatus: "OK"
    }
  });

  return {
    url,
    key,
    width: processed.info.width ?? null,
    height: processed.info.height ?? null,
    bytes: processed.data.byteLength,
    format: "webp"
  };
}

function getBackgroundState(): BackgroundCosCacheState {
  globalThis.__animatchCosCoverCacheState ??= {
    running: false,
    queue: [],
    queuedAnimeIds: new Set()
  };

  return globalThis.__animatchCosCoverCacheState;
}

async function drainBackgroundQueue(state: BackgroundCosCacheState): Promise<void> {
  state.running = true;

  try {
    while (state.queue.length > 0) {
      const batch = state.queue.splice(0, BACKGROUND_CONCURRENCY);
      for (const anime of batch) {
        state.queuedAnimeIds.delete(anime.id);
      }

      await Promise.allSettled(
        batch.map(async (anime) => {
          try {
            await cacheAnimeCoverToCos(anime);
          } catch (error) {
            console.warn("[COS cover cache] failed", {
              animeId: anime.id,
              bgmId: anime.bgmId,
              message: error instanceof Error ? error.message : "Unknown error"
            });
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

function pickSourceCoverUrl(anime: CacheableAnimeCover): string | null {
  const candidates = [
    anime.imageLargeUrl,
    anime.imageMediumUrl,
    anime.imageUrl,
    anime.imageSmallUrl,
    anime.thumbnailUrl
  ];

  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (url && /^https?:\/\//i.test(url) && !isCosObjectUrl(url)) {
      return url;
    }
  }

  return null;
}

function hasFreshCachedCover(anime: CacheableAnimeCover, sourceUrl: string): boolean {
  return Boolean(anime.cachedCoverUrl && anime.cachedCoverSourceUrl === sourceUrl);
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

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_SOURCE_BYTES) {
      throw new Error("source image is too large");
    }

    return buffer;
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

function buildCoverKey(prefix: string, anime: CacheableAnimeCover, sourceUrl: string, contentHash: string): string {
  const sourcePart = anime.bgmId ? `bangumi-${anime.bgmId}` : anime.id;
  const hash = crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
  return `${prefix}/${safeKeyPart(sourcePart)}/${hash}-${contentHash.slice(0, 12)}.webp`;
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
