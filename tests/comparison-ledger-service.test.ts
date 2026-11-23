import {
  PoolComparisonMode,
  PoolComparisonResult,
  RecalibrationSessionStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitComparison } from "../src/lib/match-service";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/db", () => ({
  prisma: {
    $transaction: vi.fn()
  }
}));

vi.mock("../src/lib/run-service", () => ({
  assertRunAccess: vi.fn(),
  initializeScoresForRun: vi.fn()
}));

const mockedPrisma = vi.mocked(prisma);

describe("comparison ledger service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes LEFT_WIN ledger fields with winner, loser, Elo, delta, position, and clientMutationId", async () => {
    const tx = createTx();
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    await submitComparison(baseSubmitParams({ result: PoolComparisonResult.LEFT_WIN }));

    const data = createdComparisonData(tx);
    expect(data.leftAnimeId).toBe("left");
    expect(data.rightAnimeId).toBe("right");
    expect(data.result).toBe(PoolComparisonResult.LEFT_WIN);
    expect(data.winnerAnimeId).toBe("left");
    expect(data.loserAnimeId).toBe("right");
    expect(data.leftEloBefore).toBe(1520);
    expect(data.rightEloBefore).toBe(1600);
    expect(data.leftEloAfter).toBeGreaterThan(1520);
    expect(data.rightEloAfter).toBeLessThan(1600);
    expect(data.deltaLeft).toBeCloseTo(data.leftEloAfter - 1520);
    expect(data.deltaRight).toBeCloseTo(data.rightEloAfter - 1600);
    expect(data.leftPosition).toBe(2);
    expect(data.rightPosition).toBe(1);
    expect(data.leftKFactor).toBeGreaterThan(0);
    expect(data.expectedLeft).toBeGreaterThan(0);
    expect(data.leftScore10Before).toBeGreaterThan(0);
    expect(data.leftScore10After).toBeGreaterThan(0);
    expect(data.clientMutationId).toBe("mutation-1");
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("writes RIGHT_WIN winner and loser", async () => {
    const tx = createTx();
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    await submitComparison(
      baseSubmitParams({
        result: PoolComparisonResult.RIGHT_WIN,
        clientMutationId: "mutation-right"
      })
    );

    const data = createdComparisonData(tx);
    expect(data.winnerAnimeId).toBe("right");
    expect(data.loserAnimeId).toBe("left");
    expect(data.result).toBe(PoolComparisonResult.RIGHT_WIN);
  });

  it("writes DRAW without winner or loser but still records Elo before and after", async () => {
    const tx = createTx();
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    await submitComparison(
      baseSubmitParams({
        result: PoolComparisonResult.DRAW,
        clientMutationId: "mutation-draw"
      })
    );

    const data = createdComparisonData(tx);
    expect(data.winnerAnimeId).toBeNull();
    expect(data.loserAnimeId).toBeNull();
    expect(data.leftEloBefore).toBe(1520);
    expect(data.leftEloAfter).not.toBeNull();
    expect(data.rightEloBefore).toBe(1600);
    expect(data.rightEloAfter).not.toBeNull();
    expect(data.isEffective).toBe(true);
  });

  it("writes SKIP as non-effective with unchanged Elo and null winner/loser", async () => {
    const tx = createTx();
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    await submitComparison(
      baseSubmitParams({
        result: PoolComparisonResult.SKIP,
        clientMutationId: "mutation-skip"
      })
    );

    const data = createdComparisonData(tx);
    expect(data.winnerAnimeId).toBeNull();
    expect(data.loserAnimeId).toBeNull();
    expect(data.leftEloBefore).toBe(1520);
    expect(data.leftEloAfter).toBe(1520);
    expect(data.rightEloBefore).toBe(1600);
    expect(data.rightEloAfter).toBe(1600);
    expect(data.deltaLeft).toBe(0);
    expect(data.deltaRight).toBe(0);
    expect(data.isEffective).toBe(false);
    expect(data.leftKFactor).toBeNull();
  });

  it("writes UNSEEN as non-effective with seen state and unchanged Elo", async () => {
    const tx = createTx();
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    await submitComparison(
      baseSubmitParams({
        result: PoolComparisonResult.LEFT_UNSEEN,
        clientMutationId: "mutation-unseen"
      })
    );

    const data = createdComparisonData(tx);
    expect(data.winnerAnimeId).toBeNull();
    expect(data.loserAnimeId).toBeNull();
    expect(data.leftSeen).toBe(false);
    expect(data.rightSeen).toBe(true);
    expect(data.leftEloAfter).toBe(1520);
    expect(data.rightEloAfter).toBe(1600);
    expect(data.isEffective).toBe(false);
  });

  it("returns an existing comparison for duplicate clientMutationId without creating a second row", async () => {
    const existingComparison = {
      id: "comparison-existing",
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1",
      leftAnimeId: "left",
      rightAnimeId: "right",
      result: PoolComparisonResult.LEFT_WIN
    };
    const tx = createTx({
      existingComparison,
      hasDuplicateScoreLookup: true
    });
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    const result = await submitComparison(baseSubmitParams({ result: PoolComparisonResult.LEFT_WIN }));

    expect(result.comparison).toBe(existingComparison);
    expect(tx.poolComparison.create).not.toHaveBeenCalled();
  });

  it("keeps ledger write in the same transaction as score updates", async () => {
    const tx = createTx({ failScoreUpdate: true });
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    await expect(
      submitComparison(baseSubmitParams({ result: PoolComparisonResult.LEFT_WIN }))
    ).rejects.toThrow("score update failed");

    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.poolComparison.create).toHaveBeenCalledTimes(1);
    expect(tx.userPoolScore.update).toHaveBeenCalled();
  });

  it("writes recalibration mode when recalibration submits through the match service", async () => {
    const tx = createTx();
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as any));

    await submitComparison(
      baseSubmitParams({
        result: PoolComparisonResult.LEFT_WIN,
        mode: PoolComparisonMode.RECALIBRATE,
        recalibrationSessionId: "session-1",
        clientMutationId: "mutation-recalibration"
      })
    );

    expect(createdComparisonData(tx).mode).toBe(PoolComparisonMode.RECALIBRATE);
    expect(tx.recalibrationSession.update).toHaveBeenCalled();
  });
});

function baseSubmitParams(overrides: Partial<Parameters<typeof submitComparison>[0]> = {}) {
  return {
    userId: "user-1",
    poolId: "pool-1",
    runId: "run-1",
    leftAnimeId: "left",
    rightAnimeId: "right",
    result: PoolComparisonResult.LEFT_WIN,
    clientMutationId: "mutation-1",
    ...overrides
  };
}

function createTx(
  options: {
    existingComparison?: unknown;
    hasDuplicateScoreLookup?: boolean;
    failScoreUpdate?: boolean;
  } = {}
) {
  const scores: Record<string, ReturnType<typeof scoreFixture>> = {
    left: scoreFixture({
      id: "score-left",
      animeId: "left",
      eloScore: 1520,
      compareCount: 2
    }),
    right: scoreFixture({
      id: "score-right",
      animeId: "right",
      eloScore: 1600,
      compareCount: 4
    }),
    extra: scoreFixture({
      id: "score-extra",
      animeId: "extra",
      eloScore: 1400,
      compareCount: 1
    })
  };
  const tx = {
    poolComparison: {
      findUnique: vi.fn().mockResolvedValue(options.existingComparison ?? null),
      create: vi.fn(async ({ data }) => ({
        id: "comparison-1",
        ...data,
        createdAt: data.createdAt,
        updatedAt: data.createdAt
      }))
    },
    poolAnime: {
      findUnique: vi.fn(async ({ where }) => ({
        id: `entry-${where.poolId_animeId.animeId}`,
        poolId: where.poolId_animeId.poolId,
        animeId: where.poolId_animeId.animeId,
        initialElo: 1500
      }))
    },
    userPoolScore: {
      upsert: vi.fn(async ({ where }) => scores[where.userId_poolId_runId_animeId.animeId]),
      findMany: vi.fn().mockResolvedValue([
        { animeId: "left", eloScore: 1520 },
        { animeId: "right", eloScore: 1600 },
        { animeId: "extra", eloScore: 1400 }
      ]),
      findUnique: vi.fn(async ({ where }) => {
        if (!options.hasDuplicateScoreLookup) {
          return null;
        }

        return scores[where.userId_poolId_runId_animeId.animeId];
      }),
      update: vi.fn(async ({ where, data }) => {
        if (options.failScoreUpdate) {
          throw new Error("score update failed");
        }

        const current =
          where.id === "score-left" ? scores.left : where.id === "score-right" ? scores.right : scores.extra;

        return {
          ...current,
          eloScore: data.eloScore ?? current.eloScore,
          uncertainty: data.uncertainty ?? current.uncertainty,
          compareCount: current.compareCount + (data.compareCount?.increment ?? 0),
          winCount: current.winCount + (data.winCount?.increment ?? 0),
          lossCount: current.lossCount + (data.lossCount?.increment ?? 0),
          drawCount: current.drawCount + (data.drawCount?.increment ?? 0),
          unseenCount: current.unseenCount + (data.unseenCount?.increment ?? 0),
          skipCount: current.skipCount + (data.skipCount?.increment ?? 0),
          isHidden: data.isHidden ?? current.isHidden,
          lastComparedAt: data.lastComparedAt ?? current.lastComparedAt
        };
      })
    },
    userAnimeStatus: {
      upsert: vi.fn()
    },
    recalibrationSession: {
      findUnique: vi.fn().mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        poolId: "pool-1",
        runId: "run-1",
        status: RecalibrationSessionStatus.ACTIVE,
        completedCount: 0,
        plannedCount: 2
      }),
      update: vi.fn()
    }
  };

  return tx;
}

function createdComparisonData(tx: ReturnType<typeof createTx>) {
  return tx.poolComparison.create.mock.calls[0][0].data;
}

function scoreFixture(overrides: Record<string, unknown>) {
  return {
    id: "score",
    userId: "user-1",
    poolId: "pool-1",
    runId: "run-1",
    animeId: "anime",
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}
