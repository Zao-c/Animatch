import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMatchQueue } from "../src/lib/match-service";
import { getRecalibrationSuggestions } from "../src/lib/recalibration-service";
import { getRunTierList } from "../src/lib/tier-service";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/run-service", () => ({
  assertRunAccess: vi.fn(),
  initializeScoresForRun: vi.fn()
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    userPoolScore: {
      findMany: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn(),
      delete: vi.fn()
    },
    poolComparison: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    customPool: {
      findUnique: vi.fn()
    }
  }
}));

const mockedScores = vi.mocked(prisma.userPoolScore);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);
const mockedComparisons = vi.mocked(prisma.poolComparison);
const mockedCustomPool = vi.mocked(prisma.customPool);

describe("removed anime active pool filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCustomPool.findUnique.mockResolvedValue({ tierConfig: null } as any);
  });

  it("excludes removed anime from the tier list even when it has a manual tier", async () => {
    mockScores();
    mockActivePoolAnime(["anime-a", "anime-c"]);
    mockedComparisons.count.mockResolvedValue(1);

    const tierList = await getRunTierList(baseParams());
    const ids = Object.values(tierList.tiers)
      .flat()
      .map((item) => item.animeId);

    expect(ids).toEqual(expect.arrayContaining(["anime-a", "anime-c"]));
    expect(ids).not.toContain("anime-b");
    expect(tierList.totalAnime).toBe(2);
    expect(tierList.comparedAnime).toBe(2);
    expect(mockedPoolAnime.delete).not.toHaveBeenCalled();
  });

  it("excludes removed anime from match queue candidates", async () => {
    mockScores();
    mockActivePoolAnime(["anime-a", "anime-c"]);
    mockedComparisons.findMany.mockResolvedValue([]);

    const queue = await getMatchQueue({ ...baseParams(), limit: 4 });
    const pairIds = queue.pairs.flatMap((pair) => [pair.left.id, pair.right.id]);

    expect(queue.pairs).toHaveLength(1);
    expect(pairIds).toEqual(expect.arrayContaining(["anime-a", "anime-c"]));
    expect(pairIds).not.toContain("anime-b");
    expect(queue.progress.totalItems).toBe(2);
  });

  it("returns an empty match queue when only one active anime remains", async () => {
    mockScores();
    mockActivePoolAnime(["anime-a"]);

    const queue = await getMatchQueue({ ...baseParams(), limit: 4 });

    expect(queue.pairs).toEqual([]);
    expect(queue.progress.totalItems).toBe(1);
    expect(queue.scoreDistribution.count).toBe(1);
  });

  it("excludes removed anime from recalibration suggestions", async () => {
    mockScores();
    mockActivePoolAnime(["anime-a", "anime-c"]);
    mockedComparisons.count.mockResolvedValue(1);
    mockedComparisons.findMany.mockResolvedValue([]);

    const suggestions = await getRecalibrationSuggestions({
      ...baseParams(),
      limit: 10
    });
    const pairIds = suggestions.pairs.flatMap((pair) => [
      pair.leftAnimeId,
      pair.rightAnimeId
    ]);

    expect(pairIds).toEqual(expect.arrayContaining(["anime-a", "anime-c"]));
    expect(pairIds).not.toContain("anime-b");
  });

  it("keeps historical comparisons available instead of deleting them", async () => {
    mockScores();
    mockActivePoolAnime(["anime-a", "anime-c"]);
    mockedComparisons.count.mockResolvedValue(3);

    await getRunTierList(baseParams());

    expect(mockedComparisons.count).toHaveBeenCalled();
    expect(mockedComparisons).not.toHaveProperty("delete");
    expect(mockedComparisons).not.toHaveProperty("deleteMany");
  });
});

function baseParams() {
  return {
    userId: "user-1",
    poolId: "pool-1",
    runId: "run-1"
  };
}

function mockScores() {
  mockedScores.findMany.mockResolvedValue([
    score("anime-a", 1540, 4),
    score("anime-b", 1800, 9, { manualTier: "S", manualRank: 0, manualLocked: true }),
    score("anime-c", 1490, 2)
  ] as any);
}

function mockActivePoolAnime(activeAnimeIds: string[]) {
  mockedPoolAnime.findMany.mockResolvedValue(
    activeAnimeIds.map((animeId, index) => ({
      id: `entry-${animeId}`,
      poolId: "pool-1",
      animeId,
      position: index,
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
      anime: anime(animeId)
    })) as any
  );
}

function score(
  animeId: string,
  eloScore: number,
  compareCount: number,
  overrides: Record<string, unknown> = {}
) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: `score-${animeId}`,
    userId: "user-1",
    poolId: "pool-1",
    runId: "run-1",
    animeId,
    eloScore,
    uncertainty: 280,
    compareCount,
    winCount: 0,
    lossCount: 0,
    drawCount: 0,
    unseenCount: 0,
    skipCount: 0,
    isHidden: false,
    manualTier: null,
    manualRank: null,
    manualLocked: false,
    lastComparedAt: now,
    createdAt: now,
    updatedAt: now,
    anime: anime(animeId),
    ...overrides
  };
}

function anime(id: string) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id,
    bgmId: null,
    title: id,
    titleCn: id.toUpperCase(),
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
    year: 2026,
    season: null,
    animeType: "TV",
    episodes: null,
    status: null,
    studios: [],
    externalLinks: [],
    source: "MANAMI",
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
