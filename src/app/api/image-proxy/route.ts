import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

/** Bangumi /r/XXX/ resize prefix pattern — strip for cache key normalization */
const BANGUMI_RESIZE_RE = /^\/r\/\d+\//;

function normalizeCacheUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (
      (u.hostname === "lain.bgm.tv" || u.hostname.endsWith(".bgm.tv")) &&
      BANGUMI_RESIZE_RE.test(u.pathname)
    ) {
      u.pathname = u.pathname.replace(BANGUMI_RESIZE_RE, "/");
      return u.toString();
    }
  } catch {
    // fall through to raw
  }
  return raw;
}

/** Background re-fetch after all retries fail — so next visitor gets a cache hit */
const pendingBgRefetch = new Set<string>();

async function bgRefetch(url: string, headers: Record<string, string>): Promise<void> {
  try {
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength > MAX_SIZE || buf.byteLength === 0) return;
    const ctype = resp.headers.get("content-type") ?? "";
    if (!ctype.startsWith("image/")) return;
    const entry = { buffer: buf, contentType: ctype, cachedAt: Date.now(), lastAccessedAt: Date.now() };
    setCacheEntry(url, entry);
    await writeDiskCacheEntry(url, entry);
  } catch {
    // background retry failed — will be retried on next user request
  }
}

const MAX_SIZE = 10 * 1024 * 1024;
const TIMEOUT_MS = 6000;
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MEM_MAX_CACHE_ENTRIES = 500;
const MEM_MAX_CACHE_BYTES = 128 * 1024 * 1024;
const DISK_MAX_CACHE_ENTRIES = 20000;
const DISK_MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024;
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

  const cacheKey = normalizeCacheUrl(parsed.toString());
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

  const maxAttempts = 2;
  let response: Response | undefined;
  let lastError: unknown;

  // MAL hosts are reachable directly from China — bypass the flaky proxy
  const hostname = parsed.hostname.toLowerCase();
  const isMalHost =
    hostname === "myanimelist.net" ||
    hostname.endsWith(".myanimelist.net");
  const useDirect = isMalHost;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = attempt === 1 ? controller : new AbortController();
    const ctrlTimeoutId = attempt === 1 ? timeoutId : setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      if (useDirect) {
        // Bypass proxy for directly-reachable hosts
        const oldNoProxy = process.env.NO_PROXY;
        process.env.NO_PROXY = "*";
        try {
          response = await fetch(parsed.toString(), {
            signal: ctrl.signal,
            headers,
          });
        } finally {
          process.env.NO_PROXY = oldNoProxy ?? "";
        }
      } else {
        response = await fetch(parsed.toString(), {
          signal: ctrl.signal,
          headers,
        });
      }
    } catch (error) {
      clearTimeout(ctrlTimeoutId);
      lastError = error;
      // Serve stale cache immediately if available
      if (staleEntry !== null || staleDiskEntry !== null) {
        clearTimeout(timeoutId);
        if (staleEntry !== null) {
          return cachedImageResponse(staleEntry, "STALE");
        }
        if (staleDiskEntry !== null) {
          setCacheEntry(cacheKey, staleDiskEntry);
          return cachedImageResponse(staleDiskEntry, "DISK-STALE");
        }
      }
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      const message = lastError instanceof DOMException && lastError.name === "AbortError"
        ? "upstream timeout"
        : "fetch failed";
      clearTimeout(timeoutId);
      return errorResponse({ error: message }, 502);
    } finally {
      if (attempt > 1) clearTimeout(ctrlTimeoutId !== timeoutId ? ctrlTimeoutId : undefined);
    }

    // Retry on proxy 502/503 (only when using proxy, not direct)
    if (!response.ok && attempt < maxAttempts &&
        (response.status === 502 || response.status === 503) && !useDirect) {
      await new Promise(r => setTimeout(r, 500 * attempt));
      continue;
    }

    break;
  }

  clearTimeout(timeoutId);

  if (!response || !response.ok) {
    if (staleEntry !== null) {
      return cachedImageResponse(staleEntry, "STALE");
    }
    if (staleDiskEntry !== null) {
      setCacheEntry(cacheKey, staleDiskEntry);
      return cachedImageResponse(staleDiskEntry, "DISK-STALE");
    }
    // Background refetch so next visitor gets a cache hit
    if (!pendingBgRefetch.has(parsed.toString())) {
      pendingBgRefetch.add(parsed.toString());
      setTimeout(() => {
        pendingBgRefetch.delete(parsed.toString());
        bgRefetch(parsed.toString(), headers);
      }, 3000);
    }
    return errorResponse({ error: response ? `upstream returned ${response.status}` : "fetch failed" }, 502);
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
    imageCache.entries.size > MEM_MAX_CACHE_ENTRIES ||
    imageCache.totalBytes > MEM_MAX_CACHE_BYTES
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

  while (entries.length > DISK_MAX_CACHE_ENTRIES || totalBytes > DISK_MAX_CACHE_BYTES) {
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
