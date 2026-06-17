import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cover cache prewarm helper", () => {
  const source = readFileSync("src/lib/server/cover-cache-prewarm.ts", "utf8");

  it("exports prewarmCoverCacheBackground as non-blocking fire-and-forget", () => {
    expect(source).toContain("export function prewarmCoverCacheBackground");
    expect(source).toContain("void (async () => {");
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

  it("limits via options.limit with default 30", () => {
    expect(source).toContain(".slice(0, options.limit ?? 30)");
  });

  it("converts URLs through proxyExternalImageUrl and filters non-proxy paths", () => {
    expect(source).toContain("proxyExternalImageUrl(raw)");
    expect(source).toContain("p.startsWith(\"/\")");
  });

  it("uses concurrency option with default 3", () => {
    expect(source).toContain("concurrency ?? 3");
    expect(source).toContain("for (let i = 0; i < proxyPaths.length; i += concurrency)");
  });

  it("catches fetch errors silently in background mode", () => {
    expect(source).toContain(".catch(() => {})");
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

  it("returns proxy primary first, then proxy secondary, then raw primary, then raw secondary", () => {
    const slice = source.slice(source.indexOf("const values = ["));
    const proxyPrimaryIdx = slice.indexOf("proxyExternalImageUrl(primary)");
    const proxySecondaryIdx = slice.indexOf("proxyExternalImageUrl(secondary)");
    const rawPrimaryIdx = slice.indexOf("primary,", proxySecondaryIdx + 1);
    const rawSecondaryIdx = slice.indexOf("secondary", rawPrimaryIdx + 1);

    expect(proxyPrimaryIdx).toBeLessThan(proxySecondaryIdx);
    expect(proxySecondaryIdx).toBeLessThan(rawPrimaryIdx);
    expect(rawPrimaryIdx).toBeLessThan(rawSecondaryIdx);
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
    expect(source).toContain("prewarmAnimeCover(anime)");
    expect(source).toContain("import { prewarmCoverCacheBackground } from \"@/lib/server/cover-cache-prewarm\"");
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
    expect(source).toContain("prewarmCoverCacheBackground(");
    expect(source).toContain("animeEntries.slice(0, 30)");
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
