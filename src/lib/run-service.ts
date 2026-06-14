import {
  PersonalRunStatus,
  PoolStatus,
  Prisma,
  type PersonalRun,
  type PoolAnime,
  type UserPoolScore
} from "@prisma/client";
import { AppError } from "./app-error";
import { prisma } from "./db";
import { canPlayPool } from "./pool-permissions";

export interface RunAccessParams {
  userId: string;
  poolId: string;
  runId: string;
}

export function validateRunAccessParams(params: RunAccessParams): void {
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

export async function getOrCreateDefaultRun(params: {
  userId: string;
  poolId: string;
}): Promise<PersonalRun> {
  if (!params.userId.trim() || !params.poolId.trim()) {
    throw new AppError("userId and poolId are required", 400, "INVALID_RUN_INPUT");
  }

  const pool = await prisma.customPool.findUnique({
    where: {
      id: params.poolId
    }
  });

  if (pool === null || pool.deletedAt !== null) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  if (!canPlayPool(pool, { id: params.userId })) {
    throw new AppError("你没有权限访问这个番组。", 403, "POOL_FORBIDDEN");
  }

  const existingRun = await prisma.personalRun.findFirst({
    where: {
      userId: params.userId,
      poolId: params.poolId,
      isDefault: true,
      status: PersonalRunStatus.ACTIVE,
      deletedAt: null
    }
  });

  if (existingRun !== null) {
    return existingRun;
  }

  return prisma.personalRun.create({
    data: {
      userId: params.userId,
      poolId: params.poolId,
      name: "默认榜单",
      isDefault: true,
      status: PersonalRunStatus.ACTIVE,
      algorithmVersion: "elo-v1",
      pairingVersion: "active-v1",
      tierRuleVersion: "percentile-v1"
    }
  });
}

export async function initializeScoresForRun(params: RunAccessParams): Promise<UserPoolScore[]> {
  await assertRunAccess(params);

  const poolAnime = await prisma.poolAnime.findMany({
    where: {
      poolId: params.poolId
    },
    orderBy: {
      position: "asc"
    }
  });

  return createScoresForPoolAnime(prisma, params, poolAnime);
}

export async function resetRunForUser(params: RunAccessParams): Promise<{
  run: PersonalRun;
  scoreCount: number;
  redirectTo: string;
}> {
  validateRunAccessParams(params);

  return prisma.$transaction(async (tx) => {
    const pool = await tx.customPool.findUnique({
      where: {
        id: params.poolId
      },
      select: {
        id: true,
        creatorId: true,
        visibility: true,
        allowCommunityMatch: true,
        status: true,
        deletedAt: true
      }
    });

    if (pool === null || pool.deletedAt !== null) {
      throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
    }

    if (!canPlayPool(pool, { id: params.userId })) {
      throw new AppError("你没有权限访问这个番组。", 403, "POOL_FORBIDDEN");
    }

    if (pool.status === PoolStatus.ARCHIVED) {
      throw new AppError("Pool is archived", 403, "POOL_ARCHIVED");
    }

    const run = await tx.personalRun.findUnique({
      where: {
        id: params.runId
      }
    });

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

    const poolAnime = await tx.poolAnime.findMany({
      where: {
        poolId: params.poolId
      },
      orderBy: {
        position: "asc"
      }
    });

    if (poolAnime.length < 2) {
      throw new AppError("至少需要 2 部作品才能重开本轮。", 400, "RUN_RESET_NOT_ENOUGH_ANIME");
    }

    await tx.personalRun.updateMany({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        isDefault: true,
        deletedAt: null
      },
      data: {
        isDefault: false
      }
    });

    const newRun = await tx.personalRun.create({
      data: {
        userId: params.userId,
        poolId: params.poolId,
        name: "默认榜单",
        isDefault: true,
        status: PersonalRunStatus.ACTIVE,
        algorithmVersion: "elo-v1",
        pairingVersion: "active-v1",
        tierRuleVersion: "percentile-v1"
      }
    });

    const scores = await createScoresForPoolAnime(
      tx,
      {
        userId: params.userId,
        poolId: params.poolId,
        runId: newRun.id
      },
      poolAnime
    );

    return {
      run: newRun,
      scoreCount: scores.length,
      redirectTo: `/pools/${params.poolId}/runs/${newRun.id}/match`
    };
  });
}

async function createScoresForPoolAnime(
  db: Prisma.TransactionClient | typeof prisma,
  params: RunAccessParams,
  poolAnime: PoolAnime[]
): Promise<UserPoolScore[]> {
  const scores: UserPoolScore[] = [];

  for (const entry of poolAnime) {
    scores.push(
      await db.userPoolScore.upsert({
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
        update: {}
      })
    );
  }

  return scores;
}

export async function assertRunAccess(params: RunAccessParams): Promise<PersonalRun> {
  validateRunAccessParams(params);

  const [pool, run] = await Promise.all([
    prisma.customPool.findUnique({
      where: {
        id: params.poolId
      }
    }),
    prisma.personalRun.findUnique({
      where: {
        id: params.runId
      }
    })
  ]);

  if (pool === null || pool.deletedAt !== null) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  if (!canPlayPool(pool, { id: params.userId })) {
    throw new AppError("你没有权限访问这个番组。", 403, "POOL_FORBIDDEN");
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

  return run;
}
