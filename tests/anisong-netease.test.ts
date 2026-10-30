import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { neteaseId, normalizeNeteaseSong, normalizePlayback, searchNetease, resolveNetease } from "@/lib/anisong/netease/api";
import { accountOperation, accountStatus, startNeteaseLogin, pollNeteaseLogin, readNeteaseAccount, disconnectNetease } from "@/lib/anisong/netease/accounts";
import { limitNetease } from "@/lib/anisong/netease/limits";
let directory: string;
const fetcher = vi.fn();
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "anisong-ncm-test-"));
  vi.stubEnv("NETEASE_ACCOUNT_DIR", directory); vi.stubEnv("AUTH_SECRET", "test-encryption-secret"); vi.stubEnv("NETEASE_API_URL", "http://127.0.0.1:3001");
  fetcher.mockReset(); vi.stubGlobal("fetch", fetcher);
});
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
function loginResponses() {
  fetcher.mockImplementation(async (url: URL) => {
    if (url.pathname === "/login/qr/key") return response({ data: { unikey: "qr-key" } });
    if (url.pathname === "/login/qr/create") return response({ data: { qrimg: "data:image/png;base64,AAAA" } });
    if (url.pathname === "/login/qr/check") return response({ code: 803, cookie: "MUSIC_U=test-private-cookie;" });
    if (url.pathname === "/login/status") return response({ data: { profile: { userId: 12, nickname: "测试用户" } } });
    throw new Error("unexpected endpoint");
  });
}
describe("NetEase adapter", () => {
  it("validates IDs without accepting query strings or URLs", () => {
    expect(neteaseId("12345")).toBe("12345");
    for (const value of ["0", "-1", "123&unblock=true", "https://example.com", "1.1", 123]) expect(() => neteaseId(value)).toThrow();
  });
  it("normalizes metadata and restricts artwork hosts", () => {
    expect(normalizeNeteaseSong({ id: 123, name: "歌曲", ar: [{ name: "歌手" }], al: { name: "专辑", picUrl: "http://p1.music.126.net/cover.jpg" }, dt: 120000, fee: 1 })).toEqual({ id: "123", title: "歌曲", artist: "歌手", album: "专辑", coverUrl: "https://p1.music.126.net/cover.jpg", duration: 120000, restricted: true });
    expect(normalizeNeteaseSong({ id: 123, album: { picUrl: "https://music.126.net.evil.test/a" } }).coverUrl).toBeNull();
  });
  it("returns only approved audio URLs and caps expiry", () => {
    const value = normalizePlayback({ code: 200, data: [{ id: 123, url: "http://m7.music.126.net/a.mp3", expi: 9999, freeTrialInfo: { start: 10, end: 40 } }] }, "123");
    expect(value.url).toBe("https://m7.music.126.net/a.mp3"); expect(value.trial).toBe(true); expect(value.expiresAt - Date.now()).toBeLessThanOrEqual(300000);
    for (const url of [null, "https://127.0.0.1/a", "https://evil.test/a", "https://m7.music.126.net:8443/a", "https://a:b@m7.music.126.net/a"]) expect(() => normalizePlayback({ code: 200, data: [{ id: 123, url }] }, "123")).toThrow();
    expect(() => normalizePlayback({ code: 200, data: [{ id: 999, url: "https://m7.music.126.net/a" }] }, "123")).toThrow();
  });
  it("sends cookies only server-to-server and disables alternate-source unlocking", async () => {
    fetcher.mockResolvedValue(response({ code: 200, data: [{ id: 123, url: "https://m7.music.126.net/a.mp3" }] }));
    await resolveNetease("123", "MUSIC_U=private");
    const [url, init] = fetcher.mock.calls[0];
    expect(url.href).not.toContain("private"); expect(init.cache).toBe("no-store"); expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toMatchObject({ cookie: "MUSIC_U=private", unblock: "false", level: "standard" });
  });
  it("uses a fresh upstream cache key for every account request", async () => {
    fetcher.mockImplementation(async () => response({ code: 200, result: { songs: [] } }));
    await searchNetease("a", "user-a"); await searchNetease("a", "user-b");
    expect(fetcher.mock.calls[0][0].href).not.toBe(fetcher.mock.calls[1][0].href);
  });
  it("turns upstream failure into a music-specific message without exposing it", async () => {
    fetcher.mockRejectedValue(new Error("secret upstream details"));
    await expect(searchNetease("a", "")).rejects.toMatchObject({ statusCode: 502, message: "网易云服务连接失败或超时，请稍后重试" });
  });
  it("supports disabled deployments without a failing account panel", async () => {
    vi.stubEnv("NETEASE_API_URL", ""); expect(await accountStatus("owner")).toEqual({ enabled: false, connected: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rate limits per user and operation", () => {
    const user = `limits-${Date.now()}`; limitNetease(user, "test", 1);
    expect(() => limitNetease(user, "test", 1)).toThrow(); expect(() => limitNetease(user, "other", 1)).not.toThrow();
  });
});
describe("NetEase account isolation", () => {
  it("keeps credentials encrypted and isolated, without returning them to the browser", async () => {
    loginResponses(); await startNeteaseLogin("owner-a"); expect(await pollNeteaseLogin("owner-a")).toEqual({ state: "connected" });
    expect(await readNeteaseAccount("owner-b")).toEqual({}); expect((await readNeteaseAccount("owner-a")).cookie).toContain("test-private-cookie");
    const files = await readdir(directory); expect(files).toHaveLength(1);
    expect(await readFile(path.join(directory, files[0]), "utf8")).not.toContain("test-private-cookie");
    expect((await stat(path.join(directory, files[0]))).mode & 0o777).toBe(0o600);
    expect(await accountStatus("owner-a")).toEqual({ enabled: true, connected: true, nickname: "测试用户" });
  });
  it("does not accept a credential without a logged-in session", async () => {
    loginResponses(); await startNeteaseLogin("owner"); fetcher.mockResolvedValue(response({ code: 803, cookie: "anonymous=true" }));
    await expect(pollNeteaseLogin("owner")).rejects.toMatchObject({ statusCode: 502 }); expect((await readNeteaseAccount("owner")).cookie).toBeUndefined();
  });
  it("rejects corrupted or differently encrypted credentials", async () => {
    loginResponses(); await startNeteaseLogin("owner"); vi.stubEnv("AUTH_SECRET", "different-secret");
    await expect(readNeteaseAccount("owner")).rejects.toMatchObject({ statusCode: 503 });
  });
  it("disconnect removes pending QR sessions and saved credentials", async () => {
    loginResponses(); await startNeteaseLogin("owner"); await pollNeteaseLogin("owner"); await disconnectNetease("owner");
    expect(await readNeteaseAccount("owner")).toEqual({}); expect(await pollNeteaseLogin("owner")).toEqual({ state: "expired" });
  });
  it("serializes disconnect after an in-flight login operation", async () => {
    const order: string[] = []; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = accountOperation("owner", async () => { await gate; order.push("login"); });
    const second = accountOperation("owner", async () => { order.push("disconnect"); });
    release(); await Promise.all([first, second]); expect(order).toEqual(["login", "disconnect"]);
  });
  it("keeps QR polling ownership server-side", async () => {
    loginResponses(); await startNeteaseLogin("owner-a"); fetcher.mockClear();
    expect(await pollNeteaseLogin("owner-b")).toEqual({ state: "expired" }); expect(fetcher).not.toHaveBeenCalled();
  });
});
