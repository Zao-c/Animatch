import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { GET } from "../src/app/api/cover-thumbnail/route";
import { pruneSmartCoverCache } from "../src/lib/server/smart-cover-cache";

describe("cover-thumbnail GET", () => {
  let uploads = "";
  let animeCovers = "";
  let cache = "";

  beforeEach(async () => {
    uploads = await mkdtemp(path.join(os.tmpdir(), "animatch-cover-input-"));
    animeCovers = await mkdtemp(path.join(os.tmpdir(), "animatch-anime-cover-input-"));
    cache = await mkdtemp(path.join(os.tmpdir(), "animatch-cover-cache-"));
    process.env.ANIMATCH_CUSTOM_ITEM_UPLOAD_DIR = uploads;
    process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR = animeCovers;
    process.env.ANIMATCH_SMART_COVER_CACHE_DIR = cache;
  });

  afterEach(async () => {
    delete process.env.ANIMATCH_CUSTOM_ITEM_UPLOAD_DIR;
    delete process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR;
    delete process.env.ANIMATCH_SMART_COVER_CACHE_DIR;
    delete process.env.ANIMATCH_SMART_COVER_CACHE_MAX_ENTRIES;
    delete process.env.ANIMATCH_SMART_COVER_CACHE_MAX_BYTES;
    await rm(uploads, { recursive: true, force: true });
    await rm(animeCovers, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  });

  it("rejects unsupported variants before loading any image", async () => {
    const response = await GET(new Request("http://localhost/api/cover-thumbnail?variant=bad&src=x"));
    expect(response.status).toBe(400);
  });

  it("rejects file traversal and private local paths", async () => {
    const urls = [
      "/api/cover-thumbnail?variant=card&src=%2Fuploads%2Fcustom-items%2F..%2Fsecret.png",
      "/api/cover-thumbnail?variant=tier&src=%2Fetc%2Fpasswd",
      "/api/cover-thumbnail?variant=tier&src=file%3A%2F%2F%2Fetc%2Fpasswd"
    ];
    for (const url of urls) {
      const response = await GET(new Request("http://localhost" + url));
      expect(response.status).toBe(400);
    }
  });

  it("processes existing uploads without re-import and caches card, tier and HD match layouts", async () => {
    const source = await sharp({
      create: { width: 480, height: 240, channels: 4, background: "#336699" }
    }).png().toBuffer();
    await writeFile(path.join(uploads, "wide.png"), source);

    for (const [variant, width, height] of [
      ["card", 320, 480], ["tier", 256, 256], ["match", 768, 1152]
    ] as const) {
      const url = `http://localhost/api/cover-thumbnail?variant=${variant}&src=%2Fuploads%2Fcustom-items%2Fwide.png`;
      const result = await GET(new Request(url));
      expect(result.status).toBe(200);
      expect(result.headers.get("content-type")).toBe("image/webp");
      const firstBytes = Buffer.from(await result.arrayBuffer());
      const meta = await sharp(firstBytes).metadata();
      expect([meta.width, meta.height]).toEqual([width, height]);
      const second = await GET(new Request(url));
      expect(Buffer.from(await second.arrayBuffer())).toEqual(firstBytes);
    }

    expect((await readdir(cache)).filter((file) => file.endsWith(".webp"))).toHaveLength(3);
  });

  it("serves uploaded override covers from the anime-covers volume", async () => {
    const source = await sharp({
      create: { width: 300, height: 300, channels: 4, background: "#884422" }
    }).png().toBuffer();
    await writeFile(path.join(animeCovers, "override.png"), source);

    const result = await GET(new Request(
      "http://localhost/api/cover-thumbnail?variant=tier&src=%2Fuploads%2Fanime-covers%2Foverride.png"
    ));
    expect(result.status).toBe(200);
    expect(Number(result.headers.get("content-length"))).toBe(
      (await result.clone().arrayBuffer()).byteLength
    );
  });

  it("evicts the oldest derivatives when the cache budget is exceeded", async () => {
    const names = ["oldest.webp", "middle.webp", "newest.webp"];
    for (const [index, name] of names.entries()) {
      const filePath = path.join(cache, name);
      await writeFile(filePath, Buffer.from(name));
      const seconds = (Date.now() - (names.length - index) * 60_000) / 1000;
      await utimes(filePath, seconds, seconds);
    }
    process.env.ANIMATCH_SMART_COVER_CACHE_MAX_ENTRIES = "2";

    await pruneSmartCoverCache(cache);

    expect((await readdir(cache)).sort()).toEqual(["middle.webp", "newest.webp"]);
  });
});
