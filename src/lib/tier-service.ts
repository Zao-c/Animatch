import type { Anime, UserPoolScore } from "@prisma/client";
import { toPublicAnime } from "./anime-service";
import { prisma } from "./db";
import { buildTierList, calculateRankingConfidence, type Tier } from "./tier";
import { assertRunAccess } from "./run-service";

type ScoreWithAnime = UserPoolScore & { anime: Anime };

export interface TierListItem extends ReturnType<typeof toPublicAnime> {
  animeId: string;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  unseenCount: number;
  skipCount: number;
  manualTier: string | null;
  manualRank: number | null;
  manualLocked: boolean;
}

export interface RunTierListResult {
  tiers: Record<Tier, TierListItem[]>;
  confidenceScore: number;
  totalAnime: number;
  comparedAnime: number;
  totalComparisons: number;
}

export function toTierListItem(score: ScoreWithAnime): TierListItem {
  return {
    ...toPublicAnime(score.anime),
    animeId: score.animeId,
    eloScore: score.eloScore,
    uncertainty: score.uncertainty,
    compareCount: score.compareCount,
    winCount: score.winCount,
    lossCount: score.lossCount,
    drawCount: score.drawCount,
    unseenCount: score.unseenCount,
    skipCount: score.skipCount,
    manualTier: score.manualTier,
    manualRank: score.manualRank,
    manualLocked: score.manualLocked
  };
}

export async function getRunTierList(params: {
  userId: string;
  poolId: string;
  runId: string;
}): Promise<RunTierListResult> {
  await assertRunAccess(params);

  const [scores, totalComparisons] = await Promise.all([
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
    prisma.poolComparison.count({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId
      }
    })
  ]);
  const items = scores.map(toTierListItem);
  const tiers = buildTierList(items);

  return {
    tiers,
    confidenceScore: calculateRankingConfidence(items),
    totalAnime: scores.length,
    comparedAnime: scores.filter((score) => score.compareCount > 0).length,
    totalComparisons
  };
}
