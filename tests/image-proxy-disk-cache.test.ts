import { existsSync, unlinkSync, mkdirSync, readdirSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import crypto from "crypto";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const DISK_CACHE_DIR = (() => {
  const envDir = process.env.ANIMATCH_IMAGE_CACHE_DIR;
  if (envDir) return envDir;
  return path.join(process.cwd(), "data", "image-cache");
})();

function cleanDiskCacheDir() {
  try {
    const files = readdirSync(DISK_CACHE_DIR);
    for (const file of files) {
      const filePath = path.join(DISK_CACHE_DIR, file);
      try {
        unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  } catch {
    // dir may not exist
  }
}

beforeEach(() => {
  cleanDiskCacheDir();
  resetImageCache();
  try {
    mkdirSync(DISK_CACHE_DIR, { recursive: true });
  } catch {
    // ignore
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetImageCache();
  cleanDiskCacheDir();
});

function makePngResponse(data: Uint8Array = new Uint8Array([1, 2, 3])) {
  return new Response(new Uint8Array(data).buffer, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(data.byteLength)
    }
  });
}

function pngProxyUrl(name: string): string {
  const raw = `https://lain.bgm.tv/${name}.png`;
  return `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(raw)}`;
}

describe("image proxy disk cache", () => {
  const source = readFileSync("src/app/api/image-proxy/route.ts", "utf8");

  it("uses SHA-256 hash for cache key, not raw URL", () => {
    expect(source).toContain('crypto.createHash("sha256")');
    expect(source).toContain(".digest(\"hex\")");
    expect(source).toContain("${hash}.json");
    expect(source).toContain("${hash}.bin");
  });

  it("writes to disk on successful upstream fetch and returns MISS", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => makePngResponse()));

    const response = await GET(new Request(pngProxyUrl("disk-miss-test")));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Animatch-Image-Cache")).toBe("MISS");

    expect(existsSync(DISK_CACHE_DIR)).toBe(true);
    const files = readdirSync(DISK_CACHE_DIR);
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.some((f) => f.endsWith(".json"))).toBe(true);
    expect(files.some((f) => f.endsWith(".bin"))).toBe(true);
  });

  it("returns DISK-HIT on fresh disk cache when memory cache is empty", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        return makePngResponse();
      })
    );

    const url = pngProxyUrl("disk-hit-test");
    const first = await GET(new Request(url));
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Animatch-Image-Cache")).toBe("MISS");
    expect(callCount).toBe(1);

    resetImageCache();

    const second = await GET(new Request(url));
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Animatch-Image-Cache")).toBe("DISK-HIT");
    expect(callCount).toBe(1);
  });

  it("returns DISK-STALE when upstream fails but disk has stale cache", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => makePngResponse()));

    const url = pngProxyUrl("disk-stale-test");
    const first = await GET(new Request(url));
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Animatch-Image-Cache")).toBe("MISS");

    resetImageCache();

    const hash = crypto
      .createHash("sha256")
      .update("https://lain.bgm.tv/disk-stale-test.png")
      .digest("hex");
    const metaPath = path.join(DISK_CACHE_DIR, `${hash}.json`);
    const metadata = JSON.parse(await readFile(metaPath, "utf8"));
    metadata.cachedAt = Date.now() - 25 * 60 * 60 * 1000;
    await writeFile(metaPath, JSON.stringify(metadata), "utf8");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      })
    );

    const second = await GET(new Request(url));
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Animatch-Image-Cache")).toBe("DISK-STALE");
  });

  it("returns 502 when upstream fails and no disk cache exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      })
    );

    const response = await GET(new Request(pngProxyUrl("no-disk-and-fail")));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects non-http/https protocols", async () => {
    const response = await GET(
      new Request(
        "http://localhost:3000/api/image-proxy?url=file%3A%2F%2F%2Fetc%2Fpasswd"
      )
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("protocol not allowed");
  });

  it("does not write cache when upstream Content-Type is not image/*", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const url = pngProxyUrl("not-an-image");
    const response = await GET(new Request(url));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("not an image");

    const files = readdirSync(DISK_CACHE_DIR);
    expect(files.length).toBe(0);
  });

  it("does not write cache when upstream returns 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("forbidden", { status: 403 })
      )
    );

    const response = await GET(new Request(pngProxyUrl("forbidden-image")));
    expect(response.status).toBe(502);
    const files = readdirSync(DISK_CACHE_DIR);
    expect(files.length).toBe(0);
  });

  it("rejects images exceeding MAX_SIZE (10MB)", async () => {
    const large = new Uint8Array(11 * 1024 * 1024);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(large, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(large.byteLength)
          }
        })
      )
    );

    const response = await GET(new Request(pngProxyUrl("too-large")));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("image too large");
  });

  it("handles corrupted disk cache files gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => makePngResponse()));

    const url = pngProxyUrl("corrupt-test");
    const first = await GET(new Request(url));
    expect(first.status).toBe(200);

    resetImageCache();

    const hash = crypto
      .createHash("sha256")
      .update("https://lain.bgm.tv/corrupt-test.png")
      .digest("hex");
    const metaPath = path.join(DISK_CACHE_DIR, `${hash}.json`);

    await writeFile(metaPath, "{invalid json", "utf8");

    vi.stubGlobal("fetch", vi.fn(async () => makePngResponse()));
    const second = await GET(new Request(url));
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Animatch-Image-Cache")).toBe("MISS");
  });

  it("prunes disk cache when size exceeds limit (5GB / 20000 entries)", () => {
    expect(source).toContain("pruneDiskCache");
    expect(source).toContain("entries.length > DISK_MAX_CACHE_ENTRIES");
    expect(source).toContain("totalBytes > DISK_MAX_CACHE_BYTES");
    expect(source).toContain("DISK_MAX_CACHE_ENTRIES = 20000");
    expect(source).toContain("DISK_MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024");
    expect(source).toContain("entries.sort((left, right) => left.lastAccessedAt - right.lastAccessedAt)");
  });

  it("prunes asynchronously at a bounded interval so writes do not scan the full cache", () => {
    expect(source).toContain("scheduleDiskCachePrune()");
    expect(source).not.toContain("await pruneDiskCache()");
    expect(source).toContain("DISK_PRUNE_MIN_INTERVAL_MS");
    expect(source).toContain("diskCachePruneState.isRunning");
    expect(source).toContain("files = await fs.readdir(DISK_CACHE_DIR)");
    expect(source).toContain("} catch {");
  });

  it("bounds the upstream wait queue and returns a retryable overload response", () => {
    expect(source).toContain("UPSTREAM_FETCH_QUEUE_MAX");
    expect(source).toContain("imageProxyFetchState.upstreamFetchQueue.length >= UPSTREAM_FETCH_QUEUE_MAX");
    expect(source).toContain("new ImageProxyOverloadedError()");
    expect(source).toContain('error: "image proxy busy", status: 503');
  });

  it("disk write uses atomic temp-file-then-rename pattern", () => {
    expect(source).toContain('paths.bodyPath + ".tmp"');
    expect(source).toContain('paths.metaPath + ".tmp"');
    expect(source).toContain("fs.rename(tmpBodyPath, paths.bodyPath)");
    expect(source).toContain("fs.rename(tmpMetaPath, paths.metaPath)");
  });

  it("cleans up temp files on write failure", () => {
    expect(source).toContain("Promise.allSettled([");
    expect(source).toContain("fs.unlink(tmpBodyPath)");
    expect(source).toContain("fs.unlink(tmpMetaPath)");
  });

  it("metadata includes contentType cachedAt lastAccessedAt byteLength", () => {
    expect(source).toContain("interface DiskCacheMetadata");
    expect(source).toContain("contentType: string");
    expect(source).toContain("cachedAt: number");
    expect(source).toContain("lastAccessedAt: number");
    expect(source).toContain("byteLength: number");
  });

  it("validates byteLength matches actual file size on read", () => {
    expect(source).toContain("buffer.byteLength !== metadata.byteLength");
    expect(source).toContain("buffer.byteLength > MAX_SIZE");
  });

  it("deletes disk entry when metadata is invalid on read", () => {
    expect(source).toContain("await deleteDiskCacheEntry(paths)");
  });
});

describe("docker-compose and gitignore", () => {
  it(".gitignore includes data/image-cache/", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toContain("data/image-cache/");
  });

  it(".gitignore excludes local cookie and tmp scratch files", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toContain("cookies.txt");
    expect(gitignore).toContain("tmp_*.js");
    expect(gitignore).toContain("tmp_*.ts");
  });

  it("docker-compose.prod.yml has animatch_image_cache volume", () => {
    const compose = readFileSync("docker-compose.prod.yml", "utf8");
    expect(compose).toContain("animatch_image_cache");
    expect(compose).toContain("/app/data/image-cache");
  });

  it("docker-compose volume does not expose uploads or postgres data paths", () => {
    const compose = readFileSync("docker-compose.prod.yml", "utf8");
    expect(compose).toContain("anime_uploads:/app/public/uploads");
    expect(compose).toContain("animatch_postgres_data:/var/lib/postgresql/data");
    expect(compose).not.toContain("/app/data/uploads");
  });

  it("docker-compose.prod.yml does not hardcode proxy default addresses", () => {
    const compose = readFileSync("docker-compose.prod.yml", "utf8");
    expect(compose).not.toContain("172.18.0.1:7890");
    expect(compose).toContain("HTTP_PROXY: ${HTTP_PROXY:-}");
    expect(compose).toContain("HTTPS_PROXY: ${HTTPS_PROXY:-}");
    expect(compose).toContain("ANIMATCH_OUTBOUND_PROXY_URL: ${ANIMATCH_OUTBOUND_PROXY_URL:-}");
  });
});

describe("image proxy security boundaries", () => {
  const source = readFileSync("src/app/api/image-proxy/route.ts", "utf8");

  it("blocks internal-only IPs", () => {
    expect(source).toContain("BLOCKED_HOSTNAMES");
    expect(source).toContain('"localhost"');
    expect(source).toContain("/^127\\./");
    expect(source).toContain("INTERNAL_IP_PATTERNS");
    expect(source).toContain("isBlockedHostname(hostname)");
  });

  it("does not log full URLs in plain console calls", () => {
    const lines = source.split("\n");
    const consoleCalls = lines.filter(
      (l) => l.includes("console.log") || l.includes("console.error")
    );
    expect(consoleCalls.length).toBe(0);
  });

  it("bgRefetch uses cacheKey for disk write so normalized URLs share cache", () => {
    expect(source).toContain("writeDiskCacheEntry(cacheKey, entry)");
    expect(source).toContain("setCacheEntry(cacheKey, entry)");
  });
});
