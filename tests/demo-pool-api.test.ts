import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { POST } from "../src/app/api/demo-pool/route";
import { prisma } from "../src/lib/db";
import { getOrCreateDefaultRun, initializeScoresForRun } from "../src/lib/run-service";
import * as bangumi from "../src/lib/bangumi";

vi.mock("../src/lib/dev-user", () => ({
  getOrCreateDevUser: vi.fn(async () => ({ id: "user-1" }))
}));

vi.mock("../src/lib/bangumi", () => ({
  getBangumiSubject: vi.fn(),
  parseBangumiSubjectIds: vi.fn(),
  searchBangumiAnime: vi.fn()
}));

vi.mock("../src/lib/run-service", () => ({
  getOrCreateDefaultRun: vi.fn(),
  initializeScoresForRun: vi.fn()
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    anime: {
      upsert: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn(),
      create: vi.fn()
    }
  }
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedAnime = vi.mocked(prisma.anime);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);
const mockedGetOrCreateDefaultRun = vi.mocked(getOrCreateDefaultRun);
const mockedInitializeScoresForRun = vi.mocked(initializeScoresForRun);
const mockedBangumi = vi.mocked(bangumi);

function pool(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-demo",
    creatorId: "user-1",
    name: "AniMatch 入门体验池",
    description: "不用搜索和导入，直接体验二选一对决、Tier List、校准和分享。",
    coverUrl: null,
    visibility: Visibility.PRIVATE,
    status: PoolStatus.DRAFT,
    tags: ["animatch-demo-v1", "示例池"],
    sourcePoolId: null,
    affectsGlobalTaste: false,
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

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-demo",
    userId: "user-1",
    poolId: "pool-demo",
    name: "默认榜单",
    status: "ACTIVE",
    isDefault: true,
    algorithmVersion: "elo-v1",
    pairingVersion: "active-v1",
    tierRuleVersion: "percentile-v1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

describe("POST /api/demo-pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedCustomPool.findFirst.mockResolvedValue(null);
    mockedCustomPool.create.mockResolvedValue(pool());
    (mockedAnime.upsert as any).mockImplementation(async (args: any) => ({
      id: `anime-${Math.abs(args.where.bgmId)}`,
      bgmId: args.where.bgmId,
      title: args.create.title,
      titleCn: args.create.titleCn,
      titleJa: null,
      titleEn: null,
      summary: null,
      imageUrl: args.create.imageUrl,
      imageSmallUrl: args.create.imageSmallUrl,
      imageMediumUrl: args.create.imageMediumUrl,
      imageLargeUrl: args.create.imageLargeUrl,
      thumbnailUrl: args.create.thumbnailUrl,
      airDate: args.create.airDate,
      bangumiRank: args.create.bangumiRank,
      bangumiScore: args.create.bangumiScore,
      bangumiVotes: null,
      tags: args.create.tags,
      aliases: args.create.aliases,
      year: null,
      season: null,
      animeType: null,
      episodes: null,
      status: null,
      studios: args.create.studios,
      externalLinks: args.create.externalLinks,
      source: args.create.source,
      sourceId: args.create.sourceId,
      rawJson: null,
      fetchedAt: null,
      imageStatus: args.create.imageStatus,
      imageCheckedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null
    }));
    mockedPoolAnime.findMany.mockResolvedValue([]);
    mockedPoolAnime.create.mockResolvedValue({} as any);
    mockedGetOrCreateDefaultRun.mockResolvedValue(run() as any);
    mockedInitializeScoresForRun.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({ id: `score-${index}` }) as any)
    );
  });

  it("creates the demo pool, local anime, pool entries, default run, and scores", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data).toMatchObject({
      poolId: "pool-demo",
      runId: "run-demo",
      created: true,
      animeCount: 10,
      redirectTo: "/pools/pool-demo/runs/run-demo/match"
    });
    expect(mockedCustomPool.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "AniMatch 入门体验池",
          visibility: Visibility.PRIVATE,
          tags: ["animatch-demo-v1", "示例池"],
          affectsGlobalTaste: false
        })
      })
    );
    expect(mockedAnime.upsert).toHaveBeenCalledTimes(10);
    expect(mockedPoolAnime.create).toHaveBeenCalledTimes(10);
    expect(mockedGetOrCreateDefaultRun).toHaveBeenCalledWith({
      userId: "user-1",
      poolId: "pool-demo"
    });
    expect(mockedInitializeScoresForRun).toHaveBeenCalledWith({
      userId: "user-1",
      poolId: "pool-demo",
      runId: "run-demo"
    });
    expect(payload.data.animeCount).toBeGreaterThanOrEqual(8);
    expect(mockedBangumi.getBangumiSubject).not.toHaveBeenCalled();
    expect(mockedBangumi.searchBangumiAnime).not.toHaveBeenCalled();
  });

  it("reuses an active demo pool and does not duplicate existing pool anime", async () => {
    mockedCustomPool.findFirst.mockResolvedValue(pool());
    mockedPoolAnime.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        animeId: `anime-${900001 + index}`,
        position: index + 1
      })) as any
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.created).toBe(false);
    expect(payload.data.animeCount).toBe(10);
    expect(mockedCustomPool.create).not.toHaveBeenCalled();
    expect(mockedAnime.upsert).not.toHaveBeenCalled();
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
    expect(payload.data.redirectTo).toBe("/pools/pool-demo/runs/run-demo/match");
  });

  it("does not restore a removed default anime in an active demo pool", async () => {
    mockedCustomPool.findFirst.mockResolvedValue(pool());
    mockedPoolAnime.findMany.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        animeId: `anime-${900001 + index}`,
        position: index + 1
      })) as any
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      created: false,
      animeCount: 9,
      redirectTo: "/pools/pool-demo/runs/run-demo/match"
    });
    expect(mockedAnime.upsert).not.toHaveBeenCalled();
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });

  it("does not restore defaults when an active demo pool has been emptied", async () => {
    mockedCustomPool.findFirst.mockResolvedValue(pool());
    mockedPoolAnime.findMany.mockResolvedValue([]);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      created: false,
      animeCount: 0,
      redirectTo: "/pools/pool-demo"
    });
    expect(mockedAnime.upsert).not.toHaveBeenCalled();
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });

  it("redirects existing active demo pools with fewer than 2 anime to pool detail", async () => {
    mockedCustomPool.findFirst.mockResolvedValue(pool());
    mockedPoolAnime.findMany.mockResolvedValue([
      {
        animeId: "anime-900001",
        position: 1
      }
    ] as any);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      created: false,
      animeCount: 1,
      redirectTo: "/pools/pool-demo"
    });
    expect(mockedAnime.upsert).not.toHaveBeenCalled();
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });

  it("creates a fresh demo pool when the previous one is archived", async () => {
    mockedCustomPool.findFirst.mockResolvedValue(null);
    mockedCustomPool.create.mockResolvedValue(pool({ id: "pool-demo-next" }));
    mockedGetOrCreateDefaultRun.mockResolvedValue(run({ poolId: "pool-demo-next" }) as any);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data).toMatchObject({
      poolId: "pool-demo-next",
      created: true,
      redirectTo: "/pools/pool-demo-next/runs/run-demo/match"
    });
    expect(mockedCustomPool.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: PoolStatus.ARCHIVED },
          deletedAt: null
        })
      })
    );
  });

  it("keeps the created pool match-ready", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBeLessThan(300);
    expect(payload.data.animeCount).toBeGreaterThanOrEqual(2);
    expect(payload.data.runId).toBe("run-demo");
    expect(mockedInitializeScoresForRun).toHaveBeenCalledTimes(1);
  });
});
