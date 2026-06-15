import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnimeSourceType,
  PersonalRunStatus,
  PoolStatus,
  Visibility
} from "@prisma/client";
import { getCommunityRanking } from "../src/lib/community-ranking-service";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn()
    },
    personalRun: {
      findMany: vi.fn()
    },
    userPoolScore: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

const mockedPool = vi.mocked(prisma.customPool);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);
const mockedRuns = vi.mocked(prisma.personalRun);
const mockedScores = vi.mocked(prisma.userPoolScore);

describe("community ranking service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPool.findUnique.mockResolvedValue(poolFixture() as any);
    mockedPoolAnime.findMany.mockResolvedValue([
      poolAnime("anime-a", "Alpha", 0),
      poolAnime("anime-b", "Beta", 1),
      poolAnime("anime-c", "Gamma", 2),
      poolAnime("anime-d", "Delta", 3)
    ] as any);
    mockedRuns.findMany.mockResolvedValue([
      run("run-a-new", "user-a", "2026-01-03T00:00:00.000Z"),
      run("run-b", "user-b", "2026-01-02T00:00:00.000Z"),
      run("run-c", "user-c", "2026-01-01T00:00:00.000Z"),
      run("run-a-stale-default", "user-a", "2026-01-01T00:00:00.000Z")
    ] as any);
    mockedScores.findMany.mockResolvedValue([
      score("user-a", "run-a-new", "anime-a", 1700, 5),
      score("user-b", "run-b", "anime-a", 1600, 4),
      score("user-c", "run-c", "anime-a", 1550, 3),
      score("user-a", "run-a-new", "anime-b", 1800, 20),
      score("user-b", "run-b", "anime-b", 1300, 20),
      score("user-c", "run-c", "anime-b", 1300, 20),
      score("user-a", "run-a-new", "anime-c", 1520, 5),
      score("user-b", "run-b", "anime-c", 1510, 2),
      score("user-c", "run-c", "anime-c", 1900, 0),
      score("user-d", "run-d", "anime-c", 2100, 6, { isHidden: true }),
      score("user-a", "run-a-stale-default", "anime-a", 2500, 50),
      score("user-a", "run-a-old", "anime-a", 2600, 50),
      score("user-a", "run-a-new", "anime-removed", 2500, 50)
    ] as any);
  });

  it("returns public pool community ranking from current default runs only", async () => {
    const result = await getCommunityRanking("pool-1");

    expect(result).toMatchObject({
      poolId: "pool-1",
      totalParticipants: 3,
      totalRuns: 3,
      totalAnime: 4,
      minSampleThreshold: {
        minUsers: 3,
        minComparisons: 6
      }
    });
    expect(mockedRuns.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          poolId: "pool-1",
          isDefault: true,
          status: PersonalRunStatus.ACTIVE,
          deletedAt: null
        })
      })
    );
    expect(mockedScores.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          poolId: "pool-1",
          runId: { in: ["run-a-new", "run-b", "run-c"] },
          animeId: { in: ["anime-a", "anime-b", "anime-c", "anime-d"] },
          compareCount: { gt: 0 },
          isHidden: false
        })
      })
    );
  });

  it("ranks sufficient sample items by Bayesian community score", async () => {
    const result = await getCommunityRanking("pool-1");
    const [first, second] = result.items;

    expect(first).toMatchObject({
      animeId: "anime-a",
      rank: 1,
      participantCount: 3,
      comparisonCount: 12,
      insufficientSample: false
    });
    expect(first.averageRating).toBeCloseTo((1700 + 1600 + 1550) / 3);
    expect(first.communityScore).toBeCloseTo((1500 * 3 + 1700 + 1600 * 0.8 + 1550 * 0.6) / 5.4);

    expect(second).toMatchObject({
      animeId: "anime-b",
      rank: 2,
      participantCount: 3,
      comparisonCount: 60,
      insufficientSample: false
    });
    expect(second.communityScore).toBeLessThan(first.communityScore ?? 0);
  });

  it("marks low sample and empty anime as insufficient without ranks", async () => {
    const result = await getCommunityRanking("pool-1");
    const animeC = result.items.find((item) => item.animeId === "anime-c");
    const animeD = result.items.find((item) => item.animeId === "anime-d");

    expect(animeC).toMatchObject({
      participantCount: 2,
      comparisonCount: 7,
      rank: null,
      insufficientSample: true
    });
    expect(animeC?.averageRating).toBeCloseTo((1520 + 1510) / 2);
    expect(animeD).toMatchObject({
      participantCount: 0,
      comparisonCount: 0,
      averageRating: null,
      communityScore: null,
      rank: null,
      insufficientSample: true
    });
  });

  it("excludes removed anime, hidden scores, zero-count scores, and old reset runs", async () => {
    const result = await getCommunityRanking("pool-1");
    const ids = result.items.map((item) => item.animeId);
    const animeA = result.items.find((item) => item.animeId === "anime-a");
    const animeC = result.items.find((item) => item.animeId === "anime-c");

    expect(ids).not.toContain("anime-removed");
    expect(animeA?.averageRating).not.toBeCloseTo((1700 + 1600 + 1550 + 2500 + 2600) / 5);
    expect(animeC?.participantCount).toBe(2);
    expect(animeC?.comparisonCount).toBe(7);
  });

  it("does not write UserPoolScore while aggregating", async () => {
    await getCommunityRanking("pool-1");

    expect(mockedScores.create).not.toHaveBeenCalled();
    expect(mockedScores.update).not.toHaveBeenCalled();
    expect(mockedScores.updateMany).not.toHaveBeenCalled();
    expect(mockedScores.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["private", Visibility.PRIVATE, PoolStatus.DRAFT, null],
    ["unlisted", Visibility.UNLISTED, PoolStatus.DRAFT, null],
    ["archived", Visibility.PUBLIC, PoolStatus.ARCHIVED, null],
    ["deleted", Visibility.PUBLIC, PoolStatus.DRAFT, new Date("2026-01-01T00:00:00.000Z")]
  ])("rejects %s pools", async (_label, visibility, status, deletedAt) => {
    mockedPool.findUnique.mockResolvedValueOnce(
      poolFixture({
        visibility,
        status,
        deletedAt
      }) as any
    );

    await expect(getCommunityRanking("pool-1")).rejects.toMatchObject({
      statusCode: 404,
      code: "COMMUNITY_RANKING_NOT_AVAILABLE"
    });
    expect(mockedPoolAnime.findMany).not.toHaveBeenCalled();
    expect(mockedRuns.findMany).not.toHaveBeenCalled();
    expect(mockedScores.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for missing pools", async () => {
    mockedPool.findUnique.mockResolvedValueOnce(null);

    await expect(getCommunityRanking("missing")).rejects.toMatchObject({
      statusCode: 404,
      code: "POOL_NOT_FOUND"
    });
  });
});

function poolFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    visibility: Visibility.PUBLIC,
    status: PoolStatus.DRAFT,
    deletedAt: null,
    ...overrides
  };
}

function run(id: string, userId: string, updatedAt: string) {
  return {
    id,
    userId,
    updatedAt: new Date(updatedAt)
  };
}

function poolAnime(animeId: string, title: string, position: number) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: `entry-${animeId}`,
    poolId: "pool-1",
    animeId,
    position,
    note: null,
    initialElo: 1500,
    displayTitleOverride: null,
    coverUrlOverride: null,
    animeTypeOverride: null,
    tagsOverride: [],
    overrideNote: null,
    overrideUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    anime: anime(animeId, title)
  };
}

function anime(id: string, title: string) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id,
    bgmId: null,
    title,
    titleCn: null,
    titleJa: null,
    titleEn: null,
    summary: null,
    imageUrl: `https://img.example.test/${id}.jpg`,
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
    year: 2026,
    season: null,
    animeType: "TV",
    episodes: null,
    status: null,
    studios: [],
    externalLinks: [],
    source: AnimeSourceType.MANAMI,
    sourceId: id,
    rawJson: null,
    fetchedAt: null,
    imageStatus: "UNKNOWN",
    imageCheckedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

function score(
  userId: string,
  runId: string,
  animeId: string,
  eloScore: number,
  compareCount: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    userId,
    runId,
    animeId,
    eloScore,
    compareCount,
    isHidden: false,
    ...overrides
  };
}
