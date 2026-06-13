import { PersonalRunStatus, PoolStatus, Visibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db";
import { getOrCreateDefaultRun, resetRunForUser } from "../src/lib/run-service";

vi.mock("../src/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    customPool: {
      findUnique: vi.fn()
    },
    personalRun: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn()
    },
    userPoolScore: {
      upsert: vi.fn()
    },
    poolComparison: {
      deleteMany: vi.fn()
    },
    tierShare: {
      deleteMany: vi.fn()
    }
  }
}));

const db = prisma as any;

describe("run reset service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
    db.customPool.findUnique.mockResolvedValue(poolFixture());
    db.personalRun.findUnique.mockResolvedValue(runFixture());
    db.personalRun.updateMany.mockResolvedValue({ count: 1 });
    db.personalRun.create.mockResolvedValue(runFixture({ id: "run-new", isDefault: true }));
    db.userPoolScore.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      id: "score",
      ...create
    }));
  });

  it("creates a new default run for the owner and initializes active anime scores", async () => {
    db.poolAnime.findMany.mockResolvedValue([poolAnime("anime-a"), poolAnime("anime-c")]);

    const result = await resetRunForUser({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-old"
    });

    expect(result.run.id).toBe("run-new");
    expect(result.redirectTo).toBe("/pools/pool-1/runs/run-new/match");
    expect(db.personalRun.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-a",
        poolId: "pool-1",
        isDefault: true,
        deletedAt: null
      },
      data: {
        isDefault: false
      }
    });
    expect(db.personalRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-a",
          poolId: "pool-1",
          isDefault: true,
          status: PersonalRunStatus.ACTIVE
        })
      })
    );
    expect(db.userPoolScore.upsert).toHaveBeenCalledTimes(2);
    expect(db.userPoolScore.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          animeId: "anime-b"
        })
      })
    );
  });

  it("blocks userB from resetting userA run", async () => {
    db.customPool.findUnique.mockResolvedValue(poolFixture({ creatorId: "user-a" }));

    await expect(
      resetRunForUser({
        userId: "user-b",
        poolId: "pool-1",
        runId: "run-old"
      })
    ).rejects.toMatchObject({
      statusCode: 403
    });
    expect(db.personalRun.create).not.toHaveBeenCalled();
  });

  it("returns a clear error when fewer than two active anime remain", async () => {
    db.poolAnime.findMany.mockResolvedValue([poolAnime("anime-a")]);

    await expect(
      resetRunForUser({
        userId: "user-a",
        poolId: "pool-1",
        runId: "run-old"
      })
    ).rejects.toMatchObject({
      message: "至少需要 2 部作品才能重开本轮。",
      statusCode: 400
    });
    expect(db.personalRun.create).not.toHaveBeenCalled();
  });

  it("does not delete old runs, comparisons, or tier shares", async () => {
    db.poolAnime.findMany.mockResolvedValue([poolAnime("anime-a"), poolAnime("anime-c")]);

    await resetRunForUser({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-old"
    });

    expect(db.personalRun.delete).not.toHaveBeenCalled();
    expect(db.personalRun.deleteMany).not.toHaveBeenCalled();
    expect(db.poolComparison.deleteMany).not.toHaveBeenCalled();
    expect(db.tierShare.deleteMany).not.toHaveBeenCalled();
  });

  it("lets /runs/default return the new default run after reset", async () => {
    db.personalRun.findFirst.mockResolvedValue(runFixture({ id: "run-new", isDefault: true }));

    const run = await getOrCreateDefaultRun({
      userId: "user-a",
      poolId: "pool-1"
    });

    expect(run.id).toBe("run-new");
    expect(db.personalRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          poolId: "pool-1",
          isDefault: true,
          status: PersonalRunStatus.ACTIVE,
          deletedAt: null
        })
      })
    );
  });
});

function poolFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "user-a",
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
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

function runFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-old",
    userId: "user-a",
    poolId: "pool-1",
    name: "默认榜单",
    status: PersonalRunStatus.ACTIVE,
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

function poolAnime(animeId: string, position = 1) {
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}
