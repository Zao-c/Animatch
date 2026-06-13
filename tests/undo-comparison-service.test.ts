import {
  PersonalRunStatus,
  PoolComparisonMode,
  PoolComparisonResult,
  PoolStatus,
  Visibility
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db";
import {
  recomputeRunScoresFromLedger,
  undoLastComparison
} from "../src/lib/undo-comparison-service";

vi.mock("../src/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    customPool: {
      findUnique: vi.fn()
    },
    personalRun: {
      findUnique: vi.fn()
    },
    poolComparison: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn()
    },
    userPoolScore: {
      upsert: vi.fn(),
      update: vi.fn()
    },
    userAnimeStatus: {
      upsert: vi.fn()
    }
  }
}));

const db = prisma as any;
let scoreState: Map<string, any>;

describe("undo comparison service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scoreState = new Map();
    db.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
    db.customPool.findUnique.mockResolvedValue(poolFixture());
    db.personalRun.findUnique.mockResolvedValue(runFixture());
    db.poolAnime.findMany.mockResolvedValue([
      poolAnime("anime-a", 0, 1500),
      poolAnime("anime-b", 1, 1500),
      poolAnime("anime-c", 2, 1500)
    ]);
    db.poolComparison.findFirst.mockResolvedValue(comparison("comparison-2", {
      result: PoolComparisonResult.DRAW,
      createdAt: new Date("2026-01-01T00:02:00.000Z")
    }));
    db.poolComparison.findMany.mockResolvedValue([
      comparison("comparison-1", {
        result: PoolComparisonResult.LEFT_WIN,
        createdAt: new Date("2026-01-01T00:01:00.000Z")
      })
    ]);
    db.poolComparison.update.mockResolvedValue(comparison("comparison-2"));
    db.userPoolScore.upsert.mockImplementation(async ({ create, update, where }: any) => {
      const animeId = where.userId_poolId_runId_animeId.animeId;
      const existing = scoreState.get(animeId);
      const next = {
        ...(existing ?? score(animeId)),
        ...(existing === undefined ? create : update),
        id: `score-${animeId}`,
        animeId
      };
      scoreState.set(animeId, next);
      return next;
    });
    db.userPoolScore.update.mockImplementation(async ({ where, data }: any) => {
      const current = [...scoreState.values()].find((item) => item.id === where.id);
      const next = { ...current, ...data };
      scoreState.set(next.animeId, next);
      return next;
    });
  });

  it("marks the latest non-undone comparison and recomputes scores without deleting ledger rows", async () => {
    const result = await undoLastComparison({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-1"
    });

    expect(result).toMatchObject({
      undoneComparisonId: "comparison-2",
      redirectTo: "/pools/pool-1/runs/run-1/match"
    });
    expect(db.poolComparison.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-a",
        poolId: "pool-1",
        runId: "run-1",
        undoneAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    expect(db.poolComparison.update).toHaveBeenCalledWith({
      where: { id: "comparison-2" },
      data: {
        undoneAt: expect.any(Date),
        undoneByUserId: "user-a"
      }
    });
    expect(db.poolComparison.create).not.toHaveBeenCalled();
    expect(db.poolComparison.delete).not.toHaveBeenCalled();
    expect(db.poolComparison.deleteMany).not.toHaveBeenCalled();
    expect(scoreState.get("anime-a").winCount).toBe(1);
    expect(scoreState.get("anime-b").lossCount).toBe(1);
  });

  it("blocks userB from undoing userA run", async () => {
    db.customPool.findUnique.mockResolvedValue(poolFixture({ creatorId: "user-a" }));

    await expect(
      undoLastComparison({
        userId: "user-b",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).rejects.toMatchObject({
      statusCode: 403
    });
    expect(db.poolComparison.update).not.toHaveBeenCalled();
  });

  it("returns a clear error when there is no comparison to undo", async () => {
    db.poolComparison.findFirst.mockResolvedValue(null);

    await expect(
      undoLastComparison({
        userId: "user-a",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).rejects.toMatchObject({
      message: "没有可以撤回的选择。",
      statusCode: 400
    });
  });

  it("replays DRAW, SKIP, and UNSEEN without rewriting global UserAnimeStatus", async () => {
    db.poolComparison.findMany.mockResolvedValue([
      comparison("draw", { result: PoolComparisonResult.DRAW }),
      comparison("skip", { result: PoolComparisonResult.SKIP }),
      comparison("unseen", { result: PoolComparisonResult.LEFT_UNSEEN })
    ]);

    await recomputeRunScoresFromLedger({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-1"
    });

    expect(scoreState.get("anime-a").drawCount).toBe(1);
    expect(scoreState.get("anime-a").skipCount).toBe(1);
    expect(scoreState.get("anime-b").skipCount).toBe(1);
    expect(scoreState.get("anime-a").unseenCount).toBe(1);
    expect(db.userAnimeStatus.upsert).not.toHaveBeenCalled();
  });

  it("skips removed anime during replay", async () => {
    db.poolAnime.findMany.mockResolvedValue([
      poolAnime("anime-a", 0, 1500),
      poolAnime("anime-c", 1, 1500)
    ]);
    db.poolComparison.findMany.mockResolvedValue([
      comparison("removed", {
        leftAnimeId: "anime-a",
        rightAnimeId: "anime-b",
        result: PoolComparisonResult.LEFT_WIN
      }),
      comparison("active", {
        leftAnimeId: "anime-a",
        rightAnimeId: "anime-c",
        result: PoolComparisonResult.RIGHT_WIN
      })
    ]);

    await recomputeRunScoresFromLedger({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-1"
    });

    expect(scoreState.has("anime-b")).toBe(false);
    expect(scoreState.get("anime-c").winCount).toBe(1);
  });

  it("does not affect other runs or users when selecting undo candidates", async () => {
    await undoLastComparison({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-1"
    });

    expect(db.poolComparison.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          poolId: "pool-1",
          runId: "run-1",
          undoneAt: null
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
    userId: "user-a",
    poolId: "pool-1",
    name: "Run",
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

function poolAnime(animeId: string, position: number, initialElo: number) {
  return {
    id: `entry-${animeId}`,
    poolId: "pool-1",
    animeId,
    position,
    note: null,
    initialElo,
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

function comparison(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId: "user-a",
    poolId: "pool-1",
    runId: "run-1",
    leftAnimeId: "anime-a",
    rightAnimeId: "anime-b",
    winnerAnimeId: "anime-a",
    loserAnimeId: "anime-b",
    result: PoolComparisonResult.LEFT_WIN,
    mode: PoolComparisonMode.NORMAL,
    pairKey: "anime-a:anime-b",
    isEffective: true,
    leftSeen: true,
    rightSeen: true,
    leftEloBefore: 1500,
    leftEloAfter: 1530,
    rightEloBefore: 1500,
    rightEloAfter: 1470,
    leftPosition: 0,
    rightPosition: 1,
    leftKFactor: 40,
    rightKFactor: 40,
    expectedLeft: 0.5,
    expectedRight: 0.5,
    deltaLeft: 20,
    deltaRight: -20,
    leftScore10Before: 5,
    leftScore10After: 6,
    rightScore10Before: 5,
    rightScore10After: 4,
    algorithmVersion: "elo-v1",
    pairingVersion: "active-v1",
    tierRuleVersion: "percentile-v1",
    clientMutationId: id,
    undoneAt: null,
    undoneByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

function score(animeId: string) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: `score-${animeId}`,
    userId: "user-a",
    poolId: "pool-1",
    runId: "run-1",
    animeId,
    eloScore: 1500,
    uncertainty: 350,
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
    updatedAt: now
  };
}
