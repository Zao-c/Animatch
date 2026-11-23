import {
  PoolComparisonMode,
  PoolComparisonResult,
  PoolStatus,
  Visibility
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getComparisonHistory,
  normalizeHistoryLimit
} from "../src/lib/comparison-history-service";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn()
    },
    personalRun: {
      findUnique: vi.fn()
    },
    poolComparison: {
      findMany: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn()
    }
  }
}));

const mockedCustomPoolFindUnique = vi.mocked(prisma.customPool.findUnique);
const mockedPersonalRunFindUnique = vi.mocked(prisma.personalRun.findUnique);
const mockedPoolComparisonFindMany = vi.mocked(prisma.poolComparison.findMany);
const mockedPoolAnimeFindMany = vi.mocked(prisma.poolAnime.findMany);

describe("comparison history service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCustomPoolFindUnique.mockResolvedValue(
      poolFixture({ status: PoolStatus.PUBLISHED }) as any
    );
    mockedPersonalRunFindUnique.mockResolvedValue(runFixture() as any);
    mockedPoolComparisonFindMany.mockResolvedValue([comparisonFixture()] as any);
    mockedPoolAnimeFindMany.mockResolvedValue([
      poolAnimeFixture({
        animeId: "left",
        displayTitleOverride: "Left Override",
        coverUrlOverride: "/uploads/custom-items/left.png",
        anime: animeFixture({
          id: "left",
          title: "Left Anime",
          thumbnailUrl: "/left-thumb.jpg"
        })
      }),
      poolAnimeFixture({
        animeId: "right",
        anime: animeFixture({
          id: "right",
          title: "Right Anime",
          thumbnailUrl: "/right-thumb.jpg"
        })
      })
    ] as any);
  });

  it("defaults limit to 20 and caps it at 100", () => {
    expect(normalizeHistoryLimit(undefined)).toBe(20);
    expect(normalizeHistoryLimit(Number.NaN)).toBe(20);
    expect(normalizeHistoryLimit(150)).toBe(100);
    expect(normalizeHistoryLimit(0)).toBe(1);
  });

  it("returns recent comparison history with title and cover data", async () => {
    const result = await getComparisonHistory({
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1",
      limit: 5
    });

    expect(mockedPoolComparisonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 5
      })
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "comparison-1",
      result: PoolComparisonResult.LEFT_WIN,
      mode: PoolComparisonMode.NORMAL,
      winnerAnimeId: "left",
      loserAnimeId: "right",
      isUndone: false,
      undoneAt: null,
      undoneByUserId: null,
      left: {
        animeId: "left",
        title: "Left Override",
        coverUrl: "/uploads/custom-items/left.png",
        eloBefore: 1500,
        eloAfter: 1530,
        position: 2
      },
      right: {
        animeId: "right",
        title: "Right Anime",
        coverUrl: "/right-thumb.jpg",
        eloBefore: 1600,
        eloAfter: 1570,
        position: 1
      }
    });
  });

  it("allows archived pool history reads", async () => {
    mockedCustomPoolFindUnique.mockResolvedValue(
      poolFixture({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-06-11T00:00:00.000Z")
      }) as any
    );

    await expect(
      getComparisonHistory({
        userId: "user-1",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).resolves.toMatchObject({ items: expect.any(Array) });
  });

  it("returns Pool not found when the pool is missing", async () => {
    mockedCustomPoolFindUnique.mockResolvedValue(null);

    await expect(
      getComparisonHistory({
        userId: "user-1",
        poolId: "missing",
        runId: "run-1"
      })
    ).rejects.toMatchObject({ message: "Pool not found" });
  });

  it("returns Run not found when the run is missing", async () => {
    mockedPersonalRunFindUnique.mockResolvedValue(null);

    await expect(
      getComparisonHistory({
        userId: "user-1",
        poolId: "pool-1",
        runId: "missing"
      })
    ).rejects.toMatchObject({ message: "Run not found" });
  });

  it("returns a friendly error when the run does not belong to the pool", async () => {
    mockedPersonalRunFindUnique.mockResolvedValue(
      runFixture({ poolId: "other-pool" }) as any
    );

    await expect(
      getComparisonHistory({
        userId: "user-1",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).rejects.toMatchObject({ message: "Run does not belong to pool" });
  });
});

function poolFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "user-1",
    name: "Pool",
    description: null,
    coverUrl: null,
    visibility: Visibility.PRIVATE,
    status: PoolStatus.PUBLISHED,
    tags: [],
    sourcePoolId: null,
    affectsGlobalTaste: true,
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

function runFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    userId: "user-1",
    poolId: "pool-1",
    name: "Run",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

function comparisonFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "comparison-1",
    userId: "user-1",
    poolId: "pool-1",
    runId: "run-1",
    leftAnimeId: "left",
    rightAnimeId: "right",
    winnerAnimeId: "left",
    loserAnimeId: "right",
    result: PoolComparisonResult.LEFT_WIN,
    mode: PoolComparisonMode.NORMAL,
    leftEloBefore: 1500,
    leftEloAfter: 1530,
    rightEloBefore: 1600,
    rightEloAfter: 1570,
    leftPosition: 2,
    rightPosition: 1,
    createdAt: new Date("2026-06-12T00:00:00.000Z"),
    undoneAt: null,
    undoneByUserId: null,
    leftAnime: animeFixture({ id: "left", title: "Left Anime" }),
    rightAnime: animeFixture({
      id: "right",
      title: "Right Anime",
      thumbnailUrl: "/right-thumb.jpg"
    }),
    ...overrides
  };
}

function poolAnimeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    poolId: "pool-1",
    animeId: "left",
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
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    anime: animeFixture(),
    ...overrides
  };
}

function animeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "anime-1",
    bgmId: null,
    title: "Anime",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    summary: null,
    imageUrl: null,
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    thumbnailUrl: null,
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    bangumiVotes: null,
    tags: [],
    aliases: [],
    year: null,
    season: null,
    animeType: null,
    episodes: null,
    status: null,
    studios: [],
    externalLinks: [],
    source: "MANUAL",
    sourceId: "manual/anime",
    rawJson: null,
    fetchedAt: null,
    imageStatus: "MISSING",
    imageCheckedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}
