import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBangumiProxyDispatcher,
  getBangumiProxyUrl,
  normalizeBangumiSubject,
  parseBangumiSubjectIds,
  searchBangumiAnime
} from "../src/lib/bangumi";

const originalProxyEnv = {
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  HTTP_PROXY: process.env.HTTP_PROXY,
  https_proxy: process.env.https_proxy,
  http_proxy: process.env.http_proxy
};

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

describe("Bangumi fetch proxy support", () => {
  beforeEach(() => {
    clearProxyEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: 258,
              name: "Hyouka",
              name_cn: "冰菓",
              images: {
                common: "https://img.example/hyouka.jpg"
              },
              tags: [{ name: "mystery" }]
            }
          ]
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreProxyEnv();
  });

  it("does not pass a dispatcher when HTTP_PROXY and HTTPS_PROXY are absent", async () => {
    await searchBangumiAnime("冰菓");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(getBangumiProxyUrl()).toBeNull();
    expect(getBangumiProxyDispatcher()).toBeUndefined();
    expect(init).not.toHaveProperty("dispatcher");
  });

  it("passes a dispatcher when HTTPS_PROXY is configured", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";

    await searchBangumiAnime("冰菓");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(getBangumiProxyUrl()).toBe("http://127.0.0.1:7890");
    expect(init).toHaveProperty("dispatcher");
  });

  it("prefers HTTPS_PROXY over HTTP_PROXY", async () => {
    process.env.HTTP_PROXY = "http://127.0.0.1:7891";
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";

    await searchBangumiAnime("hyouka");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(getBangumiProxyUrl()).toBe("http://127.0.0.1:7890");
    expect(init).toHaveProperty("dispatcher");
  });

  it("does not leak proxy URLs or tokens in Bangumi status errors", async () => {
    process.env.HTTPS_PROXY = "http://user:secret-proxy@127.0.0.1:7890";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: "token-secret"
          },
          { status: 502 }
        )
      )
    );

    await expect(searchBangumiAnime("冰菓")).rejects.toThrow(
      "Bangumi search failed with status 502"
    );
    await expect(searchBangumiAnime("冰菓")).rejects.not.toThrow("secret-proxy");
    await expect(searchBangumiAnime("冰菓")).rejects.not.toThrow("token-secret");
  });
});
