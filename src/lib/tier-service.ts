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
  const activeAnimeIds = new Set(poolAnimeEntries.map((entry) => entry.animeId));
  const displayByAnimeId = new Map(
    poolAnimeEntries.map((entry) => [entry.animeId, getEffectiveAnimeDisplay(entry)])
  );
  const activeScores = scores.filter((score) => activeAnimeIds.has(score.animeId));
  const activeComparisonsWhere = {
    userId: params.userId,
    poolId: params.poolId,
    runId: params.runId,
    undoneAt: null,
    leftAnimeId: {
      in: [...activeAnimeIds]
    },
    rightAnimeId: {
      in: [...activeAnimeIds]
    }
  };
  const [activeTotalComparisons, activeEffectiveComparisons] = await Promise.all([
    prisma.poolComparison.count({
      where: activeComparisonsWhere
    }),
    prisma.poolComparison.count({
      where: {
        ...activeComparisonsWhere,
        isEffective: true
      }
    })
  ]);
  const items = activeScores.map((score) =>
    toTierListItem(score, displayByAnimeId.get(score.animeId))
  );
  const tiers = buildTierList(items);

  return {
    tiers,
    confidenceScore: calculateRankingConfidence(items),
    totalAnime: activeAnimeIds.size,
    comparedAnime: activeScores.filter((score) => score.compareCount > 0).length,
    totalComparisons: activeTotalComparisons,
    effectiveComparisons: activeEffectiveComparisons,
    scoreDistribution: buildScoreDistribution(items.map((item) => item.eloScore)),
    progress: buildRankingProgress({
      totalItems: activeAnimeIds.size,
      effectiveComparisons: activeEffectiveComparisons,
      comparedItems: activeScores.filter((score) => score.compareCount > 0).length,
      totalComparisons: activeTotalComparisons
    })
  };
}
