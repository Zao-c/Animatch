import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTierShareSnapshot,
  createTierShare,
  generateTierShareToken,
  sanitizeTierShareDescription,
  sanitizeTierShareLabels
} from "../src/lib/tier-share-service";
import { prisma } from "../src/lib/db";
import { getRunTierList } from "../src/lib/tier-service";

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
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
        S: "神作",
        A: "A",
        B: "B",
        C: "C",
        D: "D"
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
      key: "S",
      label: "神作",
      items: [
        expect.objectContaining({
          animeId: "anime-1",
          title: "Custom Upload",
          coverUrl: "/uploads/custom-items/item.png",
          source: "CUSTOM_UPLOAD",
          isLocked: true,
          isEdited: true
        })
      ]
    });
  });

  it("creates a persisted snapshot instead of accepting client snapshot data", async () => {
    mockedPool.findUnique.mockResolvedValue({
      id: "pool-1",
      name: "Pool",
      deletedAt: null
    } as Awaited<ReturnType<typeof mockedPool.findUnique>>);
    mockedGetRunTierList.mockResolvedValue(tierListFixture());
    mockedTierShare.create.mockResolvedValue({
      id: "share-1",
      token: "token-1",
      poolId: "pool-1",
      runId: "run-1",
      title: "Pool",
      description: "shared",
      tierLabels: {
        S: "神作",
        A: "A",
        B: "B",
        C: "C",
        D: "D"
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
            tiers: expect.any(Array)
          })
        })
      })
    );
  });
});

function tierListFixture() {
  return {
    tiers: {
      S: [
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
          tags: [],
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
            tags: [],
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
      A: [],
      B: [],
      C: [],
      D: []
    },
    confidenceScore: 20,
    totalAnime: 1,
    comparedAnime: 1,
    totalComparisons: 1
  };
}
