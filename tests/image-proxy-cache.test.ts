import { readFileSync } from "node:fs";
import dns from "dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/image-proxy/route";

const TEST_IMAGE_URL = "https://lain.bgm.tv/pic/cover/l/12/34/cache-test.jpg";

function testImageUrl(caseName: string) {
  return `${TEST_IMAGE_URL}?case=${caseName}&test=${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mockPublicDns() {
  vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as never);
}

function resetImageCache() {
  const store = (globalThis as Record<string, unknown>).__animatchImageProxyCache as
    | { entries: Map<string, unknown>; totalBytes: number }
    | undefined;
  if (store !== undefined) {
    store.entries.clear();
    store.totalBytes = 0;
  }
  const fetchState = (globalThis as Record<string, unknown>).__animatchImageProxyFetchState as
    | {
        activeUpstreamFetches: number;
        upstreamFetchQueue: Array<() => void>;
        inFlightByCacheKey: Map<string, unknown>;
      }
    | undefined;
  if (fetchState !== undefined) {
    fetchState.activeUpstreamFetches = 0;
    fetchState.upstreamFetchQueue.length = 0;
    fetchState.inFlightByCacheKey.clear();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetImageCache();
});

beforeEach(() => {
  mockPublicDns();
});

describe("image proxy LRU cache", () => {
  const source = readFileSync("src/app/api/image-proxy/route.ts", "utf8");

  it("defines fresh TTL as 24h and stale TTL as 30d", () => {
    expect(source).toContain("FRESH_TTL_MS = 24 * 60 * 60 * 1000");
    expect(source).toContain("STALE_TTL_MS = 30 * 24 * 60 * 60 * 1000");
  });

  it("has separate memory and disk cache size limits", () => {
    expect(source).toContain("MEM_MAX_CACHE_ENTRIES = 250");
    expect(source).toContain("MEM_MAX_CACHE_BYTES = 48 * 1024 * 1024");
    expect(source).toContain("DISK_MAX_CACHE_ENTRIES = 20000");
    expect(source).toContain("DISK_MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024");
  });

  it("bounds cold-cache upstream waits", () => {
    expect(source).toContain("TIMEOUT_MS = 6000");
    expect(source).toContain("const maxAttempts = 2");
    expect(source).toContain("AbortSignal.timeout(15000)");
    expect(source).toContain("UPSTREAM_FETCH_CONCURRENCY");
    expect(source).toContain("withUpstreamFetchSlot");
  });

  it("coalesces concurrent misses for the same image cache key", async () => {
    let releaseFetch!: () => void;
    const fetchMock = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        releaseFetch = resolve;
      });
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "3"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const url = testImageUrl("coalesced");
    const req = new Request(
      `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(url)}`
    );

    const first = GET(req);
    const second = GET(req);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    releaseFetch();

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.headers.get("X-Animatch-Image-Cache")).toBe("MISS");
    expect(secondResponse.headers.get("X-Animatch-Image-Cache")).toBe("COALESCED");
  });

  it("sets Cache-Control response header", () => {
    expect(source).toContain("Cache-Control");
    expect(source).toContain("max-age=86400");
    expect(source).toContain("stale-while-revalidate=604800");
  });

  it("writes to cache on successful upstream fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "3"
          }
        })
      )
    );

    const url = testImageUrl("miss");
    const response = await GET(
      new Request(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(url)}`
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Animatch-Image-Cache")).toBe("MISS");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("max-age=86400");
  });

  it("returns HIT on fresh cache", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "3"
          }
        });
      })
    );

    const url = testImageUrl("hit");
    const req = new Request(
      `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(url)}`
    );

    const first = await GET(req);
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Animatch-Image-Cache")).toBe("MISS");

    const second = await GET(req);
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Animatch-Image-Cache")).toBe("HIT");

    expect(callCount).toBe(1);
  });

  it("returns error when upstream fails and no cache available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      })
    );

    const response = await GET(
      new Request(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(testImageUrl("upstream-error"))}`
      )
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects non-http/https protocols", () => {
    expect(source).toContain("ALLOWED_PROTOCOLS");
    expect(source).toContain('new Set(["http:", "https:"])');
    expect(source).toContain("protocol not allowed");
  });

  it("exports GET as named export", () => {
    expect(source).toContain("export async function GET");
  });

  it("prunes oldest entries when memory cache exceeds limits", () => {
    expect(source).toContain("pruneImageCache");
    expect(source).toContain("imageCache.entries.size > MEM_MAX_CACHE_ENTRIES");
    expect(source).toContain("imageCache.totalBytes > MEM_MAX_CACHE_BYTES");
  });

  it("sets CDN-Cache-Control response header on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "3"
          }
        })
      )
    );

    const response = await GET(
      new Request(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(testImageUrl("cdn"))}`
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("CDN-Cache-Control")).toContain("max-age=604800");
    expect(response.headers.get("CDN-Cache-Control")).toContain("stale-while-revalidate=604800");
  });

  it("defines CDN_CACHE_CONTROL and ERROR_CACHE_CONTROL constants", () => {
    expect(source).toContain("CDN_CACHE_CONTROL");
    expect(source).toContain("ERROR_CACHE_CONTROL");
    expect(source).toContain('"no-store"');
  });

  it("error responses have no-store Cache-Control to prevent CDN caching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      })
    );

    const response = await GET(
      new Request(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(testImageUrl("no-store"))}`
      )
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
  });

  it("missing url returns 400 with no-store", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy")
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("successful response includes CDN-Cache-Control alongside Cache-Control", () => {
    expect(source).toContain('"CDN-Cache-Control"');
    expect(source).toContain("CDN_CACHE_CONTROL");
    expect(source).toContain("ERROR_CACHE_CONTROL");
  });

  it("maintains LRU order by moving accessed entries to end", () => {
    expect(source).toContain("imageCache.entries.delete(cacheKey)");
    expect(source).toContain("imageCache.entries.set(cacheKey, entry)");
  });

  it("does not modify process.env.NO_PROXY in request handler", () => {
    expect(source).not.toContain("process.env.NO_PROXY");
  });

  it("does not use MAL-host special bypass path", () => {
    expect(source).not.toContain("myanimelist.net");
    expect(source).not.toContain("isMalHost");
    expect(source).not.toContain("useDirect");
  });

  it("bgRefetch writes to cache using normalized cacheKey", () => {
    expect(source).toMatch(/async function bgRefetch\s*\(\s*sourceUrl: string,\s*cacheKey: string,/);
    expect(source).toContain("setCacheEntry(cacheKey, entry)");
    expect(source).toContain("writeDiskCacheEntry(cacheKey, entry)");
  });

  it("pendingBgRefetch uses cacheKey for deduplication", () => {
    expect(source).toContain("pendingBgRefetch.has(cacheKey)");
    expect(source).toContain("pendingBgRefetch.add(cacheKey)");
    expect(source).toContain("bgRefetch(parsed.toString(), cacheKey, headers, blockedProxyHosts)");
  });
});
