import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { PATCH } from "../src/app/api/pools/[poolId]/anime/[animeId]/route";
import { DELETE as DELETE_OVERRIDES } from "../src/app/api/pools/[poolId]/anime/[animeId]/overrides/route";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/dev-user", () => ({
  getOrCreateDevUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn(),
    },
    poolAnime: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);

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
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function anime(overrides: Record<string, unknown> = {}) {
  return {
    id: "anime-1",
    bgmId: null,
    title: "Original Title",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    summary: null,
    imageUrl: "https://example.com/original.jpg",
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    thumbnailUrl: null,
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    bangumiVotes: null,
    tags: ["action"],
    aliases: [],
    year: null,
    season: null,
    animeType: "TV",
    episodes: null,
    status: null,
    studios: [],
    externalLinks: [],
    source: "MANAMI",
    sourceId: "anime-1",
    rawJson: null,
    fetchedAt: null,
    imageStatus: "UNKNOWN",
    imageCheckedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function poolAnime(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    poolId: "pool-1",
    animeId: "anime-1",
    position: 1,
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
    anime: anime(),
    ...overrides,
  };
}

describe("pool anime display override API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH sets displayTitleOverride", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    mockedPoolAnime.update.mockResolvedValue(
      poolAnime({
        displayTitleOverride: "手动标题",
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ displayTitleOverride: "手动标题" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.display.title).toBe("手动标题");
    expect(mockedPoolAnime.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayTitleOverride: "手动标题",
          overrideUpdatedAt: expect.any(Date),
        }),
      })
    );
  });

  it("PATCH sets coverUrlOverride", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    mockedPoolAnime.update.mockResolvedValue(
      poolAnime({
        coverUrlOverride: "https://example.com/cover.jpg",
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ coverUrlOverride: "https://example.com/cover.jpg" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.display.coverUrl).toBe("https://example.com/cover.jpg");
  });

  it("PATCH rejects non-http cover URL", async () => {
    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ coverUrlOverride: "ftp://example.com/cover.jpg" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("PATCH returns 404 when anime is not in the pool", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/missing", {
        method: "PATCH",
        body: JSON.stringify({ displayTitleOverride: "Missing" }),
      }),
      { params: { poolId: "pool-1", animeId: "missing" } }
    );

    expect(response.status).toBe(404);
  });

  it("PATCH rejects archived pools", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ displayTitleOverride: "Archived" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("DELETE overrides restores original display", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(
      poolAnime({
        displayTitleOverride: "手动标题",
        tagsOverride: ["动作"],
      })
    );
    mockedPoolAnime.update.mockResolvedValue(poolAnime());

    const response = await DELETE_OVERRIDES(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/overrides", {
        method: "DELETE",
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.display.title).toBe("Original Title");
    expect(mockedPoolAnime.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayTitleOverride: null,
          coverUrlOverride: null,
          animeTypeOverride: null,
          tagsOverride: [],
          overrideNote: null,
          overrideUpdatedAt: null,
        }),
      })
    );
  });

  it("archiving a pool does not delete existing override data", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
    );

    const response = await DELETE_OVERRIDES(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/overrides", {
        method: "DELETE",
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });
});
