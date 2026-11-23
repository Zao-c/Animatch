import { NextResponse } from "next/server";
import crypto from "crypto";
import dns from "dns/promises";
import fs from "fs/promises";
import net from "net";
import path from "path";
import { getDispatcher } from "@/lib/server/outbound-fetch";
import { readLimitedBody } from "@/lib/server/read-limited-body";

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

const MAX_SIZE = 10 * 1024 * 1024;
const TIMEOUT_MS = 6000;
const QUEUE_TIMEOUT_MS = 1500;
const FAILURE_COOLDOWN_MS = 5000;
const recentFailures = new Map<string, { result: ImageFetchResult; expiresAt: number }>();
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MEM_MAX_CACHE_ENTRIES = 250;
const MEM_MAX_CACHE_BYTES = 48 * 1024 * 1024;
const DISK_MAX_CACHE_ENTRIES = 20000;
const DISK_MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024;
const DISK_PRUNE_MIN_INTERVAL_MS = 60 * 1000;
const UPSTREAM_FETCH_CONCURRENCY = parsePositiveInt(
  process.env.ANIMATCH_IMAGE_PROXY_CONCURRENCY,
  4
);
const UPSTREAM_FETCH_QUEUE_MAX = parsePositiveInt(
  process.env.ANIMATCH_IMAGE_PROXY_QUEUE_MAX,
  80
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
    }
  | {
      entry: null;
      error: string;
      status: number;
      retryable?: boolean;
      cacheStatus?: never;
    };

class ImageProxyOverloadedError extends Error {
  constructor() {
    super("image proxy busy");
  }
}

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

interface DiskCachePruneState {
  isRunning: boolean;
  lastStartedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __animatchImageProxyCache: ImageCacheStore | undefined;
  // eslint-disable-next-line no-var
  var __animatchImageProxyFetchState: ImageProxyFetchState | undefined;
  // eslint-disable-next-line no-var
  var __animatchDiskCachePruneState: DiskCachePruneState | undefined;
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

const diskCachePruneState =
  globalThis.__animatchDiskCachePruneState ??
  (globalThis.__animatchDiskCachePruneState = {
    isRunning: false,
    lastStartedAt: 0
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

function isAniMatchCosCoverUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    /^[a-z0-9][a-z0-9-]*\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(url.hostname) &&
    url.pathname.startsWith("/animatch/covers/")
  );
}

function validateProxyTarget(url: URL, blockedProxyHosts: ReadonlySet<string>): string | null {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return "protocol not allowed";
  }

  const hostname = normalizeHostname(url.hostname);
  if (isBlockedHostname(hostname) || isBlockedIpAddress(hostname) || blockedProxyHosts.has(hostname)) {
    return "hostname not allowed";
  }

  if (!isAllowedProxyHostname(hostname) && !isAniMatchCosCoverUrl(url)) {
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
  // Cached bytes require no DNS or outbound request. Resolve and validate DNS
  // inside fetchWithValidatedRedirects only when actually fetching upstream.
  const validationError = validateProxyTarget(parsed, blockedProxyHosts);
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

  // Serve a usable stale cover immediately; revalidation shares the same
  // deduplication, queue and full-body download limits as foreground traffic.
  const availableStale = staleEntry ?? staleDiskEntry;
  if (availableStale !== null) {
    setCacheEntry(cacheKey, availableStale);
    void fetchImageWithCoalescing(parsed.toString(), cacheKey, headers, blockedProxyHosts)
      .catch(() => undefined);
    return cachedImageResponse(availableStale, staleEntry !== null ? "STALE" : "DISK-STALE");
  }

  const result = await fetchImageWithCoalescing(parsed.toString(), cacheKey, headers, blockedProxyHosts);
  if (result.entry !== null) {
    return cachedImageResponse(result.entry, result.cacheStatus);
  }

  return errorResponse({ error: result.error }, result.status);
}

async function fetchImageWithCoalescing(
  sourceUrl: string,
  cacheKey: string,
  headers: Record<string, string>,
  blockedProxyHosts: ReadonlySet<string>
): Promise<ImageFetchResult> {
  const failure = recentFailures.get(cacheKey);
  if (failure && failure.expiresAt > Date.now()) return failure.result;
  recentFailures.delete(cacheKey);
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
    const result = await request;
    if (result.entry === null && result.status !== 503) {
      recentFailures.set(cacheKey, { result, expiresAt: Date.now() + FAILURE_COOLDOWN_MS });
      if (recentFailures.size > MEM_MAX_CACHE_ENTRIES) {
        recentFailures.delete(recentFailures.keys().next().value!);
      }
    }
    return result;
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
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: ImageFetchResult;
    try {
      result = await withUpstreamFetchSlot(async (): Promise<ImageFetchResult> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let response: Response | undefined;
        try {
          response = await fetchWithValidatedRedirects(sourceUrl, headers, controller.signal, blockedProxyHosts);
          if (!response.ok) {
            return { entry: null, error: `upstream returned ${response.status}`, status: 502,
              retryable: response.status === 502 || response.status === 503 || response.status === 504 };
          }
          const contentType = response.headers.get("content-type") ?? "";
          if (!contentType.startsWith("image/")) return { entry: null, error: "not an image", status: 400 };
          if (Number(response.headers.get("content-length") ?? 0) > MAX_SIZE) {
            return { entry: null, error: "image too large", status: 400 };
          }
          const buffer = await readLimitedBody(response, MAX_SIZE, controller.signal);
          return { entry: { buffer, contentType, cachedAt: Date.now(), lastAccessedAt: Date.now() }, cacheStatus: "MISS" };
        } finally {
          clearTimeout(timeoutId);
          if (response?.body && !response.body.locked) void response.body.cancel().catch(() => undefined);
        }
      });
    } catch (error) {
      if (error instanceof ImageProxyOverloadedError) {
        return { entry: null, error: "image proxy busy", status: 503 };
      }
      const tooLarge = error instanceof Error && error.message === "image too large";
      result = { entry: null, error: tooLarge ? "image too large" : "fetch failed",
        status: tooLarge ? 400 : 502, retryable: !tooLarge };
    }
    if (result.entry !== null) {
      setCacheEntry(cacheKey, result.entry);
      await writeDiskCacheEntry(cacheKey, result.entry);
      return result;
    }
    if (!result.retryable || attempt === maxAttempts) return result;
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
  return { entry: null, error: "fetch failed", status: 502 };
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

    signal.throwIfAborted();
      const dispatcher = await getDispatcher(currentUrl).catch(() => undefined);
      const fetchOptions: RequestInit & { dispatcher?: unknown } = {
        signal,
        headers,
        redirect: "manual"
      };
      if (dispatcher !== undefined) {
        fetchOptions.dispatcher = dispatcher;
      }
    const response = await fetch(currentUrl, fetchOptions);

    if (!isRedirectResponse(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    await response.body?.cancel();
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
    if (imageProxyFetchState.upstreamFetchQueue.length >= UPSTREAM_FETCH_QUEUE_MAX) {
      throw new ImageProxyOverloadedError();
    }
    await new Promise<void>((resolve, reject) => {
      const grant = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        const index = imageProxyFetchState.upstreamFetchQueue.indexOf(grant);
        if (index !== -1) imageProxyFetchState.upstreamFetchQueue.splice(index, 1);
        reject(new ImageProxyOverloadedError());
      }, QUEUE_TIMEOUT_MS);
      imageProxyFetchState.upstreamFetchQueue.push(grant);
    });
  } else {
    imageProxyFetchState.activeUpstreamFetches += 1;
  }
  try {
    return await operation();
  } finally {
    const next = imageProxyFetchState.upstreamFetchQueue.shift();
    if (next) next(); // Transfer the reserved slot to the oldest waiter.
    else imageProxyFetchState.activeUpstreamFetches -= 1;
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
    // Best effort touch; filesystem failures must not reject a cached image.
    void writeDiskMetadata(paths.metaPath, {
      contentType: entry.contentType,
      cachedAt: entry.cachedAt,
      lastAccessedAt: entry.lastAccessedAt,
      byteLength: entry.buffer.byteLength
    }).catch(() => undefined);
    return entry;
  } catch {
    return null;
  }
}

async function writeDiskCacheEntry(cacheKey: string, entry: ImageCacheEntry): Promise<void> {
  const paths = getDiskCachePaths(cacheKey);
  const suffix = `.${crypto.randomUUID()}.tmp`;
  const tmpBodyPath = paths.bodyPath + suffix;
  const tmpMetaPath = paths.metaPath + suffix;

  try {
    await fs.mkdir(DISK_CACHE_DIR, { recursive: true });
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
    scheduleDiskCachePrune();
  } catch {
    await Promise.allSettled([
      fs.unlink(tmpBodyPath),
      fs.unlink(tmpMetaPath)
    ]);
  }
}

function scheduleDiskCachePrune(): void {
  const now = Date.now();
  if (
    diskCachePruneState.isRunning ||
    now - diskCachePruneState.lastStartedAt < DISK_PRUNE_MIN_INTERVAL_MS
  ) {
    return;
  }

  diskCachePruneState.isRunning = true;
  diskCachePruneState.lastStartedAt = now;
  void pruneDiskCache()
    .catch(() => undefined)
    .finally(() => {
      diskCachePruneState.isRunning = false;
    });
}

async function writeDiskMetadata(metaPath: string, metadata: DiskCacheMetadata): Promise<void> {
  await fs.mkdir(DISK_CACHE_DIR, { recursive: true });
  const temporaryPath = `${metaPath}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(metadata), "utf8");
    await fs.rename(temporaryPath, metaPath);
  } finally {
    await fs.unlink(temporaryPath).catch(() => undefined);
  }
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
    headers: { "Cache-Control": ERROR_CACHE_CONTROL, "CDN-Cache-Control": ERROR_CACHE_CONTROL,
      ...(status === 503 ? { "Retry-After": "2" } : {}) }
  });
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}
