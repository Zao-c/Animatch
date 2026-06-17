import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTierShareSnapshot,
  createTierShare,
  generateTierShareToken,
  sanitizeTierShareDescription,
  sanitizeTierShareLabels
} from "../src/lib/tier-share-service";
import { prisma } from "../src/lib/db";
import { getRunTierList, type RunTierListResult } from "../src/lib/tier-service";

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn()
    },
    personalRun: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    tierShare: {
      create: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock("../src/lib/tier-service", () => ({
  getRunTierList: vi.fn()
}));

const mockedPool = vi.mocked(prisma.customPool);
const mockedRun = vi.mocked(prisma.personalRun);
const mockedUser = vi.mocked(prisma.user);
const mockedTierShare = vi.mocked(prisma.tierShare);
const mockedGetRunTierList = vi.mocked(getRunTierList);

describe("tier share service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates non-enumerable share tokens", () => {
    const token = generateTierShareToken();

    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("sanitizes tier labels and description", () => {
    expect(
      sanitizeTierShareLabels({
        S: "  神作  ",
        A: "",
        B: "abcdefghijklmnopqrstuvwxyz",
        C: "一般",
        D: "暂不推荐"
      })
    ).toEqual({
      S: "神作",
      A: "A",
      B: "abcdefghijklmnop",
      C: "一般",
      D: "暂不推荐"
    });

    expect(sanitizeTierShareDescription("  hello \n world  ")).toBe("hello world");
  });

  it("builds a fixed snapshot with custom upload cover urls", () => {
    const snapshot = buildTierShareSnapshot({
      poolId: "pool-1",
      poolName: "Pool",
      runId: "run-1",
      generatedAt: new Date("2026-06-11T12:00:00.000Z"),
      tierLabels: {
        s: "神作",
        a: "A",
        b: "B",
        c: "C",
        d: "D"
      },
      tierList: tierListFixture()
    });

    expect(snapshot).toMatchObject({
      version: 1,
      generatedAt: "2026-06-11T12:00:00.000Z",
      pool: { id: "pool-1", name: "Pool" },
      run: { id: "run-1" }
    });
    expect(snapshot.tiers[0]).toMatchObject({
      key: "s",
      label: "神作",
      items: [
        expect.objectContaining({
          animeId: "anime-1",
          title: "Custom Upload",
          coverUrl: "/uploads/custom-items/item.png",
          imageUrl: "/uploads/custom-items/item.png",
          imageSmallUrl: null,
          imageMediumUrl: null,
          imageLargeUrl: null,
          thumbnailUrl: null,
          source: "CUSTOM_UPLOAD",
          animeType: "IMAGE",
          tags: ["验收", "自定义"],
          isLocked: true,
          isEdited: true
        })
      ]
    });
  });

  it("keeps share snapshot image variants for export card parity", () => {
    const tierList = tierListFixture();
    tierList.tiers.s[0] = {
      ...tierList.tiers.s[0],
      source: "TIERMAKER_IMPORT",
      title: "zzzzz 17750273769085f154 f2a3b4c5d6e7f8",
      imageUrl: "https://cdn.tiermaker.com/images/item.png",
      imageSmallUrl: "https://cdn.tiermaker.com/images/item-small.png",
      imageMediumUrl: "https://cdn.tiermaker.com/images/item-medium.png",
      imageLargeUrl: "https://cdn.tiermaker.com/images/item-large.png",
      thumbnailUrl: "https://cdn.tiermaker.com/images/item-thumb.png",
      coverUrl: null,
      display: {
        title: "未命名作品",
        subtitle: null,
        coverUrl: "https://cdn.tiermaker.com/images/item.png",
        animeType: "IMAGE",
        tags: [],
        sourceLabel: "TIERMAKER_IMPORT",
        isOverridden: false,
        isCoverOverridden: false
      }
    };

    const snapshot = buildTierShareSnapshot({
      poolId: "pool-1",
      poolName: "Pool",
      runId: "run-1",
      generatedAt: new Date("2026-06-11T12:00:00.000Z"),
      tierLabels: {
        s: "S",
        a: "A",
        b: "B",
        c: "C",
        d: "D"
      },
      tierList
    });

    expect(snapshot.tiers[0].items[0]).toMatchObject({
      coverUrl: "https://cdn.tiermaker.com/images/item-large.png",
      imageUrl: "https://cdn.tiermaker.com/images/item.png",
      imageSmallUrl: "https://cdn.tiermaker.com/images/item-small.png",
      imageMediumUrl: "https://cdn.tiermaker.com/images/item-medium.png",
      imageLargeUrl: "https://cdn.tiermaker.com/images/item-large.png",
      thumbnailUrl: "https://cdn.tiermaker.com/images/item-thumb.png"
    });
  });

  it("stores the creator display name in the share snapshot", () => {
    const snapshot = buildTierShareSnapshot({
      poolId: "pool-1",
      poolName: "Pool",
      runId: "run-1",
      creator: {
        id: "user-1",
        name: null,
        username: "zaoc"
      },
      generatedAt: new Date("2026-06-11T12:00:00.000Z"),
      tierLabels: {
        s: "S",
        a: "A",
        b: "B",
        c: "C",
        d: "D"
      },
      tierList: tierListFixture()
    });

    expect(snapshot.creator).toEqual({
      id: "user-1",
      displayName: "zaoc",
      username: "zaoc"
    });
  });

  it("creates a persisted snapshot instead of accepting client snapshot data", async () => {
    mockedPool.findUnique.mockResolvedValue({
      id: "pool-1",
      name: "Pool"
    } as Awaited<ReturnType<typeof mockedPool.findUnique>>);
    mockedRun.findUnique.mockResolvedValue(runFixture() as Awaited<ReturnType<typeof mockedRun.findUnique>>);
    mockedUser.findUnique.mockResolvedValue(userFixture() as Awaited<ReturnType<typeof mockedUser.findUnique>>);
    mockedGetRunTierList.mockResolvedValue(tierListFixture());
    mockedTierShare.create.mockResolvedValue({
      id: "share-1",
      token: "token-1",
      poolId: "pool-1",
      runId: "run-1",
      title: "Pool",
      description: "shared",
      tierLabels: {
        s: "神作",
        a: "A",
        b: "B",
        c: "C",
        d: "D"
      },
      snapshot: {
        version: 1,
        generatedAt: "2026-06-11T12:00:00.000Z",
        pool: { id: "pool-1", name: "Pool" },
        run: { id: "run-1" },
        tiers: []
      },
      createdAt: new Date("2026-06-11T12:00:00.000Z"),
      updatedAt: new Date("2026-06-11T12:00:00.000Z")
    });

    const result = await createTierShare({
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1",
      description: " shared ",
      tierLabels: { S: "神作" }
    });

    expect(result.token).toMatch(/^[a-f0-9]{32}$/);
    expect(result.url).toBe(`/share/tier/${result.token}`);
    expect(mockedGetRunTierList).toHaveBeenCalledWith({
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1"
    });
    expect(mockedTierShare.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: expect.any(String),
          description: "shared",
          snapshot: expect.objectContaining({
            version: 1,
            creator: expect.objectContaining({
              displayName: "zaoc"
            }),
            tiers: expect.any(Array)
          })
        })
      })
    );
  });

  it("creates a tier share for an archived pool", async () => {
    mockSuccessfulTierShare({
      pool: {
        id: "pool-1",
        name: "Archived Pool",
        status: "ARCHIVED",
        deletedAt: new Date("2026-06-11T12:29:00.000Z")
      }
    });

    const result = await createTierShare({
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1"
    });

    expect(result.url).toBe(`/share/tier/${result.token}`);
    expect(mockedGetRunTierList).toHaveBeenCalledWith({
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1"
    });
    expect(mockedTierShare.create).toHaveBeenCalled();
  });

  it("does not report Pool not found for a deletedAt archived pool", async () => {
    mockSuccessfulTierShare({
      pool: {
        id: "pool-1",
        name: "DeletedAt Archived Pool",
        deletedAt: new Date("2026-06-11T12:29:00.000Z")
      }
    });

    await expect(
      createTierShare({
        userId: "user-1",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).resolves.toMatchObject({
      url: expect.stringMatching(/^\/share\/tier\//)
    });
  });

  it("returns Pool not found for a missing pool", async () => {
    mockedPool.findUnique.mockResolvedValue(null);
    mockedRun.findUnique.mockResolvedValue(runFixture() as Awaited<ReturnType<typeof mockedRun.findUnique>>);

    await expect(
      createTierShare({
        userId: "user-1",
        poolId: "missing-pool",
        runId: "run-1"
      })
    ).rejects.toMatchObject({
      message: "Pool not found",
      statusCode: 404
    });
    expect(mockedGetRunTierList).not.toHaveBeenCalled();
    expect(mockedTierShare.create).not.toHaveBeenCalled();
  });

  it("returns Run not found for a missing run", async () => {
    mockedPool.findUnique.mockResolvedValue(poolFixture() as Awaited<ReturnType<typeof mockedPool.findUnique>>);
    mockedRun.findUnique.mockResolvedValue(null);

    await expect(
      createTierShare({
        userId: "user-1",
        poolId: "pool-1",
        runId: "missing-run"
      })
    ).rejects.toMatchObject({
      message: "Run not found",
      statusCode: 404
    });
    expect(mockedGetRunTierList).not.toHaveBeenCalled();
    expect(mockedTierShare.create).not.toHaveBeenCalled();
  });

  it("returns an explicit error when the run does not belong to the pool", async () => {
    mockedPool.findUnique.mockResolvedValue(poolFixture() as Awaited<ReturnType<typeof mockedPool.findUnique>>);
    mockedRun.findUnique.mockResolvedValue(
      runFixture({ poolId: "other-pool" }) as Awaited<ReturnType<typeof mockedRun.findUnique>>
    );

    await expect(
      createTierShare({
        userId: "user-1",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).rejects.toMatchObject({
      message: "Run does not belong to pool",
      statusCode: 404
    });
    expect(mockedGetRunTierList).not.toHaveBeenCalled();
    expect(mockedTierShare.create).not.toHaveBeenCalled();
  });
});

function mockSuccessfulTierShare({
  pool = poolFixture(),
  run = runFixture()
}: {
  pool?: Record<string, unknown>;
  run?: Record<string, unknown>;
} = {}) {
  mockedPool.findUnique.mockResolvedValue(pool as Awaited<ReturnType<typeof mockedPool.findUnique>>);
  mockedRun.findUnique.mockResolvedValue(run as Awaited<ReturnType<typeof mockedRun.findUnique>>);
  mockedUser.findUnique.mockResolvedValue(userFixture() as Awaited<ReturnType<typeof mockedUser.findUnique>>);
  mockedGetRunTierList.mockResolvedValue(tierListFixture());
  mockedTierShare.create.mockResolvedValue(tierShareRecord());
}

function poolFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    name: "Pool",
    ...overrides
  };
}

function runFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    userId: "user-1",
    poolId: "pool-1",
    deletedAt: null,
    ...overrides
  };
}

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    name: null,
    username: "zaoc",
    ...overrides
  };
}

function tierShareRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "share-1",
    token: "token-1",
    poolId: "pool-1",
    runId: "run-1",
    title: "Pool",
    description: null,
    tierLabels: {
      s: "S",
      a: "A",
      b: "B",
      c: "C",
      d: "D"
    },
    snapshot: {
      version: 1,
      generatedAt: "2026-06-11T12:00:00.000Z",
      pool: { id: "pool-1", name: "Pool" },
      run: { id: "run-1" },
      tiers: []
    },
    createdAt: new Date("2026-06-11T12:00:00.000Z"),
    updatedAt: new Date("2026-06-11T12:00:00.000Z"),
    ...overrides
  };
}

function tierListFixture(): RunTierListResult {
  return {
    tiers: {
      s: [
        {
          id: "anime-1",
          animeId: "anime-1",
          bgmId: null,
          title: "Custom Upload",
          titleCn: null,
          titleJa: null,
          titleEn: null,
          imageUrl: "/uploads/custom-items/item.png",
          imageSmallUrl: null,
          imageMediumUrl: null,
          imageLargeUrl: null,
          coverUrl: "/uploads/custom-items/item.png",
          thumbnailUrl: null,
          airDate: null,
          bangumiRank: null,
          bangumiScore: null,
          tags: ["验收", "自定义"],
          aliases: [],
          year: null,
          season: null,
          animeType: "IMAGE",
          studios: [],
          source: "CUSTOM_UPLOAD",
          display: {
            title: "Custom Upload",
            subtitle: null,
            coverUrl: "/uploads/custom-items/item.png",
            animeType: "IMAGE",
            tags: ["验收", "自定义"],
            sourceLabel: "CUSTOM_UPLOAD",
            isOverridden: true,
            isCoverOverridden: true
          },
          eloScore: 1510,
          uncertainty: 300,
          compareCount: 2,
          winCount: 1,
          lossCount: 0,
          drawCount: 0,
          unseenCount: 0,
          skipCount: 0,
          manualTier: "S",
          manualRank: 0,
          manualLocked: true
        }
      ],
      a: [],
      b: [],
      c: [],
      d: []
    },
    tierRows: [
      { id: "s", label: "S", color: "#ff747c", order: 0 },
      { id: "a", label: "A", color: "#ffc078", order: 1 },
      { id: "b", label: "B", color: "#ffe082", order: 2 },
      { id: "c", label: "C", color: "#b6ff73", order: 3 },
      { id: "d", label: "D", color: "#70f475", order: 4 }
    ],
    confidenceScore: 20,
    totalAnime: 1,
    comparedAnime: 1,
    totalComparisons: 1,
    effectiveComparisons: 1,
    scoreDistribution: {
      count: 1,
      mean: 1510,
      median: 1510,
      std: 120
    },
    progress: {
      totalItems: 1,
      effectiveComparisons: 1,
      draftTarget: 0,
      reliableTarget: 0,
      highConfidenceTarget: 0,
      progressRatio: 0,
      stage: "EMPTY",
      stageLabel: "作品不足",
      nextTargetLabel: "至少添加 2 个作品",
      remainingToNextStage: 0
    }
  };
}
