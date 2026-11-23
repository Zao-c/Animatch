import { PersonalRunStatus } from "@prisma/client";
import { AppError } from "./app-error";
import { getAnimeCoverUrl } from "./anime-cover-url";
import { getEffectiveAnimeDisplay } from "./anime-display";
import { prisma } from "./db";
import { canReadCommunityRanking } from "./pool-permissions";

export interface CommunityRankingItem {
  animeId: string;
  title: string;
  imageUrl: string | null;
  averageRating: number | null;
  communityScore: number | null;
  participantCount: number;
  comparisonCount: number;
  rank: number | null;
  insufficientSample: boolean;
}

export interface CommunityRankingResponse {
  poolId: string;
  totalParticipants: number;
  totalRuns: number;
  totalAnime: number;
  minSampleThreshold: {
    minUsers: number;
    minComparisons: number;
  };
  items: CommunityRankingItem[];
}

const PRIOR_RATING = 1500;
const MIN_USERS = 3;
const MIN_COMPARISONS = 6;

interface AnimeAggregate {
  animeId: string;
  title: string;
  imageUrl: string | null;
  ratingSum: number;
  weightedEloSum: number;
  weightSum: number;
  participantIds: Set<string>;
  comparisonCount: number;
}

export interface CommunitySummary {
  poolId: string;
  topAnimeTitle: string | null;
  topAnimeImageUrl: string | null;
  topAnimeId: string | null;
  participantCount: number;
  totalRuns: number;
  sampleLabel: "empty" | "low" | "trend" | "stable";
}

export async function getCommunitySummaries(poolIds: string[]): Promise<Map<string, CommunitySummary>> {
  const result = new Map<string, CommunitySummary>();

  if (poolIds.length === 0) {
    return result;
  }

  for (const poolId of poolIds) {
    result.set(poolId, {
      poolId,
      topAnimeTitle: null,
      topAnimeImageUrl: null,
      topAnimeId: null,
      participantCount: 0,
      totalRuns: 0,
      sampleLabel: "empty"
    });
  }

  const runRows = await prisma.personalRun.findMany({
    where: {
      poolId: { in: poolIds },
      isDefault: true,
      status: PersonalRunStatus.ACTIVE,
      deletedAt: null
    },
    select: {
      id: true,
      poolId: true,
      userId: true
    }
  });

  const runIdsByPool = new Map<string, string[]>();
  const usersByPool = new Map<string, Set<string>>();

  for (const run of runRows) {
    const ids = runIdsByPool.get(run.poolId) ?? [];
    ids.push(run.id);
    runIdsByPool.set(run.poolId, ids);

    const users = usersByPool.get(run.poolId) ?? new Set();
    users.add(run.userId);
    usersByPool.set(run.poolId, users);
  }

  for (const poolId of poolIds) {
    const users = usersByPool.get(poolId);
    const runs = runIdsByPool.get(poolId);
    const entry = result.get(poolId)!;
    entry.totalRuns = runs?.length ?? 0;
    entry.participantCount = users?.size ?? 0;
  }

  const allRunIds = [...runIdsByPool.values()].flat();
  if (allRunIds.length === 0) {
    return result;
  }

  const poolAnime = await prisma.poolAnime.findMany({
    where: {
      poolId: { in: poolIds }
    },
    include: {
      anime: true
    },
    orderBy: { position: "asc" }
  });

  const poolAnimeByPool = new Map<string, typeof poolAnime>();
  const allAnimeIds = new Set<string>();

  for (const entry of poolAnime) {
    const list = poolAnimeByPool.get(entry.poolId) ?? [];
    list.push(entry);
    poolAnimeByPool.set(entry.poolId, list);
    allAnimeIds.add(entry.animeId);
  }

  const scores = await prisma.userPoolScore.findMany({
    where: {
      poolId: { in: poolIds },
      runId: { in: allRunIds },
      animeId: { in: [...allAnimeIds] },
      compareCount: { gt: 0 },
      isHidden: false
    },
    select: {
      poolId: true,
      runId: true,
      userId: true,
      animeId: true,
      eloScore: true,
      compareCount: true
    }
  });

  const runToUser = new Map(runRows.map((r) => [r.id, r.userId]));
  const runToPool = new Map(runRows.map((r) => [r.id, r.poolId]));

  const animeAgg = new Map<string, Map<string, { eloSum: number; weightSum: number; users: Set<string>; compareCount: number }>>();

  for (const score of scores) {
    const aggPoolId = runToPool.get(score.runId);
    if (aggPoolId === undefined) continue;
    const userId = runToUser.get(score.runId);
    if (userId === undefined || userId !== score.userId) continue;

    let poolMap = animeAgg.get(aggPoolId);
    if (poolMap === undefined) {
      poolMap = new Map();
      animeAgg.set(aggPoolId, poolMap);
    }

    let agg = poolMap.get(score.animeId);
    if (agg === undefined) {
      agg = { eloSum: 0, weightSum: 0, users: new Set(), compareCount: 0 };
      poolMap.set(score.animeId, agg);
    }

    const key = `${score.userId}:${score.animeId}`;
    if (agg.users.has(key)) continue;
    agg.users.add(key);

    const weight = Math.min(score.compareCount / 5, 1);
    agg.eloSum += score.eloScore * weight;
    agg.weightSum += weight;
    agg.compareCount += score.compareCount;
  }

  for (const poolId of poolIds) {
    const entry = result.get(poolId)!;
    const entries = poolAnimeByPool.get(poolId) ?? [];
    const poolAggMap = animeAgg.get(poolId);

    let bestAnimeTitle: string | null = null;
    let bestAnimeImageUrl: string | null = null;
    let bestAnimeId: string | null = null;
    let bestScore = -Infinity;

    for (const pa of entries) {
      const agg = poolAggMap?.get(pa.animeId);
      if (agg === undefined || agg.users.size === 0) continue;

      const communityScore =
        (PRIOR_RATING * MIN_USERS + agg.eloSum) / (MIN_USERS + agg.weightSum);

      if (communityScore > bestScore) {
        bestScore = communityScore;
        const display = getEffectiveAnimeDisplay(pa);
        const coverUrl = getAnimeCoverUrl(
          {
            coverUrlOverride: pa.coverUrlOverride,
            display: {
              coverUrl: display.coverUrl,
              isCoverOverridden: display.isCoverOverridden
            },
            coverUrl: pa.anime.imageUrl,
            cachedCoverUrl: pa.anime.cachedCoverUrl,
            imageUrl: pa.anime.imageUrl,
            imageSmallUrl: pa.anime.imageSmallUrl,
            imageMediumUrl: pa.anime.imageMediumUrl,
            imageLargeUrl: pa.anime.imageLargeUrl,
            thumbnailUrl: pa.anime.thumbnailUrl
          },
          { intent: "hero" }
        );
        bestAnimeTitle = display.title;
        bestAnimeImageUrl = coverUrl;
        bestAnimeId = pa.animeId;
      }
    }

    entry.topAnimeTitle = bestAnimeTitle;
    entry.topAnimeImageUrl = bestAnimeImageUrl;
    entry.topAnimeId = bestAnimeId;

    const participantCount = entry.participantCount;
    if (participantCount === 0) {
      entry.sampleLabel = "empty";
    } else if (participantCount <= 2) {
      entry.sampleLabel = "low";
    } else if (participantCount <= 5) {
      entry.sampleLabel = "trend";
    } else {
      entry.sampleLabel = "stable";
    }
  }

  return result;
}

export async function getCommunityRanking(poolId: string): Promise<CommunityRankingResponse> {
  if (!poolId.trim()) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  const pool = await prisma.customPool.findUnique({
    where: {
      id: poolId
    },
    select: {
      id: true,
      visibility: true,
      status: true,
      deletedAt: true
    }
  });

  if (pool === null) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  if (!canReadCommunityRanking(pool)) {
    throw new AppError(
      "Community ranking is only available for active public pools",
      404,
      "COMMUNITY_RANKING_NOT_AVAILABLE"
    );
  }

  const poolAnime = await prisma.poolAnime.findMany({
    where: {
      poolId
    },
    orderBy: {
      position: "asc"
    },
    include: {
      anime: true
    }
  });
  const activeAnimeIds = new Set(poolAnime.map((entry) => entry.animeId));
  const aggregates = new Map<string, AnimeAggregate>();

  for (const entry of poolAnime) {
    const display = getEffectiveAnimeDisplay(entry);
    const displayCoverUrl = getAnimeCoverUrl(
      {
        coverUrlOverride: entry.coverUrlOverride,
        display: { coverUrl: display.coverUrl, isCoverOverridden: display.isCoverOverridden },
        coverUrl: entry.anime.imageUrl,
        cachedCoverUrl: entry.anime.cachedCoverUrl,
        imageUrl: entry.anime.imageUrl,
        imageSmallUrl: entry.anime.imageSmallUrl,
        imageMediumUrl: entry.anime.imageMediumUrl,
        imageLargeUrl: entry.anime.imageLargeUrl,
        thumbnailUrl: entry.anime.thumbnailUrl
      },
      { intent: "hero" }
    );
    aggregates.set(entry.animeId, {
      animeId: entry.animeId,
      title: display.title,
      imageUrl: displayCoverUrl,
      ratingSum: 0,
      weightedEloSum: 0,
      weightSum: 0,
      participantIds: new Set(),
      comparisonCount: 0
    });
  }

  const defaultRuns = await prisma.personalRun.findMany({
    where: {
      poolId,
      isDefault: true,
      status: PersonalRunStatus.ACTIVE,
      deletedAt: null
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      userId: true
    }
  });
  const runsByUserId = new Map<string, { id: string; userId: string }>();

  for (const run of defaultRuns) {
    if (!runsByUserId.has(run.userId)) {
      runsByUserId.set(run.userId, run);
    }
  }

  const currentRuns = [...runsByUserId.values()];
  const runById = new Map(currentRuns.map((run) => [run.id, run]));
  const runIds = currentRuns.map((run) => run.id);

  if (runIds.length > 0 && activeAnimeIds.size > 0) {
    const scores = await prisma.userPoolScore.findMany({
      where: {
        poolId,
        runId: {
          in: runIds
        },
        animeId: {
          in: [...activeAnimeIds]
        },
        compareCount: {
          gt: 0
        },
        isHidden: false
      },
      select: {
        userId: true,
        runId: true,
        animeId: true,
        eloScore: true,
        compareCount: true,
        isHidden: true
      }
    });
    const seenUserAnime = new Set<string>();

    for (const score of scores) {
      if (score.compareCount <= 0 || score.isHidden) {
        continue;
      }

      const run = runById.get(score.runId);
      if (run === undefined || run.userId !== score.userId) {
        continue;
      }

      const aggregate = aggregates.get(score.animeId);
      if (aggregate === undefined) {
        continue;
      }

      const userAnimeKey = `${score.userId}:${score.animeId}`;
      if (seenUserAnime.has(userAnimeKey)) {
        continue;
      }

      seenUserAnime.add(userAnimeKey);
      const userWeight = Math.min(score.compareCount / 5, 1);
      aggregate.ratingSum += score.eloScore;
      aggregate.weightedEloSum += score.eloScore * userWeight;
      aggregate.weightSum += userWeight;
      aggregate.participantIds.add(score.userId);
      aggregate.comparisonCount += score.compareCount;
    }
  }

  const items = [...aggregates.values()].map(toRankingItem);
  const sufficientItems = items
    .filter((item) => !item.insufficientSample)
    .sort(compareSufficientItems)
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  const insufficientItems = items
    .filter((item) => item.insufficientSample)
    .sort(compareInsufficientItems);
  const totalParticipants = new Set(
    items.flatMap((item) => {
      const aggregate = aggregates.get(item.animeId);
      return aggregate === undefined ? [] : [...aggregate.participantIds];
    })
  ).size;

  return {
    poolId,
    totalParticipants,
    totalRuns: currentRuns.length,
    totalAnime: poolAnime.length,
    minSampleThreshold: {
      minUsers: MIN_USERS,
      minComparisons: MIN_COMPARISONS
    },
    items: [...sufficientItems, ...insufficientItems]
  };
}

function toRankingItem(aggregate: AnimeAggregate): CommunityRankingItem {
  const participantCount = aggregate.participantIds.size;
  const insufficientSample =
    participantCount < MIN_USERS || aggregate.comparisonCount < MIN_COMPARISONS;

  return {
    animeId: aggregate.animeId,
    title: aggregate.title,
    imageUrl: aggregate.imageUrl,
    averageRating:
      participantCount === 0 ? null : aggregate.ratingSum / participantCount,
    communityScore:
      participantCount === 0
        ? null
        : (PRIOR_RATING * MIN_USERS + aggregate.weightedEloSum) /
          (MIN_USERS + aggregate.weightSum),
    participantCount,
    comparisonCount: aggregate.comparisonCount,
    rank: null,
    insufficientSample
  };
}

function compareSufficientItems(left: CommunityRankingItem, right: CommunityRankingItem): number {
  return (
    (right.communityScore ?? 0) - (left.communityScore ?? 0) ||
    right.participantCount - left.participantCount ||
    right.comparisonCount - left.comparisonCount ||
    left.title.localeCompare(right.title) ||
    left.animeId.localeCompare(right.animeId)
  );
}

function compareInsufficientItems(left: CommunityRankingItem, right: CommunityRankingItem): number {
  return (
    right.participantCount - left.participantCount ||
    right.comparisonCount - left.comparisonCount ||
    left.title.localeCompare(right.title) ||
    left.animeId.localeCompare(right.animeId)
  );
}
