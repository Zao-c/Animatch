import { NextResponse } from "next/server";
import crypto from "crypto";
import dns from "dns/promises";
import fs from "fs/promises";
import net from "net";
import path from "path";
import { getDispatcher } from "@/lib/server/outbound-fetch";

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

async function bgRefetch(
  sourceUrl: string,
  cacheKey: string,
  headers: Record<string, string>,
  blockedProxyHosts: ReadonlySet<string>
): Promise<void> {
  try {
    const resp = await fetchWithValidatedRedirects(
      sourceUrl,
      headers,
      AbortSignal.timeout(15000),
      blockedProxyHosts
    );
    if (!resp.ok) return;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength > MAX_SIZE || buf.byteLength === 0) return;
    const ctype = resp.headers.get("content-type") ?? "";
    if (!ctype.startsWith("image/")) return;
    const entry = { buffer: buf, contentType: ctype, cachedAt: Date.now(), lastAccessedAt: Date.now() };
    setCacheEntry(cacheKey, entry);
    await writeDiskCacheEntry(cacheKey, entry);
  } catch {
    // background retry failed — will be retried on next user request
  }
}

const MAX_SIZE = 10 * 1024 * 1024;
const TIMEOUT_MS = 6000;
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MEM_MAX_CACHE_ENTRIES = 250;
const MEM_MAX_CACHE_BYTES = 48 * 1024 * 1024;
const DISK_MAX_CACHE_ENTRIES = 20000;
const DISK_MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024;
const UPSTREAM_FETCH_CONCURRENCY = parsePositiveInt(
  process.env.ANIMATCH_IMAGE_PROXY_CONCURRENCY,
  4
);
const DISK_CACHE_DIR =
  process.env.ANIMATCH_IMAGE_CACHE_DIR ??
  path.join(process.cwd(), "data", "image-cache");
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const CDN_CACHE_CONTROL = "public, max-age=604800, stale-while-revalidate=604800";
const ERROR_CACHE_CONTROL = "no-store";
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 3;
const DNS_LOOKUP_TIMEOUT_MS = 1200;
const DEFAULT_ALLOWED_PROXY_HOST_SUFFIXES = [
  "bgm.tv",
  "bangumi.tv",
  "tiermaker.com"
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::1",
]);

const INTERNAL_IP_PATTERNS = [
  /^0\./,
  /^10\./,
  /^127\./,
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

type ImageFetchResult =
  | {
      entry: ImageCacheEntry;
      cacheStatus: "MISS" | "COALESCED";
      error?: never;
      status?: never;
      shouldBgRefetch?: never;
    }
  | {
      entry: null;
      error: string;
      status: number;
      shouldBgRefetch?: boolean;
      cacheStatus?: never;
    };

interface ImageProxyFetchState {
  activeUpstreamFetches: number;
  upstreamFetchQueue: Array<() => void>;
  inFlightByCacheKey: Map<string, Promise<ImageFetchResult>>;
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
  // eslint-disable-next-line no-var
  var __animatchImageProxyFetchState: ImageProxyFetchState | undefined;
}

const imageCache =
  globalThis.__animatchImageProxyCache ??
  (globalThis.__animatchImageProxyCache = {
    entries: new Map<string, ImageCacheEntry>(),
    totalBytes: 0
  });

const imageProxyFetchState =
  globalThis.__animatchImageProxyFetchState ??
  (globalThis.__animatchImageProxyFetchState = {
    activeUpstreamFetches: 0,
    upstreamFetchQueue: [],
    inFlightByCacheKey: new Map<string, Promise<ImageFetchResult>>()
  });

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

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

function isBlockedIpAddress(value: string): boolean {
  const normalized = normalizeHostname(value);
  const ipv4MappedPrefix = "::ffff:";
  if (normalized.startsWith(ipv4MappedPrefix)) {
    return isBlockedIpAddress(normalized.slice(ipv4MappedPrefix.length));
  }

  if (net.isIP(normalized) === 0) {
    return false;
  }

  if (normalized === "::1") {
    return true;
  }

  return INTERNAL_IP_PATTERNS.some((pattern) => pattern.test(normalized));
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function parseConfiguredHosts(values: Array<string | undefined>): string[] {
  const hosts = new Set<string>();
  for (const source of values) {
    for (const value of (source ?? "").split(",")) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      try {
        const parsed = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
        hosts.add(normalizeHostname(parsed.hostname));
      } catch {
        hosts.add(normalizeHostname(trimmed));
      }
    }
  }
  return [...hosts].filter(Boolean);
}

function getConfiguredBlockedHosts(): string[] {
  const values = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.ANIMATCH_SITE_URL,
    process.env.ANIMATCH_PUBLIC_URL
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return parseConfiguredHosts([
    ...values,
    process.env.ANIMATCH_IMAGE_PROXY_BLOCKED_HOSTS
  ]);
}

function getRequestHost(request: Request): string | null {
  try {
    return normalizeHostname(new URL(request.url).hostname);
  } catch {
    return null;
  }
}

function getBlockedProxyHosts(request: Request): Set<string> {
  const hosts = new Set(getConfiguredBlockedHosts());
  const requestHost = getRequestHost(request);
  if (requestHost !== null) hosts.add(requestHost);
  return hosts;
}

function getAllowedProxyHosts(): Set<string> {
  return new Set(parseConfiguredHosts([
    process.env.ANIMATCH_IMAGE_PROXY_ALLOWED_HOSTS,
    process.env.NEXT_PUBLIC_DIRECT_IMAGE_HOSTS,
    process.env.COS_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_COS_PUBLIC_BASE_URL
  ]));
}

function isAllowedProxyHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (
    DEFAULT_ALLOWED_PROXY_HOST_SUFFIXES.some((suffix) =>
      normalized === suffix || normalized.endsWith(`.${suffix}`)
    )
  ) {
    return true;
  }
  return getAllowedProxyHosts().has(normalized);
}

function validateProxyTarget(url: URL, blockedProxyHosts: ReadonlySet<string>): string | null {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return "protocol not allowed";
  }

  const hostname = normalizeHostname(url.hostname);
  if (isBlockedHostname(hostname) || isBlockedIpAddress(hostname) || blockedProxyHosts.has(hostname)) {
    return "hostname not allowed";
  }

  if (!isAllowedProxyHostname(hostname)) {
    return "hostname not allowed";
  }

  return null;
}

async function validateResolvedProxyTarget(
  url: URL,
  blockedProxyHosts: ReadonlySet<string>
): Promise<string | null> {
  const syncError = validateProxyTarget(url, blockedProxyHosts);
  if (syncError !== null) {
    return syncError;
  }

  const hostname = normalizeHostname(url.hostname);
  if (net.isIP(hostname) !== 0) {
    return null;
  }

  try {
    const records = await Promise.race([
      dns.lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("dns timeout")), DNS_LOOKUP_TIMEOUT_MS)
      )
    ]);

    if (records.some((record) => isBlockedIpAddress(record.address))) {
      return "hostname not allowed";
    }
  } catch {
    return "hostname not allowed";
  }

  return null;
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

  const blockedProxyHosts = getBlockedProxyHosts(request);
  const validationError = await validateResolvedProxyTarget(parsed, blockedProxyHosts);
  if (validationError !== null) {
    return errorResponse({ error: validationError }, 400);
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
  const referer = pickReferer(parsed.hostname);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 AniMatch-ImageProxy/1.0",
    "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
  };
  if (referer !== null) {
    headers["Referer"] = referer;
  }

  const result = await fetchImageWithCoalescing(parsed.toString(), cacheKey, headers, blockedProxyHosts);
  if (result.entry !== null) {
    return cachedImageResponse(result.entry, result.cacheStatus);
  }

  if (result.entry === null) {
    if (staleEntry !== null) {
      return cachedImageResponse(staleEntry, "STALE");
    }
    if (staleDiskEntry !== null) {
      setCacheEntry(cacheKey, staleDiskEntry);
      return cachedImageResponse(staleDiskEntry, "DISK-STALE");
    }
    if (result.shouldBgRefetch && !pendingBgRefetch.has(cacheKey)) {
      pendingBgRefetch.add(cacheKey);
      setTimeout(() => {
        pendingBgRefetch.delete(cacheKey);
        bgRefetch(parsed.toString(), cacheKey, headers, blockedProxyHosts);
      }, 3000);
    }
    return errorResponse({ error: result.error }, result.status);
  }

  return errorResponse({ error: "fetch failed" }, 502);
}

async function fetchImageWithCoalescing(
  sourceUrl: string,
  cacheKey: string,
  headers: Record<string, string>,
  blockedProxyHosts: ReadonlySet<string>
): Promise<ImageFetchResult> {
  const existing = imageProxyFetchState.inFlightByCacheKey.get(cacheKey);
  if (existing !== undefined) {
    const result = await existing;
    return result.entry !== null
      ? { entry: result.entry, cacheStatus: "COALESCED" }
      : result;
  }

  const request = fetchAndCacheUpstreamImage(sourceUrl, cacheKey, headers, blockedProxyHosts);
  imageProxyFetchState.inFlightByCacheKey.set(cacheKey, request);
  try {
    return await request;
  } finally {
    imageProxyFetchState.inFlightByCacheKey.delete(cacheKey);
  }
}

async function fetchAndCacheUpstreamImage(
  sourceUrl: string,
  cacheKey: string,
  headers: Record<string, string>,
  blockedProxyHosts: ReadonlySet<string>
): Promise<ImageFetchResult> {
  const maxAttempts = 2;
  let response: Response | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      response = await fetchWithValidatedRedirects(sourceUrl, headers, controller.signal, blockedProxyHosts);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }
      const message =
        lastError instanceof DOMException && lastError.name === "AbortError"
          ? "upstream timeout"
          : "fetch failed";
      return { entry: null, error: message, status: 502 };
    } finally {
      clearTimeout(timeoutId);
    }

    if (
      !response.ok &&
      attempt < maxAttempts &&
      (response.status === 502 || response.status === 503)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      continue;
    }

    break;
  }

  if (!response || !response.ok) {
    return {
      entry: null,
      error: response ? `upstream returned ${response.status}` : "fetch failed",
      status: 502,
      shouldBgRefetch: true
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return { entry: null, error: "not an image", status: 400 };
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_SIZE) {
    return { entry: null, error: "image too large", status: 400 };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return { entry: null, error: "read failed", status: 502 };
  }

  if (buffer.byteLength > MAX_SIZE) {
    return { entry: null, error: "image too large", status: 400 };
  }

  const cachedBuffer = Buffer.from(buffer);
  const entry = setCacheEntry(cacheKey, {
    buffer: cachedBuffer,
    contentType,
    cachedAt: Date.now(),
    lastAccessedAt: Date.now()
  });
  await writeDiskCacheEntry(cacheKey, entry);

  return { entry, cacheStatus: "MISS" };
}

async function fetchWithValidatedRedirects(
  sourceUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  blockedProxyHosts: ReadonlySet<string>
): Promise<Response> {
  let currentUrl = sourceUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const parsed = new URL(currentUrl);
    const validationError = await validateResolvedProxyTarget(parsed, blockedProxyHosts);
    if (validationError !== null) {
      throw new Error(validationError);
    }

    const response = await withUpstreamFetchSlot(async () => {
      const dispatcher = await getDispatcher(currentUrl).catch(() => undefined);
      const fetchOptions: RequestInit & { dispatcher?: unknown } = {
        signal,
        headers,
        redirect: "manual"
      };
      if (dispatcher !== undefined) {
        fetchOptions.dispatcher = dispatcher;
      }
      return fetch(currentUrl, fetchOptions);
    });

    if (!isRedirectResponse(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("invalid redirect");
    }

    const nextUrl = new URL(location, currentUrl);
    const redirectValidationError = await validateResolvedProxyTarget(nextUrl, blockedProxyHosts);
    if (redirectValidationError !== null) {
      throw new Error(redirectValidationError);
    }

    currentUrl = nextUrl.toString();
  }

  throw new Error("too many redirects");
}

function isRedirectResponse(status: number): boolean {
  return status >= 300 && status < 400;
}

async function withUpstreamFetchSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (imageProxyFetchState.activeUpstreamFetches >= UPSTREAM_FETCH_CONCURRENCY) {
    await new Promise<void>((resolve) => {
      imageProxyFetchState.upstreamFetchQueue.push(resolve);
    });
  }

  imageProxyFetchState.activeUpstreamFetches += 1;
  try {
    return await operation();
  } finally {
    imageProxyFetchState.activeUpstreamFetches = Math.max(
      0,
      imageProxyFetchState.activeUpstreamFetches - 1
    );
    imageProxyFetchState.upstreamFetchQueue.shift()?.();
  }
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
  cacheStatus: "HIT" | "MISS" | "COALESCED" | "STALE" | "DISK-HIT" | "DISK-STALE"
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
