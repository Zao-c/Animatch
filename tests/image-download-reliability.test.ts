import dns from "node:dns/promises";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/image-proxy/route";
import { readLimitedBody } from "../src/lib/server/read-limited-body";

beforeEach(() => {
  vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as never);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const request = (url = `https://lain.bgm.tv/reliability-${randomUUID()}.png`) =>
  new Request(`http://localhost:3000/api/image-proxy?url=${encodeURIComponent(url)}`);
const imageResponse = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });

describe("bounded image downloads", () => {
  it("serves cached bytes even when the origin DNS becomes unavailable", async () => {
    const fetchMock = vi.fn(async () => imageResponse());
    vi.stubGlobal("fetch", fetchMock);
    const req = request();
    expect((await GET(req)).status).toBe(200);
    vi.mocked(dns.lookup).mockRejectedValue(new Error("DNS unavailable"));
    const response = await GET(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Animatch-Image-Cache")).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("aborts a body that hangs after successful response headers", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }));
    const controller = new AbortController();
    const pending = readLimitedBody(response, 100, controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects oversized chunked bodies without requiring Content-Length", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(101)); }, cancel
    }));
    await expect(readLimitedBody(response, 100, new AbortController().signal)).rejects.toThrow("image too large");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("holds upstream slots until the image bytes finish downloading", async () => {
    const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
    const fetchMock = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { streams.push(controller); }
    }), { headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);
    const requests = Array.from({ length: 6 }, () => GET(request()));
    await vi.waitFor(() => expect(streams).toHaveLength(4));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (let index = 0; index < 6; index++) {
      await vi.waitFor(() => expect(streams.length).toBeGreaterThan(index));
      streams[index].enqueue(new Uint8Array([1]));
      streams[index].close();
    }
    expect((await Promise.all(requests)).every(response => response.status === 200)).toBe(true);
  });

  it("does not hammer a broken origin again for each visitor", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const req = request();
    expect((await GET(req)).status).toBe(502);
    expect((await GET(req)).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns a stale image before a slow revalidation completes", async () => {
    const url = `https://lain.bgm.tv/stale-${randomUUID()}.png`;
    globalThis.__animatchImageProxyCache!.entries.set(url, {
      buffer: Buffer.from([7]), contentType: "image/png",
      cachedAt: Date.now() - 25 * 60 * 60 * 1000, lastAccessedAt: Date.now()
    });
    let release!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
    const response = await GET(request(url));
    expect(response.headers.get("X-Animatch-Image-Cache")).toBe("STALE");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([7]));
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release(imageResponse());
    await vi.waitFor(() => expect(globalThis.__animatchImageProxyFetchState!.inFlightByCacheKey.size).toBe(0));
  });
});
