import { Prisma, type UserPoolScore } from "@prisma/client";
import { AppError } from "./app-error";
import { prisma } from "./db";
import { assertRunAccess } from "./run-service";
import { getRunTierList } from "./tier-service";
import { resolveTierRows, type PoolTierConfig } from "./tier-config";

const TIER_MIN_COUNT = 2;

export interface ManualTierInput {
  tier: string;
  animeIds: string[];
}

export interface ManualTierUpdate {
  animeId: string;
  manualTier: string;
  manualRank: number;
}

export function validateTierPayload(tiers: ManualTierInput[]): void {
  const seenAnimeIds = new Set<string>();
  const tierIds = new Set(tiers.map((t) => t.tier));

  for (const tierGroup of tiers) {
    if (!tierGroup.tier.trim()) {
      throw new AppError("tier is required", 400, "INVALID_TIER");
    }

    for (const animeId of tierGroup.animeIds) {
      if (!animeId.trim()) {
        throw new AppError("animeId is required", 400, "ANIME_ID_REQUIRED");
      }

      if (seenAnimeIds.has(animeId)) {
        throw new AppError("Duplicate animeId in manual tier payload", 400, "DUPLICATE_ANIME_ID");
      }

      seenAnimeIds.add(animeId);
    }
  }

  if (tierIds.size < TIER_MIN_COUNT) {
    throw new AppError("至少需要两条不同的 Tier 行。", 400, "INVALID_TIER");
  }
}

export function applyManualTierOrdering(tiers: ManualTierInput[]): ManualTierUpdate[] {
  validateTierPayload(tiers);

  return tiers.flatMap((tierGroup) =>
    tierGroup.animeIds.map((animeId, index) => ({
      animeId,
      manualTier: tierGroup.tier,
      manualRank: index
    }))
  );
}

export async function saveManualTierList(params: {
  userId: string;
  poolId: string;
  runId: string;
  tiers: ManualTierInput[];
}) {
  const updates = applyManualTierOrdering(params.tiers);

  await assertRunAccess(params);

  const pool = await prisma.customPool.findUnique({
    where: { id: params.poolId },
    select: { tierConfig: true }
  });

  const tierRows = resolveTierRows(pool?.tierConfig as unknown as PoolTierConfig | null);
  const validTierIds = new Set(tierRows.map((r) => r.id));

  for (const update of updates) {
    const lower = update.manualTier.toLowerCase();
    if (!validTierIds.has(lower)) {
      throw new AppError(
        `无效的 Tier "${update.manualTier}"，当前番组的 Tier 行为：${tierRows.map((r) => r.id).join(", ")}。`,
        400,
        "INVALID_TIER"
      );
    }
    update.manualTier = lower;
  }

  await prisma.$transaction(async (tx) => {
    const existingScores = await tx.userPoolScore.findMany({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId,
        animeId: {
          in: updates.map((update) => update.animeId)
        }
      }
    });
    const scoreByAnimeId = new Map(existingScores.map((score) => [score.animeId, score]));

    for (const update of updates) {
      const score = scoreByAnimeId.get(update.animeId);

      if (score === undefined) {
        throw new AppError("Anime does not belong to this run", 400, "ANIME_NOT_IN_RUN");
      }

      await writeManualTierAdjustment(tx, params, score, update);
      await tx.userPoolScore.update({
        where: {
          id: score.id
        },
        data: {
          manualTier: update.manualTier,
          manualRank: update.manualRank,
          manualLocked: true
        }
      });
    }
  });

  return getRunTierList(params);
}

export async function clearManualTier(params: {
  userId: string;
  poolId: string;
  runId: string;
  animeId?: string;
}) {
  await assertRunAccess(params);

  await prisma.userPoolScore.updateMany({
    where: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId,
      animeId: params.animeId,
      manualLocked: true
    },
    data: {
      manualTier: null,
      manualRank: null,
      manualLocked: false
    }
  });

  return getRunTierList(params);
}

async function writeManualTierAdjustment(
  tx: Prisma.TransactionClient,
  params: { userId: string; poolId: string; runId: string },
  score: UserPoolScore,
  update: ManualTierUpdate
) {
  await tx.manualTierAdjustment.create({
    data: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId,
      animeId: update.animeId,
      fromTier: score.manualTier,
      toTier: update.manualTier,
      fromRank: score.manualRank,
      toRank: update.manualRank,
      eloScoreAtAdjustment: score.eloScore
    }
  });
}
