import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { getRunTierList, toTierListItem } from "../src/lib/tier-service";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/db", () => ({
  prisma: {
    userPoolScore: {
      findMany: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn()
    },
    poolComparison: {
      count: vi.fn()
    },
    customPool: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("../src/lib/run-service", () => ({
  assertRunAccess: vi.fn()
}));

const mockedPrisma = vi.mocked(prisma);

describe("tier-service mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps score with anime to public tier list item without rawJson", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const item = toTierListItem({
      id: "score-1",
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1",
      animeId: "anime-1",
      eloScore: 1510,
      uncertainty: 300,
      compareCount: 2,
      winCount: 1,
      lossCount: 0,
      drawCount: 1,
      unseenCount: 0,
      skipCount: 0,
      isHidden: false,
      manualTier: null,
      manualRank: null,
      manualLocked: false,
      lastComparedAt: now,
      createdAt: now,
      updatedAt: now,
      anime: {
        id: "anime-1",
        bgmId: 876,
        title: "Title",
        titleCn: "Chinese Title",
        titleJa: null,
        titleEn: null,
        summary: "hidden summary",
        imageUrl: "common.jpg",
        imageSmallUrl: "small.jpg",
        imageMediumUrl: "medium.jpg",
        imageLargeUrl: "large.jpg",
        thumbnailUrl: "thumb.jpg",
        airDate: now,
        bangumiRank: 10,
        bangumiScore: 8.5,
        bangumiVotes: 1000,
        tags: ["tag"],
        aliases: [],
        year: 2026,
        season: null,
        animeType: "TV",
        episodes: null,
        status: null,
        studios: [],
        externalLinks: [],
        source: "BANGUMI",
        sourceId: "876",
        rawJson: { private: true },
        fetchedAt: now,
        imageStatus: "OK",
        imageCheckedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
    });

    expect(item).toMatchObject({
      id: "anime-1",
      animeId: "anime-1",
      bgmId: 876,
      title: "Title",
      eloScore: 1510,
      compareCount: 2,
      winCount: 1
    });
    expect("rawJson" in item).toBe(false);
    expect("summary" in item).toBe(false);
  });

  it("excludes hidden unseen scores from tier, tier wall, and export data", async () => {
    (mockedPrisma.userPoolScore.findMany as unknown as Mock).mockResolvedValue([
      scoreFixture({ animeId: "anime-win", eloScore: 1600, compareCount: 1, winCount: 1 }),
      scoreFixture({
        animeId: "anime-unseen",
        title: "Unseen",
        eloScore: 1510,
        unseenCount: 2,
        isHidden: true
      }),
      scoreFixture({
        animeId: "anime-skip",
        title: "Skipped Once",
        eloScore: 1490,
        skipCount: 1
      }),
      scoreFixture({
        animeId: "anime-draw",
        title: "Drawn",
        eloScore: 1500,
        compareCount: 1,
        drawCount: 1
      })
    ]);
    (mockedPrisma.poolAnime.findMany as unknown as Mock).mockResolvedValue([
      poolAnimeFixture("anime-win"),
      poolAnimeFixture("anime-unseen"),
      poolAnimeFixture("anime-skip"),
      poolAnimeFixture("anime-draw")
    ]);
    (mockedPrisma.poolComparison.count as unknown as Mock)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    (mockedPrisma.customPool.findUnique as unknown as Mock).mockResolvedValue({
      tierConfig: null
    });

    const result = await getRunTierList({
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1"
    });
    const tierItems = Object.values(result.tiers).flat();
    const tierAnimeIds = tierItems.map((item) => item.animeId);

    expect(tierAnimeIds).not.toContain("anime-unseen");
    expect(tierAnimeIds).toContain("anime-skip");
    expect(tierAnimeIds).toContain("anime-draw");
    expect(result.scoreDistribution.count).toBe(3);
    expect(result.progress.totalItems).toBe(3);
    expect(result.totalAnime).toBe(4);
  });
});

function scoreFixture(overrides: Record<string, unknown> = {}) {
  const animeId = String(overrides.animeId ?? "anime-1");
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: `score-${animeId}`,
    userId: "user-1",
    poolId: "pool-1",
    runId: "run-1",
    animeId,
    eloScore: 1500,
    uncertainty: 300,
    compareCount: 0,
    winCount: 0,
    lossCount: 0,
    drawCount: 0,
    unseenCount: 0,
    skipCount: 0,
    isHidden: false,
    manualTier: null,
    manualRank: null,
    manualLocked: false,
    lastComparedAt: null,
    createdAt: now,
    updatedAt: now,
    anime: animeFixture({
      id: animeId,
      title: overrides.title ?? animeId
    }),
    ...overrides
  } as never;
}

function poolAnimeFixture(animeId: string) {
  return {
    id: `pool-anime-${animeId}`,
    poolId: "pool-1",
    animeId,
    order: 0,
    displayTitleOverride: null,
    coverUrlOverride: null,
    animeTypeOverride: null,
    tagsOverride: [],
    overrideNote: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    anime: animeFixture({ id: animeId, title: animeId })
  } as never;
}

function animeFixture(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");

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
    animeType: "TV",
    episodes: null,
    status: null,
    studios: [],
    externalLinks: [],
    source: "MANAMI",
    sourceId: null,
    rawJson: null,
    fetchedAt: now,
    imageStatus: "OK",
    imageCheckedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides
  };
}
