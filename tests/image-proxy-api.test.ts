import { afterEach, describe, it, expect, vi } from "vitest";
import dns from "dns/promises";
import { GET } from "../src/app/api/image-proxy/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockPublicDns(address = "203.0.113.10") {
  vi.spyOn(dns, "lookup").mockResolvedValue([{ address, family: 4 }] as never);
}

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

  it("rejects IPv6 loopback", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://[::1]:3000/secret")
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

  it("rejects external hostnames that resolve to private addresses", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "192.168.1.20", family: 4 }] as never);
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=https://cdn.example.test/cover.png")
    );
    expect(response.status).toBe(400);
  });

  it("rejects configured app hostnames to avoid proxying itself", async () => {
    process.env.ANIMATCH_IMAGE_PROXY_BLOCKED_HOSTS = "animatch.example.test,182.61.136.105";
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=https://animatch.example.test/api/health")
    );
    expect(response.status).toBe(400);
    delete process.env.ANIMATCH_IMAGE_PROXY_BLOCKED_HOSTS;
  });

  it("rejects unknown public hosts outside the image allowlist", async () => {
    mockPublicDns();
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=https://cdn.example.test/cover.png")
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "hostname not allowed" });
  });
});

describe("image proxy API upstream handling", () => {
  it("proxies image responses and sends TierMaker referer", async () => {
    mockPublicDns();
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

    const originalUrl = `https://cdn.tiermaker.com/images/item.png?case=tiermaker-${Date.now()}`;
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
    mockPublicDns();
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

    const originalUrl = `https://lain.bgm.tv/pic/cover/l/12/34/5678.jpg?case=bangumi-${Date.now()}`;
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
    mockPublicDns();
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

  it("rejects redirects to private addresses before following them", async () => {
    process.env.ANIMATCH_IMAGE_PROXY_ALLOWED_HOSTS = "cdn.example.test";
    vi.spyOn(dns, "lookup").mockImplementation(async (hostname) => {
      return String(hostname) === "internal.example.test"
        ? ([{ address: "127.0.0.1", family: 4 }] as never)
        : ([{ address: "203.0.113.10", family: 4 }] as never);
    });
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: {
          location: "http://internal.example.test/private.png"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        "http://localhost:3000/api/image-proxy?url=https%3A%2F%2Fcdn.example.test%2Fredirect.png"
      )
    );

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    delete process.env.ANIMATCH_IMAGE_PROXY_ALLOWED_HOSTS;
  });

  it("proxies explicitly configured image hosts", async () => {
    process.env.ANIMATCH_IMAGE_PROXY_ALLOWED_HOSTS = "cdn.example.test";
    mockPublicDns();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: {
            "content-type": "image/webp",
            "content-length": "1"
          }
        })
      )
    );

    const response = await GET(
      new Request(
        "http://localhost:3000/api/image-proxy?url=https%3A%2F%2Fcdn.example.test%2Fcover.webp"
      )
    );

    expect(response.status).toBe(200);
    delete process.env.ANIMATCH_IMAGE_PROXY_ALLOWED_HOSTS;
  });
});
