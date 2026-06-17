import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOutboundFetchInfo } from "../src/lib/server/outbound-fetch";

const originalEnv = { ...process.env };

function clearProxyEnv() {
  delete process.env.ANIMATCH_OUTBOUND_PROXY_URL;
  delete process.env.HTTPS_PROXY;
  delete process.env.https_proxy;
  delete process.env.HTTP_PROXY;
  delete process.env.http_proxy;
  delete process.env.NO_PROXY;
}

describe("outbound-fetch info (no proxy)", () => {
  beforeEach(() => {
    clearProxyEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reports no proxy when none configured", () => {
    const info = getOutboundFetchInfo();
    expect(info.proxyConfigured).toBe(false);
    expect(info.proxySource).toBe("none");
  });

  it("includes default NO_PROXY hosts", () => {
    const info = getOutboundFetchInfo();
    expect(info.noProxyHosts).toContain("localhost");
    expect(info.noProxyHosts).toContain("127.0.0.1");
    expect(info.noProxyHosts).toContain("postgres");
  });
});

describe("outbound-fetch info (with proxy)", () => {
  beforeEach(() => {
    clearProxyEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("detects ANIMATCH_OUTBOUND_PROXY_URL (highest priority)", () => {
    process.env.ANIMATCH_OUTBOUND_PROXY_URL = "http://proxy.test:8080";
    process.env.HTTPS_PROXY = "http://other-proxy.test:8080";
    const info = getOutboundFetchInfo();
    expect(info.proxyConfigured).toBe(true);
    expect(info.proxySource).toBe("ANIMATCH_OUTBOUND_PROXY_URL=***");
  });

  it("falls back to HTTPS_PROXY", () => {
    process.env.HTTPS_PROXY = "http://https-proxy.test:8080";
    const info = getOutboundFetchInfo();
    expect(info.proxyConfigured).toBe(true);
    expect(info.proxySource).toBe("HTTPS_PROXY=***");
  });

  it("falls back to HTTP_PROXY", () => {
    process.env.HTTP_PROXY = "http://http-proxy.test:8080";
    const info = getOutboundFetchInfo();
    expect(info.proxyConfigured).toBe(true);
    expect(info.proxySource).toBe("HTTP_PROXY=***");
  });

  it("supports lowercase env variants", () => {
    process.env.https_proxy = "http://lower-https.test:8080";
    const info = getOutboundFetchInfo();
    expect(info.proxyConfigured).toBe(true);
    expect(info.proxySource).toBe("HTTPS_PROXY=***");
  });

  it("does not leak proxy URL in info", () => {
    process.env.HTTPS_PROXY = "http://secret-user:secret-pass@proxy.internal:3128";
    const info = getOutboundFetchInfo();
    expect(info.proxySource).not.toContain("secret");
    expect(info.proxySource).not.toContain("3128");
    expect(info.proxySource).not.toContain("proxy.internal");
  });
});

describe("outbound-fetch NO_PROXY", () => {
  beforeEach(() => {
    clearProxyEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns custom NO_PROXY hosts", () => {
    process.env.NO_PROXY = "api.internal,cdn.test,.corp.local";
    const info = getOutboundFetchInfo();
    expect(info.noProxyHosts).toContain("api.internal");
    expect(info.noProxyHosts).toContain("cdn.test");
    expect(info.noProxyHosts).toContain(".corp.local");
  });

  it("trims whitespace from NO_PROXY entries", () => {
    process.env.NO_PROXY = "host-a, host-b ,  host-c  ";
    const info = getOutboundFetchInfo();
    expect(info.noProxyHosts).toContain("host-a");
    expect(info.noProxyHosts).toContain("host-b");
    expect(info.noProxyHosts).toContain("host-c");
  });

  it("filters empty NO_PROXY entries", () => {
    process.env.NO_PROXY = "host-a,,host-b";
    const info = getOutboundFetchInfo();
    expect(info.noProxyHosts.length).toBe(2);
  });
});

describe("outbound-fetch proxy env priority", () => {
  beforeEach(() => {
    clearProxyEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("ANIMATCH_OUTBOUND_PROXY_URL takes precedence over HTTPS_PROXY", () => {
    process.env.ANIMATCH_OUTBOUND_PROXY_URL = "http://primary.test:9090";
    process.env.HTTPS_PROXY = "http://secondary.test:8080";
    process.env.HTTP_PROXY = "http://tertiary.test:8080";
    const info = getOutboundFetchInfo();
    expect(info.proxySource).toBe("ANIMATCH_OUTBOUND_PROXY_URL=***");
  });

  it("HTTPS_PROXY takes precedence over HTTP_PROXY", () => {
    process.env.HTTPS_PROXY = "http://https-p.test:8080";
    process.env.HTTP_PROXY = "http://http-p.test:8080";
    const info = getOutboundFetchInfo();
    expect(info.proxySource).toBe("HTTPS_PROXY=***");
  });
});

describe("outbound-fetch fetch behavior", () => {
  beforeEach(() => {
    clearProxyEnv();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("outboundFetch succeeds when fetch works (no proxy)", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ data: [{ id: 1 }] })),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const { outboundFetch } = await import("../src/lib/server/outbound-fetch");
    const res = await outboundFetch("https://api.bgm.tv/test", { method: "GET" });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    const json = await res.json<{ data: Array<{ id: number }> }>();
    expect(json.data[0].id).toBe(1);
  });

  it("outboundFetch sets User-Agent header", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("{}"),
    };
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const { outboundFetch } = await import("../src/lib/server/outbound-fetch");
    await outboundFetch("https://api.bgm.tv/test");

    const fetchArgs = fetchSpy.mock.calls[0];
    expect(fetchArgs[1].headers["User-Agent"]).toContain("AniMatch");
  });

  it("outboundFetch throws on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")));

    const { outboundFetch } = await import("../src/lib/server/outbound-fetch");
    await expect(outboundFetch("https://api.bgm.tv/test")).rejects.toThrow("outbound_fetch_failed");
  });

  it("outboundFetch timeout aborts request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }));

    const { outboundFetch } = await import("../src/lib/server/outbound-fetch");
    await expect(outboundFetch("https://api.bgm.tv/test", { timeoutMs: 50 })).rejects.toThrow("outbound_fetch_failed");
  });

  it("outboundFetch passes method and body", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("{}"),
    };
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const { outboundFetch } = await import("../src/lib/server/outbound-fetch");
    await outboundFetch("https://api.bgm.tv/search", {
      method: "POST",
      body: JSON.stringify({ filter: { type: [2] } }),
      headers: { "Content-Type": "application/json" },
    });

    expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    expect(fetchSpy.mock.calls[0][1].body).toBe('{"filter":{"type":[2]}}');
    expect(fetchSpy.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
  });
});
