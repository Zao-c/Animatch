import type { Anime, UserPoolScore } from "@prisma/client";
import { toPublicAnime } from "./anime-service";
import { getEffectiveAnimeDisplay, type EffectiveAnimeDisplay } from "./anime-display";
import { prisma } from "./db";
import { buildScoreDistribution, type RankingScoreDistribution } from "./ranking-display";
import { buildRankingProgress, type RankingProgress } from "./ranking-progress";
import { buildTierList, calculateRankingConfidence, type Tier } from "./tier";
import { assertRunAccess } from "./run-service";

type ScoreWithAnime = UserPoolScore & { anime: Anime };

export interface TierListItem extends ReturnType<typeof toPublicAnime> {
  display?: EffectiveAnimeDisplay;
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
  effectiveComparisons: number;
  scoreDistribution: RankingScoreDistribution;
  progress: RankingProgress;
}

export function toTierListItem(
  score: ScoreWithAnime,
  display?: EffectiveAnimeDisplay
): TierListItem {
  return {
    ...toPublicAnime(score.anime),
    display,
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

  const [scores, totalComparisons, effectiveComparisons, poolAnimeEntries] = await Promise.all([
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
    }),
    prisma.poolComparison.count({
      where: {
        userId: params.userId,
        poolId: params.poolId,
        runId: params.runId,
        isEffective: true
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
  const items = scores.map((score) =>
    toTierListItem(score, displayByAnimeId.get(score.animeId))
  );
  const tiers = buildTierList(items);

  return {
    tiers,
    confidenceScore: calculateRankingConfidence(items),
    totalAnime: scores.length,
    comparedAnime: scores.filter((score) => score.compareCount > 0).length,
    totalComparisons,
    effectiveComparisons,
    scoreDistribution: buildScoreDistribution(items.map((item) => item.eloScore)),
    progress: buildRankingProgress({
      totalItems: scores.length,
      effectiveComparisons,
      comparedItems: scores.filter((score) => score.compareCount > 0).length,
      totalComparisons
    })
  };
}
