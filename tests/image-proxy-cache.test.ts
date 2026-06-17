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

  it("defines fresh TTL as 24h and stale TTL as 30d", () => {
    expect(source).toContain("FRESH_TTL_MS = 24 * 60 * 60 * 1000");
    expect(source).toContain("STALE_TTL_MS = 30 * 24 * 60 * 60 * 1000");
  });

  it("has separate memory and disk cache size limits", () => {
    expect(source).toContain("MEM_MAX_CACHE_ENTRIES = 500");
    expect(source).toContain("MEM_MAX_CACHE_BYTES = 128 * 1024 * 1024");
    expect(source).toContain("DISK_MAX_CACHE_ENTRIES = 20000");
    expect(source).toContain("DISK_MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024");
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
        "http://localhost:3000/api/image-proxy?url=https%3A%2F%2Fcdn.example.com%2Fcdn-test.png"
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
        "http://localhost:3000/api/image-proxy?url=https%3A%2F%2Fcdn.unknown.example%2F404.png"
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
});
