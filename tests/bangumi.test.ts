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

import * as http from "node:http";
import * as https from "node:https";
import * as tls from "node:tls";
import { request as undiciRequest } from "undici";
import {
  getBangumiProxyUrl,
  normalizeBangumiSubject,
  parseBangumiSubjectIds,
  searchBangumiAnime
} from "../src/lib/bangumi";

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

    expect(getBangumiProxyUrl()).toBe("http://127.0.0.1:7890");
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

    expect(getBangumiProxyUrl()).toBe("http://127.0.0.1:7890");
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
