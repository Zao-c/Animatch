import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";
import { saveSongCover, songCoverReferences, cleanSongCovers } from "@/lib/anisong/cover-storage";
import { coverUrlInput } from "@/lib/anisong/validation";
import { songSnapshot } from "@/lib/anisong/engine";
import { emptySongDocument, MAX_SONG_COVER_BYTES } from "@/lib/anisong/types";
let directory: string;
const originalDirectory = process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR;
beforeAll(async () => { directory = await mkdtemp(path.join(tmpdir(), "anisong-cover-test-")); process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR = directory; });
afterAll(async () => { if (originalDirectory === undefined) delete process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR; else process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR = originalDirectory; await rm(directory, { recursive: true, force: true }); });
describe("song covers", () => {
  it("normalizes uploaded images to bounded WebP with unique immutable paths", async () => {
    const image = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#00ccaa" } }).png().toBuffer();
    const file = new File([new Uint8Array(image)], "cover.png", { type: "image/png" });
    const url = await saveSongCover(file, "board", "track");
    expect(url).toMatch(/^\/uploads\/anime-covers\/song-board-track-.*\.webp$/);
    const data = await readFile(path.join(directory, path.basename(url)));
    expect(await sharp(data).metadata()).toMatchObject({ format: "webp", width: 800, height: 600 });
    expect(await saveSongCover(file, "board", "track")).not.toBe(url);
  });
  it("rejects spoofed image files, SVG and oversized input", async () => {
    for (const file of [new File(["not an image"], "fake.png", { type: "image/png" }), new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'], "bad.svg", { type: "image/svg+xml" }), new File([new Uint8Array(MAX_SONG_COVER_BYTES + 1)], "large.jpg")]) {
      await expect(saveSongCover(file, "board", "track")).rejects.toMatchObject({ statusCode: 400 });
    }
  });
  it("retains published covers after replacement and collects them on revocation", async () => {
    const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    const oldUrl = await saveSongCover(new File([new Uint8Array(bytes)], "old.png"), "board", "track");
    const doc = emptySongDocument();
    doc.tracks.push({ id: "a", title: "a", artist: "", anime: "", kind: "OP", year: null, quarter: null, tags: [], clipStart: 0, clipLength: 30, source: { kind: "none" }, coverUrl: oldUrl });
    const snapshot = songSnapshot("test", doc);
    const before = songCoverReferences(doc, snapshot);
    doc.tracks[0].coverUrl = "https://example.com/new.jpg";
    await cleanSongCovers(before, songCoverReferences(doc, snapshot));
    expect((await stat(path.join(directory, path.basename(oldUrl)))).isFile()).toBe(true);
    expect(snapshot.rows.find(r => r.id === "pending")?.songs[0].coverUrl).toBe(oldUrl);
    await cleanSongCovers(before, songCoverReferences(doc, null));
    await expect(stat(path.join(directory, path.basename(oldUrl)))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("accepts external HTTPS and the existing local cover, rejects other local paths", () => {
    const local = "/uploads/anime-covers/song-board-track.webp";
    expect(coverUrlInput(local, local)).toBe(local);
    expect(coverUrlInput("https://example.com/cover.png")).toBe("https://example.com/cover.png");
    expect(coverUrlInput("")).toBeNull();
    for (const value of [local, "/uploads/anime-covers/another.jpg", "javascript:alert(1)", "http://example.com/cover.png"]) expect(() => coverUrlInput(value)).toThrow();
  });
});
