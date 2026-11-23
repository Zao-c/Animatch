import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cover cache prewarm helper", () => {
  const source = readFileSync("src/lib/server/cover-cache-prewarm.ts", "utf8");

  it("exports prewarmCoverCacheBackground as non-blocking fire-and-forget", () => {
    expect(source).toContain("export function prewarmCoverCacheBackground");
    expect(source).toContain("void drainBackgroundPrewarmQueue");
  });

  it("exports prewarmCoverCacheAwait as blocking with return counts", () => {
    expect(source).toContain("export async function prewarmCoverCacheAwait");
    expect(source).toContain("success: number; failed: number");
  });

  it("filters empty and null URLs", () => {
    expect(source).toContain("if (!url || typeof url !== \"string\") return false");
    expect(source).toContain("const trimmed = url.trim()");
    expect(source).toContain("if (!trimmed) return false");
  });

  it("filters non-http URLs", () => {
    expect(source).toContain("/^https?:\\/\\//i.test(trimmed)");
  });

  it("deduplicates URLs via Set", () => {
    expect(source).toContain("new Set(");
  });

  it("uses a conservative default but honors larger explicit prewarm limits", () => {
    expect(source).toContain("DEFAULT_BACKGROUND_LIMIT = 12");
    expect(source).toContain("MAX_BACKGROUND_REQUEST_LIMIT = 120");
    expect(source).toContain("Math.min(requestedLimit, MAX_BACKGROUND_REQUEST_LIMIT)");
  });

  it("converts URLs through proxyExternalImageUrl and filters non-proxy paths", () => {
    expect(source).toContain("proxyExternalImageUrl(raw)");
    expect(source).toContain("p.startsWith(\"/\")");
  });

  it("uses a global queue with low concurrency for background mode", () => {
    expect(source).toContain("MAX_BACKGROUND_QUEUE");
    expect(source).toContain("__animatchCoverPrewarmState");
    expect(source).toContain("DEFAULT_BACKGROUND_CONCURRENCY = 2");
    expect(source).toContain("state.queue.push(path)");
  });

  it("keeps match queue prewarm request limits low for small server memory", () => {
    const runQueueRouteSource = readFileSync(
      "src/app/api/pools/[poolId]/runs/[runId]/match-queue/route.ts",
      "utf8"
    );
    const seasonQueueRouteSource = readFileSync(
      "src/app/api/pools/[poolId]/seasons/[seasonId]/match-queue/route.ts",
      "utf8"
    );

    expect(runQueueRouteSource).toContain("prewarmCoverCacheBackground(urls, { limit: 10, concurrency: 3 })");
    expect(seasonQueueRouteSource).toContain("prewarmCoverCacheBackground(urls, { limit: 10, concurrency: 3 })");
    expect(runQueueRouteSource).not.toContain("limit: 30");
    expect(seasonQueueRouteSource).not.toContain("limit: 20");
  });

  it("uses timeout and catches fetch errors silently in background mode", () => {
    expect(source).toContain("DEFAULT_BACKGROUND_TIMEOUT_MS");
    expect(source).toContain("controller.abort()");
    expect(source).toContain("Prewarm is best-effort");
  });

  it("uses NEXT_PUBLIC_SITE_URL env fallback to localhost:3000", () => {
    expect(source).toContain("NEXT_PUBLIC_SITE_URL");
    expect(source).toContain("http://localhost:3000");
  });

  it("respects AbortSignal in await mode", () => {
    expect(source).toContain("signal?: AbortSignal");
    expect(source).toContain("if (options.signal?.aborted)");
    expect(source).toContain("if (signal?.aborted)");
  });
});

describe("getProxiedCoverCandidates in image-proxy.ts", () => {
  const source = readFileSync("src/lib/image-proxy.ts", "utf8");

  it("exports getProxiedCoverCandidates function", () => {
    expect(source).toContain("export function getProxiedCoverCandidates");
  });

  it("returns proxy primary first, then proxy secondary without direct raw remote fallbacks", () => {
    const slice = source.slice(source.indexOf("const values = ["));
    const proxyPrimaryIdx = slice.indexOf("proxyExternalImageUrl(primary)");
    const proxySecondaryIdx = slice.indexOf("proxyExternalImageUrl(secondary)");

    expect(proxyPrimaryIdx).toBeLessThan(proxySecondaryIdx);
    expect(slice).not.toContain("primary,");
    expect(slice).not.toContain("secondary\n");
  });

  it("deduplicates results via Set", () => {
    expect(source).toContain("const seen = new Set<string>()");
    expect(source).toContain("if (seen.has(url)) return []");
  });

  it("skips null values", () => {
    expect(source).toContain("if (!url) return []");
  });

  it("accepts primary and secondary nullable strings", () => {
    expect(source).toContain("primary: string | null | undefined");
    expect(source).toContain("secondary: string | null | undefined");
  });
});

describe("image-proxy cache control headers", () => {
  const source = readFileSync("src/app/api/image-proxy/route.ts", "utf8");

  it("defines CACHE_CONTROL with public, max-age, s-maxage, stale-while-revalidate", () => {
    expect(source).toContain("CACHE_CONTROL = \"public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800\"");
  });

  it("defines CDN_CACHE_CONTROL with max-age and stale-while-revalidate", () => {
    expect(source).toContain("CDN_CACHE_CONTROL = \"public, max-age=604800, stale-while-revalidate=604800\"");
  });

  it("defines ERROR_CACHE_CONTROL as no-store", () => {
    expect(source).toContain("ERROR_CACHE_CONTROL = \"no-store\"");
  });

  it("cachedImageResponse sets Cache-Control and CDN-Cache-Control headers", () => {
    expect(source).toContain("\"Cache-Control\": CACHE_CONTROL");
    expect(source).toContain("\"CDN-Cache-Control\": CDN_CACHE_CONTROL");
  });

  it("cachedImageResponse sets Content-Type from cached entry", () => {
    expect(source).toContain("\"Content-Type\": entry.contentType");
  });

  it("cachedImageResponse sets Content-Length from buffer byteLength", () => {
    expect(source).toContain("\"Content-Length\": String(entry.buffer.byteLength)");
  });

  it("cachedImageResponse includes X-Animatch-Image-Cache header", () => {
    expect(source).toContain("\"X-Animatch-Image-Cache\": cacheStatus");
  });
});

describe("API routes trigger cover prewarm", () => {
  it("POST /api/pools/[poolId]/anime calls prewarmAnimeCover after creation", () => {
    const source = readFileSync("src/app/api/pools/[poolId]/anime/route.ts", "utf8");
    expect(source).toContain("enqueuePoolAnimeCoverCache(anime)");
    expect(source).toContain("import { enqueuePoolAnimeCoverCache } from \"@/lib/server/pool-cover-cache\"");
  });

  it("POST /api/pools/[poolId]/anime/tiermaker-import calls prewarmImportResults after import", () => {
    const source = readFileSync("src/app/api/pools/[poolId]/anime/tiermaker-import/route.ts", "utf8");
    expect(source).toContain("prewarmImportResults(result.added)");
    expect(source).toContain("import { prewarmCoverCacheBackground } from \"@/lib/server/cover-cache-prewarm\"");
  });

  it("POST /api/pools/[poolId]/cover-repair calls prewarm after applying repairs", () => {
    const source = readFileSync("src/app/api/pools/[poolId]/cover-repair/route.ts", "utf8");
    expect(source).toContain("prewarmCoverCacheBackground(");
    expect(source).toContain("applied.map((a) => a.coverUrl)");
  });

  it("GET /api/pools/[poolId] calls prewarm on pool detail anime list", () => {
    const source = readFileSync("src/app/api/pools/[poolId]/route.ts", "utf8");
    expect(source).toContain("enqueuePoolAnimeCoversCache(");
    expect(source).toContain("pool.poolAnime.slice(0, 60)");
  });

  it("GET /api/pools/[poolId]/runs/[runId]/match-queue calls prewarm on match pairs", () => {
    const source = readFileSync("src/app/api/pools/[poolId]/runs/[runId]/match-queue/route.ts", "utf8");
    expect(source).toContain("prewarmMatchQueue(queue)");
  });

  it("GET /api/pools/[poolId]/runs/[runId]/tierlist calls prewarm on tier list items", () => {
    const source = readFileSync("src/app/api/pools/[poolId]/runs/[runId]/tierlist/route.ts", "utf8");
    expect(source).toContain("prewarmTierList(tierList)");
  });
});
