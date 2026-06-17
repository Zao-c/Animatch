import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const DISK_CACHE_DIR =
  process.env.ANIMATCH_IMAGE_CACHE_DIR ??
  path.join(process.cwd(), "data", "image-cache");
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const CDN_CACHE_CONTROL = "public, max-age=604800, stale-while-revalidate=604800";
const ERROR_CACHE_CONTROL = "no-store";
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

const INTERNAL_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
];

interface ImageCacheEntry {
  buffer: Buffer;
  contentType: string;
  cachedAt: number;
  lastAccessedAt: number;
}

interface ImageCacheStore {
  entries: Map<string, ImageCacheEntry>;
  totalBytes: number;
}

interface DiskCacheMetadata {
  contentType: string;
  cachedAt: number;
  lastAccessedAt: number;
  byteLength: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __animatchImageProxyCache: ImageCacheStore | undefined;
}

const imageCache =
  globalThis.__animatchImageProxyCache ??
  (globalThis.__animatchImageProxyCache = {
    entries: new Map<string, ImageCacheEntry>(),
    totalBytes: 0
  });

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) {
    return true;
  }
  for (const pattern of INTERNAL_IP_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  return false;
}

function pickReferer(hostname: string): string | null {
  if (hostname.endsWith(".bgm.tv") || hostname === "bgm.tv") {
    return "https://bgm.tv/";
  }
  if (hostname.endsWith(".bangumi.tv") || hostname === "bangumi.tv") {
    return "https://bangumi.tv/";
  }
  if (hostname.endsWith(".tiermaker.com") || hostname === "tiermaker.com") {
    return "https://tiermaker.com/";
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return errorResponse({ error: "url is required" }, 400);
  }

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return errorResponse({ error: "invalid url" }, 400);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return errorResponse({ error: "protocol not allowed" }, 400);
  }

  if (isBlockedHostname(parsed.hostname)) {
    return errorResponse({ error: "hostname not allowed" }, 400);
  }

  const cacheKey = parsed.toString();
  const freshEntry = getCacheEntry(cacheKey, FRESH_TTL_MS, { deleteExpired: false });
  if (freshEntry !== null) {
    return cachedImageResponse(freshEntry, "HIT");
  }

  const freshDiskEntry = await readDiskCacheEntry(cacheKey, FRESH_TTL_MS, {
    deleteExpired: false
  });
  if (freshDiskEntry !== null) {
    setCacheEntry(cacheKey, freshDiskEntry);
    return cachedImageResponse(freshDiskEntry, "DISK-HIT");
  }

  const staleEntry = getCacheEntry(cacheKey, STALE_TTL_MS, { deleteExpired: true });
  const staleDiskEntry = await readDiskCacheEntry(cacheKey, STALE_TTL_MS, {
    deleteExpired: true
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const referer = pickReferer(parsed.hostname);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 AniMatch-ImageProxy/1.0",
    "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
  };
  if (referer !== null) {
    headers["Referer"] = referer;
  }

  let response: Response;

  try {
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (staleEntry !== null) {
      return cachedImageResponse(staleEntry, "STALE");
    }
    if (staleDiskEntry !== null) {
      setCacheEntry(cacheKey, staleDiskEntry);
      return cachedImageResponse(staleDiskEntry, "DISK-STALE");
    }
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "upstream timeout"
      : "fetch failed";
    return errorResponse({ error: message }, 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (staleEntry !== null) {
      return cachedImageResponse(staleEntry, "STALE");
    }
    if (staleDiskEntry !== null) {
      setCacheEntry(cacheKey, staleDiskEntry);
      return cachedImageResponse(staleDiskEntry, "DISK-STALE");
    }
    return errorResponse({ error: `upstream returned ${response.status}` }, 502);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return errorResponse({ error: "not an image" }, 400);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_SIZE) {
    return errorResponse({ error: "image too large" }, 400);
  }

  let buffer: ArrayBuffer;

  try {
    buffer = await response.arrayBuffer();
  } catch {
    if (staleEntry !== null) {
      return cachedImageResponse(staleEntry, "STALE");
    }
    if (staleDiskEntry !== null) {
      setCacheEntry(cacheKey, staleDiskEntry);
      return cachedImageResponse(staleDiskEntry, "DISK-STALE");
    }
    return errorResponse({ error: "read failed" }, 502);
  }

  if (buffer.byteLength > MAX_SIZE) {
    return errorResponse({ error: "image too large" }, 400);
  }

  const cachedBuffer = Buffer.from(buffer);
  const entry = setCacheEntry(cacheKey, {
    buffer: cachedBuffer,
    contentType,
    cachedAt: Date.now(),
    lastAccessedAt: Date.now()
  });
  await writeDiskCacheEntry(cacheKey, entry);

  return cachedImageResponse(entry, "MISS");
}

function getCacheEntry(
  cacheKey: string,
  maxAgeMs: number,
  options: { deleteExpired: boolean }
): ImageCacheEntry | null {
  const entry = imageCache.entries.get(cacheKey);
  if (entry === undefined) {
    return null;
  }

  if (Date.now() - entry.cachedAt > maxAgeMs) {
    if (options.deleteExpired) {
      imageCache.entries.delete(cacheKey);
      imageCache.totalBytes -= entry.buffer.byteLength;
    }
    return null;
  }

  entry.lastAccessedAt = Date.now();
  imageCache.entries.delete(cacheKey);
  imageCache.entries.set(cacheKey, entry);
  return entry;
}

function setCacheEntry(cacheKey: string, entry: ImageCacheEntry): ImageCacheEntry {
  const previous = imageCache.entries.get(cacheKey);
  if (previous !== undefined) {
    imageCache.totalBytes -= previous.buffer.byteLength;
    imageCache.entries.delete(cacheKey);
  }

  imageCache.entries.set(cacheKey, entry);
  imageCache.totalBytes += entry.buffer.byteLength;
  pruneImageCache();
  return entry;
}

function pruneImageCache(): void {
  while (
    imageCache.entries.size > MAX_CACHE_ENTRIES ||
    imageCache.totalBytes > MAX_CACHE_BYTES
  ) {
    const oldestKey = imageCache.entries.keys().next().value as string | undefined;
    if (oldestKey === undefined) {
      return;
    }
    const oldest = imageCache.entries.get(oldestKey);
    imageCache.entries.delete(oldestKey);
    if (oldest !== undefined) {
      imageCache.totalBytes -= oldest.buffer.byteLength;
    }
  }
}

async function readDiskCacheEntry(
  cacheKey: string,
  maxAgeMs: number,
  options: { deleteExpired: boolean }
): Promise<ImageCacheEntry | null> {
  const paths = getDiskCachePaths(cacheKey);

  try {
    const [metadataRaw, buffer] = await Promise.all([
      fs.readFile(paths.metaPath, "utf8"),
      fs.readFile(paths.bodyPath)
    ]);
    const metadata = JSON.parse(metadataRaw) as Partial<DiskCacheMetadata>;

    if (
      typeof metadata.contentType !== "string" ||
      typeof metadata.cachedAt !== "number" ||
      typeof metadata.byteLength !== "number" ||
      !metadata.contentType.startsWith("image/")
    ) {
      await deleteDiskCacheEntry(paths);
      return null;
    }

    if (Date.now() - metadata.cachedAt > maxAgeMs) {
      if (options.deleteExpired) {
        await deleteDiskCacheEntry(paths);
      }
      return null;
    }

    if (buffer.byteLength !== metadata.byteLength || buffer.byteLength > MAX_SIZE) {
      await deleteDiskCacheEntry(paths);
      return null;
    }

    const entry = {
      buffer,
      contentType: metadata.contentType,
      cachedAt: metadata.cachedAt,
      lastAccessedAt: Date.now()
    };
    void writeDiskMetadata(paths.metaPath, {
      contentType: entry.contentType,
      cachedAt: entry.cachedAt,
      lastAccessedAt: entry.lastAccessedAt,
      byteLength: entry.buffer.byteLength
    });
    return entry;
  } catch {
    return null;
  }
}

async function writeDiskCacheEntry(cacheKey: string, entry: ImageCacheEntry): Promise<void> {
  const paths = getDiskCachePaths(cacheKey);
  await fs.mkdir(DISK_CACHE_DIR, { recursive: true });
  const tmpBodyPath = paths.bodyPath + ".tmp";
  const tmpMetaPath = paths.metaPath + ".tmp";

  try {
    await fs.writeFile(tmpBodyPath, entry.buffer);
    await writeDiskMetadata(tmpMetaPath, {
      contentType: entry.contentType,
      cachedAt: entry.cachedAt,
      lastAccessedAt: entry.lastAccessedAt,
      byteLength: entry.buffer.byteLength
    });
    await Promise.all([
      fs.rename(tmpBodyPath, paths.bodyPath),
      fs.rename(tmpMetaPath, paths.metaPath)
    ]);
    await pruneDiskCache();
  } catch {
    await Promise.allSettled([
      fs.unlink(tmpBodyPath),
      fs.unlink(tmpMetaPath)
    ]);
  }
}

async function writeDiskMetadata(metaPath: string, metadata: DiskCacheMetadata): Promise<void> {
  await fs.mkdir(DISK_CACHE_DIR, { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(metadata), "utf8");
}

async function pruneDiskCache(): Promise<void> {
  let files: string[];

  try {
    files = await fs.readdir(DISK_CACHE_DIR);
  } catch {
    return;
  }

  const metadataFiles = files.filter((file) => file.endsWith(".json"));
  const entries = (
    await Promise.all(
      metadataFiles.map(async (file) => {
        const metaPath = path.join(DISK_CACHE_DIR, file);
        const bodyPath = metaPath.replace(/\.json$/, ".bin");

        try {
          const metadata = JSON.parse(await fs.readFile(metaPath, "utf8")) as Partial<DiskCacheMetadata>;
          const byteLength =
            typeof metadata.byteLength === "number"
              ? metadata.byteLength
              : (await fs.stat(bodyPath)).size;
          return {
            metaPath,
            bodyPath,
            byteLength,
            lastAccessedAt:
              typeof metadata.lastAccessedAt === "number"
                ? metadata.lastAccessedAt
                : 0
          };
        } catch {
          await deleteDiskCacheEntry({ metaPath, bodyPath });
          return null;
        }
      })
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  let totalBytes = entries.reduce((sum, entry) => sum + entry.byteLength, 0);
  entries.sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);

  while (entries.length > MAX_CACHE_ENTRIES || totalBytes > MAX_CACHE_BYTES) {
    const oldest = entries.shift();
    if (oldest === undefined) {
      return;
    }
    await deleteDiskCacheEntry(oldest);
    totalBytes -= oldest.byteLength;
  }
}

function getDiskCachePaths(cacheKey: string): { metaPath: string; bodyPath: string } {
  const hash = crypto.createHash("sha256").update(cacheKey).digest("hex");
  return {
    metaPath: path.join(DISK_CACHE_DIR, `${hash}.json`),
    bodyPath: path.join(DISK_CACHE_DIR, `${hash}.bin`)
  };
}

async function deleteDiskCacheEntry(paths: { metaPath: string; bodyPath: string }): Promise<void> {
  await Promise.allSettled([
    fs.unlink(paths.metaPath),
    fs.unlink(paths.bodyPath)
  ]);
}

function cachedImageResponse(
  entry: ImageCacheEntry,
  cacheStatus: "HIT" | "MISS" | "STALE" | "DISK-HIT" | "DISK-STALE"
) {
  return new NextResponse(bufferToArrayBuffer(entry.buffer), {
    headers: {
      "Content-Type": entry.contentType,
      "Cache-Control": CACHE_CONTROL,
      "CDN-Cache-Control": CDN_CACHE_CONTROL,
      "Content-Length": String(entry.buffer.byteLength),
      "X-Animatch-Image-Cache": cacheStatus
    },
  });
}

function errorResponse(body: Record<string, string>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": ERROR_CACHE_CONTROL, "CDN-Cache-Control": ERROR_CACHE_CONTROL }
  });
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}
