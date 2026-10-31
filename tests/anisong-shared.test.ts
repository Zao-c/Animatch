import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { songPlaybackPlan } from "@/lib/anisong/playback";
import { templateDocument } from "@/lib/anisong/shared/templates";
import { storePublicAudio } from "@/lib/anisong/shared/audio-pool";
import { publicAudioHost, publicIPv4, downloadPublicAudio } from "@/lib/anisong/shared/download";
import { normalizeItunes } from "@/lib/anisong/itunes/api";
import type { SongTrack } from "@/lib/anisong/types";
const mocks = vi.hoisted(() => ({ find: vi.fn(), upsert: vi.fn(), update: vi.fn(), aggregate: vi.fn(), lookup: vi.fn(), fetch: vi.fn(), cosPut: vi.fn(), cosHead: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { songAudioAsset: { findUnique: mocks.find, upsert: mocks.upsert, update: mocks.update, aggregate: mocks.aggregate } } }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("undici", async original => ({ ...await original<typeof import("undici")>(), fetch: mocks.fetch }));
vi.mock("cos-nodejs-sdk-v5", () => ({ default: class { putObject(...args: any[]) { return mocks.cosPut(...args); } headObject(...args: any[]) { return mocks.cosHead(...args); } } }));
const track: SongTrack = { id: "song", title: "Cipher", artist: "Kevin MacLeod", anime: "", kind: "OTHER", year: null, quarter: null, tags: ["电音"], clipStart: 35, clipLength: 30, source: { kind: "pool", assetId: "asset" }, itunes: { id: "123", country: "JP", title: "Cipher", artist: "Kevin MacLeod", storeUrl: "https://music.apple.com/jp/album/a/123" } };
let directory: string;
beforeEach(async () => { vi.clearAllMocks(); directory = await mkdtemp(path.join(tmpdir(), "song-public-test-")); vi.stubEnv("ANISONG_PUBLIC_AUDIO_DIR", directory); for (const key of ["ANISONG_COS_SECRET_ID", "ANISONG_COS_SECRET_KEY", "ANISONG_COS_BUCKET", "ANISONG_COS_REGION", "ANISONG_COS_PREFIX", "ANISONG_COS_PUBLIC_BASE_URL"]) vi.stubEnv(key, ""); mocks.aggregate.mockResolvedValue({ _sum: { bytes: 0 } }); mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("shared playback choices", () => {
  it.each([
    ["pool", true, ["pool", "itunes"]], ["itunes", true, ["itunes", "pool"]], ["pool", false, ["pool"]], ["itunes", false, ["itunes"]]
  ] as const)("honors preferred %s and fallback %s", (preferred, fallback, expected) => { expect(songPlaybackPlan(track, { preferred, fallback })).toEqual(expected); });
  it("falls back only to sources actually attached to this recording", () => {
    expect(songPlaybackPlan({ ...track, itunes: null }, { preferred: "itunes", fallback: true })).toEqual(["pool"]);
    expect(songPlaybackPlan({ ...track, itunes: null }, { preferred: "itunes", fallback: false })).toEqual([]);
    expect(songPlaybackPlan({ ...track, source: { kind: "none" } }, { preferred: "pool", fallback: true })).toEqual(["itunes"]);
  });
  it("supports private uploads before publication without requiring a provider login", () => {
    expect(songPlaybackPlan({ ...track, source: { kind: "upload", key: "a.wav", mime: "audio/wav", bytes: 44 } }, { preferred: "pool", fallback: true })).toEqual(["original", "itunes"]);
  });
});
describe("template isolation", () => {
  it("copies songs without a creator's private paths, platform sessions or import keys", () => {
    const result = templateDocument([{ ...track, importKey: "private-queue", source: { kind: "url", url: "https://example.com/private.mp3" } }, { ...track, id: "b", source: { kind: "netease", id: "123" } }]);
    expect(result.events).toEqual([]); expect(result.manualTiers).toEqual({}); expect(result.candidateIds).toBeNull();
    expect(result.tracks.every(t => t.source.kind === "none")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-queue"); expect(JSON.stringify(result)).not.toContain("private.mp3"); expect(JSON.stringify(result)).not.toContain("netease");
    expect(result.tracks[0].itunes?.id).toBe("123");
  });
  it("preserves public asset references while separating mutable metadata", () => {
    const result = templateDocument([track]); result.tracks[0].tags.push("new"); result.tracks[0].itunes!.id = "456";
    expect(track.tags).toEqual(["电音"]); expect(track.itunes?.id).toBe("123"); expect(result.tracks[0].source).toEqual({ kind: "pool", assetId: "asset" });
  });
});
describe("public audio download boundary", () => {
  it("rejects private names, credentials, ports, IP literals and Apple media ingestion", () => {
    for (const url of ["http://example.com/a", "https://127.0.0.1/a", "https://[::1]/a", "https://a.internal/a", "https://user:password@example.com/a", "https://example.com:8443/a", "https://audio-ssl.itunes.apple.com/a.m4a", "https://is1-ssl.mzstatic.com/a"]) expect(() => publicAudioHost(url)).toThrow();
    expect(publicAudioHost("https://example.com/song.mp3").hostname).toBe("example.com");
  });
  it("rejects private, link-local, reserved, CGNAT and IPv6 DNS results", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "172.31.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "224.0.0.1", "::1", "::ffff:127.0.0.1"]) expect(publicIPv4(ip)).toBe(false);
    expect(publicIPv4("8.8.8.8")).toBe(true);
  });
  it("does not fetch a hostname resolving into the private network", async () => {
    mocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(downloadPublicAudio("https://example.com/song.mp3")).rejects.toThrow("受限网络"); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("validates redirects before making another connection", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/secret" } }));
    await expect(downloadPublicAudio("https://example.com/song.mp3")).rejects.toThrow(); expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("bounds downloads by content length", async () => {
    mocks.fetch.mockResolvedValue(new Response("large", { headers: { "Content-Length": String(21 * 1024 * 1024) } }));
    await expect(downloadPublicAudio("https://example.com/song.mp3")).rejects.toMatchObject({ statusCode: 413 });
  });
});
describe("public audio storage", () => {
  const bytes = new Uint8Array(44); bytes.set(Buffer.from("RIFF")); bytes.set(Buffer.from("WAVE"), 8);
  it("uses content hashes to reuse one immutable asset", async () => {
    let saved: any = null;
    mocks.find.mockImplementation(async () => saved); mocks.upsert.mockImplementation(async ({ create }: any) => saved = { id: "asset", ...create });
    const a = await storePublicAudio(bytes), b = await storePublicAudio(bytes);
    expect(a.id).toBe(b.id); expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(a.sha256).toBe(createHash("sha256").update(bytes).digest("hex")); expect(await readFile(path.join(directory, a.key))).toEqual(Buffer.from(bytes));
  });
  it("restores a missing asset file while keeping its public reference", async () => {
    const sha256 = createHash("sha256").update(bytes).digest("hex"); const asset = { id: "existing", sha256, key: `${sha256}.wav`, bytes: 44, mime: "audio/wav", isPreview: false };
    mocks.find.mockResolvedValue(asset);
    mocks.update.mockImplementation(async ({ data }: any) => ({ ...asset, ...data }));
    expect((await storePublicAudio(bytes)).id).toBe("existing");
    expect(await readFile(path.join(directory, asset.key))).toEqual(Buffer.from(bytes));
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "existing" }, data: expect.objectContaining({ previewKey: asset.key, previewBytes: bytes.length }) });
  });
  it("rejects invalid files and full-pool writes", async () => {
    await expect(storePublicAudio(new Uint8Array(44))).rejects.toThrow("格式");
    mocks.find.mockResolvedValue(null); mocks.aggregate.mockResolvedValue({ _sum: { bytes: 5 * 1024 * 1024 * 1024 } });
    await expect(storePublicAudio(bytes)).rejects.toMatchObject({ statusCode: 507 }); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("stores content-addressed audio in COS with per-object public Range caching", async () => {
    for (const [key, value] of Object.entries({ ANISONG_COS_SECRET_ID: "test-id", ANISONG_COS_SECRET_KEY: "test-key", ANISONG_COS_BUCKET: "audio-123", ANISONG_COS_REGION: "ap-guangzhou", ANISONG_COS_PREFIX: "AniMatch/audio-pool", ANISONG_COS_PUBLIC_BASE_URL: "https://audio-123.cos.ap-guangzhou.myqcloud.com" })) vi.stubEnv(key, value);
    mocks.find.mockResolvedValue(null);
    mocks.cosPut.mockImplementation((_params: any, callback: (error: null) => void) => callback(null));
    mocks.upsert.mockImplementation(async ({ create }: any) => ({ id: "cos-asset", ...create }));
    const asset = await storePublicAudio(bytes);
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(asset.storageProvider).toBe("cos");
    expect(mocks.cosPut.mock.calls[0][0]).toMatchObject({ Bucket: "audio-123", Region: "ap-guangzhou", Key: `AniMatch/audio-pool/${hash}.wav`, ACL: "public-read", CacheControl: "public, max-age=31536000, immutable", ContentType: "audio/wav" });
    expect(mocks.upsert.mock.calls[0][0].create.storageProvider).toBe("cos");
  });
  it("moves a legacy local asset to COS without changing its identity", async () => {
    for (const [key, value] of Object.entries({ ANISONG_COS_SECRET_ID: "test-id", ANISONG_COS_SECRET_KEY: "test-key", ANISONG_COS_BUCKET: "audio-123", ANISONG_COS_REGION: "ap-guangzhou", ANISONG_COS_PREFIX: "AniMatch/audio-pool" })) vi.stubEnv(key, value);
    const hash = createHash("sha256").update(bytes).digest("hex"), legacy = { id: "legacy", sha256: hash, key: `${hash}.wav`, bytes: 44, mime: "audio/wav", isPreview: false, storageProvider: "local" };
    mocks.find.mockResolvedValue(legacy);
    mocks.cosPut.mockImplementation((_params: any, callback: (error: null) => void) => callback(null));
    mocks.update.mockImplementation(async ({ data }: any) => ({ ...legacy, ...data }));
    const asset = await storePublicAudio(bytes);
    expect(asset).toMatchObject({ id: "legacy", key: legacy.key, storageProvider: "cos" });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "legacy" }, data: expect.objectContaining({ storageProvider: "cos", previewKey: legacy.key, previewBytes: bytes.length }) });
  });
  it("builds the public audio URL from the configured COS origin", async () => {
    for (const [key, value] of Object.entries({ ANISONG_COS_SECRET_ID: "test-id", ANISONG_COS_SECRET_KEY: "test-key", ANISONG_COS_BUCKET: "audio-123", ANISONG_COS_REGION: "ap-guangzhou", ANISONG_COS_PREFIX: "AniMatch/audio-pool", ANISONG_COS_PUBLIC_BASE_URL: "https://audio-123.cos.ap-guangzhou.myqcloud.com" })) vi.stubEnv(key, value);
    const { cosAudioPublicUrl } = await import("@/lib/anisong/shared/cos-audio");
    expect(cosAudioPublicUrl(`${"a".repeat(64)}.mp3`)).toBe(`https://audio-123.cos.ap-guangzhou.myqcloud.com/AniMatch/audio-pool/${"a".repeat(64)}.mp3`);
  });
});
describe("iTunes metadata", () => {
  it("keeps storefront identity and rejects untrusted preview hosts", () => {
    const item = { kind: "song", trackId: 123, trackName: "Song", artistName: "Artist", trackViewUrl: "https://music.apple.com/jp/album/song/123", previewUrl: "https://audio-ssl.itunes.apple.com/a.m4a", artworkUrl100: "https://is1-ssl.mzstatic.com/cover.jpg" };
    expect(normalizeItunes(item, "JP")).toMatchObject({ reference: { id: "123", country: "JP" }, hasPreview: true });
    expect(normalizeItunes({ ...item, previewUrl: "https://evil.test/a" }, "JP")?.hasPreview).toBe(false);
    expect(normalizeItunes({ ...item, trackViewUrl: "javascript:alert(1)" }, "JP")).toBeNull();
  });
});
