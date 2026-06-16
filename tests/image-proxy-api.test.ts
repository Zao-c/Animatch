import { afterEach, describe, it, expect, vi } from "vitest";
import { GET } from "../src/app/api/image-proxy/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("image proxy API SSRF protection", () => {
  it("rejects missing url parameter", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy")
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("url is required");
  });

  it("rejects invalid url", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=not-a-url")
    );
    expect(response.status).toBe(400);
  });

  it("rejects file protocol", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=file:///etc/passwd")
    );
    expect(response.status).toBe(400);
  });

  it("rejects localhost", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://localhost:3000/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects 127.0.0.1", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://127.0.0.1:3000/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects 0.0.0.0", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://0.0.0.0:3000/")
    );
    expect(response.status).toBe(400);
  });

  it("rejects internal 10.x IP", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://10.0.0.1/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects internal 192.168.x IP", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://192.168.1.1/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects 172.16-31.x IP range", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://172.16.0.1/secret")
    );
    expect(response.status).toBe(400);
    const response2 = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://172.31.255.255/secret")
    );
    expect(response2.status).toBe(400);
  });
});

describe("image proxy API upstream handling", () => {
  it("proxies image responses and sends TierMaker referer", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "3"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const originalUrl = "https://cdn.tiermaker.com/images/item.png";
    const response = await GET(
      new Request(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(originalUrl)}`
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect((await response.arrayBuffer()).byteLength).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith(
      originalUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Referer: "https://tiermaker.com/",
          "User-Agent": expect.stringContaining("Mozilla/5.0")
        })
      })
    );
  });

  it("keeps Bangumi referer for Bangumi cover hosts", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "1"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const originalUrl = "https://lain.bgm.tv/pic/cover/l/12/34/5678.jpg";
    const response = await GET(
      new Request(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(originalUrl)}`
      )
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      originalUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Referer: "https://bgm.tv/"
        })
      })
    );
  });

  it("rejects upstream HTML instead of passing it as an image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html>blocked</html>", {
          status: 200,
          headers: {
            "content-type": "text/html"
          }
        })
      )
    );

    const response = await GET(
      new Request(
        "http://localhost:3000/api/image-proxy?url=https%3A%2F%2Fcdn.tiermaker.com%2Fimages%2Fblocked.png"
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "not an image" });
  });
});
