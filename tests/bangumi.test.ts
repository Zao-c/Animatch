import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:http", () => ({
  request: vi.fn()
}));

vi.mock("node:https", () => ({
  request: vi.fn()
}));

vi.mock("node:tls", () => ({
  connect: vi.fn((options: { socket: unknown }) => options.socket)
}));

vi.mock("undici", () => ({
  request: vi.fn()
}));

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({
    id: "user-1",
    username: "user-1",
    name: "User 1",
    image: null
  }))
}));

import * as http from "node:http";
import * as https from "node:https";
import * as tls from "node:tls";
import { request as undiciRequest } from "undici";
import {
  getBangumiProxyDiagnostic,
  getBangumiProxyUrl,
  normalizeBangumiSubject,
  normalizeProxyEnvValue,
  parseBangumiSubjectIds,
  searchBangumiAnime
} from "../src/lib/bangumi";
import { GET as BANGUMI_DEBUG_GET } from "../src/app/api/anime/bangumi/debug/route";
import { requireCurrentUser } from "../src/lib/auth-session";
import { AppError } from "../src/lib/app-error";

type MockRequest = ClientRequest & {
  writes: string[];
  timeoutHandler?: () => void;
};

const mockedHttpRequest = vi.mocked(http.request);
const mockedHttpsRequest = vi.mocked(https.request);
const mockedTlsConnect = vi.mocked(tls.connect);
const mockedUndiciRequest = vi.mocked(undiciRequest);

const originalProxyEnv = {
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  HTTP_PROXY: process.env.HTTP_PROXY,
  https_proxy: process.env.https_proxy,
  http_proxy: process.env.http_proxy
};
const originalBangumiTokenEnv = {
  BANGUMI_ACCESS_TOKEN: process.env.BANGUMI_ACCESS_TOKEN,
  BANGUMI_TOKEN: process.env.BANGUMI_TOKEN
};

const httpRequestOptions: RequestOptions[] = [];
const httpsRequestOptions: RequestOptions[] = [];
const httpRequests: MockRequest[] = [];
const httpsRequests: MockRequest[] = [];

let nextHttpsStatus = 200;
let nextHttpsBody = JSON.stringify({
  data: [
    {
      id: 258,
      name: "Hyouka",
      name_cn: "冰菓",
      images: { common: "https://img.example/hyouka.jpg" },
      tags: [{ name: "mystery" }]
    }
  ]
});
let nextHttpsError: Error | null = null;
let nextConnectStatus = 200;

function clearProxyEnv() {
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;
  delete process.env.https_proxy;
  delete process.env.http_proxy;
}

function restoreProxyEnv() {
  clearProxyEnv();
  for (const [key, value] of Object.entries(originalProxyEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

function clearBangumiTokenEnv() {
  delete process.env.BANGUMI_ACCESS_TOKEN;
  delete process.env.BANGUMI_TOKEN;
}

function restoreBangumiTokenEnv() {
  clearBangumiTokenEnv();
  for (const [key, value] of Object.entries(originalBangumiTokenEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

function createMockRequest(onEnd: (request: MockRequest) => void): MockRequest {
  const request = new EventEmitter() as MockRequest;
  request.writes = [];
  request.write = vi.fn((chunk: string | Buffer) => {
    request.writes.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as MockRequest["write"];
  request.end = vi.fn(() => {
    queueMicrotask(() => onEnd(request));
    return request;
  }) as MockRequest["end"];
  request.setTimeout = vi.fn((_timeout: number, callback?: () => void) => {
    request.timeoutHandler = callback;
    return request;
  }) as MockRequest["setTimeout"];
  request.destroy = vi.fn((error?: Error) => {
    if (error) {
      queueMicrotask(() => request.emit("error", error));
    }
    return request;
  }) as MockRequest["destroy"];
  return request;
}

function createMockResponse(statusCode: number, body: string): IncomingMessage {
  const response = new EventEmitter() as IncomingMessage;
  response.statusCode = statusCode;
  queueMicrotask(() => {
    response.emit("data", body);
    response.emit("end");
  });
  return response;
}

function createMockSocket() {
  const socket = new EventEmitter() as unknown as import("node:net").Socket;
  socket.unshift = vi.fn();
  socket.destroy = vi.fn();
  return socket;
}

function installRequestMocks() {
  mockedHttpRequest.mockImplementation(((options: RequestOptions) => {
    httpRequestOptions.push(options);
    const request = createMockRequest((req) => {
      const response = { statusCode: nextConnectStatus } as IncomingMessage;
      const socket = createMockSocket();
      req.emit("connect", response, socket, Buffer.alloc(0));
    });
    httpRequests.push(request);
    return request;
  }) as unknown as typeof http.request);

  mockedHttpsRequest.mockImplementation(((options: RequestOptions, callback?: (res: IncomingMessage) => void) => {
    httpsRequestOptions.push(options);
    const request = createMockRequest(() => {
      if (nextHttpsError) {
        request.emit("error", nextHttpsError);
        return;
      }

      if (typeof options.createConnection === "function") {
        (options.createConnection as () => unknown)();
      }

      callback?.(createMockResponse(nextHttpsStatus, nextHttpsBody));
    });
    httpsRequests.push(request);
    return request;
  }) as unknown as typeof https.request);
}

describe("parseBangumiSubjectIds", () => {
  it("parses single ids, comma lists, urls, subject paths, and multiline input", () => {
    expect(
      parseBangumiSubjectIds(`
        876
        876, 877, 878
        https://bgm.tv/subject/876
        https://bangumi.tv/subject/879
        subject/880
      `)
    ).toEqual([876, 877, 878, 879, 880]);
  });

  it("only returns positive integers and preserves first-seen order", () => {
    expect(parseBangumiSubjectIds("0 -1 42 42 subject/7 3.14")).toEqual([42, 7]);
  });
});

describe("normalizeBangumiSubject", () => {
  it("handles missing optional fields defensively", () => {
    const subject = normalizeBangumiSubject({
      id: 876,
      name: "Cowboy Bebop"
    });

    expect(subject).toMatchObject({
      bgmId: 876,
      title: "Cowboy Bebop",
      titleCn: null,
      summary: null,
      imageUrl: null,
      imageSmallUrl: null,
      imageMediumUrl: null,
      imageLargeUrl: null,
      airDate: null,
      bangumiRank: null,
      bangumiScore: null,
      bangumiVotes: null,
      tags: []
    });
  });

  it("maps title, Chinese title, images, tags, rank, score, and votes", () => {
    const subject = normalizeBangumiSubject({
      id: 123,
      name: "Sousou no Frieren",
      name_cn: "葬送的芙莉莲",
      summary: "Journey after the end.",
      air_date: "2023-09-29",
      rank: 1,
      rating: {
        score: 8.9,
        total: 12345
      },
      images: {
        common: "https://img.example/common.jpg",
        small: "https://img.example/small.jpg",
        medium: "https://img.example/medium.jpg",
        large: "https://img.example/large.jpg"
      },
      tags: [{ name: "奇幻" }, { name: "旅行" }, { count: 1 }]
    });

    expect(subject.bgmId).toBe(123);
    expect(subject.title).toBe("Sousou no Frieren");
    expect(subject.titleCn).toBe("葬送的芙莉莲");
    expect(subject.summary).toBe("Journey after the end.");
    expect(subject.imageUrl).toBe("https://img.example/common.jpg");
    expect(subject.imageSmallUrl).toBe("https://img.example/small.jpg");
    expect(subject.imageMediumUrl).toBe("https://img.example/medium.jpg");
    expect(subject.imageLargeUrl).toBe("https://img.example/large.jpg");
    expect(subject.airDate?.toISOString()).toBe("2023-09-29T00:00:00.000Z");
    expect(subject.bangumiRank).toBe(1);
    expect(subject.bangumiScore).toBe(8.9);
    expect(subject.bangumiVotes).toBe(12345);
    expect(subject.tags).toEqual(["奇幻", "旅行"]);
  });

  it("falls back to Chinese title when name is missing and rejects invalid core fields", () => {
    expect(normalizeBangumiSubject({ id: "88", name_cn: "中文标题" }).title).toBe(
      "中文标题"
    );
    expect(() => normalizeBangumiSubject({ name: "No id" })).toThrow();
    expect(() => normalizeBangumiSubject({ id: 1 })).toThrow();
  });

  it("normalizes Bangumi platform into AniMatch animeType", () => {
    expect(normalizeBangumiSubject({ id: 1, name: "TV Anime", platform: "TV" }).animeType).toBe("TV");
    expect(normalizeBangumiSubject({ id: 2, name: "Movie Anime", platform: "剧场版" }).animeType).toBe("MOVIE");
    expect(normalizeBangumiSubject({ id: 3, name: "OVA Anime", platform: "OAD" }).animeType).toBe("OVA");
  });
});

describe("Bangumi request via node http", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProxyEnv();
    clearBangumiTokenEnv();
    httpRequestOptions.length = 0;
    httpsRequestOptions.length = 0;
    httpRequests.length = 0;
    httpsRequests.length = 0;
    nextHttpsStatus = 200;
    nextHttpsError = null;
    nextConnectStatus = 200;
    nextHttpsBody = JSON.stringify({
      data: [
        {
          id: 258,
          name: "Hyouka",
          name_cn: "冰菓",
          images: { common: "https://img.example/hyouka.jpg" },
          tags: [{ name: "mystery" }]
        }
      ]
    });
    installRequestMocks();
  });

  afterEach(() => {
    restoreProxyEnv();
    restoreBangumiTokenEnv();
  });

  it("does not use global fetch or undici request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("should not call"));

    await searchBangumiAnime("hyouka");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedUndiciRequest).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("posts a valid search body and Bangumi headers", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";

    await searchBangumiAnime("hyouka");

    const options = httpsRequestOptions[0]!;
    const headers = options.headers as Record<string, string>;
    const body = JSON.parse(httpsRequests[0]!.writes[0]!) as {
      keyword: string;
      filter: { type: number[]; nsfw?: boolean };
    };

    expect(options.hostname).toBe("api.bgm.tv");
    expect(options.path).toContain("/search/subjects?limit=20");
    expect(options.method).toBe("POST");
    expect(headers["User-Agent"]).toContain("AniMatch");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer test-token");
    expect(body.keyword).toBe("hyouka");
    expect(body.filter.type).toEqual([2]);
    expect(body.filter).not.toHaveProperty("nsfw");
  });

  it("keeps Authorization absent when the Bangumi token is not configured", async () => {
    await searchBangumiAnime("hyouka");

    const headers = httpsRequestOptions[0]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("uses direct https when HTTP_PROXY and HTTPS_PROXY are absent", async () => {
    await searchBangumiAnime("冰菓");

    expect(getBangumiProxyUrl()).toBeNull();
    expect(mockedHttpRequest).not.toHaveBeenCalled();
    expect(mockedHttpsRequest).toHaveBeenCalledTimes(1);
    expect(httpsRequestOptions[0]).not.toHaveProperty("createConnection");
  });

  it("uses HTTP CONNECT when HTTPS_PROXY is configured", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";

    await searchBangumiAnime("冰菓");

    expect(getBangumiProxyUrl()).toBe("http://127.0.0.1:7890/");
    expect(httpRequestOptions[0]).toMatchObject({
      hostname: "127.0.0.1",
      port: 7890,
      method: "CONNECT",
      path: "api.bgm.tv:443"
    });
    expect(httpsRequestOptions[0]).toHaveProperty("createConnection");
    expect(mockedTlsConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        servername: "api.bgm.tv"
      })
    );
  });

  it("prefers HTTPS_PROXY over HTTP_PROXY", async () => {
    process.env.HTTP_PROXY = "http://127.0.0.1:7891";
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";

    await searchBangumiAnime("hyouka");

    expect(getBangumiProxyUrl()).toBe("http://127.0.0.1:7890/");
    expect(httpRequestOptions[0]).toMatchObject({
      hostname: "127.0.0.1",
      port: 7890
    });
  });

  it("includes upstream status and body summary without leaking proxy URLs or tokens", async () => {
    process.env.HTTPS_PROXY = "http://user:secret-proxy@127.0.0.1:7890";
    process.env.BANGUMI_ACCESS_TOKEN = "token-secret";
    nextHttpsStatus = 400;
    nextHttpsBody = JSON.stringify({
      error: "bad request",
      authorization: "Bearer token-secret",
      proxy: "http://user:secret-proxy@127.0.0.1:7890"
    });

    let error: unknown;
    try {
      await searchBangumiAnime("冰菓");
    } catch (reason) {
      error = reason;
    }

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("Bangumi search failed: HTTP 400");
    expect(message).toContain("bad request");
    expect(message).not.toContain("secret-proxy");
    expect(message).not.toContain("token-secret");
    expect(message).not.toContain("Bearer token-secret");
  });

  it("fails with a readable network error when node https throws ECONNREFUSED", async () => {
    nextHttpsError = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:443"), {
      code: "ECONNREFUSED"
    });

    let error: unknown;
    try {
      await searchBangumiAnime("hyouka");
    } catch (reason) {
      error = reason;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Unable to connect to Bangumi API");
    expect((error as Error).message).toContain("ECONNREFUSED");
  });
});

describe("Bangumi diagnostic sanitize", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearProxyEnv();
    clearBangumiTokenEnv();
    httpRequestOptions.length = 0;
    httpsRequestOptions.length = 0;
    httpRequests.length = 0;
    httpsRequests.length = 0;
    nextHttpsStatus = 200;
    nextHttpsError = null;
    nextConnectStatus = 200;
    nextHttpsBody = JSON.stringify({
      data: [{ id: 1, name: "Test" }]
    });
    installRequestMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restoreProxyEnv();
    restoreBangumiTokenEnv();
    consoleErrorSpy.mockRestore();
  });

  it("hides token from diagnostic logs", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "secret-token-abc";
    process.env.BANGUMI_DEBUG = "1";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).not.toContain("secret-token-abc");
    expect(joined).not.toContain("Bearer secret-token-abc");
  });

  it("hides proxy URL from diagnostic logs", async () => {
    process.env.HTTPS_PROXY = "http://secret:pass@127.0.0.1:7890";
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    process.env.BANGUMI_DEBUG = "1";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).not.toContain("secret:pass");
    expect(joined).not.toContain("127.0.0.1:7890");
  });

  it("preserves safe status/code/message fields in diagnostic logs", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    process.env.BANGUMI_DEBUG = "1";
    nextHttpsStatus = 400;
    nextHttpsBody = JSON.stringify({ error: "bad request" });

    try {
      await searchBangumiAnime("hyouka");
    } catch {
      // expected
    }

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("400");
    expect(joined).toContain("bad request");
  });

  it("does not log diagnostic when BANGUMI_DEBUG is not set", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    delete process.env.BANGUMI_DEBUG;

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).not.toContain("[Bangumi diagnostic]");
  });

  it("logs diagnostic when BANGUMI_DEBUG is set to 1", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    process.env.BANGUMI_DEBUG = "1";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("[Bangumi diagnostic]");
    expect(joined).toContain("request-start");
  });

  it("logs error diagnostic with name code and cause", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    process.env.BANGUMI_DEBUG = "1";
    nextHttpsError = Object.assign(
      new Error("test error"),
      { code: "ETIMEDOUT" }
    );

    try {
      await searchBangumiAnime("hyouka");
    } catch {
      // expected
    }

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("[Bangumi diagnostic]");
    expect(joined).toContain("request-error");
    expect(joined).toContain("Error");
    expect(joined).toContain("test error");
  });

  it("records requestPath as missing-token when token is absent", async () => {
    process.env.BANGUMI_DEBUG = "1";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("missing-token");
  });

  it("records requestPath as node-https-direct when token present and no proxy", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    process.env.BANGUMI_DEBUG = "1";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("node-https-direct");
  });

  it("records requestPath as node-http-connect-proxy when token and proxy present", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    process.env.BANGUMI_DEBUG = "1";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("node-http-connect-proxy");
  });
});

describe("Bangumi debug endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProxyEnv();
    clearBangumiTokenEnv();
  });

  afterEach(() => {
    restoreProxyEnv();
    restoreBangumiTokenEnv();
  });

  it("returns 401 when not logged in", async () => {
    vi.mocked(requireCurrentUser).mockRejectedValueOnce(
      new AppError("Authentication required", 401, "AUTH_REQUIRED")
    );

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("returns hasBangumiAccessToken true when token is set", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
    vi.mocked(requireCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hasBangumiAccessToken).toBe(true);
    expect(body.data.effectiveProxy.hasValidProxy).toBe(false);
    expect(body.data.rawEnv.HTTPS_PROXY).toBe("<missing>");
    expect(body.data.rawEnv.HTTP_PROXY).toBe("<missing>");
  });

  it("returns hasBangumiAccessToken false when token is missing", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hasBangumiAccessToken).toBe(false);
  });

  it("does not include real token in response", async () => {
    process.env.BANGUMI_ACCESS_TOKEN = "secret-real-token";
    vi.mocked(requireCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain("secret-real-token");
    expect(body.data.hasBangumiAccessToken).toBe(true);
  });

  it("does not include real proxy URL in response", async () => {
    process.env.HTTPS_PROXY = "http://secret-proxy:7890";
    vi.mocked(requireCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain("secret-proxy");
    expect(bodyStr).not.toContain("7890");
  });

  it("returns rawEnv with <set>/<missing> and effectiveProxy with correct fields", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";
    process.env.HTTP_PROXY = "http://127.0.0.1:7891";
    vi.mocked(requireCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();

    expect(body.data.rawEnv.HTTPS_PROXY).toBe("<set>");
    expect(body.data.rawEnv.HTTP_PROXY).toBe("<set>");
    expect(body.data.effectiveProxy.hasValidProxy).toBe(true);
    expect(body.data.effectiveProxy.sourceEnvKey).toBe("HTTPS_PROXY");
    expect(body.data.effectiveProxy.hostPresent).toBe(true);
    expect(body.data.effectiveProxy.portPresent).toBe(true);
    expect(body.data.effectiveProxy.invalidReason).toBeNull();
  });

  it("returns nodeVersion runtime and platform", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();

    expect(body.data.runtime).toBe("nodejs");
    expect(body.data.platform).toBe(process.platform);
    expect(typeof body.data.nodeVersion).toBe("string");
  });

  it("shows effectiveProxy.invalidReason when proxy env is invalid", async () => {
    process.env.HTTPS_PROXY = "not-a-valid-url";
    vi.mocked(requireCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await BANGUMI_DEBUG_GET();
    const body = await response.json();

    expect(body.data.rawEnv.HTTPS_PROXY).toBe("<set>");
    expect(body.data.effectiveProxy.hasValidProxy).toBe(false);
    expect(body.data.effectiveProxy.invalidReason).toBe("no-valid-proxy-env");
  });
});

describe("Bangumi search route error logging", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("logs safe error shape without leaking token", async () => {
    const { GET: SEARCH_ROUTE } = await import("../src/app/api/anime/bangumi/search/route");
    const bangumiModule = await import("../src/lib/bangumi");
    const authModule = await import("../src/lib/auth-session");

    vi.spyOn(bangumiModule, "searchBangumiAnime").mockRejectedValue(
      Object.assign(
        new Error("Bangumi search failed: HTTP 500; body={\"auth\":\"Bearer secret-token\"}"),
        { code: "ERR_BAD_RESPONSE", cause: new Error("upstream error") }
      )
    );
    vi.spyOn(authModule, "requireCurrentUser").mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const req = new Request("http://localhost/api/anime/bangumi/search?q=冰菓");
    const response = await SEARCH_ROUTE(req);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logStr = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(logStr).not.toContain("secret-token");
    expect(body.error.message).toContain("暂时不可用");
    expect(body.error.message).not.toContain("secret-token");
  });

  it("preserves statusCode in route error log when available", async () => {
    const { GET: SEARCH_ROUTE } = await import("../src/app/api/anime/bangumi/search/route");
    const bangumiModule = await import("../src/lib/bangumi");
    const authModule = await import("../src/lib/auth-session");

    vi.spyOn(bangumiModule, "searchBangumiAnime").mockRejectedValue(
      Object.assign(
        new Error("Bangumi search failed: HTTP 429; body=rate limit"),
        { code: "ERR_BAD_RESPONSE" }
      )
    );
    vi.spyOn(authModule, "requireCurrentUser").mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const req = new Request("http://localhost/api/anime/bangumi/search?q=冰菓");
    const response = await SEARCH_ROUTE(req);

    expect(response.status).toBe(502);
  });
});

describe("normalizeProxyEnvValue", () => {
  beforeEach(() => {
    clearProxyEnv();
    clearBangumiTokenEnv();
  });

  afterEach(() => {
    restoreProxyEnv();
    restoreBangumiTokenEnv();
  });

  function getNormalized(raw: string | undefined | null): string | null {
    const result = normalizeProxyEnvValue(raw);
    return result.normalizedUrl ?? null;
  }

  function getInvalidReason(raw: string | undefined | null): string | null {
    const result = normalizeProxyEnvValue(raw);
    return result.invalidReason ?? null;
  }

  it('strips surrounding double quotes', () => {
    expect(getNormalized('"http://172.18.0.1:7890"')).toBe("http://172.18.0.1:7890/");
  });

  it('strips surrounding single quotes', () => {
    expect(getNormalized("'http://172.18.0.1:7890'")).toBe("http://172.18.0.1:7890/");
  });

  it('trims whitespace around value', () => {
    expect(getNormalized('  http://172.18.0.1:7890  ')).toBe("http://172.18.0.1:7890/");
  });

  it('handles null gracefully', () => {
    expect(getNormalized(null)).toBeNull();
    expect(getInvalidReason(null)).toBeNull();
  });

  it('handles undefined gracefully', () => {
    expect(getNormalized(undefined)).toBeNull();
    expect(getInvalidReason(undefined)).toBeNull();
  });

  it('returns nothing for empty string', () => {
    expect(getNormalized("")).toBeNull();
  });

  it('returns invalidReason for "undefined" literal', () => {
    expect(getInvalidReason("undefined")).toBe("empty-like-value");
  });

  it('returns invalidReason for "null" literal', () => {
    expect(getInvalidReason("null")).toBe("empty-like-value");
  });

  it('returns invalidReason for value missing protocol', () => {
    expect(getInvalidReason("172.18.0.1:7890")).toBe("invalid-proxy-url");
  });

  it('returns unsupported-proxy-protocol for socks5', () => {
    expect(getInvalidReason("socks5://127.0.0.1:7890")).toBe("unsupported-proxy-protocol");
  });

  it('returns invalid-proxy-url for malformed URL', () => {
    expect(getInvalidReason("not a valid url at all")).toBe("invalid-proxy-url");
  });

  it('returns normalizedUrl for valid http proxy', () => {
    const r = normalizeProxyEnvValue("http://127.0.0.1:7890");
    expect(r.normalizedUrl).toBe("http://127.0.0.1:7890/");
    expect(r.invalidReason).toBeUndefined();
  });

  it('strips user:password from normalizedUrl', () => {
    const r = normalizeProxyEnvValue("http://user:pass@127.0.0.1:7890");
    expect(r.normalizedUrl).toBe("http://127.0.0.1:7890/");
  });
});

describe("getBangumiProxyDiagnostic env priority and fallback", () => {
  beforeEach(() => {
    clearProxyEnv();
    clearBangumiTokenEnv();
  });

  afterEach(() => {
    restoreProxyEnv();
    restoreBangumiTokenEnv();
  });

  it("uses HTTPS_PROXY when valid", () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";

    const diagnostic = getBangumiProxyDiagnostic();

    expect(diagnostic.rawKey).toBe("HTTPS_PROXY");
    expect(diagnostic.normalizedUrl).toBe("http://127.0.0.1:7890/");
    expect(diagnostic.hostPresent).toBe(true);
    expect(diagnostic.portPresent).toBe(true);
  });

  it("uses next env when higher priority is invalid", () => {
    process.env.HTTPS_PROXY = "not-a-valid-url";
    process.env.HTTP_PROXY = "http://127.0.0.1:7891";

    const diagnostic = getBangumiProxyDiagnostic();

    expect(diagnostic.normalizedUrl).toContain(":7891");
    expect(diagnostic.hostPresent).toBe(true);
    expect(diagnostic.portPresent).toBe(true);
  });

  it("uses next lower priority env as fallback", () => {
    process.env.HTTPS_PROXY = "not-valid";
    process.env.HTTP_PROXY = "not-valid";
    process.env.https_proxy = "http://127.0.0.1:7892";

    const diagnostic = getBangumiProxyDiagnostic();

    expect(diagnostic.normalizedUrl).toContain(":7892");
  });

  it("uses last fallback env", () => {
    process.env.HTTPS_PROXY = "not-valid";
    process.env.HTTP_PROXY = "not-valid";
    process.env.https_proxy = "not-valid";
    process.env.http_proxy = "http://127.0.0.1:7893";

    const diagnostic = getBangumiProxyDiagnostic();

    expect(diagnostic.normalizedUrl).toContain(":7893");
  });

  it("returns no-valid-proxy-env when all env vars are invalid or missing", () => {
    process.env.HTTPS_PROXY = "not-valid";

    const diagnostic = getBangumiProxyDiagnostic();

    expect(diagnostic.normalizedUrl).toBeUndefined();
    expect(diagnostic.invalidReason).toBe("no-valid-proxy-env");
    expect(diagnostic.hostPresent).toBe(false);
    expect(diagnostic.portPresent).toBe(false);
  });

  it("returns empty diagnostic when no proxy env is set", () => {
    const diagnostic = getBangumiProxyDiagnostic();

    expect(diagnostic.normalizedUrl).toBeUndefined();
    expect(diagnostic.invalidReason).toBe("no-valid-proxy-env");
    expect(diagnostic.rawKey).toBeUndefined();
  });
});

describe("proxy-env-invalid diagnostic log", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearProxyEnv();
    clearBangumiTokenEnv();
    httpRequestOptions.length = 0;
    httpsRequestOptions.length = 0;
    httpRequests.length = 0;
    httpsRequests.length = 0;
    nextHttpsStatus = 200;
    nextHttpsError = null;
    nextConnectStatus = 200;
    nextHttpsBody = JSON.stringify({
      data: [{ id: 1, name: "Test" }]
    });
    installRequestMocks();
    process.env.BANGUMI_DEBUG = "1";
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restoreProxyEnv();
    restoreBangumiTokenEnv();
    consoleErrorSpy.mockRestore();
  });

  it("logs proxy-env-invalid without leaking raw proxy URL", async () => {
    process.env.HTTPS_PROXY = "http://secret:pass@127.0.0.1:7890";
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).not.toContain("secret");
    expect(joined).not.toContain("pass");
  });

  it("logs proxy-env-invalid with key and reason but not raw value", async () => {
    process.env.HTTPS_PROXY = "not-a-url";
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("proxy-env-invalid");
    expect(joined).toContain("invalid-proxy-url");
    expect(joined).not.toContain("not-a-url");
  });

  it("logs key, rawLength, startsWithHttp, and invalidReason only", async () => {
    process.env.HTTPS_PROXY = "socks5://127.0.0.1:7890";
    process.env.BANGUMI_ACCESS_TOKEN = "test-token";

    await searchBangumiAnime("hyouka");

    const joined = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(joined).toContain("HTTPS_PROXY");
    expect(joined).toContain("unsupported-proxy-protocol");
    expect(joined).not.toContain("socks5://");
  });
});
