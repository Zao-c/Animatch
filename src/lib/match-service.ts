import {
  PoolComparisonMode,
  PoolComparisonResult,
  Prisma,
  RecalibrationSessionStatus,
  WatchStatus,
  type Anime,
  type PoolComparison,
  type UserPoolScore
} from "@prisma/client";
import { AppError } from "./app-error";
import { toPublicAnime } from "./anime-service";
import { getEffectiveAnimeDisplay, type EffectiveAnimeDisplay } from "./anime-display";
import { prisma } from "./db";
import { updateElo, type EloResult } from "./elo";
import { makePairKey } from "./pair-key";
import { pickNextPair, type ScoreItem } from "./pairing";
import { buildScoreDistribution, type RankingScoreDistribution } from "./ranking-display";
import { buildRankingProgress, type RankingProgress } from "./ranking-progress";
import { calculateRankingConfidence } from "./tier";
import { assertRunAccess, initializeScoresForRun } from "./run-service";
import {
  getSeenState,
  getWinnerLoser,
  isEffectiveResult,
  makeQueuePairId,
  shouldHideAfterUnseen
} from "./match-rules";

export interface PublicAnimeWithScore extends ReturnType<typeof toPublicAnime> {
  display?: EffectiveAnimeDisplay;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
}

export interface MatchQueuePair {
  pairId: string;
  left: PublicAnimeWithScore;
  right: PublicAnimeWithScore;
  reason: string;
}

export interface MatchQueueResult {
  pairs: MatchQueuePair[];
  confidenceScore: number;
  scoreDistribution: RankingScoreDistribution;
  progress: RankingProgress;
}

export interface SubmitComparisonParams {
  userId: string;
  poolId: string;
  runId: string;
  leftAnimeId: string;
  rightAnimeId: string;
  result: PoolComparisonResult;
  mode?: PoolComparisonMode;
  clientMutationId: string;
  recalibrationSessionId?: string;
}

export interface SubmitComparisonResult {
  comparison: PoolComparison;
  leftScore: PublicScore;
  rightScore: PublicScore;
}

export interface PublicScore {
  id: string;
  userId: string;
  poolId: string;
  runId: string;
  animeId: string;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  unseenCount: number;
  skipCount: number;
  isHidden: boolean;
  manualTier: string | null;
  manualRank: number | null;
  manualLocked: boolean;
  lastComparedAt: Date | null;
}

type ScoreWithAnime = UserPoolScore & { anime: Anime };

export async function getMatchQueue(params: {
  userId: string;
  poolId: string;
  runId: string;
  limit?: number;
}): Promise<MatchQueueResult> {
  const limit = Math.min(10, Math.max(1, Math.trunc(params.limit ?? 8)));

  await assertRunAccess(params);
  await initializeScoresForRun(params);

  const [scores, poolAnimeEntries] = await Promise.all([
    prisma.userPoolScore.findMany({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId
      },
      include: {
        anime: true
      }
    }),
    prisma.poolAnime.findMany({
      where: {
        poolId: params.poolId
      },
      include: {
        anime: true
      }
    })
  ]);
  const displayByAnimeId = new Map(
    poolAnimeEntries.map((entry) => [entry.animeId, getEffectiveAnimeDisplay(entry)])
  );
  const visibleScores = scores.filter((score) => !score.isHidden);

  if (visibleScores.length < 2) {
    return {
      pairs: [],
      confidenceScore: calculateQueueConfidence(scores),
      scoreDistribution: buildScoreDistribution(scores.map((score) => score.eloScore)),
      progress: buildRankingProgress({
        totalItems: scores.length,
        effectiveComparisons: Math.floor(
          scores.reduce((sum, score) => sum + score.compareCount, 0) / 2
        ),
        comparedItems: scores.filter((score) => score.compareCount > 0).length,
        totalComparisons: Math.floor(
          scores.reduce((sum, score) => sum + score.compareCount, 0) / 2
        )
      })
    };
  }

  const recentComparisons = await prisma.poolComparison.findMany({
    where: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });
  const allComparisons = await prisma.poolComparison.findMany({
    where: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId
    },
    select: {
      pairKey: true,
      isEffective: true
    }
  });
  const recentPairKeys = new Set(recentComparisons.map((comparison) => comparison.pairKey));
  const comparedPairKeys = new Set(allComparisons.map((comparison) => comparison.pairKey));
  const effectiveComparisons = allComparisons.filter(
    (comparison) => comparison.isEffective
  ).length;
  const queuedPairKeys = new Set<string>();
  const pairs: MatchQueuePair[] = [];

  while (pairs.length < limit) {
    const pickedPair = pickNextPair(
      visibleScores.map(toScoreItem),
      comparedPairKeys,
      new Set([...recentPairKeys, ...queuedPairKeys])
    );

    if (pickedPair === null) {
      break;
    }

    const pairKey = makePairKey(pickedPair.leftAnimeId, pickedPair.rightAnimeId);
    const left = visibleScores.find((score) => score.animeId === pickedPair.leftAnimeId);
    const right = visibleScores.find((score) => score.animeId === pickedPair.rightAnimeId);

    if (left === undefined || right === undefined || queuedPairKeys.has(pairKey)) {
      break;
    }

    queuedPairKeys.add(pairKey);
    pairs.push({
      pairId: makeQueuePairId(left.animeId, right.animeId),
      left: toPublicAnimeWithScore(left, displayByAnimeId.get(left.animeId)),
      right: toPublicAnimeWithScore(right, displayByAnimeId.get(right.animeId)),
      reason: pickedPair.reason
    });
  }

  return {
    pairs,
    confidenceScore: calculateQueueConfidence(scores),
    scoreDistribution: buildScoreDistribution(visibleScores.map((score) => score.eloScore)),
    progress: buildRankingProgress({
      totalItems: visibleScores.length,
      effectiveComparisons,
      comparedItems: visibleScores.filter((score) => score.compareCount > 0).length,
      totalComparisons: allComparisons.length
    })
  };
}

export async function submitComparison(
  params: SubmitComparisonParams
): Promise<SubmitComparisonResult> {
  validateSubmitComparisonParams(params);
  await assertRunAccess(params);

  return prisma.$transaction(async (tx) => {
    const existingComparison = await tx.poolComparison.findUnique({
      where: {
        userId_clientMutationId: {
          userId: params.userId,
          clientMutationId: params.clientMutationId
        }
      }
    });

    if (existingComparison !== null) {
      return {
        comparison: existingComparison,
        leftScore: toPublicScore(
          await requireScore(tx, params.userId, params.poolId, params.runId, params.leftAnimeId)
        ),
        rightScore: toPublicScore(
          await requireScore(tx, params.userId, params.poolId, params.runId, params.rightAnimeId)
        )
      };
    }

    if (isRecalibrationMode(params.mode)) {
      await requireActiveRecalibrationSession(tx, params);
    }

    const [leftPoolAnime, rightPoolAnime] = await Promise.all([
      tx.poolAnime.findUnique({
        where: {
          poolId_animeId: {
            poolId: params.poolId,
            animeId: params.leftAnimeId
          }
        }
      }),
      tx.poolAnime.findUnique({
        where: {
          poolId_animeId: {
            poolId: params.poolId,
            animeId: params.rightAnimeId
          }
        }
      })
    ]);

    if (leftPoolAnime === null || rightPoolAnime === null) {
      throw new AppError("Both anime must belong to the pool", 400, "ANIME_NOT_IN_POOL");
    }

    const [leftScoreBefore, rightScoreBefore] = await Promise.all([
      upsertScore(tx, params.userId, params.poolId, params.runId, leftPoolAnime.animeId, leftPoolAnime.initialElo),
      upsertScore(tx, params.userId, params.poolId, params.runId, rightPoolAnime.animeId, rightPoolAnime.initialElo)
    ]);
    const pairKey = makePairKey(params.leftAnimeId, params.rightAnimeId);
    const now = new Date();
    const seenState = getSeenState(params.result);
    const winnerLoser = getWinnerLoser(
      params.result,
      params.leftAnimeId,
      params.rightAnimeId
    );
    const effective = isEffectiveResult(params.result);
    const eloUpdate = effective
      ? updateElo({
          leftElo: leftScoreBefore.eloScore,
          rightElo: rightScoreBefore.eloScore,
          leftCompareCount: leftScoreBefore.compareCount,
          rightCompareCount: rightScoreBefore.compareCount,
          leftUncertainty: leftScoreBefore.uncertainty,
          rightUncertainty: rightScoreBefore.uncertainty,
          result: params.result as EloResult
        })
      : null;

    const comparison = await tx.poolComparison.create({
      data: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId,
        leftAnimeId: params.leftAnimeId,
        rightAnimeId: params.rightAnimeId,
        winnerAnimeId: winnerLoser.winnerAnimeId,
        loserAnimeId: winnerLoser.loserAnimeId,
        result: params.result,
        mode: params.mode ?? PoolComparisonMode.NORMAL,
        pairKey,
        isEffective: effective,
        leftSeen: seenState.leftSeen,
        rightSeen: seenState.rightSeen,
        leftEloBefore: effective ? leftScoreBefore.eloScore : null,
        leftEloAfter: eloUpdate?.leftEloAfter ?? null,
        rightEloBefore: effective ? rightScoreBefore.eloScore : null,
        rightEloAfter: eloUpdate?.rightEloAfter ?? null,
        algorithmVersion: "elo-v1",
        pairingVersion: "active-v1",
        tierRuleVersion: "percentile-v1",
        clientMutationId: params.clientMutationId,
        createdAt: now
      }
    });

    const [leftScore, rightScore] = await updateScoresAfterResult(tx, {
      params,
      leftScoreBefore,
      rightScoreBefore,
      eloUpdate,
      now
    });

    if (isRecalibrationMode(params.mode) && params.recalibrationSessionId !== undefined) {
      await incrementRecalibrationProgress(tx, params.recalibrationSessionId);
    }

    return {
      comparison,
      leftScore: toPublicScore(leftScore),
      rightScore: toPublicScore(rightScore)
    };
  });
}

function validateSubmitComparisonParams(params: SubmitComparisonParams): void {
  if (!params.clientMutationId.trim()) {
    throw new AppError("clientMutationId is required", 400, "CLIENT_MUTATION_ID_REQUIRED");
  }

  if (!params.leftAnimeId.trim() || !params.rightAnimeId.trim()) {
    throw new AppError("leftAnimeId and rightAnimeId are required", 400, "ANIME_ID_REQUIRED");
  }

  if (params.leftAnimeId === params.rightAnimeId) {
    throw new AppError("leftAnimeId and rightAnimeId must be different", 400, "SAME_ANIME");
  }

  if (isRecalibrationMode(params.mode) && !params.recalibrationSessionId?.trim()) {
    throw new AppError(
      "recalibrationSessionId is required for recalibration mode",
      400,
      "RECALIBRATION_SESSION_REQUIRED"
    );
  }
}

function isRecalibrationMode(mode: PoolComparisonMode | undefined): boolean {
  return (
    mode === PoolComparisonMode.RECALIBRATE ||
    mode === PoolComparisonMode.FOCUS_RECALIBRATE ||
    mode === PoolComparisonMode.RANGE_RECALIBRATE
  );
}

async function requireActiveRecalibrationSession(
  tx: Prisma.TransactionClient,
  params: SubmitComparisonParams
) {
  const session =
    params.recalibrationSessionId === undefined
      ? null
      : await tx.recalibrationSession.findUnique({
          where: {
            id: params.recalibrationSessionId
          }
        });

  if (session === null) {
    throw new AppError("Recalibration session not found", 404, "RECALIBRATION_NOT_FOUND");
  }

  if (
    session.userId !== params.userId ||
    session.poolId !== params.poolId ||
    session.runId !== params.runId
  ) {
    throw new AppError("Recalibration session does not belong to this run", 403, "RECALIBRATION_FORBIDDEN");
  }

  if (session.status !== RecalibrationSessionStatus.ACTIVE) {
    throw new AppError("Recalibration session is not active", 403, "RECALIBRATION_NOT_ACTIVE");
  }
}

async function incrementRecalibrationProgress(
  tx: Prisma.TransactionClient,
  sessionId: string
) {
  const session = await tx.recalibrationSession.findUnique({
    where: {
      id: sessionId
    }
  });

  if (session === null || session.status !== RecalibrationSessionStatus.ACTIVE) {
    return;
  }

  const nextCompletedCount = session.completedCount + 1;

  await tx.recalibrationSession.update({
    where: {
      id: session.id
    },
    data: {
      completedCount: {
        increment: 1
      },
      status:
        nextCompletedCount >= session.plannedCount
          ? RecalibrationSessionStatus.COMPLETED
          : RecalibrationSessionStatus.ACTIVE
    }
  });
}

function toScoreItem(score: ScoreWithAnime): ScoreItem {
  return {
    animeId: score.animeId,
    eloScore: score.eloScore,
    uncertainty: score.uncertainty,
    compareCount: score.compareCount,
    tier: score.manualTier ?? undefined,
    rank: score.manualRank ?? undefined,
    isHidden: score.isHidden
  };
}

function toPublicAnimeWithScore(
  score: ScoreWithAnime,
  display?: EffectiveAnimeDisplay
): PublicAnimeWithScore {
  return {
    ...toPublicAnime(score.anime),
    display,
    eloScore: score.eloScore,
    uncertainty: score.uncertainty,
    compareCount: score.compareCount
  };
}

function calculateQueueConfidence(scores: UserPoolScore[]): number {
  return calculateRankingConfidence(
    scores.map((score) => ({
      animeId: score.animeId,
      eloScore: score.eloScore,
      compareCount: score.compareCount,
      uncertainty: score.uncertainty
    }))
  );
}

async function upsertScore(
  tx: Prisma.TransactionClient,
  userId: string,
  poolId: string,
  runId: string,
  animeId: string,
  initialElo: number
): Promise<UserPoolScore> {
  return tx.userPoolScore.upsert({
    where: {
      userId_poolId_runId_animeId: {
        userId,
        poolId,
        runId,
        animeId
      }
    },
    create: {
      userId,
      poolId,
      runId,
      animeId,
      eloScore: initialElo,
      uncertainty: 350
    },
    update: {}
  });
}

async function requireScore(
  tx: Prisma.TransactionClient,
  userId: string,
  poolId: string,
  runId: string,
  animeId: string
): Promise<UserPoolScore> {
  const score = await tx.userPoolScore.findUnique({
    where: {
      userId_poolId_runId_animeId: {
        userId,
        poolId,
        runId,
        animeId
      }
    }
  });

  if (score === null) {
    throw new AppError("Score not found", 404, "SCORE_NOT_FOUND");
  }

  return score;
}

async function updateScoresAfterResult(
  tx: Prisma.TransactionClient,
  input: {
    params: SubmitComparisonParams;
    leftScoreBefore: UserPoolScore;
    rightScoreBefore: UserPoolScore;
    eloUpdate: ReturnType<typeof updateElo> | null;
    now: Date;
  }
): Promise<[UserPoolScore, UserPoolScore]> {
  if (input.eloUpdate !== null) {
    const result = input.params.result;
    const leftUpdate = {
      eloScore: input.eloUpdate.leftEloAfter,
      uncertainty: input.eloUpdate.leftUncertaintyAfter,
      compareCount: { increment: 1 },
      winCount: { increment: result === PoolComparisonResult.LEFT_WIN ? 1 : 0 },
      lossCount: { increment: result === PoolComparisonResult.RIGHT_WIN ? 1 : 0 },
      drawCount: { increment: result === PoolComparisonResult.DRAW ? 1 : 0 },
      lastComparedAt: input.now
    };
    const rightUpdate = {
      eloScore: input.eloUpdate.rightEloAfter,
      uncertainty: input.eloUpdate.rightUncertaintyAfter,
      compareCount: { increment: 1 },
      winCount: { increment: result === PoolComparisonResult.RIGHT_WIN ? 1 : 0 },
      lossCount: { increment: result === PoolComparisonResult.LEFT_WIN ? 1 : 0 },
      drawCount: { increment: result === PoolComparisonResult.DRAW ? 1 : 0 },
      lastComparedAt: input.now
    };

    return Promise.all([
      tx.userPoolScore.update({
        where: { id: input.leftScoreBefore.id },
        data: leftUpdate
      }),
      tx.userPoolScore.update({
        where: { id: input.rightScoreBefore.id },
        data: rightUpdate
      })
    ]);
  }

  return updateNonEffectiveScores(tx, input);
}

async function updateNonEffectiveScores(
  tx: Prisma.TransactionClient,
  input: {
    params: SubmitComparisonParams;
    leftScoreBefore: UserPoolScore;
    rightScoreBefore: UserPoolScore;
    now: Date;
  }
): Promise<[UserPoolScore, UserPoolScore]> {
  switch (input.params.result) {
    case PoolComparisonResult.SKIP:
      return Promise.all([
        tx.userPoolScore.update({
          where: { id: input.leftScoreBefore.id },
          data: { skipCount: { increment: 1 } }
        }),
        tx.userPoolScore.update({
          where: { id: input.rightScoreBefore.id },
          data: { skipCount: { increment: 1 } }
        })
      ]);
    case PoolComparisonResult.LEFT_UNSEEN:
      return Promise.all([
        markUnseen(tx, input.leftScoreBefore, input.params.userId, input.now),
        Promise.resolve(input.rightScoreBefore)
      ]);
    case PoolComparisonResult.RIGHT_UNSEEN:
      return Promise.all([
        Promise.resolve(input.leftScoreBefore),
        markUnseen(tx, input.rightScoreBefore, input.params.userId, input.now)
      ]);
    case PoolComparisonResult.BOTH_UNSEEN:
      return Promise.all([
        markUnseen(tx, input.leftScoreBefore, input.params.userId, input.now),
        markUnseen(tx, input.rightScoreBefore, input.params.userId, input.now)
      ]);
    case PoolComparisonResult.LEFT_WIN:
    case PoolComparisonResult.RIGHT_WIN:
    case PoolComparisonResult.DRAW:
      return [input.leftScoreBefore, input.rightScoreBefore];
  }
}

async function markUnseen(
  tx: Prisma.TransactionClient,
  score: UserPoolScore,
  userId: string,
  now: Date
): Promise<UserPoolScore> {
  const nextUnseenCount = score.unseenCount + 1;

  await tx.userAnimeStatus.upsert({
    where: {
      userId_animeId: {
        userId,
        animeId: score.animeId
      }
    },
    create: {
      userId,
      animeId: score.animeId,
      status: WatchStatus.UNSEEN,
      unseenCount: 1,
      source: "MATCH",
      firstMarkedAt: now,
      lastMarkedAt: now
    },
    update: {
      status: WatchStatus.UNSEEN,
      unseenCount: { increment: 1 },
      source: "MATCH",
      lastMarkedAt: now
    }
  });

  return tx.userPoolScore.update({
    where: {
      id: score.id
    },
    data: {
      unseenCount: { increment: 1 },
      isHidden: shouldHideAfterUnseen(nextUnseenCount)
    }
  });
}

function toPublicScore(score: UserPoolScore): PublicScore {
  return {
    id: score.id,
    userId: score.userId,
    poolId: score.poolId,
    runId: score.runId,
    animeId: score.animeId,
    eloScore: score.eloScore,
    uncertainty: score.uncertainty,
    compareCount: score.compareCount,
    winCount: score.winCount,
    lossCount: score.lossCount,
    drawCount: score.drawCount,
    unseenCount: score.unseenCount,
    skipCount: score.skipCount,
    isHidden: score.isHidden,
    manualTier: score.manualTier,
    manualRank: score.manualRank,
    manualLocked: score.manualLocked,
    lastComparedAt: score.lastComparedAt
  };
}
