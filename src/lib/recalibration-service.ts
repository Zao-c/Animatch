import {
  PoolComparisonMode,
  RecalibrationSessionStatus,
  RecalibrationSessionType
} from "@prisma/client";
import { AppError } from "./app-error";
import { prisma } from "./db";
import { assertRunAccess } from "./run-service";
import { getRunTierList } from "./tier-service";
import {
  buildRecalibrationQueue,
  estimateRecalibrationNeed,
  type RecalibrationPair,
  type RecalibrationType
} from "./recalibration-rules";

export function modeForRecalibrationType(type: RecalibrationSessionType): PoolComparisonMode {
  switch (type) {
    case RecalibrationSessionType.RANGE:
      return PoolComparisonMode.RANGE_RECALIBRATE;
    case RecalibrationSessionType.FOCUS:
      return PoolComparisonMode.FOCUS_RECALIBRATE;
    case RecalibrationSessionType.SMART:
      return PoolComparisonMode.RECALIBRATE;
  }
}

export async function getRecalibrationSuggestions(params: {
  userId: string;
  poolId: string;
  runId: string;
  type?: RecalibrationType;
  targetTier?: string;
  targetAnimeIds?: string[];
  limit?: number;
}) {
  await assertRunAccess(params);

  const [scores, compared, recent] = await Promise.all([
    getScoresWithTier(params),
    prisma.poolComparison.findMany({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId
      },
      select: {
        pairKey: true
      }
    }),
    prisma.poolComparison.findMany({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50,
      select: {
        pairKey: true
      }
    })
  ]);
  const need = estimateRecalibrationNeed(scores);
  const pairs = buildRecalibrationQueue({
    scores,
    comparedPairKeys: new Set(compared.map((comparison) => comparison.pairKey)),
    recentPairKeys: new Set(recent.map((comparison) => comparison.pairKey)),
    limit: Math.min(50, Math.max(1, Math.trunc(params.limit ?? 20))),
    type: params.type,
    targetTier: params.targetTier,
    targetAnimeIds: params.targetAnimeIds
  });

  return {
    ...need,
    pairs
  };
}

export async function createRecalibrationSession(params: {
  userId: string;
  poolId: string;
  runId: string;
  type: RecalibrationSessionType;
  targetTier?: string;
  targetAnimeIds?: string[];
  plannedCount?: number;
}) {
  await assertRunAccess(params);

  const plannedCount = Math.min(50, Math.max(1, Math.trunc(params.plannedCount ?? 20)));
  const session = await prisma.recalibrationSession.create({
    data: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId,
      type: params.type,
      targetTier: params.targetTier,
      targetAnimeIds: params.targetAnimeIds ?? [],
      plannedCount
    }
  });
  const suggestions = await getRecalibrationSuggestions({
    userId: params.userId,
    poolId: params.poolId,
    runId: params.runId,
    type: params.type,
    targetTier: params.targetTier,
    targetAnimeIds: params.targetAnimeIds,
    limit: plannedCount
  });

  return {
    session,
    suggestions
  };
}

export async function getRecalibrationNextPair(params: {
  userId: string;
  poolId: string;
  runId: string;
  sessionId: string;
}) {
  const session = await assertActiveRecalibrationSession(params);

  if (session.completedCount >= session.plannedCount) {
    await prisma.recalibrationSession.update({
      where: { id: session.id },
      data: { status: RecalibrationSessionStatus.COMPLETED }
    });

    return {
      session: { ...session, status: RecalibrationSessionStatus.COMPLETED },
      pair: null
    };
  }

  const suggestions = await getRecalibrationSuggestions({
    userId: params.userId,
    poolId: params.poolId,
    runId: params.runId,
    type: session.type,
    targetTier: session.targetTier ?? undefined,
    targetAnimeIds: session.targetAnimeIds,
    limit: 1
  });
  const pair = suggestions.pairs[0] ?? null;

  if (pair === null) {
    const completed = await prisma.recalibrationSession.update({
      where: { id: session.id },
      data: { status: RecalibrationSessionStatus.COMPLETED }
    });

    return {
      session: completed,
      pair: null
    };
  }

  return {
    session,
    pair
  };
}

export async function completeRecalibrationProgress(params: { sessionId: string }) {
  const session = await prisma.recalibrationSession.findUnique({
    where: {
      id: params.sessionId
    }
  });

  if (session === null || session.status !== RecalibrationSessionStatus.ACTIVE) {
    return session;
  }

  const nextCompletedCount = session.completedCount + 1;

  return prisma.recalibrationSession.update({
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

export async function assertActiveRecalibrationSession(params: {
  userId: string;
  poolId: string;
  runId: string;
  sessionId: string;
}) {
  await assertRunAccess(params);

  const session = await prisma.recalibrationSession.findUnique({
    where: {
      id: params.sessionId
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

  return session;
}

async function getScoresWithTier(params: { userId: string; poolId: string; runId: string }) {
  const tierList = await getRunTierList(params);

  return Object.entries(tierList.tiers).flatMap(([tier, items]) =>
    items.map((item, index) => ({
      animeId: item.animeId,
      eloScore: item.eloScore,
      uncertainty: item.uncertainty,
      compareCount: item.compareCount,
      tier,
      rank: index,
      isHidden: false
    }))
  );
}

export type PublicRecalibrationPair = RecalibrationPair;
