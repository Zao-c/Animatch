import { NextResponse } from "next/server";

const MAX_SIZE = 5 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
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

  const staleEntry = getCacheEntry(cacheKey, STALE_TTL_MS, { deleteExpired: true });
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

function cachedImageResponse(entry: ImageCacheEntry, cacheStatus: "HIT" | "MISS" | "STALE") {
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
