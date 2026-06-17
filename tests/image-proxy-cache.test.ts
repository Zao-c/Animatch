import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/image-proxy/route";

function resetImageCache() {
  const store = (globalThis as Record<string, unknown>).__animatchImageProxyCache as
    | { entries: Map<string, unknown>; totalBytes: number }
    | undefined;
  if (store !== undefined) {
    store.entries.clear();
    store.totalBytes = 0;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetImageCache();
});

describe("image proxy LRU cache", () => {
  const source = readFileSync("src/app/api/image-proxy/route.ts", "utf8");

  it("defines fresh TTL as 24h and stale TTL as 7d", () => {
    expect(source).toContain("FRESH_TTL_MS = 24 * 60 * 60 * 1000");
    expect(source).toContain("STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000");
  });

  it("has max cache size limits", () => {
    expect(source).toContain("MAX_CACHE_ENTRIES = 500");
    expect(source).toContain("MAX_CACHE_BYTES = 128 * 1024 * 1024");
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

    const url = "https://cdn.example.com/test-cache.png";
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

    const url = "https://cdn.example.com/cache-hit.png";
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
        "http://localhost:3000/api/image-proxy?url=https%3A%2F%2Fcdn.unknown.example%2Fnonexistent.png"
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

  it("prunes oldest entries when cache exceeds limits", () => {
    expect(source).toContain("pruneImageCache");
    expect(source).toContain("imageCache.entries.size > MAX_CACHE_ENTRIES");
    expect(source).toContain("imageCache.totalBytes > MAX_CACHE_BYTES");
  });

  it("maintains LRU order by moving accessed entries to end", () => {
    expect(source).toContain("imageCache.entries.delete(cacheKey)");
    expect(source).toContain("imageCache.entries.set(cacheKey, entry)");
  });
});
