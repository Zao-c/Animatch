import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBlob } from "music-metadata";
import { cleanSongTag, riffSongTag, embeddedCover, filenameMetadata } from "@/lib/anisong/metadata";
import { readLocalSongMetadata } from "@/lib/anisong/metadata-reader";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const file = () => new File([new Uint8Array(30)], "歌手 - 夜空.mp3", { type: "audio/mpeg" });
class FakeWorker {
  static last: FakeWorker;
  onmessage?: (e: { data: unknown }) => void;
  onerror?: (e: { preventDefault: () => void }) => void;
  onmessageerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { FakeWorker.last = this; }
}

describe("local song metadata", () => {
  it("uses a filename fallback without inventing an artist", () => {
    expect(filenameMetadata("歌手 - 夜空.flac")).toEqual({ artist: "歌手", title: "夜空" });
    expect(filenameMetadata("OP.01.wav")).toEqual({ artist: "", title: "OP.01" });
  });
  it("cleans control characters and limits tags to supported lengths", () => {
    expect(cleanSongTag("\u0000夜空\n")).toBe("夜空");
    expect(cleanSongTag("a".repeat(140))).toHaveLength(120);
    expect(cleanSongTag(42)).toBe("");
  });
  it("repairs UTF-8 WAV tags while preserving Latin-1 names", () => {
    expect(riffSongTag(Buffer.from("星空序曲", "utf8").toString("latin1"))).toBe("星空序曲");
    expect(riffSongTag("Beyoncé")).toBe("Beyoncé");
    expect(riffSongTag("星空")).toBe("星空");
  });
  it("prefers a front cover and excludes unsupported or oversized artwork", async () => {
    const cover = embeddedCover([
      { format: "image/png", data: new Uint8Array([1]), type: "Cover (back)" },
      { format: "image/jpeg", data: new Uint8Array([2]), type: "Cover (front)" }
    ]);
    expect(cover?.type).toBe("image/jpeg");
    expect([...new Uint8Array(await cover!.arrayBuffer())]).toEqual([2]);
    expect(embeddedCover([{ format: "image/svg+xml", data: new Uint8Array([1]) }])).toBeNull();
    expect(embeddedCover([{ format: "image/png", data: new Uint8Array(5 * 1024 * 1024 + 1) }])).toBeNull();
  });
  it("parses real UTF-16 ID3 frames through the pinned parser", async () => {
    function textFrame(id: string, value: string) {
      const data = Buffer.concat([Buffer.from([1, 0xff, 0xfe]), Buffer.from(value, "utf16le")]);
      const header = Buffer.alloc(10); header.write(id); header.writeUInt32BE(data.length, 4);
      return Buffer.concat([header, data]);
    }
    const tags = Buffer.concat([textFrame("TIT2", "星空序曲"), textFrame("TPE1", "测试歌手")]);
    const header = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (tags.length >> 21) & 127, (tags.length >> 14) & 127, (tags.length >> 7) & 127, tags.length & 127]);
    const frame = Buffer.alloc(417); frame.set([0xff, 0xfb, 0x90, 0x64]);
    const metadata = await parseBlob(new Blob([header, tags, frame, frame, frame], { type: "audio/mpeg" }));
    expect(metadata.common.title).toBe("星空序曲");
    expect(metadata.common.artist).toBe("测试歌手");
  });
  it("terminates its worker after a successful read", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const pending = readLocalSongMetadata(file());
    FakeWorker.last.onmessage?.({ data: { title: "标签歌名", artist: "标签歌手", cover: null, note: "已读取" } });
    expect((await pending).title).toBe("标签歌名");
    expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("terminates stalled parsing and falls back after ten seconds", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", FakeWorker);
    const pending = readLocalSongMetadata(file());
    await vi.advanceTimersByTimeAsync(10000);
    expect((await pending).note).toContain("超时");
    expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("cancels a running parser and ignores late results", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const controller = new AbortController();
    const pending = readLocalSongMetadata(file(), controller.signal);
    controller.abort();
    FakeWorker.last.onmessage?.({ data: { title: "late" } });
    expect((await pending).title).toBe("夜空");
    expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("does not start a worker for already cancelled reads", async () => {
    const worker = vi.fn(); vi.stubGlobal("Worker", worker);
    const controller = new AbortController(); controller.abort();
    expect((await readLocalSongMetadata(file(), controller.signal)).note).toContain("跳过");
    expect(worker).not.toHaveBeenCalled();
  });
  it("falls back when workers are unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    expect((await readLocalSongMetadata(file())).title).toBe("夜空");
  });
  it("falls back on parser errors and releases the worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const pending = readLocalSongMetadata(file());
    FakeWorker.last.onerror?.({ preventDefault: vi.fn() });
    expect((await pending).note).toContain("无法读取");
    expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
});
