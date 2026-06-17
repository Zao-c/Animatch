import { proxyExternalImageUrl } from "./image-proxy";

interface PrewarmOptions {
  limit?: number;
  concurrency?: number;
  includeRawFallback?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface PrewarmResult {
  warmed: number;
  skipped: number;
  cancelled: boolean;
}

const DEFAULT_LIMIT = 12;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 2500;

export function prewarmCoverUrls(
  urls: (string | null | undefined)[],
  options: PrewarmOptions = {}
): Promise<PrewarmResult> {
  const limit = Math.max(1, Math.trunc(options.limit ?? DEFAULT_LIMIT));
  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY));
  const includeRawFallback = options.includeRawFallback ?? true;
  const timeoutMs = Math.max(500, Math.trunc(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const signal = options.signal;

  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    if (candidates.length >= limit) break;
    if (signal?.aborted) break;
    if (!url) continue;

    const trimmed = url.trim();
    if (trimmed.length === 0) continue;

    const proxyUrl = proxyExternalImageUrl(trimmed);
    if (proxyUrl !== null && !seen.has(proxyUrl)) {
      seen.add(proxyUrl);
      candidates.push(proxyUrl);
      if (candidates.length >= limit) break;
    }

    if (includeRawFallback) {
      if (trimmed.startsWith("/api/image-proxy")) {
        const raw = extractRawUrl(trimmed);
        if (raw !== null && !seen.has(raw)) {
          seen.add(raw);
          candidates.push(raw);
          if (candidates.length >= limit) break;
        }
      } else if (!seen.has(trimmed)) {
        seen.add(trimmed);
        candidates.push(trimmed);
        if (candidates.length >= limit) break;
      }
    }
  }

  if (candidates.length === 0 || signal?.aborted) {
    return Promise.resolve({ warmed: 0, skipped: 0, cancelled: signal?.aborted ?? false });
  }

  return prewarmBatch(candidates, concurrency, timeoutMs, signal);
}

async function prewarmBatch(
  candidates: string[],
  concurrency: number,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<PrewarmResult> {
  let warmed = 0;
  let skipped = 0;
  let cancelled = false;

  for (let i = 0; i < candidates.length; i += concurrency) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    const slice = candidates.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map((url) => prewarmSingle(url, timeoutMs, signal))
    );

    for (const r of results) {
      if (r === "cancelled") {
        cancelled = true;
      } else if (r === "warmed") {
        warmed++;
      } else {
        skipped++;
      }
    }

    if (cancelled) break;
  }

  return { warmed, skipped, cancelled };
}

async function prewarmSingle(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<"warmed" | "skipped" | "cancelled"> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve("cancelled");
      return;
    }

    const image = new Image();
    let resolved = false;

    const done = (result: "warmed" | "skipped") => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => done("skipped"), timeoutMs);

    const onAbort = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve("cancelled");
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    image.onload = () => done("warmed");
    image.onerror = () => done("skipped");
    image.src = url;
  });
}

function extractRawUrl(proxyUrl: string): string | null {
  try {
    const url = new URL(proxyUrl, "http://localhost");
    const raw = url.searchParams.get("url");
    return raw ?? null;
  } catch {
    return null;
  }
}

export function isSlowNetwork(): boolean {
  if (typeof navigator === "undefined") return false;

  const connection =
    (navigator as Navigator & { connection?: NetworkInformation }).connection;

  if (!connection) return false;

  if (connection.saveData === true) {
    return true;
  }

  if (
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g"
  ) {
    return true;
  }

  return false;
}

interface NetworkInformation extends EventTarget {
  readonly effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  readonly saveData?: boolean;
}
