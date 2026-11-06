import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { GET } from "../src/app/api/cover-thumbnail/route";

describe("cover-thumbnail GET", () => {
  let uploads = "";
  let cache = "";

  beforeEach(async () => {
    uploads = await mkdtemp(path.join(os.tmpdir(), "animatch-cover-input-"));
    cache = await mkdtemp(path.join(os.tmpdir(), "animatch-cover-cache-"));
    process.env.ANIMATCH_CUSTOM_ITEM_UPLOAD_DIR = uploads;
    process.env.ANIMATCH_SMART_COVER_CACHE_DIR = cache;
  });

  afterEach(async () => {
    delete process.env.ANIMATCH_CUSTOM_ITEM_UPLOAD_DIR;
    delete process.env.ANIMATCH_SMART_COVER_CACHE_DIR;
    await rm(uploads, { recursive: true, force: true });
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

  it("processes existing local image uploads without re-import and caches both layouts", async () => {
    const source = await sharp({
      create: { width: 480, height: 240, channels: 4, background: "#336699" }
    }).png().toBuffer();
    await writeFile(path.join(uploads, "wide.png"), source);

    for (const [variant, width, height] of [
      ["card", 320, 480], ["tier", 256, 256]
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

    expect((await readdir(cache)).filter((file) => file.endsWith(".webp"))).toHaveLength(2);
  });
});
