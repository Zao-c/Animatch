import { describe, expect, it } from "vitest";
import { boundedBody, detectAudio, parseAudioRange, songJson } from "@/lib/anisong/audio-storage";
import { audioUrlInput, trackInput } from "@/lib/anisong/validation";
describe("music media boundary", () => {
  it("accepts a complete annual layout but still bounds oversized JSON", async () => {
    const rows = { s: Array.from({ length: 1000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12,"0")}`), a: [], b: [], c: [], d: [], pending: [] };
    const input = { revision: 1, action: "tierLayout", rows };
    expect(await songJson(new Request("https://example.com", { method: "PATCH", body: JSON.stringify(input) }))).toEqual(input);
    await expect(songJson(new Request("https://example.com", { method: "PATCH", body: "x".repeat(128 * 1024 + 1) }))).rejects.toMatchObject({ statusCode: 413 });
  });

  it("handles browser byte ranges, including suffix and open-ended seeks", () => {
    expect(parseAudioRange(null, 100)).toBeNull();
    expect(parseAudioRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseAudioRange("bytes=20-", 100)).toEqual({ start: 20, end: 99 });
    expect(parseAudioRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseAudioRange("bytes=50-999", 100)).toEqual({ start: 50, end: 99 });
    for (const value of ["bytes=100-", "bytes=5-2", "bytes=-0", "bytes=0-1,3-4", "bytes=-", "foo", "bytes=99999999999999999999-"]) expect(() => parseAudioRange(value, 100)).toThrow();
  });
  it("checks file signatures instead of trusting names or MIME", () => {
    expect(detectAudio(new TextEncoder().encode("RIFF1234WAVEpayload"))?.mime).toBe("audio/wav");
    expect(detectAudio(new TextEncoder().encode("ID3abcdefghijklm"))?.mime).toBe("audio/mpeg");
    expect(detectAudio(new TextEncoder().encode("<html>not audio</html>"))).toBeNull();
  });
  it("bounds streamed bodies even without a content-length header", async () => {
    const request = new Request("https://example.com", { method: "POST", body: "123456" });
    await expect(boundedBody(request, 5)).rejects.toMatchObject({ statusCode: 413 });
    expect((await boundedBody(new Request("https://example.com", { method: "POST", body: "123" }), 5)).byteLength).toBe(3);
  });
  it("only allows public HTTPS media addresses", () => {
    for (const value of ["javascript:alert(1)", "http://example.com/a.mp3", "https://localhost/a", "https://127.0.0.1/a", "https://192.168.0.1/a", "https://user:password@example.com/a", "https://[::1]/a"]) expect(() => audioUrlInput(value)).toThrow();
    expect(audioUrlInput("https://example.com/a.mp3")).toBe("https://example.com/a.mp3");
  });
  it("validates clip bounds and seasonal metadata", () => {
    expect(trackInput({ title: " song ", kind: "ED", year: "2026", quarter: "4", tags: "rock,rock" })).toMatchObject({ title: "song", kind: "ED", year: 2026, quarter: 4, tags: ["rock"], clipStart: 0, clipLength: 30 });
    for (const invalid of [{ title: "" }, { title: "a", quarter: 1.5 }, { title: "a", clipStart: -1 }, { title: "a", clipLength: 100 }, { title: "a", kind: "INVALID" }]) expect(() => trackInput(invalid)).toThrow();
  });
});
