import { proxyExternalImageUrl } from "../image-proxy";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function filterRemoteUrls(
  urls: (string | null | undefined)[]
): string[] {
  return [...new Set(
    urls.filter((url): url is string => {
      if (!url || typeof url !== "string") return false;
      const trimmed = url.trim();
      if (!trimmed) return false;
      return /^https?:\/\//i.test(trimmed);
    })
  )];
}

async function warmBatch(
  proxyPaths: string[],
  baseUrl: string,
  signal?: AbortSignal
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    proxyPaths.map(async (path) => {
      if (signal?.aborted) return;
      try {
        const resp = await fetch(`${baseUrl}${path}`, { signal });
        if (resp.ok || resp.status === 404 || resp.status === 502) {
          return;
        }
      } catch {
        // silent
      }
      throw new Error("warm skipped");
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") success++;
    else failed++;
  }

  return { success, failed };
}

/**
 * Non-blocking background prewarm. Fires internal fetch to the image-proxy
 * endpoint to populate the server disk cache. Does NOT wait for completion
 * and does NOT throw.
 */
export function prewarmCoverCacheBackground(
  urls: (string | null | undefined)[],
  options: { concurrency?: number; limit?: number } = {}
): void {
  const remote = filterRemoteUrls(urls).slice(0, options.limit ?? 30);
  if (remote.length === 0) return;

  const proxyPaths = remote
    .map((raw) => proxyExternalImageUrl(raw))
    .filter((p): p is string => typeof p === "string" && p.startsWith("/"));

  if (proxyPaths.length === 0) return;

  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? 3));
  const baseUrl = getBaseUrl();

  void (async () => {
    for (let i = 0; i < proxyPaths.length; i += concurrency) {
      const batch = proxyPaths.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map((path) =>
          fetch(`${baseUrl}${path}`).catch(() => {})
        )
      );
    }
  })();
}

/**
 * Blocking prewarm. Returns counts after all URLs have been attempted.
 * Used in tests and when you want to ensure the cache is warmed before
 * continuing.
 */
export async function prewarmCoverCacheAwait(
  urls: (string | null | undefined)[],
  options: { concurrency?: number; limit?: number; signal?: AbortSignal } = {}
): Promise<{ success: number; failed: number }> {
  const remote = filterRemoteUrls(urls).slice(0, options.limit ?? 30);
  if (remote.length === 0) return { success: 0, failed: 0 };

  const proxyPaths = remote
    .map((raw) => proxyExternalImageUrl(raw))
    .filter((p): p is string => typeof p === "string" && p.startsWith("/"));

  if (proxyPaths.length === 0) return { success: 0, failed: 0 };

  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? 3));
  const baseUrl = getBaseUrl();

  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < proxyPaths.length; i += concurrency) {
    if (options.signal?.aborted) break;
    const batch = proxyPaths.slice(i, i + concurrency);
    const result = await warmBatch(batch, baseUrl, options.signal);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  return { success: totalSuccess, failed: totalFailed };
}

export { filterRemoteUrls };
