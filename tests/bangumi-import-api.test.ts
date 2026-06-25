import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import {
  GET as SEARCH_BANGUMI,
  runtime as BANGUMI_SEARCH_RUNTIME
} from "../src/app/api/anime/bangumi/search/route";
import { resetBangumiSearchCircuitForTest } from "../src/lib/bangumi-search-circuit";
import { POST as IMPORT_TO_POOL } from "../src/app/api/pools/[poolId]/anime/bulk-import/route";
import { upsertAnimeFromBangumiSubject } from "../src/lib/anime-service";
import { ANIME_SOURCE } from "../src/lib/anime-source";
import { AppError } from "../src/lib/app-error";
import { prisma } from "../src/lib/db";
import { requireCurrentUser } from "../src/lib/auth-session";
import * as bangumi from "../src/lib/bangumi";
import type { NormalizedBangumiSubject } from "../src/lib/bangumi";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({
    id: "user-1",
    username: "user-1",
    name: "User 1",
    image: null
  }))
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn()
    },
    anime: {
      upsert: vi.fn()
    },
    poolAnime: {
      aggregate: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}));

vi.mock("../src/lib/bangumi", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/bangumi")>(
    "../src/lib/bangumi"
  );

  return {
    ...actual,
    getBangumiSubject: vi.fn(),
    searchBangumiAnime: vi.fn()
  };
});

const mockedRequireCurrentUser = vi.mocked(requireCurrentUser);
const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedAnime = vi.mocked(prisma.anime);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);
const mockedBangumi = vi.mocked(bangumi);

function subject(overrides: Partial<NormalizedBangumiSubject> = {}): NormalizedBangumiSubject {
  return {
    bgmId: 876,
    title: "Sousou no Frieren",
    titleCn: "Frieren CN",
    summary: "Journey after the end.",
    imageUrl: "https://img.example.test/frieren.jpg",
    imageSmallUrl: "https://img.example.test/frieren-small.jpg",
    imageMediumUrl: "https://img.example.test/frieren-medium.jpg",
    imageLargeUrl: "https://img.example.test/frieren-large.jpg",
    airDate: new Date("2023-09-29T00:00:00.000Z"),
    bangumiRank: 1,
    bangumiScore: 8.9,
    bangumiVotes: 12345,
    tags: ["fantasy", "adventure"],
    rawJson: { id: 876, name: "Sousou no Frieren" },
    ...overrides
  };
}

function pool(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "user-1",
    name: "Pool",
    description: null,
    coverUrl: null,
    visibility: Visibility.PRIVATE,
    status: PoolStatus.DRAFT,
    tags: [],
    sourcePoolId: null,
    affectsGlobalTaste: true,
    allowPublicEdit: false,
    allowCommunityMatch: false,
    isOfficialDemo: false,
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

function animeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "anime-876",
    bgmId: 876,
    title: "Sousou no Frieren",
    titleCn: "Frieren CN",
    titleJa: null,
    titleEn: null,
    summary: "Journey after the end.",
    imageUrl: "https://img.example.test/frieren.jpg",
    imageSmallUrl: "https://img.example.test/frieren-small.jpg",
    imageMediumUrl: "https://img.example.test/frieren-medium.jpg",
    imageLargeUrl: "https://img.example.test/frieren-large.jpg",
    thumbnailUrl: null,
    airDate: new Date("2023-09-29T00:00:00.000Z"),
    bangumiRank: 1,
    bangumiScore: 8.9,
    bangumiVotes: 12345,
    tags: ["fantasy", "adventure"],
    aliases: [],
    year: null,
    season: null,
    animeType: null,
    episodes: null,
    status: null,
    studios: [],
    externalLinks: ["https://bgm.tv/subject/876"],
    source: ANIME_SOURCE.BANGUMI,
    sourceId: "876",
    rawJson: { id: 876, name: "Sousou no Frieren" },
    fetchedAt: new Date("2026-01-01T00:00:00.000Z"),
    imageStatus: "OK",
    imageCheckedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

function poolAnime(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    poolId: "pool-1",
    animeId: "anime-876",
    position: 3,
    note: null,
    initialElo: 1500,
    displayTitleOverride: null,
    coverUrlOverride: null,
    animeTypeOverride: null,
    tagsOverride: [],
    overrideNote: null,
    overrideUpdatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    anime: animeRecord(),
    ...overrides
  };
}

describe("Bangumi anime upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBangumiSearchCircuitForTest();
    mockedAnime.upsert.mockResolvedValue(animeRecord() as any);
  });

  it("sets BANGUMI source metadata and does not mark the anime as MANAMI", async () => {
    await upsertAnimeFromBangumiSubject(subject());

    expect(mockedAnime.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bgmId: 876 },
        create: expect.objectContaining({
          source: ANIME_SOURCE.BANGUMI,
          sourceId: "876",
          externalLinks: ["https://bgm.tv/subject/876"]
        }),
        update: expect.objectContaining({
          source: ANIME_SOURCE.BANGUMI,
          sourceId: "876",
          externalLinks: ["https://bgm.tv/subject/876"]
        })
      })
    );
    expect(mockedAnime.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: ANIME_SOURCE.MANAMI })
      })
    );
  });
});

describe("Bangumi search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBangumiSearchCircuitForTest();
    mockedRequireCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });
    mockedBangumi.searchBangumiAnime.mockResolvedValue([subject()]);
  });

  it("runs in the Node.js runtime", () => {
    expect(BANGUMI_SEARCH_RUNTIME).toBe("nodejs");
  });

  it("returns 401 when the user is not logged in", async () => {
    mockedRequireCurrentUser.mockRejectedValueOnce(
      new AppError("Authentication required", 401, "AUTH_REQUIRED")
    );

    const response = await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=frieren")
    );

    expect(response.status).toBe(401);
  });

  it("returns a clear 400 for an empty query", async () => {
    const response = await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=")
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("q is required");
    expect(mockedBangumi.searchBangumiAnime).not.toHaveBeenCalled();
  });

  it("returns a clear 400 for a too-short query", async () => {
    const response = await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=a")
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("q must be at least 2 characters");
    expect(mockedBangumi.searchBangumiAnime).not.toHaveBeenCalled();
  });

  it("returns normalized Bangumi search results", async () => {
    const response = await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=frieren")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedBangumi.searchBangumiAnime).toHaveBeenCalledWith("frieren", {
      limit: 20
    });
    expect(payload.data.items[0]).toMatchObject({
      bangumiId: 876,
      sourceId: "876",
      title: "Sousou no Frieren",
      titleCn: "Frieren CN",
      imageUrl: "https://img.example.test/frieren.jpg",
      sourceUrl: "https://bgm.tv/subject/876",
      year: 2023
    });
  });

  it("supports Chinese Bangumi search queries", async () => {
    await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=%E5%86%B0%E8%8F%93")
    );

    expect(mockedBangumi.searchBangumiAnime).toHaveBeenCalledWith("冰菓", {
      limit: 20
    });
  });

  it("supports English Bangumi search queries", async () => {
    await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=hyouka")
    );

    expect(mockedBangumi.searchBangumiAnime).toHaveBeenCalledWith("hyouka", {
      limit: 20
    });
  });

  it("returns a readable error without leaking token-like internals", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedBangumi.searchBangumiAnime.mockRejectedValueOnce(
      new Error("Bangumi search failed: HTTP 400; body={\"error\":\"bad request\"}")
    );

    const response = await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=frieren")
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error.message).toBe("Bangumi 搜索暂时不可用，请稍后重试。");
    expect(payload.error.message).not.toContain("secret-token");
    expect(payload.error.message).not.toContain("proxy-secret");
    expect(payload.error.message).not.toContain("Bearer");
    expect(JSON.stringify(consoleError.mock.calls)).toContain("HTTP 400");
    expect(JSON.stringify(consoleError.mock.calls)).toContain("bad request");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret-token");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("proxy-secret");
    consoleError.mockRestore();
  });

  it("returns 502 for Bangumi upstream 500 responses", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedBangumi.searchBangumiAnime.mockRejectedValueOnce(
      new Error("Bangumi search failed: HTTP 500; body={\"error\":\"upstream\"}")
    );

    const response = await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=hyouka")
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error.message).toBe("Bangumi 搜索暂时不可用，请稍后重试。");
    expect(JSON.stringify(consoleError.mock.calls)).toContain("HTTP 500");
    consoleError.mockRestore();
  });

  it("opens a short circuit after repeated Bangumi upstream failures before auth hits Prisma", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedBangumi.searchBangumiAnime.mockRejectedValue(
      Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" })
    );

    for (let i = 0; i < 3; i += 1) {
      const response = await SEARCH_BANGUMI(
        new Request(`http://test.local/api/anime/bangumi/search?q=frieren-${i}`)
      );
      expect(response.status).toBe(502);
    }

    mockedRequireCurrentUser.mockClear();
    mockedBangumi.searchBangumiAnime.mockClear();

    const response = await SEARCH_BANGUMI(
      new Request("http://test.local/api/anime/bangumi/search?q=frieren-open")
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(payload.error.message).toBe("Bangumi 搜索暂时不可用，请稍后重试。");
    expect(mockedRequireCurrentUser).not.toHaveBeenCalled();
    expect(mockedBangumi.searchBangumiAnime).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("Bangumi pool import API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValue(pool() as any);
    mockedBangumi.getBangumiSubject.mockResolvedValue(subject());
    mockedAnime.upsert.mockResolvedValue(animeRecord() as any);
    mockedPoolAnime.aggregate.mockResolvedValue({ _max: { position: 2 } } as any);
    mockedPoolAnime.findUnique.mockResolvedValue(null);
    mockedPoolAnime.create.mockResolvedValue(poolAnime() as any);
  });

  it("allows the owner to add a Bangumi result to their pool", async () => {
    const response = await IMPORT_TO_POOL(
      new Request("http://test.local/api/pools/pool-1/anime/bulk-import", {
        method: "POST",
        body: JSON.stringify({ input: "876" })
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.added).toHaveLength(1);
    expect(mockedPoolAnime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poolId: "pool-1",
          animeId: "anime-876",
          position: 3
        })
      })
    );
    expect(payload.data.added[0].anime.source).toBe(ANIME_SOURCE.BANGUMI);
  });

  it("rejects userB importing into userA's pool", async () => {
    mockedRequireCurrentUser.mockResolvedValueOnce({
      id: "user-2",
      username: "user-2",
      name: "User 2",
      image: null
    });

    const response = await IMPORT_TO_POOL(
      new Request("http://test.local/api/pools/pool-1/anime/bulk-import", {
        method: "POST",
        body: JSON.stringify({ input: "876" })
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(403);
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });

  it("rejects archived pools", async () => {
    mockedCustomPool.findUnique.mockResolvedValueOnce(
      pool({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z")
      }) as any
    );

    const response = await IMPORT_TO_POOL(
      new Request("http://test.local/api/pools/pool-1/anime/bulk-import", {
        method: "POST",
        body: JSON.stringify({ input: "876" })
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(409);
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });

  it("reuses existing Anime and skips duplicate PoolAnime rows", async () => {
    mockedPoolAnime.findUnique.mockResolvedValueOnce(poolAnime() as any);

    const response = await IMPORT_TO_POOL(
      new Request("http://test.local/api/pools/pool-1/anime/bulk-import", {
        method: "POST",
        body: JSON.stringify({ input: "876" })
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.added).toEqual([]);
    expect(payload.data.skipped[0]).toMatchObject({
      id: "anime-876",
      source: ANIME_SOURCE.BANGUMI
    });
    expect(mockedAnime.upsert).toHaveBeenCalledTimes(1);
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });
});
