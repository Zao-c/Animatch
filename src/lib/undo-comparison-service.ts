import {
  PersonalRunStatus,
  PoolComparisonResult,
  type PoolComparison,
  type PoolAnime,
  type Prisma,
  type UserPoolScore
} from "@prisma/client";
import { AppError } from "./app-error";
import { prisma } from "./db";
import { updateElo, type EloResult } from "./elo";
import { shouldHideAfterUnseen } from "./match-rules";

export interface UndoLastComparisonResult {
  undoneComparisonId: string;
  runId: string;
  poolId: string;
  message: string;
  redirectTo: string;
}

type DbClient = Prisma.TransactionClient;

export async function undoLastComparison(params: {
  userId: string;
  poolId: string;
  runId: string;
}): Promise<UndoLastComparisonResult> {
  validateUndoParams(params);

  return prisma.$transaction(async (tx) => {
    await assertPoolAndRunAccess(tx, params);

    const comparison = await tx.poolComparison.findFirst({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId,
        undoneAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (comparison === null) {
      throw new AppError("没有可以撤回的选择。", 400, "NO_COMPARISON_TO_UNDO");
    }

    const now = new Date();
    await tx.poolComparison.update({
      where: {
        id: comparison.id
      },
      data: {
        undoneAt: now,
        undoneByUserId: params.userId
      }
    });

    await recomputeRunScoresFromLedger(params, tx);

    return {
      undoneComparisonId: comparison.id,
      runId: params.runId,
      poolId: params.poolId,
      message: "已撤回上次选择。",
      redirectTo: `/pools/${params.poolId}/runs/${params.runId}/match`
    };
  });
}

export async function recomputeRunScoresFromLedger(
  params: {
    userId: string;
    poolId: string;
    runId: string;
  },
  tx: DbClient = prisma as unknown as DbClient
): Promise<UserPoolScore[]> {
  validateUndoParams(params);

  const poolAnime = await tx.poolAnime.findMany({
    where: {
      poolId: params.poolId
    },
    orderBy: {
      position: "asc"
    }
  });
  const activeAnimeIds = new Set(poolAnime.map((entry) => entry.animeId));
  const scoresByAnimeId = new Map<string, UserPoolScore>();

  for (const entry of poolAnime) {
    const score = await resetScoreForActiveAnime(tx, params, entry);
    scoresByAnimeId.set(entry.animeId, score);
  }

  const comparisons = await tx.poolComparison.findMany({
    where: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId,
      undoneAt: null
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  for (const comparison of comparisons) {
    if (
      !activeAnimeIds.has(comparison.leftAnimeId) ||
      !activeAnimeIds.has(comparison.rightAnimeId)
    ) {
      continue;
    }

    const leftScore = scoresByAnimeId.get(comparison.leftAnimeId);
    const rightScore = scoresByAnimeId.get(comparison.rightAnimeId);

    if (leftScore === undefined || rightScore === undefined) {
      continue;
    }

    const [nextLeft, nextRight] = await replayComparison(tx, comparison, leftScore, rightScore);
    scoresByAnimeId.set(nextLeft.animeId, nextLeft);
    scoresByAnimeId.set(nextRight.animeId, nextRight);
  }

  return [...scoresByAnimeId.values()];
}

async function assertPoolAndRunAccess(
  tx: DbClient,
  params: {
    userId: string;
    poolId: string;
    runId: string;
  }
) {
  const [pool, run] = await Promise.all([
    tx.customPool.findUnique({
      where: {
        id: params.poolId
      },
      select: {
        id: true,
        creatorId: true,
        deletedAt: true
      }
    }),
    tx.personalRun.findUnique({
      where: {
        id: params.runId
      }
    })
  ]);

  if (pool === null || pool.deletedAt !== null) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  if (pool.creatorId !== params.userId) {
    throw new AppError("Pool does not belong to the current user", 403, "POOL_FORBIDDEN");
  }

  if (run === null || run.deletedAt !== null) {
    throw new AppError("Run not found", 404, "RUN_NOT_FOUND");
  }

  if (run.userId !== params.userId) {
    throw new AppError("Run does not belong to the current user", 403, "RUN_FORBIDDEN");
  }

  if (run.poolId !== params.poolId) {
    throw new AppError("Run does not belong to this pool", 404, "RUN_POOL_MISMATCH");
  }

  if (run.status !== PersonalRunStatus.ACTIVE) {
    throw new AppError("Run is not active", 403, "RUN_NOT_ACTIVE");
  }
}

async function resetScoreForActiveAnime(
  tx: DbClient,
  params: {
    userId: string;
    poolId: string;
    runId: string;
  },
  entry: PoolAnime
): Promise<UserPoolScore> {
  return tx.userPoolScore.upsert({
    where: {
      userId_poolId_runId_animeId: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId,
        animeId: entry.animeId
      }
    },
    create: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId,
      animeId: entry.animeId,
      eloScore: entry.initialElo,
      uncertainty: 350
    },
    update: {
      eloScore: entry.initialElo,
      uncertainty: 350,
      compareCount: 0,
      winCount: 0,
      lossCount: 0,
      drawCount: 0,
      unseenCount: 0,
      skipCount: 0,
      isHidden: false,
      lastComparedAt: null
    }
  });
}

async function replayComparison(
  tx: DbClient,
  comparison: PoolComparison,
  leftScore: UserPoolScore,
  rightScore: UserPoolScore
): Promise<[UserPoolScore, UserPoolScore]> {
  const eloResult = toEloResult(comparison.result);

  if (eloResult !== null) {
    const eloUpdate = updateElo({
      leftElo: leftScore.eloScore,
      rightElo: rightScore.eloScore,
      leftCompareCount: leftScore.compareCount,
      rightCompareCount: rightScore.compareCount,
      leftUncertainty: leftScore.uncertainty,
      rightUncertainty: rightScore.uncertainty,
      result: eloResult
    });

    return Promise.all([
      tx.userPoolScore.update({
        where: { id: leftScore.id },
        data: {
          eloScore: eloUpdate.leftEloAfter,
          uncertainty: eloUpdate.leftUncertaintyAfter,
          compareCount: leftScore.compareCount + 1,
          winCount: leftScore.winCount + (comparison.result === PoolComparisonResult.LEFT_WIN ? 1 : 0),
          lossCount: leftScore.lossCount + (comparison.result === PoolComparisonResult.RIGHT_WIN ? 1 : 0),
          drawCount: leftScore.drawCount + (comparison.result === PoolComparisonResult.DRAW ? 1 : 0),
          lastComparedAt: comparison.createdAt
        }
      }),
      tx.userPoolScore.update({
        where: { id: rightScore.id },
        data: {
          eloScore: eloUpdate.rightEloAfter,
          uncertainty: eloUpdate.rightUncertaintyAfter,
          compareCount: rightScore.compareCount + 1,
          winCount: rightScore.winCount + (comparison.result === PoolComparisonResult.RIGHT_WIN ? 1 : 0),
          lossCount: rightScore.lossCount + (comparison.result === PoolComparisonResult.LEFT_WIN ? 1 : 0),
          drawCount: rightScore.drawCount + (comparison.result === PoolComparisonResult.DRAW ? 1 : 0),
          lastComparedAt: comparison.createdAt
        }
      })
    ]);
  }

  switch (comparison.result) {
    case PoolComparisonResult.SKIP:
      return Promise.all([
        tx.userPoolScore.update({
          where: { id: leftScore.id },
          data: { skipCount: leftScore.skipCount + 1 }
        }),
        tx.userPoolScore.update({
          where: { id: rightScore.id },
          data: { skipCount: rightScore.skipCount + 1 }
        })
      ]);
    case PoolComparisonResult.LEFT_UNSEEN:
      return Promise.all([
        replayUnseen(tx, leftScore),
        Promise.resolve(rightScore)
      ]);
    case PoolComparisonResult.RIGHT_UNSEEN:
      return Promise.all([
        Promise.resolve(leftScore),
        replayUnseen(tx, rightScore)
      ]);
    case PoolComparisonResult.BOTH_UNSEEN:
      return Promise.all([
        replayUnseen(tx, leftScore),
        replayUnseen(tx, rightScore)
      ]);
    case PoolComparisonResult.LEFT_WIN:
    case PoolComparisonResult.RIGHT_WIN:
    case PoolComparisonResult.DRAW:
      return [leftScore, rightScore];
  }
}

async function replayUnseen(tx: DbClient, score: UserPoolScore): Promise<UserPoolScore> {
  const nextUnseenCount = score.unseenCount + 1;

  // Undo replay intentionally does not reverse or rewrite global UserAnimeStatus.
  // It only rebuilds this run's UserPoolScore from non-undone ledger entries.
  return tx.userPoolScore.update({
    where: {
      id: score.id
    },
    data: {
      unseenCount: nextUnseenCount,
      isHidden: shouldHideAfterUnseen(nextUnseenCount)
    }
  });
}

function toEloResult(result: PoolComparisonResult): EloResult | null {
  switch (result) {
    case PoolComparisonResult.LEFT_WIN:
    case PoolComparisonResult.RIGHT_WIN:
    case PoolComparisonResult.DRAW:
      return result;
    case PoolComparisonResult.SKIP:
    case PoolComparisonResult.LEFT_UNSEEN:
    case PoolComparisonResult.RIGHT_UNSEEN:
    case PoolComparisonResult.BOTH_UNSEEN:
      return null;
  }
}

function validateUndoParams(params: { userId: string; poolId: string; runId: string }) {
  if (!params.userId.trim()) {
    throw new AppError("userId is required", 400, "USER_ID_REQUIRED");
  }

  if (!params.poolId.trim()) {
    throw new AppError("poolId is required", 400, "POOL_ID_REQUIRED");
  }

  if (!params.runId.trim()) {
    throw new AppError("runId is required", 400, "RUN_ID_REQUIRED");
  }
}
